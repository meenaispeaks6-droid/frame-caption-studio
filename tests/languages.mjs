// UI contract checks use a clearly labeled ASR stub. Actual local model inference
// is validated separately by transcription.mjs and the translation tests.
// The MP4 check below uses the real render worker, codecs and source audio.
import { chromium, devices } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url).pathname;
mkdirSync(root+'test-results',{recursive:true});
copyFileSync(root+'public/demo/story.mp4',root+'test-results/language-source.mp4');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',...(process.argv.includes('--dev')?[]:['preview']),'--host','127.0.0.1','--port','4185'],{cwd:root,stdio:'pipe'});
let browser;
const fixtures={
 hindi:'Aaj main tumhe ek kamaal ki trick batane wala hoon.',
 hinglish:'Guys aaj main tumhe ek amazing AI tool dikhane wala hoon.',
 english:'This AI tool is absolutely crazy.',
 hindiEnglish:'Today I am going to show you an amazing trick.',
 englishHindi:'Yeh AI tool bilkul kamaal ka hai.',
};
const installAsrStub=async context=>context.addInitScript(({fixtures})=>{
 const NativeWorker=window.Worker;
 window.__languageRequests=[];window.__renderWords=[];
 window.Worker=class extends EventTarget{
  constructor(url,options){
   super();
   if(!String(url).includes('transcribe.worker')){
    const worker=new NativeWorker(url,options),send=worker.postMessage.bind(worker);
    worker.postMessage=(message,transfer)=>{if(message.type==='render')window.__renderWords.push(message.words.map(w=>w.text));return send(message,transfer);};
    return worker;
   }
   this.stopped=false;
  }
  postMessage(message){
   if(message.type!=='transcribe')return;
   const {language,captionLanguage,model,duration}=message;
   window.__languageRequests.push({language,captionLanguage,model,duration});
   const source=language==='auto'?'hindi':language;
   const translated=captionLanguage!=='same'&&captionLanguage!==(source==='hinglish'?'hindi':source)&&!(source==='hindi'&&captionLanguage==='hinglish');
   let text=fixtures[source]??fixtures.english;
   if(captionLanguage==='english'&&source!=='english')text=fixtures.hindiEnglish;
   else if((captionLanguage==='hindi'||captionLanguage==='hinglish')&&source==='english')text=fixtures.englishHindi;
   const words=text.split(/\s+/).map((word,i,all)=>({id:`ui-asr-${i}`,text:word,start:i*.3,end:(i+1)*.3,breakAfter:i===all.length-1}));
   setTimeout(()=>{if(this.stopped)return;const data={type:'done',words,translated,timingEstimated:translated};const event=new MessageEvent('message',{data});this.onmessage?.(event);this.dispatchEvent(event);},50);
  }
  terminate(){this.stopped=true;}
 };
},{fixtures});
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('frame-caption-project-v1')));
const textWords=page=>page.getByRole('textbox',{name:'Word text',exact:true}).evaluateAll(nodes=>nodes.map(node=>node.value));
const assertLatin=words=>assert.ok(words.every(word=>!Array.from(word).some(char=>/[\p{L}\p{M}]/u.test(char)&&!/[A-Za-z]/.test(char))),'caption words must contain Latin letters only');
const dialogFor=page=>page.getByRole('dialog',{name:'Generate captions',exact:true});
async function openLanguageDialog(page){if(!await dialogFor(page).count())await page.getByRole('button',{name:'Auto captions',exact:true}).click();await dialogFor(page).waitFor();return dialogFor(page);}

