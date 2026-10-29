import {chromium} from 'playwright-core';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
mkdirSync(root+'test-results',{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4192'],{cwd:root,stdio:'pipe'});let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4192')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4192');await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 const report=await page.evaluate(async()=>{
 const {PRESETS}=await import('/src/presets.ts'),{drawCaptions}=await import('/src/render.ts'),{loadFonts}=await import('/src/fonts.ts'),{layoutStyledCaption}=await import('/src/caption-layout.ts');await loadFonts();
 const failures=[],rows=[];let cases=0,frames=0;
 const c=document.createElement('canvas'),ctx=c.getContext('2d');let texts=[],boxes=[];
 function rect(x,y,w,h){const m=ctx.getTransform(),points=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};}
 const fill=ctx.fillText.bind(ctx);ctx.fillText=(text,x,y)=>{const m=ctx.measureText(text);if(ctx.globalAlpha>.02)texts.push({...rect(x-m.actualBoundingBoxLeft,y-m.actualBoundingBoxAscent,m.actualBoundingBoxLeft+m.actualBoundingBoxRight,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent),text});fill(text,x,y);};
 const round=ctx.roundRect.bind(ctx);ctx.roundRect=(x,y,w,h,r)=>{if(ctx.globalAlpha>.02)boxes.push(rect(x,y,w,h));return round(x,y,w,h,r);};
 function overlap(a,b){return Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;}
 for(const p of PRESETS.slice(6))for(const [width,height] of [[720,1280],[720,720],[1280,720],[1080,1920]])for(const scenario of ['default','long','edge','motion']){
  c.width=width;c.height=height;
  const words=(scenario==='long'?['Supercalifragilisticexpialidocious','भाई','आज','AI tool आया है']:['Make','something','amazing']).map((text,i)=>({id:String(i),text,start:.1+i*.32,end:.42+i*.32,emphasis:i===1}));
  const motion={in:{name:'hook-left',duration:.25,intensity:100,easing:'spring'},hold:{name:'zoom',duration:.4,intensity:100,easing:'linear'},out:{name:'slide-down',duration:.2,intensity:100,easing:'ease-out'}};
  if(scenario==='motion')words[1].wordTransitions=motion;
  const style={...p.style,...(scenario==='long'?{size:100,stroke:12,lines:3}:{}),...(scenario==='edge'?{size:100,strength:100,positionX:100,position:100,align:'right',background:'#182b41',lines:1}:{}),...(scenario==='motion'?{transitions:motion,positionX:0,position:0}: {})};
  const layout=layoutStyledCaption(ctx,width,height,words,style),signature=JSON.stringify(layout.tokens.map(t=>[t.x,t.y,t.width]));
  if(layout.lines.length>(style.lines??2))failures.push({id:p.id,scenario,error:'line count'});
  if(style.size!== (scenario==='long'||scenario==='edge'?100:p.style.size))failures.push({id:p.id,error:'selected font changed'});
  for(const time of [.1,.14,.24,.43,.52,.72,.87,.99]){
   texts=[];boxes=[];ctx.clearRect(0,0,width,height);const bounds=drawCaptions(ctx,width,height,time,[words],style);frames++;
   if(bounds&&(bounds.x<width*.06-.1||bounds.y<height*.05-.1||bounds.x+bounds.width>width*.94+.1||bounds.y+bounds.height>height*.95+.1))failures.push({id:p.id,scenario,time,error:'outside safe bounds',bounds});
   for(const [kind,items] of [['text',texts],['box',boxes]])for(let i=0;i<items.length;i++){
    const a=items[i];if(a.left<width*.06-.5||a.right>width*.94+.5||a.top<height*.05-.5||a.bottom>height*.95+.5)failures.push({id:p.id,scenario,time,kind,error:'visible overflow',a});
    for(let j=i+1;j<items.length;j++)if(overlap(a,items[j]))failures.push({id:p.id,scenario,time,kind,error:'overlap',a,b:items[j]});
   }
   if(p.id==='akshar'&&texts.some(t=>words.find(w=>w.text===t.text)?.start>time))failures.push({id:p.id,error:'future text revealed'});
  }
  const after=layoutStyledCaption(ctx,width,height,words,style);if(JSON.stringify(after.tokens.map(t=>[t.x,t.y,t.width]))!==signature)failures.push({id:p.id,error:'unstable layout'});
  cases++;
 }
 const retro=PRESETS.find(p=>p.id==='retro').style;layoutStyledCaption(ctx,720,1280,[{id:'mono',text:'iWWW',start:0,end:1}],retro);if(Math.abs(ctx.measureText('iiii').width-ctx.measureText('WWWW').width)>.01)failures.push({error:'retro lost monospace fallback'});
 // Tracking must remain proportional at 480px mobile preview and 1080p export.
 for(const p of PRESETS.filter(p=>['retro','wide'].includes(p.id))){const group=[{id:'x',text:'MAKE AMAZING THINGS',start:0,end:1}];const a=layoutStyledCaption(ctx,480,854,group,p.style),b=layoutStyledCaption(ctx,1080,1920,group,p.style);if(Math.abs(a.tokens[0].width/480-b.tokens[0].width/1080)>.002)failures.push({id:p.id,error:'tracking not resolution independent'});}
 // Layout measurement is cached between animation frames on the same context.
 let measurements=0;const original=ctx.measureText.bind(ctx);ctx.measureText=t=>{measurements++;return original(t);};
 const group=[{id:'cache',text:'cached layout',start:0,end:1}],style=PRESETS.find(p=>p.id==='sticker').style;drawCaptions(ctx,c.width,c.height,.2,[group],style);measurements=0;drawCaptions(ctx,c.width,c.height,.3,[group],style);if(measurements>2)failures.push({error:'repeated full layout measurement',measurements});
 return {cases,frames,failures:failures.slice(0,30)};
 });
 writeFileSync(root+'test-results/style-layout-report.json',JSON.stringify(report,null,2));console.log('STYLE_LAYOUT',JSON.stringify(report));assert.deepEqual(report.failures,[]);
 // Exercise the actual export worker for every new style, across all three aspect ratios.
 const dimensions=[[720,1280],[720,720],[1280,720]];
 for(const [width,height] of dimensions)execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`color=c=0x181c24:s=${width}x${height}:r=30:d=1.5`,'-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=1.5','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',root+`test-results/styles-source-${width}x${height}.mp4`]);
 const ids=['sticker','blast','retro','glass','scribble','akshar','boxkaraoke','pillline','wide','neon'],exports=[];
 for(const [index,id] of ids.entries()){
  const [width,height]=dimensions[index%dimensions.length];
  const result=await page.evaluate(async({id,width,height})=>{
   const {PRESETS}=await import('/src/presets.ts'),{drawCaptions}=await import('/src/render.ts');const style=PRESETS.find(p=>p.id===id).style;
   const words=['Bhai','AI','amazing'].map((text,i)=>({id:String(i),text,start:.1+i*.35,end:.45+i*.35,emphasis:i===1}));
   const blob=await(await fetch(`/test-results/styles-source-${width}x${height}.mp4`)).blob(),file=new File([blob],'style-test.mp4'),worker=new Worker(new URL('/src/export.worker.ts',location.href),{type:'module'});
   const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Export timed out')),120000);worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};worker.onmessage=({data})=>{if(data.type==='done'){clearTimeout(timer);resolve(data);}if(data.type==='error'){clearTimeout(timer);reject(Error(data.message));}};worker.postMessage({type:'render',file,info:{width,height,duration:1.5,hasAudio:true,name:file.name},words,style,options:{resolution:720,format:'mp4'}});}).finally(()=>worker.terminate());
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),video=document.createElement('video');video.muted=true;const url=URL.createObjectURL(file);video.src=url;await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=reject;});
   const previews=[];for(const time of [.3,.7]){video.currentTime=time;await new Promise(resolve=>video.onseeked=resolve);ctx.drawImage(video,0,0);drawCaptions(ctx,width,height,time,[words],style);previews.push(canvas.toDataURL().split(',')[1]);}video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);
   return {mp4:Array.from(new Uint8Array(await result.blob.arrayBuffer())),previews};
  },{id,width,height});
  const path=root+`test-results/style-${id}.mp4`;writeFileSync(path,Buffer.from(result.mp4));const streams=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',path],{encoding:'utf8'})).streams;const v=streams.find(s=>s.codec_type==='video');assert.equal(v.codec_name,'h264');assert.equal(v.width,width);assert.equal(v.height,height);assert.ok(Math.abs(Number(v.duration)-1.5)<.05,'export duration');assert.equal(streams.find(s=>s.codec_type==='audio').codec_name,'aac');execFileSync('ffmpeg',['-v','error','-i',path,'-f','null','-']);
  const pcm=path=>execFileSync('ffmpeg',['-v','error','-i',path,'-vn','-ac','1','-ar','16000','-f','f32le','-']);const sourcePcm=pcm(root+`test-results/styles-source-${width}x${height}.mp4`),exportPcm=pcm(path);assert.equal(exportPcm.length,sourcePcm.length,'audio sample count');const correlation=(lag=0,trim=0)=>{let dot=0,aa=0,bb=0;for(let i=Math.max(trim,trim+lag);i<Math.min(sourcePcm.length/4-trim,exportPcm.length/4-trim+lag);i++){const a=sourcePcm.readFloatLE(i*4),b=exportPcm.readFloatLE((i-lag)*4);dot+=a*b;aa+=a*a;bb+=b*b;}return dot/Math.sqrt(aa*bb);};const audioCorrelation=correlation(),interiorCorrelation=correlation(0,3200),bestLag=[-160,-80,-1,0,1,80,160].map(lag=>({lag,c:correlation(lag,3200)})).sort((a,b)=>b.c-a.c)[0].lag;assert.ok(audioCorrelation>.99,'whole-track AAC fidelity');assert.ok(interiorCorrelation>.999,'interior audio fidelity');assert.equal(bestLag,0,'audio synchronization');
  const parity=[];for(const [i,time] of [.3,.7].entries()){
   const frame=root+`test-results/style-${id}-${time}.png`;execFileSync('ffmpeg',['-y','-v','error','-ss',String(time),'-i',path,'-frames:v','1',frame]);const exported=readFileSync(frame).toString('base64');
   const comparison=await page.evaluate(async([preview,exported])=>{
    const arrays=[];for(const png of [preview,exported]){const img=await createImageBitmap(await(await fetch('data:image/png;base64,'+png)).blob()),canvas=new OffscreenCanvas(img.width,img.height),ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);img.close();arrays.push(ctx.getImageData(0,0,canvas.width,canvas.height).data);}
    let intersection=0,union=0,delta=0;for(let i=0;i<arrays[0].length;i+=4){const a=arrays[0],b=arrays[1],isCaption=p=>Math.max(Math.abs(p[i]-24),Math.abs(p[i+1]-28),Math.abs(p[i+2]-36))>35,aa=isCaption(a),bb=isCaption(b);intersection+=aa&&bb?1:0;union+=aa||bb?1:0;if(aa||bb)delta+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);}return {intersection,union,iou:intersection/Math.max(1,union),meanDifference:delta/Math.max(1,union*3)};
   },[result.previews[i],exported]);assert.ok(comparison.intersection>30&&comparison.iou>.8&&comparison.meanDifference<12,`${id} preview/export mismatch: ${JSON.stringify(comparison)}`);parity.push({time,...comparison});
  }
  exports.push({id,width,height,audioCorrelation,interiorCorrelation,bestLag,parity});console.log('STYLE_MP4_PASS',JSON.stringify(exports.at(-1)));
 }
 await page.setViewportSize({width:412,height:915});
 await page.getByRole('button',{name:'Templates',exact:true}).first().click();
 for(const name of ['Tairta Sticker','Keyword Blast','Retro Block','Sheesha Pill','Scribble Line','Akshar Reveal','Box Karaoke','Pill Line','Cinematic Wide','Neon Pink']){const card=page.getByRole('button',{name:new RegExp(name)});await card.click();assert.equal(await card.getAttribute('aria-pressed'),'true');}
 await page.screenshot({path:root+'test-results/new-styles-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Close editing panel',exact:true}).last().click();
 await page.screenshot({path:root+'test-results/new-styles-mobile-preview.png'});
 writeFileSync(root+'test-results/style-export-report.json',JSON.stringify(exports,null,2));assert.deepEqual(errors,[]);console.log('CAPTION_STYLES_PASS');
}finally{await browser?.close();server.kill('SIGTERM');}
