export const SPEECH_RATE=16000;
export type AudioMode='original'|'light'|'center';
export interface AudioReport {duration:number;rms:number;peak:number;clipping:number;dc:number;noiseFloor:number;dynamicRangeDb:number;silent:boolean;background:'quiet'|'continuous'|'variable';musicDetection:'not-classified';processing?:AudioMode;voiceDetection?:{model:'silero';regions:number;uncertain:boolean;maxProbability:number}}
export interface SpeechSpan {start:number;end:number}
const rms=(a:Float32Array)=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/Math.max(1,a.length));
export function analyzeAudio(audio:Float32Array):AudioReport{
 if(!audio.length||audio.some(x=>!Number.isFinite(x)))throw Error('Audio contains no usable samples. Try another recording.');
 let peak=0,sum=0,clip=0;for(const x of audio){peak=Math.max(peak,Math.abs(x));sum+=x;if(Math.abs(x)>=.999)clip++;}
 const levels:number[]=[];for(let i=0;i<audio.length;i+=320)levels.push(rms(audio.subarray(i,i+320)));
 const sorted=[...levels].sort((a,b)=>a-b),floor=sorted[Math.floor(sorted.length*.1)]??0,top=sorted[Math.floor(sorted.length*.9)]??0;
 const dynamicRangeDb=20*Math.log10(Math.max(top,1e-8)/Math.max(floor,1e-8));
 return {duration:audio.length/SPEECH_RATE,rms:rms(audio),peak,clipping:clip/audio.length,dc:sum/audio.length,noiseFloor:floor,dynamicRangeDb,silent:peak<.0003,background:floor<.001?'quiet':dynamicRangeDb<12?'continuous':'variable',musicDetection:'not-classified'};
}
/** Conservative silence segmentation, not a learned speech/music classifier.
 * Quiet sound is retained; only extended near-silence is omitted. Padding and
 * merging prevent edge cuts, and all returned positions remain source times. */
export function speechSpans(audio:Float32Array):SpeechSpan[]{
 const frame=320,threshold=.00015,pad=4000,minGap=19200;const regions:SpeechSpan[]=[];let start=-1,last=0;
 for(let i=0;i<audio.length;i+=frame){if(rms(audio.subarray(i,i+frame))>threshold){if(start<0)start=i;last=Math.min(audio.length,i+frame);}else if(start>=0&&i-last>=minGap){regions.push({start:Math.max(0,start-pad)/SPEECH_RATE,end:Math.min(audio.length,last+pad)/SPEECH_RATE});start=-1;}}
 if(start>=0)regions.push({start:Math.max(0,start-pad)/SPEECH_RATE,end:Math.min(audio.length,last+pad)/SPEECH_RATE});
 const joined:SpeechSpan[]=[];for(const region of regions){const prev=joined.at(-1);if(prev&&region.start<=prev.end)prev.end=Math.max(prev.end,region.end);else joined.push(region);}return joined;
}
// Small radix-2 FFT: original independent DSP, no third-party assets/models.
function fft(re:Float64Array,im:Float64Array,inverse=false){
 const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){const angle=(inverse?2:-2)*Math.PI/len,wr=Math.cos(angle),wi=Math.sin(angle);for(let i=0;i<n;i+=len){let ur=1,ui=0;for(let j=0;j<len/2;j++){const p=i+j,q=p+len/2,vr=re[q]*ur-im[q]*ui,vi=re[q]*ui+im[q]*ur;re[q]=re[p]-vr;im[q]=im[p]-vi;re[p]+=vr;im[p]+=vi;const t=ur;ur=t*wr-ui*wi;ui=t*wi+ui*wr;}}}if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}
}
/** Optional mild spectral subtraction; never changes sample count or delay.
 * Attenuation is capped at 4 dB to protect quiet phonemes. Original is default. */
export function enhanceSpeech(audio:Float32Array,mode:Exclude<AudioMode,'original'>,stereo?:[Float32Array,Float32Array]){
 if(mode==='center'&&(!stereo||stereo.some(c=>c.length!==audio.length)))throw Error('Stereo center focus is unavailable for this audio. Using the original.');
 const n=512,hop=256,out=new Float64Array(audio.length),norm=new Float64Array(audio.length),noise=new Float64Array(n);
 const window=Float64Array.from({length:n},(_,i)=>Math.sin(Math.PI*(i+.5)/n));
 const report=analyzeAudio(audio);if(mode==='light'&&report.dynamicRangeDb<8)throw Error('No reliable quiet interval was found for noise estimation; using original audio.');const quiet=Math.max(.00001,report.noiseFloor*1.2);let noiseFrames=0;
 if(mode==='light')for(let pos=0;pos<audio.length;pos+=hop){const chunk=audio.subarray(pos,pos+n);if(rms(chunk)>quiet)continue;const re=new Float64Array(n),im=new Float64Array(n);for(let j=0;j<n;j++)re[j]=(chunk[j]??0)*window[j];fft(re,im);for(let k=0;k<n;k++)noise[k]+=re[k]**2+im[k]**2;noiseFrames++;}
 if(noiseFrames)for(let k=0;k<n;k++)noise[k]/=noiseFrames;
 for(let pos=-hop;pos<audio.length;pos+=hop){const re=new Float64Array(n),im=new Float64Array(n),sr=new Float64Array(n),si=new Float64Array(n);
  for(let j=0;j<n;j++){const p=pos+j;if(p<0||p>=audio.length)continue;re[j]=audio[p]*window[j];if(mode==='center')sr[j]=(stereo![0][p]-stereo![1][p])*.5*window[j];}
  fft(re,im);if(mode==='center')fft(sr,si);
  for(let k=0;k<n;k++){const power=re[k]**2+im[k]**2;let gain=mode==='center'?Math.max(.2,Math.sqrt(Math.max(0,1-(sr[k]**2+si[k]**2)/(power+1e-12)))):Math.max(.63,Math.sqrt(Math.max(0,1-noise[k]/(power+1e-12))));const freq=Math.min(k,n-k)*SPEECH_RATE/n;if(mode==='light'&&freq<60)gain*=.8;re[k]*=gain;im[k]*=gain;}
  fft(re,im,true);for(let j=0;j<n;j++){const p=pos+j;if(p>=0&&p<audio.length){out[p]+=re[j]*window[j];norm[p]+=window[j]**2;}}
 }
 const result=Float32Array.from(out,(x,i)=>x/Math.max(norm[i],1e-8));if(result.some(x=>!Number.isFinite(x)))throw Error('Speech filtering failed. Using original audio.');return result;
}
