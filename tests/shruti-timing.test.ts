import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,it,expect} from 'vitest';
import {validateWords} from '../src/captions';
const context={self:{crypto:{randomUUID:()=>crypto.randomUUID()}}} as any;
runInNewContext(readFileSync('public/shruti/timing.js','utf8'),context);
const recover=(words:any[],duration=3,offset=0)=>context.recoverShrutiTiming({text:words.map(w=>w.word).join(' '),words},duration,offset);
describe('Shruti native timing recovery',()=>{
 it('keeps exact valid word boundaries',()=>{const r=recover([{word:'Bhai',start:.1,end:.4},{word:'AI',start:.5,end:.9}]);expect(r.map((w:any)=>[w.start,w.end,w.timing])).toEqual([[.1,.4,'word'],[.5,.9,'word']]);});
 it('recovers zero-duration CTC words without losing or duplicating text',()=>{const r=recover([{word:'Bhai',start:.1,end:.4},{word:'aaj',start:.4,end:.4},{word:'AI',start:.4,end:.8}]);expect(r.map((w:any)=>w.text).join(' ')).toBe('Bhai aaj AI');expect(r[0].timing).toBe('segment');expect(validateWords(r,3)).toHaveLength(2);});
 it('merges overlaps and contained tokens into native phrase intervals',()=>{const r=recover([{word:'ek',start:.1,end:.6},{word:'AI',start:.4,end:.5},{word:'tool',start:.5,end:.9}]);expect(r).toHaveLength(1);expect(r[0]).toMatchObject({text:'ek AI tool',start:.1,end:.9,timing:'segment'});});
 it('handles leading/trailing zero duration tokens and applies the source offset once',()=>{const r=recover([{word:'aaj',start:.2,end:.2},{word:'tool',start:.2,end:.8},{word:'hai',start:.9,end:.9}],1,28);expect(r[0]).toMatchObject({text:'aaj tool hai',start:28.2,end:28.9,timing:'segment'});});
 it('retains native probabilities conservatively through timing recovery',()=>{expect(recover([{word:'AI',start:0,end:.5,probability:.9},{word:'tool',start:.4,end:.8,probability:.3}])[0].probability).toBe(.3);expect(recover([{word:'AI',start:0,end:.5}])[0].probability).toBeUndefined();});
 it('clamps native rounding at the recording boundary',()=>{const r=recover([{word:'end',start:.8,end:1.02}],1);expect(r[0].end).toBe(1);});
 it('does not invent timing when all words have the same point',()=>expect(()=>recover([{word:'AI',start:0,end:0}])).toThrow('usable time interval'));
 it('rejects nonfinite, null and wildly invalid boundaries',()=>{for(const start of [NaN,null,-3])expect(()=>recover([{word:'AI',start,end:1}])).toThrow('boundaries');});
 it('does not silently drop transcript words missing from alignment',()=>expect(()=>context.recoverShrutiTiming({text:'Bhai AI',words:[{word:'AI',start:0,end:1}]},3,0)).toThrow('every word'));
});
