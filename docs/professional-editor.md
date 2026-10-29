# Frame editor workspace

This branch extends GitHub `main` at `8106efd`. It uses the five supplied UI references for panel density, transcript selection, the three-track timeline, green accents and mobile bottom sheets. No Kalakar branding, screenshots, artwork or code is included in the application. Earlier unmerged feature branches remain separate.

## Architecture and changed files

- `src/App.tsx`: existing project/undo state remains authoritative. Live text and slider transactions, debounced local saves, lifecycle flush, desktop/mobile panel routing, simple caption-language choices, preview visibility scheduling and selection integration.
- `src/EditorPanels.tsx`: searchable numbered transcript, word selection and emphasis, split/merge/delete, per-word timing, caption tools, transition controls and custom preset management.
- `src/EditorTimeline.tsx`: caption timing drag/resize, word/line view, snap anchors, keyboard nudges, zoom/scroll, source thumbnails and waveform. A temporary drag view feeds the same preview; releasing a drag commits one history entry. Thumbnails use eight bounded 120×54 cells and a disposable video decoder.
- `src/editor-operations.ts`: pure bulk-edit and timing operations. Moving preserves relative times; resizing changes the edge word and clamps against neighbors. Splitting uses an existing word boundary, not an invented timestamp.
- `src/custom-presets.ts`: IndexedDB preset persistence with explicit errors and closed database connections.
- `src/motion.ts`, `src/render.ts`, `src/captions.ts`, `src/types.ts`, `src/exporter.ts`: shared layout/grouping, typography, backgrounds, privacy mask and animation evaluation for canvas preview and encoded frames. Imported motion values are validated.
- `src/editor.css`, `src/main.tsx`, `public/theme.js`: compact desktop workspace, Android-sized sheets, safe-area insets, focus styles, reduced-motion handling and a dark default; existing saved light-mode preference is respected.
- `vite.config.ts`: allow the actual dependency directory in linked local worktrees so Vitest can resolve the bundled ONNX assets.

## Implemented behavior

| Area | Behavior |
| --- | --- |
| Desktop | Editable filename, local save status, export, transcript on the left, source-aspect preview, collapsible properties on the right |
| Mobile | Preview and timeline remain in place; six bottom-navigation sections open independently scrollable sheets, with close/expand controls, touch drag handle and focus trapping |
| Transcript | Search, numbered phrases, multi-selection, inline live word edits, emphasis, split/merge/delete, seek and active playback state, precise word timing |
| History | Live typing and pointer-driven font/position sliders group into transactions; phrase drags commit once; bulk actions and preset application are undoable; no-op commits are skipped |
| Timeline | Word/line switch, move/resize with real timestamp updates, neighbor clamping, snapping, ruler seeking, zoom/scroll, keyboard nudges, source thumbnails and waveform |
| Caption tools | Words per caption, maximum characters (24 default), 1/2/3 lines, remove punctuation/emphasis/gaps/emojis, bounded ±5s shift |
| Styling | Bundled fonts, available weights, size, alignment, italic/underline/bold, colors, outline, shadow, background, position, individual reset controls |
| Templates | All 16 existing styles retained, including the five premium styles; searchable animated two-column gallery; IndexedDB save/rename/apply/delete |
| Motion | IN/HOLD/OUT, 12 choices including None, duration/easing/intensity; global captions, selected captions or selected emphasized words |
| Preview | Drag caption placement, keyboard placement, source resolution, safe guides, fullscreen where available; paused/hidden preview stops its animation loop |
| Audio / masking | Original-audio preview mute, access to existing optional recognition filtering; fixed opaque region mask shared with export |
| Speech | Existing local models and workers retained. Same as Spoken remains transcription. Explicit English translation uses the existing Whisper translation route. Technical options stay in collapsed Advanced Settings |
| Persistence | Caption text/timing/style, motion, source metadata and language selections save locally; JSON projects remain available; original video must be reconnected after reload when it is not the bundled sample |

Maximum characters is a grouping target: a single spoken word is never truncated. Explicit merges can exceed that target. Line fitting scales the rendered font without changing the selected size. Timing delay is an explicit shift operation; the displayed pending shift resets to zero after application.

## Verification

- `npm run test`: 50 passing unit tests, including new bulk/timing/grouping/motion validation regressions. An existing Shruti test's lowercase expectation was corrected to match the already-tested sentence-capitalization behavior; recognition code was not changed.
- `npm run build`: TypeScript and production Vite build passed. There is no lint script configured in this repository.
- `npm run test:browser`: real MP4 import (including the same file twice), SRT loading, both caption-language menu options, live preview before blur, grouped undo/redo, all 16 templates, styling, bulk operations, delay, split/merge, keyboard timing, edge resizing, custom preset save/rename/apply/delete, reload recovery, desktop and 412/360-pixel mobile layouts, and no page exceptions.
- Actual 9-second 720×1280 H.264/AAC output is fully decoded with FFmpeg. Caption-color pixel overlap between preview and export at 0.8/1.2/1.6 seconds is approximately 0.872/0.981/0.977 (IN/HOLD/OUT). These are bounded caption-region comparisons, not claims of exact color identity across video encoders.
- Decoded original/export audio have equal sample counts, best measured lag 0 samples, and correlation approximately 0.99999997. PCM is not bit-identical; the test permits tiny decoding/encoding differences instead of asserting losslessness.
- `node tests/caption-drag.mjs`: real mouse positioning, emulated Android touch, undo/redo, keyboard positioning, preset persistence, reload and a fully decoded MP4 passed.
- `node tests/media.mjs`: all five premium-style MP4s, Devanagari/mixed text fixture, delayed-audio export, 1920×1080 MP4, WebM fallback and unavailable-encoder feedback passed.
- `node tests/editor-aspect.mjs`: square source/preview dimensions and a fully decoded 720×720 MP4 with audio and a pixel-verified privacy mask passed.

Test artifacts and screenshots are generated under `test-results/` and are not bundled or uploaded by the application.

## Limitations / remaining work

- Physical Android hardware and Microsoft Edge were not available. Chromium mobile emulation verifies layout and input behavior, not low-memory Android crash resolution or device codec compatibility.
- Existing recognition was preserved and its unit tests pass; no new real-model accuracy benchmark was run for this UI change. Transcription failures remain explicit; no substitute transcript is generated.
- Typography and caption position currently apply globally. Animation can target selected captions/words. Per-caption typography overrides are not implemented.
- One source video and its source audio are supported. Video/audio timeline tracks visualize that source; arbitrary track mixing, trimming the source media, background replacement and subject tracking are not implemented. Masking is explicitly a fixed opaque rectangle, not AI segmentation. Audio filtering applies only to recognition, not the exported soundtrack.
- Original aspect ratio is preserved. Portrait, landscape and square sources work; converting the output to a different aspect ratio with crop/fit controls remains follow-up work.
- Selecting an unsupported weight is disabled for bundled single-weight fonts (Mynerve and Barlow Condensed). Other bundled variable fonts expose weight controls.
- History is bounded in memory during editing; project content is recovered across reload, but the historical undo stack is not persisted.
- Long-clip and low-memory stress testing, and integrating the prior Android resource-lifecycle PR, remain separate work. This patch does not claim to resolve every pre-existing mobile decoder/PCM retention issue.
- Source media stays local. Models download only when existing speech/translation functionality is invoked. Explicit translation may require the existing large local model; normal transcription does not.
