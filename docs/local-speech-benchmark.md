# Local Hindi/Hinglish speech: implementation and measured limits

This patch adds Shruti to the existing speech worker/client. It does not send
media to a service, replace the editor, or change the shared preview/export
renderer. Model files are public downloads; inference and alignment run on the
user's device. The deployment remains a static Cloudflare Pages application.

## Selection

| Spoken language | Fast, Recommended | High Accuracy, Recommended |
| --- | --- | --- |
| Hindi | Shruti | Shruti with Silero voice segmentation |
| Hinglish | Shruti | Shruti with Silero voice segmentation |
| English | Shruti | Whisper Base on desktop or a phone reporting at least 8 GB; otherwise Shruti with voice segmentation |
| Auto Detect / other languages | Existing multilingual Whisper | Existing multilingual Whisper, device-aware model recommendation |

Explicit Shruti remains Shruti in either mode. Explicit Tiny/Base/Small choices
and older projects' manual selections remain available. Old projects with an
`auto` model preference adopt recommendations; projects without that preference
retain their prior Whisper model. Auto Detect remains multilingual by default:
select Hindi/Hinglish/English for compact recognition, or explicitly choose
Shruti to restrict automatic detection to Hindi/English. No unverified Indic or
Apex option appears in the editor.

High Accuracy is a processing preference, not a guarantee or a second Hindi
model. Shruti uses the same compact weights in both modes; High Accuracy adds
Silero voice detection. Recognition accuracy improvement from that detector has
not been established across the corpus. Original audio remains the default.

## Compatibility, licensing and revisions

| Candidate | License / pinned conversion | Actual browser result |
| --- | --- | --- |
| Shruti | Apache-2.0; `udgamlabs/Shruti@ebf52e614065ce20e56affdab641f749a04511a5` | WASM recognition and native CTC word alignment work in Chromium 154; integrated production worker tested on 20 Hindi/Hinglish clips |
| IndicConformer Hindi int8 | MIT; `OpenVoiceOS/ai4bharat-indicconformer-hi-onnx@8960b8611af5b8c375d442d52907360176410c8b` | Session creation fails with unsupported `ConvInteger(10)` at `/pre_encode/conv/conv.0/Conv_quant` in the pinned browser ONNX runtime. No WER or speed is claimed for it. This is a result for this conversion/runtime, not every IndicConformer build. |
| Hindi2Hinglish Apex q4 | Apache-2.0; `onnx-community/Whisper-Hindi2Hinglish-Apex-ONNX@805e4515dcbd6a289b64b73c6b5e69130610f8ab` | Initialization did not complete within the 180-second browser-probe budget; zero clips completed, so runtime support and WER remain unverified. Not offered on phones: approximately 800 MB of q4 encoder/decoder files and no alignment heads in its generation configuration. |

Shruti model: 29,546,527 bytes; SHA-256
`b189e954aaed4a9fd41acbad3ac05e486381e96325b22a4c695b9ea5153d7065`.
Both downloaded and cached copies are verified. Needle WASM is 929,785 bytes;
its Apache license, provenance and ESM-adapter notice are bundled. The model is
not included in the deployment. No Python telemetry package is used.

The runtime comes from `udgamlabs/shruti` commit
`1f20074fd30820b13567c1d1e74d6fc62a6448d4`, which identifies Cactus Needle
revision `3391a1007e7db31d2fe5c69c734bbe93a9c1ce79`. The only change to the
vendor JS is an ESM export; WASM is unchanged. No new npm dependencies.

## Corpus and measurement policy

20 real recordings: first 10 test rows of Google FLEURS `hi_in` (113.640 s),
and first 10 test rows of `dianavdavidson/MUCS-Hinglish` (68.225 s). MUCS mirror
revision `3c66ee127a7b0e0a746d4df1002858567135edc1`. Five FLEURS `en_us`
recordings (40.860 s) provide a limited separate English comparison.

