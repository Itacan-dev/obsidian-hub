import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import storage from '../main/library.cjs';
import work from '../main/work.cjs';
import recovery from '../main/recovery.cjs';
import files from '../main/files.cjs';
import drafts from '../main/drafts.cjs';
import search from '../main/search.cjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'itacan-recovery-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const library = await storage.openLibrary(root,true);
  const project = await library.create('Projects','Trial','folder');
  const note = await library.create(project,'Notes','note','first\nsoil spectrum');
  const store = new work.LibraryWork(library);
  const state = await store.command('task','save',{title:'Compare',owner:project,location:note});
  return {root,library,store,project,note,state,raw:await fs.readFile(store.file,'utf8')};
}
test('interrupted physical move completes its metadata once on reopening',async t=>{
  const {root,library,note,raw,state} = await fixture(t);
  const to = 'Projects/Trial/Other.md';
  work.rewriteRefs(state,note,to);
  state.revision++;
  await recovery.prepareMove(library,raw,state,note,to);
  await fs.rename(path.join(root,note),path.join(root,to));
  const reopened = new work.LibraryWork(await storage.openLibrary(root));
  assert.equal((await reopened.transaction()).tasks[0].location,to);
  assert.deepEqual((await reopened.transaction()).tasks,state.tasks);
  assert.equal(await fs.readFile(path.join(root,to),'utf8'),'first\nsoil spectrum');
});

