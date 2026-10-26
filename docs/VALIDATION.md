# Executed validation

Environment: Linux Chromium 154, Playwright, Node 24.19, FFmpeg/ffprobe. Results below are observed, not simulated.

| Check | Result |
| --- | --- |
| TypeScript production build | Passed |
| Unit timing / editing / Unicode SRT / spring checks | 6 passed |
| SeeB4 upstream logic tests | 68 passed in research checkout |
| Desktop browser UI, all preset buttons, transcript editing, downloads | Passed |
| Android-sized Pixel 7 browser emulation, controls, no horizontal overflow | Passed; not physical Android hardware |
| Real 720p portrait MP4 | 720 × 1280, H.264 video + AAC audio, 9.000 s, 424,805 bytes; fully decoded by FFmpeg |
| Original audio vs exported audio | 144,384 samples each at 16 kHz; cross-correlation lag 0 ms; mean absolute difference 0.0000015 |
| Source with delayed audio | Original and export start at 0.286 s; 140,288 decoded samples each; timeline offset difference 0 ms; decoded audio lag 0 ms |
| All five preset exports | Five separate 720p H.264 MP4 files fully decoded by FFmpeg |
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

## Remaining verification

- Physical desktop Chrome across Windows/macOS and **physical Android Chrome** hardware, memory/thermal behavior and long-form stress tests. Mobile emulation establishes layout behavior only.
- Hindi/Hinglish speech accuracy on representative real recordings; Devanagari rendering and Roman conversion are implemented, but no Hindi speech benchmark was run.
- Whisper Base is wired to the same pipeline but only Tiny was executed during this session.
- Exact visual match to the user's Instagram reel: no playable video was accessible. Independent styles are complete; reference-specific calibration needs the actual clip.
- REA completed artifact inventory but failed full semantic analysis of Kalakar's large public bundle; no claim of complete proprietary reverse engineering is made.

The files are real outputs and the processing paths are implemented. These scope limits are explicitly retained rather than being described as passed tests.
