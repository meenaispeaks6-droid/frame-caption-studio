# Extended caption styles: layout and animation repair

All 22 extended presets use measured visual slots in the existing Canvas
renderer. Slots include text metrics, tracking, box padding, outlines, rotation,
keyword scale and word-transition movement. The layout reserves the largest
animation footprint for the full phrase, so active words cannot push their
neighbours into each other. Preview, template cards and MP4 export share it.
The original six presets retain their renderer and appearance.

## Verified fixes

| Issue | Cause | Correction |
|---|---|---|
| Sticker, Glass, Akshar, Hara Box and Gulabi Dabba overlap | Boxes added after measuring bare text | Include rounded/rectangular box padding in slots and wrapping |
| Blast, Bada Scale and Gradient Keyword cover neighbours | Enlarged keywords were wider than their slots | Reserve maximum emphasis scale before placement |
| Rise/glow/offset effects clip | Movement, outlines, rotation and shadow ignored by bounds | Reserve their envelope and clamp the transformed phrase inside the output |
| Peela Marker text is hard to read | Yellow letters over a narrow yellow stripe | Dark lettering over a full-height yellow highlight |
| Gulabi/Hara box lettering blends into background | Accent text close to its box colour | Use the selected text colour over solid boxes (white by default) |
| Typewriter shows future words, multiple cursors or broken Hindi shaping | Negative ages became zero; isolated code points were drawn separately | Gate by real start time, reveal shaped text at grapheme boundaries, and draw one cursor on the active word |
| Retro/Wide spacing overlaps | Tracking set after measurement without resolution scaling | Measure and draw with identical resolution-scaled tracking and monospace fallback |
| Edge positions or transitions clip | Clamp ignored transformed boxes and motion | Fit and clamp the full envelope, including phrase and word transitions |

The earlier ten-style layout patch from PR #12 is reused and extended to the
latest twelve; Capzi branding, the Haath Orange 400-weight fix and all 28 presets
are retained. Existing selected font-size values and timestamps are preserved.
Automatic fitting reduces only the effective render size. Polished defaults
apply when a preset is selected again; existing saved settings stay editable.

Layout is cached per Canvas context, active phrase, style and dimensions. No new
models, dependencies, transcription, language or encoding changes are introduced.

## Validation

- Unit tests: 67 pass; TypeScript and production Vite build pass.
- `npm run test:styles`: 352 configurations / 2,816 animation frames, zero
  detected text/box intersections or safe-area overflow. Cases cover portrait,
  square, landscape and 1080p, long Hindi/Hinglish text, size 100, outline 12,
  1–3 lines, edge X/Y positions, and word/phrase transitions.
- `npm run test:styles -- --layout-only` also checks default text contrast,
  a single active typewriter cursor, no future word reveal, stable layout,
  resolution-independent tracking and bounded cached measurements.
- All 22 extended styles exported through the real worker as 1.5-second
  H.264/AAC MP4s distributed across 720×1280, 720×720 and 1280×720. FFmpeg fully
  decodes them; FFprobe verifies dimensions, duration and audio.
- 44 preview/export frames are compared. Minimum caption-region intersection
  over union is 0.858. This measures image parity, not recognition accuracy.
- Exported audio sample counts match; best measured lag is zero. Whole-track
  AAC correlation is 0.99635 and interior correlation exceeds 0.9999999.
  The short synthetic fixture has codec boundary differences; both measures
  are retained rather than claiming lossless audio.
- The final marker-height correction additionally passes the actual UI import,
  apply, preview and MP4-download regression at 360×640, with frame overlap 0.980.
- `npm run test:browser` passes on an isolated server port, including real
  import, live edits, undo/redo, timing changes, presets, transitions, mobile
  layouts, and a fully decoded 720p MP4 with original audio synchronization.
- `node tests/caption-drag.mjs` passes mouse dragging on Bada Scale, emulated
  Android touch dragging on Gulabi Dabba, keyboard nudges, undo/redo, persistence
  and an actual MP4 export.
- All 28 gallery cards are selectable in a desktop browser. All 22 extended
  styles also apply in the 412px mobile editor without page overflow or page
  exceptions. Physical Android/Edge hardware remains untested.
- The original six presets produce pixel-identical PNGs across 18 before/after
  frames (three times per preset).

The baseline renderer failed overlap/overflow assertions in the same 352-case
browser fixture. These are repeated stress assertions, not a count of distinct
product bugs. The repaired renderer passes the stronger fixture, which also
covers the new rectangular boxes, marker highlights and cursor bounds.

![Before: all extended styles](screenshots/caption-styles/before.png)
![After: all extended styles](screenshots/caption-styles/after.png)
