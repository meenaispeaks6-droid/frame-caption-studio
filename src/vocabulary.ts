import type { Word } from './types';
export type VocabularyEntry={term:string;aliases:string[]};
export const VOCABULARY_KEY='frame-vocabulary-v1';
export function parseVocabulary(text:string):VocabularyEntry[]{
 return text.split('\n').map(line=>{const [term,...aliases]=line.split('|');return {term:term.replace(/\0/g,'').trim().slice(0,64),aliases:aliases.join('|').split(',').map(s=>s.replace(/\0/g,'').trim().slice(0,64)).filter(Boolean).slice(0,8)};}).filter(e=>e.term).slice(0,32);
}
export function hintsFor(entries:VocabularyEntry[],context:Word[]=[]){return [...new Set([...entries.map(e=>e.term),...context.filter(w=>(w.probability??0)>=.9).map(w=>w.text)])].slice(0,32);}
const clean=(s:string)=>s.toLocaleLowerCase().replace(/[\p{P}\s]/gu,'');
function oneEdit(a:string,b:string){
 if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,edits=0;
 while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}
 return edits+(a.length-i)+(b.length-j)===1;
}
export function suggestionsFor(words:Word[],index:number,entries:VocabularyEntry[]):string[]{
 entries=[...entries,{term:'ChatGPT',aliases:['chat gpt','chatjipiti']},{term:'YouTube',aliases:['yutub','you tube']},{term:'OpenAI',aliases:['open ai']},{term:'Python',aliases:['paithan']}];
 const w=words[index],text=clean(w.text),suggestions:string[]=[];
 for(const entry of entries)if(entry.term!==w.text&&(clean(entry.term)===text||entry.aliases.some(a=>clean(a)===text)||((w.probability??1)<.75&&text.length>=4&&oneEdit(text,clean(entry.term)))))suggestions.push(entry.term);
 // These are deliberately review-only: either form can be correct in speech.
 const prev=clean(words[index-1]?.text??'');
 if(['main','mein'].includes(prev)&&text==='hai')suggestions.push('hoon');
 if(['hum','aap'].includes(prev)&&text==='hai')suggestions.push('hain');
 if(['tool','tools','app','model','video','code'].includes(prev)&&text==='aye')suggestions.push('AI');
 return [...new Set(suggestions)].filter(s=>s!==w.text).slice(0,4);
}
export function retryRange(words:Word[],selected:string[],duration:number){
 const target=words.filter(w=>selected.includes(w.id));if(!target.length)throw Error('Select the uncertain words first.');
 const start=Math.min(...target.map(w=>w.start)),end=Math.max(...target.map(w=>w.end));
 if(end-start>20)throw Error('Select a phrase of 20 seconds or less for focused review.');
 return {start,end,contextStart:Math.max(0,start-2),contextEnd:Math.min(duration,end+2)};
}
export function mergeRetry(words:Word[],replacement:Word[],range:{start:number;end:number}){
 // Snap to all intersecting words so a partial selection cannot duplicate audio.
 return [...words.filter(w=>w.end<=range.start),...replacement,...words.filter(w=>w.start>=range.end)];
}
