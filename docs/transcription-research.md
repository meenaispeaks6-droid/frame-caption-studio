# Browser transcription and editor foundation research

Inspected 2026-10-26. Repository clones are under `/workspace/research`. No `AGENTS.md` was present in either inspected repository. This report distinguishes source inspection, tests run here, and upstream claims.

## Recommendation

**SeeB4 is the strongest complete browser-only editor foundation of these two repositories.** It already has an MIT-licensed caption model, manual word timing, local Whisper worker, shared preview/export Canvas renderer, MediaBunny demux/decode/encode/mux, audio packet passthrough where compatible, subtitle import/export, and actual rendered-file inspection tests. Reuse its proven small modules with attribution instead of adopting the whole UI or rebuilding those algorithms. Its main limitations for this brief are a desktop-first interface, ordinary rather than premium kinetic presets, coarse resource limits, and no demonstrated physical Android tests.

Whisper Web is useful architectural reference, but not a full editor or renderer and **does not declare a repository license at the inspected commit**. Do not copy its source into the product until permission/license is established. Using the separately licensed Transformers.js package does not require copying Whisper Web.

If the host application is already using Tscaps' MIT engine, retaining that working pipeline and adapting the permissively licensed SeeB4 PCM/worker patterns is a reasonable integration choice. Compare export behavior (especially audio compatibility and trim timestamps) directly rather than introducing two exporters.

## Exact snapshots and repository licenses

| Repository | Commit | License evidence | Reuse disposition |
|---|---|---|---|
| `seeb4coding/free-seeb4-ai-video-cc-editor` | `09ef876663ea1393428c242a2110df85f5e01155` | Root `LICENSE`: MIT, Copyright (c) 2026 SeeB4; `package.json` also says MIT | May reuse code with copyright and full permission notice retained |
| `xenova/whisper-web` | `d8afd24b55b691570e23d92451d44ccb3d911be1` | `git ls-tree -r --name-only HEAD` has no LICENSE/COPYING; `package.json` has no license field; README has no license grant | Reference only; public availability is not permission to copy |

The sample video `sample/Explore_build_and_share_202608242308.mp4` has **no separate provenance or media-rights declaration**. It already contains burned-in captions (explicitly documented by `scripts/smoke.mjs:280`). The root MIT software notice does not establish third-party audiovisual rights. Do not bundle it as product demonstration media. Use original or clearly licensed footage. Test use here did not redistribute it.

## SeeB4 architecture and reusable implementation

Evidence: root README, `package.json`, and the following source files at the pinned commit.

- `src/lib/asr.worker.js`: lazily imports Transformers.js; caches a singleton pipeline keyed by model and device; disables local-model probing; enables browser Cache API; reports real model download progress. Device selection requests a WebGPU adapter and otherwise uses WASM. WebGPU uses fp32; WASM uses q8. Pipeline load failure clears the cached rejected promise so retry is possible.
- `src/lib/transcribe.js`: `extractMonoPcm` demuxes the local Blob through MediaBunny `Input`, checks the primary audio track's decode capability, iterates `AudioBufferSink.buffers()`, mixes channels to mono and resamples into a 16 kHz array according to each audio buffer's source timestamp. It leaves gaps silent and disposes the Input in `finally`. The worker receives the PCM with a transferable buffer. The `Transcriber` wrapper reports errors, cancellation terminates the worker, and the process-wide singleton avoids reloading the model on a tab switch.
- `src/lib/transcribe.js`: `wordsToPhrases` groups real aligned words by word count, character count, speech pause, duration, and sentence punctuation. It preserves each word's timing and allows a short phrase lead-in. `chunksToCaptions` also has an explicitly approximate segment-splitting path; do not present those inferred subdivisions as ASR word alignment.
- `src/lib/wordTiming.js`: boundary, edge, nudge and fit operations retain ordered alignments. Boundary motion updates the adjacent words together. It enforces a minimum duration and reports overlaps/out-of-cue alignment. `distributeWords` is an approximate manual starting point, not ASR alignment.
- `src/lib/captions.js`: cue split/merge and text-alignment validation. Word highlight timings are rejected when the edited text no longer matches the recognized words.
- `src/lib/media.js`: probes true display dimensions, rotation, video/audio codec and decode support, container duration and frame-rate metrics (256 packet sample). It preflights encoding support using `canEncodeVideo` and selects a codec accepted by the output container.
- `src/state/playback.js`: playback clock lives outside React; prefers `requestVideoFrameCallback` and its frame `mediaTime`, with requestAnimationFrame fallback. This avoids rerendering the entire editor every video frame.
- `src/lib/renderCaptions.js`: one Canvas caption painter shared by preview and burn-in, dimensions proportional to frame size. Caption visibility tests the frame's display interval, so a cue beginning inside that interval is visible on the relevant frame.
- `src/lib/export/burnIn.js`: MediaBunny `Conversion` decodes each source frame, invokes a Canvas process hook, draws captions with that frame's timestamp and duration, then encodes and muxes. The DOM Canvas intentionally sees the same fonts as preview. Output dimensions are rounded to even values. MP4 uses `fastStart: 'in-memory'`; output is a `BufferTarget`. Cancellation calls `conversion.cancel()` and disposes the input. Rotation is handled by MediaBunny's transformed sample path.

