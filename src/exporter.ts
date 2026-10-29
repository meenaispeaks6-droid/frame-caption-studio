import { MediaBunnyTranscodeCoordinator, WebCodecsOnlyVideoFrameDecoderFactory, DefaultVideoFrameDecoderFactory, MediaBunnyCanvasVideoTrackEncoderFactory, DefaultAudioTrackBridgeFactory, MediaBunnyOutputTargetBuilder, type FramePainter, type CodecPolicy } from './engine';
import { canEncodeVideo } from 'mediabunny';
import type { CaptionStyle, Word, ExportOptions, MediaInfo } from './types';
import { groupWords } from './captions';
import { drawCaptions } from './render';
import { loadFonts } from './fonts';
export async function renderVideo(file:File,info:MediaInfo,words:Word[],style:CaptionStyle,options:ExportOptions,signal:AbortSignal,progress:(n:number)=>void,fallback=false){
 await loadFonts();
 const groups=groupWords(words,style.grouping,style.maxChars??24);let width=0,height=0;
 const painter:FramePainter={
  async begin(w,h){width=w;height=h;},lookAhead:()=>1,
  async paint(requests){return requests.map(({frame})=>ctx=>{ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';frame.draw(ctx,0,0,width,height);drawCaptions(ctx,width,height,frame.timestamp,groups,style);});},end(){}
 };
 const codec=options.format==='mp4'?'avc':'vp9';
 const policy:CodecPolicy={async resolveVideo(r){
  if(!await canEncodeVideo(codec,{width:r.width,height:r.height}))throw new Error(options.format==='mp4'?'H.264 encoding is unavailable. Choose WebM in Export, or use Chrome on a supported device.':'This browser cannot encode VP9. Try MP4 or a different device.');
  return {codec,bitrate:options.resolution===1080?10_000_000:5_000_000,bitrateMode:'variable',latencyMode:'quality',contentHint:'text'};
 }};
 const coordinator=new MediaBunnyTranscodeCoordinator({videoFrameDecoderFactory:fallback?new DefaultVideoFrameDecoderFactory():new WebCodecsOnlyVideoFrameDecoderFactory(),videoTrackEncoderFactory:new MediaBunnyCanvasVideoTrackEncoderFactory(),audioTrackBridgeFactory:new DefaultAudioTrackBridgeFactory(),outputTargetBuilder:new MediaBunnyOutputTargetBuilder()});
 const scale=Math.min(1,options.resolution/Math.min(info.width,info.height));
 const result=await coordinator.execute({source:file,painter,codecPolicy:policy,outputResolution:{width:Math.floor(info.width*scale/2)*2,height:Math.floor(info.height*scale/2)*2},outputFormat:options.format,audio:'keep',signal,onProgress:p=>progress(Math.min(99,p.percent)),onAudioDiscarded:reason=>{throw new Error(`Audio cannot be preserved (${reason}). Try another export format; the app will not silently remove your audio.`);}});
 if(!result.blob?.size)throw new Error('The encoder returned an empty file. Try 720p or a shorter clip.');
 return result;
}