test('recover a managed rename after the writer process stops between the filesystem and metadata writes',async t=>{
  const {root,library,note,state} = await fixture(t);
  const renamed = 'Projects/Trial/Relocated.md';
  const writer = spawn(process.execPath,['-e',`
    const fs = require('node:fs/promises');
    const path = require('node:path');
    const {openLibrary} = require('./main/library.cjs');
    const {LibraryWork} = require('./main/work.cjs');
    const {moveItem} = require('./main/files.cjs');
    const [root,from,to] = process.argv.slice(1);
    const rename = fs.rename;
    fs.rename = async (a,b) => {
      await rename(a,b);
      if (b === path.join(root,to)) {
        process.send('renamed');
        setInterval(()=>{}, 60000);
        await new Promise(()=>{});
      }
    };
    openLibrary(root).then(lib=>moveItem(new LibraryWork(lib),from,path.posix.dirname(to),path.posix.basename(to)))
      .catch(error=>{process.send(error.message);process.exitCode=1;});
  `,root,note,renamed],{cwd:new URL('../',import.meta.url),stdio:['ignore','ignore','ignore','ipc']});
  const stopped = once(writer,'exit');
  t.after(()=>{if (writer.exitCode === null && writer.signalCode === null) writer.kill();});
  const [signal] = await once(writer,'message',{signal:AbortSignal.timeout(10000)});
  assert.equal(signal,'renamed');
  writer.kill();
  await stopped;
  const next = await new work.LibraryWork(library).transaction();
  assert.equal(next.tasks[0].id,state.tasks[0].id);
  assert.equal(next.tasks[0].location,renamed);
  assert.equal((await library.readNote(renamed)).text,'first\nsoil spectrum');
});
test('an interrupted move preserves the previous work file and journal when the proposed state is malformed',async t=>{
  const {root,library,note,raw,state}=await fixture(t);
  const to='Projects/Trial/Moved.md';
  state.lastLayout={active:0,panes:[]};
  await recovery.prepareMove(library,raw,state,note,to);
  await fs.rename(path.join(root,note),path.join(root,to));
  const journal=path.join(root,'.itacan-pending.json');
  const before=await fs.readFile(journal,'utf8');
  await assert.rejects(new work.LibraryWork(library).transaction(),/needs review/);
  assert.equal(await fs.readFile(path.join(root,'itacan-work.json'),'utf8'),raw);
  assert.equal(await fs.readFile(journal,'utf8'),before);
});
test('interrupted filing acknowledges written bytes and preserves divergent external edits',async t=>{
  const {root,library,store,note,raw,state} = await fixture(t);
  const before = await library.readNote(note), nextText='Filed observation';
  state.quickText = '';
  await recovery.prepareFiling(library,raw,state,note,before.revision,recovery.digest(nextText));
  await fs.writeFile(path.join(root,note),'edited elsewhere');
  await assert.rejects(store.transaction(),/needs review/);
  assert.equal(await fs.readFile(store.file,'utf8'),raw);
  assert.equal(await fs.readFile(path.join(root,note),'utf8'),'edited elsewhere');
  await fs.writeFile(path.join(root,note),nextText);
  const recovered = await store.transaction();
  assert.equal(recovered.quickText,'');
  assert.equal(recovered.revision,state.revision+1);
});
test('first structured change backs up v1 metadata and upgrades the marker',async t=>{
  const {root,raw} = await fixture(t);
  const marker=path.join(root,'itacan-library.json');
  const original=JSON.stringify({format:'itacan-library',version:1});
  await fs.writeFile(marker,original);
  const library=await storage.openLibrary(root);
  const store=new work.LibraryWork(library);
  await store.transaction();
  assert.equal(await fs.readFile(marker,'utf8'),original);
  await store.command('inbox','add',{text:'later'});
  assert.equal(JSON.parse(await fs.readFile(marker,'utf8')).version,2);
  const backup=JSON.parse(await fs.readFile(path.join(root,'.itacan-recovery','before-format-2.json'),'utf8'));
  assert.deepEqual(backup,{marker:original,work:raw});
});
test('external rename repair keeps identity and a saved note survives a failed activity write',async t=>{
  const {root,library,store,note,state}=await fixture(t);
  const newPath='Projects/Trial/Renamed.md';
  await fs.rename(path.join(root,note),path.join(root,newPath));
  const next=await store.command('workspace','relink-document',{from:note,to:newPath});
  assert.equal(next.tasks[0].id,state.tasks[0].id);
  assert.equal(next.tasks[0].location,newPath);
  const record=await library.readNote(newPath);
  await fs.writeFile(store.file,'malformed');
  let warned=false;
  await files.saveDocument(store,newPath,'Saved observation',record.revision,()=>{warned=true;});
  assert.ok(warned);
  assert.equal((await library.readNote(newPath)).text,'Saved observation');
  assert.equal(await fs.readFile(store.file,'utf8'),'malformed');
});
test('device drafts and scoped search do not write to the portable record',async t=>{
  const {root,library,store,note,project,state,raw}=await fixture(t);
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'itacan-device-'));
  t.after(()=>fs.rm(profile,{recursive:true,force:true}));
  const device=new drafts.DeviceDrafts(profile);
  const revision=(await library.readNote(note)).revision;
  await device.put(library,note,{text:'draft',revision});
  assert.equal((await new drafts.DeviceDrafts(profile).get(library,note)).text,'draft');
  await device.put(library,note,null);
  assert.equal(await device.get(library,note),null);
  const engine=new search.LibrarySearch();
  const [match]=await engine.query(library,state,{scope:project,query:'spectrum',token:1,phase:'content'});
  assert.equal(match.path,note);
  assert.equal(match.line,2);
  assert.equal(await fs.readFile(store.file,'utf8'),raw);
  assert.ok(!(await fs.readdir(root)).includes('recovery-drafts'));
});

test('an active Oath searches its Project and attached folder across physical workspace roots',async t=>{
  const {library,project,state} = await fixture(t);
  const shared = await library.create('Resources/Knowledge','Methods','folder');
  const method = await library.create(shared,'Spectrometer','note','soil spectrum');
  await library.create('Resources/Knowledge','Private','note','soil spectrum');
  state.sharedFolders = {[project]:[shared]};
  state.oath = {status:'active',owner:project};
  const engine = new search.LibrarySearch();
  const results = await engine.query(library,state,{query:'spectrum',token:1,phase:'content'});
  assert.deepEqual(new Set(results.map(item=>item.path)),new Set([project+'/Notes.md',method]));
});
