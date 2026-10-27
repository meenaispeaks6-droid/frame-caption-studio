# Native caption generation repair

This extends the existing Whisper/Silero and shared canvas-rendering implementation. It does not introduce a new caption engine or server processing.

## Measured bottlenecks

The previous real 31.28-second Hindi run took 242,691 ms, and isolated seven-second Small inference took approximately 49.5 seconds. Acoustic inference dominates. Inspection also found three avoidable costs: every completed job destroyed its loaded model, identical regeneration repeated inference, and waveform/generation could decode the same file concurrently.

## Changes

- A single speech client rejects simultaneous requests, caches three completed results by actual File identity and language/model/audio choices, and clones results before returning them. Preset changes do not participate in recognition. Cache hits skip audio preparation, VAD, model loading and recognition. Cache is in-memory; reload loses it. Explicit regeneration restores recognized text, so manual edits should be saved first.
- Completed jobs keep the model worker for 30 seconds for reuse; idle expiry, cancellation, unmount and starting video export release it. Transcript cache survives idle release. Model-load failure no longer leaves a disposed model reusable on retry.
- Waveform and recognition share one pending/completed audio decode. Mono sources avoid an unnecessary mixing buffer; stereo buffers transfer to the worker rather than being cloned again.
- Phrase fallback reads real timestamp tokens and chunk strides from the same Whisper generation, before decoding word timing. It invokes another acoustic pass only if generation supplied no recoverable segment output. Optional cleanup may still retry original audio. This preserves actual phrase boundaries without invented word times.
- A synchronous UI lock prevents rapid duplicate jobs. Cancellation invalidates callbacks and prevents pending preparation from launching a worker. Worker crashes and unreadable messages surface errors. A 15-minute wall-clock ceiling stops a job that never finishes; this is a limit, not a speed claim.
- Playback remains usable during recognition. Caption preview avoids repainting unchanged video frames and limits drawing during recognition; export still uses the same caption drawing function. Style edits retain caption text and never start recognition.

## Validation and limits

37 unit tests pass, including cache isolation, concurrent jobs, cancellation before decoding completes, idle memory release and stalled-worker timeout. The actual UI lifecycle test passes playback during recognition, stale-result rejection after cancel, repeat-generation caching, and preservation of edited text during preset switching. Those lifecycle tests use a controlled worker and are not speech-accuracy tests.

The seven language UI contracts, phrase recovery, editable captions and real 720p H.264/AAC export checks pass. Actual AAC extraction still preserves a four-second packet-gap fixture; source waveform comparison has zero measured lag. Browser layout testing is emulation, not physical Android validation.

Real inference measurements are recorded separately in `validation-evidence/native-performance.json`. Historical baseline figures are not a controlled hardware comparison. Cache speedup is measured within the same running browser; it must not be presented as faster first-time inference.

No reliable improvement in Hindi lexical accuracy has been established. The existing reel still contains substitutions, and a complete manually verified Hindi/Hinglish/Indian-English corpus was not supplied. Existing partial caption-reference error measurements remain in SPEECH_QUALITY.md. General music separation is not implemented. These remaining issues prevent an unqualified production-ready claim.

## Reproduce

Run `npm run test`, `npm run build`, `node tests/native-jobs.mjs`, `node tests/languages.mjs`, `node tests/speech-fallback-ui.mjs` and `npm run test:browser`. For real inference, prepare the private audio fixtures and model cache as described in SPEECH_QUALITY.md, then run `SPEECH_CASES=long,english,noisy,silent node tests/native-performance.mjs`. The benchmark streams verified public model downloads from a local test cache; no media leaves the browser. Model weights and private media are not packaged.

## Observed timings in this run

| Recording | First generation | Identical repeat | Result |
| --- | ---: | ---: | --- |
| 31.28 s supplied Hindi excerpt | 422,793 ms | 0.8 ms | 97 word intervals; text and timestamps exactly match the previous run |
| 6 s known English narration | 50,437 ms | 0.2 ms | 13 words, same narration; no second preparation/inference |
| Added-noise Hindi | 155,061 ms | Not cached | Timing recovery failed; 444 characters of draft text retained |
| 3 s silence | 509 ms | 0.1 ms | Empty captions correctly reflect silence |

Repeat timings measure client result delivery inside Chromium, not a page reload, first model download or full UI paint. The long first run is slower than the historical 242,691 ms run; there is no demonstrated first-run speed improvement. Recognition was exercised alongside some UI/build validation, so the historical comparison is not a controlled hardware/load comparison. Noisy recovery still fails despite removing redundant acoustic work. Physical Android and broad manually verified Indian speech accuracy remain outstanding.
