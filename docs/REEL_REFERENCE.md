# Uploaded reel caption analysis

The user supplied the playable 59.51 s MP4 on 2026-10-26. It is 1064 × 720, approximately 29.97 fps, H.264 with HE-AAC audio. The original remains a private analysis input; it is not bundled or deployed.

## Observed treatment

- White, regular-weight handwritten Roman Hindi / English, sentence case.
- Center aligned at approximately x = 532, y = 360, rather than near the bottom.
- Roughly 27 px font size at a 720 px short edge. The phrase at 10 s spans about 318 px; visible letters are around 26 px tall.
- Modest natural word spacing, no opaque box, colored keyword, chunky outline, spring, rotation, or karaoke progression.
- Complete short phrases hold still, then cut directly to the next phrase. Inspection at 10–15 samples per second around the opening and 10–11.2 s confirmed phrase replacement rather than per-word reveal.
- Some captions intentionally move away from the center to accommodate a shot. The app's vertical position control allows manual placement for a project; automatic shot-dependent positioning is not implemented.

## Implementation

`Reel Handwritten` uses the separately licensed **Mynerve Regular**, distributed unmodified through `@fontsource/mynerve@5.3.0` under **SIL OFL-1.1**. Several licensed handwriting specimens were compared against the reference; Mynerve provides a close shape and spacing match. A compressed video alone does not establish the original font's identity.

Defaults: 27 px per 720 px short edge, white, 50% vertical position, no stroke, 12% soft shadow, animation strength 0, up to five words per phrase. Larger grouping accommodates longer phrases. Explicit ↵ endings in Transcript make shorter intentional cuts. Imported subtitle cues retain their phrase boundaries, and project JSON/local storage retain manual breaks.

Each line is shaped as one string to preserve font spacing. The shared deterministic canvas renderer draws the entire phrase from its first word start through its last word end. At default strength, active-word changes do not alter any pixels. Increasing animation strength adds an optional short fade with slight upward settling; reset returns to the reference's clean cuts. Devanagari falls back to the bundled Noto font.

The preset is available in live preview, the render worker, main-thread fallback, MP4 and WebM. All other presets remain available. No code, fonts, graphic assets, or footage were extracted from a proprietary editor.

## Verification

`tests/handwritten.mjs` checks font loading, stable pixels within a phrase, clean phrase changes, clear silence, centered bounds and reference-sized lettering, manual phrase-break persistence, mobile layout, and real worker-rendered landscape and UI-rendered portrait MP4s. FFmpeg fully decodes the actual outputs. A decoded export frame is compared with the preview frame to detect worker font or layout drift. The numerical report is stored in `validation-evidence/handwritten.json` after a passing run.
