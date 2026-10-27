type Message=Record<string,any>;
/** One job at a time, bounded result cache, and an idle model lifetime. */
export class SpeechClient {
 private worker:Worker|null=null;
 private cache=new Map<string,Message>();
 private files=new WeakMap<File,number>();private sequence=0;
 private active:{reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}|null=null;
 private idle:ReturnType<typeof setTimeout>|undefined;
 constructor(private factory=()=>new Worker(new URL('./transcribe.worker.ts',import.meta.url),{type:'module'}),private timeoutMs=15*60*1000,private idleMs=30000){}
 async run(file:File,settings:object,prepare:()=>Promise<Message>,onMessage:(data:Message)=>void){
  if(this.active)throw Error('Caption generation is already running.');
  if(!this.files.has(file))this.files.set(file,++this.sequence);
  const key=JSON.stringify([this.files.get(file),settings]);const cached=this.cache.get(key);
  if(cached){onMessage({...structuredClone(cached),cacheHit:true});return;}
  clearTimeout(this.idle);
  await new Promise<void>((resolve,reject)=>{
   const job={reject,timer:setTimeout(()=>{this.cancel();onMessage({type:'error',message:'Caption generation exceeded the device time limit. Try a shorter clip or a smaller speech model.'});},this.timeoutMs)};
   this.active=job;
   const finish=()=>{clearTimeout(job.timer);this.active=null;this.idle=setTimeout(()=>this.release(),this.idleMs);resolve();};
   void prepare().then(payload=>{
    if(this.active!==job)return;
    const worker=this.worker??=this.factory();
    worker.onmessage=({data})=>{
     if(this.active!==job)return;
     if(data.type==='done'){this.cache.set(key,structuredClone(data));while(this.cache.size>3)this.cache.delete(this.cache.keys().next().value!);finish();}
     else if(data.type==='error')finish();
     onMessage(data);
    };
    worker.onerror=e=>{if(this.active!==job)return;this.release();finish();onMessage({type:'error',message:e.message||'Speech worker stopped unexpectedly. Retry with a smaller model.'});};
    worker.onmessageerror=()=>{if(this.active!==job)return;this.release();finish();onMessage({type:'error',message:'The speech result could not be received. Please retry.'});};
    const transfers:Transferable[]=[payload.audio.buffer];if(payload.stereo)transfers.push(...payload.stereo.map((a:Float32Array)=>a.buffer));
    worker.postMessage(payload,transfers);
   }).catch(e=>{if(this.active!==job)return;clearTimeout(job.timer);this.active=null;this.release();reject(e);});
  });
 }
 release(){clearTimeout(this.idle);this.worker?.terminate();this.worker=null;}
 cancel(){const job=this.active;this.active=null;if(job){clearTimeout(job.timer);job.reject(new DOMException('Caption generation cancelled','AbortError'));}this.release();}
 dispose(){this.cancel();this.cache.clear();}
}
