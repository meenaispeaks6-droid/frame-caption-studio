import {it,expect} from 'vitest';
import {speechChoice} from '../src/speech-options';
import {DEFAULT_LANGUAGES,readLanguageSettings} from '../src/languages';
import {shrutiWords,boundedSpeechSpans} from '../src/speech-review';
import {romanizeWords,romanizeText} from '../src/romanize';
import {validateWords} from '../src/captions';
const settings={spoken:'hindi',caption:'same' as const,model:'small' as const,modelPreference:'auto' as const,speechEngine:'auto' as const};
it('selects measured compact Hindi/Hinglish recognition on 2/4/8 GB phones and keeps all manual model choices',()=>{
 for(const memory of [2,4,8,undefined])for(const spoken of ['hindi','hinglish'])for(const accuracyMode of ['fast','accuracy'] as const)expect(speechChoice({...settings,spoken,accuracyMode},true,memory).engine).toBe('shruti');
 for(const model of ['tiny','base','small'] as const)expect(speechChoice({...settings,model,speechEngine:'whisper',modelPreference:'explicit'},true,2)).toMatchObject({engine:'whisper',model});
 expect(speechChoice({...settings,spoken:'french'},true,2).engine).toBe('whisper');
 expect(speechChoice({...settings,spoken:'auto'},true,2).engine).toBe('shruti');
 expect(speechChoice({...settings,spoken:'auto',speechEngine:'shruti'},true,2).engine).toBe('shruti');
});
it('does not automatically load Base on a low-memory phone and preserves old projects',()=>{
 expect(speechChoice({...settings,spoken:'english',accuracyMode:'accuracy'},true,2).engine).toBe('shruti');
 expect(speechChoice({...settings,spoken:'english',accuracyMode:'fast'},true,8).engine).toBe('shruti');
 expect(speechChoice({...settings,spoken:'english',accuracyMode:'accuracy'},true,8)).toMatchObject({engine:'shruti'});
 expect(speechChoice({...settings,spoken:'english',accuracyMode:'accuracy'},false,8).model).toBe('base');
 const old=readLanguageSettings({spoken:'hindi',caption:'same',model:'small'});expect(old.speechEngine).toBe('whisper');expect(old.modelPreference).toBe('explicit');expect(speechChoice(old,true,2).model).toBe('small');
 expect(readLanguageSettings({...settings,speechEngine:undefined}).speechEngine).toBe('shruti');
 expect(()=>readLanguageSettings({...settings,speechEngine:'remote'})).toThrow();
});
it('preserves exact model words, scores, IDs and real word boundaries through romanization and project validation',()=>{
 const source={text:'भाई aaj AI १०',words:[{word:'भाई',start:.2,end:.4,probability:.2},{word:'aaj',start:.4,end:.6,probability:.9},{word:'AI',start:.6,end:.8,probability:.97},{word:'१०',start:.8,end:1,probability:.8}]};
 const aligned=shrutiWords(source,1);const words=validateWords(romanizeWords(aligned),1);expect(words.map(w=>w.text)).toEqual(['Bhai','aaj','AI','10']);expect(words[0].review).toBe('recognition');expect(words[0].confidence).toBe(.2);expect(words[1].review).toBeUndefined();expect(words.map(w=>[w.id,w.start,w.end])).toEqual(aligned.map(w=>[w.id,w.start,w.end]));
});
it('does not discard a zero-duration tail or invent timestamps; labels coalesced timing for review',()=>{
 const words=shrutiWords({text:'यह AI tool है',words:[{word:'यह',start:.1,end:.4},{word:'AI',start:.4,end:.7},{word:'tool',start:.7,end:1},{word:'है',start:1,end:1}]},1);
 expect(words.map(w=>w.text).join(' ')).toBe('यह AI tool है');expect(words.at(-1)).toMatchObject({text:'tool है',start:.7,end:1,timing:'segment',review:'alignment'});expect(validateWords(words,1)).toHaveLength(3);
 expect(()=>shrutiWords({text:'some missing text',words:[{word:'some',start:0,end:1}]},1)).toThrow('retained');
});
it('bounds long inference windows without dropping samples or altering timeline offsets',()=>{
 const audio=new Float32Array(16000*180);const spans=boundedSpeechSpans(audio,[{start:1.25,end:179.9}]);expect(spans[0].start).toBe(1.25);expect(spans.at(-1)!.end).toBe(179.9);for(let i=0;i<spans.length;i++){expect(spans[i].end-spans[i].start).toBeLessThanOrEqual(30);if(i)expect(spans[i].start).toBe(spans[i-1].end);}
});
it('romanizes Hindi candra vowels in everyday English loan words instead of failing the entire result',()=>{
 for(const text of ['ऑफिस','कॉपी','फॉन्ट','फॉर्मेट','लिबरऑफिस','नॉर्स'])expect(romanizeText(text)).toMatch(/^[A-Za-z]+$/);
 expect(romanizeText('AI GPT-4o और १०')).toBe('AI GPT-4o aur 10');
});

it('defaults fresh and automatic projects to Shruti in either mode and retains explicit Whisper and other languages',()=>{
 expect(DEFAULT_LANGUAGES.speechEngine).toBe('shruti');
 for(const accuracyMode of ['fast','accuracy'] as const)expect(speechChoice({...readLanguageSettings(undefined),accuracyMode},true,2).engine).toBe('shruti');
 expect(readLanguageSettings({spoken:'auto',caption:'same',model:'tiny',modelPreference:'auto'}).speechEngine).toBe('shruti');
 expect(speechChoice({...DEFAULT_LANGUAGES,spoken:'french'},true,2).engine).toBe('whisper');
 expect(speechChoice({...DEFAULT_LANGUAGES,speechEngine:'whisper',model:'base'},true,2)).toMatchObject({engine:'whisper',model:'base'});
});
