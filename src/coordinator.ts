// @ts-nocheck
// Adapted from @tscaps/engine 0.7.0 (MIT); see third_party/TSCAPS_LICENSE.txt.
import { Input, BlobSource, ALL_FORMATS, } from 'mediabunny';
import { RenderTimeMap } from '../node_modules/@tscaps/engine/dist/modules/video/RenderTimeMap.js';
import { RetainedVideoFrame } from '../node_modules/@tscaps/engine/dist/modules/video/mediabunny/frame/RetainedVideoFrame.js';
/**
 * Runs one mediabunny transcode: opens the source input, resolves the
 * output dimensions / frame rate / duration, wires the encoder and the
 * audio bridge, and drives the decode → paint → encode loop.
 *
 * Consumer-specific per-frame composition (captions, overlay, raw-frame
 * passthrough) lives behind the request's {@link FramePainter}; codec
 * choice, container format, time-range skipping, and audio-loss and
 * fallback-decoder notifications are per-request inputs. The coordinator
 * itself knows nothing about documents, styles, or overlays — those
 * live inside the painter.
 *
 * One run at a time per instance; concurrent {@link execute} calls on
 * the same instance are not supported.
 */
export class MediaBunnyTranscodeCoordinator {
    /**
     * Shortest cut worth seeking past. A seek resumes at the key frame
     * before it, and measured h264 sources key every 1.0-3.5 s.
     */
    static MIN_SEEK_SKIP_SEC = 3;
    videoFrameDecoderFactory;
    videoTrackEncoderFactory;
    audioTrackBridgeFactory;
    outputTargetBuilder;
    constructor(config) {
        this.videoFrameDecoderFactory = config.videoFrameDecoderFactory;
        this.videoTrackEncoderFactory = config.videoTrackEncoderFactory;
        this.audioTrackBridgeFactory = config.audioTrackBridgeFactory;
        this.outputTargetBuilder = config.outputTargetBuilder;
    }
    /** The codecs a transparent output can be written with, in order of preference. */
    static ALPHA_CODECS = ['vp9', 'vp8'];
    async execute(request) {
        this.assertWebCodecsAvailable();
        const alpha = request.alpha ?? false;
        if (alpha && request.outputFormat !== 'webm') {
            throw new Error(`A transparent output needs the WebM format; ${request.outputFormat ?? 'mp4'} cannot carry alpha.`);
        }
        const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(request.source) });
        let ownedOutput;try { request.signal?.throwIfAborted();
const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) {
            throw new Error('No video track found in the input file');
        }
        const { width, height } = this.resolveOutputDimensions(videoTrack.displayWidth, videoTrack.displayHeight, request.outputResolution);
        const fps = await this.readFrameRate(videoTrack);
        const timeMap = request.timeMap ?? new RenderTimeMap([]);
        const { output, target, format } = this.outputTargetBuilder.build({
            format: request.outputFormat,
            stream: request.outputStream,
        });
        ownedOutput=output;
