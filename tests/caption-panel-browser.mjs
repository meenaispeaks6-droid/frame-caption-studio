import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
mkdirSync(root+'test-results',{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4183'],{cwd:root,stdio:'pipe'});
let browser;
try {
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4183')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[];
 for(const width of [412,360,1440]){
  const ctx=await browser.newContext({viewport:{width,height:width===1440?1000:915},isMobile:width<900,hasTouch:width<900,deviceScaleFactor:1}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('frame-caption-project-v1'))),flush=()=>page.waitForTimeout(600);
  await page.goto('http://127.0.0.1:4183');await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);await flush();
  // A real imported MP4 backs preview and duration; use a deterministic editable transcript.
  const data=await saved();data.words=[{id:'a',text:'This',start:.5,end:.8},{id:'b',text:'is',start:.8,end:1},{id:'c',text:'completely',start:1,end:1.5},{id:'d',text:'free.',start:1.5,end:2},{id:'e',text:'AI',start:2.5,end:3},{id:'f',text:'tool!',start:3,end:3.5},{id:'g',text:'AI',start:4,end:4.5},{id:'h',text:'captions🔥',start:4.5,end:5}];data.style.grouping=4;data.style.maxChars=24;
  await page.addInitScript(data=>localStorage.setItem('frame-caption-project-v1',JSON.stringify(data)),data);await page.reload();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  if(width<900)await page.getByRole('button',{name:'Captions',exact:true}).first().click();
  await page.waitForTimeout(300);await page.screenshot({path:root+`test-results/captions-${width}.png`});
  await page.getByRole('button',{name:'Find and replace',exact:true}).click();await page.getByLabel('Search captions',{exact:true}).fill('ai');assert.equal(await page.locator('.caption-find-input output').textContent(),'1/2');
  await page.getByRole('button',{name:'Match case',exact:true}).click();assert.equal(await page.locator('.caption-find-input output').textContent(),'0/0');await page.getByRole('button',{name:'Match case',exact:true}).click();
  await page.getByRole('button',{name:'Next match',exact:true}).click();assert.equal(await page.locator('.caption-find-input output').textContent(),'2/2');await page.getByRole('button',{name:'Previous match',exact:true}).click();
  await page.getByLabel('Replacement text',{exact:true}).fill('ML');await page.locator('.caption-find').getByRole('button',{name:'Replace',exact:true}).click();await flush();assert.equal((await saved()).words[4].text,'ML');assert.equal((await saved()).words[6].text,'AI');
  // Keyboard undo remains available inside the modal sheet, with no background click.
  await page.getByLabel('Replacement text',{exact:true}).blur();await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Control+z');await flush();assert.equal((await saved()).words[4].text,'AI');
  await page.getByRole('button',{name:'Replace All',exact:true}).click();await flush();assert.equal((await saved()).words.filter(w=>w.text==='ML').length,2);await page.getByLabel('Replacement text',{exact:true}).blur();await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Control+z');await flush();
  await page.getByLabel('Search captions',{exact:true}).fill('AI tool');await page.getByLabel('Replacement text',{exact:true}).fill('smart tool');await page.locator('.caption-find').getByRole('button',{name:'Replace',exact:true}).click();await flush();const merged=(await saved()).words.find(w=>w.id==='e');assert.equal(merged.text,'smart tool!');assert.equal(merged.start,2.5);assert.equal(merged.end,3.5);assert.equal(merged.timing,'segment');
  await page.getByLabel('Search captions',{exact:true}).fill('free');await page.screenshot({path:root+`test-results/caption-find-${width}.png`});
  await page.getByRole('button',{name:'Close find and replace',exact:true}).click();await page.getByRole('button',{name:'Caption Tools',exact:true}).click();
  await page.getByRole('switch',{name:'Remove Punctuation',exact:true}).click();await flush();assert.equal((await saved()).words.some(w=>/[.!]/.test(w.text)),false);assert.equal(await page.getByRole('switch',{name:'Remove Punctuation',exact:true}).getAttribute('aria-checked'),'true');await page.getByRole('switch',{name:'Remove Punctuation',exact:true}).click();await flush();assert.equal((await saved()).words.some(w=>/[.!]/.test(w.text)),true);
  await page.getByRole('switch',{name:'Remove Emojis',exact:true}).click();await flush();assert.equal((await saved()).words.some(w=>w.text.includes('🔥')),false);await page.getByRole('switch',{name:'Remove Emojis',exact:true}).click();await flush();assert.equal((await saved()).words.some(w=>w.text.includes('🔥')),true);
  await page.getByRole('switch',{name:'Remove Punctuation',exact:true}).click();await page.getByRole('switch',{name:'Remove Emojis',exact:true}).click();await page.getByRole('switch',{name:'Remove Punctuation',exact:true}).click();await flush();assert.equal((await saved()).words.some(w=>/[.!]/.test(w.text)),true);assert.equal((await saved()).words.some(w=>w.text.includes('🔥')),false);await page.getByRole('switch',{name:'Remove Emojis',exact:true}).click();
  await page.getByLabel('Words per phrase',{exact:true}).selectOption('3');await page.getByLabel('Maximum characters',{exact:true}).fill('40');await page.getByRole('button',{name:'Reset maximum characters',exact:true}).click();await page.getByLabel('Caption lines',{exact:true}).selectOption('3');await flush();assert.equal((await saved()).style.maxChars,24);assert.equal((await saved()).style.lines,3);
  await page.locator('.caption-toolbar').scrollIntoViewIfNeeded();await page.screenshot({path:root+`test-results/caption-tools-${width}.png`});
  const initial=(await saved()).words.map(w=>[w.start,w.end]);const slider=page.getByLabel('Caption delay',{exact:true});await slider.fill('0.5');await slider.fill('0.75');await slider.press('Tab');await flush();assert.equal((await saved()).words[0].start,1.25);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Control+z');await flush();assert.deepEqual((await saved()).words.map(w=>[w.start,w.end]),initial);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Control+Shift+z');await flush();assert.equal((await saved()).words[0].start,1.25);
  await page.getByRole('button',{name:'Reset caption delay',exact:true}).click();await flush();assert.deepEqual((await saved()).words.map(w=>[w.start,w.end]),initial);
  await slider.fill('-5');await slider.press('Tab');await flush();assert.equal((await saved()).words[0].start,0);await page.getByRole('button',{name:'Reset caption delay',exact:true}).click();await flush();
  await page.locator('.caption-delay-card').scrollIntoViewIfNeeded();await page.screenshot({path:root+`test-results/caption-delay-${width}.png`});
  await page.getByRole('button',{name:'Caption Tools',exact:true}).click();await page.getByRole('button',{name:'Emphasize caption 1',exact:true}).click();await flush();assert.ok((await saved()).words[0].emphasis);await page.getByRole('button',{name:'Timing for caption 1',exact:true}).click();const start=page.getByLabel('This start time',{exact:true});await start.fill('0.6');await start.press('Tab');await flush();assert.equal((await saved()).words[0].start,.6);
  await page.getByRole('button',{name:'Group caption 1',exact:true}).click();await page.getByRole('button',{name:'Split after This',exact:true}).click();await flush();assert.equal((await saved()).words[0].breakAfter,true);
  await page.getByRole('button',{name:'Animate caption 1',exact:true}).click();assert.equal(await page.getByLabel('Transition scope',{exact:true}).inputValue(),'selected');await page.getByRole('button',{name:'pop',exact:true}).click();await flush();assert.equal((await saved()).words[0].transitions.in.name,'pop');assert.equal((await saved()).words[4].transitions,undefined);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await ctx.close();console.log('CAPTION_PANEL_PASS',width);
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();server.kill('SIGTERM');}
