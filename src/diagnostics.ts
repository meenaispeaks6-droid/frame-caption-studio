type Event={event:string;at:number;value?:number};
const allowed=new Set(['source.open','speech.start','speech.end','speech.failure','job.cancel','export.start','export.end','export.failure','audio.decode.failure']);
const events:Event[]=(()=>{try{const saved=JSON.parse(localStorage.getItem('frame-diagnostics')??'[]');return Array.isArray(saved)?saved.filter(e=>allowed.has(e.event)&&Number.isFinite(e.at)&&(!('value' in e)||Number.isFinite(e.value))).slice(-200).map(e=>({event:e.event,at:e.at,...(Number.isFinite(e.value)?{value:e.value}:{})})):[];}catch{return [];}})();
export function diagnostic(event:string,value?:number){if(!allowed.has(event))return;events.push({event,at:Date.now(),value});if(events.length>200)events.shift();try{localStorage.setItem('frame-diagnostics',JSON.stringify(events));}catch{}}
export function diagnostics(){return JSON.stringify(events,null,2);}
