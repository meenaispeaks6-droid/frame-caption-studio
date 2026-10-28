import createNeedle, {type Needle} from './vendor/needle/needle.js';
import wasmUrl from './vendor/needle/needle.wasm?url';
export const SHRUTI_MODEL={revision:'ebf52e614065ce20e56affdab641f749a04511a5',bytes:29546527,sha256:'b189e954aaed4a9fd41acbad3ac05e486381e96325b22a4c695b9ea5153d7065'};
export const SHRUTI_URL=`https://huggingface.co/udgamlabs/Shruti/resolve/${SHRUTI_MODEL.revision}/shruti.cact`;
export interface ShrutiResult {text:string;language?:string;words?:{word:string;start:number;end:number;probability?:number}[]}
async function checked(buffer:ArrayBuffer){
 if(buffer.byteLength!==SHRUTI_MODEL.bytes)throw Error('The local speech model is incomplete. Retry its download.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');
 if(digest!==SHRUTI_MODEL.sha256)throw Error('Speech model verification failed. Retry its download.');
 return buffer;
}
async function modelBytes(progress:(percent:number)=>void){
 let cache:Cache|undefined;try{cache=await caches.open('frame-shruti-v1');}catch{/* Private storage can be unavailable. */}
 let hit:Response|undefined;try{hit=await cache?.match(SHRUTI_URL);}catch{cache=undefined;}
 if(hit){try{return await checked(await hit.arrayBuffer());}catch{try{await cache?.delete(SHRUTI_URL);}catch{cache=undefined;}}}
 const response=await fetch(SHRUTI_URL,{credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok||!response.body)throw Error('The Shruti model could not download. Check your connection and retry.');
 // One allocation, with an explicit bound. No array of retained network chunks.
 const bytes=new Uint8Array(SHRUTI_MODEL.bytes),reader=response.body.getReader();let offset=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;if(offset+value.byteLength>bytes.length)throw Error('Speech model download exceeded its expected size.');bytes.set(value,offset);offset+=value.length;progress(offset/bytes.length*100);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 if(offset!==bytes.length)throw Error('The speech model download was incomplete. Retry when the connection is stable.');
 await checked(bytes.buffer);try{await cache?.put(SHRUTI_URL,new Response(bytes,{headers:{'content-type':'application/octet-stream'}}));}catch{/* Storage failure does not prevent local inference. */}
 return bytes.buffer;
}
export async function loadShruti(progress:(percent:number)=>void){
 const response=await fetch(wasmUrl);if(!response.ok)throw Error('The local Shruti runtime could not load. Reload the app.');
 const engine=await createNeedle({wasmBinary:await response.arrayBuffer(),print:()=>{},printErr:()=>{}});
 const bytes=new Uint8Array(await modelBytes(progress));let pointer=0;
 try{pointer=allocate(engine,bytes.byteLength);engine.HEAPU8.set(bytes,pointer);if(engine._needle_load(pointer,BigInt(bytes.byteLength))<0||!(engine._needle_models()&2))throw Error('The local speech model could not initialize. Retry after closing other tabs.');}
 finally{if(pointer)engine._free(pointer);}
 return engine;
}
function allocate(engine:Needle,size:number){const ptr=engine._malloc(Math.max(4,size));if(!ptr)throw Error('Speech processing ran out of memory. Close other tabs and use a shorter selection.');return ptr;}
/** Native CTC word alignment; the caller handles degenerate alignment honestly. */
export function recognizeShruti(engine:Needle,audio:Float32Array,language:string):ShrutiResult{
 let input=0,lang=0,output=0;const capacity=Math.max(65536,Math.ceil(audio.length/16000)*4096+16384);
 try{
  input=allocate(engine,audio.byteLength);engine.HEAPU8.set(new Uint8Array(audio.buffer,audio.byteOffset,audio.byteLength),input);
  if(language==='english'){const bytes=new TextEncoder().encode('en\0');lang=allocate(engine,bytes.length);engine.HEAPU8.set(bytes,lang);}
  output=allocate(engine,capacity);
  if(engine._needle_transcribe(input,audio.length,lang,0,1,output,capacity)<0)throw Error('Local speech recognition failed. Retry original audio or another model.');
  return JSON.parse(engine.UTF8ToString(output)) as ShrutiResult;
 }finally{if(input)engine._free(input);if(lang)engine._free(lang);if(output)engine._free(output);}
}
