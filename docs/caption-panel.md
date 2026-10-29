# Caption panel reference update

Frame's existing project words, grouping, history, renderer and export pipeline remain the source of truth. The five supplied screenshots informed the charcoal surfaces, green accents, sheet proportions, compact transcript rows, find/replace card and inline tools. Frame branding and existing light mode remain available.

## Working controls

- Caption Tools expands inside the transcript sheet, with word count, max characters/reset and 1/2/3 lines.
- Literal Find & Replace supports case matching, result counts, previous/next navigation, replace one/all, Enter navigation and Ctrl/Cmd+Enter replace all.
- Cross-word replacements retain the combined original interval, marked as phrase timing. Precise new word alignment is not invented.
- Editable word inputs update preview immediately. Context controls select, emphasize and split individual words. Number buttons seek/select captions; row actions open scoped animations, timing, emphasis and grouping.
- Punctuation, emphasis, gap and emoji cleanup changes real data. Multiple cleanup switches can be reversed independently until other edits intervene; after further edits use Undo. Recent cleanup states are bounded to 20 entries. This UI recovery state is session-local; resulting caption text/timing is autosaved as before.
- Delay updates while dragging, clamps to media bounds, resets, and groups a gesture into one undo step. It displays a relative offset for the current editing session; saved timestamps retain the shift after reopening.
- Shift+Ctrl/Cmd+Z handles uppercase key events correctly. Text inputs retain their native keyboard behavior.
- Full emoji sequences (skin modifiers, flags, families, keycaps) are removed without deleting Hindi joiners or ordinary numbers.

## Verification

- `npm run test`: 67 unit tests passed, including literal/case-sensitive/Unicode/cross-word replacements and complete emoji removal.
- `npm run build`: TypeScript and production Vite build passed.
- `npm run test:browser`: existing editor workflow, immediate live editing, undo/redo, 16 templates, timeline, presets, mobile sheets, and real MP4 export passed.
- `npm run test:caption-panel`: new actual Chromium UI tests at 360px, 412px and 1440px passed, exercising find/replace, combined cleanup switches, grouping controls, timing, delay/reset/undo/redo, splitting and scoped animation; no page exceptions or horizontal page overflow.
- Export: 9-second 720×1280 H.264/AAC output fully decoded with FFmpeg. Preview/export caption-region overlap at 0.8/1.2/1.6 seconds: 0.872/0.981/0.977. Audio lag: 0 samples; correlation >0.9999999.
- Screenshots: `test-results/captions-*.png`, `caption-find-*.png`, `caption-tools-*.png`, `caption-delay-*.png`.

Physical Android/Edge hardware was not available. Screenshots cannot establish proprietary icon semantics; Frame uses explicit accessible labels for the independently implemented row actions. Transcription models and the Shruti timing recovery fix are unchanged.
