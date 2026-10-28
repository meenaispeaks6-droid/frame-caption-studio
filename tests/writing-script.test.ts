import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGES, readLanguageSettings } from '../src/languages';
import { formatText, formatWords } from '../src/writing-script';

describe('Native and Roman caption writing scripts',()=>{
 const words=[{id:'one',text:'मुझे',start:0,end:.3,emphasis:true},{id:'two',text:'AI',start:.3,end:.5},{id:'three',text:'पसंद',start:.5,end:.9,breakAfter:true}];
 it('defaults old projects to Roman without changing their preferred model',()=>{
  expect(DEFAULT_LANGUAGES.script).toBe('roman');
  expect(readLanguageSettings({spoken:'hindi',caption:'same',model:'small'}).script).toBe('roman');
 });
 it('accepts native script and rejects unsupported script identifiers',()=>{
  expect(readLanguageSettings({spoken:'hindi',caption:'same',model:'base',script:'native'}).script).toBe('native');
  expect(()=>readLanguageSettings({spoken:'hindi',caption:'same',model:'base',script:'unexpected'})).toThrow('Invalid writing script');
 });
 it('preserves Devanagari Unicode, English code-switching and all word timestamps in Native',()=>{
  const output=formatWords(words,'native');
  expect(output).toEqual(words);
  expect(output).not.toBe(words);
  expect(output[0]).not.toBe(words[0]);
  expect(formatText('मुझे AI पसंद है।','native')).toBe('मुझे AI पसंद है।');
 });
 it('keeps legacy Roman behavior and preserved timings',()=>{
  const output=formatWords(words,'roman');
  expect(output.map(x=>x.text)).toEqual(['mujhe','AI','pasand']);
  expect(output.map(({text,...rest})=>rest)).toEqual(words.map(({text,...rest})=>rest));
  expect(formatText('मुझे AI पसंद है।','roman')).toBe('Mujhe AI pasand hai.');
 });
});