### Important caveats when reusing

1. **Audio is copied only when compatible.** The burn-in implementation leaves audio settings automatic: MediaBunny copies packets if the target container accepts them, otherwise may transcode. The README's standalone claim “Audio is never re-encoded” is stronger than the code. Explicitly verify AAC packet preservation and timestamp/duration correspondence in exported MP4, and expose a real fallback if another source audio codec cannot be encoded.
2. **MP4 is a container, not a codec promise.** The upstream MP4 codec list is `avc`, `hevc`, `vp9`, `av1` while the label says “MP4 (H.264)”. For a reliable broadly playable export, explicitly require H.264 or clearly name the actual fallback codec.
3. **Memory is not bounded.** Mono extraction allocates whole-duration sums, counts and PCM. `BufferTarget` retains whole exported output. Resource guards, duration limits, incremental extraction, and streaming output should be evaluated for Android.
4. **WebGPU failure after adapter detection is not automatically retried in WASM.** The worker chooses a device once; catch errors and offer an actual WASM retry when needed.
5. The worker drops chunks with null ends rather than making them up. This is conservative but may lose trailing words; a product can explicitly flag incomplete alignment for manual correction.
6. Phrase grouping and frame alignment are useful to reuse, but premium effects should be independently implemented in the shared painter.

## Whisper models, timing and language behavior

SeeB4 uses these model IDs:

- `onnx-community/whisper-tiny.en_timestamped` — English-only, smallest.
- `onnx-community/whisper-base_timestamped` — multilingual.
- `onnx-community/whisper-small_timestamped` — multilingual, default selected by its UI, substantially larger.

Its worker sets `return_timestamps: 'word'`, `chunk_length_s: 30`, `stride_length_s: 5`, and `task: 'transcribe'` for multilingual models. Word timestamps are extracted using cross-attention alignment heads, not linear spacing within a segment.

**For the target application's Transformers.js 3.8.1 + `Xenova/whisper-tiny` choice:** inspected installed `src/pipelines.js:1812` and `src/models.js:3495`. `'word'` enables `return_token_timestamps`. The model then requires `generation_config.alignment_heads`, requests output attentions, and calculates timestamps from cross-attentions using dynamic time warping. A plain model name alone does not prove those outputs are present. Test the exact pinned model with actual English and Hindi audio. Do not assume the SeeB4 README's model-name rule covers every older Xenova conversion.

Use a multilingual model for Hindi/Hinglish. Whisper's language control includes Hindi and English, but Hinglish code switching and Roman Hindi output are not separate guaranteed recognition modes. Hindi transcription may produce Devanagari. Romanization should be a clearly identified local text transform or manual editing feature; it does not change audio word times. Translation to English is different from Roman Hindi and should not be substituted silently.

The inspected repository does not bundle model cards or model license files. Its README calls downloaded model terms permissive, but that is not independent verification of a specific remote model snapshot. Check and retain the exact model card/license, revision and source URL used in production. OpenAI Whisper's upstream MIT license and Transformers.js's Apache license do not by themselves establish the converted artifact's declared terms.

## Whisper Web architecture

- React 18 + Vite 4 app; dependency `@xenova/transformers` 2.7.0.
- `src/worker.js` keeps a pipeline factory singleton, disposes it when model/quantization changes, and sends model download events and partial decoded results to the UI.
- Standard Whisper uses 30-second chunks and 5-second stride; Distil Whisper uses 20-second chunks and 3-second stride.
- Uses `return_timestamps: true` (segment timestamps), **not `'word'`**. Its output is not sufficient by itself for precise word-highlighting animation.
- `useTranscriber.ts` mixes stereo PCM before posting it to the worker but does not transfer the backing buffer. It handles loading, partial result and completion state in React.
- Audio source controls support local files, URL and microphone. The app is an audio transcription demo, not a caption video editor: no MP4 exporter, shared caption painter, frame decoder, caption animation or manual word timing editor was found.
- Default is English-only `distil-whisper/distil-small.en`; multilingual mode is a separate control. The language map includes Hindi.
- No test script or test files found; build includes TypeScript checking. Do not infer production word timing or mobile export reliability from this demo.