const codecResolution = await request.codecPolicy.resolveVideo({
            supportedCodecs: this.codecsFor(format.getSupportedVideoCodecs(), alpha),
            width,
            height,
            fps,
            quality: request.quality,
        });
        const encoder = this.videoTrackEncoderFactory.create({
            width,
            height,
            alpha,
            encoderConfig: this.toEncoderConfig(codecResolution, alpha),
        });
        encoder.attachTo(output);
        const audioBridge = await this.audioTrackBridgeFactory.create({
            input,
            format,
            timeMap,
            wanted: request.audio !== 'discard',
            ...(request.onAudioDiscarded ? { onAudioDiscarded: request.onAudioDiscarded } : {}),
        });
        await audioBridge.attachTo(output);
        const decoder = await this.videoFrameDecoderFactory.create({
            track: videoTrack,
            source: request.source,
            pixels: request.sourcePixels ?? true,
            ...(request.confirmFallbackDecoder ? { confirmFallback: request.confirmFallbackDecoder } : {}),
            ...(request.onVideoFrameDecoderSelected ? { onDecoderSelected: request.onVideoFrameDecoderSelected } : {}),
        });
        const sourceDuration = await this.computeDuration(videoTrack);
        const outputDuration = Math.max(0, sourceDuration - timeMap.totalSkipDuration());
        let painterStarted = false;
        try {
            await request.painter.begin(width, height, fps);
            painterStarted = true;
            await output.start();
            await this.runEncodeLoop({
                decoder,
                encoder,
                audioBridge,
                timeMap,
                outputDuration,
                totalFrames: Math.round(outputDuration * fps),
                painter: request.painter,
                sourcePixels: request.sourcePixels ?? true,
                width,
                height,
                signal: request.signal,
                onProgress: request.onProgress,
            });
            await audioBridge.finish();
            await output.finalize();
        }
        catch (err) {
            await this.safeCancel(output);
            throw err;
        }
        finally {
            decoder.close();
            if (painterStarted)
                request.painter.end();
        }
        return this.buildResult(target, request.outputFormat, width, height);
} finally { if(ownedOutput && !["finalized","canceled"].includes(ownedOutput.state))await this.safeCancel(ownedOutput);input.dispose(); }
    }
    /**
     * Drives decode → paint → encode, handing the painter runs of frames
     * as long as it asked for.
     *
     * Only one frame the decoder lent us is ever alive: holding several
     * would back-pressure the WebCodecs frame pool into a stall. A run
     * longer than one frame is therefore held as copies of our own, paid
     * for in a full-frame draw and the pixels of every frame in the run.
     */
    async runEncodeLoop(params) {
        const lookAhead = Math.max(1, params.painter.lookAhead());
        const group = [];
        let decodedCount = 0;
        let frameCount = 0;
        try {
            for (const span of this.decodeSpansFor(params)) {
                for await (const frame of params.decoder.samples(span)) {
                    // Checked before the frame joins the group, so it is closed here
                    // rather than left to the `finally`.
                    if (params.signal?.aborted) {
                        frame.close();
                        throw new DOMException('The transcode was aborted.', 'AbortError');
                    }
                    decodedCount++;
                    if (frame.timestamp < 0 || params.timeMap.isSkipped(frame.timestamp)) {
                        frame.close();
                        continue;
                    }
                    group.push(this.toPaintRequest(frame, params, lookAhead));
                    if (group.length < lookAhead)
                        continue;
                    frameCount = await this.encodeGroup(group, params, frameCount);
                }
            }
            // Whatever the last run was short of: the decoder ended before the
            // painter's reach filled up, which is the normal way a render ends.
            await this.encodeGroup(group, params, frameCount);
        }
        finally {
            // A run abandoned half-gathered still holds frames nobody will
            // encode: the decoder threw partway, or retaining one did.
            this.closeGroup(group);
        }
        // Some decoders drop undecodable samples silently instead of erroring.
        // Finalizing with zero decoded frames would emit an output whose video
        // track is empty — readers of that file see no video track at all.
        if (decodedCount === 0) {
            throw new Error('The video decoder produced no frames for this input.');
        }
    }
    /** The stretches to read, or the whole track when the decoder cannot seek. */
    decodeSpansFor(params) {
        if (!params.decoder.canSeek())
            return [undefined];
        return params.timeMap.decodeSpans(MediaBunnyTranscodeCoordinator.MIN_SEEK_SKIP_SEC);
    }
    /**
     * The frame as the painter will receive it. A run of one is handed the
     * decoder's own frame, which the run closes when it is done with it. A
     * longer run outlives what the decoder will lend, so the pixels are
     * copied and its frame handed straight back — whether or not the copy
     * succeeds, since a frame the decoder never gets back stalls its pool.
     * A frame that carries timing only holds nothing to lend, so it is kept
     * as it is.
     */
    toPaintRequest(frame, params, lookAhead) {
        const outputTimestamp = params.timeMap.toOutputTime(frame.timestamp);
        if (lookAhead === 1 || !params.sourcePixels)
            return { frame, outputTimestamp };
        try {
            return {
                frame: RetainedVideoFrame.copyOf(frame, params.width, params.height),
                outputTimestamp,
            };
        }
        finally {
            frame.close();
        }
    }
    /**
     * Paints a whole run, then encodes and pumps audio for each of its
     * frames in order. Empties `group` on the way out, closing every
     * frame it held. Returns the running output-frame count.
     */
    async encodeGroup(group, params, frameCount) {
        if (group.length === 0)
            return frameCount;
        let counted = frameCount;
        try {
            const paints = await params.painter.paint(group);
            if (paints.length !== group.length) {
                throw new Error(`The painter returned ${paints.length} paint steps for a run of ${group.length} frames.`);
            }
            for (const [i, request] of group.entries()) {
                await params.encoder.encode(request.outputTimestamp, request.frame.duration, paints[i]);
                await params.audioBridge.pumpUntil(request.frame.timestamp);
                counted++;
                if (params.onProgress) {
                    params.onProgress(this.toProgress(params, request.outputTimestamp, counted));
                }
            }
        }
        finally {
            this.closeGroup(group);
        }
        return counted;
    }
    closeGroup(group) {
        for (const request of group)
            request.frame.close();
        group.length = 0;
    }
    codecsFor(supported, alpha) {
        if (!alpha)
            return supported;
        return MediaBunnyTranscodeCoordinator.ALPHA_CODECS.filter((codec) => supported.includes(codec));
    }
    toEncoderConfig(resolution, alpha) {
        const config = {
            codec: resolution.codec,
            bitrate: resolution.bitrate,
            bitrateMode: resolution.bitrateMode,
            latencyMode: resolution.latencyMode,
            alpha: alpha ? 'keep' : 'discard',
        };
        if (resolution.contentHint !== undefined)
            config.contentHint = resolution.contentHint;
        if (resolution.keyFrameInterval !== undefined)
            config.keyFrameInterval = resolution.keyFrameInterval;
        return config;
    }
    async computeDuration(videoTrack) {
        try {
            return await videoTrack.computeDuration();
        }
        catch {
            return 0;
        }
    }
    resolveOutputDimensions(sourceWidth, sourceHeight, requested) {
        if (!requested)
            return { width: sourceWidth, height: sourceHeight };
        const width = Math.min(requested.width, sourceWidth);
        const height = Math.min(requested.height, sourceHeight);
        return { width: this.toEven(width), height: this.toEven(height) };
    }
    toEven(value) {
        const rounded = Math.round(value);
        return rounded % 2 === 0 ? rounded : rounded - 1;
    }
    async readFrameRate(videoTrack) {
        try {
            const stats = await videoTrack.computePacketStats(120);
            if (Number.isFinite(stats.averagePacketRate) && stats.averagePacketRate > 0) {
                return stats.averagePacketRate;
            }
        }
        catch {
            // Falls through to the default.
        }
        console.warn('Could not determine input frame rate; defaulting to 30 fps');
        return 30;
    }
    toProgress(params, timestamp, frameCount) {
        const duration = params.outputDuration;
        const percent = duration > 0 ? Math.min(100, Math.round((timestamp / duration) * 100)) : 0;
        return { percent, currentFrame: frameCount, totalFrames: params.totalFrames };
    }
    async safeCancel(output) {
        if (output.state === 'finalized' || output.state === 'canceled')
            return;
        try {
            await output.cancel();
        }
        catch {
            // Cancellation is best-effort; the original error has priority.
        }
    }
    assertWebCodecsAvailable() {
        if (typeof globalThis.VideoEncoder === 'undefined') {
            throw new Error('This browser does not support video encoding (WebCodecs). ' +
                'Use Chrome, Firefox, or Safari 17.4+ on a recent device.');
        }
    }
    buildResult(target, format, width, height) {
        const mimeType = format === 'webm' ? 'video/webm' : 'video/mp4';
        if (!target)
            return { blob: null, mimeType, width, height };
        return {
            blob: new Blob([target.buffer], { type: mimeType }),
            mimeType,
            width,
            height,
        };
    }
}
