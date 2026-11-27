// Exercise editing and undo in two live panes on a long offline manuscript.
import { _electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import storage from '../main/library.cjs';

const tmp=await mkdtemp(path.join(tmpdir(),'itacan-long-manuscript-'));
const root=path.join(tmp,'Manuscripts');
let app;
try {
  await mkdir(root);
  const library=await storage.openLibrary(root,true);
  await library.create('Projects','Measurements','folder');
  const section=n=>'## Sample '+n+'\n\n'+
    'Measurements are compared with the baseline and repeated after the instrument returns to room temperature. '.repeat(2)+
    'The median is reported separately from the mean. '+(n%40===0?'\n\n$$\ny = a x^2 + b\n$$':'')+'\n\n';
  const text=Array.from({length:3000},(_,i)=>section(i).trimEnd().padEnd(297,' ')+'\n\n').join('');
  const note=path.join(root,'Projects','Measurements','Manuscript.md');
  await writeFile(note,text);
  const appCopy=path.join(tmp,'app');
  await cp('build/app',appCopy,{recursive:true});
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),env,
    args:['--user-data-dir='+path.join(tmp,'profile'),appCopy]});
  const page=await app.firstWindow();page.setDefaultTimeout(20000);
  await page.context().setOffline(true);
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},root);
  const btn=name=>page.getByRole('button',{name,exact:true});
  await btn('Choose a folder').click();
  await btn('Measurements').click();
  const start=performance.now();
  await page.getByRole('option').filter({hasText:'Manuscript.md'}).dblclick();
  await btn('Live Preview').click();await page.locator('.cm-content').waitFor();
  const openMs=performance.now()-start;
  await page.locator('.tabs [data-path]').click({button:'right'});
  await page.getByRole('menuitem',{name:'Split right',exact:true}).click();
  const editors=page.locator('.cm-content');
  await editors.nth(1).waitFor();
  const targets=page.locator('.pane');
  assert.equal(await targets.nth(1).getByRole('button',{name:'Live Preview'}).getAttribute('aria-pressed'),'true');
  const first=editors.first(),second=editors.nth(1);
  await first.press('Control+Home');
  const insert=performance.now();
  await page.keyboard.insertText('Long-note edit ');
  await page.waitForFunction(()=>[...document.querySelectorAll('.cm-content')].every(el=>el.innerText.includes('Long-note edit')));
  const inputMs=performance.now()-insert;
  await second.press('Control+z');
  await page.waitForFunction(()=>[...document.querySelectorAll('.cm-content')].every(el=>!el.innerText.includes('Long-note edit')));
  await second.press('Control+End');
  await page.waitForFunction(()=>document.querySelectorAll('.cm-scroller')[1].scrollTop>10000);
  assert.equal(await page.locator('.cm-scroller').first().evaluate(el=>el.scrollTop),0);
  assert.equal(await readFile(note,'utf8'),text);
  assert.deepEqual(errors,[]);
  console.log('Long manuscript',Buffer.byteLength(text),'bytes, 3000 sections, 75 equations: open through Live Preview',Math.round(openMs),'ms; input through two mounted panes',Math.round(inputMs),'ms. Cross-pane undo and independent scrolling passed.');
} finally {
  if(app) {
    await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy();}).catch(()=>{});
    await app.close().catch(()=>{});
  }
  await rm(tmp,{recursive:true,force:true,maxRetries:12,retryDelay:125});
}
