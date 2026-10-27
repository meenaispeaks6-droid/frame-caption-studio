// Real production-worker Hindi result -> real render worker -> decoded MP4.
// Run speech-quality and the auto speech-worker case first. No ASR stubs.
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname,source=process.env.HINDI_TEST_FILE;
if(!source)throw Error('Set HINDI_TEST_FILE to the same private recording used by speech-quality.');
const records=JSON.parse(readFileSync(root+'test-results/speech-challenging.json','utf8'));
const speech=records.find(r=>r.variant==='auto')?.result;
assert.equal(speech?.type,'done');assert.equal(speech.detectedLanguage,'hi');assert.ok(speech.words.length>0);
const input=root+'test-results/speech-export-source.mp4',output=root+'test-results/speech-export.mp4';
execFileSync('ffmpeg',['-y','-v','error','-ss','0.2','-t','7','-i',source,'-map','0:v:0','-map','0:a:0','-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-movflags','+faststart',input]);
const server=await createServer({server:{host:'127.0.0.1',port:4196,hmr:false,watch:null}});await server.listen();let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4196');
 const result=await page.evaluate(async words=>{
  const {renderVideo}=await import('/src/exporter.ts'),{inspectMedia}=await import('/src/media.ts'),{PRESETS}=await import('/src/presets.ts');
  const blob=await(await fetch('/test-results/speech-export-source.mp4')).blob(),file=new File([blob],'speech.mp4');const info=await inspectMedia(file);
  const style={...PRESETS.find(p=>p.id==='desi').style,position:76};
  const r=await renderVideo(file,info,words,style,{resolution:720,format:'mp4'},new AbortController().signal,()=>{});
  return {base64:new Uint8Array(await r.blob.arrayBuffer()).toBase64(),width:r.width,height:r.height};
 },speech.words);
 writeFileSync(output,Buffer.from(result.base64,'base64'));execFileSync('ffmpeg',['-v','error','-i',output,'-f','null','-']);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output],{encoding:'utf8'}));
 assert.equal(Math.min(result.width,result.height),720);assert.ok(probe.streams.some(s=>s.codec_name==='aac'));assert.ok(Math.abs(Number(probe.format.duration)-7)<.1);
 const floats=file=>{const b=execFileSync('ffmpeg',['-v','error','-i',file,'-vn','-ac','1','-ar','16000','-f','f32le','-']);return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
 const a=floats(input),b=floats(output);let best={lagSamples:0,correlation:-1};
 for(let lag=-160;lag<=160;lag++){let xy=0,xx=0,yy=0;for(let i=16000;i<64000;i++){xy+=a[i]*b[i+lag];xx+=a[i]**2;yy+=b[i+lag]**2;}const correlation=xy/Math.sqrt(xx*yy);if(correlation>best.correlation)best={lagSamples:lag,correlation};}
 assert.equal(best.lagSamples,0);assert.ok(best.correlation>.99);
 writeFileSync(root+'test-results/speech-export.json',JSON.stringify({scope:'Actual saved Small q8 Hindi inference result; matching 0.2–7.2 second source excerpt; no ASR stubs; real render worker',preset:'desi',words:speech.words.length,fullyDecoded:true,width:result.width,height:result.height,audio:best,duration:Number(probe.format.duration),recognitionErrorsRemain:true},null,2));
 console.log('REAL_HINDI_SPEECH_EXPORT_PASS');
}finally{await browser?.close();await server.close();}
