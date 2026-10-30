import {it,expect} from 'vitest';
import {parseVocabulary,hintsFor,suggestionsFor,retryRange,mergeRetry} from '../src/vocabulary';
import {validateWords} from '../src/captions';
const words=[{id:'a',text:'Main',start:1,end:2},{id:'b',text:'hai',start:2,end:3,probability:.3},{id:'c',text:'chatjipiti',start:3,end:4}];
it('bounds vocabulary and keeps hints plain strings',()=>{expect(parseVocabulary('ChatGPT | chat gpt, chatjipiti')[0]).toEqual({term:'ChatGPT',aliases:['chat gpt','chatjipiti']});expect(parseVocabulary('x\n'.repeat(50))).toHaveLength(32);expect(hintsFor(parseVocabulary('ChatGPT\nChatGPT'))).toEqual(['ChatGPT']);});
it('offers contextual spelling without rewriting original words or timing',()=>{expect(suggestionsFor(words,1,[])).toContain('hoon');expect(suggestionsFor(words,2,[])).toContain('ChatGPT');expect(words[1].text).toBe('hai');expect(suggestionsFor([{...words[0],text:'tool'},words[1]],1,[])).toEqual([]);});
it('retains valid probabilities while rejecting invalid scores',()=>{expect(validateWords(words)[1].probability).toBe(.3);expect(validateWords([{...words[0],probability:2}])[0].probability).toBeUndefined();});
it('pads retry context and replaces only the selected original interval',()=>{const range=retryRange(words,['b'],5);expect(range).toEqual({start:2,end:3,contextStart:0,contextEnd:5});const next=mergeRetry(words,[{...words[1],text:'hoon'}],range);expect(next.map(w=>w.text)).toEqual(['Main','hoon','chatjipiti']);expect(next[0]).toBe(words[0]);expect(next[2]).toBe(words[2]);expect(()=>retryRange(words,[],5)).toThrow();});

it('offers fuzzy dictionary matches only for uncertain words',()=>{const entry=parseVocabulary('Python');expect(suggestionsFor([{...words[0],text:'Pythan',probability:.4}],0,entry)).toEqual(['Python']);expect(suggestionsFor([{...words[0],text:'Pythan',probability:.95}],0,entry)).toEqual([]);});
