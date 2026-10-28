import { describe, it, expect, vi } from 'vitest';
vi.mock('@huggingface/transformers',()=>({env:{backends:{onnx:{wasm:{}}}},pipeline:vi.fn()}));
import { pipeline } from '@huggingface/transformers';
import { estimateTranslatedWords, restoreTechnicalTerms, translateWords, disposeTranslator } from '../src/translate';

const source=[{id:'a',text:'यह',start:1.25,end:1.7},{id:'b',text:'AI',start:1.7,end:2},{id:'c',text:'है।',start:2.1,end:2.8}];
describe('explicit local translation',()=>{
 it('does not call a translation model when the target matches the spoken language',async()=>{
  const result=await translateWords(source,'hi','hindi');
  expect(result.words).toBe(source);expect(result.translated).toBe(false);expect(result.timingEstimated).toBe(false);expect(pipeline).not.toHaveBeenCalled();
 });
 it('retains the original sentence window for translated words without claiming acoustic alignment',()=>{
  const words=estimateTranslatedWords('This is an AI tool.',source);
  expect(words.map(w=>w.text)).toEqual(['This','is','an','AI','tool.']);
  expect(words[0].start).toBe(1.25);expect(words.at(-1)?.end).toBe(2.8);
  expect(words.every((word,i)=>word.end>word.start&&(!i||word.start===words[i-1].end))).toBe(true);
  expect(words.at(-1)?.breakAfter).toBe(true);
 });
 it('restores the original English spelling of known AI brands and technical terms',()=>{
  expect(restoreTechnicalTerms('यह एआई टूल चैटजीपीटी और ओपन एआई के साथ काम करता है।','This AI tool uses ChatGPT and OpenAI.')).toBe('यह AI टूल ChatGPT और OpenAI के साथ काम करता है।');
  expect(restoreTechnicalTerms('openai and youtube','OpenAI and YouTube')).toBe('OpenAI and YouTube');
 });
 it('fails clearly before model loading when a language has no local translation model',async()=>{
  await expect(translateWords(source,'telugu','english')).rejects.toThrow('Same as Spoken Language');
 });

 it('translates Hindi and Hinglish to English only when explicitly requested',async()=>{
  const translator=Object.assign(vi.fn(async()=>[{translation_text:'This is an AI tool.'}]),{dispose:vi.fn(async()=>{})});
  vi.mocked(pipeline).mockResolvedValueOnce(translator as never);
  try{
   for(const language of ['hindi','hinglish']){
    const result=await translateWords(source,language,'english');
    expect(result.words.map(w=>w.text).join(' ')).toBe('This is an AI tool.');
    expect(result.translated).toBe(true);expect(result.timingEstimated).toBe(true);
    expect(result.words[0].start).toBe(source[0].start);expect(result.words.at(-1)!.end).toBe(source.at(-1)!.end);
   }
   expect(translator).toHaveBeenCalledWith('यह AI है।',{src_lang:'hi',tgt_lang:'en',max_new_tokens:192,num_beams:1,do_sample:false});
  }finally{await disposeTranslator();vi.mocked(pipeline).mockReset();}
 });
});
