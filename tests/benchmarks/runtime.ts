// Candidate probe only. Unsupported candidate engines are never offered by UI.
import {env,pipeline} from '@huggingface/transformers';
import * as ort from 'frame-vad-ort';
export async function whisperCandidate(name:string){
 env.allowLocalModels=false;env.useBrowserCache=false;env.remoteHost=location.origin+'/__hf/';
 env.backends.onnx.wasm!.numThreads=1;env.backends.onnx.wasm!.wasmPaths={mjs:'/node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs',wasm:'/node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm'};
 const asr=await pipeline('automatic-speech-recognition',name,{device:'wasm',dtype:name==='apex'?'q4':'q8'});
 const generate=asr.model.generate.bind(asr.model);asr.model.generate=(options:any)=>generate({...options,return_timestamps:options.return_token_timestamps?true:options.return_timestamps});
 return async(audio:Float32Array,language:string)=>asr(audio,{language:language==='english'?'english':'hindi',task:'transcribe',return_timestamps:name==='apex'?true:'word',chunk_length_s:30,stride_length_s:5});
}
export async function indicCompatibility(){
 ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths={mjs:'/node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs',wasm:'/node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm'};
 const session=await ort.InferenceSession.create('/__fixtures/indic-hi.onnx',{executionProviders:['wasm']});
 // This conversion currently fails creation with unsupported ConvInteger(10).
 const names={inputs:session.inputNames,outputs:session.outputNames};await session.release();return names;
}
