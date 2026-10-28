import { renderVideo } from './exporter';
let controller:AbortController|undefined;
self.onmessage=async({data})=>{
 if(data.type==='cancel'){controller?.abort();return;}
 if(data.type!=='render'||controller)return;
 controller=new AbortController();
 try{const result=await renderVideo(data.file,data.info,data.words,data.style,data.options,controller.signal,n=>self.postMessage({type:'progress',progress:n}));self.postMessage({type:'done',...result});}
 catch(e){self.postMessage({type:'error',message:(e as Error).message,name:(e as Error).name});}finally{controller=undefined;}
};
