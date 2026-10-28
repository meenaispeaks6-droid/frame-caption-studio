import type { CaptionStyle, Word } from './types';
import { activeGroup } from './captions';
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
function hexToRgba(hex:string,alpha:number){const m=/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);if(!m)return hex;return `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},${alpha})`;}
export function spring(t:number,frequency=17,damping=9){return 1-Math.exp(-Math.max(0,t)*damping)*Math.cos(Math.max(0,t)*frequency);}
// The reference holds complete, handwritten phrases still, then replaces them.
// Shape each line as one string so spacing/kerning never shifts between words.
function drawHandwritten(ctx:Context,width:number,height:number,time:number,group:Word[],s:CaptionStyle){
 const unit=Math.min(width,height)/720,strength=s.strength/100;
 const texts=group.map(w=>s.uppercase?w.text.toLocaleUpperCase():w.text);
 let fs=s.size*unit,lines:string[]=[];
 for(let attempt=0;attempt<16;attempt++){
  ctx.font=`400 ${fs}px "${s.font}", "Noto Sans Devanagari", sans-serif`;
  lines=[''];
  for(const text of texts){const last=lines.length-1,next=lines[last]?`${lines[last]} ${text}`:text;if(lines[last]&&ctx.measureText(next).width>width*.84)lines.push(text);else lines[last]=next;}
  if(lines.length<=2&&lines.every(line=>ctx.measureText(line).width<=width*.84))break;
  fs*=.88;
 }
 const age=time-group[0].start,remaining=group.at(-1)!.end-time;
 const fade=.09*strength;
 const enter=fade?clamp(age/fade):1,exit=fade?clamp(remaining/fade):1;
 const eased=1-(1-enter)**3,lineHeight=fs*1.45;
 const pad=Math.max(12*unit,fs*.25+s.stroke*unit),half=Math.max(...lines.map(line=>ctx.measureText(line).width))/2;
 const baseX=Math.max(half+pad,Math.min(width-half-pad,width*(s.positionX??50)/100));
 const baseY=Math.min(height-30*unit-lineHeight*lines.length/2,Math.max(30*unit+lineHeight*lines.length/2,height*s.position/100));
 ctx.globalAlpha=Math.min(enter,exit);ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.lineJoin='round';
 ctx.shadowColor=`rgba(0,0,0,${s.shadow/100})`;ctx.shadowBlur=fs*.12;ctx.shadowOffsetY=fs*.035;
 lines.forEach((line,i)=>{
  const m=ctx.measureText(line),y=baseY+(i-(lines.length-1)/2)*lineHeight+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2+(1-eased)*fs*.12*strength;
  if(s.stroke>0){ctx.strokeStyle=s.strokeColor;ctx.lineWidth=s.stroke*unit*2;ctx.strokeText(line,baseX,y);}
  ctx.fillStyle=s.color;ctx.fillText(line,baseX,y);
 });
 return {x:baseX-half-pad,y:baseY-lineHeight*lines.length/2-pad,width:2*(half+pad),height:lineHeight*lines.length+2*pad};
}
export function drawCaptions(ctx:Context,width:number,height:number,time:number,groups:Word[][],s:CaptionStyle){
 const active=activeGroup(groups,time);if(!active)return;
 // Wrap phrase fallback text naturally while retaining its one real time
 // window. Every visual token enters together; no word times are invented.
 const group=active.flatMap(word=>word.timing==='segment'?word.text.split(/\s+/).filter(Boolean).map(text=>({...word,text})): [word]);
 ctx.save();
 if(s.preset==='handwritten'){const bounds=drawHandwritten(ctx,width,height,time,group,s);ctx.restore();return bounds;}
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
 if(s.letterSpacing)(ctx as unknown as {letterSpacing:string}).letterSpacing=`${s.letterSpacing}px`;
 const maxWidth=Math.max(...lines.map(line=>line.reduce((acc,i)=>acc+widths[i],0)+gap*(line.length-1)));
 const pad=Math.max(14*unit,fs*.3+s.stroke*unit);
 const baseX=Math.max(maxWidth/2+pad,Math.min(width-maxWidth/2-pad,width*(s.positionX??50)/100));
 const baseY=Math.min(height-lineHeight*lines.length/2-25*unit,Math.max(lineHeight*lines.length/2+25*unit,height*s.position/100));
 lines.forEach((line,li)=>{
  const lineWidth=line.reduce((acc,i)=>acc+widths[i],0)+gap*(line.length-1);
  let x=baseX-lineWidth/2;
  const y=baseY+(li-(lines.length-1)/2)*lineHeight+(cinematic?(1-enter)*fs*.2*strength:0);
  if(s.box==='line-pill'&&s.boxColor){ctx.save();ctx.fillStyle=s.boxColor;ctx.beginPath();ctx.roundRect(baseX-lineWidth/2-fs*.35,y-fs*.68,lineWidth+fs*.7,fs*1.36,fs*.34);ctx.fill();ctx.restore();}
  line.forEach(i=>{
   const word=group[i],active=time>=word.start&&time<word.end,age=Math.max(0,time-word.start),future=time<word.start;
   let scale=1,dy=0,angle=0;
   if(!future && s.preset==='impact'){scale=1+(spring(age,22,11)-1)*.35*strength; if(active)scale+=.04*strength;}
   if(!future && s.preset==='bubble'){scale=1+(spring(age,18,7)-1)*.25*strength;dy=-Math.sin(age*17)*Math.exp(-age*7)*fs*.2*strength;}
   if(!future && s.preset==='desi'){scale=1+(spring(age,30,16)-1)*.16*strength;dy=(1-clamp(age/.12))*fs*.15*strength;angle=word.emphasis?Math.sin(age*22)*Math.exp(-age*14)*.06*strength:0;}
   if(!future && s.preset==='sticker'){scale=1+(spring(age,18,8)-1)*.22*strength;dy=-Math.sin(time*3+i*.7)*fs*.07*strength;angle=((s.rotate??0)*Math.PI)/180;}
   if(!future && s.preset==='blast'&&(active||word.emphasis))scale*=(s.emphasisScale??1.35);
   if(!future && s.preset==='neon'){scale=1+(spring(age,20,10)-1)*.2*strength;}
   if(!future && s.preset==='glass'){scale=1+(spring(age,18,9)-1)*.18*strength;}
   const emphasized=active||word.emphasis;
   ctx.save();ctx.translate(x+widths[i]/2,y+dy);ctx.rotate(angle);ctx.scale(scale,scale);
   ctx.shadowColor=`rgba(0,0,0,${s.shadow/100})`;ctx.shadowBlur=s.shadow/100*fs*.24;ctx.shadowOffsetY=s.shadow/100*fs*.08;
   if(s.glow){ctx.shadowColor=s.accent;ctx.shadowBlur=s.glow/100*fs*.6;ctx.shadowOffsetY=0;}
   if(s.preset==='power'&&emphasized){ctx.fillStyle=s.accent;ctx.beginPath();ctx.roundRect(-widths[i]/2-fs*.12,-fs*.65,widths[i]+fs*.24,fs*1.3,fs*.1);ctx.fill();ctx.shadowColor='transparent';}
   if(s.box==='word-pill'&&s.boxColor&&(!s.charReveal||!future)){ctx.fillStyle=s.boxColor;ctx.beginPath();ctx.roundRect(-widths[i]/2-fs*.22,-fs*.68,widths[i]+fs*.44,fs*1.36,fs*.3);ctx.fill();}
   if(s.box==='glass'&&s.boxColor){ctx.fillStyle=hexToRgba(s.boxColor,.22);ctx.beginPath();ctx.roundRect(-widths[i]/2-fs*.22,-fs*.68,widths[i]+fs*.44,fs*1.36,fs*.34);ctx.fill();}
   if(s.preset==='boxkaraoke'&&active){ctx.fillStyle=s.accent;ctx.beginPath();ctx.roundRect(-widths[i]/2-fs*.14,-fs*.65,widths[i]+fs*.28,fs*1.3,fs*.12);ctx.fill();ctx.shadowColor='transparent';}
   if(s.stroke>0){ctx.strokeStyle=s.strokeColor;ctx.lineWidth=s.stroke*unit*2;if(!s.charReveal)ctx.strokeText(texts[i],0,0);}
   ctx.fillStyle=s.preset==='power'&&emphasized?'#15151c':s.preset==='boxkaraoke'&&active?s.color:emphasized&&!cinematic?s.accent:s.color;
   if(future&&(s.preset==='impact'||s.preset==='desi'))ctx.globalAlpha*=.86;
   if(s.preset==='wide'){ctx.globalAlpha*=future?0:clamp(age/.4);}
   if(s.charReveal){
    const chars=[...texts[i]],charWidths=chars.map(c=>ctx.measureText(c).width),charTotal=charWidths.reduce((a,b)=>a+b,0);
    let cx=-charTotal/2;
    chars.forEach((c,ci)=>{
     const charAge=age-ci*.07;
     if(charAge>=0){
      const cs=1+(spring(charAge,22,11)-1)*.3*strength;
      ctx.save();ctx.translate(cx+charWidths[ci]/2,0);ctx.scale(cs,cs);
      if(s.stroke>0){ctx.strokeStyle=s.strokeColor;ctx.lineWidth=s.stroke*unit*2;ctx.strokeText(c,0,0);}
      ctx.fillStyle=s.color;ctx.fillText(c,0,0);ctx.restore();
     }
     cx+=charWidths[ci];
    });
   } else ctx.fillText(texts[i],0,0);
   if(s.scribble&&emphasized){
    ctx.strokeStyle=s.accent;ctx.lineWidth=Math.max(2,fs*.07);ctx.lineCap='round';ctx.beginPath();
    const w=widths[i]/2,y2=fs*.62;ctx.moveTo(-w,y2);
    for(let px=-w;px<=w;px+=Math.max(2,w/6))ctx.lineTo(px,y2+Math.sin(px*.3)*fs*.06);
    ctx.stroke();
   }
   ctx.restore();x+=widths[i]+gap;
  });
 });
 ctx.restore();
 return {x:baseX-maxWidth/2-pad,y:baseY-lineHeight*lines.length/2-pad,width:maxWidth+2*pad,height:lineHeight*lines.length+2*pad};
}
