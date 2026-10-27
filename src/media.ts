import { ALL_FORMATS, BlobSource, Input, EncodedPacketSink, AudioSampleSink, AudioSample, canEncodeVideo } from 'mediabunny';
import { BatchedMonoResampler, WebAudioAudioDecoder } from './engine';
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
async function decodeTimeline(file:File,stereo:boolean,onProgress:(p:number)=>void){
 const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
 try{
  const track=await input.getPrimaryAudioTrack();if(!track)throw Error('No audio track found. Import subtitles or add captions manually.');
  if(!await track.canDecode())throw new DOMException('Unsupported audio codec','NotSupportedError');
  const offset=Math.max(0,await track.getFirstTimestamp()),end=await input.computeDuration();
  let aacOrigin:number|undefined;const gaps:{at:number;jump:number}[]=[];
  if(await track.getCodec()==='aac'){
   const packets=[];for await(const p of new EncodedPacketSink(track).packets(undefined,undefined,{metadataOnly:true}))packets.push({time:p.timestamp,duration:p.duration});
   const durations=packets.map(p=>p.duration).filter(d=>d>0).sort((a,b)=>a-b),nominal=durations[Math.floor(durations.length/2)]??0;
   if(nominal>0&&packets.length){aacOrigin=packets[0].time;let continuous=0,previousEnd=aacOrigin;for(const p of packets){const jump=p.time-previousEnd;if(jump>.003)gaps.push({at:continuous,jump});const length=p.duration>nominal*1.5?nominal:p.duration;continuous+=length;previousEnd=p.time+length;}}
  }
  let decodedTime=0,gapIndex=0,sourceJump=0;
  const targets=Array.from({length:stereo?2:1},()=>new Float32Array(Math.max(1,Math.ceil((end-offset)*16000))));
  let resamplers=targets.map(target=>new BatchedMonoResampler(target,16000)),next=offset,segmentStart=0,written=0;
  const flush=async()=>{const lengths=await Promise.all(resamplers.map(r=>r.flush()));written=Math.max(written,segmentStart+Math.min(...lengths));};
  for await(const sample of new AudioSampleSink(track).samples()){
   try{
    if(stereo&&sample.numberOfChannels!==2)throw Error('Center focus requires a stereo source. Original audio will be used.');
    let frameOffset=0;
    while(frameOffset<sample.numberOfFrames){
     const cursor=decodedTime+frameOffset/sample.sampleRate;
     while(gapIndex<gaps.length&&cursor>=gaps[gapIndex].at-1/sample.sampleRate){sourceJump+=gaps[gapIndex++].jump;}
     const nextGap=gaps[gapIndex]?.at??Infinity;
     const frameCount=Math.min(sample.numberOfFrames-frameOffset,Math.max(1,Math.round((nextGap-cursor)*sample.sampleRate)));
     const sourceTime=aacOrigin===undefined?sample.timestamp+frameOffset/sample.sampleRate:aacOrigin+cursor+sourceJump;
     const trim=Math.max(0,Math.min(frameCount,Math.ceil((offset-sourceTime)*sample.sampleRate)));
     const count=frameCount-trim,actualTime=sourceTime+trim/sample.sampleRate;
     if(count>0){
      if(Math.abs(actualTime-next)>.002){await flush();segmentStart=Math.max(0,Math.round((actualTime-offset)*16000));resamplers=targets.map(target=>new BatchedMonoResampler(target.subarray(Math.min(target.length,segmentStart)),16000));}
      const channels=Array.from({length:sample.numberOfChannels},(_,channel)=>{const pcm=new Float32Array(count);sample.copyTo(pcm,{planeIndex:channel,format:'f32-planar',frameOffset:frameOffset+trim,frameCount:count});return pcm;});
      let selected=channels;
      if(!stereo&&channels.length>1){const mono=new Float32Array(count);for(let i=0;i<count;i++){let sum=0;for(const channel of channels)sum+=channel[i];mono[i]=sum/channels.length;}selected=[mono];}
      for(let channel=0;channel<selected.length;channel++){const mono=new AudioSample({data:selected[channel],format:'f32-planar',numberOfChannels:1,sampleRate:sample.sampleRate,timestamp:actualTime});try{await resamplers[channel].append(mono);}finally{mono.close();}}
      next=actualTime+count/sample.sampleRate;
     }
     frameOffset+=frameCount;
    }
    decodedTime+=sample.numberOfFrames/sample.sampleRate;onProgress(Math.min(1,(next-offset)/Math.max(.001,end-offset)));
   }finally{sample.close();}
  }
  await flush();onProgress(1);return {channels:targets.map(target=>target.slice(0,written)),offset};
 }finally{input.dispose();}
}
async function decodeAudio(file:File,onProgress:(p:number)=>void){
 try{const {channels,offset}=await decodeTimeline(file,false,onProgress);if(!channels[0].length)throw Error('No audio samples were decoded.');return {audio:channels[0],offset};}
 catch(e){if((e as Error).name!=='NotSupportedError')throw e;const audio=await new WebAudioAudioDecoder().decode(file,16000,onProgress);if(!audio.length)throw Error('No audio samples were decoded.');return {audio,offset:0};}
}
export async function extractStereoAudio(file:File,onProgress:(p:number)=>void){const result=await decodeTimeline(file,true,onProgress);return {stereo:result.channels as [Float32Array,Float32Array],offset:result.offset};}

// Waveform and generation share one decode, including an in-flight import.
let decoded:{file:File;promise:Promise<{audio:Float32Array;offset:number}>}|undefined;
export function extractAudio(file:File,onProgress:(p:number)=>void){
 if(decoded?.file===file)return decoded.promise.then(result=>{onProgress(1);return result;});
 const promise=decodeAudio(file,onProgress);decoded={file,promise};
 void promise.catch(()=>{if(decoded?.promise===promise)decoded=undefined;});
 return promise;
}
