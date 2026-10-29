import type { CaptionStyle } from './types';
export interface CustomPreset { id:string; name:string; style:CaptionStyle; }
async function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('frame-presets',1);r.onupgradeneeded=()=>r.result.createObjectStore('presets',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Local presets are unavailable. Check browser storage permissions.'));});}
export async function presetStore(action:'list'|'put'|'delete',value?:CustomPreset|string):Promise<CustomPreset[]>{
 const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('presets',action==='list'?'readonly':'readwrite'),store=tx.objectStore('presets');if(action==='put')store.put(value);if(action==='delete')store.delete(value as string);const request=store.getAll();tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(Error('Could not save presets. Browser storage may be full.'));tx.onabort=()=>reject(Error('Preset storage was interrupted.'));});}finally{db.close();}
}
