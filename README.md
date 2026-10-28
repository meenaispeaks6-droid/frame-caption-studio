# Frame — on-device caption studio

A complete static React/TypeScript application that imports local video, transcribes speech in a Web Worker, edits individual word timings, previews six animated caption styles, and exports real H.264 MP4 or VP9 WebM on the user's device. No account, API key, analytics, media upload, server processing, or paid service.

## Run and build

Node 20.19+ / 22.12+ (tested with Node 24.19), npm:

```sh
npm ci --ignore-scripts
npm run dev
npm run test
npm run licenses
npm run build
```

`--ignore-scripts` avoids installing unused native ONNX GPU binaries. This app uses browser WASM. Vite/esbuild's platform package is included in the lockfile.

Deploy the contents of `dist/` to Cloudflare Pages. Build command: `npm ci --ignore-scripts && npm run licenses && npm run build`; output directory: `dist`; Node version: `24`. No functions, bindings, secrets, database, or server are required. The included `_headers` configures cross-origin isolation. Serve through HTTPS (localhost works for development). Every deployed asset is below Cloudflare Pages' 25 MiB per-file limit.

The `.openai/hosting.json` file is for the separate private Sites review deployment; it is not needed by Cloudflare Pages and does not add application login.

## What works

- Six presets: Reel Handwritten, Impact Pop, Power Highlight, Clean Cinematic, Bubble Bounce, Desi Punch. Reel Handwritten follows the uploaded reference’s centered white lettering and phrase cuts.
- Bundled Mynerve, Inter, Barlow Condensed, Nunito and Noto Sans Devanagari fonts; customizable color, accent, outline, shadow, placement, animation strength, uppercase and phrase grouping.
- Local multilingual Whisper Small q8 inference (about 249 MB; Base and Tiny also available), real Auto Detect and timestamp-constrained alignment-head word timestamps. Hindi, English and mixed speech; captions are automatically romanized to Latin script after transcription, keeping the original word timings. Import opens spoken/caption language choices; Same as Spoken is the default. Explicit translation runs a separate local M2M100 model (~630 MB download, MIT base weights) and labels translated word timings as estimated. The translation model needs substantial memory; desktop is recommended. Telugu can be transcribed/romanized, but explicit translation is unavailable in the local translation model.
- Original-audio analysis, local Silero speech detection, optional mild noise reduction and stereo center focus. Real phrase-timing recovery and an editable draft protect recognized text when word alignment fails; original audio is kept for export. See [speech-quality results and limitations](docs/SPEECH_QUALITY.md).
- Drag the visible caption directly on the preview with mouse or touch to position all captions horizontally and vertically. One drag is one Undo step; positions persist through style changes, saved projects and export. Focus the caption and use arrow keys for fine adjustment (Shift for larger steps).
- Per-word start/end editing, manual phrase endings (↵), emphasis, add/delete, seek, undo/redo, SRT/VTT import, SRT export, JSON project export/import and local edit persistence.
- Frame-by-frame H.264 MP4 at 720p, plus 1080p on supported source/device combinations. Source aspect ratio is preserved; footage is never upscaled. A portrait 720p export is 720 × 1280.
- VP9 WebM fallback; actual codec capability checks; sequential encoding with backpressure; one frame retained; source audio packet passthrough where compatible and local audio transcoding otherwise. The app fails visibly rather than silently dropping audio.
- Worker cancellation, browser-video decoder fallback, explicit memory limits (3 minutes on ≤4 GB/unknown devices; 10 minutes on larger devices, max 500 MB source).

## Architecture and reuse

`@tscaps/engine@0.7.0` (MIT) owns demux/decode/encode/mux and audio handling. The app supplies its `FramePainter` with the same deterministic `drawCaptions()` function used by live preview. Caption lookup uses source presentation timestamps, not wall-clock animation time. `lookAhead() = 1` limits retained frames. Font loading is shared between main thread and render worker.

The Whisper integration is original, informed by SeeB4's MIT worker architecture and Transformers.js APIs. No source from `tscaps/apps/studio`, Kalakar, or the unlicensed Whisper Web repository is included. See [research](docs/RESEARCH.md) and [dependency audit](docs/dependency-licenses.json).

## Privacy, storage and limitations

The first transcription downloads model files from Hugging Face; the browser Cache API caches them. The app and runtime assets must also be loaded/cached before use without a connection. No media or transcript is sent to Hugging Face. Clearing site data removes cached models and local edits.

