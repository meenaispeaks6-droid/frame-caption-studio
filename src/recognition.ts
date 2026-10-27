import type {Word} from './types';
export interface SpeechResult {text:string;chunks?:{text:string;timestamp:[number|null,number|null]}[]}
const normalized=(s:string)=>s.replace(/[\s\p{P}]/gu,'').toLowerCase();
export function repetitive(text:string){const words=text.trim().split(/\s+/);return words.length>18&&new Set(words).size<words.length*.12;}
export function reliableWords(result:SpeechResult,duration:number):Word[]|null{
 const chunks=(result.chunks??[]).filter(c=>c.text.trim());if(!chunks.length)return result.text.trim()?null:[];
 let previous=0;const words:Word[]=[];
 for(const c of chunks){const [start,end]=c.timestamp;if(start===null||end===null||!Number.isFinite(start)||!Number.isFinite(end)||start<previous-.025||start<0||end<=Math.max(start,previous)||end>duration+.06)return null;words.push({id:crypto.randomUUID(),text:c.text.trim(),start:Math.max(previous,start),end:Math.min(duration,end),timing:'word'});previous=end;}
 return normalized(chunks.map(c=>c.text).join(' '))===normalized(result.text)?words:null;
}
/** Only model-emitted segment boundaries are used. Never distribute word times. */
export function phraseFallback(primary:SpeechResult,segmented:SpeechResult,duration:number):Word[]|null{
 const text=primary.text.trim()&&!repetitive(primary.text)?primary.text.trim():segmented.text.trim();
 if(!text||repetitive(text))return null;
 const segments=(segmented.chunks??[]).filter(c=>c.text.trim());if(!segments.length)return null;
 let previous=0;for(const s of segments){const [a,b]=s.timestamp;if(a===null||b===null||!Number.isFinite(a)||!Number.isFinite(b)||a<previous-.025||a<0||b<=Math.max(a,previous)||a>=duration)return null;previous=b;}
 if(normalized(segments.map(s=>s.text).join(' '))!==normalized(text))return [{id:crypto.randomUUID(),text,start:segments[0].timestamp[0]!,end:Math.min(duration,segments.at(-1)!.timestamp[1]!),timing:'segment',breakAfter:true}];
 return segments.map(s=>({id:crypto.randomUUID(),text:s.text.trim(),start:s.timestamp[0]!,end:Math.min(duration,s.timestamp[1]!),timing:'segment',breakAfter:true}));
}
