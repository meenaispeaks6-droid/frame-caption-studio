import { env, pipeline } from '@huggingface/transformers';
import wasmModule from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import wasmBinary from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url';
env.allowLocalModels=false;
env.backends.onnx.wasm!.numThreads=1;
env.backends.onnx.wasm!.wasmPaths={mjs:wasmModule,wasm:wasmBinary};
env.useBrowserCache=true;
// Original integration informed by SeeB4's MIT worker architecture.
// Whisper Web has no explicit code license; none of its source is copied here.
type Asr = ((audio:Float32Array,options:Record<string,unknown>)=>Promise<unknown>) & {dispose:()=>Promise<void>};
const createAsr=pipeline as unknown as (task:string,name:string,options:Record<string,unknown>)=>Promise<Asr>;
let modelName='';let transcriber:Asr|undefined;
self.onmessage=async({data})=>{
 if(data.type!=='transcribe')return;
 try{
  const name=data.model==='base'?'Xenova/whisper-base':'Xenova/whisper-tiny';
  if(!transcriber||modelName!==name){
   await transcriber?.dispose();modelName=name;
   transcriber=await createAsr('automatic-speech-recognition',name,{device:'wasm',dtype:'q8',progress_callback:(p:Record<string,unknown>)=>self.postMessage({type:'download',...p})});
  }
  self.postMessage({type:'ready'});
  const result=await transcriber(data.audio,{return_timestamps:'word',chunk_length_s:30,stride_length_s:5,language:data.language==='auto'?undefined:data.language,task:'transcribe',force_full_sequences:false});
  self.postMessage({type:'done',result});
 }catch(e){self.postMessage({type:'error',message:(e as Error).message});}
};
