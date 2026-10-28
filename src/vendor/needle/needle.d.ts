export interface Needle {
 HEAPU8:Uint8Array;
 _malloc:(n:number)=>number; _free:(pointer:number)=>void;
 _needle_load:(pointer:number,size:bigint)=>number;
 _needle_models:()=>number; _needle_last_error:()=>number;
 _needle_transcribe:(audio:number,count:number,language:number,keywords:number,timestamps:number,output:number,capacity:number)=>number;
 UTF8ToString:(pointer:number)=>string;
}
export default function createNeedle(options:{wasmBinary:ArrayBuffer;print:()=>void;printErr:()=>void}):Promise<Needle>;
