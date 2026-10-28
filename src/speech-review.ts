import type {Word} from './types';
import type {ShrutiResult} from './shruti';
const normalized=(s:string)=>s.replace(/[\s\p{P}]/gu,'').toLowerCase();
/** Never divide a segment into fictitious word times, or drop a zero-length
 * token. Coalesce invalid neighboring alignments using emitted boundaries. */
export function shrutiWords(result:ShrutiResult,duration:number):Word[]{
 const tokens=result.words??[];if(!result.text.trim())return [];
 if(!tokens.length||normalized(tokens.map(t=>t.word).join(' '))!==normalized(result.text))throw Error('Speech was recognized but word coverage could not be aligned. The transcript has been retained for manual timing.');
 const words:Word[]=[];let pending='';let previous=0;
 for(const token of tokens){
  if(!token.word.trim())continue;
  const valid=Number.isFinite(token.start)&&Number.isFinite(token.end)&&token.start>=previous-.025&&token.start>=0&&token.start<duration&&token.end>Math.max(token.start,previous)&&token.end<=duration+.06;
  if(!valid){pending=[pending,token.word].filter(Boolean).join(' ');continue;}
  const score=typeof token.probability==='number'&&Number.isFinite(token.probability)?Math.max(0,Math.min(1,token.probability)):undefined;
  words.push({id:crypto.randomUUID(),text:[pending,token.word].filter(Boolean).join(' '),start:Math.max(previous,token.start),end:Math.min(duration,token.end),timing:pending?'segment':'word',...(score!==undefined?{confidence:score}:{}),...((pending||score===undefined||score<.65)?{review:pending?'alignment' as const:'recognition' as const}:{})});pending='';previous=Math.min(duration,token.end);
 }
 if(pending){const last=words.at(-1);if(!last)throw Error('Speech was recognized without usable timing. The transcript has been retained for manual timing.');last.text+=' '+pending;last.timing='segment';last.review='alignment';}
 return words;
}
/** Keep acoustic windows disjoint; prefer a quiet boundary over cutting a word.
 * Copies passed into WASM are bounded to thirty seconds, even for long reels. */
export function boundedSpeechSpans(audio:Float32Array,spans:{start:number;end:number}[]){
 const result:{start:number;end:number}[]=[];
 for(const span of spans){let start=Math.round(span.start*16000),end=Math.min(audio.length,Math.round(span.end*16000));while(end-start>480000){let cut=start+480000,best=Infinity;for(let p=start+400000;p<=start+479680;p+=320){let energy=0;for(let i=p;i<p+320;i++)energy+=audio[i]**2;if(energy<best){best=energy;cut=p+160;}}result.push({start:start/16000,end:cut/16000});start=cut;}if(end>start)result.push({start:start/16000,end:end/16000});}
 return result;
}
