import { env, pipeline } from '@huggingface/transformers';
import { wordsFromChunks, validateWords } from './captions';
import { romanizeWords } from './romanize';
import { readLanguageSettings } from './languages';
import wasmModule from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import wasmBinary from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url';
env.allowLocalModels=false;
env.backends.onnx.wasm!.numThreads=1;
env.backends.onnx.wasm!.wasmPaths={mjs:wasmModule,wasm:wasmBinary};
env.useBrowserCache=true;
// Original integration informed by SeeB4's MIT worker architecture.
// Whisper Web has no explicit code license; none of its source is copied here.
type Chunk={text:string;timestamp:[number|null,number|null]};
type Tokenizer={decode:(tokens:number[],options:Record<string,unknown>)=>string;_decode_asr:(sequences:{tokens:number[]}[],...options:unknown[])=>unknown};
type Asr = ((audio:Float32Array,options:Record<string,unknown>)=>Promise<{text:string;chunks:Chunk[]}>) & {dispose:()=>Promise<void>;tokenizer:Tokenizer};
const createAsr=pipeline as unknown as (task:string,name:string,options:Record<string,unknown>)=>Promise<Asr>;
let modelName='';let transcriber:Asr|undefined;
let busy=false;
self.onmessage=async({data})=>{
 if(data.type!=='transcribe'||busy)return;busy=true;
 try{
  const settings=readLanguageSettings({spoken:data.language??'auto',caption:data.captionLanguage??'same',model:data.model??'base'});
  const name=settings.model==='base'?'Xenova/whisper-base':'Xenova/whisper-tiny';
  if(!transcriber||modelName!==name){
   await transcriber?.dispose();modelName=name;
   transcriber=await createAsr('automatic-speech-recognition',name,{device:'wasm',dtype:'q8',progress_callback:(p:Record<string,unknown>)=>self.postMessage({type:'download',stage:'speech',...p})});
  }
  self.postMessage({type:'ready'});
  // Transformers.js does not currently return Whisper's detected language.
  // Observe its generated language token while leaving alignment decoding intact.
  const tokenizer=transcriber.tokenizer,decode=tokenizer._decode_asr;
  let detectedLanguage:string|undefined;
  tokenizer._decode_asr=function(sequences,...options){
   for(const sequence of sequences){const prefix=this.decode(sequence.tokens.slice(0,8),{skip_special_tokens:false});const code=prefix.match(/<\|([a-z]{2,3})\|>/)?.[1];if(code){detectedLanguage=code;break;}}
   return decode.call(this,sequences,...options);
  };
  let result;
  try{
   result=await transcriber(data.audio,{return_timestamps:'word',chunk_length_s:30,stride_length_s:5,language:['auto','hinglish'].includes(settings.spoken)?undefined:settings.spoken,task:'transcribe',force_full_sequences:false});
  }finally{tokenizer._decode_asr=decode;}
  const duration=Number.isFinite(data.duration)?data.duration:data.audio.length/16000;
  let words=wordsFromChunks(result.chunks??[],duration),translated=false,timingEstimated=false;
  if((result.text.trim()&&!words.length)||words.length<(result.chunks??[]).filter(chunk=>chunk.text.trim()).length)throw new Error('The speech model could not align all recognized words to this recording. Try another speech model, a clearer clip, or import subtitles; your existing captions were kept.');
  if(settings.caption!=='same'&&words.length){
   self.postMessage({type:'stage',label:'Preparing your chosen caption language on this device'});
   await transcriber.dispose();transcriber=undefined;modelName='';
   const {translateWords}=await import('./translate');
   const translation=await translateWords(words,settings.spoken==='auto'?detectedLanguage??'auto':settings.spoken,settings.caption,p=>self.postMessage({type:'download',stage:'translation',...p}));
   words=translation.words;translated=translation.translated;timingEstimated=translation.timingEstimated;
  }
  self.postMessage({type:'stage',label:'Writing captions in Latin script'});
  words=validateWords(romanizeWords(words),duration);
  self.postMessage({type:'done',words,translated,timingEstimated,detectedLanguage,...(data.diagnostics?{sourceText:result.text,sourceChunks:result.chunks}: {})});
 }catch(e){self.postMessage({type:'error',message:(e as Error).message});}
 finally{busy=false;}
};
