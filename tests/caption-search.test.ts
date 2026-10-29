import { describe,it,expect } from 'vitest';
import { findCaptionMatches,replaceCaptionMatches } from '../src/caption-search';
import type { Word } from '../src/types';
const words:Word[]=[{id:'a',text:'Bhai,',start:.5,end:1},{id:'b',text:'AI',start:1,end:1.5,emphasis:true},{id:'c',text:'tool AI',start:1.5,end:2.5},{id:'d',text:'aaj.',start:3,end:4}];
describe('caption find and replace',()=>{
 it('finds case insensitive literal matches without interpreting regex punctuation',()=>{expect(findCaptionMatches(words,'ai')).toHaveLength(3);expect(findCaptionMatches(words,'ai',true)).toHaveLength(1);expect(findCaptionMatches(words,'.')).toHaveLength(1);expect(findCaptionMatches(words,'[')).toEqual([]);expect(findCaptionMatches(words,' ')).toEqual([]);});
 it('replaces one occurrence without changing timing, emphasis, or other matches',()=>{const next=replaceCaptionMatches(words,[findCaptionMatches(words,'AI',true)[0]],'ML');expect(next[1]).toEqual({...words[1],text:'ML'});expect(next[2]).toEqual(words[2]);expect(words[1].text).toBe('AI');});
 it('replaces all occurrences including repeated matches in one token',()=>{const source=[{...words[0],text:'AI AI AI'}];expect(replaceCaptionMatches(source,findCaptionMatches(source,'AI'),'OpenAI')[0].text).toBe('OpenAI OpenAI OpenAI');});
 it('preserves a combined native interval when replacing across words',()=>{const next=replaceCaptionMatches(words,findCaptionMatches(words,'AI tool'),'smart tool');expect(next[1]).toEqual({...words[1],text:'smart tool AI',end:2.5,timing:'segment',breakAfter:undefined,joinAfter:undefined});expect(next[2]).toEqual(words[3]);});
 it('handles adjacent cross-word matches sharing a token without losing suffixes',()=>{const source=[{...words[0],text:'ab'},{...words[1],text:'ab ab'},{...words[2],text:'ab'}];expect(replaceCaptionMatches(source,findCaptionMatches(source,'b a'),'X').map(w=>w.text).join(' ')).toBe('aXX Xb'.replace(' ',''));});
 it('allows deletion without blank captions or fabricated timing',()=>{const next=replaceCaptionMatches(words,findCaptionMatches(words,'AI',true),'');expect(next.map(w=>w.text)).toEqual(['Bhai,','tool','aaj.']);expect(next[1].start).toBe(1.5);expect(next[1].end).toBe(2.5);});
 it('handles Hindi Unicode and punctuation literally',()=>{const source=[{...words[0],text:'भाई भाई'}];expect(replaceCaptionMatches(source,findCaptionMatches(source,'भाई'),'Bhai')[0].text).toBe('Bhai Bhai');});
});
