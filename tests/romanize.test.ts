import {describe,it,expect} from 'vitest';
import {romanizeText,romanizeWords} from '../src/romanize';

describe('Latin-script captions without translation',()=>{
 it('romanizes the Hindi acceptance example without translating words',()=>{
  expect(romanizeText('आज मैं तुम्हें एक कमाल की ट्रिक बताने वाला हूँ।')).toBe('Aaj main tumhe ek kamaal ki trick batane wala hoon.');
 });
 it('preserves the Hindi and English mixture, brand spelling, and word order',()=>{
  expect(romanizeText('Guys आज मैं तुम्हें एक amazing AI tool दिखाने वाला हूँ।')).toBe('Guys aaj main tumhe ek amazing AI tool dikhane wala hoon.');
  expect(romanizeText('मुझे आज एक नया AI tool मिला है।')).toBe('Mujhe aaj ek naya AI tool mila hai.');
 });
 it('preserves ASCII English text and technical brand casing exactly',()=>{
  const text='This AI tool is absolutely crazy. ChatGPT, OpenAI, GPT-4o and ElevenLabs!';
  expect(romanizeText(text)).toBe(text);
 });
 it('keeps familiar spellings for English technical words written in Hindi',()=>{
  expect(romanizeText('एआई टूल चैटजीपीटी ओपनएआई गूगल वीडियो')).toBe('AI tool ChatGPT OpenAI Google video');
 });
 it('uses Hindi schwa deletion without collapsing invalid consonant clusters',()=>{
  expect(romanizeText('सरकार कमरा रखता समर्थन अलग')).toBe('Sarkaar kamraa rakhtaa samarthan alag');
 });
 it('supports composed/decomposed nukta and natural punctuation',()=>{
  expect(romanizeText('फ़िल्म और फ़िल्म।')).toBe('Film aur film.');
  expect(romanizeText('ज़्यादा ज़्यादा')).toBe('Zyada zyada');
 });
 it('romanizes other scripts into Latin letters without inserting translations',()=>{
  for(const text of ['Привет мир','مرحبا بالعالم','你好','こんにちは','안녕하세요','தமிழ்']){
   const result=romanizeText(text);expect(result.trim()).not.toBe('');expect(result).not.toMatch(/[^A-Za-z\P{L}]/u);
  }
 });
 it('preserves every word id, timing, emphasis and manual phrase boundary',()=>{
  const input=[{id:'a',text:'आज',start:.1,end:.4,emphasis:true},{id:'b',text:'AI',start:.4,end:.6,breakAfter:true},{id:'c',text:'मिला',start:.6,end:1},{id:'d',text:'है।',start:1,end:1.3}];
  const result=romanizeWords(input);expect(result.map(w=>w.text)).toEqual(['Aaj','AI','mila','hai.']);
  expect(result.map(({text,...word})=>word)).toEqual(input.map(({text,...word})=>word));expect(input[0].text).toBe('आज');
 });
 it('preserves existing English case while capitalizing romanized sentence starts',()=>{
  expect(romanizeWords([{text:'आज'},{text:'है।'},{text:'मुझे'},{text:'OpenAI'}]).map(w=>w.text)).toEqual(['Aaj','hai.','Mujhe','OpenAI']);
 });
 it('removes Latin diacritics without changing the existing name case',()=>{
  expect(romanizeText('éBay, café.')).toBe('eBay, cafe.');
 });
 it('fails visibly when an unmapped spoken letter would be lost',()=>{
  expect(()=>romanizeText(String.fromCodePoint(0x323af))).toThrow('cannot be romanized');
 });
});