**These are dataset-provided human transcripts, not 20 recordings independently
re-listened to and manually verified in this session.** The MUCS slice is from
one tutorial and is not a diverse creator-reel test set. No background-music or
accent generalization is established. FLEURS English is not an Indian-English
benchmark. Source hashes and per-clip metrics are in the adjacent JSON report;
no recordings, signed dataset URLs, or reference transcripts are committed.
FLEURS is CC-BY-4.0. The MUCS mirror says CC-BY-4.0 but the upstream corpus is
CC-BY-SA-4.0; no dataset audio/text is redistributed with this application.

WER uses the same deterministic application romanizer for reference and model
output, lowercase NFKC, removes punctuation into spaces, and keeps Latin
letters/digits. No synonym, semantic, phonetic or number-equivalence matching
is used. Thus Roman spelling differences and English loan words written in
Devanagari can count as errors. WER can exceed 100% when a model inserts repeated
words. This is Romanized orthographic WER, not a guarantee of acoustic accuracy.

Raw-candidate runs use the same 16 kHz mono PCM. Shruti includes its native word
alignment. Whisper uses q8 WASM and the existing timestamp-constrained word
pipeline; its repetitive outputs remain in the measurements. These numbers do
not characterize every Whisper decoding configuration. The optional Base
Hindi/Hinglish run was stopped after 16 clips because of repeated long outputs;
its partial Hinglish result must not be presented as a full-corpus benchmark.

Timing figures are desktop-host elapsed times, not physical Android timings.
Some development/build activity overlapped comparator runs, so timings are
indicative rather than an isolated device performance study. Reported WASM
linear memory is not total browser RAM, GPU memory or Android process RSS.
There are no human word-time labels: timestamp error/MAE and confidence
calibration are **unmeasured**. Structural timestamp validity is tested
separately; it does not prove speech synchronization accuracy.

## Results measured on this host

| Model/configuration | Corpus | Romanized WER | Inference time / audio duration |
| --- | --- | --- | --- |
| Shruti, native word alignment | 10 Hindi | 20.97% (56 / 267 reference words) | 37.21 s / 113.64 s |
| Shruti, native word alignment | 10 Hinglish | 18.79% (28 / 149) | 19.53 s / 68.225 s |
| Shruti, explicit English | 5 English | 17.31% (18 / 104) | 10.74 s / 40.86 s |
| Whisper Tiny q8, existing word pipeline | 10 Hindi | 310.86% (830 / 267; repetitions included) | 119.61 s / 113.64 s |
| Whisper Tiny q8, existing word pipeline | 10 Hinglish | 140.94% (210 / 149; repetitions included) | 94.59 s / 68.225 s |
| Whisper Tiny q8, existing word pipeline | 5 English | 31.73% (33 / 104) | 47.79 s / 40.86 s |
| Whisper Base q8, existing word pipeline | 5 English | 11.54% (12 / 104) | 64.45 s / 40.86 s |

This limited comparison supports compact Shruti for Hindi/Hinglish and Fast
English, with optional Base for High Accuracy English. It does not establish a
universal model ranking or show that extra voice detection improves WER.

The raw Shruti run emitted 407 timing tokens: 406 had positive, in-range
boundaries; one zero-duration token needed review/coalescing. These are
structural checks, not timing error measurements. Its largest observed WASM
linear heap was 85,327,872 bytes (81.4 MiB). Integrated fresh-worker tests used
71,106,560 bytes (67.8 MiB) for these short clips.

Production-worker tests completed all 20 Hindi/Hinglish clips and verified
Latin text, monotonic in-range word/segment times, cache hits without decoding,
and immediate constrained-worker disposal. A real High Accuracy Hindi run also
completed with Silero enabled. A separate 180-second concatenation of real
fixture audio completed in 68.53 s including preparation/worker startup on
this host; WASM linear memory reached 122,945,536 bytes (117.3 MiB), 409 editable
timing entries. This is a resource stress fixture, not a 180-second accuracy
benchmark or an Android process-memory result.

The actual Shruti Hindi result was rendered into a playable 720 × 1280 H.264/AAC
MP4. FFmpeg decoded the entire output, bright caption pixels were detected over
the dark source at an active caption time, source/output audio correlation was
1.0 with 0-sample measured lag, and duration matched the source within 0.1 s.
The fixture's image track is generated; its Hindi speech is a real FLEURS
recording. Native review controls were tested on desktop and Pixel-7-sized
Chromium with controlled ASR responses (separate from the real inference tests).

