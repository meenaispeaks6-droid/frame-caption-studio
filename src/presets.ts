import type { CaptionStyle, PresetId } from './types';
export const PRESETS: {id:PresetId;name:string;tag:string;description:string;words:string[];style:CaptionStyle}[] = [
 {id:'impact',name:'Impact Pop',tag:'MAKE A STATEMENT',description:'Big words. Bigger energy.',words:['MAKE','IT','HAPPEN.'],style:{preset:'impact',font:'Barlow Condensed',size:74,color:'#ffffff',accent:'#c5f568',strokeColor:'#161419',stroke:7,shadow:45,position:71,strength:75,grouping:3,uppercase:true}},
 {id:'power',name:'Power Highlight',tag:'OWN THE MOMENT',description:'Every word in the spotlight.',words:['A little','main character','energy.'],style:{preset:'power',font:'Inter',size:47,color:'#ffffff',accent:'#f8e34e',strokeColor:'#171717',stroke:1,shadow:30,position:71,strength:45,grouping:4,uppercase:false}},
 {id:'cinematic',name:'Clean Cinematic',tag:'LESS, BUT BETTER',description:'Quiet confidence. Beautiful type.',words:['Let your','story unfold.'],style:{preset:'cinematic',font:'Inter',size:45,color:'#fff8ed',accent:'#f4cf9c',strokeColor:'#181818',stroke:0,shadow:50,position:75,strength:45,grouping:5,uppercase:false}},
 {id:'bubble',name:'Bubble Bounce',tag:'A LITTLE PLAYFUL',description:'A soft landing for bold ideas.',words:['good','things','ahead'],style:{preset:'bubble',font:'Nunito',size:54,color:'#ffffff',accent:'#f5a8d8',strokeColor:'#332345',stroke:5,shadow:25,position:71,strength:80,grouping:3,uppercase:false}},
 {id:'desi',name:'Desi Punch',tag:'APNI VIBE',description:'Your language. Full power.',words:['APNA','TIME','AAYEGA'],style:{preset:'desi',font:'Noto Sans Devanagari',size:54,color:'#ffffff',accent:'#ff9457',strokeColor:'#211816',stroke:5,shadow:40,position:71,strength:65,grouping:3,uppercase:false}}
];
export const DEFAULT_STYLE = PRESETS[0].style;
