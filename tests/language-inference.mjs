// Real production speech worker + local WASM models. No ASR mocks.
import {chromium} from 'playwright-core';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,existsSync,renameSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
mkdirSync(root+'test-results',{recursive:true});
const hindiFile=process.env.HINDI_TEST_FILE;
if(!hindiFile)throw Error('Set HINDI_TEST_FILE to a private local Hindi speech recording. It is never uploaded.');
execFileSync('ffmpeg',['-v','error','-ss','0.2','-t','7','-i',hindiFile,'-vn','-ac','1','-ar','16000','-f','f32le','-y',root+'test-results/hindi-speech.f32']);
execFileSync('ffmpeg',['-v','error','-i',root+'public/demo/voice.wav','-t','6','-ac','1','-ar','16000','-f','f32le','-y',root+'test-results/english-speech.f32']);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4186'],{cwd:root,stdio:'pipe'});let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4186')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext();const pending=new Map(),requests=[];mkdirSync('/workspace/model-test-cache',{recursive:true});
 await context.route('https://huggingface.co/**',async route=>{
  const url=route.request().url();assert.equal(route.request().method(),'GET');requests.push({url:url.split('?')[0],method:'GET'});
  const cache='/workspace/model-test-cache/'+createHash('sha256').update(url).digest('hex');
  if(!existsSync(cache)){if(!pending.has(cache))pending.set(cache,new Promise((resolve,reject)=>{const p=spawn('curl',['-fLsS','--retry','2','--max-time','240',url,'-o',cache+'.partial']);p.on('error',reject);p.on('exit',code=>{if(code===0){renameSync(cache+'.partial',cache);resolve();}else reject(Error('Model download failed '+code));});}));await pending.get(cache);}
  await route.fulfill({status:200,headers:{'Content-Type':url.endsWith('.json')?'application/json':'application/octet-stream','Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin'},body:readFileSync(cache)});
 });
 await context.route('**/test-results/*-speech.f32',route=>route.fulfill({status:200,contentType:'application/octet-stream',body:readFileSync(root+'test-results/'+new URL(route.request().url()).pathname.split('/').at(-1))}));
 const page=await context.newPage();page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text().slice(0,300));});await page.goto('http://127.0.0.1:4186');
 const scenarios=[
  {name:'Hindi same',file:'hindi',language:'hindi',captionLanguage:'same'},
  {name:'Hindi auto same',file:'hindi',language:'auto',captionLanguage:'same'},
  {name:'Hinglish same',file:'hindi',language:'hinglish',captionLanguage:'same'},
  {name:'English same',file:'english',language:'english',captionLanguage:'same'},
  {name:'Hindi to English',file:'hindi',language:'hindi',captionLanguage:'english'},
  {name:'English to Hindi',file:'english',language:'english',captionLanguage:'hindi'},
 ];
 const workerPath='/assets/'+readdirSync(root+'dist/assets').find(n=>n.startsWith('transcribe.worker-')&&n.endsWith('.js'));
 const selected=process.env.LANGUAGE_TEST_TRANSCRIPTION_ONLY?scenarios.slice(0,4):process.env.LANGUAGE_TEST_TRANSLATION_ONLY?scenarios.slice(4):scenarios;
 const results=process.env.LANGUAGE_TEST_TRANSLATION_ONLY&&existsSync(root+'test-results/language-inference.json')?JSON.parse(readFileSync(root+'test-results/language-inference.json')).results.filter(r=>r.captionLanguage==='same'):[];
 for(const scenario of (process.env.LANGUAGE_TEST_SINGLE?selected.slice(0,1):selected)){
  console.log('START',scenario.name);const began=Date.now();
  const result=await page.evaluate(async ({scenario,workerPath,asrModel})=>{
   const audio=new Float32Array(await(await fetch(`/test-results/${scenario.file}-speech.f32`)).arrayBuffer());
   const worker=new Worker(new URL(workerPath,location.href),{type:'module'});
   try{return await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Speech inference exceeded 8 minutes')),480000);worker.onmessage=({data})=>{if(data.type==='error'){clearTimeout(timeout);reject(Error(data.message));}if(data.type==='done'){clearTimeout(timeout);resolve(data);}};worker.onerror=e=>reject(Error(e.message));worker.postMessage({type:'transcribe',diagnostics:true,audio,model:asrModel,duration:audio.length/16000,...scenario},[audio.buffer]);});}finally{worker.terminate();}
  },{scenario,workerPath,asrModel:process.env.ASR_TEST_MODEL??'base'});
  console.log('RAW',JSON.stringify(result));
  writeFileSync(root+'test-results/language-last-result.json',JSON.stringify(result,null,2));
  assert.ok(result.words.length>2,scenario.name+' produced speech captions');
  assert.ok(result.words.every(word=>!/[\p{L}\p{M}]/u.test(word.text.replace(/[A-Za-z]/g,''))),scenario.name+' Latin-only');
  assert.ok(result.words.every((word,i)=>word.end>word.start&&(i===0||word.start>=result.words[i-1].end)),scenario.name+' timings');
  assert.equal(result.translated,scenario.captionLanguage!=='same');assert.equal(result.timingEstimated,scenario.captionLanguage!=='same');
  const output={...scenario,result,elapsedMs:Date.now()-began};results.push(output);console.log('RESULT',scenario.name,result.words.map(w=>w.text).join(' '));
  writeFileSync(root+'test-results/language-inference.json',JSON.stringify({scope:'Real Whisper Base and local translation models, browser WASM, private Hindi clip + original English sample. Model GETs use TLS-valid curl test transport; no uploads.',results,requests},null,2));
 }
 assert.ok(requests.every(r=>r.method==='GET'));console.log('REAL_LANGUAGE_INFERENCE_PASS');
}finally{await browser?.close();server.kill('SIGTERM');}
