import { ALL_FORMATS, BlobSource, Input, canEncodeVideo } from 'mediabunny';
import { MediaBunnyAudioDecoder, WebAudioAudioDecoder } from './engine';
import type { MediaInfo } from './types';
export function memoryLimit(){const gb=(navigator as Navigator & {deviceMemory?:number}).deviceMemory??4;return gb<=4?180:600;}
export async function inspectMedia(file:File):Promise<MediaInfo>{
 if(file.size>500*1024*1024)throw new Error('Choose a clip under 500 MB. Shorter clips use less device memory.');
 const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
 try{
  const track=await input.getPrimaryVideoTrack();if(!track)throw new Error('This file has no supported video track. Try an MP4 with H.264 video.');
  const duration=await input.computeDuration();
  if(!Number.isFinite(duration)||duration<=0)throw new Error('The video duration could not be read.');
  if(duration>memoryLimit())throw new Error(`Choose a clip under ${memoryLimit()/60} minutes on this device. Split longer videos first to keep memory use stable.`);
  return {width:track.displayWidth,height:track.displayHeight,duration,hasAudio:!!await input.getPrimaryAudioTrack(),name:file.name};
 }finally{input.dispose();}
}
export function outputSize(info:MediaInfo,resolution:number){const scale=Math.min(1,resolution/Math.min(info.width,info.height));return {width:Math.max(2,Math.floor(info.width*scale/2)*2),height:Math.max(2,Math.floor(info.height*scale/2)*2)};}
export async function codecSupport(info:MediaInfo,resolution:number,format:'mp4'|'webm'){
 const size=outputSize(info,resolution);
 if(typeof VideoEncoder==='undefined')return false;
 return canEncodeVideo(format==='mp4'?'avc':'vp9',size);
}
export async function extractAudio(file:File,onProgress:(p:number)=>void){
 const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});let offset=0;
 try{const track=await input.getPrimaryAudioTrack();if(!track)throw new Error('No audio track found. Add captions manually or import subtitles.');offset=Math.max(0,await track.getFirstTimestamp());}finally{input.dispose();}
 let audio:Float32Array;
 try{audio=await new MediaBunnyAudioDecoder().decode(file,16000,onProgress);}
 catch(e){if((e as Error).name!=='NotSupportedError')throw e;audio=await new WebAudioAudioDecoder().decode(file,16000,onProgress);offset=0;}
 if(!audio.length)throw new Error('No audio samples were decoded. You can still add captions manually.');
 return {audio,offset};
}
