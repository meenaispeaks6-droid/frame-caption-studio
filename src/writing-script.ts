import { romanizeText, romanizeWords } from './romanize';
import type { WritingScript } from './types';

/** Keep native Unicode text intact, or romanize once without changing timing. */
export function formatWords<T extends {text:string}>(words:T[],script:WritingScript='roman'):T[]{
 return script==='native'?words.map(word=>({...word})):romanizeWords(words);
}
export function formatText(text:string,script:WritingScript='roman'):string{
 return script==='native'?text:romanizeText(text);
}
