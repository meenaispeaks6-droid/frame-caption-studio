# Hindi/Hinglish speech processing — 27 October 2026

The alignment and Auto Detect failures have concrete fixes. Recognition accuracy is still imperfect, particularly on fast, noisy Hindi; this release does not claim otherwise. Processing remains inside the browser. No media upload, backend, paid model or transcription API was added. The editor, original five presets and reference-inspired sixth preset are preserved.

## Root causes and changes

1. **Auto Detect was effectively English.** Transformers.js 3.8.1 leaves Whisper language detection unimplemented when language is omitted. The worker now makes a real next-language-token prediction from original speech before transcription. The supplied Hindi excerpt was detected as `hi`. Hinglish also detects its dominant language; this does not translate the mixed speech.
2. **Word decoding omitted timestamp constraints.** The library's word-timestamp path enabled cross-attention alignment while disabling timestamp-token-constrained generation. On the supplied seven-second excerpt, this produced repeated text, zero-length words and times reaching 13.98 seconds. The worker now enables timestamp constraints alongside word alignment. The same Small q8 model then returned 23 positive, monotonic word intervals ending at 6.82 seconds. This is a timing/configuration improvement, not evidence that every recognized word is correct. Transformers.js is pinned to the tested 3.8.1 version because this workaround depends on its generation API.
3. **AAC timestamps were being flattened.** Native decoding can concatenate samples across packet timestamp gaps. The extraction path now uses AAC packet timing to reconstruct those gaps, trims decoder preroll and retains source offsets. An actual four-second AAC fixture with a one-second gap now remains four seconds; before the fix it became approximately 3.03 seconds.
4. **Alignment errors discarded useful text.** Real word boundaries are accepted only if they cover all recognized text and stay within the source region. Otherwise the worker retries original audio where applicable and requests actual model phrase timestamps. Phrase captions retain all primary text if the retry changes its wording; no evenly distributed word timestamps are manufactured. If reliable phrase timing also fails, a visible error preserves an editable, downloadable untimed transcript and the previous captions. Retry reopens the language/model choices.

## Actual pipeline

Local media demux/decode → original 16 kHz mono analysis copy with source timestamps → level, clipping, dynamic-range and background-activity measurements → optional filtering → Silero speech detection with padded source-time regions → multilingual Whisper transcription → validated word timing or actual phrase fallback → Roman conversion → existing caption renderer.

- Mono averages source channels; optional stereo processing retains separate left/right planes on the same timeline. Negative preroll is trimmed and positive track offsets are reapplied to captions. Extraction streams bounded resampling batches instead of retaining an entire decoded audio buffer for resampling.
- Silero Legacy runs locally on the original audio, at a permissive 0.2 probability threshold, with 500 ms context. Nearby regions merge before recognition, so overlapping padding does not duplicate captions. Uncertain detection retains conservative sound regions; a loading/runtime error falls back to conservative silence segmentation. Pure silence bypasses ASR downloads. Quiet/fast-word accuracy still needs a larger speech corpus.
- **Whisper Small q8 is the new default**, roughly 249 MB of model files; Base (~77 MB) and Tiny (~41 MB) remain available. `task: transcribe` is used. Only an explicit different caption-language choice invokes the existing local translation path. Small takes substantially longer and requires more memory than Tiny; choose a smaller model on limited devices.
- Alignment occurs before romanization. IDs, source times, word order and English tokens stay intact. Familiar Hindi spelling conventions include `mujhe`, `jaana`, `hai`; recognized Hindi spellings of ChatGPT, AI, Gemini, Instagram, YouTube, Codex, API and Android map to their English brand/technical spellings. These mappings cannot recover words the acoustic model misrecognized or omitted.
- Saved projects retain language/model/audio choices, phrase/word timing metadata, audio measurements and any recovered draft. Phrase entries are editable with real start/end boundaries. Their visual words share the phrase's actual time window, so all appear together. Preview and export use the same function and text.
- Filtering affects only the analysis copy. Exports continue using the original source audio and its timing.

## Filtering and music limitations

**Original audio remains the default.** Continuous background activity and an estimated quiet-frame noise floor are measured, but this is not a validated music-vs-noise classifier. Reports explicitly set `musicDetection: not-classified`; the application does not claim to detect music reliably.

Two functioning optional DSP modes are available in advanced speech settings:

- **Light cleanup:** overlap-add spectral subtraction estimated from quiet intervals, with mild attenuation capped around 4 dB (additional low-frequency rolloff below 60 Hz). Continuous sound without a reliable quiet interval is left untouched. Filtering preserves sample count and adds no delay. An actual added-noise recognition test did not improve enough to recover reliable captions, so this mode is not automatically enabled.
- **Stereo center focus:** a frequency-domain mid/side mask attenuates off-center interference while retaining centered content. A controlled centered tone plus off-center interfering tones improved SNR from **5.51 dB to 19.45 dB**, with unchanged sample count. This is a signal test, not a speech WER result. It requires stereo, can attenuate off-center voices and **cannot isolate speech from centered music or arbitrary mono music**. No general neural vocal separator is shipped. Unsupported/failed filtering retries the original.

The worker uses timing validity and repetition checks for recovery; these checks cannot determine which of two plausible transcripts has fewer acoustic word errors. No unverified claim of choosing the more accurate transcript is made.

## Executed validation

Linux Chromium 154, real ONNX WASM, real model weights, Node 24 and FFmpeg for development-only file inspection. Public model downloads are forwarded through a TLS-verifying local cache because the managed test Chromium profile does not trust the environment proxy CA; media stays local. Test adapters are not shipped.

