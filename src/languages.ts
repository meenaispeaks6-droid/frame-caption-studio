import type { LanguageSettings } from './types';

export const SPOKEN_LANGUAGES = [
 ['auto','Auto Detect'],['hindi','Hindi'],['english','English'],['hinglish','Hinglish (Hindi + English)'],
 ['arabic','Arabic'],['bengali','Bengali'],['chinese','Chinese'],['dutch','Dutch'],['french','French'],
 ['german','German'],['greek','Greek'],['gujarati','Gujarati'],['hebrew','Hebrew'],['indonesian','Indonesian'],
 ['italian','Italian'],['japanese','Japanese'],['kannada','Kannada'],['korean','Korean'],['malay','Malay'],
 ['malayalam','Malayalam'],['marathi','Marathi'],['nepali','Nepali'],['persian','Persian'],['polish','Polish'],
 ['portuguese','Portuguese'],['punjabi','Punjabi'],['romanian','Romanian'],['russian','Russian'],
 ['spanish','Spanish'],['swedish','Swedish'],['tamil','Tamil'],['telugu','Telugu'],['thai','Thai'],
 ['turkish','Turkish'],['ukrainian','Ukrainian'],['urdu','Urdu'],['vietnamese','Vietnamese'],
] as const;
export const DEFAULT_LANGUAGES:LanguageSettings={spoken:'auto',caption:'same',model:'small'};
export function readLanguageSettings(value:unknown):LanguageSettings{
 if(value===undefined||value===null)return {...DEFAULT_LANGUAGES};
 const v=value as LanguageSettings;
 if(!SPOKEN_LANGUAGES.some(([id])=>id===v.spoken)||!['same','english','hindi','hinglish'].includes(v.caption)||!['tiny','base','small','shruti'].includes(v.model))throw new Error('Invalid language settings in this project.');
 if(v.audioMode&&!['original','light','center'].includes(v.audioMode))throw new Error('Invalid speech audio option.');
 return {spoken:v.spoken,caption:v.caption,model:v.model,audioMode:v.audioMode??'original'};
}
