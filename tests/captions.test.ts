import { describe, it, expect } from 'vitest';
import { groupWords, activeGroup, validateWords, parseSrt, toSrt, wordsFromChunks } from '../src/captions';
import { spring } from '../src/render';
const words=[{id:'a',text:'Hello',start:.5,end:.9},{id:'b',text:'world.',start:.9,end:1.5},{id:'c',text:'नमस्ते',start:2.3,end:2.8}];
describe('caption timing boundaries',()=>{
 it('does not display captions in silence or duplicate words at boundaries',()=>{const groups=groupWords(words,4);expect(groups).toHaveLength(2);expect(activeGroup(groups,.49)).toBeUndefined();expect(activeGroup(groups,.9)?.map(w=>w.text)).toEqual(['Hello','world.']);expect(activeGroup(groups,1.5)).toBeUndefined();expect(activeGroup(groups,2.3)?.[0].text).toBe('नमस्ते');});
 it('rejects overlapping, reversed and out-of-duration edits',()=>{expect(()=>validateWords([{...words[0],end:1.2},words[1]])).toThrow();expect(()=>validateWords([{...words[0],end:.4}])).toThrow();expect(()=>validateWords(words,1)).toThrow();});
 it('keeps Unicode and precise phrase timing through SRT export/import',()=>{const srt=toSrt(words,4),parsed=parseSrt(srt,3);expect(parsed.map(w=>w.text)).toEqual(words.map(w=>w.text));expect(parsed[0].start).toBe(.5);expect(parsed.at(-1)?.end).toBe(2.8);});
 it('splits long pauses even when the group is not full',()=>expect(groupWords([{...words[0],text:'a'},words[2]],8)).toHaveLength(2));
 it('normalizes model overlap and missing terminal timestamp without negative durations',()=>{const normalized=wordsFromChunks([{text:'a',timestamp:[.5,.9]},{text:'b',timestamp:[.8,null]}],1.2);expect(normalized[1].start).toBe(.9);expect(normalized[1].end).toBe(1.2);expect(()=>validateWords(normalized,1.2)).not.toThrow();});
 it('uses a deterministic spring with overshoot and decay',()=>{expect(spring(0)).toBe(0);expect(spring(.15)).toBeGreaterThan(1);expect(spring(2)).toBeCloseTo(1,5);});
 it('keeps explicit phrase cuts through validation, grouping and subtitle export',()=>{
  const edited=validateWords([{...words[0],text:'apni',breakAfter:true},{...words[1],text:'kahani'},words[2]],3);
  const groups=groupWords(edited,8);expect(groups.map(g=>g.map(w=>w.text))).toEqual([['apni'],['kahani'],['नमस्ते']]);
  expect(activeGroup(groups,.9)?.[0].text).toBe('kahani');
  expect(toSrt(edited,8)).toContain('00:00:00,500 --> 00:00:00,900\napni');
 });
 it('retains adjacent imported cue boundaries without punctuation',()=>{
  const imported=parseSrt('1\n00:00:00,000 --> 00:00:00,800\napni kahani\n\n2\n00:00:00,800 --> 00:00:01,500\nkhud likho',2);
  expect(groupWords(imported,8).map(g=>g.map(w=>w.text).join(' '))).toEqual(['apni kahani','khud likho']);
 });
});
