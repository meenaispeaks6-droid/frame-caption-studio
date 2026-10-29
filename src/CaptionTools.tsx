import { useRef, useState, type CSSProperties } from 'react';
import { Eraser, Clock3, RotateCcw } from 'lucide-react';
import type { CaptionStyle, Word } from './types';
import { bulkEdit, delayWords, type BulkAction } from './editor-operations';

type CleanupState={base:Word[];actions:BulkAction[];after:Word[]};
const actions:[BulkAction,string,string][]=[
 ['punctuation','Remove Punctuation','Strip punctuation for a cleaner, minimal look'],
 ['emphasis','Remove Emphasis','Remove text emphasis for a uniform appearance'],
 ['gaps','Remove Gaps in Captions','Close the gaps between captions for seamless flow'],
 ['emojis','Remove Emojis','Remove all emojis from captions'],
];
export function CaptionTools({words,style,duration,change,styleChange,begin,end,live}:{words:Word[];style:CaptionStyle;duration:number;change:(w:Word[])=>void;styleChange:(s:Partial<CaptionStyle>)=>void;begin:()=>void;end:()=>void;live:(w:Word[])=>void}) {
 const [cleanups,setCleanups]=useState<CleanupState[]>([]);
 const baseline=useRef(words.map(w=>({id:w.id,start:w.start,end:w.end})));
 let delay=words.length&&baseline.current.length?words[0].start-baseline.current[0].start:0;
 // Reset the relative delay reference after source replacement or individual timing edits.
 if(words.length!==baseline.current.length||words.some((w,i)=>w.id!==baseline.current[i]?.id||Math.abs(w.start-baseline.current[i].start-delay)>1e-6||Math.abs(w.end-baseline.current[i].end-delay)>1e-6)){
  baseline.current=words.map(w=>({id:w.id,start:w.start,end:w.end}));delay=0;
 }
 const signature=JSON.stringify(words);
 const cleanup=[...cleanups].reverse().find(s=>JSON.stringify(s.after)===signature);
 const shift=(target:number)=>{begin();live(delayWords(words,target-delay,duration));};
 return <div className="tools-panel caption-tools-panel">
  <h3 className="section-rule">Display settings</h3><div className="caption-display-grid">
   <label>Words<select aria-label="Words per phrase" value={style.grouping} onChange={e=>styleChange({grouping:Number(e.target.value)})}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n===4?'Default (4)':n}</option>)}</select></label>
   <label>Max Chars<div className="max-chars-control"><input aria-label="Maximum characters" type="number" min="8" max="120" value={style.maxChars??24} onChange={e=>styleChange({maxChars:Math.max(8,Math.min(120,Number(e.target.value)))})}/><button aria-label="Reset maximum characters" onClick={()=>styleChange({maxChars:24})}><RotateCcw size={16}/></button></div></label>
   <label>Lines<select aria-label="Caption lines" value={style.lines??2} onChange={e=>styleChange({lines:Number(e.target.value)})}>{[1,2,3].map(n=><option key={n} value={n}>{n} {n===1?'Line':'Lines'}</option>)}</select></label>
  </div><h3 className="section-rule">Actions</h3><div className="caption-cleanup-actions">
  {actions.map(([action,label,description])=>{
   const active=!!cleanup?.actions.includes(action);
   const cleaned=bulkEdit(words,action),available=JSON.stringify(cleaned)!==signature;
   return <button key={action} className="cleanup-card" role="switch" aria-label={label} aria-checked={active} disabled={!active&&!available} onClick={()=>{
    const base=cleanup?.base??words,enabled=cleanup?.actions??[];
    const actions=active?enabled.filter(a=>a!==action):[...enabled,action];
    const after=actions.reduce((result,a)=>bulkEdit(result,a),base);
    setCleanups(previous=>[...previous.slice(-19),{base,actions,after}]);change(after);
   }}><span className="tool-card-icon"><Eraser size={21}/></span><span className="tool-card-copy"><strong>{label}</strong><span>{description}</span></span><span className="cleanup-switch" aria-hidden="true"/></button>;
  })}</div><p className="tool-undo-note">Undo restores an action after further edits.</p>
  <h3 className="section-rule">Timing</h3><div className="caption-delay-card"><div className="delay-heading"><span className="tool-card-icon"><Clock3 size={22}/></span><div className="tool-card-copy"><strong>Caption Delay Control</strong><span>Shift all captions earlier or later in time</span></div><output>{Math.abs(delay)<.001?'No delay':`${delay>0?'+':''}${delay.toFixed(2)}s`}</output><button aria-label="Reset caption delay" disabled={Math.abs(delay)<.001} onClick={()=>change(delayWords(words,-delay,duration))}><RotateCcw size={20}/></button></div>
   <input style={{'--delay-progress':`${(Math.max(-5,Math.min(5,delay))+5)*10}%`} as CSSProperties} aria-label="Caption delay" type="range" min="-5" max="5" step="0.05" value={Math.max(-5,Math.min(5,delay))} disabled={!words.length} onPointerDown={begin} onChange={e=>shift(Number(e.target.value))} onPointerUp={end} onPointerCancel={end} onBlur={end} onKeyUp={end}/><div className="delay-ticks"><span>-5s</span><span>0</span><span>+5s</span></div>
   <p className="delay-boundary-note">Stops at the video boundaries.</p>
  </div>
 </div>;
}
