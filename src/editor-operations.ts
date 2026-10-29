import type { Word } from './types';
export type BulkAction = 'punctuation' | 'emphasis' | 'gaps' | 'emojis';
export function bulkEdit(words:Word[],action:BulkAction):Word[]{
 if(action==='emphasis')return words.map(w=>({...w,emphasis:false}));
 if(action==='gaps')return words.map((w,i)=>({...w,end:words[i+1]?.start??w.end}));
 return words.map(w=>({...w,text:w.text.replace(action==='punctuation'?/[\p{P}]/gu:/(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)/gu,'').trim()})).filter(w=>w.text);
}
export function delayWords(words:Word[],delta:number,duration:number):Word[]{
 if(!words.length)return words;
 const shift=Math.max(-words[0].start,Math.min(delta,duration-words.at(-1)!.end));
 return words.map(w=>({...w,start:w.start+shift,end:w.end+shift}));
}
// Moving keeps all relative word offsets; resizing changes only the boundary word.
export function retime(words:Word[],ids:string[],delta:number,edge:'move'|'start'|'end',duration:number):Word[]{
 const first=words.findIndex(w=>w.id===ids[0]),last=words.findIndex(w=>w.id===ids.at(-1));
 if(first<0||last<first)return words;
 const lower=words[first-1]?.end??0,upper=words[last+1]?.start??duration;
 const d=edge==='move'?Math.max(lower-words[first].start,Math.min(delta,upper-words[last].end)):edge==='start'?Math.max(lower-words[first].start,Math.min(delta,words[first].end-words[first].start-.02)):Math.max(words[last].start+.02-words[last].end,Math.min(delta,upper-words[last].end));
 return words.map((w,i)=>i<first||i>last?w:({...w,start:w.start+(edge==='move'||edge==='start'&&i===first?d:0),end:w.end+(edge==='move'||edge==='end'&&i===last?d:0)}));
}
export function splitAt(words:Word[],time:number):Word[]{
 const index=words.findIndex((w,i)=>w.start>=time&&i>0);
 if(index<1)return words;
 return words.map((w,i)=>i===index-1?{...w,breakAfter:true,joinAfter:false}:w);
}
