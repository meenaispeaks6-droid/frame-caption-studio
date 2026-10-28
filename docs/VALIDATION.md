# Executed validation

Environment: Linux Chromium 154, Playwright, Node 24.19, FFmpeg/ffprobe. Results below are observed, not simulated.

| Check | Result |
| --- | --- |
| TypeScript production build | Passed |
| Unit timing / editing / Unicode SRT / spring / phrase-break checks | 8 passed |
| SeeB4 upstream logic tests | 68 passed in research checkout |
| Desktop browser UI, all preset buttons, transcript editing, downloads | Passed |
| Android-sized Pixel 7 browser emulation, controls, no horizontal overflow | Passed; not physical Android hardware |
| Real 720p portrait MP4 | 720 × 1280, H.264 video + AAC audio, 9.000 s, 424,805 bytes; fully decoded by FFmpeg |
| Original audio vs exported audio | 144,384 samples each at 16 kHz; cross-correlation lag 0 ms; mean absolute difference 0.0000015 |
| Source with delayed audio | Original and export start at 0.286 s; 140,288 decoded samples each; timeline offset difference 0 ms; decoded audio lag 0 ms |
| Original five preset exports | Five separate 720p H.264 MP4 files fully decoded by FFmpeg |
| Reel Handwritten exports | Real 1064 × 720 landscape and 720 × 1280 portrait H.264 MP4s with AAC audio; fully decoded |
| Handwritten reference calibration | Mynerve Regular, 27 px, 50% position; held phrases are pixel-stable, phrase cuts and silence verified |
| Preview / render-worker parity | Decoded caption area differs from preview by 0.95 / 255 average per color channel after H.264 encoding |
| Manual phrase endings | Persist through reload, validation, SRT cue import, grouping and subtitle export; mobile controls checked |
| Devanagari/Hinglish rendering | Desi Punch export with `अपनी कहानी बनाओ` and Roman Hindi; visually inspected decoded frame |
| Real 1080p export | 1920 × 1080 source → H.264 MP4 with caption and AAC; fully decoded |
| WebM fallback | VP9 WebM rendered and fully decoded |
| No VideoEncoder | MP4 render disabled; clear codec message; subtitle download remains enabled |
| Actual Whisper Tiny browser inference | Produced 13 aligned words: “Every great story starts with a single word, make yours impossible to ignore.” |
| Inference timing | 17.131 s in this test environment with model downloads already in the test transport's cache; not a device-performance promise |
| Privacy during inference | Seven external GET requests for model assets; no POST/upload requests |

Exact probe, audio comparison, browser capabilities and model result records are in `validation-evidence/`. Generated playable videos and screenshots are retained in local `test-results/`; the packaged handoff includes a 720p example.

## Important test scope

The managed environment's proxy CA is trusted by curl but not this Chromium test profile. The first direct model request failed certificate validation. The test then forwarded only public Hugging Face GETs through TLS-verifying curl. It executed the real production worker, tokenizer, model weights and ONNX WASM in Chromium. TLS verification was not disabled. The application itself uses normal browser fetch; the test adapter is not shipped.

An intermediate test-transport cache race was fixed by awaiting concurrent downloads and renaming only completed downloads. The final model test passed. The app now bundles the matching ONNX `.mjs` and `.wasm` assets on its own origin, avoiding an unnecessary runtime CDN dependency.

The production build contains one ~20.6 MiB WASM asset, below Cloudflare Pages' documented 25 MiB file limit. The unused optional engine runtime is excluded from the browser bundle.

## Remaining verification (initial release; updated speech results below)

- Physical desktop Chrome across Windows/macOS and **physical Android Chrome** hardware, memory/thermal behavior and long-form stress tests. Mobile emulation establishes layout behavior only.
- Representative Hindi/Hinglish speech accuracy remains outstanding. Current real-source timing and partial accuracy measurements are documented in [SPEECH_QUALITY.md](SPEECH_QUALITY.md).
- Tiny, Base and Small have since been executed. Small q8 is now the default; larger/full-precision variants did not guarantee improved accuracy. See the current speech report.
- The uploaded reel was inspected after the initial release. Reel Handwritten recreates its caption treatment with independently licensed Mynerve; exact font provenance cannot be established from compressed footage alone. See [reference analysis](REEL_REFERENCE.md).
- REA completed artifact inventory but failed full semantic analysis of Kalakar's large public bundle; no claim of complete proprietary reverse engineering is made.

