import { env, pipeline } from '@huggingface/transformers';
import wasmModule from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import wasmBinary from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import type { Word } from './types';

// ONNX conversion of Facebook's MIT-licensed M2M100-418M weights.
// Models download on demand; text is processed locally by ONNX WASM.
export const TRANSLATION_MODEL='Xenova/m2m100_418M';
export const TRANSLATION_DOWNLOAD_BYTES=631984548;
env.allowLocalModels=false;
env.useBrowserCache=true;
env.backends.onnx.wasm!.numThreads=1;
env.backends.onnx.wasm!.wasmPaths={mjs:wasmModule,wasm:wasmBinary};

type Progress = (value:Record<string,unknown>)=>void;
type Translator = ((text:string,options?:Record<string,unknown>)=>Promise<{translation_text:string}[]>) & {dispose:()=>Promise<void>};
const createPipeline=pipeline as unknown as (task:string,model:string,options:Record<string,unknown>)=>Promise<Translator>;
let loaded:{name:string;pipeline:Translator}|undefined;

async function translateText(text:string,source:string,target:string,onProgress:Progress){
 const name=TRANSLATION_MODEL;
 if(loaded?.name!==name){
  await loaded?.pipeline.dispose();loaded=undefined;
  const translator=await createPipeline('translation',name,{device:'wasm',dtype:'q8',progress_callback:onProgress});
  loaded={name,pipeline:translator};
 }
 const output=await loaded.pipeline(text,{src_lang:source,tgt_lang:target,max_new_tokens:192,num_beams:1,do_sample:false});
 const translated=output[0]?.translation_text?.trim();
 if(!translated)throw new Error('The local translation model returned no text. Try a shorter phrase or keep the spoken language.');
 return translated;
}

const aliases:Record<string,string[]>={
 AI:['एआई','ए आइ','ए आई','ए.आई.'],GPT:['जीपीटी','जी पी टी'],ChatGPT:['चैटजीपीटी','चैट जीपीटी','चैट GPT'],
 OpenAI:['ओपनएआई','ओपन एआई','ओपन AI'],YouTube:['यूट्यूब','यू ट्यूब'],Google:['गूगल'],
 Instagram:['इंस्टाग्राम'],GitHub:['गिटहब','गिट हब'],Microsoft:['माइक्रोसॉफ्ट','माइक्रोसॉफ़्ट'],
 Gemini:['जेमिनी'],Claude:['क्लॉड'],Canva:['कैनवा'],CapCut:['कैपकट','कैप कट'],
 Photoshop:['फोटोशॉप','फ़ोटोशॉप'],Figma:['फिग्मा','फ़िग्मा'],Notion:['नोशन'],
 API:['एपीआई','ए पी आई'],HTML:['एचटीएमएल'],CSS:['सीएसएस'],JavaScript:['जावास्क्रिप्ट'],
 Python:['पायथन'],Whisper:['व्हिस्पर'],Midjourney:['मिडजर्नी','मिड जर्नी'],
};
const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

