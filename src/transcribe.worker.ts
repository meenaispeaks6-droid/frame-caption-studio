import { env, pipeline } from '@huggingface/transformers';
import { validateWords } from './captions';
import { romanizeWords } from './romanize';
import { readLanguageSettings } from './languages';
import { analyzeAudio, enhanceSpeech, speechSpans } from './audio-processing';
import { reliableWords, phraseFallback, repetitive, type SpeechResult } from './recognition';
import type { Word } from './types';
import { detectSpeech } from './vad';
import wasmModule from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import wasmBinary from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url';
env.allowLocalModels=false;
env.backends.onnx.wasm!.numThreads=1;
env.backends.onnx.wasm!.wasmPaths={mjs:wasmModule,wasm:wasmBinary};
env.useBrowserCache=true;
// Original integration informed by SeeB4's MIT worker architecture.
// Whisper Web has no explicit code license; none of its source is copied here.
type Chunk={text:string;timestamp:[number|null,number|null]};
type Tokenizer={_decode_asr:(chunks:unknown[],options:Record<string,unknown>)=>[string,{chunks?:Chunk[]}];decode:(tokens:number[],options:Record<string,unknown>)=>string};
type Asr = ((audio:Float32Array,options:Record<string,unknown>)=>Promise<{text:string;chunks:Chunk[]}>) & {dispose:()=>Promise<void>;tokenizer:Tokenizer;processor:(audio:Float32Array)=>Promise<{input_features:unknown}>;model:{generate:(options:Record<string,unknown>)=>Promise<unknown>}};
const createAsr=pipeline as unknown as (task:string,name:string,options:Record<string,unknown>)=>Promise<Asr>;
let modelName='';let transcriber:Asr|undefined;
let busy=false;
self.onmessage=async({data})=>{
 if(data.type!=='transcribe'||busy)return;busy=true;let recoveredText='';
 try{
  const settings=readLanguageSettings({spoken:data.language??'auto',caption:data.captionLanguage??'same',model:data.model??'small',audioMode:data.audioMode??'original'});
  self.postMessage({type:'stage',label:'Analyzing original audio and quiet intervals'});
  const original=data.audio as Float32Array,duration=original.length/16000;
  const report=analyzeAudio(original);self.postMessage({type:'analysis',report});
  let prepared=original;const warnings:string[]=[];
  if(settings.audioMode&&settings.audioMode!=='original'){
   self.postMessage({type:'stage',label:'Applying optional speech filtering'});
   try{prepared=enhanceSpeech(original,settings.audioMode,data.stereo);}catch(e){warnings.push((e as Error).message);prepared=original;}
  }
  report.processing=prepared===original?'original':settings.audioMode;
  let spans=speechSpans(original);
  if(spans.length){self.postMessage({type:'stage',label:'Detecting speech with the local voice model'});try{const detected=await detectSpeech(original,p=>self.postMessage({type:'vad-progress',progress:p}));spans=detected.spans;report.voiceDetection={model:'silero',regions:spans.length,uncertain:detected.uncertain,maxProbability:detected.maxSpeechProbability};if(detected.uncertain)warnings.push('Voice detection was uncertain; quiet sound regions were retained.');}catch{warnings.push('Voice detector unavailable; conservative silence segmentation was used.');}}
  const rawResults:SpeechResult[]=[];
  let words:Word[]=[],translated=false,timingEstimated=false,detectedLanguage:string|undefined,usedPhraseTiming=false,draftTranscript='';
  if(!spans.length){self.postMessage({type:'done',words:[],translated:false,timingEstimated:false,audioReport:report});return;}
  const name=`Xenova/whisper-${settings.model}`;
  if(!transcriber||modelName!==name){
   await transcriber?.dispose();transcriber=undefined;modelName='';
   transcriber=await createAsr('automatic-speech-recognition',name,{device:'wasm',dtype:'q8',progress_callback:(p:Record<string,unknown>)=>self.postMessage({type:'download',stage:'speech',...p})});modelName=name;
  }
  if(['auto','hinglish'].includes(settings.spoken)){
   self.postMessage({type:'stage',label:'Detecting spoken language from original speech'});
   const span=spans[0],probe=original.subarray(Math.round(span.start*16000),Math.min(original.length,Math.round(span.start*16000)+480000));
   const features=await transcriber.processor(probe);
   const prediction=await transcriber.model.generate({inputs:features.input_features,decoder_input_ids:[50258],max_new_tokens:1,return_timestamps:false,suppress_tokens:[],begin_suppress_tokens:[]}) as {tolist:()=>number[][]};
   detectedLanguage=transcriber.tokenizer.decode(prediction.tolist()[0],{skip_special_tokens:false}).match(/<\|([a-z]{2,3})\|>/)?.[1];
   if(!detectedLanguage)throw Error('Language could not be detected reliably. Select the spoken language manually and retry.');
  }
  const generate=transcriber.model.generate,model=transcriber.model;
  const tokenizer=transcriber.tokenizer,decode=tokenizer._decode_asr;let segmentResult:SpeechResult|undefined;
  // Decode real timestamp tokens from the same generation, retaining chunk strides.
  // This is text decoding only: it avoids a second acoustic inference for fallback.
  tokenizer._decode_asr=(chunks,options)=>{if(options.return_timestamps==='word'){try{const [text,extra]=decode.call(tokenizer,chunks,{...options,return_timestamps:true});segmentResult={text,...extra};}catch{segmentResult=undefined;}}return decode.call(tokenizer,chunks,options);};
  // Keep Whisper's timestamp-token constraints while computing cross-attention
  // word alignment. The library's word pipeline otherwise disables them, which
  // produced repetitions and out-of-range word times on Hindi recordings.
  model.generate=options=>generate.call(model,{...options,return_timestamps:options.return_token_timestamps?true:options.return_timestamps});
  try{
   for(let i=0;i<spans.length;i++){
    const span=spans[i],begin=Math.round(span.start*16000),finish=Math.round(span.end*16000),localDuration=(finish-begin)/16000;
    const run=async(audio:Float32Array,timestamps:'word'|true)=>{segmentResult=undefined;return await transcriber!(audio.subarray(begin,finish),{return_timestamps:timestamps,chunk_length_s:30,stride_length_s:5,language:detectedLanguage??settings.spoken,task:'transcribe',force_full_sequences:false});};
    self.postMessage({type:'stage',label:`Listening on your device · speech region ${i+1} of ${spans.length}`});
    let primary:SpeechResult;try{primary=await run(prepared,'word');}catch{primary={text:''};warnings.push('Word timing was unavailable; phrase timing was requested.');}rawResults.push(primary);recoveredText=rawResults.map(r=>r.text).filter(Boolean).join('\n');let aligned=!primary.text.trim()||repetitive(primary.text)?null:reliableWords(primary,localDuration);
    if(!aligned&&prepared!==original){self.postMessage({type:'stage',label:'Retrying original audio to protect speech clarity'});primary=await run(original,'word');rawResults.push(primary);aligned=!primary.text.trim()||repetitive(primary.text)?null:reliableWords(primary,localDuration);}
    if(!aligned){
     self.postMessage({type:'stage',label:'Recovering real phrase timestamps; preserving recognized text'});
     const segmented=segmentResult??await run(original,true);rawResults.push(segmented);recoveredText=rawResults.map(r=>r.text).filter(Boolean).join('\n');aligned=phraseFallback(primary,segmented,localDuration);
     if(!aligned){draftTranscript=[...words.map(w=>w.text),primary.text.trim()&&!repetitive(primary.text)?primary.text:segmented.text].filter(Boolean).join('\n');throw Error('Speech was recognized, but reliable timing could not be recovered. The transcript is kept below for manual correction. Try another model or original audio.');}
     usedPhraseTiming=true;
    }
    words.push(...aligned.map(word=>({...word,start:word.start+begin/16000,end:word.end+begin/16000})));
   }
  }catch(e){self.postMessage({type:'error',message:(e as Error).message,draftTranscript:draftTranscript||rawResults.map(r=>r.text).filter(Boolean).join('\n')});return;}
  finally{model.generate=generate;tokenizer._decode_asr=decode;}
  if(settings.caption!=='same'&&words.length){
   self.postMessage({type:'recognized',words,sourceLanguage:settings.spoken==='auto'?detectedLanguage??'auto':settings.spoken,targetLanguage:settings.caption,translated,timingEstimated,detectedLanguage,usedPhraseTiming,audioReport:report,warnings});return;
  }
  self.postMessage({type:'stage',label:'Writing captions in Latin script'});
  words=validateWords(romanizeWords(words),duration);
  self.postMessage({type:'done',words,translated,timingEstimated,detectedLanguage,usedPhraseTiming,audioReport:report,warnings,...(data.diagnostics?{sourceResults:rawResults}: {})});
 }catch(e){self.postMessage({type:'error',message:(e as Error).message,draftTranscript:recoveredText||undefined});}
 finally{busy=false;}
};
