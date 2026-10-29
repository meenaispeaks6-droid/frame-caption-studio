import type { CaptionStyle, Transitions, Word } from './types';
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export const modernPresets = new Set(['sticker','blast','retro','glass','scribble','akshar','boxkaraoke','pillline','wide','neon']);
export type Bounds={x:number;y:number;width:number;height:number};
export type TokenLayout={index:number;width:number;x:number;y:number;halfWidth:number;halfHeight:number};
export type CaptionLayout={fontSize:number;gap:number;tokens:TokenLayout[];lines:{indices:number[];x:number;y:number;width:number}[];bounds:Bounds;safe:Bounds};

// Reserve the largest animation footprint once per phrase. Highlighting never
// shifts the neighbouring words or changes wrapping during playback.
function transitionEnvelope(transitions:Transitions|undefined){
 let scale=1,x=0,y=0,angle=0;
 for(const m of Object.values(transitions??{})){
  if(!m||m.name==='none')continue;
  const strength=m.intensity/100,amount=1.2;
  if(['pop','scale','zoom'].includes(m.name))scale*=1+(m.name==='zoom'?.18:.08)*strength;
  if(['slide-left','slide-right','hook-left'].includes(m.name))x+=40*amount*strength;
  if(['slide-up','slide-down','rise-up','rise-down','hook-left'].includes(m.name))y+=40*amount*strength;
  if(m.name==='hook-left')angle+=.15*strength;
 }
 return {scale,x,y,angle};
}
export function setCaptionFont(ctx:Context,s:CaptionStyle,fs:number){
 const family=s.font==='Courier New'?'"Courier New", ui-monospace, monospace':`"${s.font}", "Noto Sans Devanagari", sans-serif`;
 ctx.font=`${s.italic?'italic ':''}${s.weight??800} ${fs}px ${family}`;
 // Tracking is part of measurement, and scales with output resolution. Older
 // canvases omit tracking consistently from both measurement and drawing.
 if('letterSpacing' in ctx)ctx.letterSpacing=`${(s.letterSpacing??0)*fs/s.size}px`;
 ctx.textAlign='center';ctx.textBaseline='middle';
}
export function layoutStyledCaption(ctx:Context,width:number,height:number,group:Word[],s:CaptionStyle):CaptionLayout{
 const unit=Math.min(width,height)/720,strength=s.strength/100;
 const safe={x:width*.06,y:height*.05,width:width*.88,height:height*.9};
 const texts=group.map(w=>s.uppercase?w.text.toLocaleUpperCase():w.text);
 const measure=(fs:number)=>{
  setCaptionFont(ctx,s,fs);
  const stroke=s.stroke*unit,gap=fs*.18;
  const shadow=(s.glow?s.glow/100*fs*.6:s.shadow/100*fs*.24)*2+s.shadow/100*fs*.08;
  const linePad=s.box==='line-pill'?fs*.35:s.background?fs*.2:0;
  const slots=texts.map((text,index)=>{
   const m=ctx.measureText(text),textWidth=Math.max(m.width,m.actualBoundingBoxLeft*2,m.actualBoundingBoxRight*2);
   const pad=(s.box==='word-pill'||s.box==='glass')?fs*.22:s.preset==='boxkaraoke'?fs*.14:0;
   let scale=s.preset==='blast'?Math.max(1,s.emphasisScale??1.35):1;
   if(['sticker','glass','neon','akshar'].includes(s.preset))scale*=1+.07*strength;
   const motion=transitionEnvelope(group[index].wordTransitions);scale*=motion.scale;
   const angle=(s.preset==='sticker'?Math.abs(s.rotate??0)*Math.PI/180:0)+motion.angle;
   const halfW=(textWidth/2+pad+stroke)*scale;
   const boxHalf=s.box||s.preset==='boxkaraoke'||s.background?fs*.68:0;
   const halfH=Math.max(boxHalf,m.actualBoundingBoxAscent,m.actualBoundingBoxDescent,s.scribble?fs*.7:0,s.underline?fs*.6:0)*scale+stroke;
   return {index,width:m.width,halfWidth:halfW+halfH*Math.abs(Math.sin(angle))+motion.x*unit,
    halfHeight:halfH+halfW*Math.abs(Math.sin(angle))+(s.preset==='sticker'&&s.float?fs*.08*strength:0)+motion.y*unit};
  });
  const rows:{indices:number[];width:number;halfHeight:number}[]=[{indices:[],width:0,halfHeight:0}];
  for(const slot of slots){
   let row=rows.at(-1)!;
   if(row.indices.length&&row.width+gap+slot.halfWidth*2+linePad*2>safe.width-shadow*2){row={indices:[],width:0,halfHeight:0};rows.push(row);}
   row.width+=(row.indices.length?gap:0)+slot.halfWidth*2;row.halfHeight=Math.max(row.halfHeight,slot.halfHeight);row.indices.push(slot.index);
  }
  const contentWidth=Math.max(...rows.map(r=>r.width+linePad*2)),contentHeight=rows.reduce((n,r)=>n+r.halfHeight*2,0)+gap*(rows.length-1);
  return {slots,rows,contentWidth,contentHeight,gap,shadow,linePad};
 };
 let fs=s.size*unit,measured=measure(fs);
 const fits=()=>measured.rows.length<=(s.lines??2)&&measured.contentWidth+measured.shadow*2<=safe.width&&measured.contentHeight+measured.shadow*2<=safe.height;
 // Geometric fitting, including boxes, stroke, rotation and overshoot. Keep the
 // user's chosen size intact; only this frame's effective size is reduced.
 for(let attempt=0;!fits()&&attempt<80;attempt++){fs*=.9;measured=measure(fs);}
 const {slots,rows,contentWidth,contentHeight,gap,shadow,linePad}=measured;
 const totalWidth=contentWidth+shadow*2,totalHeight=contentHeight+shadow*2;
 const cx=Math.max(safe.x+totalWidth/2,Math.min(safe.x+safe.width-totalWidth/2,width*(s.positionX??50)/100));
 const cy=Math.max(safe.y+totalHeight/2,Math.min(safe.y+safe.height-totalHeight/2,height*s.position/100));
 let top=cy-contentHeight/2;
 const tokens:TokenLayout[]=[],lines:CaptionLayout['lines']=[];
 for(const row of rows){
  const left=cx-row.width/2+(s.align==='left'?-(contentWidth-linePad*2-row.width)/2:s.align==='right'?(contentWidth-linePad*2-row.width)/2:0);
  const y=top+row.halfHeight;let x=left;
  lines.push({indices:row.indices,x:left,y,width:row.width});
  for(const index of row.indices){const slot=slots[index];tokens.push({...slot,x:x+slot.halfWidth,y});x+=slot.halfWidth*2+gap;}
  top+=row.halfHeight*2+gap;
 }
 return {fontSize:fs,gap,tokens,lines,bounds:{x:cx-totalWidth/2,y:cy-totalHeight/2,width:totalWidth,height:totalHeight},safe};
}
// Fit a whole-phrase transition as one rigid transform, then clamp its visible
// envelope. This keeps extreme X/Y settings and slide/zoom animations on frame.
export function fitCaptionMotion(bounds:Bounds,safe:Bounds,m:{x:number;y:number;scale:number;rotate:number},unit:number){
 const cx=bounds.x+bounds.width/2,cy=bounds.y+bounds.height/2;
 const cosine=Math.abs(Math.cos(m.rotate)),sine=Math.abs(Math.sin(m.rotate));
 const w=bounds.width*cosine+bounds.height*sine,h=bounds.height*cosine+bounds.width*sine;
 const scale=Math.min(m.scale,safe.width/w,safe.height/h);
 const width=w*scale,height=h*scale;
 const x=Math.max(safe.x+width/2,Math.min(safe.x+safe.width-width/2,cx+m.x*unit));
 const y=Math.max(safe.y+height/2,Math.min(safe.y+safe.height-height/2,cy+m.y*unit));
 return {cx,cy,x,y,scale,rotate:m.rotate,bounds:{x:x-width/2,y:y-height/2,width,height}};
}