/** Restore known technical names without translating surrounding words. */
export function restoreTechnicalTerms(text:string,source:string){
 let result=text;
 for(const [canonical,spellings] of Object.entries(aliases)){
  const original=source.match(new RegExp(`\\b${escapeRegExp(canonical)}\\b`,'i'))?.[0];
  if(!original&&!spellings.some(spelling=>source.includes(spelling)))continue;
  const name=original??canonical;
  for(const spelling of [...spellings].sort((a,b)=>b.length-a.length))result=result.replaceAll(spelling,name);
  result=result.replace(new RegExp(`\\b${escapeRegExp(canonical)}\\b`,'gi'),name);
 }
 // Models normally keep unknown English names; preserve their original case.
 for(const token of source.match(/\b(?:[A-Z]{2,}[A-Za-z0-9]*|[A-Za-z]+[A-Z][A-Za-z0-9]*)\b/g)??[])
  result=result.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`,'gi'),token);
 return result;
}

/** Translation has no acoustic alignment: retain sentence bounds, estimate words. */
export function estimateTranslatedWords(text:string,source:Word[]):Word[]{
 const tokens=text.trim().split(/\s+/u).filter(Boolean);
 if(!tokens.length||!source.length)return [];
 const start=source[0].start,end=source.at(-1)!.end;
 const weights=tokens.map(token=>Math.max(1,Array.from(token.replace(/[^\p{L}\p{N}]/gu,'')).length));
 const total=weights.reduce((sum,n)=>sum+n,0);let offset=0;
 return tokens.map((token,i)=>{
  const a=start+(end-start)*offset/total;offset+=weights[i];
  return {id:crypto.randomUUID(),text:token,start:a,end:i===tokens.length-1?end:start+(end-start)*offset/total,breakAfter:i===tokens.length-1};
 });
}

function sentenceGroups(words:Word[]){
 const groups:Word[][]=[];let group:Word[]=[];
 for(const word of words){
  if(group.length&&(word.start-group.at(-1)!.end>.7||group.length>=36||word.end-group[0].start>14)){groups.push(group);group=[];}
  group.push(word);
  if(/[.!?।]$/.test(word.text)||word.breakAfter){groups.push(group);group=[];}
 }
 if(group.length)groups.push(group);
 return groups;
}

const languageCodes:Record<string,string>={english:'en',hindi:'hi',hinglish:'hi',arabic:'ar',bengali:'bn',chinese:'zh',dutch:'nl',french:'fr',german:'de',greek:'el',gujarati:'gu',hebrew:'he',indonesian:'id',italian:'it',japanese:'ja',kannada:'kn',korean:'ko',malay:'ms',malayalam:'ml',marathi:'mr',nepali:'ne',persian:'fa',polish:'pl',portuguese:'pt',punjabi:'pa',romanian:'ro',russian:'ru',spanish:'es',swedish:'sv',tamil:'ta',telugu:'te',thai:'th',turkish:'tr',ukrainian:'uk',urdu:'ur',vietnamese:'vi',javanese:'jv',jw:'jv'};
const supported=new Set('af am ar ast az ba be bg bn br bs ca ceb cs cy da de el en es et fa ff fi fr fy ga gd gl gu ha he hi hr ht hu hy id ig ilo is it ja jv ka kk km kn ko lb lg ln lo lt lv mg mk ml mn mr ms my ne nl no ns oc or pa pl ps pt ro ru sd si sk sl so sq sr ss su sv sw ta th tl tn tr uk ur uz vi wo xh yi yo zh zu'.split(' '));
function sourceName(source:string,text:string){
 const value=source.toLowerCase();
 if(value!=='auto')return languageCodes[value]??value;
 // The worker provides the detected Whisper language for auto-detection. This
 // fallback covers Hindi/English when older project data has no language code.
 if(/\p{Script=Devanagari}/u.test(text))return 'hi';
 if(/\p{Script=Arabic}/u.test(text))return 'ar';
 if(/\p{Script=Han}/u.test(text))return 'zh';
 if(/\p{Script=Cyrillic}/u.test(text))return 'ru';
 if(/\p{Script=Greek}/u.test(text))return 'el';
 return 'en';
}

export async function translateWords(words:Word[],sourceLanguage:string,targetLanguage:'english'|'hindi'|'hinglish',onProgress:Progress=()=>{}){
 const target=targetLanguage==='english'?'en':'hi';
 const source=sourceName(sourceLanguage,words.map(word=>word.text).join(' '));
 const normalizeMixedHindi=sourceLanguage.toLowerCase()==='hinglish'&&targetLanguage==='hindi';
 if((source===target&&!normalizeMixedHindi)||!words.length)return {words,translated:false,timingEstimated:false,models:[] as string[]};
 if(!supported.has(source))throw new Error(`Local translation is unavailable for ${sourceLanguage}. Select Same as Spoken Language to transcribe and romanize it instead.`);
 const groups=sentenceGroups(words),translated:Word[]=[];
 for(let i=0;i<groups.length;i++){
  onProgress({status:'translating',completed:i,total:groups.length});
  const original=groups[i].map(word=>word.text).join(' ');
  let text=normalizeMixedHindi?await translateText(original,'hi','en',onProgress):original;
  text=await translateText(text,normalizeMixedHindi?'en':source,target,onProgress);
  translated.push(...estimateTranslatedWords(restoreTechnicalTerms(text,original),groups[i]));
 }
 return {words:translated,translated:true,timingEstimated:true,models:[TRANSLATION_MODEL]};
}

export async function disposeTranslator(){await loaded?.pipeline.dispose();loaded=undefined;}
