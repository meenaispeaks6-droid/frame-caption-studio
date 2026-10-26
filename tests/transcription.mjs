import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync,writeFileSync,existsSync,readFileSync,renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
mkdirSync(root+'test-results',{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4174'],{cwd:root,stdio:'pipe'});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4174')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,proxy:{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'},args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({acceptDownloads:true});
 // The managed proxy CA is trusted by curl but not this Chromium profile.
 // Forward only public model GETs via curl with TLS verification enabled.
 mkdirSync('/workspace/model-test-cache',{recursive:true});
 const pending=new Map();
 await context.route('https://huggingface.co/**',async route=>{
  const url=route.request().url();assert.equal(route.request().method(),'GET');
  const cache='/workspace/model-test-cache/'+createHash('sha256').update(url).digest('hex');
  if(!existsSync(cache)){if(!pending.has(cache))pending.set(cache,new Promise((resolve,reject)=>{const p=spawn('curl',['-fLsS','--retry','2','--max-time','180',url,'-o',cache+'.partial']);p.on('error',reject);p.on('exit',code=>{if(code===0){renameSync(cache+'.partial',cache);resolve();}else reject(new Error('Model download failed: '+code));});}));await pending.get(cache);}
  await route.fulfill({status:200,headers:{'Content-Type':url.endsWith('.json')?'application/json':'application/octet-stream','Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin'},body:readFileSync(cache)});
 });const page=await context.newPage();const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,250));});page.on('requestfailed',r=>console.log('NETWORK_FAILURE',r.url().split('?')[0],r.failure()?.errorText));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1')&&!r.url().startsWith('blob:'))requests.push({url:r.url().split('?')[0],method:r.method()});});
 await page.goto('http://127.0.0.1:4174');await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);await page.getByRole('button',{name:'Transcript',exact:true}).click();await page.getByRole('button',{name:'Generate captions',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Generate captions',exact:true}).click();
 let last='';const began=Date.now();while(Date.now()-began<480000){const alert=await page.getByRole('alert').count();if(alert)throw new Error(await page.getByRole('alert').innerText());const job=page.locator('.job-tray');if(await job.count()){const status=await job.innerText();if(status!==last){console.log(status.replace(/\n/g,' ').slice(0,250));last=status;}}else if(Date.now()-began>1500)break;await page.waitForTimeout(1000);}
 assert.equal(await page.locator('.job-tray').count(),0,'transcription completed within eight minutes');const words=await page.getByRole('textbox',{name:'Word text',exact:true}).evaluateAll(nodes=>nodes.map(n=>n.value));console.log('TRANSCRIPTION',words.join(' '));assert.ok(words.length>=8);assert.match(words.join(' '),/story|word|ignore/i);
 const project=await page.evaluate(()=>JSON.parse(localStorage.getItem('frame-caption-project-v1')));writeFileSync(root+'test-results/transcription-result.json',JSON.stringify({project,requests,errors,elapsedMs:Date.now()-began},null,2));assert.ok(project.words.every(w=>Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.start<w.end));assert.ok(requests.every(r=>r.method==='GET'),'no media upload requests');assert.deepEqual(errors,[]);console.log('REAL_LOCAL_TRANSCRIPTION_PASS');
}finally{await browser?.close();server.kill('SIGTERM');}