JSON projects store words and settings, not the video. Keep the original file and reconnect it after reload. Local storage is per browser/origin. There is no cloud project storage.

Whisper Small is the default; Hindi/Hinglish output still contains recognition errors and needs manual review. Larger model and timestamp fixes do not guarantee word accuracy. Review mixed-language output and timings. SRT/VTT files generally provide phrase timings; imported word times are evenly estimated and explicitly labeled. Romanization changes writing script, not language. Hindi uses familiar Roman spellings; other scripts use generic phonetic mappings and need pronunciation review (especially unvowelled Arabic and Japanese kanji). Model recognition and translation are probabilistic and require review.

This release focuses on SDR video and the primary audio track. Multiple audio tracks, HDR color mastering, arbitrary long-form video, speaker diarization and music editing are outside its scope. Browser codec support varies by OS/device. Unsupported devices can still edit and download subtitles. Physical Android Chrome validation remains outstanding. The uploaded reel has now been inspected and its caption treatment independently recreated; see [reference analysis](docs/REEL_REFERENCE.md) and [validation](docs/VALIDATION.md).

See [native generation fixes and measured performance](docs/NATIVE_GENERATION.md) for bounded caching, worker reuse, cancellation and remaining recognition limits.

## Tests

```sh
npm run test
npm run build
npm run test:browser
node tests/handwritten.mjs
node tests/media.mjs
node tests/transcription.mjs
node tests/languages.mjs
node tests/speech-fallback-ui.mjs
HINDI_TEST_FILE=/path/to/private-hindi-recording.mp4 node tests/audio-timeline.mjs
HINDI_TEST_FILE=/path/to/private-hindi-recording.mp4 node tests/speech-quality.mjs
SPEECH_CASES=original,auto,noisy,light,english,silent,long node tests/speech-worker.mjs
```

Browser checks use the installed `/usr/bin/chromium`; media tests also use FFmpeg/ffprobe to validate exported artifacts. They never invoke FFmpeg as part of the application. `tests/transcription.mjs` uses a TLS-verifying curl transport for public model downloads because the managed proxy's CA is not trusted by the test Chromium profile; inference remains real WASM in the browser. It asserts that external requests are GETs only.

The sample is original procedural mountain artwork with FFmpeg/libflite synthetic narration and reviewed word timings from the tested local Whisper model. The development-only generator is `scripts/create-demo.py`. No proprietary or uncertain-provenance sample clip is bundled.

## Licenses

Application code is MIT. Tscaps engine is MIT. Mediabunny is unmodified MPL-2.0 and retains its own license/source-availability obligations. Transformers.js is Apache-2.0; ONNX Runtime is MIT; fonts are SIL OFL-1.1. Silero VAD is MIT and its browser wrapper is ISC. Native Sharp/libvips appears in the installed Transformers dependency tree, but is not shipped in the browser build. The browser distribution includes generated `THIRD_PARTY_NOTICES.txt`.

## Optional Shruti browser ASR (experimental)

The original Whisper Tiny/Base/Small engines remain unchanged, and Whisper Small remains the default.
Under **Generate captions → Speech model**, choose **Shruti Hindi/Hinglish** to test Udgam Labs'
29.5 MB offline ASR on the same video. Return to Whisper at any time. The Transcript panel
retains the latest text and measured end-to-end time for each model during this browser session
so that you can compare errors manually; it does **not** claim an automatic accuracy score.

The model downloads from Hugging Face on first use, is SHA-256-verified and cached in the
browser. The official Cactus needle JavaScript/WebAssembly engine is vendored under
`public/shruti/needle/`. All audio and inference stay on-device. Shruti handles original
16 kHz mono audio in 28-second windows; it requests model-emitted word timestamps,
preserves the transcript on invalid timing, and makes no guess at precise word boundaries.
It does not provide translation or the optional Whisper filtering. English words in mixed
speech are preserved; Hindi is romanized only for display. Errors at chunk boundaries,
names, music and mixed speech still require manual review.

Shruti/needle source and engine are Apache-2.0; upstream notices are bundled at
`public/shruti/NOTICE.txt` and `public/shruti/needle/{LICENSE.txt,NOTICE.txt}`.
Upstream: https://github.com/udgamlabs/shruti
Model: https://huggingface.co/udgamlabs/Shruti
