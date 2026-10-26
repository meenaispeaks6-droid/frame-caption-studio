# Architecture evaluation and recommendation

All five requested GitHub repositories were cloned locally. Detailed evidence: [caption engines](caption-engines.md) and [transcription](transcription-research.md).

| Repository | Findings | License and decision |
| --- | --- | --- |
| `morluto/rea` | Reverse-engineering CLI/MCP toolkit, not a caption app. Used its actual 6.8.0 CLI to inventory Kalakar's public client bundle. | MIT; analysis tool only. |
| `seeb4coding/free-seeb4-ai-video-cc-editor` | Best complete permissively licensed reference editor. Local Whisper worker, word-timed renderers, shared preview/export frame composition, Mediabunny conversion, SRT and timing UI. 68 logic tests executed successfully by research agent. | MIT. Its worker and export architecture informed this integration. Bundled sample media lacked separate provenance, so it was excluded. |
| `francozanardi/tscaps` | Most reusable rendering foundation. Dedicated frame decoder/encoder/coordinator/audio bridge abstractions, backpressure, cancellation, codec/fallback policies, frame and timing tests, local Whisper modules. | `packages/engine` and `templates` explicitly MIT. Root / `apps/studio` AGPL excluded. Extend the engine with an original Canvas FramePainter. |
| `neutral-Stage/remotion-captioneer` | Remotion captions/player and animation components; server-side Remotion rendering rather than a complete browser export pipeline. A bounce component uses global frame time, which can leave later words' springs already settled. | Repository MIT, but Remotion dependencies carry separate license terms. Not used. |
| `xenova/whisper-web` | Useful minimal Transformers.js worker/model loading and chunked transcription example; not a caption renderer or MP4 exporter. | No explicit repository license found. Reference only; no copied source. |

## Chosen implementation

Extend **Tscaps' MIT engine 0.7.0**, retaining its working decoding, encoding, muxing, timestamp handling and audio bridges. Build an independent small UI and five original frame-driven Canvas animations. SeeB4 is the strongest full-editor alternative, but Tscaps provides a cleaner reusable export API and a broader focused media test surface. This avoids importing an entire editor or rebuilding media plumbing.

The five presets use original easing and styling: damped spring scaling with overshoot, per-word highlight blocks, refined alpha/position ramps, elastic rounded typography, and quick Devanagari-aware transitions. Preview and export call the same renderer with the same word grouping and font files.

## REA and Kalakar reference evidence

REA 6.8.0 was run on the publicly served `https://app.kalakar.io/assets/index-Bpsr56ft.js` (8,952,355 bytes; SHA-256 `a186ff7b9f51db14a9e4a2cca54863a9d562691f4af57885a9508e162e6079a4`). The first run recorded an artifact inventory but its 1 GiB analysis worker exhausted its heap. A bounded 2 GiB retry returned an unreadable-worker-output failure. Accordingly, **no internal caption animation or server architecture is claimed to have been reconstructed**. The application does not copy its bundle or proprietary assets.

The supplied Instagram reel (`DdEO4NVzjv2`) returned public page metadata but no playable media in the accessible response. Its motion, type and easing could not be inspected. Exact reference matching requires the actual video file or another accessible media URL; the current presets are independent interpretations of the named brief.

## Dependency verification

The installed production dependency graph is recorded with exact versions in `dependency-licenses.json`; full notices are included in the static build. Notable boundaries:

- `@tscaps/engine@0.7.0`: MIT; used unmodified.
- `mediabunny@1.62.1`: **MPL-2.0, not MIT**. Unmodified dependency, license and matching source links included. Its file-level obligations remain applicable; independent app files are separate.
- Direct `@huggingface/transformers@3.8.1`: Apache-2.0; browser ONNX Runtime 1.22 development build: MIT. Tscaps' optional Transformers 4 / ONNX runtime is installed transitively but excluded from the browser bundle through a narrow media-only import surface.
- React, React DOM, Sanscript, bidi-js: MIT. Lucide: ISC. Fonts: SIL OFL-1.1.
- Native Sharp/libvips transitive dependencies have Apache/LGPL notices. They are not part of the browser bundle; no native ONNX CUDA binary is installed or distributed.
- No Remotion, FFmpeg WASM or AGPL Studio code is shipped. Development FFmpeg is used only to create original fixtures and verify files.

This is an engineering license inventory, not a legal opinion.
