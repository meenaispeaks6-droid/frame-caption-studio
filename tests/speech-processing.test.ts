import {describe,it,expect} from 'vitest';
import {analyzeAudio,speechSpans,enhanceSpeech} from '../src/audio-processing';
import {reliableWords,phraseFallback} from '../src/recognition';
import {romanizeWords} from '../src/romanize';
import {groupWords,validateWords} from '../src/captions';
const sr=16000;
describe('source-time audio processing',()=>{
 it('identifies real silence and refuses corrupt samples',()=>{expect(analyzeAudio(new Float32Array(sr)).silent).toBe(true);expect(speechSpans(new Float32Array(sr))).toEqual([]);expect(()=>analyzeAudio(new Float32Array([NaN]))).toThrow();});
 it('keeps quiet sounds with boundary context and skips only extended silence',()=>{const a=new Float32Array(sr*8);for(let i=sr;i<sr*2;i++)a[i]=.0006*Math.sin(i*.2);for(let i=sr*5;i<sr*6;i++)a[i]=.05*Math.sin(i*.2);const spans=speechSpans(a);expect(spans).toHaveLength(2);expect(spans[0].start).toBeLessThan(1);expect(spans[0].end).toBeGreaterThan(2);expect(spans[1].start).toBeLessThan(5);expect(spans[1].end).toBeGreaterThan(6);});
 it('preserves original samples and reports clipping without normalization',()=>{const a=new Float32Array([0,.2,1,-1,.3]);const copy=a.slice();expect(analyzeAudio(a).clipping).toBe(.4);expect(a).toEqual(copy);});
 it('rejects blind noise estimation on continuous activity',()=>{const a=Float32Array.from({length:sr},(_,i)=>.2*Math.sin(2*Math.PI*500*i/sr));expect(()=>enhanceSpeech(a,'light')).toThrow('quiet interval');});
 it('stereo center filtering reduces off-center interference while retaining source length and centered tone',()=>{
  const voice=Float32Array.from({length:sr*2},(_,i)=>.2*Math.sin(2*Math.PI*437.5*i/sr));const left=Float32Array.from(voice,(x,i)=>x+.15*Math.sin(2*Math.PI*1562.5*i/sr));const right=Float32Array.from(voice,(x,i)=>x+.15*Math.sin(2*Math.PI*2500*i/sr));const mono=Float32Array.from(left,(x,i)=>(x+right[i])/2),copy=mono.slice(),out=enhanceSpeech(mono,'center',[left,right]);
  const error=(a:Float32Array)=>a.reduce((s,x,i)=>s+(x-voice[i])**2,0)/a.length;
  expect(out.length).toBe(mono.length);expect(error(out)).toBeLessThan(error(mono)*.2);expect(mono).toEqual(copy);expect(()=>enhanceSpeech(mono,'center')).toThrow('unavailable');
 });
});
describe('truthful recognition timing recovery',()=>{
 it('keeps all genuine word boundaries and refuses zero-length/out-of-range alignment',()=>{const r={text:'मुझे जाना है',chunks:[{text:'मुझे',timestamp:[0,.4] as [number,number]},{text:'जाना',timestamp:[.4,.8] as [number,number]},{text:'है',timestamp:[.8,1] as [number,number]}]};const words=reliableWords(r,1)!;expect(words).toHaveLength(3);expect(romanizeWords(words).map(w=>[w.start,w.end])).toEqual(words.map(w=>[w.start,w.end]));expect(reliableWords({...r,chunks:[{text:r.text,timestamp:[13.98,13.98]}]},1)).toBeNull();});
 it('recovers full text at actual model phrase boundaries without inventing word times',()=>{const primary={text:'मुझे जाना है',chunks:[{text:'मुझे जाना है',timestamp:[0,0] as [number,number]}]},segment={text:primary.text,chunks:[{text:primary.text,timestamp:[.2,1.2] as [number,number]}]};const fallback=phraseFallback(primary,segment,1.5)!;expect(fallback).toHaveLength(1);expect(fallback[0]).toMatchObject({text:primary.text,start:.2,end:1.2,timing:'segment'});expect(validateWords(romanizeWords(fallback),1.5)).toHaveLength(1);expect(groupWords([...fallback,{...fallback[0],id:'next',start:1.2,end:1.5}],5)).toHaveLength(2);});
 it('keeps primary recognized text if a timing retry changes wording',()=>{const fallback=phraseFallback({text:'Keep every original word.'},{text:'Different wording',chunks:[{text:'Different wording',timestamp:[0,2]}]},2)!;expect(fallback[0].text).toBe('Keep every original word.');});
 it('retains text omitted by phrase chunks and rejects repetitive phrase-only recovery',()=>{const fallback=phraseFallback({text:''},{text:'Keep every original word.',chunks:[{text:'Keep',timestamp:[0,2]}]},2)!;expect(fallback[0].text).toBe('Keep every original word.');expect(fallback[0].timing).toBe('segment');expect(phraseFallback({text:''},{text:Array(25).fill('hello').join(' '),chunks:[{text:'hello',timestamp:[0,2]}]},2)).toBeNull();});
 it('bounds only the final phrase to the actual source end and never fabricates missing boundaries',()=>{expect(phraseFallback({text:'Hi.'},{text:'Hi.',chunks:[{text:'Hi.',timestamp:[0,2]}]},1)?.[0].end).toBe(1);expect(phraseFallback({text:'Hi.'},{text:'Hi.',chunks:[{text:'Hi.',timestamp:[0,null]}]},1)).toBeNull();});
});