The files are real outputs and the processing paths are implemented. These scope limits are explicitly retained rather than being described as passed tests.

## Studio design refresh

The editor now uses charcoal surfaces, lime primary actions, lavender controls, larger caption cards, a framed canvas and a distinct waveform/timeline. Automatic captions are available directly above the preview. Mobile panel navigation scrolls to the chosen tools and returns to preview after a style selection. Reduced-motion preferences suppress decorative card animation.

The production build was checked at 1440 × 900, 1280 × 720, 1024 × 768, 768 × 1024, 390 × 844, and 360 × 780. All had no horizontal overflow and preserved the source aspect ratio. Portrait and landscape fitting, automatic-caption dialogs, and mobile style/adjust/return navigation passed. Short desktop windows use a scrollable minimum-height workspace to retain a usable preview. Measurements are in `validation-evidence/studio-ui.json`.

The existing browser regression also passed all six preset selections, transcript editing, export controls, and a real 720 × 1280 MP4 with AAC audio (9 s, fully decoded by FFmpeg). Phone checks are browser emulation, not physical hardware.

## Animated style cards

All six cards use plain, solid backgrounds and animate their own captions automatically while visible. Their previews use the same caption renderer as the video. The handwritten card alternates complete phrases in the reference's style. Card animation pauses during processing, when offscreen or in a hidden tab, and honors reduced-motion preferences.

Browser verification sampled each card over 3.6 seconds without hover: all six changed frames; with reduced motion, all six remained still. The verification also checked solid backgrounds and choosing a preset. Results are in `validation-evidence/card-previews.json`.

## Language-selection release

See [LANGUAGES.md](LANGUAGES.md) for implementation, actual tests and remaining limitations. 23 unit tests and all seven UI contract cases pass; the latter use a labeled ASR stub while rendering a real MP4. Actual M2M100 translation and actual English speech recognition were executed separately. Actual Hindi speech recognition on the supplied reel excerpt failed; this is not a passed Hindi acceptance test. Unusable alignment now causes a visible error and preserves existing captions.

## Speech-processing correction

The current release passes 33 unit tests. It fixes real Auto Detect, timestamp-constrained Hindi word alignment and AAC packet-gap extraction; adds real Silero speech detection and optional conservative DSP; and preserves recognized text through phrase timing or an editable draft on failure. The supplied 31.28-second excerpt produces 97 bounded word intervals, but Hindi substitutions remain. Added-noise recognition is a failed quality check, not a success. The real media regression, language UI contracts, recovery UI and decoded exports pass. See [SPEECH_QUALITY.md](SPEECH_QUALITY.md) for numerical evidence, licensing, limitations and reproduction.

## Direct caption placement

Visible captions now expose a pointer-captured drag target on the video. Mouse and touch move both axes in video-relative coordinates; drag updates paint directly and commit once on release. Pointer cancellation restores the previous placement. Keyboard arrows adjust position, with Shift for larger steps. Renderer-derived hit bounds follow each phrase and support all six styles. Horizontal defaults preserve older projects; chosen placement persists through preset changes, project reload and export.

Executed `tests/caption-drag.mjs`: desktop mouse drag, Pixel 7 touch events in Chromium emulation, one-step Undo/Redo, keyboard adjustment, unchanged transcript, preset/reload persistence and a real fully decoded 720p MP4. The exported frame was visually inspected and shows the moved caption. Physical phone hardware was not available. Numerical results are in `validation-evidence/caption-drag.json`.

## UI themes and motion — October 28, 2026

Added light/dark mode with pre-paint system preference, persisted manual choice, and a storage-unavailable fallback. Theme changes leave preview canvas pixels unchanged. Removed repeated promotional copy and added job-driven import, transcription and export motion with reduced-motion support.

Production-build browser checks passed at 360, 390, 720, 768, 1024 and 1440px: no horizontal overflow, theme toggle accessible, refresh persistence, blocked-storage fallback, and reduced-motion animation suppression. Controlled worker events verified indeterminate status, a real 42% progress-bar width and cancellation (not speech recognition accuracy). Native job lifecycle regression passed; all 37 unit tests and the production build passed. Evidence: `validation-evidence/ui-polish.json`. Mobile checks use Chromium emulation, not physical Android hardware.

The existing caption-drag browser regression also passed after the UI changes: mouse and emulated touch placement, keyboard adjustment, undo/redo, saved placement, and an actual 720p MP4 export fully decoded by FFmpeg.
