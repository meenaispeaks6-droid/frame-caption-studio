import { StreamTarget, Output, Mp4OutputFormat, WebMOutputFormat } from 'mediabunny';
const directory='frame-exports';
export async function removeExport(name?:string){if(!name)return;try{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle(directory);await dir.removeEntry(name);}catch{}}
export async function cleanExports(){try{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle(directory);for await(const [name,handle] of (dir as any).entries()){if(handle.kind==='file'&&Date.now()-(await handle.getFile()).lastModified>86400000){if(navigator.locks)await navigator.locks.request('frame-export:'+name,{ifAvailable:true},async lock=>{if(lock)await removeExport(name);});}}}catch{}}
export async function exportStorage(format:'mp4'|'webm'){
 if(!navigator.storage?.getDirectory)return null;
 let dir:FileSystemDirectoryHandle;try{dir=await(await navigator.storage.getDirectory()).getDirectoryHandle(directory,{create:true});}catch(e){if(['NotSupportedError','SecurityError'].includes((e as Error).name))return null;throw e;}
 const name=crypto.randomUUID();let unlock=()=>{};if(navigator.locks)await new Promise<void>(resolve=>{void navigator.locks.request('frame-export:'+name,()=>new Promise<void>(release=>{unlock=release;resolve();}));});
 try{const handle=await dir.getFileHandle(name,{create:true});
 const writer=await handle.createWritable();
 const stream=new WritableStream({write:async(chunk:{data:Uint8Array;position:number})=>{await writer.write({type:'write',position:chunk.position,data:chunk.data as Uint8Array<ArrayBuffer>});},close:()=>writer.close(),abort:()=>writer.abort()});
 return {name,builder:{build(){const target=new StreamTarget(stream,{chunked:true,chunkSize:1048576});return {target:null,format:format==='mp4'?new Mp4OutputFormat():new WebMOutputFormat(),output:new Output({format:format==='mp4'?new Mp4OutputFormat():new WebMOutputFormat(),target})};}},file:async()=>{const file=await handle.getFile();unlock();return file;},abort:async()=>{unlock();await writer.abort().catch(()=>{});await removeExport(name);}};
 }catch(e){unlock();await removeExport(name);throw e;}
}