Automated validation: 50 Vitest tests, TypeScript/production build, general
browser/real MP4 tests, review UI, live editing (desktop/touch), timeline labels
(desktop/touch), native job cancellation/gating, caption drag and language UI /
real MP4 regressions. Existing preview/export features remain in place. See PR
for the final validation state. Physical Android and independent manual corpus
review are outstanding.

## Resource ownership and review

The existing SpeechClient transfers PCM, serializes jobs, caches three results,
and terminates mobile workers. Shruti workers terminate after every job on all
devices, reclaiming their entire WASM realm. Cache hits bypass extraction and
inference. The engine/model identity is part of worker reuse and result keys.
There is one bounded model-download array; inference windows are at most 30 s,
with quiet cut candidates and no overlapping/duplicated transcript windows.
Pointers are freed on all native-call paths. The existing operation gate keeps
transcription, translation and export separate. Source offsets are applied
once, including cache hits.

The native aligner emits word times and uncalibrated scores. Low-score words
(threshold 0.65, heuristic) get a review flag; a high score can still be wrong.
Whisper words have no calibrated confidence and are marked for review rather
than being shown as certain. A zero-duration alignment is retained with an
adjacent timed token as a segment, with a timing-review flag. Coverage failures
retain a draft transcript and produce an actionable error, never invented word
times. Review flags/scores survive project save/load, editing, undo and redo.
The UI can filter outstanding review items and explicitly mark words reviewed.

Romanization changes script after recognition, preserving token order and times.
It does not translate or rewrite sentences. Existing English spans/numbers are
kept. Hindi candra vowels that Sanscript leaves unmapped are now handled, fixing
failures on ordinary words such as ऑफिस/कॉपी. No LLM correction or automatic
sentence repair is added. Recognition can still miss/mishear words and names.

## Reproduce

Obtain the licensed source datasets separately. Place `manifest.json` entries
`{id,language,reference,duration,audioSha256}` and 16 kHz mono float32 little-
endian `clips/<id>.f32` recordings in a local `SPEECH_FIXTURES` directory.
Place the pinned, verified `shruti.cact` beside that manifest. No fixture media
should be committed or deployed. `tests/local-speech.mjs` runs the actual
production worker, not an ASR stub:

```sh
npm run test
npm run build
SPEECH_FIXTURES=/local/fixtures npm run test:speech:local
npm run test:speech:ui
npm run test:browser
SPEECH_FIXTURES=/local/fixtures node tests/shruti-export.mjs
```

`SPEECH_MODE=accuracy SPEECH_LIMIT=1 SPEECH_REPORT_SUFFIX=-accuracy` selects a
real High Accuracy smoke run. `SPEECH_MANIFEST=stress-manifest.json` supports a
separate long-recording resource fixture without treating it as an accuracy
sample. The export test needs the matching `clips/hi-0.wav` and actual saved
production inference results. It checks decoded dimensions, visible caption
pixels, source audio correlation and lag.

Candidate probes: `CANDIDATE=shruti|tiny|base|indic|apex node
tests/benchmarks/run.mjs` with `SPEECH_FIXTURES` set. Tiny/Base public download
cache uses SHA-256 hashes of Hugging Face GET URLs in `SPEECH_MODEL_CACHE`, as
in the existing native-performance harness. Indic expects `indic-hi.onnx`;
Apex expects its local config/tokenizer and q4 ONNX files under `apex/`.
`SPEECH_MANIFEST`, `SPEECH_REPORT` and `BENCHMARK_TIMEOUT_MS` scope optional
runs. `node --experimental-strip-types tests/benchmarks/score.mjs` computes WER
from the completed candidate JSON files. All inference is in Chromium, never
Python/ONNX server inference. Use HTTPS-verified downloads; do not disable
browser certificate validation.

Physical Android startup, thermal throttling, background/foreground handling,
peak process memory and crash-free repeated exports still require device tests.
Android-sized Chromium layouts are covered, but cannot establish that a phone
will never crash. No guaranteed accuracy or Android crash-resolution claim is
made.
