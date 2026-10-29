import { describe,it,expect } from 'vitest';
import { bulkEdit,delayWords,retime,splitAt } from '../src/editor-operations';
import { groupWords,validateWords } from '../src/captions';
import { motionAt, readTransitions } from '../src/motion';
import type { Word } from '../src/types';
const words:Word[]=[{id:'a',text:'Bhai,',start:1,end:1.3,emphasis:true},{id:'b',text:'AI',start:1.5,end:2},{id:'c',text:'tool!🔥',start:2.1,end:3}];
describe('editor operations share timed source data',()=>{
 it('removes punctuation and emoji without rewriting words or changing times',()=>{expect(bulkEdit(words,'punctuation').map(w=>w.text)).toEqual(['Bhai','AI','tool🔥']);expect(bulkEdit(words,'emojis')[2].text).toBe('tool!');expect(bulkEdit(words,'emphasis').every(w=>!w.emphasis)).toBe(true);expect(bulkEdit(words,'gaps').map(w=>w.end)).toEqual([1.5,2.1,3]);});
 it('removes complete emoji sequences while preserving Hindi joiners and numbers',()=>{const next=bulkEdit([{...words[0],text:'Hi 👍🏽 🇮🇳 👨‍👩‍👧 1️⃣ 123 क्‍ष'}],'emojis');expect(next[0].text).toBe('Hi     123 क्‍ष');});
 it('clamps bulk delay to the available source duration',()=>{expect(delayWords(words,-5,4)[0].start).toBe(0);expect(delayWords(words,5,4).at(-1)!.end).toBe(4);expect(delayWords(words,.4,4)[1].start).toBe(1.9);});
 it('moves phrases together without crossing neighbors',()=>{const next=retime(words,['a','b'],5,'move',4);expect(next[1].end).toBe(2.1);expect(next[1].start-next[0].start).toBeCloseTo(.5);expect(validateWords(next,4)).toHaveLength(3);});
 it('clamps resize to neighbors and a positive duration',()=>{expect(retime(words,['b'],-9,'start',4)[1].start).toBe(1.3);expect(retime(words,['b'],9,'end',4)[1].end).toBe(2.1);expect(retime(words,['b'],-9,'end',4)[1].end).toBeCloseTo(1.52);});
 it('splits at a real word boundary without inventing timing',()=>{const next=splitAt(words,1.4);expect(next[0].breakAfter).toBe(true);expect(next.map(w=>[w.start,w.end])).toEqual(words.map(w=>[w.start,w.end]));});
 it('respects explicit merges, breaks, and character grouping',()=>{expect(groupWords(words,8,8)).toHaveLength(2);expect(groupWords(words.map((w,i)=>({...w,joinAfter:i<2})),1,8)).toHaveLength(1);expect(groupWords(splitAt(words,1.4),8,24)).toHaveLength(2);});
 it('preserves per-caption and per-word transition data when validating saved projects',()=>{const next=validateWords([{...words[0],transitions:{in:{name:'fade',duration:.2,intensity:60,easing:'linear'}}}]);expect(next[0].transitions?.in?.name).toBe('fade');});
 it('rejects malformed imported motion settings',()=>{expect(()=>readTransitions({in:{name:'fade',duration:-1,intensity:50,easing:'linear'}})).toThrow('Invalid motion settings');});
 it('evaluates the same deterministic transition values for preview and export',()=>{const settings={in:{name:'fade',duration:.5,intensity:60,easing:'linear'}} as const;expect(motionAt(settings,.25,1).alpha).toBe(.5);expect(motionAt(settings,1,1)).toEqual({alpha:1,scale:1,x:0,y:0,rotate:0});});
});
