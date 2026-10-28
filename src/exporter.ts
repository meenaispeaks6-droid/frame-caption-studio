import { exportStorage } from './export-storage';
import { MediaBunnyTranscodeCoordinator, WebCodecsOnlyVideoFrameDecoderFactory, DefaultVideoFrameDecoderFactory, MediaBunnyCanvasVideoTrackEncoderFactory, DefaultAudioTrackBridgeFactory, MediaBunnyOutputTargetBuilder, type FramePainter, type CodecPolicy } from './engine';
import { canEncodeVideo, Input, BlobSource, ALL_FORMATS } from 'mediabunny';
import type { CaptionStyle, Word, ExportOptions, MediaInfo } from './types';
import { groupWords } from './captions';
import { drawCaptions } from './render';
import { loadFonts } from './fonts';
export async function renderVideo(file:File,info:MediaInfo,words:Word[],style:CaptionStyle,options:ExportOptions,signal:AbortSignal,progress:(n:number)=>void,fallback=false){
 signal.throwIfAborted();await loadFonts();
 let storage:Awaited<ReturnType<typeof exportStorage>>=null;try{storage=await exportStorage(options.format);
 const groups=groupWords(words,style.grouping);let width=0,height=0;
 const painter:FramePainter={
  async begin(w,h){width=w;height=h;},lookAhead:()=>1,
  async paint(requests){return requests.map(({frame})=>ctx=>{ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';frame.draw(ctx,0,0,width,height);drawCaptions(ctx,width,height,frame.timestamp,groups,style);});},end(){}
 };
 const codec=options.format==='mp4'?'avc':'vp9';
 const policy:CodecPolicy={async resolveVideo(r){
  if(!await canEncodeVideo(codec,{width:r.width,height:r.height}))throw new Error(options.format==='mp4'?'H.264 encoding is unavailable. Choose WebM in Export, or use Chrome on a supported device.':'This browser cannot encode VP9. Try MP4 or a different device.');
  return {codec,bitrate:options.resolution===1080?10_000_000:5_000_000,bitrateMode:'variable',latencyMode:'quality',contentHint:'text'};
 }};
 const coordinator=new MediaBunnyTranscodeCoordinator({videoFrameDecoderFactory:fallback?new DefaultVideoFrameDecoderFactory():new WebCodecsOnlyVideoFrameDecoderFactory(),videoTrackEncoderFactory:new MediaBunnyCanvasVideoTrackEncoderFactory(),audioTrackBridgeFactory:new DefaultAudioTrackBridgeFactory(),outputTargetBuilder:storage?.builder??new MediaBunnyOutputTargetBuilder()});
 const scale=Math.min(1,options.resolution/Math.min(info.width,info.height));
 const result=await coordinator.execute({source:file,painter,codecPolicy:policy,outputResolution:{width:Math.floor(info.width*scale/2)*2,height:Math.floor(info.height*scale/2)*2},outputFormat:options.format,audio:'keep',signal,onProgress:(p:{percent:number})=>progress(Math.min(99,p.percent)),onAudioDiscarded:(reason:string)=>{throw new Error(`Audio cannot be preserved (${reason}). Try another export format; the app will not silently remove your audio.`);}});
 if(storage)result.blob=await storage.file();
 if(!result.blob?.size)throw new Error('The encoder returned an empty file. Try 720p or a shorter clip.');
 const check=new Input({source:new BlobSource(result.blob),formats:ALL_FORMATS});try{const track=await check.getPrimaryVideoTrack();if(!track||track.displayWidth!==result.width||track.displayHeight!==result.height||!(await check.computeDuration()>0)||info.hasAudio&&!await check.getPrimaryAudioTrack())throw Error('The exported video failed validation. Retry export; your edits are saved.');}finally{check.dispose();}
 return {...result,tempPath:storage?.name};
 }catch(e){await storage?.abort();if((e as Error).name==='QuotaExceededError')throw Error('Local storage is full. Free device storage, then retry export. Your project is saved.');if(e instanceof RangeError)throw Error('This device ran out of processing memory. Try 720p or Mobile-friendly mode. Your edits are saved.');throw e;}
}