## Dependency licenses inspected

The SeeB4 lockfile records these exact resolutions. These declarations were inspected locally; this is not a claim to have audited every transitive source file.

| Dependency | SeeB4 locked version | License in lockfile | Target installed artifact verified |
|---|---:|---|---|
| `@huggingface/transformers` | 4.2.0 | Apache-2.0 | 3.8.1 package declaration and full Apache-2.0 LICENSE read |
| `mediabunny` | 1.55.3 | **MPL-2.0** | 1.62.1 package declaration and full MPL-2.0 LICENSE inspected |
| `onnxruntime-web` | 1.26.0-dev.20260416-b7804b056c | MIT | Target top-level 1.30.0 package says MIT; Transformers may have its own resolved nested runtime |
| `onnxruntime-common` | 1.24.3 | MIT | See target dependency audit for actual resolved runtime version |
| `react`, `react-dom` | 19.2.8 | MIT | Target audit should retain exact installed versions |
| Vite | 8.2.2 | MIT | Build-only |
| Playwright | 1.62.1 | Apache-2.0 | Test-only |

MediaBunny is **not MIT**. MPL is file-level copyleft and allows inclusion in a larger proprietary application, with its own notice/source availability obligations; modifications to its covered files require appropriate source disclosure. Retain its full license and make the exact covered library source obtainable. Avoid modifying vendored MediaBunny internals if public APIs suffice.

Neither of these repositories directly depends on FFmpeg or Remotion. No GPL FFmpeg bundle or Remotion commercial license is introduced by reusing these specific modules. A future FFmpeg WASM fallback requires a separate audit of its exact build and codecs.

Whisper Web's older lockfile does not contain license fields for its listed dependencies. Do not mark the repository or its whole dependency tree MIT merely because React or ONNX Runtime is MIT.

## Tests and evidence

### Run in this workspace

`node scripts/unit.mjs` in the SeeB4 clone: **all 68 logic tests passed** on 2026-10-26. To avoid another network install, the research clone's `node_modules` was symlinked to `/workspace/sites/caption-studio/node_modules` (MediaBunny 1.62.1, not SeeB4's locked 1.55.3). This verifies source logic with those installed imports, not a clean upstream lockfile install.

Coverage includes timecodes, cue operations, frame-interval visibility, speech activity detection, phrase grouping, subtitle round trips, timing drift/offset fitting, stale alignment invalidation, translation timing preservation, manual word boundaries and safe-area calculations.

### Inspected upstream tests, not rerun here

- `scripts/smoke.mjs`: launches desktop Chrome, loads the sample video, drives authoring and burn-in, saves an actual MP4, loads it back into the browser, demuxes tracks and decodes a frame. It compares bright caption-region pixels against the same source frame, asserts an audio track, and checks duration/codec/dimensions. This is substantive file-output testing, but it does not compare audio packet hashes, verify sync over a long VFR source, or establish Android reliability.
- `scripts/asr-check.mjs`: drives real model download/transcription and verifies nonempty cues; a committed historical `scripts/out/asr-check.log` reports 16 cues in 73 seconds on WebGPU. That is upstream evidence, not a run on this machine, and it does not measure alignment accuracy against ground truth.
- `scripts/export-check.mjs`: exercises transparent overlay and soft subtitle files by examining their bytes/tracks.
- `scripts/responsive-check.mjs`: viewport/layout assertions; it does not run on physical Android hardware. README explicitly says phones are not a target.
- Additional feature, reopen and authoring smoke suites are present.

### Acceptance tests to retain/add for this product

1. Produce and reopen a 720p H.264 MP4 from a known local fixture; inspect duration, dimensions, frame count, captions at boundary timestamps and audio track.
2. For AAC input passthrough, compare packet payload hashes and presentation timestamps between source and output. For transcoded audio, compare duration and a known beep/cut timing within a documented tolerance.
3. Run all five styles through the same painter at selected times in preview and export and compare rendered image regions with an appropriate codec-loss tolerance.
4. Test portrait rotation metadata and a VFR fixture; seek by presentation timestamp.
5. Run real English and Hindi model inference; verify finite ordered word timestamps, trailing words, long pauses and code switching. Keep inferred/manual timings distinct.
6. Test physical Android Chrome, not only mobile viewport emulation: H.264 capability, memory pressure, WASM transcription, cancellation and a real downloaded playable MP4. Report untested device coverage honestly.

