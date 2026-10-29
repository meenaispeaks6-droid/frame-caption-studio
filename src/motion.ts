import type { Motion, Transitions } from './types';
export function motionAt(transitions:Transitions|undefined,age:number,remaining:number){
 let alpha=1,scale=1,x=0,y=0,rotate=0;
 for(const phase of ['in','hold','out'] as const){const m=transitions?.[phase];if(!m||m.name==='none')continue;
 const duration=Math.max(.02,m.duration),raw=Math.max(0,Math.min(1,(phase==='out'?remaining:age)/duration));
 const eased=m.easing==='linear'?raw:m.easing==='spring'?1-Math.exp(-raw*7)*Math.cos(raw*10):1-(1-raw)**3;
 const amount=phase==='hold'?Math.sin(age/duration*Math.PI)*.08:(1-eased),strength=m.intensity/100;
 if(m.name==='fade')alpha*=phase==='hold'?1-Math.abs(amount)*strength:Math.max(0,Math.min(1,eased));
 if(['pop','zoom','scale'].includes(m.name))scale*=1+amount*strength*(m.name==='pop'?-.4:m.name==='zoom'?.18:-.2);
 if(m.name==='slide-up')y+=amount*strength*40;
 if(m.name==='rise-up'){y+=amount*strength*24;alpha*=Math.max(0,Math.min(1,1-Math.abs(amount)));}
 if(m.name==='slide-down')y-=amount*strength*40;
 if(m.name==='rise-down'){y-=amount*strength*24;alpha*=Math.max(0,Math.min(1,1-Math.abs(amount)));}
 if(m.name==='slide-left')x+=amount*strength*40;
 if(m.name==='hook-left'){x+=amount*strength*32;y-=Math.abs(amount)*strength*12;rotate-=amount*strength*.12;}
 if(m.name==='slide-right')x-=amount*strength*40;
 }
 return {alpha,scale,x,y,rotate};
}

export function readTransitions(value:unknown):Transitions|undefined{
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid caption transitions.');
 const result:Transitions={};
 for(const phase of ['in','hold','out'] as const){const m=(value as Transitions)[phase];if(m===undefined)continue;
 if(!m||!['none','fade','pop','zoom','scale','slide-up','slide-down','slide-left','slide-right','rise-up','rise-down','hook-left'].includes(m.name)||!['linear','ease-out','spring'].includes(m.easing)||!Number.isFinite(m.duration)||m.duration<.05||m.duration>2||!Number.isFinite(m.intensity)||m.intensity<0||m.intensity>100)throw new Error('Invalid motion settings.');
 result[phase]={name:m.name,duration:m.duration,intensity:m.intensity,easing:m.easing} as Motion;
 }return result;
}
