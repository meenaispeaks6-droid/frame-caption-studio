import { chromium, devices } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url).pathname;
mkdirSync(root+'test-results',{recursive:true});
execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=0x302f39:s=1064x720:r=30:d=3','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',root+'test-results/handwritten-source.mp4']);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4176'],{cwd:root,stdio:'pipe'});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4176')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4176');await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 assert.equal(await page.getByRole('button',{name:/Reel Handwritten/}).getAttribute('aria-pressed'),'true');
 await page.getByRole('slider',{name:'Seek video'}).fill('1.15');await page.waitForTimeout(300);
 await page.screenshot({path:root+'test-results/handwritten-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Transcript',exact:true}).click();
 await page.getByRole('button',{name:'End phrase after great',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'End phrase after great',exact:true}).getAttribute('aria-pressed'),'true');
 await page.reload();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 await page.getByRole('button',{name:'Transcript',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'End phrase after great',exact:true}).getAttribute('aria-pressed'),'true','phrase break persists');

 const result=await page.evaluate(async()=>{
  const {loadFonts}=await import('/src/fonts.ts'),{drawCaptions}=await import('/src/render.ts'),{groupWords}=await import('/src/captions.ts'),{PRESETS}=await import('/src/presets.ts');
  await loadFonts();const style=PRESETS.find(p=>p.id==='handwritten').style;
  const words=['mujhse','zyaada','resources','hai'].map((text,i)=>({id:String(i),text,start:i*.35,end:(i+1)*.35}));
  words.push({id:'next',text:'apni kahani khud likho',start:1.4,end:2.7,breakAfter:true});
  words[3].breakAfter=true;
  const groups=groupWords(words,style.grouping),c=document.createElement('canvas');c.width=1064;c.height=720;
  const ctx=c.getContext('2d');const snap=t=>{ctx.clearRect(0,0,c.width,c.height);drawCaptions(ctx,c.width,c.height,t,groups,style);return c.toDataURL();};
  const first=snap(.1),held=snap(1.2),next=snap(1.4),silence=snap(2.8);
  snap(.1);const rgba=ctx.getImageData(0,0,c.width,c.height).data;let x0=1064,x1=0,y0=720,y1=0;
  for(let y=0;y<720;y++)for(let x=0;x<1064;x++)if(rgba[(y*1064+x)*4+3]>64){x0=Math.min(x,x0);x1=Math.max(x,x1);y0=Math.min(y,y0);y1=Math.max(y,y1);}
  const source=await(await fetch('/test-results/handwritten-source.mp4')).blob(),file=new File([source],'handwritten-source.mp4');
  const worker=new Worker(new URL('/src/export.worker.ts',location.href),{type:'module'});
  const rendered=await new Promise((resolve,reject)=>{worker.onmessage=({data})=>{if(data.type==='done')resolve(data);if(data.type==='error')reject(Error(data.message));};worker.onerror=e=>reject(Error(e.message));worker.postMessage({type:'render',file,info:{width:1064,height:720,duration:3,hasAudio:true,name:file.name},words,style,options:{resolution:720,format:'mp4'}});});worker.terminate();
  const v=document.createElement('video');v.src=URL.createObjectURL(file);v.muted=true;await new Promise(resolve=>v.onloadeddata=resolve);v.currentTime=1;await new Promise(resolve=>v.onseeked=resolve);ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(v,0,0);drawCaptions(ctx,c.width,c.height,1,groups,style);const preview=c.toDataURL();URL.revokeObjectURL(v.src);
  const fontLoaded=document.fonts.check('400 27px Mynerve');
  return {samePhraseStable:first===held,cutChanges:held!==next,silenceClear:!Array.from((()=>{ctx.clearRect(0,0,c.width,c.height);drawCaptions(ctx,c.width,c.height,2.8,groups,style);return ctx.getImageData(0,0,c.width,c.height).data;})()).some(Boolean),fontLoaded,bounds:{x0,x1,y0,y1},preview,png:first,mp4:Array.from(new Uint8Array(await rendered.blob.arrayBuffer()))};
 });
 assert.equal(result.fontLoaded,true);assert.equal(result.samePhraseStable,true);assert.equal(result.cutChanges,true);assert.equal(result.silenceClear,true);
 assert.ok(Math.abs((result.bounds.x0+result.bounds.x1)/2-532)<3);assert.ok(Math.abs((result.bounds.y0+result.bounds.y1)/2-360)<3);
 assert.ok(result.bounds.x1-result.bounds.x0>280&&result.bounds.x1-result.bounds.x0<345,'reference phrase width');
 assert.ok(result.bounds.y1-result.bounds.y0>22&&result.bounds.y1-result.bounds.y0<35,'reference letter height');
 writeFileSync(root+'test-results/handwritten-overlay.png',Buffer.from(result.png.split(',')[1],'base64'));
 writeFileSync(root+'test-results/handwritten-preview.png',Buffer.from(result.preview.split(',')[1],'base64'));
 writeFileSync(root+'test-results/handwritten-720p.mp4',Buffer.from(result.mp4));
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',root+'test-results/handwritten-720p.mp4'],{encoding:'utf8'}));
 assert.equal(probe.streams.find(s=>s.codec_type==='video').width,1064);assert.equal(probe.streams.find(s=>s.codec_type==='video').height,720);assert.equal(probe.streams.find(s=>s.codec_type==='video').codec_name,'h264');assert.equal(probe.streams.find(s=>s.codec_type==='audio').codec_name,'aac');
 execFileSync('ffmpeg',['-v','error','-i',root+'test-results/handwritten-720p.mp4','-f','null','-']);
 execFileSync('ffmpeg',['-y','-v','error','-ss','1','-i',root+'test-results/handwritten-720p.mp4','-frames:v','1',root+'test-results/handwritten-export-frame.png']);
 const pixels=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:10_000_000});
 const a=pixels(root+'test-results/handwritten-preview.png'),b=pixels(root+'test-results/handwritten-export-frame.png');let diff=0;
 for(let y=325;y<395;y++)for(let x=330;x<734;x++)for(let c=0;c<3;c++)diff+=Math.abs(a[(y*1064+x)*3+c]-b[(y*1064+x)*3+c]);
 const meanPixelDifference=diff/(70*404*3);assert.ok(meanPixelDifference<2,'preview and exported worker font/layout match');
 await page.getByRole('button',{name:'Export video',exact:true}).click();await page.getByRole('button',{name:'Render MP4',exact:true}).click();await page.getByRole('button',{name:'Download video',exact:true}).waitFor({timeout:180000});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download video',exact:true}).click();await(await download).saveAs(root+'test-results/handwritten-portrait-720p.mp4');
 execFileSync('ffmpeg',['-v','error','-i',root+'test-results/handwritten-portrait-720p.mp4','-f','null','-']);
 const mobile=await browser.newContext({...devices['Pixel 7']});const m=await mobile.newPage();await m.goto('http://127.0.0.1:4176');await m.waitForFunction(()=>document.querySelector('video')?.readyState>=2);await m.getByRole('button',{name:'Transcript',exact:true}).click();await m.getByRole('button',{name:'End phrase after great',exact:true}).click();assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await m.screenshot({path:root+'test-results/handwritten-mobile.png',fullPage:true});await mobile.close();
 assert.deepEqual(errors,[]);
 const report={font:'Mynerve 5.3.0 / SIL OFL-1.1',samePhraseStable:result.samePhraseStable,cutChanges:result.cutChanges,silenceClear:result.silenceClear,bounds:result.bounds,previewExportMeanPixelDifference:meanPixelDifference,landscapeMp4:{width:1064,height:720,codec:'h264',audio:'aac',fullyDecoded:true},portraitMp4:{fullyDecoded:true},phraseBreakPersistence:true,mobileEmulation:true};
 writeFileSync(root+'docs/validation-evidence/handwritten.json',JSON.stringify(report,null,2));console.log('HANDWRITTEN_PASS',JSON.stringify(report));
}finally{await browser?.close();server.kill('SIGTERM');}
