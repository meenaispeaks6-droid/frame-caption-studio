import type { Word } from './types';

export type CaptionMatch = { first: number; last: number; start: number; end: number };
// Literal search across word boundaries, including recovered phrase-level entries.
export function findCaptionMatches(words: Word[], query: string, matchCase = false): CaptionMatch[] {
 if (!query.trim()) return [];
 const text = words.map(w => w.text).join(' '), offsets: number[] = [];
 let cursor = 0;
 for (const word of words) { offsets.push(cursor); cursor += word.text.length + 1; }
 const pattern = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'gu' : 'giu');
 return [...text.matchAll(pattern)].map(match => {
  const start = match.index!, end = start + match[0].length;
  const first = offsets.findIndex((offset, i) => offset + words[i].text.length > start);
  let last = first;
  while (last + 1 < words.length && offsets[last + 1] < end) last++;
  return { first, last, start: start - offsets[first], end: end - offsets[last] };
 }).filter(m => m.first >= 0);
}

export function replaceCaptionMatches(words: Word[], matches: CaptionMatch[], replacement: string): Word[] {
 const next = words.map(w => ({ ...w }));
 // Reverse order keeps every original character offset valid, even for multiple hits per word.
 for (const match of [...matches].reverse()) {
  const first = next[match.first], last = next[match.last];
  const text = first.text.slice(0, match.start) + replacement + last.text.slice(match.end);
  next.splice(match.first, match.last - match.first + 1, {
   ...first, text, end: last.end,
   ...(match.first !== match.last || /\s/u.test(text.trim()) ? { timing: 'segment', breakAfter: last.breakAfter, joinAfter: last.joinAfter } : {}),
  });
 }
 return next.filter(w => w.text.trim()).map(w => ({ ...w, text: w.text.trim() }));
}
