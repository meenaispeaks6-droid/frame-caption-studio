import type {LanguageSettings} from './types';
/** Recommendations are scoped to the measured Hindi/Hinglish/English engines.
 * Shruti is the default for Hindi/English auto detection. Other selected
 * languages use multilingual Whisper; explicit Whisper choices survive. */
export function speechChoice(settings:LanguageSettings,constrained:boolean,memory?:number){
 const mode=settings.accuracyMode??'fast',engine=settings.speechEngine??'whisper';
 const supported=['hindi','hinglish','english'].includes(settings.spoken);
 const shruti=(engine==='shruti'&&(supported||settings.spoken==='auto'))||(engine==='auto'&&(supported||settings.spoken==='auto'));
 const model=engine==='whisper'||settings.modelPreference==='explicit'?settings.model:mode==='accuracy'&&(!constrained||(memory!==undefined&&memory>=8))?'base':'tiny';
 return {engine:shruti?'shruti':'whisper',model,label:shruti?'Shruti · 30 MB':`Whisper ${model==='tiny'?'Tiny':model==='base'?'Base':'Small'}`,voiceDetection:mode==='accuracy',warning:shruti&&settings.spoken==='auto'?'Shruti auto-detects Hindi/English; use Whisper for other languages.':engine==='shruti'&&!supported?'This spoken language uses multilingual Whisper. Shruti supports Hindi, Hinglish and English.':(!shruti&&constrained&&(engine==='whisper'?settings.model:model)==='small'?'Whisper Small needs substantially more memory. Shruti is recommended for Hindi/Hinglish on phones.':'')};
}
/** Explicit runtime checks, rather than treating model file size as a memory
 * guarantee. A reported RAM value cannot predict free Android tab memory. */
export function localSpeechProblem(){
 if(typeof Worker==='undefined'||typeof WebAssembly==='undefined')return 'Local speech needs Web Workers and WebAssembly. Use current Chrome, or import SRT/VTT captions.';
 if(!globalThis.crypto?.subtle)return 'Local model verification needs HTTPS or localhost. Open the secure app URL, or import SRT/VTT captions.';
 return '';
}
