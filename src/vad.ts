import * as ort from 'frame-vad-ort';
import {SileroLegacy} from '@ricky0123/vad-web/dist/models/legacy';
import modelUrl from '@ricky0123/vad-web/dist/silero_vad_legacy.onnx?url';
import wasmModule from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import wasmBinary from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import {speechSpans,type SpeechSpan} from './audio-processing';
/** Silero voice probabilities with generous context; original source times stay
 * intact. Uncertain detection never removes all quiet speech. */
export async function detectSpeech(audio:Float32Array,onProgress:(p:number)=>void){
 ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths={mjs:wasmModule,wasm:wasmBinary};
 const model=await SileroLegacy.new(ort,async()=>{const r=await fetch(modelUrl);if(!r.ok)throw Error('Speech detector could not load');return r.arrayBuffer();});
 const frame=1536,spans:SpeechSpan[]=[];let speechFrames=0,maxSpeechProbability=0;
 try{for(let pos=0;pos<audio.length;pos+=frame){const input=new Float32Array(frame);input.set(audio.subarray(pos,pos+frame));const p=(await model.process(input)).isSpeech;maxSpeechProbability=Math.max(maxSpeechProbability,p);
  if(p>=.2){speechFrames++;const start=Math.max(0,pos/16000-.5),end=Math.min(audio.length/16000,(pos+frame)/16000+.5),previous=spans.at(-1);if(previous&&start-previous.end<.8)previous.end=end;else spans.push({start,end});}
  if(pos%(frame*20)===0)onProgress(pos/audio.length*100);
 }}finally{await model.release();}
 onProgress(100);return {spans:spans.length?spans:speechSpans(audio),speechFrames,maxSpeechProbability,uncertain:!spans.length};
}
