import { processingProfile } from './processing';
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
export const DEFAULT_LANGUAGES:LanguageSettings={spoken:'auto',caption:'same',model:typeof navigator==='undefined'?'small':processingProfile().model,modelPreference:'auto',processingMode:'auto',speechEngine:'auto',accuracyMode:'fast'};
export function readLanguageSettings(value:unknown):LanguageSettings{
 if(value===undefined||value===null)return {...DEFAULT_LANGUAGES};
 const v=value as LanguageSettings;
 if(!SPOKEN_LANGUAGES.some(([id])=>id===v.spoken)||!['same','english','hindi','hinglish'].includes(v.caption)||!['tiny','base','small'].includes(v.model))throw new Error('Invalid language settings in this project.');
 if(v.audioMode&&!['original','light','center'].includes(v.audioMode))throw new Error('Invalid speech audio option.');
 if(v.processingMode&&!['auto','mobile','standard'].includes(v.processingMode))throw Error('Invalid processing mode.');
 if(v.speechEngine&&!['auto','shruti','whisper'].includes(v.speechEngine))throw Error('Invalid speech engine.');
 if(v.accuracyMode&&!['fast','accuracy'].includes(v.accuracyMode))throw Error('Invalid speech accuracy mode.');
 return {speechEngine:v.speechEngine??(v.modelPreference==='auto'?'auto':'whisper'),accuracyMode:v.accuracyMode??'fast',processingMode:v.processingMode??'auto',modelPreference:v.modelPreference??'explicit',spoken:v.spoken,caption:v.caption,model:v.model,audioMode:v.audioMode??'original'};
}
