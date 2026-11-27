import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { launchElectron, setPickerPath } from './desktop/window.mjs';
import storage from '../main/library.cjs';

// One ordinary research Project and one damaged metadata copy. All files and
// both profiles are under the same new temporary test directory.
const tmp = await fs.mkdtemp(path.join(tmpdir(),'itacan-recovery-desktop-'));
const root = path.join(tmp,'Library');
let app, page;
const errors=[];
async function launch(profile) {
  app = await launchElectron(path.join(tmp, profile));
  page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.context().setOffline(true);
  await setPickerPath(app, root);
}
async function stop() {
  if (!app) return;
  await app.evaluate(({BrowserWindow})=>{ for (const win of BrowserWindow.getAllWindows()) win.destroy(); }).catch(()=>{});
  await app.close().catch(()=>{});
  app=null;
}
try {
  await fs.mkdir(root);
  const library=await storage.openLibrary(root,true);
  const folder=await library.create('Projects','Fieldwork','folder');
  const content='A field observation. '.repeat(95);
  for (let batch=0;batch<1000;batch+=25) {
    await Promise.all(Array.from({length:25},(_,i)=>{
      const n=batch+i;
      return fs.writeFile(path.join(root,folder,'File '+n+'.md'),content+(n===999?'\nSpectrographic fingerprint':''));
    }));
  }
  await launch('search-profile');
  await page.getByRole('button',{name:'Choose a folder',exact:true}).click();
  const search=page.getByRole('combobox',{name:'Search Itacan'});
  const timings={};
  for (const [label,query,result] of [
    ['body','spectrographic','Spectrographic fingerprint'],['filename','File 998','File 998.md'],
    ['repeatBody','spectrographic','Spectrographic fingerprint'],['repeatFilename','File 998','File 998.md']
  ]) {
    const start=performance.now();
    await search.fill(query);
    await page.getByRole('option').filter({hasText:result}).first().waitFor();
    timings[label]=Math.round(performance.now()-start);
    await search.press('Escape');
  }
  await stop();
  const damaged='{"version":1,"tasks":BROKEN';
  await fs.writeFile(path.join(root,'itacan-work.json'),damaged);
  await launch('recovery-profile');
  await page.getByRole('button',{name:'Choose a folder',exact:true}).click();
  await page.getByRole('heading',{name:'Library recovery'}).waitFor();
  await page.getByRole('button',{name:'Fieldwork',exact:true}).click();
  await page.getByRole('button',{name:'File 999.md',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('pre.prose')?.textContent.includes('Spectrographic fingerprint'));
  assert.match(await page.locator('pre.prose').innerText(),/Spectrographic fingerprint/);
  assert.equal(await fs.readFile(path.join(root,'itacan-work.json'),'utf8'),damaged);
  assert.deepEqual(errors,[]);
  console.log('Passed read-only recovery and offline 1000-note search. Query to visible result (ms):',timings);
} finally { await stop(); await fs.rm(tmp,{recursive:true,force:true,maxRetries:10,retryDelay:200}); }
