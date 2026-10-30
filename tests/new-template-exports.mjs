// Real preview/export regression for the new template family. Generates local test media; no ASR or network models.
import {chromium} from 'playwright-core';
import {spawn,execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname,out=root+'test-results/new-template-exports';mkdirSync(out,{recursive:true});
execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=0x202020:s=360x640:r=30:d=2','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',out+'/source.mp4']);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4322'],{stdio:'pipe'});let browser;
const names=['Uthta Glow','Bada Scale','Gradient Keyword','Haath Orange','Hara Box','Peela Marker','Gulabi Dabba','Lal Outline','Narangi Chhaya','Neon Neela','Typewriter Akshar','Dheere Glow'];
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4322')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4322');await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 let pick=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import video',exact:true}).click();await(await pick).setFiles(out+'/source.mp4');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 pick=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import SRT / VTT',exact:true}).click();await(await pick).setFiles({name:'captions.srt',mimeType:'text/plain',buffer:Buffer.from('1\n00:00:00,100 --> 00:00:01,900\nAlpha Beta Gamma\n')});await page.getByRole('textbox',{name:'Word text',exact:true}).first().waitFor();
 await page.getByRole('button',{name:'Templates',exact:true}).first().click();const results=[];
 for(const name of names.filter(n=>!process.env.FRAME_TEMPLATE_ONLY||n===process.env.FRAME_TEMPLATE_ONLY)){
  const card=page.getByRole('button',{name:new RegExp('^'+name)});await card.click();assert.equal(await card.getAttribute('aria-pressed'),'true');
  await page.getByRole('slider',{name:'Seek video',exact:true}).fill('1.2');await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.seeking&&Math.abs(v.currentTime-1.2)<.01;});await page.waitForTimeout(150);
  writeFileSync(out+'/'+name.replaceAll(' ','-')+'-preview.png',Buffer.from(await page.locator('.video-frame canvas').evaluate(c=>c.toDataURL().split(',')[1]),'base64'));
  const preview=await page.locator('.video-frame canvas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,mask=[];for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-32)+Math.abs(d[i+1]-32)+Math.abs(d[i+2]-32)>100)mask.push(i/4);return {width:c.width,height:c.height,mask};});assert.ok(preview.mask.length>100,'empty preview '+name);
  await page.getByRole('button',{name:'Export video',exact:true}).click();await page.getByRole('button',{name:'Render MP4',exact:true}).click();await page.getByRole('button',{name:'Download video',exact:true}).waitFor({timeout:180000});const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download video',exact:true}).click();const path=out+'/'+name.replaceAll(' ','-')+'.mp4';await(await event).saveAs(path);
  const p=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'})),v=p.streams.find(s=>s.codec_type==='video');assert.equal(v.width,360);assert.equal(v.height,640);assert.ok(p.streams.some(s=>s.codec_type==='audio'));assert.ok(Math.abs(Number(p.format.duration)-2)<.1);execFileSync('ffmpeg',['-v','error','-i',path,'-f','null','-']);
  execFileSync('ffmpeg',['-y','-v','error','-ss','1.2','-i',path,'-frames:v','1',out+'/'+name.replaceAll(' ','-')+'-export.png']);
  const rgb=execFileSync('ffmpeg',['-v','error','-ss','1.2','-i',path,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:1024*1024}),exportMask=new Set();for(let i=0;i<rgb.length;i+=3)if(Math.abs(rgb[i]-32)+Math.abs(rgb[i+1]-32)+Math.abs(rgb[i+2]-32)>100)exportMask.add(i/3);
  let intersection=0;for(const i of preview.mask)if(exportMask.has(i))intersection++;const union=preview.mask.length+exportMask.size-intersection,iou=intersection/union;assert.ok(iou>.8,'preview/export mismatch '+name+' '+iou);results.push({name,dimensions:[v.width,v.height],audio:true,duration:Number(p.format.duration),fullyDecoded:true,previewPixels:preview.mask.length,exportPixels:exportMask.size,iou});console.log('NEW_TEMPLATE_PASS',JSON.stringify(results.at(-1)));await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 }
 assert.deepEqual(errors,[]);writeFileSync(out+'/new-template-exports.json',JSON.stringify(results,null,2));console.log('NEW_TEMPLATES_ALL_PASS');
}finally{await browser?.close();server.kill('SIGTERM');}
