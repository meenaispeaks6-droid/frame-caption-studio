# Caption engine evaluation

Inspected locally on 2026-10-26. This report covers Tscaps and Remotion Captioneer; it is source inspection, not a claim that their upstream tests passed on this machine.

## Recommendation

Extend **`@tscaps/engine@0.7.0`**, using its MIT-licensed transcode coordinator, decoders, codec probing, audio preservation and output packaging. Supply an original `FramePainter` that invokes the same pure time-based Canvas caption renderer as the preview. This preserves working browser video infrastructure while allowing the five original styles. Its engine already handles source packet timing, output formats, backpressure, frame lifetime, audio passthrough/transcoding and cancellation; rebuilding those would add risk.

Remotion Captioneer has reusable MIT caption data utilities, but its transcription and MP4 rendering paths are Node/CLI based. Its browser player is a preview, not an entirely browser-local export pipeline. Its core Remotion dependencies have separate licenses. It is a less appropriate foundation for the stated requirements.

## Provenance and license boundary

| Source | Inspected commit/version | License evidence | Reuse decision |
|---|---|---|---|
| `francozanardi/tscaps` | `26611a3d609a1409e674128147ed5e06673bd7e8` | Root `README.md:259-265` says root AGPL-3.0 except folders with their own license | Do not copy root/editor code indiscriminately |
| `tscaps/packages/engine` | Package `0.7.0` | `packages/engine/LICENSE`: MIT, Copyright (c) 2026 Franco Zanardi; package manifest also MIT | Use published engine package; retain notice |
| `tscaps/templates` | Same commit | `templates/LICENSE`: MIT, Copyright (c) 2026 Franco Zanardi | Studied styling/motion contracts; original presets can use the principles independently |
| `tscaps/apps/studio` | Same commit | Root README explicitly identifies AGPL-3.0 and separate `apps/studio/LICENSE` | Excluded from reusable proprietary implementation; no studio UI code copied |
| `neutral-Stage/remotion-captioneer` | `e86e7381cc186eafe30101f3af50cc077d296d92`, package `1.2.0` | Root `LICENSE`: MIT, Copyright (c) 2026 Shuvo Roy | Reference only; dependencies make whole-app adoption inappropriate |

### Dependency evidence

The selected application's locally installed package manifests and license files were inspected where available. Keep full third-party notices in distribution; a library's MIT license does not override its dependencies.

