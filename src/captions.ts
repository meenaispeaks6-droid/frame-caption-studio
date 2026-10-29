import { readTransitions } from './motion';
import type { Word } from './types';
export const uid = () => crypto.randomUUID();
export function validateWords(value: unknown, duration=Infinity): Word[] {
 if(!Array.isArray(value) || value.length>20000) throw new Error('Captions must contain fewer than 20,000 words.');
 let previous=0;
 return value.map((v:unknown,i)=>{
  const w=v as Word;
  if(!w || typeof w.text!=='string'||!w.text.trim()||w.text.length>(w.timing==='segment'?4000:160)||!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<previous||w.start<0||w.end<=w.start||w.end>duration+.1) throw new Error(`Check word ${i+1}: use text and increasing times within the video.`);
  previous=w.end;
  return {id:typeof w.id==='string'?w.id:uid(),text:w.text.trim(),start:w.start,end:w.end,emphasis:!!w.emphasis,breakAfter:!!w.breakAfter,joinAfter:!!w.joinAfter,transitions:readTransitions(w.transitions),wordTransitions:readTransitions(w.wordTransitions),timing:['word','segment','estimated'].includes(w.timing??'')?w.timing:undefined};
 });
}
export function groupWords(words:Word[],count:number,maxChars=Infinity):Word[][] {
 const groups:Word[][]=[]; let current:Word[]=[];
 for(const word of words){
  if(current.length && (word.timing==='segment' || current.at(-1)?.timing==='segment' || (!current.at(-1)?.joinAfter&&(current.length>=count || current.reduce((n,w)=>n+w.text.length+1,0)+word.text.length>maxChars)) || word.start-current[current.length-1].end>.6)){groups.push(current);current=[];}
  current.push(word);
  if(word.breakAfter || (!word.joinAfter&&/[.!?।]$/.test(word.text))){groups.push(current);current=[];}
 }
 if(current.length)groups.push(current);
 return groups;
}
export function activeGroup(groups:Word[][],time:number): Word[] | undefined {
 let lo=0,hi=groups.length-1;
 while(lo<=hi){const mid=(lo+hi)>>1,g=groups[mid];if(time<g[0].start)hi=mid-1;else if(time>=g[g.length-1].end)lo=mid+1;else return g;}
}
export function timeLabel(sec:number,ms=false){
 const ticks=ms?Math.round(Math.max(0,sec)*1000):Math.floor(Math.max(0,sec))*1000;return `${String(Math.floor(ticks/60000)).padStart(2,'0')}:${String(Math.floor(ticks/1000)%60).padStart(2,'0')}${ms?'.'+String(ticks%1000).padStart(3,'0'):''}`;
}
const srtTime=(t:number)=>`${String(Math.floor(t/3600)).padStart(2,'0')}:${timeLabel(t%3600,true).replace('.',',')}`;
export function toSrt(words:Word[],grouping:number,maxChars=Infinity){return groupWords(words,grouping,maxChars).map((g,i)=>`${i+1}\n${srtTime(g[0].start)} --> ${srtTime(g[g.length-1].end)}\n${g.map(w=>w.text).join(' ')}`).join('\n\n')+'\n';}
export function parseSrt(text:string,duration:number):Word[]{
 const blocks=text.replace(/\r/g,'').trim().split(/\n\s*\n/);const words:Word[]=[];
 const parse=(v:string)=>{const p=v.replace(',','.').split(':').map(Number);return p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1];};
 for(const block of blocks){const lines=block.split('\n'),i=lines.findIndex(x=>x.includes('-->'));if(i<0)continue;
  const [a,b]=lines[i].split('-->').map(x=>parse(x.trim().split(/\s/)[0]));const tokens=lines.slice(i+1).join(' ').replace(/<[^>]*>/g,'').trim().split(/\s+/).filter(Boolean);
  const step=(b-a)/tokens.length;tokens.forEach((word,j)=>words.push({id:uid(),text:word,start:a+j*step,end:a+(j+1)*step,breakAfter:j===tokens.length-1}));
 }
 if(!words.length)throw new Error('No subtitle cues found. Choose an SRT or VTT file.');
 return validateWords(words,duration);
}
export function wordsFromChunks(chunks:{text:string;timestamp:[number|null,number|null]}[],duration:number):Word[]{
 const result:Word[]=[];
 for(let i=0;i<chunks.length;i++){
  const c=chunks[i],text=c.text.trim(); if(!text)continue;
  const start=Math.max(result.at(-1)?.end??0,c.timestamp[0]??result.at(-1)?.end??0);
  const end=Math.min(duration,c.timestamp[1]??chunks[i+1]?.timestamp[0]??start+.4);
  if(end>start)result.push({id:uid(),text,start,end});
 }
 return result;
}
