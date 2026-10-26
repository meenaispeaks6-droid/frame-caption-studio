import { chromium, devices } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
mkdirSync(root+'test-results',{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173'],{cwd:root,stdio:'pipe'});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4173')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text());});
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);await page.waitForTimeout(1500);
 const capabilities=await page.evaluate(async()=>({ua:navigator.userAgent,videoEncoder:typeof VideoEncoder,audioEncoder:typeof AudioEncoder,mp4:typeof VideoEncoder!=='undefined'&&(await VideoEncoder.isConfigSupported({codec:'avc1.42001f',width:720,height:1280,bitrate:5000000,framerate:30})).supported,vp9:typeof VideoEncoder!=='undefined'&&(await VideoEncoder.isConfigSupported({codec:'vp09.00.10.08',width:720,height:1280,bitrate:5000000,framerate:30})).supported}));
 console.log('CAPABILITIES',JSON.stringify(capabilities));writeFileSync(root+'test-results/capabilities.json',JSON.stringify(capabilities,null,2));
 await page.getByRole('slider',{name:'Seek video'}).fill('1.15');await page.waitForTimeout(200);await page.screenshot({path:root+'test-results/desktop.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'desktop horizontal overflow');
 for(const name of ['Power Highlight','Clean Cinematic','Bubble Bounce','Desi Punch','Impact Pop']){await page.getByRole('button',{name:new RegExp(name)}).first().click();await page.waitForTimeout(120);}
 await page.getByRole('button',{name:'Transcript',exact:true}).click();await page.getByRole('textbox',{name:'Word text',exact:true}).first().fill('Every');await page.getByRole('textbox',{name:'Word text',exact:true}).first().press('Tab');
 await page.getByRole('button',{name:'Export video',exact:true}).click();await page.waitForTimeout(800);
 if(capabilities.mp4){
  await page.getByRole('button',{name:'Render MP4',exact:true}).click();
  await page.getByRole('button',{name:'Download video',exact:true}).waitFor({timeout:180000});
  await page.screenshot({path:root+'test-results/export-ready.png'});console.log('EXPORT_READY',await page.getByRole('dialog').innerText());const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download video',exact:true}).click();const download=await downloadPromise;await download.saveAs(root+'test-results/export-720p.mp4');
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',root+'test-results/export-720p.mp4'],{encoding:'utf8'}));
  writeFileSync(root+'test-results/export-720p.ffprobe.json',JSON.stringify(probe,null,2));assert.equal(probe.streams.find(s=>s.codec_type==='video').width,720);assert.equal(probe.streams.find(s=>s.codec_type==='video').height,1280);assert.equal(probe.streams.find(s=>s.codec_type==='video').codec_name,'h264');assert.equal(probe.streams.find(s=>s.codec_type==='audio').codec_name,'aac');assert.ok(Math.abs(Number(probe.format.duration)-9)<.1);
  execFileSync('ffmpeg',['-v','error','-i',root+'test-results/export-720p.mp4','-f','null','-']);
  console.log('REAL_MP4_VERIFIED',probe.format.duration,probe.format.size);
 }else{console.log('NO_H264_ENCODER_IN_THIS_CHROMIUM');}
 await context.close();
 const mobile=await browser.newContext({...devices['Pixel 7'],acceptDownloads:true});const m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.message));await m.goto('http://127.0.0.1:4173');await m.waitForFunction(()=>document.querySelector('video')?.readyState>=2);await m.waitForTimeout(700);assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile horizontal overflow');await m.screenshot({path:root+'test-results/android-emulation.png',fullPage:true});await m.getByRole('button',{name:'Adjust',exact:true}).click();await m.getByRole('slider',{name:'Animation strength',exact:true}).fill('50');await mobile.close();
 assert.deepEqual(errors,[],'browser errors');console.log('BROWSER_TESTS_PASS');
}finally{await browser?.close();server.kill('SIGTERM');}
