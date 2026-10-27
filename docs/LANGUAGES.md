# Spoken language and Latin captions

Importing a video with audio opens the spoken/caption language modal. Regeneration opens it again. Same as Spoken Language is the default and always uses Whisper's transcription task. Language/model settings persist in local storage and JSON projects. A new video starts with Auto Detect and Same, while reconnecting a saved source retains its project settings.

All recognized words pass through romanization after acoustic word alignment. This preserves IDs, starts, ends, emphasis and phrase boundaries. English words and their case remain intact. Hindi uses common Roman spellings and conservative technical-name mappings. Other scripts use AnyAscii's phonetic mappings; pronunciation may need correction, particularly Arabic without vowels and Japanese kanji. Unknown unmappable letters cause a visible error. Imports and manual edits use the same Latin normalization, so preview, subtitles and videos share one text array.

Explicitly choosing another caption language activates a separate local M2M100 translation model. It downloads about 632 MB and used about 2.4 GB renderer memory during testing; desktop is recommended. The MIT-licensed facebook/m2m100_418M weights are converted by Xenova. Text and media never leave the browser; external requests download public model files only. Smaller Marian models were tested and rejected after semantic errors.

Translation changes words and word order, so target-language words have no original acoustic alignment. The app keeps each original sentence's time window, estimates translated word times within it, and labels those times as estimated. Manual correction remains available. Hinglish Same preserves its mixture; explicit Hinglish-to-Hindi uses a translation pivot. Selecting Hinglish as a target produces Roman Hindi with preserved English technical names; it does not invent a prescribed percentage of English words.

Whisper Base is the default and Tiny remains a quick option. The models use q8. Speech recognition and translation still require review; the app rejects unusable alignment rather than silently dropping recognized words or manufacturing timings. Telugu transcription/romanization is available, but the local translation model does not support explicit Telugu translation.

## Observed validation

- 23 unit tests: original timing/editor checks, Hindi and mixed-script romanization, exact timing preservation, translation boundaries and technical-name restoration.
- Seven language UI scenarios: import modal, saved choices, regeneration, Auto Detect, all six presets, JSON round trip, Latin SRT and mobile layout. ASR is explicitly stubbed only in these UI contract tests.
- Actual browser M2M100 inference: Hindi quote -> “Today I will tell you a great trick.”; mixed Hindi AI/tool quote -> “I got a new AI tool today.”; English -> Hindi followed by romanization. Mixed translation can omit discourse words (the tested English translation omitted “Guys”); review remains necessary.
- Actual Whisper Base English inference recognized the original 13-word sample with word timing. Model tests use a TLS-verifying public-download adapter because the test Chromium profile does not trust the managed proxy CA. That adapter is not shipped.
- Actual Latin-text 720 × 1280 H.264 MP4 with AAC audio rendered through the real export worker and fully decoded by FFmpeg.

See numerical records in validation-evidence/. Physical Android memory and model performance remain unverified.

## Hindi recognition limitation

Real inference on the supplied reel excerpt failed: Tiny hallucinated English; Base repeated a Hindi token with timestamps beyond the clip. These are failed speech-accuracy checks, not passing acceptance tests. The app now rejects unusable alignment visibly. A full-precision-encoder experiment also closed the test browser and is not shipped. Hindi romanization tests and Hindi translation text tests passed, but they do not prove accurate Hindi speech recognition. Hindi, Hinglish and Auto Detect recognition accuracy on representative recordings remains outstanding.
