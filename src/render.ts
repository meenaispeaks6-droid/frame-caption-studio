import type { CaptionStyle, Word } from './types';
import { activeGroup } from './captions';
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function spring(t:number,frequency=17,damping=9){return 1-Math.exp(-Math.max(0,t)*damping)*Math.cos(Math.max(0,t)*frequency);}
export function drawCaptions(ctx:Context,width:number,height:number,time:number,groups:Word[][],s:CaptionStyle){
 const group=activeGroup(groups,time);if(!group)return;
 ctx.save();
 const unit=Math.min(width,height)/720, strength=s.strength/100;
 let fs=s.size*unit;
 const fontFamily=`"${s.font}", "Noto Sans Devanagari", sans-serif`;
 const weight=s.preset==='cinematic'?600:800;
 const texts=group.map(w=>s.uppercase?w.text.toLocaleUpperCase():w.text);
 let widths:number[]=[];let lines:number[][]=[];let gap=0;
 // Fit the whole phrase in two lines, including unusually long manual words.
 for(let attempt=0;attempt<12;attempt++){
  ctx.font=`${weight} ${fs}px ${fontFamily}`;gap=fs*.24;
  widths=texts.map(t=>ctx.measureText(t).width);lines=[[]];let rowWidth=0;
  widths.forEach((w,i)=>{if(rowWidth+w>width*.84&&lines.at(-1)!.length){lines.push([]);rowWidth=0;}lines.at(-1)!.push(i);rowWidth+=w+gap;});
  if(lines.length<=2 && Math.max(...widths)<width*.84)break;fs*=.88;
 }
 const lineHeight=fs*(s.font==='Noto Sans Devanagari'?1.55:1.34);
 const elapsed=time-group[0].start,remaining=group.at(-1)!.end-time;
 const cinematic=s.preset==='cinematic';
 const enter=cinematic?clamp(elapsed/.22):1;
 const exit=cinematic?clamp(remaining/.16):1;
 ctx.globalAlpha=Math.min(enter,exit);ctx.textBaseline='middle';ctx.textAlign='center';ctx.lineJoin='round';
 const baseY=Math.min(height-lineHeight*lines.length/2-25*unit,Math.max(lineHeight*lines.length/2+25*unit,height*s.position/100));
 lines.forEach((line,li)=>{
  const lineWidth=line.reduce((acc,i)=>acc+widths[i],0)+gap*(line.length-1);
  let x=(width-lineWidth)/2;
  const y=baseY+(li-(lines.length-1)/2)*lineHeight+(cinematic?(1-enter)*fs*.2*strength:0);
  line.forEach(i=>{
   const word=group[i],active=time>=word.start&&time<word.end,age=Math.max(0,time-word.start),future=time<word.start;
   let scale=1,dy=0,angle=0;
   if(!future && s.preset==='impact'){scale=1+(spring(age,22,11)-1)*.35*strength; if(active)scale+=.04*strength;}
   if(!future && s.preset==='bubble'){scale=1+(spring(age,18,7)-1)*.25*strength;dy=-Math.sin(age*17)*Math.exp(-age*7)*fs*.2*strength;}
   if(!future && s.preset==='desi'){scale=1+(spring(age,30,16)-1)*.16*strength;dy=(1-clamp(age/.12))*fs*.15*strength;angle=word.emphasis?Math.sin(age*22)*Math.exp(-age*14)*.06*strength:0;}
   const emphasized=active||word.emphasis;
   ctx.save();ctx.translate(x+widths[i]/2,y+dy);ctx.rotate(angle);ctx.scale(scale,scale);
   ctx.shadowColor=`rgba(0,0,0,${s.shadow/100})`;ctx.shadowBlur=s.shadow/100*fs*.24;ctx.shadowOffsetY=s.shadow/100*fs*.08;
   if(s.preset==='power'&&emphasized){ctx.fillStyle=s.accent;ctx.beginPath();ctx.roundRect(-widths[i]/2-fs*.12,-fs*.65,widths[i]+fs*.24,fs*1.3,fs*.1);ctx.fill();ctx.shadowColor='transparent';}
   if(s.stroke>0){ctx.strokeStyle=s.strokeColor;ctx.lineWidth=s.stroke*unit*2;ctx.strokeText(texts[i],0,0);}
   ctx.fillStyle=s.preset==='power'&&emphasized?'#15151c':emphasized&&!cinematic?s.accent:s.color;
   if(future&&(s.preset==='impact'||s.preset==='desi'))ctx.globalAlpha*=.86;
   ctx.fillText(texts[i],0,0);ctx.restore();x+=widths[i]+gap;
  });
 });
 ctx.restore();
}