| Check | Observed result |
| --- | --- |
| Unit suite | 33 tests passed, including 10 new audio/recovery checks |
| TypeScript production build and license generation | Passed; 98 runtime dependency entries audited |
| Actual Hindi, seven-second supplied-reel excerpt | Timestamp-constrained Small q8: 23 timed words, last end 6.82 s; text errors remain |
| Actual Auto Detect Hindi worker | Detected `hi`, ran real Silero, returned Latin captions with bounded timestamps |
| Actual 31.28-second excerpt | 97 word intervals, last end 30.86 s; no word-alignment failure; spelling/substitution errors remain |
| Actual English worker | 13/13 known narration words after case/punctuation normalization; 0% WER for this one synthetic narration sample |
| Actual silence worker | 0 captions, no hallucinated speech, no ASR model needed |
| Added-noise Hindi / light-cleanup recovery | Recognition-quality failure retained as a failure; recognized draft preserved rather than fake 0-word success |
| Source audio vs FFmpeg | 950,741 vs 950,740 samples; measured lag 0 samples at 1 s, 20 s and 50 s; correlations 0.9992, 0.9750 and 0.9887. Gain differs with channel-downmix convention |
| Real AAC packet-gap fixture | 64,000 samples / 4 s; gap RMS 0; original duration retained |
| Center-focus DSP | Synthetic SNR 5.51 → 19.45 dB; source untouched; output length preserved |
| Error/phrase-recovery UI | Fault-injected ASR failure, old captions and Roman draft retained, Retry works; actual phrase boundaries preserved; real exported MP4 fully decoded |
| Actual Hindi inference → MP4 | Saved 23-word Small q8 result rendered over its matching seven-second reel excerpt; Desi Punch, 1064 × 720 H.264/AAC, fully decoded; exported audio lag 0 samples, correlation >0.99 |
| Existing language workflow | Seven UI contract scenarios pass, with explicitly stubbed ASR; actual Latin-text 720p MP4/AAC export fully decoded |
| Existing media/UI regression | Original five 720p MP4 presets, 1080p, WebM, delayed audio and unavailable-encoder fallback passed; real files fully decoded |

The supplied file is **59.51 seconds**. The long test uses its first 31.28 seconds; no separate previously failing 31.28-second original was available. Its original audio was decoded in the browser for that test. Short recognition tests use a seven-second FFmpeg-extracted analysis fixture at 0.2 s; FFmpeg is never part of the application.

### Recognition errors and test limits

For an eight-token opening-phrase reference taken from the reel's visible captions, the Small q8 output had five token edits (**62.5% caption-reference proxy WER**, without spelling normalization):

```
Reference:  दुनिया का सबसे बड़ा स्कैम पता है क्या
Recognized: दून्या कर सबते बड़ा स्केम पते है क्या
```

This is an orthographic comparison against a caption fragment, **not a manually verified transcript of the complete audio**. It includes spelling substitutions and is deliberately not presented as full-recording WER. The longer result also contains obvious errors, for example `bisans aaityaa` where the reel's subject includes English business terminology. No postprocessor guesses those missing words.

A same-configuration Base q8 comparison still repeated a Hindi token with unusable 13.98-second times. Full-precision encoder/Base variations also did not resolve this recording's errors. A Medium q8 experiment exhausted the test browser's memory and is not offered. There is no claim that model size alone solves Hindi accuracy.

A representative manually transcribed corpus is still needed for clear Hindi, music-backed Hindi, fast Hinglish, technical names and Indian-accented English. The supplied reel provides only one real source; synthetic noise and synthetic English do not replace those recordings. Word timing is validated structurally, and audio decoding is compared numerically; no phoneme-level human alignment gold set was available. Physical Android Chrome model/memory performance remains unverified. These are outstanding accuracy/performance checks, not passing acceptance tests.

Numerical, text-only evidence is in [validation-evidence](validation-evidence/): `speech-accuracy.json`, `speech-alignment-before.json`, `speech-alignment-after.json`, `speech-real-worker.json`, `speech-audio-timeline.json`, `speech-audio-comparison.json`, `speech-center-focus.json`, `speech-phrase-recovery.json`, `speech-challenging.json`, `speech-base-comparison.json`, `speech-media-regression.json` and `speech-export.json`. Private source footage and audio fixtures are excluded from the repository and deployment.

## Reproduce

```sh
npm ci --ignore-scripts
npm run test
npm run licenses
npm run build
npm run test:browser
node tests/languages.mjs
node tests/media.mjs
node tests/speech-fallback-ui.mjs
HINDI_TEST_FILE=/path/to/private-reel.mp4 node tests/audio-timeline.mjs
HINDI_TEST_FILE=/path/to/private-reel.mp4 node tests/speech-quality.mjs
SPEECH_CASES=original,auto,noisy,light,english,silent,long SPEECH_REPORT=speech-challenging.json node tests/speech-worker.mjs
HINDI_TEST_FILE=/path/to/private-reel.mp4 node tests/speech-export.mjs
```

The quality probe downloads the Small q8 files to `test-results/model-cache` before the production-worker tests run. Set `SPEECH_MODEL_CACHE` to use another cache directory. Generated private fixtures stay in ignored `test-results/`. Worker diagnostics validate handling and timing; a successful inference result is not automatically an accuracy pass.

## Licenses

The new original DSP/recovery code follows this application's MIT license. `@ricky0123/vad-web` is ISC; the bundled Silero model is MIT, with its upstream license retained in `third_party/SILERO_LICENSE.txt` and generated browser notices. Matched ONNX Runtime is MIT. Small model conversion cards state Apache-2.0; original OpenAI Whisper code/weights are MIT. Model downloads remain on demand. Existing Tscaps MIT engine and unmodified Mediabunny MPL-2.0 obligations are unchanged. No AGPL studio code or proprietary separator assets were added.
