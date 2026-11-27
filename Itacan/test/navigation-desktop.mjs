import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchElectron, setPickerPath } from './desktop/window.mjs';
import libraryModule from '../main/library.cjs';
import workModule from '../main/work.cjs';

const temporary = await fs.mkdtemp(path.join(tmpdir(),'itacan-navigation-'));
const initial = path.join(temporary,'Research library'), moved = path.join(temporary,'Moved library');
const project='Projects/Fieldwork', papers='Resources/Literature/Papers';
const archived=papers+'/Archive/Methods.md';
let app,page;
const errors=[];
const button = name => page.getByRole('button',{name,exact:true});
const dialog = () => page.getByRole('dialog').last();
const choose = name => dialog().getByRole('button',{name,exact:true});
const item = name => page.getByRole('menuitem',{name,exact:true});
const row = name => page.getByRole('option').filter({has:page.getByText(name,{exact:true})});
async function launch(profile,library,sample=false) {
  app = await launchElectron(path.join(temporary, profile));
  page=await app.firstWindow();
  page.setDefaultTimeout(6000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if (/^https?:/.test(request.url())) errors.push(request.url());});
  await page.context().setOffline(true);
  await setPickerPath(app, library);
  if(sample){
    await button('Library guide').click();await choose('Done').click();
    assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Library guide');
  }
  await button(sample?'Try Field Library':'Choose a folder').click();
  await button('Literature').waitFor();
}
async function quit() {
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  const close=button('Close without reporting');
  if (await close.waitFor({timeout:1800}).then(()=>true,()=>false)) await close.click();
  if (app.process().exitCode===null) await app.waitForEvent('close',{timeout:6000});
  app=undefined;
}
try {
  await fs.mkdir(initial);
  const library=await libraryModule.openLibrary(initial,true);
  await library.create('Projects','Fieldwork','folder');
  await library.create('Resources/Literature','Papers','folder');
  await library.create(papers,'Archive','folder');
  await library.create(papers,'Methods','note','# Measuring canopy\n\nA unique observation.');
  const other=await library.create('Projects','Workshop','folder');
  const seed=new workModule.LibraryWork(library);
  await seed.command('workspace','attach',{project:other,folder:papers});
  await seed.command('task','save',{owner:other,location:papers+'/Methods.md',title:'Scope check private workshop'});
  await seed.command('task','save',{owner:'Resources/Literature',location:papers+'/Methods.md',title:'Scope check shared source'});
  const samples=8000*40;
  const wav=Buffer.alloc(44+samples,128);
  wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);
  wav.write('data',36);wav.writeUInt32LE(samples,40);
  await fs.writeFile(path.join(initial,papers,'Frogs.wav'),wav);
  await fs.copyFile('examples/Field Library/Projects/Forest survey/canopy.jpg',path.join(initial,papers,'Canopy.jpg'));
  await launch('first-profile',initial);
  await button('Settings').click();
  await dialog().getByLabel('Theme',{exact:true}).selectOption('dark');
  await dialog().getByText('Home covers',{exact:true}).click();
  const hour=new Date().getHours();
  const period=hour<5?'Night':hour<12?'Morning':hour<18?'Afternoon':hour<22?'Evening':'Night';
  const cover=dialog().getByRole('group',{name:period,exact:true});
  await cover.getByRole('button',{name:'Choose library image'}).click();
  for(const name of ['Literature','Papers','Canopy.jpg','Choose'])await choose(name).click();
  await cover.getByLabel('Vertical position (%)').fill('68');
  await choose('Shortcuts').click();
  await dialog().getByRole('textbox',{name:'Quick Add',exact:true}).press('Control+Alt+I');
  await choose('Music').click();
  await dialog().getByLabel('Local music player').selectOption('Enabled');
  await choose('This device').click();
  await dialog().getByLabel('Open settings override').press('Control+Alt+J');
  await choose('Save settings').click();
  await page.getByRole('dialog',{name:'Settings',exact:true}).waitFor({state:'hidden'});
  await page.keyboard.press('Control+Alt+J');
  await dialog().getByRole('heading',{name:'Settings',exact:true}).waitFor();
  await choose('Cancel').click();
  await page.keyboard.press('Control+Alt+I');
  await dialog().getByLabel('Capture text').waitFor();
  await choose('Close dialog').click();
  await button('Music').click();await choose('Add local track').click();
  for(const name of ['Literature','Papers','Frogs.wav','Add track'])await choose(name).click();
  await choose('Frogs.wav').click();await choose('Pause').waitFor();
  await dialog().getByLabel('Volume',{exact:true}).focus();
  await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
  await choose('Close').click();await button('Music').click();
  await choose('Pause').click();await choose('Play').waitFor();await choose('Close').click();
  await button('Fieldwork').click();
  await button('Attach Resource folder').click();
  await dialog().getByLabel('Resource',{exact:true}).selectOption('Literature');
  await choose('Papers').click();await choose('Attach folder').click();
  await page.getByRole('combobox',{name:'Search this project'}).fill('Scope check');
  const results=page.locator('.search-results');
  await results.getByRole('option',{name:/Scope check shared source/}).waitFor();
  assert.equal(await results.getByRole('option',{name:/Scope check private workshop/}).count(),0);
  await page.getByLabel('Search scope').selectOption('folder');
  await results.getByText('No matches in this scope.').waitFor();
  await page.getByRole('combobox',{name:'Search current folder'}).press('Escape');
  await button('Literature / Papers').click();
  await row('Methods.md').click({button:'right'});
  await item('Move').click();
  for (const name of ['Literature','Papers','Archive','Choose']) await choose(name).click();
  await row('Archive').dblclick();
  await row('Methods.md').dblclick();
  await page.locator('.rail-heading').getByRole('button',{name:'Fieldwork',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Methods',exact:true}).waitFor();
  await button('Presets').click();await item('Save as new preset').click();
  await dialog().getByLabel('Name',{exact:true}).fill('Literature desk');await choose('Save').click();
  const normal=await app.evaluate(async({BrowserWindow,screen})=>{
    const win=BrowserWindow.getAllWindows()[0];
    if(win.isMaximized())await new Promise(resolve=>{win.once('unmaximize',resolve);win.unmaximize();});
    const area=screen.getDisplayMatching(win.getBounds()).workArea;
    win.setBounds({x:area.x+10,y:area.y+10,width:Math.min(area.width-20,920),height:Math.min(area.height-20,640)});
    return win.getBounds();
  });
  await quit();
  await fs.rename(initial,moved);
  const stored=JSON.parse(await fs.readFile(path.join(moved,'itacan-work.json'),'utf8'));
  assert.deepEqual(stored.sharedFolders[project],[papers]);
  assert.equal(stored.workspaceLayouts[project].panes[0].file,archived);
  assert.equal(stored.presets[0].layout.workspace,project);
  assert.equal(stored.settings.theme,'dark');
  assert.deepEqual(stored.playlist,[papers+'/Frogs.wav']);
  assert.equal(stored.settings.shortcuts.settings,'Mod+,');
  await launch('fresh-profile',moved);
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  const css=await page.locator('.home-cover').evaluate(el=>{
    const style=getComputedStyle(el);
    return {image:style.backgroundImage,position:style.backgroundPosition};
  });
  assert.match(css.image,/itacan:\/\/image\/Resources\/Literature\/Papers\/Canopy.jpg/);
  assert.match(css.position,/68%/);
  await page.keyboard.press('Control+Alt+J');
  assert.equal(await dialog().count(),0);
  await button('Fieldwork').click();await button('Last File').click();
  await page.getByRole('heading',{name:'Methods',exact:true}).waitFor();
  await page.locator('.rail-heading').getByRole('button',{name:'Fieldwork',exact:true}).waitFor();
  await button('Home').click();await button('Presets').click();await item('Literature desk').click();
  await page.getByRole('heading',{name:'Methods',exact:true}).waitFor();
  await quit();
  await fs.rename(path.join(moved,archived),path.join(moved,papers,'Recovered.md'));
  await launch('repair-profile',moved);
  await button('Presets').click();await item('Literature desk').click();
  await button('Relink document').click();
  for (const name of ['Literature','Papers','Recovered.md','Choose']) await choose(name).click();
  await page.getByRole('heading',{name:'Recovered',exact:true}).waitFor();
  assert.match(await fs.readFile(path.join(moved,papers,'Recovered.md'),'utf8'),/unique observation/);
  await quit();
  await launch('first-profile',moved);
  assert.deepEqual(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds()),normal);
  await button('Music').click();
  assert.equal(await dialog().getByLabel('Volume',{exact:true}).inputValue(),'0.01');
  await choose('Close').click();
  await page.keyboard.press('Control+Alt+J');await choose('Cancel').click();
  assert.deepEqual(errors,[]);
  await quit();
  const sampleParent=path.join(temporary,'samples');
  await fs.mkdir(path.join(sampleParent,'Field Library'),{recursive:true});
  await launch('sample-profile',sampleParent,true);
  const example=path.join(sampleParent,'Field Library (2)');
  assert.deepEqual(await fs.readdir(path.join(sampleParent,'Field Library')),[]);
  assert.equal(await fs.readFile(path.join(example,'Projects/Forest survey/Field notes.md'),'utf8'),
    await fs.readFile('examples/Field Library/Projects/Forest survey/Field notes.md','utf8'));
  const sizes=[];
  for(const width of [760,1320]){
    await app.evaluate(async ({BrowserWindow},width)=>{
      const win=BrowserWindow.getAllWindows()[0];
      if(win.isMaximized())await new Promise(resolve=>{win.once('unmaximize',resolve);win.unmaximize();});
      win.setSize(width,800);
    },width);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const metrics=await page.evaluate(()=>{
      const grid=document.querySelector('.home-panels'), nav=document.querySelector('#navigation');
      return {client:innerWidth,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        pageWidth:document.documentElement.scrollWidth,navWidth:nav.getBoundingClientRect().width};
    });
    assert.ok(metrics.pageWidth<=metrics.client);
    assert.ok(metrics.navWidth<=metrics.client);
    sizes.push(metrics);
  }
  assert.ok(sizes[0].columns<sizes[1].columns,JSON.stringify(sizes));
  await button('Forest survey').click();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(680,480));
  await page.waitForFunction(()=>innerWidth<=680);
  const smallSearch=page.getByRole('combobox',{name:'Search this project'});
  await smallSearch.fill('Field');
  const smallResults=page.locator('.search-results');
  await smallResults.getByRole('option').first().waitFor();
  await smallSearch.press('ArrowUp');
  const selected=smallResults.locator('[aria-selected=true]');
  assert.ok(await selected.evaluate(option=>{
    const box=option.getBoundingClientRect();
    return option.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));
  }),'The keyboard-selected search result must be visible above the toolbar.');
  await smallSearch.press('Escape');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1320,800));
  await row('Field notes.md').dblclick();
  // The copied sample can already have this note open in another saved pane.
  await page.locator('.selected-pane').getByRole('heading', { name: 'Field notes', exact: true }).waitFor();
  assert.deepEqual(errors,[]);
  await quit();
  console.log('Verified relocated shared folders, mixed preferences, local audio, screen geometry, portable covers, sample-copy onboarding and keyboard focus. Layouts:',JSON.stringify(sizes));
} catch(error) {
  console.error(error);
  if(page && !page.isClosed()) console.error(await page.locator('body').innerText().catch(()=>''),errors);
  throw error;
} finally {
  if (app) {
    const closing=app.waitForEvent('close',{timeout:4000}).catch(()=>{});
    await app.evaluate(({app})=>app.exit()).catch(()=>{});
    await closing;
  }
  await fs.rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