| Package | Observed version | Observed license | Implication |
|---|---|---|---|
| `@tscaps/engine` | 0.7.0 | MIT; included LICENSE | Preserve copyright/permission notice |
| `mediabunny` | 1.62.1 | **MPL-2.0**, included full LICENSE | Not MIT. Keep its files unmodified where practical, include the license and a precise source-availability link for this version; changes to covered files remain covered. File-level obligations do not make the entire separate application AGPL |
| `bidi-js` | 1.1.0 | MIT; included LICENSE.txt | Preserve notice |
| `@huggingface/transformers` | Direct app 3.8.1; engine's nested dependency 4.3.1 | Apache-2.0; included LICENSE | Preserve license/notice requirements; these are two distinct resolved versions |
| `onnxruntime-web` | App 1.30.0 | MIT in package manifest; license not at package root | Include applicable ONNX Runtime distribution notices in final dependency audit |
| `react`, `react-dom` | 19.3.1 | MIT; included LICENSE | Preserve notices |
| Captioneer `@remotion/captions` | Lockfile 4.0.438 | MIT in lockfile | A separately usable permissive utility package |
| Captioneer `remotion`, `@remotion/player`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/install-whisper-cpp` | Lockfile 4.0.438 | `SEE LICENSE IN LICENSE.md`; related lockfile entries explicitly say Remotion License | **Not verified MIT. Exclude from selected runtime.** Captioneer's MIT license does not license these dependencies. Exact commercial terms would need review before adoption |

The Tscaps manifest accepts Transformers `^4.2.0`, Mediabunny `^1.51.0`, bidi-js `^1.0.3`, and declares ONNX Runtime Web `^1.27.0` as a peer. Its README warns that Transformers 4.2 pinned ONNX 1.26 and requires an override to 1.27 for built-in transcription; the README says Transformers 4.3 fixes that specific issue. A separate app Whisper worker pinned to Transformers 3.8.1 is not the engine's built-in transcriber and must be tested against its own runtime/model combination.

## Tscaps architecture and useful code

### Transcript and word timing

`WhisperTranscriber` injects an `AudioDecoder`, so it can run in a Worker using `PreDecodedAudioDecoder`. The transcriber downloads/caches models via `TransformersRuntime`, uses WebGPU when a supported adapter/model combination exists, and otherwise chooses WASM. Tiny/base/small/medium are multilingual; `distil-*.en` models are English-only and must not be chosen for Hindi/Hinglish.

`WhisperTranscriber.ts` requests `return_timestamps: 'word'`, uses 30-second windows with 5-second strides for ordinary Whisper models, passes language plus `task: 'transcribe'`, and stitches windows. It includes token alignment correction, overlap merger, a repetition-loop guard, coverage auditing and bounded rescue of clean-but-uncovered regions. It reports missing regions rather than silently fabricating words. Its progress is grounded in model download and completed inference windows; short clips legitimately have indeterminate inference progress.

`MediaBunnyAudioDecoder` demuxes the primary track and downmixes/resamples PCM in 30-second batches, avoiding whole-file multichannel intermediate buffers. `WebAudioAudioDecoder` is a segmented audio-only remux/decode fallback for browsers without WebCodecs audio decoding. Both need main-thread `OfflineAudioContext`; decode before transferring PCM to a worker. `FallbackAudioDecoder` can retry a failed primary decoder and preserves both failure causes.

`SrtTranscriber` and `VttTranscriber` exist, but caption files often supply cue-level rather than genuine word-level times. `EstimatedCueWordReader`/`WordTimingEstimator` estimate per-word boundaries; expose these as editable estimates, never claim speech alignment.

### Decode, render and export

`MediaBunnyTranscodeCoordinator` opens a `BlobSource`, reads source track dimensions and timing, resolves an encoder and audio bridge, then drives decode → paint → encode. It uses each decoded frame's timestamp/duration rather than a real-time screen recording. The `FramePainter` interface separates pixel composition from the existing pipeline.

`WebCodecsVideoFrameDecoder` wraps Mediabunny `VideoSampleSink`; `DefaultVideoFrameDecoderFactory` probes `track.canDecode()` and can fall back to `HtmlVideoElementVideoFrameDecoder`. The latter is a main-thread, real-time fallback using `captureStream`/`MediaStreamTrackProcessor` or `requestVideoFrameCallback`; it is not frame-accurate under every load/device condition. In a worker, use `WebCodecsOnlyVideoFrameDecoderFactory`, then offer an explicit main-thread fallback when appropriate.

`DefaultAudioTrackBridgeFactory` copies original encoded audio packets when the target container supports the source codec. Otherwise it selects a locally encodable target codec and transcodes. This is stronger than decoding and re-recording audio with the preview clock. Unsupported audio can be discarded by the default factory, so the application must handle `onAudioDiscarded` and reject or offer an appropriate alternate format rather than silently deliver a mute export.

`MediaBunnyOutputTargetBuilder` creates MP4 or WebM and supports either an in-memory `BufferTarget` or a streaming `StreamTarget`. `outputStream` permits direct-to-file export on browsers with a file picker; memory-backed Blob export needs conservative duration/file limits. No backend is required.

### Preview and motion

The high-level engine renders HTML/CSS captions and rasterizes them for export. Its `FrozenFrameCss`/subtitle rasterization code freezes animations at the frame's time. The template authoring contract says all animation is paused with fill mode and a time-derived delay; ordinary CSS transitions do not work because there is no previous frame during random access rendering.

The MIT templates contain shared word layout, font scaling, highlight pulse, fade/slide primitives, and individually authored palettes/layouts. Styles use container-relative font size and `em` relative stroke/shadow/padding. These are useful design principles for matching preview/export independently. For a simpler app with five authored presets, a shared Canvas `drawCaptions(context, time, settings, groups)` is a valid custom painter; it avoids maintaining two animation implementations and avoids dependence on DOM rasterization behavior. The shared renderer must use deterministic elapsed time from each word/segment start, not wall-clock animation state.

### Integration pitfalls to address

1. Caption lookup uses `frame.timestamp` (source timeline); `outputTimestamp` is only the mapped output timeline and would diverge if future time cuts are added.
2. `lookAhead() = 1` keeps the frame pool and pixel memory bounded. Each frame must remain open until its returned paint closure has executed. The coordinator closes it afterward.
3. `outputResolution` clamps each axis to the source and rounds even. It does not preserve aspect ratio itself, crop or letterbox. Compute dimensions in the app and report the actual result. Never call a source below 720p a true 720p upscale.
4. The default codec policy chooses the first supported container codec. For predictable MP4 playback, explicitly probe/select AVC/H.264 rather than assuming `.mp4` implies H.264.
5. The stock Canvas encoder sets `imageSmoothingEnabled = false`. A custom painter should set smoothing on/high before source downscaling for better 1080p→720p quality.
6. Handle `onAudioDiscarded`. AAC packets before zero are dropped as negative priming timestamps; validate start offsets/audio duration on exported fixtures. Audio `finish()` copies all remaining source packets, so a source with an audio tail can extend beyond its video track.
7. Transcription offset handling differs by decoder. `MediaBunnyAudioDecoder` concatenates samples from `samples(0)`; `WebAudioAudioDecoder` places segments on the source timeline and keeps initial lead-in. Blindly adding `getFirstTimestamp()` to both can double-shift fallback captions. Negative priming timestamps also should not become a negative caption offset. Test delayed-start audio explicitly.
8. A valid encoded file is not proof of playback, full frame count or audio sync. Decode and inspect actual exported files. The fallback HTML decoder should be tested separately from WebCodecs.

## Tests observed

Tscaps engine has **48 `*.test.ts` files**. It includes real Chromium/WebCodecs tests, not only mocks:

- `frame/SeekedSpansYieldTheSameFrames.test.ts` creates AVC media in Chromium and checks that seeking spans yields the same exact frame timestamps as full decoding.
- `frame/PacketTimingAgreesWithDecoding.test.ts` compares encoded-packet timing with actual decoded timing and runs the transcode coordinator to assert frame count.
- `frame/SampledFrameKeepsAlpha.test.ts`, `TransparentOutputKeepsAlpha.test.ts` inspect actual rendering/encoding alpha behavior.
- `WebAudioAudioDecoder.test.ts`, `MediaBunnyAudioOnlyRemuxer.test.ts`, `FallbackAudioDecoder.test.ts` cover browser audio fallback paths.
- Tests also cover whisper chunk stitching/alignment/coverage, subtitle parsing/round trips, splitting/layout, frozen styles and subtitle paint behavior.

These support choosing the engine, but do not establish that all desktop Chrome/Android configurations work. Upstream suite was inspected, **not run by this research subtask**. The new application still requires its own real MP4 playback, A/V offset and mobile tests.

## Remotion Captioneer findings

Read its `AGENTS.md`; this research task did not install/build or modify its source. The repository has a clean browser entry versus `remotion-captioneer/node`, typed caption data, provider adapters, 14 React caption styles, presets, subtitle exporters and a CLI.

`src/whisper.ts` imports `child_process` and filesystem APIs, clones/builds native whisper.cpp with CMake, runs a local CLI, and parses timestamped tokens. It merges word-initial tokens, continuations and punctuation into word records. This is local **desktop Node** processing, not in-browser Whisper. Cloud STT adapters also exist but are out of scope.

`src/cli.ts:1000+` bundles a Remotion composition, copies media into a temporary public directory and invokes `@remotion/renderer.renderMedia` with H.264. `src/preview-server.ts` is a Node HTTP server with uploaded media processed through `/api/process`; copying that architecture would violate a static browser-only requirement.

`src/components/*` derives time from Remotion's frame/fps. `src/animation.ts` has pure bounded-keyframe validation and interpolation worth studying. The inspected `Bounce.tsx` calls `spring({ frame, fps, ... })` with the global frame rather than `frame - word.startFrame`; the bounce can be settled by later words. This is a concrete reason not to assume polished per-word behavior without visual tests. Independent elapsed-word spring logic avoids that failure.

There are **25 `*.test.ts/tsx` files** covering caption transforms, animation interpolation/validation, providers, security, metadata and render input validation. Its Playwright smoke tests exercise the preview shell, JSON caption upload and API behavior. `src/render/pipeline.test.ts` validates duration/resolution/timing metadata; it does not decode an actual MP4 or verify lip sync. No Android-specific exported-video test was found in the inspected suite.

## Scope of this report

No source from AGPL `apps/studio`, proprietary Kalakar assets, or Remotion runtime code was copied. No target application files were modified by this subtask. Reports about dependency licenses are tied to the exact local manifests/files above; model weight licenses, bundled fonts, every transitive package and the final distributed notices remain part of the owning application's full license audit.
