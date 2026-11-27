// Run from Itacan/ after npm run build. Every file and profile belongs to this run.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,copyFile,rename,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {_electron} from 'playwright-core';
import {samplePdf} from './sample-pdf.mjs';

const require=createRequire(import.meta.url);
const directory=await mkdtemp(path.join(tmpdir(),'itacan-commitment-desktop-'));
const library=path.join(directory,'Library');
const profile=path.join(directory,'Profile');
const workfile=path.join(library,'itacan-work.json');
const disk=async()=>JSON.parse(await readFile(workfile,'utf8'));
let desktop;
try {
  await mkdir(library);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  desktop=await _electron.launch({executablePath:require('electron'),env,args:['--user-data-dir='+profile,path.resolve('build/app')]});
  const page=await desktop.firstWindow();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.context().setOffline(true);
  page.setDefaultTimeout(8000);
  const btn=name=>page.getByRole('button',{name,exact:true});
  const dlg=()=>page.getByRole('dialog').last();
  const db=name=>dlg().getByRole('button',{name,exact:true});
  await desktop.evaluate(({dialog},selected)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[selected]});},library);
  await btn('Choose a folder').click();
  await btn('New project').waitFor();
  const papers=path.join(library,'Resources','Literature','Papers');
  await mkdir(path.join(papers,'Incoming'),{recursive:true});
  await copyFile('examples/Field Library/Projects/Forest survey/canopy.jpg',path.join(papers,'Incoming','Canopy.jpg'));
  await writeFile(path.join(papers,'Incoming','Sampling.pdf'),samplePdf());
  await btn('New project').click();
  await dlg().getByLabel('Name').fill('Measurements');await db('Create').click();
  await btn('Measurements').click();
  await btn('Attach Resource folder').click();
  await dlg().getByLabel('Resource',{exact:true}).selectOption('Literature');
  await db('Papers').click();await db('Attach folder').click();
  await btn('Literature / Papers').click();
  await btn('Quick Add').click();
  await dlg().getByLabel('Capture text').fill('Calibrate instrument');
  await db('Create task…').click();await db('Projects/Measurements').click();
  for(const name of ['Literature / Papers','Incoming','Canopy.jpg','Choose']) await db(name).click();
  await db('Add task').click();await db('Close dialog').click();
  await btn('Location').click();
  await page.waitForFunction(()=>document.querySelector('.media-image')?.naturalWidth>0);
  assert.equal((await disk()).lastLayout.workspace,'Projects/Measurements');
  await btn('Workspace').click();
  // Moving the parent outside Itacan leaves the original source unavailable.
  await rename(path.join(papers,'Incoming'),path.join(papers,'Relocated'));
  await btn('Location').click();
  await dlg().getByRole('heading',{name:'Relink task source'}).waitFor();
  for(const name of ['Literature / Papers','Relocated','Sampling.pdf','Choose']) await db(name).click();
  await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  await btn('Location').click();
  await page.locator('.pdf-text-layer').getByText('Sampling methods').waitFor();
  assert.equal((await disk()).tasks[0].owner,'Projects/Measurements');
  await btn('Workspace').click();
  await btn('Roadmap').click();await db('Add milestone').click();
  await dlg().getByLabel('Name').fill('Dataset release');
  await dlg().getByLabel('Milestone date').fill('2026-12-15');await db('Save').click();
  await db('Dataset release').waitFor();await db('Done').click();

  async function start(condition) {
    await btn('The Oath').click();
    assert.equal(await dlg().getByLabel('Workspace',{exact:true}).inputValue(),'Projects/Measurements');
    await dlg().getByLabel('Fulfilment').selectOption(condition);
    await dlg().getByRole('checkbox',{name:'Calibrate instrument'}).check();
    await db('Take Oath').click();await btn('The Oath · active').waitFor();
  }
  await start('Until selected tasks are complete');
  const refused=await page.evaluate(async()=>{
    const {library}=await window.itacan.home();
    try { await window.itacan.entries(library.session,'Resources/Explorations'); return false; }
    catch {return true;}
  });
  assert.equal(refused,true);
  await btn('The Oath · active').click();
  await dlg().getByRole('checkbox',{name:'Calibrate instrument'}).check();
  await dlg().getByText('Oath fulfilled',{exact:true}).waitFor();await db('Done').click();
  assert.equal((await disk()).oathHistory[0].status,'fulfilled');

  await page.getByText('Completed (1)',{exact:true}).click();
  await page.getByLabel('Reopen Calibrate instrument',{exact:true}).uncheck();
  await start('Fixed duration');
  await btn('The Oath · active').click();await db('Break Oath').click();
  await db('Keep Oath').click();assert.equal((await disk()).oath.status,'active');
  await db('Break Oath').click();await db('Break Oath').click();
  await dlg().getByText('Oath broken',{exact:true}).waitFor();await db('Done').click();
  await btn('Oaths').click();
  await page.getByText(/^Oath fulfilled ·/).waitFor();
  await page.getByText(/^Oath broken ·/).waitFor();
  const state=await disk();
  assert.equal(state.oath,null);
  assert.deepEqual(state.oathHistory.map(o=>o.status),['broken','fulfilled']);
  assert.equal(state.roadmaps['Projects/Measurements'][0].title,'Dataset release');
  assert.equal(state.tasks.length,1);
  assert.deepEqual(errors,[]);
  console.log('Passed shared image/PDF task source, relink, Project roadmap, Oath fulfilment, deliberate Break and history.');
} finally {
  if(desktop) {
    await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(win=>win.destroy())).catch(()=>{});
    await desktop.close().catch(()=>{});
  }
  await rm(directory,{recursive:true,force:true,maxRetries:4,retryDelay:200});
}
