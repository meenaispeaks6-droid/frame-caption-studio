# Shruti vocabulary and speech review

The model and pinned WASM binary are unchanged. In Captions → Speech review,
enter one term per line, optionally `ChatGPT | chatjipiti, chat gpt`. The dictionary
is saved on this browser, separately from projects. Up to 32 canonical terms
(64 characters each) are passed as native keyword hints. Aliases affect review
suggestions, not transcript rewriting. No extra models or services are used.

Select flagged words to seek to their audio. Approve a spelling suggestion to
change that word with Undo, or retry a selection of at most 20 seconds. Retry
includes two seconds of surrounding audio on either side, dictionary hints and
high-confidence context words. It runs Shruti on that bounded PCM slice. The
original text remains until **Apply retried phrase**; edits made while reviewing
invalidate the proposal. Retry replaces the selected time interval, including
intermediate words if the selection is disjoint. All changes are undoable.
Retry produces original-language Roman text; it does not translate a previously
translated selection back into English. Use normal generation for translation.

Native probabilities below 0.75 flag words for review. Scores are uncalibrated,
not a guarantee of accuracy. Missing scores remain unknown. Overlapping native
word intervals retain real phrase timing and the lowest available probability.
Manual edits clear stale recognition scores. Grammar suggestions are deliberately
limited and review-only: unusual grammar can reflect the actual speech.

## Verified native API

`public/shruti/needle/needle.h` is copied from the exact pinned engine revision:
https://huggingface.co/Cactus-Compute/needle3/resolve/3391a1007e7db31d2fe5c69c734bbe93a9c1ce79/wasm/needle.h

The Apache-2.0 header defines the existing seven-argument `needle_transcribe`:
PCM pointer, sample count, language pointer, keyword pointer, timestamps flag,
output pointer, output capacity. Keyword strings are UTF-8, newline-separated,
NUL-terminated. A nonzero timestamp flag returns native word probabilities too.
The return value is token count, not output byte count. All per-call allocations
are freed in `finally`, including after later allocation failures. No additional
native API or invented probability option is used. Hindi/Hinglish retain the
existing auto-language path; the documented forced-language list lacks Hindi.

## Real inference comparison

Measured in desktop Chromium with the real pinned WASM and cached Shruti model.
Twenty existing real audio fixtures: ten Hindi and ten Hinglish. Their references
are dataset annotations, **not independently manually re-reviewed for this work**.
No claim of a new human-verified accuracy benchmark or Android-device validation.

Both arms enabled timestamps. The baseline supplied no keywords; the comparison
used the same fixed `AI, ChatGPT, OpenAI, YouTube, Python, Google` hints for every
clip, independent of reference text. Mode order alternated between clips. Model
initialization/download time is excluded. WER uses case-insensitive Unicode word
tokens with punctuation removed; romanization and manual suggestions are excluded.

| Audio | Reference words | Errors, baseline / hints | WER, baseline / hints | Total inference, baseline / hints |
|---|---:|---:|---:|---:|
| Hindi, 10 clips | 267 | 62 / 62 | 23.22% / 23.22% | 42.65s / 32.66s |
| Hinglish, 10 clips | 149 | 28 / 28 | 18.79% / 18.79% | 16.32s / 18.67s |
| All 20 | 416 | 90 / 90 | 21.63% / 21.63% | 58.97s / 51.32s |

**No measurable recognition accuracy gain on this corpus.** One run per arm is
insufficient for a speedup claim: timing varied by language and run order. Native
probabilities were present in both arms. These numbers do not measure suggestion
acceptance, word-timing accuracy against human annotations, physical Android
memory, or retry accuracy. Custom names/technical recordings need their own
reviewed corpus to establish benefits from targeted vocabulary. Hints can bias
recognition incorrectly, so they remain optional and editable.

Per-clip error counts and timings are recorded in
[`validation-evidence/shruti-keywords.json`](validation-evidence/shruti-keywords.json).

## Reproduce

- `npm run test`: native allocation/API, probability preservation, vocabulary,
  retry boundaries, existing language/editor tests.
- `npm run build`: TypeScript and production Vite build.
- `npm run test:browser`: real media import/editing/export, desktop and mobile
  viewports; fully decodes MP4, checks dimensions, original audio and frame parity.
- `npm run test:speech-review`: controlled worker with real audio extraction;
  verifies local dictionary, suggestions, bounded retry, explicit apply and Undo.
- `FRAME_SPEECH_FIXTURES=/path/to/fixtures npm run test:shruti-real`: actual
  caption-worker inference on Hindi, Hinglish and English fixtures, checking
  bounded positive timings and native probabilities after timing recovery.
- `FRAME_SPEECH_FIXTURES=/path/to/fixtures npm run test:shruti-keywords`: real
  inference, requires `shruti.cact`, `shruti-benchmark.json` (`results` with `id`,
  `reference`, `humanReference`), and `clips/<id>.f32` (16kHz mono PCM).
  Results are written to `test-results/shruti-keywords-benchmark.json`.

All audio stays local. This patch adds no downloads; existing model initialization
and caching behavior is preserved. Initial installation still needs the existing
assets/model download. It does not add a service worker or guarantee a cold
browser can open the application offline.
