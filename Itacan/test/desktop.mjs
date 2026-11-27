// Run against an isolated profile and a temporary copy of the example.
import { _electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { mkdtemp, cp, appendFile, readFile, writeFile, mkdir, rm, realpath, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {samplePdf} from './sample-pdf.mjs';

const require = createRequire(import.meta.url);
const tmp = await mkdtemp(path.join(tmpdir(), 'itacan-desktop-'));
const library = path.join(tmp, 'Field Library');
const fresh = path.join(tmp, 'Fresh library');
await cp('examples/Field Library', library, { recursive: true });
await appendFile(path.join(library,'Projects/Forest survey/Field notes.md'),
  '\n[Linked method](<../../Resources/Research/Papers/Sampling protocol.md#Method>)\n' + '\nReading position fixture.\n'.repeat(55));
await writeFile(path.join(library,'Projects/Forest survey/Companion.md'),'Second tab');
await writeFile(path.join(library,'Projects/Forest survey/Sampling.pdf'),samplePdf());
await writeFile(path.join(library,'Projects/Forest survey/Session.md'),'# Lab\n\nLocal equation $x^2 + y^2$.\n\n![Canopy](canopy.jpg)\n');
const fieldNote = 'Projects/Forest survey/Field notes.md';
const alternate = 'projects/FOREST SURVEY/field notes.md';
const testAliases = process.platform === 'win32' &&
  await realpath(path.join(library, alternate)).catch(() => null) === await realpath(path.join(library, fieldNote));
if (testAliases) {
  await writeFile(path.join(library, 'Projects/Forest survey/Links.md'),
    '[Alternate spelling](<../../projects/FOREST SURVEY/field notes.md>)');
  const layout = { active: 0, panes: [
    { tabs: [alternate, fieldNote], file: alternate, edit: false },
    { tabs: [alternate], file: alternate, edit: true }
  ] };
  await writeFile(path.join(library, 'itacan-work.json'), JSON.stringify({
    version: 1, tasks: [], inbox: [], plan: null, history: [], lastLayout: null,
    presets: [{ name: 'Legacy casing', layout }]
  }));
}
await mkdir(fresh);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const appCopy=path.join(tmp,'app');
await cp('build/app',appCopy,{recursive:true});
const options = { executablePath: require('electron'), env,
  args: ['--user-data-dir=' + path.join(tmp, 'profile'), appCopy] };
let desktop;
async function select(page, directory, control) {
  await desktop.evaluate(({ dialog }, selected) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
  }, directory);
  await page.getByRole('button', { name: control, exact: true }).click();
}
try {
  const started = performance.now();
  desktop = await _electron.launch(options);
  const errors = [];
  const remoteRequests = [];
  async function testWindow() {
    const page = await desktop.firstWindow();
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => { errors.push(error.message);console.error('Renderer exception:',error.message); });
    page.on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
    await page.context().setOffline(true);
    return page;
  }
  let page = await testWindow();
  const btn = name => page.getByRole('button', { name, exact: true });
  await btn('Choose a folder').waitFor();
  const timings = {launchToHome: Math.round(performance.now()-started)};
  async function measure(key,work) {
    const start = performance.now();
    await work();
    timings[key] = Math.round(performance.now()-start);
  }
  const bounds = selector => page.locator(selector).boundingBox();
  const dialog = () => page.getByRole('dialog').last();
  const db = name => dialog().getByRole('button',{name,exact:true});
  const item = name => page.getByRole('menuitem',{name,exact:true});
  const row = name => page.getByRole('option').filter({has:page.getByText(name,{exact:true})});
  const rail = name => page.locator('.file-tree').getByRole('button',{name,exact:true});
  const title = name => page.getByRole('heading',{name,exact:true});
  const source = () => page.getByRole('textbox',{name:'Markdown source'});
  async function screenshot(name) {
    const directory=process.env.ITACAN_TEST_SCREENSHOTS;
    if (!directory) return;
    await mkdir(directory,{recursive:true});
    await page.screenshot({path:path.join(directory,name+'.png')});
  }
  async function nameDialog(name,action) {
    await dialog().getByLabel('Name',{exact:true}).fill(name);
    await db(action).click();
  }
  async function renameItem(value) {
    const input=page.getByRole('textbox',{name:'Item name'});
    await input.fill(value); await input.press('Enter'); await input.waitFor({state:'hidden'});
  }
  async function context(control,action) {
    await control.click({button:'right'});
    if (['New tab','Right split'].includes(action)) await item('Open in…').click();
    await item(action).click();
  }
  async function capture(text) {
    const draft = page.getByLabel('Capture text');
    await draft.fill(text);
    await draft.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.capture-editor textarea')?.value==='');
  }
  await select(page, fresh, 'Choose a folder');
  await btn('Literature').waitFor();
  const fullscreen = () => desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen());
  assert.equal(await fullscreen(),false);
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMaximized()),true);
  for (const expected of [true,false]) {
    await desktop.evaluate(({BrowserWindow})=>{
      const win=BrowserWindow.getAllWindows()[0];
      win.focus(); win.webContents.focus();
      for (const type of ['keyDown','keyUp']) win.webContents.sendInputEvent({type,keyCode:'F11'});
    });
    for(let i=0;i<25 && await fullscreen()!==expected;i++) await new Promise(done=>setTimeout(done,40));
    assert.equal(await fullscreen(),expected);
  }
  assert.deepEqual(await page.locator('.home-panels > section:nth-child(-n+3) h2').allTextContents(),['Calendar','Plan','Tasks']);
  const agenda=page.locator('.calendar-agenda');
  const daysShown=await agenda.locator('.agenda-day').count();
  const calendarBox=await bounds('.calendar-panel');
  await agenda.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await page.waitForFunction(n=>document.querySelectorAll('.agenda-day').length===n+7,daysShown);
  await btn('Today').click();
  assert.deepEqual(await bounds('.calendar-panel'),calendarBox);
  assert.equal(await page.locator('.dashboard-cover + #navigation').count(),1);
  assert.equal(await page.locator('.home-section.panel .resource-grid').count(),1);
  await btn('New project').click(); await nameDialog('Experiment','Create');
  await screenshot('home');
  await btn('Experiment').scrollIntoViewIfNeeded();
  const resourceBounds = await bounds('.resource-grid');
  await context(btn('Experiment'),'Move to Future');
  assert.deepEqual(await bounds('.resource-grid'),resourceBounds);
  await btn('Future (1)').click();
  await context(btn('Experiment'),'Move to Active'); await btn('Active (1)').click();
  const navigationBounds = await bounds('#navigation');
  await measure('openWorkspace',async()=>{await btn('Experiment').click(); await btn('New folder').waitFor();});
  assert.deepEqual(await bounds('#navigation'),navigationBounds);
  const fileBounds = await bounds('.files');
  assert.equal(await btn('New note').isDisabled(),true);
  assert.deepEqual(await page.locator('.workspace-work h2').allTextContents(),['Files','Tasks','Progress']);
  await btn('New folder').click(); await renameItem('Run one'); await row('Run one').dblclick();
  assert.deepEqual(await bounds('.files'),fileBounds);
  await btn('New note').click(); await renameItem('Results'); await row('Results.md').dblclick(); await btn('Edit').click();
  assert.equal((await bounds('.tabs')).y,0);
  assert.equal(await page.locator('.desk-rail #navigation').count(),1);
  await source().fill('# Baseline'); await page.keyboard.press('Control+s');
  await page.getByText('Saved',{exact:true}).waitFor();
  const file = path.join(fresh,'Projects/Experiment/Run one/Results.md');
  assert.equal(await readFile(file,'utf8'),'# Baseline');
  await source().fill('Local draft'); await btn('Home').click(); await btn('Last File').click();
  assert.equal(await source().innerText(),'Local draft');
  await writeFile(file,'External change');
  await btn('Save').click(); await btn('Save a copy').click(); await db('Save copy').click();
  await title('Results copy').waitFor();
  assert.equal(await readFile(file,'utf8'),'External change');
  assert.equal(await readFile(file.replace('.md',' copy.md'),'utf8'),'Local draft');
  await rail('Collapse Run one').waitFor();
  await context(rail('Results.md'),'New tab');
  await title('Results').waitFor();
  assert.equal(await page.locator('.document-tab').count(),2);
  await measure('switchTab',async()=>{
    await page.locator('.tabs').getByText('Results copy.md',{exact:true}).click(); await title('Results copy').waitFor();
  });
  await page.locator('.tabs').getByText('Results.md',{exact:true}).click();
  const tab=name=>page.locator('.tabs').getByRole('button',{name,exact:true});
  await tab('Results.md').dragTo(tab('Results copy.md'),{targetPosition:{x:2,y:10}});
  await page.waitForFunction(()=>document.querySelector('.document-tab')?.dataset.file.endsWith('/Results.md'));
  assert.deepEqual(await page.locator('.tabs [data-path]').allTextContents(),['Results.md','Results copy.md']);
  const paneBox=await bounds('.pane');
  await rail('Results.md').dragTo(page.locator('.pane'),{targetPosition:{x:Math.floor(paneBox.width)-6,y:150}});
  await page.locator('.pane').nth(1).waitFor();
  const left = page.locator('.pane').first(), right=page.locator('.pane').nth(1);
  await left.getByRole('button',{name:'Edit',exact:true}).click();
  await left.getByRole('textbox').fill('Shared draft'); await right.locator('article').getByText('Shared draft').waitFor();
  await right.getByRole('button',{name:'Edit',exact:true}).click();
  await right.getByRole('textbox').fill('Shared edit');
  assert.equal(await left.getByRole('textbox').innerText(),'Shared edit');
  await page.keyboard.press('Control+s'); await left.getByText('Saved',{exact:true}).waitFor();
  assert.equal(await readFile(file,'utf8'),'Shared edit');
  const resize=page.getByRole('separator',{name:'Resize document split'});
  const originalWidth=(await left.boundingBox()).width;
  await resize.press('ArrowRight');
  const adjusted=(await left.boundingBox()).width;
  assert.ok(adjusted>originalWidth);
  await context(right.locator('.tabs [aria-pressed=true]'),'Split below');
  await page.locator('.pane').nth(2).waitFor();
  assert.ok(Math.abs((await left.boundingBox()).width-adjusted)<2);
  assert.equal(await page.locator('.split-group.stacked .pane').count(),2);
  await context(page.locator('.pane').nth(2).locator('.tabs [aria-pressed=true]'),'Close pane');
  await page.locator('.pane').nth(2).waitFor({state:'detached'});
  await left.locator('.tabs').getByText('Results copy.md',{exact:true}).dragTo(right.locator('.tabs'));
  await right.locator('.tabs').getByText('Results copy.md',{exact:true}).waitFor();
  await context(right.locator('.tabs').getByText('Results copy.md',{exact:true}),'Move to pane 1');
  await left.locator('.tabs').getByText('Results.md',{exact:true}).click();

  await btn('Presets').click(); await item('Save as new preset').click(); await nameDialog('Field desk','Save');
  await btn('Presets').click(); await context(item('Field desk'),'Rename'); await nameDialog('Review desk','Rename');
  await right.getByRole('textbox').fill('Draft retained by preset');
  await btn('Home').click();await btn('Presets').click();await item('Review desk').click();
  assert.equal(await right.getByRole('textbox').innerText(),'Draft retained by preset');
  await left.getByText('Draft retained by preset',{exact:true}).waitFor();
  await left.getByText('Unsaved changes',{exact:true}).waitFor();
  await right.getByRole('textbox').fill('Shared edit');
  await btn('Workspace').click(); await row('Results.md').click();
  assert.equal(await row('Results.md').getAttribute('aria-selected'),'true');
  await row('Results copy.md').click({modifiers:['Control']});
  assert.equal(await page.locator('.file-row[aria-selected=true]').count(),2);
  await screenshot('workspace');
  await row('Results copy.md').click(); await row('Results copy.md').press('Control+c');
  await page.locator('.folder-crumbs').getByText('Experiment').click();
  await row('Run one').press('Control+v'); await row('Results copy.md').waitFor();
  assert.equal(await readFile(path.join(fresh,'Projects/Experiment/Results copy.md'),'utf8'),'Local draft');
  await row('Run one').dblclick(); await btn('Modified').click();
  await page.getByRole('separator',{name:'Folder navigation width'}).press('ArrowRight');
  await btn('Add task').click(); await page.getByLabel('Title',{exact:true}).fill('Review results');
  await db('Projects/Experiment').click(); assert.equal(await dialog().getByLabel('Workspace',{exact:true}).inputValue(),'Projects/Experiment'); await db('Run one').click();
  await db('Results.md').click(); await db('Choose').click();
  await dialog().getByText('Add steps',{exact:true}).click(); await db('Add step').click();
  const taskActions = await bounds('dialog[open] footer');
  await page.getByLabel('Step text').fill('Check baseline');
  assert.deepEqual(await bounds('dialog[open] footer'),taskActions);
  await db('Due date').click(); await page.locator('input[type=date]:visible').fill('2028-06-11'); await db('Apply').click();
  await db('Due date').click(); await screenshot('task-properties'); await page.locator('.task-property-fields:visible').getByText('Cancel').click();
  await db('Repeat task').click(); await page.getByLabel('Repeat frequency').selectOption('weekly'); await db('Apply').click();
  await db('Set importance').click(); await dialog().getByRole('combobox').selectOption({label:'Must do'}); await db('Apply').click();
  await db('Add task').click(); await btn('Review results').waitFor();
  await measure('openQuickAdd',async()=>{await btn('Quick Add').click();await page.getByLabel('Capture text').waitFor();});
  const draft=page.getByLabel('Capture text');
  assert.equal(await draft.evaluate(n=>n===document.activeElement),true);
  await draft.fill('Collect sample'); assert.equal(await db('Choose files').isDisabled(),true);
  await db('Create task…').click(); await db('Cancel').click(); assert.equal(await draft.inputValue(),'Collect sample');
  await page.keyboard.press('Escape'); await btn('Quick Add').click(); assert.equal(await draft.inputValue(),'Collect sample');
  await capture('Collect sample'); await capture('Local abstract'); await db('Close dialog').click();
  await btn('Inbox').click(); await db('Texts').click(); await db('Sort by').click(); await item('Oldest first').click();
  await db('Collect sample').click(); await db('Create task…').click(); await db('Add task').click();
  await dialog().getByLabel('Captured text').fill('Edited abstract');
  await db('Create note…').click(); await db('Experiment').click(); await nameDialog('Abstract','Create note');
  await dialog().getByText('No captures to show.').waitFor(); await db('Close').click();
  assert.equal(await readFile(path.join(fresh,'Projects/Experiment/Abstract.md'),'utf8'),'Edited abstract');
  const attachment=path.join(tmp,'Dataset.pdf'); await writeFile(attachment,'sample bytes');
  await btn('Quick Add').click(); await select(page,attachment,'Choose files');
  await db('Choose more files').waitFor(); assert.equal(await draft.isVisible(),false);
  await db('Close dialog').click(); await btn('Quick Add').click(); await db('Remove Dataset.pdf').waitFor();
  await screenshot('quick-add-files');
  await db('Send to Inbox').click();
  await db('Choose files').waitFor();
  await page.waitForFunction(()=>!document.querySelector('.capture-form').inert);
  await page.locator('.capture-form').evaluate(body=>{
    const transfer=new DataTransfer(); transfer.items.add(new File(['dropped bytes'],'Dropped.txt'));
    body.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
  });
  await db('Remove Dropped.txt').waitFor(); await db('Add files to…').click(); await db('Experiment').click(); await db('Choose').click();
  await db('Choose files').waitFor();
  assert.equal(await readFile(path.join(fresh,'Projects/Experiment/Dropped.txt'),'utf8'),'dropped bytes');
  await db('Close dialog').click();
  await btn('Inbox').click(); await db('Files').click(); await db('Add file to…').click();
  await db('Experiment').click(); await db('Choose').click(); await dialog().getByText('No captures to show.').waitFor(); await db('Close').click();
  assert.equal(await readFile(path.join(fresh,'Projects/Experiment/Dataset.pdf'),'utf8'),'sample bytes');
  await btn('Home').click();
  await measure('openPlan',async()=>{await btn('New plan').click();await db('Add to plan').waitFor();});
  await db('Add to plan').click();
  await db('Review results').click(); await db('Files').click();
  await dialog().getByLabel('Filter items').fill('Run one/Results.md');await db('Results.md').click();
  await db('Workspaces').click(); await db('Experiment').click(); await dialog().getByText('Review selected (3)').waitFor();
  await dialog().getByText('Review selected (3)').click(); await screenshot('plan-selection');
  await db('Add selected (3)').click(); await db('Reorder Results.md').press('Alt+ArrowUp');
  await dialog().locator('.plan-entry').first().getByText('Results.md',{exact:true}).waitFor();
  await page.getByLabel('Plan notes').fill('Repeat the measurements'); await db('Done').click();
  await btn('Workspace').click(); await context(row('Results.md'),'Rename'); await renameItem('Field results');
  await row('Field results.md').waitFor(); await btn('Home').click();
  await page.locator('.plan-panel').getByRole('button',{name:'Field results.md',exact:true}).waitFor();
  await measure('completeTask',async()=>{
    await page.locator('.plan-panel').getByRole('checkbox',{name:'Complete Review results'}).check();
    await page.locator('.plan-panel').getByRole('checkbox',{name:'Reopen Review results'}).waitFor();
  });
  await btn('Presets').click();
  await measure('restoreTwoPanes',async()=>{await item('Review desk').click();await left.getByRole('heading',{name:'Field results',exact:true}).waitFor();});
  assert.ok(Math.abs((await left.boundingBox()).width-adjusted)<2);
  assert.equal(await right.getByRole('textbox').innerText(),'Shared edit');
  await btn('Home').click();
  // A deletion outside Itacan keeps the Plan entry available for relinking.
  await writeFile(path.join(fresh,'Projects/Experiment/Temporary.md'),'Temporary');
  await btn('Edit plan').click(); await db('Add to plan').click(); await db('Files').click();
  await db('Temporary.md').click(); await db('Add selected (1)').click(); await db('Done').click();
  await rm(path.join(fresh,'Projects/Experiment/Temporary.md'));
  await btn('Edit plan').click(); await db('Relink').click();
  await db('Abstract.md').click(); await db('Relink selected').click();
  await dialog().locator('.plan-entry').getByText('Abstract.md',{exact:true}).waitFor(); await db('Done').click();
  await btn('Finish plan').click(); await db('Finish plan').click(); await btn('Hide').waitFor();
  const progress=page.locator('.home .progress-panel');
  const progressBounds=await progress.boundingBox();
  await measure('openProgress',async()=>{await btn('Log progress').click();await db('Save progress').waitFor();});
  const score=dialog().getByRole('group',{name:'Rating for Projects/Experiment'}).getByRole('button',{name:'3',exact:true});
  await score.click(); await dialog().getByLabel('Reflection for Projects/Experiment').fill('Repeated the measurement');
  await dialog().getByText('Current plan - optional').click();await db('View plan').click();
  await dialog().getByText('Repeat the measurements').waitFor();await db('Done').click();
  await db('Save progress').click();
  await progress.getByText('Repeated the measurement').waitFor();
  assert.equal((await progress.boundingBox()).height,progressBounds.height);
  const today=new Date().toLocaleDateString('sv-SE');
  await progress.locator('[data-day="'+today+'"]').click();
  await db('Edit progress').click();await dialog().getByLabel('Reflection for Projects/Experiment').fill('Verified reflection');
  await db('Save progress').click();
  const previousDay=new Date();previousDay.setDate(previousDay.getDate()-1);
  if(previousDay.getFullYear()!==new Date().getFullYear())await progress.getByRole('button',{name:'Previous year'}).click();
  const earlierCell=progress.locator('[data-day="'+previousDay.toLocaleDateString('sv-SE')+'"]');
  await earlierCell.click();await db('Add workspace').click();await db('Literature').click();
  await dialog().getByRole('group',{name:'Rating for Resources/Literature'}).getByRole('button',{name:'2',exact:true}).click();
  await dialog().getByLabel('Reflection for Resources/Literature').fill('Reviewed earlier notes');
  await db('Save progress').click();await earlierCell.click();
  await dialog().getByText('Reviewed earlier notes').waitFor();await db('Edit progress').click();
  await dialog().getByLabel('Reflection for Resources/Literature').fill('Reviewed earlier field notes');await db('Save progress').click();
  await progress.getByText('Reviewed earlier field notes').waitFor();
  await progress.getByRole('button',{name:'Tasks',exact:true}).click();
  await progress.getByText('Review results',{exact:true}).waitFor();
  await progress.getByRole('button',{name:'Activity',exact:true}).click();assert.ok(await progress.locator('.progress-row').count()>0);
  await progress.getByRole('button',{name:'Reports',exact:true}).click();
  await measure('openStatistics',async()=>{await btn('Statistics').click();await dialog().getByText('Work distribution').waitFor();});
  await db('7 days').click();await dialog().getByLabel('Statistics workspace').selectOption('Projects/Experiment');
  await dialog().getByText(/3 pts/).first().waitFor();await db('Close dialog').click();
  await btn('Workspace').click();await page.locator('.workspace .progress-panel h2').waitFor();
  await btn('Last File').click(); const active=page.locator('.selected-pane');
  // A deliberate return to read a document is eligible even without another edit.
  await active.getByRole('button',{name:'Read',exact:true}).click();
  await active.locator('article').click();await btn('Home').click();
  await btn('Hide').waitFor();
  await page.waitForFunction(()=>!document.querySelector('#application').inert);

  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  await Promise.all([desktop.waitForEvent('close',{timeout:10000}), db('Close without reporting').evaluate(b=>requestAnimationFrame(()=>b.click()))]);
  desktop=await _electron.launch(options); page=await testWindow();
  await page.locator('.progress-history').getByText('Verified reflection').waitFor();
  await btn('Hide').click(); await btn('Show earlier plans').click();
  await page.locator('.plan-history summary').click(); await page.locator('.plan-history').getByText('Repeat the measurements').waitFor();
  const search=page.getByRole('combobox',{name:'Search Itacan'});
  await search.fill('Edited abstract'); await page.getByRole('option',{name:/Abstract.md/}).waitFor();
  await search.press('ArrowDown'); await search.press('Enter'); await title('Abstract').waitFor();
  await btn('Home').click(); await btn('Experiment').click(); await page.locator('.file-tree').getByRole('button',{name:'Experiment',exact:true}).click(); await context(row('Abstract.md'),'Move');
  await db('Literature').click(); await db('Choose').click(); await row('Abstract.md').waitFor({state:'hidden'});
  const moved=path.join(fresh,'Resources/Literature/Abstract.md');
  await btn('Quick Add').click(); await capture('Follow-up A'); await capture('Follow-up B'); await db('Close dialog').click();
  await btn('Inbox').click(); await db('Follow-up A').click(); await db('Follow-up B').click({modifiers:['Shift']});
  await dialog().getByText('2 texts selected').waitFor(); await screenshot('inbox-selection'); await db('Add 2 texts to note…').click();
  await db('Literature').click(); await db('Abstract.md').click(); await db('Add to note').click();
  await dialog().getByText('No captures to show.').waitFor(); await db('Close').click();
  assert.equal(await readFile(moved,'utf8'),'Edited abstract\n\nFollow-up A\n\nFollow-up B');
  await btn('Quick Add').click(); await page.getByLabel('Capture text').fill('Opening line'); await db('Add to note…').click();
  await db('Literature').click(); await db('Abstract.md').click(); await dialog().getByLabel('Position').selectOption({label:'Start of note'});
  await db('Add to note').click(); await db('Close dialog').click();
  assert.match(await readFile(moved,'utf8'),/^Opening line\n\nEdited abstract/);
  await btn('Home').click(); await btn('Literature').click(); await context(row('Abstract.md'),'Delete');
  await db('Delete').click(); await row('Abstract.md').waitFor({state:'hidden'}); await assert.rejects(readFile(moved),{code:'ENOENT'});
  await btn('Home').click();await btn('New project').click();await nameDialog('Interaction lab','Create');
  const labCard=btn('Interaction lab');await labCard.waitFor();
  await labCard.dragTo(btn('Experiment'),{targetPosition:{x:3,y:24}});
  await page.waitForFunction(()=>document.querySelector('.project-grid .collection-card')?.dataset.path==='Projects/Interaction lab');
  await labCard.click();
  const labPath=path.join(fresh,'Projects','Interaction lab');
  for(const name of ['Papers','Drafts']) {await btn('New folder').click();await renameItem(name);}
  const folderControl=name=>page.locator('.tree-rows').getByRole('button',{name,exact:true});
  await folderControl('Papers').hover();
  await folderControl('Reorder Papers').dragTo(folderControl('Drafts'),{targetPosition:{x:12,y:2}});
  await page.waitForFunction(()=>document.querySelector('.tree-rows [data-root]')?.dataset.root.endsWith('/Papers'));
  for(const name of ['One','Two'])await writeFile(path.join(labPath,'Drafts',name+'.md'),name);
  await row('Drafts').dblclick();await row('One.md').click();await row('Two.md').click({modifiers:['Control']});
  await row('One.md').dragTo(folderControl('Papers'));await row('One.md').waitFor({state:'detached'});
  for(const name of ['One','Two']) {
    assert.equal(await readFile(path.join(labPath,'Papers',name+'.md'),'utf8'),name);
    await assert.rejects(readFile(path.join(labPath,'Drafts',name+'.md')),{code:'ENOENT'});
  }
  await folderControl('Drafts').dragTo(folderControl('Papers'));
  await page.waitForFunction(()=>!document.querySelector('.tree-rows [data-root="Projects/Interaction lab/Drafts"]'));
  await assert.rejects(stat(path.join(labPath,'Drafts')),{code:'ENOENT'});
  assert.ok((await stat(path.join(labPath,'Papers','Drafts'))).isDirectory());
  await btn('Home').click();assert.match(await page.locator('.project-grid .collection-card').first().textContent(),/Interaction lab/);
  await select(page, library, 'Fresh library');
  if (process.env.ITACAN_TEST_SCREENSHOT) await page.screenshot({ path: process.env.ITACAN_TEST_SCREENSHOT });
  await btn('Forest survey').click();
  // Read two native document types and restore a PDF page from a mixed preset.
  await row('Sampling.pdf').dblclick();
  await page.locator('.pdf-text-layer').getByText('Sampling methods').waitFor();
  await btn('Next page').click();
  await page.waitForFunction(()=>document.querySelector('.media-page-number')?.value==='2');
  await context(rail('canopy.jpg'),'Right split');
  await page.waitForFunction(()=>document.querySelector('.media-image')?.naturalWidth>0);
  await btn('Presets').click();await item('Save as new preset').click();await nameDialog('Mixed desk','Save');
  await btn('Home').click();await btn('Presets').click();await item('Mixed desk').click();
  await page.waitForFunction(()=>document.querySelector('.media-page-number')?.value==='2' && document.querySelector('.media-image')?.naturalWidth>0);
  await context(page.locator('.tabs').getByRole('button',{name:'canopy.jpg',exact:true}),'Close pane');
  await btn('Workspace').click();
  await row('Session.md').dblclick();await btn('Live Preview').click();
  await page.locator('.cm-content .katex').waitFor();
  await page.waitForFunction(()=>document.querySelector('.live-image')?.naturalWidth>0);
  await source().press('Control+End');await page.keyboard.insertText('Undo after remount');
  await context(rail('Companion.md'),'New tab');
  await page.locator('.tabs').getByRole('button',{name:'Session.md',exact:true}).click();
  await source().press('Control+z');assert.doesNotMatch(await source().innerText(),/Undo after remount/);
  await source().press('Control+Shift+z');assert.match(await source().innerText(),/Undo after remount/);
  await page.getByText('Saved',{exact:true}).waitFor();
  assert.match(await readFile(path.join(library,'Projects/Forest survey/Session.md'),'utf8'),/Undo after remount/);
  await btn('Workspace').click();
  await measure('openDocument', async () => {
    await row('Field notes.md').dblclick();
    await page.locator('.katex-display').waitFor();
  });
  await page.waitForFunction(() => document.querySelector('article img')?.naturalWidth > 0);
  const readingOffset = await page.locator('.prose').evaluate(el => { el.scrollTop = 240; return el.scrollTop; });
  assert.ok(readingOffset > 0);
  await btn('Presets').click();await item('Save as new preset').click();await nameDialog('Reading position','Save');
  await page.locator('.prose').evaluate(el=>{el.scrollTop=0;});
  await btn('Presets').click();await item('Reading position').click();
  await page.waitForFunction(top=>document.querySelector('.prose')?.scrollTop===top,readingOffset);
  await btn('Home').click(); await btn('Last File').click();
  assert.equal(await page.locator('.prose').evaluate(el => el.scrollTop),readingOffset);
  await context(rail('Companion.md'),'New tab');
  const readingTab=page.locator('.tabs').getByRole('button',{name:'Field notes.md',exact:true});
  const surface=page.locator('.pane'), box=await surface.boundingBox();
  await readingTab.dragTo(surface,{targetPosition:{x:Math.floor(box.width/2),y:Math.floor(box.height)-8}});
  await page.waitForFunction(top=>document.querySelector('.split-group.stacked .pane:last-child .prose')?.scrollTop===top,readingOffset);
  await btn('Presets').click();await item('Reading position').click();
  await page.getByRole('link', { name: 'Linked method' }).click();
  await page.locator('article #heading-method').waitFor();
  await btn('Home').click(); await btn('Forest survey').click(); await row('Field notes.md').dblclick();
  await page.getByRole('link', { name: 'sampling protocol' }).click();
  await page.locator('article #heading-method').waitFor();
  await btn('Edit').click();
  await page.getByRole('textbox', { name: 'Markdown source' }).fill('Quit draft');
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await btn('Cancel').click();
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await db('Save').click();
  await Promise.all([desktop.waitForEvent('close',{timeout:10000}), db('Close without reporting').evaluate(b=>requestAnimationFrame(()=>b.click()))]);
  desktop = null;
  assert.equal(await readFile(path.join(library, 'Resources/Research/Papers/Sampling protocol.md'), 'utf8'), 'Quit draft');
  desktop = await _electron.launch(options);
  page = await testWindow();
  await btn('Field Library').waitFor();
  await btn('Forest survey').waitFor();
  if (testAliases) {
    await btn('Presets').click(); await item('Legacy casing').click();
    const left = page.locator('.pane').first();
    const right = page.locator('.pane').nth(1);
    await left.getByRole('heading', {name:'Field notes', exact:true}).waitFor();
    assert.deepEqual(await left.locator('.tabs [data-path]').allTextContents(), ['Field notes.md']);
    await right.getByRole('textbox').fill('One shared Windows draft');
    await left.locator('article').getByText('One shared Windows draft').waitFor();
    await left.locator('.note-name').click();
    await page.locator('.file-tree').getByRole('button', {name:'Links.md', exact:true}).click();
    await left.getByRole('link', { name: 'Alternate spelling' }).click();
    await left.locator('article').getByText('One shared Windows draft').waitFor();
    assert.deepEqual(await left.locator('.tabs [data-path]').allTextContents(), ['Field notes.md']);
    await right.getByRole('button', { name: 'Close Field notes.md',exact:true }).click();
    await page.locator('.pane').nth(1).waitFor({state:'detached'});
    await page.waitForFunction(() => !document.querySelector('#application').inert);
    await page.keyboard.press('Control+s');
    await left.getByText('Saved', {exact:true}).waitFor();
    assert.equal(await readFile(path.join(library, fieldNote), 'utf8'), 'One shared Windows draft');
  }
  if (!await btn('Home').isDisabled()) await btn('Home').click();
  await btn('Settings').click();await db('Editing').click();
  await dialog().getByLabel('Saving',{exact:true}).selectOption('manual');
  await db('Save settings').click();
  await btn('Forest survey').click();
  await page.getByLabel('Search scope',{exact:true}).selectOption('folder');
  await page.getByRole('combobox',{name:'Search current folder'}).fill('Undo after remount');
  await page.getByRole('option',{name:/Session.md.*Undo after remount/}).click();
  const selectedLine=await source().evaluate(()=>window.getSelection()?.toString());
  assert.match(selectedLine,/Undo after remount/);
  await source().fill('Recovered offline field observations');
  const sessionFile='Projects/Forest survey/Session.md';
  await page.waitForFunction(async file=>{
    const {library}=await window.itacan.home();
    return (await window.itacan.getDraft(library.session,file))?.text==='Recovered offline field observations';
  },sessionFile);
  assert.doesNotMatch(await readFile(path.join(library,sessionFile),'utf8'),/Recovered offline/);
  await Promise.all([desktop.waitForEvent('close'),desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].destroy())]);
  desktop=await _electron.launch(options);page=await testWindow();
  await btn('Forest survey').click();await row('Session.md').dblclick();
  await page.getByText('Recovered draft',{exact:true}).waitFor();
  await btn('Save').click();await page.getByText('Saved',{exact:true}).waitFor();
  assert.equal(await readFile(path.join(library,sessionFile),'utf8'),'Recovered offline field observations');
  assert.deepEqual(remoteRequests, []);
  assert.deepEqual(errors, []);
  console.log('Passed offline Plan, Progress, Statistics, split editing, presets, files, tasks, capture and restart workflows.',timings);
} catch (error) {
  const page = desktop?.windows().at(-1);
  if (page) console.error(await page.locator('dialog[open], #message:not([hidden]), .media-area, .pane > .empty').allTextContents().catch(() => []));
  throw error;
} finally {
  try {
    if (desktop) {
      // The test may have failed mid-edit. End only this test-owned process.
      await desktop.evaluate(({ BrowserWindow }) => {
        for (const window of BrowserWindow.getAllWindows()) window.destroy();
      }).catch(() => {});
      await desktop.close().catch(() => {});
    }
  } finally { await rm(tmp, { recursive: true, force: true }); }
}