try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4185')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await installAsrStub(context);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4185');await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 assert.equal(await dialogFor(page).count(),0,'bundled sample does not interrupt the initial studio');
 await page.locator('input[type=file]').first().setInputFiles(root+'test-results/language-source.mp4');
 let dialog=dialogFor(page);await dialog.waitFor();
 assert.equal(await dialog.getByRole('combobox',{name:'Spoken language',exact:true}).inputValue(),'auto');
 assert.equal(await dialog.getByRole('combobox',{name:'Caption language',exact:true}).inputValue(),'same');
 const spokenOptions=await dialog.getByRole('combobox',{name:'Spoken language',exact:true}).locator('option').evaluateAll(nodes=>nodes.map(node=>node.value));for(const language of ['urdu','spanish','japanese'])assert.ok(spokenOptions.includes(language),`${language} is offered as a spoken language`);
 await page.screenshot({path:root+'test-results/languages-import-dialog.png'});
 const scenarios=[
  {name:'Hindi → Same',spoken:'hindi',caption:'same',expected:fixtures.hindi},
  {name:'Hinglish → Same',spoken:'hinglish',caption:'same',expected:fixtures.hinglish},
  {name:'English → Same',spoken:'english',caption:'same',expected:fixtures.english},
  {name:'Hindi → English',spoken:'hindi',caption:'english',expected:fixtures.hindiEnglish},
  {name:'English → Hindi',spoken:'english',caption:'hindi',expected:fixtures.englishHindi},
  {name:'Auto → Same (Hindi fixture)',spoken:'auto',caption:'same',expected:fixtures.hindi},
  {name:'Regenerate with new selections',spoken:'english',caption:'hinglish',expected:fixtures.englishHindi},
 ];
 const outcomes=[];
 for(const scenario of scenarios){
  dialog=await openLanguageDialog(page);
  await dialog.getByRole('combobox',{name:'Spoken language',exact:true}).selectOption(scenario.spoken);
  await dialog.getByRole('combobox',{name:'Caption language',exact:true}).selectOption(scenario.caption);
  await dialog.getByRole('button',{name:'Generate captions',exact:true}).click();
  await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('.job-tray')===null);await page.waitForTimeout(100);
  const words=await textWords(page),project=await stored(page);
  assert.equal(words.join(' '),scenario.expected);assertLatin(words);
  assert.equal(project.languageSettings.spoken,scenario.spoken);assert.equal(project.languageSettings.caption,scenario.caption);
  const request=await page.evaluate(()=>window.__languageRequests.at(-1));assert.equal(request.language,scenario.spoken);assert.equal(request.captionLanguage,scenario.caption);assert.ok(Number.isFinite(request.duration)&&request.duration>0,'worker receives source duration');
  assert.ok(project.words.every(word=>word.start<word.end),'word timings retained');
  outcomes.push({...scenario,request,words:words.length});
 }
 const baseline=(await stored(page)).words.map(word=>word.text);
 await page.getByRole('button',{name:'Caption styles',exact:true}).click();
 const cards=page.locator('.preset-card');assert.equal(await cards.count(),6);
 for(let i=0;i<6;i++){await cards.nth(i).click();assert.deepEqual((await stored(page)).words.map(word=>word.text),baseline,'preset changes preserve the same Latin text');}
 await page.getByRole('button',{name:'Transcript',exact:true}).click();
 const subtitleEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download subtitles',exact:true}).click();const subtitles=await subtitleEvent;await subtitles.saveAs(root+'test-results/languages.srt');
 const subtitleText=readFileSync(root+'test-results/languages.srt','utf8');assertLatin([subtitleText]);assert.match(subtitleText,/AI/);

 const projectDownload=page.waitForEvent('download');await page.getByTitle('Download editable project').click();const download=await projectDownload;await download.saveAs(root+'test-results/languages.frame.json');
 const exported=JSON.parse(readFileSync(root+'test-results/languages.frame.json','utf8'));
 assert.equal(exported.languageSettings.spoken,'english');assert.equal(exported.languageSettings.caption,'hinglish');
 exported.languageSettings={...exported.languageSettings,spoken:'hindi',caption:'english'};
 await page.locator('input[type=file]').nth(2).setInputFiles({name:'language-project.frame.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 dialog=await openLanguageDialog(page);assert.equal(await dialog.getByRole('combobox',{name:'Spoken language',exact:true}).inputValue(),'hindi');assert.equal(await dialog.getByRole('combobox',{name:'Caption language',exact:true}).inputValue(),'english');await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.reload();await page.locator('input[type=file]').first().setInputFiles(root+'test-results/language-source.mp4');dialog=dialogFor(page);await dialog.waitFor();
 assert.equal(await dialog.getByRole('combobox',{name:'Spoken language',exact:true}).inputValue(),'hindi');assert.equal(await dialog.getByRole('combobox',{name:'Caption language',exact:true}).inputValue(),'english');await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();

 let mp4={tested:false,reason:'No H.264 encoder available'};
 const canEncode=await page.evaluate(async()=>typeof VideoEncoder!=='undefined'&&(await VideoEncoder.isConfigSupported({codec:'avc1.42001f',width:720,height:1280,bitrate:5000000,framerate:30})).supported);
 if(canEncode){
  await page.getByRole('button',{name:'Export video',exact:true}).click();await page.getByRole('button',{name:'Render MP4',exact:true}).click();await page.getByRole('button',{name:'Download video',exact:true}).waitFor({timeout:180000});
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download video',exact:true}).click();await(await event).saveAs(root+'test-results/languages-720p.mp4');
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',root+'test-results/languages-720p.mp4'],{encoding:'utf8'}));
  assert.equal(probe.streams.find(stream=>stream.codec_type==='video').codec_name,'h264');assert.equal(probe.streams.find(stream=>stream.codec_type==='audio').codec_name,'aac');
  execFileSync('ffmpeg',['-v','error','-i',root+'test-results/languages-720p.mp4','-f','null','-']);
  const renderedWords=await page.evaluate(()=>window.__renderWords.at(-1));assert.deepEqual(renderedWords,baseline);assertLatin(renderedWords);
  mp4={tested:true,realRenderWorker:true,fullyDecoded:true,width:probe.streams.find(stream=>stream.codec_type==='video').width,height:probe.streams.find(stream=>stream.codec_type==='video').height};
 }
 assert.deepEqual(errors,[]);await context.close();
 const mobile=await browser.newContext({...devices['Pixel 7']});await installAsrStub(mobile);const m=await mobile.newPage();await m.goto('http://127.0.0.1:4185');await m.waitForFunction(()=>document.querySelector('video')?.readyState>=2);await m.locator('input[type=file]').first().setInputFiles(root+'test-results/language-source.mp4');await dialogFor(m).waitFor();assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await m.screenshot({path:root+'test-results/languages-mobile-dialog.png',fullPage:true});await mobile.close();
 const report={scope:'UI language workflow uses ASR stub; MP4 is real; model inference tested separately',outcomes,allSixPresetsPreserveLatinText:true,subtitleLatin:true,jsonImportExport:true,languagePersistence:true,mobileDialog:true,mp4};
 writeFileSync(root+'test-results/languages-workflow.json',JSON.stringify(report,null,2));console.log('LANGUAGE_WORKFLOW_PASS',JSON.stringify(report));
}finally{await browser?.close();server.kill('SIGTERM');}
