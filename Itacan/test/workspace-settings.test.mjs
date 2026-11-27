import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import libraryModule from '../main/library.cjs';
import workModule from '../main/work.cjs';
import files from '../main/files.cjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'itacan-preferences-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const library = await libraryModule.openLibrary(root,true);
  return {root,library,work:new workModule.LibraryWork(library)};
}

test('Literature on new, legacy and ambiguous libraries',async t=>{
  const {library,root} = await fixture(t);
  assert.deepEqual((await library.home()).resources.map(r=>r.name),['Knowledge','Literature','Explorations','Inspiration']);
  await fs.rename(path.join(root,'Resources/Literature'),path.join(root,'Resources/Research'));
  const reopened = await libraryModule.openLibrary(root);
  const home = await reopened.home();
  assert.equal(home.resources[1].name,'Literature');
  assert.equal(home.resources[1].path,'Resources/Research');
  assert.deepEqual(home.extraResources,[]);
  await fs.mkdir(path.join(root,'Resources/Literature'));
  const both = await reopened.home();
  assert.equal(both.resources[1].path,'Resources/Literature');
  assert.deepEqual(both.extraResources.map(r=>r.path),['Resources/Research']);
});

test('attachment survives managed move, detaching preserves files, Settings reject conflicting bindings',async t=>{
  const {library,work,root}=await fixture(t);
  const project=await library.create('Projects','Project','folder');
  const folder=await library.create('Resources/Literature','Papers','folder');
  const sub=await library.create(folder,'Methods','folder');
  const note=await library.create(folder,'Observations','note','shared bytes');
  const cover=folder+'/Field.jpg';
  await fs.writeFile(path.join(root,cover),'image fixture');
  await work.command('settings','save',{covers:{Morning:{art:'horizon',path:cover,position:50}}});
  await work.command('workspace','attach',{project,folder});
  await assert.rejects(work.command('workspace','attach',{project,folder:sub}),/overlaps/);
  await files.moveItem(work,folder,'Resources/Literature','Articles',false);
  const renamed='Resources/Literature/Articles';
  assert.deepEqual((await work.transaction()).sharedFolders[project],[renamed]);
  await work.command('settings','save',{theme:'dark',shortcuts:{quickAdd:'Mod+Alt+I'}});
  await assert.rejects(work.command('settings','save',{theme:'light',shortcuts:{quickAdd:'Mod+S'}}),/already assigned/);
  await work.command('workspace','detach',{project,folder:renamed});
  const fresh = new workModule.LibraryWork(await libraryModule.openLibrary(root));
  const state=await fresh.transaction();
  assert.equal(state.settings.covers.Morning.path,renamed+'/Field.jpg');
  assert.equal(state.settings.theme,'dark');
  assert.equal(state.settings.shortcuts.quickAdd,'Mod+Alt+I');
  assert.deepEqual(state.sharedFolders[project],[]);
  assert.equal((await fresh.library.readNote(note.replace(folder,renamed))).text,'shared bytes');
});
