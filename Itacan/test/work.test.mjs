import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import storage from '../main/library.cjs';
import work from '../main/work.cjs';
import files from '../main/files.cjs';
import {taskInWorkspace} from '../contracts/workspace.cjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'itacan-work-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const library = await storage.openLibrary(root, true);
  return { root, library, store: new work.LibraryWork(library) };
}

test('valid older Plans and layouts open, damaged nested records remain byte-for-byte intact', async t => {
  const {store,library} = await fixture(t);
  const entry = {id:'entry',kind:'workspace',ref:'Resources/Literature',label:'Literature'};
  const plan = {id:'plan',day:new Date().toLocaleDateString('sv-SE'),note:'Morning',entries:[entry]};
  const layout = {active:0,panes:[{file:'',tabs:[],edit:false}]};
  const old = {version:1,tasks:[],inbox:[],lastLayout:layout,plan,history:[{...plan,id:'older',finished:new Date().toISOString()}]};
  const write = state => fs.writeFile(store.file,JSON.stringify(state));
  await write(old);
  assert.deepEqual((await store.transaction()).history,old.history);
  assert.equal(await fs.readFile(store.file,'utf8'),JSON.stringify(old));
  for (const [field,value,expected] of [
    ['lastLayout',{active:0,panes:[{file:'Notes.md',tabs:'Notes.md'}]},/layout/],
    ['workspaceLayouts',{'Projects/Survey':{active:1,panes:layout.panes}},/workspaceLayouts/],
    ['history',[{...old.history[0],entries:[null]}],/history/],
    ['plan',{...plan,note:[]},/Plan/], ['plan',{...plan,day:'2025-02-30'},/Plan/],
    ['oath',{id:'damaged',status:'active',rests:[]},/Oath/],
    ['revision',-1,/revision/], ['revision','9',/revision/], ['revision',2**53,/revision/]
  ]) {
    const damaged = {...old,[field]:value};
    await write(damaged);
    await assert.rejects(new work.LibraryWork(library).transaction(),expected);
    await assert.rejects(store.command('inbox','add',{text:'Later'}),expected);
    assert.equal(await fs.readFile(store.file,'utf8'),JSON.stringify(damaged));
  }
  await write({...old,revision:Number.MAX_SAFE_INTEGER});
  assert.equal((await store.transaction()).revision,Number.MAX_SAFE_INTEGER);
  let called=false;
  await assert.rejects(store.transaction(()=>{called=true;}),/revision exhausted/);
  assert.equal(called,false);
});

test('detached tasks retain their original workspace and document through another move', async t => {
  const {store,library}=await fixture(t);
  const owner=await library.create('Projects','Survey','folder');
  const note=await library.create(owner,'Field notes','note');
  await store.command('task','save',{owner,location:note,title:'Review'});
  const other=await library.create('Resources/Knowledge','Other','note');
  await files.moveItem(store,owner,null,null,true);
  await files.moveItem(store,other,'Resources/Knowledge','Renamed.md');
  const [task]=(await new work.LibraryWork(library).transaction()).tasks;
  assert.equal(task.owner,'');
  assert.equal(task.location,'');
  assert.equal(task.missingOwner,owner);
  assert.equal(task.missingLocation,note);
});

test('a captured Project task retains its owner through changes inside its attached Resource', async t => {
  const {store,library}=await fixture(t);
  const owner=await library.create('Projects','Survey','folder');
  const other=await library.create('Projects','Other','folder');
  const resource='Resources/Literature';
  const folder=await library.create(resource,'Shared papers','folder');
  const note=await library.create(folder,'Methods','note');
  for (const project of [owner,other]) await store.command('workspace','attach',{project,folder});
  const [capture]=(await store.command('inbox','add',{text:'Check methods'})).inbox;
  let state=await store.command('task','save',{title:capture.text,captureId:capture.id,owner,location:note});
  const [task]=state.tasks;
  assert.equal(state.inbox.length,0);
  assert.ok(taskInWorkspace(state,owner,task));
  assert.equal(taskInWorkspace(state,other,task),false);
  assert.equal(taskInWorkspace(state,resource,task),false);
  const take=(workspace,id)=>store.command('oath','start',{owner:workspace,taskIds:[id],condition:'tasks'});
  await assert.rejects(take(other,task.id),/selected workspace/);
  await take(owner,task.id);
  const moved=await files.moveItem(store,note,folder,'Methodology.md');
  const renamed=folder+'/Methodology.md';
  assert.equal(moved.state.tasks[0].owner,owner);
  assert.equal(moved.state.tasks[0].location,renamed);
  await assert.rejects(files.moveItem(store,renamed,other,'Revised.md'),/Oath workspace/);
  await store.command('task','complete',{id:task.id,done:true});
  assert.equal((await store.transaction()).oathHistory[0].owner,owner);
  const bulk=(await store.command('inbox','add',{text:'Second review'})).inbox;
  state=await store.command('task','captures',{ids:bulk.map(i=>i.id),path:renamed,owner});
  assert.equal(state.tasks[1].owner,owner);
  state=await store.command('task','save',{title:'Resource review',owner:resource,location:renamed});
  const physical=state.tasks[2];
  assert.ok(taskInWorkspace(state,other,physical));
  await take(owner,physical.id);
  await assert.rejects(store.command('workspace','detach',{project:owner,folder}),/selected tasks/);
  await store.command('task','complete',{id:physical.id,done:true});
  state=await store.command('workspace','detach',{project:owner,folder});
  assert.equal(state.tasks[0].missingLocation,renamed);
  assert.equal(state.tasks[0].owner,owner);
  assert.equal(state.tasks[2].location,renamed);
  await store.command('workspace','attach',{project:owner,folder});
  await store.command('task','attach',{id:task.id,owner,location:renamed});
  state=(await files.moveItem(store,renamed,other,'Revised.md')).state;
  assert.equal(state.tasks[0].owner,other);
  assert.equal(state.tasks[0].location,other+'/Revised.md');
});

test('recurring capture task has one successor and finished Plan labels survive later edits', async t => {
  const { store, library } = await fixture(t);
  const capture = (await store.command('inbox', 'add', { text: 'Survey' })).inbox[0];
  const data = {
    captureId: capture.id, title: capture.text, owner: 'Resources/Literature', due: '2026-03-29',
    interval: 2, repeat: 'weekly', steps: [{ text: 'Read', done: true }]
  };
  const state = await store.command('task', 'save', data);
  assert.equal(state.inbox.length, 0);
  await assert.rejects(store.command('task', 'save', data), /resolved/);
  const id = state.tasks[0].id;
  await store.command('plan', 'add', { kind: 'task', ref: id });
  for (let i = 0; i < 3; i++) await store.command('task', 'toggle', { id });
  const finished = await store.command('plan', 'finish');
  assert.equal(finished.tasks.length, 2);
  assert.equal(finished.tasks[1].due, '2026-04-12');
  assert.equal(finished.tasks[1].steps[0].done, false);
  assert.equal(finished.history[0].entries[0].done, true);
  await store.command('task', 'save', { ...data, captureId: null, id, title: 'Changed' });
  assert.equal((await new work.LibraryWork(library).transaction()).history[0].entries[0].label, 'Survey');
});

test('folder moves repair nested task, Plan and named layout references', async t => {
  const { library, store } = await fixture(t);
  const owner = 'Resources/Literature';
  const folder = await library.create(owner, 'Papers', 'folder');
  const file = await library.create(folder, 'Methods', 'note');
  await store.command('task', 'save', { title: 'Review', owner, location: file });
  await store.command('plan', 'add', { kind: 'note', ref: file });
  const layout = { active: 0, panes: [{ file, tabs: [file], edit: true }] };
  await store.command('layout', 'preset', { name: 'Review desk', layout });
  await store.command('layout', 'remember', { layout });
  await library.create('Resources/Knowledge', 'Taken', 'folder');
  await assert.rejects(files.moveItem(store, folder, 'Resources/Knowledge', 'Taken'), /already/);
  const { state } = await files.moveItem(store, folder, 'Resources/Knowledge', 'Methods');
  const target = 'Resources/Knowledge/Methods/Methods.md';
  assert.equal(state.tasks[0].owner, 'Resources/Knowledge');
  assert.equal(state.tasks[0].location, target);
  assert.equal(state.presets[0].layout.panes[0].file, target);
  assert.equal(state.plan.entries[0].ref, target);
  const removed = await files.moveItem(store, target, null, null, true);
  assert.ok(removed.state.plan.entries[0].missing);
  assert.deepEqual(removed.state.lastLayout.panes[0].tabs, []);
  assert.equal(removed.state.tasks[0].location, '');
});

test('filing collisions retain Inbox originals, successful filing persists', async t => {
  const { library, store, root } = await fixture(t);
  const owner = 'Resources/Literature';
  const note = await library.create(owner, 'Reading', 'note', 'first');
  const { revision } = await library.readNote(note);
  const capture = (await store.command('inbox', 'add', { text: 'second' })).inbox[0];
  await assert.rejects(files.fileText(store, { id: capture.id, folder: owner, name: 'Reading' }), /already/);
  await assert.rejects(files.fileText(store, { id: capture.id, path: note, draft: 'first', revision: 'stale' }), /changed/);
  assert.equal((await store.transaction()).inbox.length, 1);
  await files.fileText(store, { id: capture.id, path: note, draft: 'draft', revision });
  assert.equal((await library.readNote(note)).text, 'draft\n\nsecond');
  const source = path.join(root, 'Sample.pdf');
  await fs.writeFile(source, 'bytes');
  const item = (await files.captureFiles(store, [source])).inbox[0];
  const dest = path.join(root, owner, 'Sample.pdf');
  await fs.writeFile(dest, 'existing');
  await assert.rejects(files.resolveAttachment(store, item.id, owner), { code: 'EEXIST' });
  assert.equal((await store.transaction()).inbox[0].id, item.id);
  assert.equal(await fs.readFile(dest, 'utf8'), 'existing');
  await files.resolveAttachment(store, item.id, 'Resources/Knowledge');
  assert.deepEqual((await store.transaction()).inbox, []);
  assert.equal(await fs.readFile(path.join(root, 'Resources/Knowledge/Sample.pdf'), 'utf8'), 'bytes');
  assert.equal(await fs.readFile(source, 'utf8'), 'bytes');
});

test('a failed first write removes only the partially created note', async t => {
  const { library } = await fixture(t);
  const open = fs.open.bind(fs);
  t.mock.method(fs, 'open', async (...args) => {
    const handle = await open(...args);
    if (args[0].endsWith('Partial.md')) {
      const write = handle.writeFile.bind(handle);
      handle.writeFile = async () => { await write('partial'); throw Error('Write interrupted'); };
    }
    return handle;
  });
  await assert.rejects(library.create('Resources/Literature', 'Partial', 'note', 'draft'), /interrupted/);
  assert.deepEqual(await library.entries('Resources/Literature'), []);
});


test('a plan open at midnight can save its notes before the next day opens', async t => {
  const {store} = await fixture(t);
  const {plan} = await store.command('plan', 'start');
  await store.transaction(state => { state.plan.day = '2000-01-01'; state.plan.endsAt=new Date(2000,0,2).toISOString(); });
  await store.command('plan', 'note', {planId:plan.id, note:'Late observation'});
  const reopened = await store.transaction();
  assert.equal(reopened.plan, null);
  assert.equal(reopened.history[0].note, 'Late observation');
  assert.equal(reopened.history[0].day, '2000-01-01');
  assert.equal(reopened.history[0].finished,new Date(2000,0,2).toISOString());
  await assert.rejects(store.command('plan','note',{planId:plan.id,note:'stale'}), /ended/);
});

test('daily ratings, reflections and report evidence survive later task and file changes', async t => {
  const { store, library } = await fixture(t);
  const owner='Resources/Literature', day=new Date().toLocaleDateString('sv-SE');
  const file=await files.createItem(store,owner,'Evidence','note','First');
  let {revision}=await library.readNote(file);
  revision=await files.saveDocument(store,file,'Second',revision);
  await files.saveDocument(store,file,'Third',revision);
  let state=await store.command('task','save',{owner,title:'Record finding',due:day,repeat:'daily',done:true,steps:[{text:'Observe',done:true}]});
  const task=state.tasks[0];
  assert.equal(state.activity.filter(e=>e.action==='edited').length,1);
  assert.equal(state.activity.find(e=>e.action==='task').taskId,task.id);
  assert.equal(state.activity.find(e=>e.action==='step').stepId,task.steps[0].id);
  const entry={owner,score:0,summary:'',expected:null};
  const save=rows=>store.command('progress','save',{day,entries:rows});
  state=await save([entry]);
  const first=state.reports[0];
  assert.equal(first.score,0);
  assert.ok(first.evidence.some(e=>e.action==='step'));
  await assert.rejects(save([{...entry,score:4}]), /changed/);
  await assert.rejects(save([{...entry,expected:first.updated},entry]), /Duplicate/);
  await store.command('task','toggle',{id:task.id});
  await store.command('task','step',{id:task.id,index:0,done:false});
  state=await store.command('task','toggle',{id:task.id});
  assert.deepEqual(state.activity.filter(e=>e.action==='task').map(e=>!!e.reopened),[false,true]);
  assert.deepEqual(state.activity.filter(e=>e.action==='step').map(e=>!!e.reopened),[true]);
  const moved=await files.moveItem(store,file,'Resources/Knowledge','Method.md');
  const edit=moved.state.activity.find(e=>e.action==='edited');
  assert.equal(edit.owner,owner);
  assert.equal(edit.path,'Resources/Knowledge/Method.md');
  assert.equal(edit.title,'Evidence.md');
  assert.deepEqual(moved.state.reports[0].evidence,first.evidence);
  state=await save([{...entry,expected:first.updated,score:null,summary:'A reflection without a rating'}]);
  assert.equal(state.reports[0].score,null);
  assert.equal(state.reports[0].summary,'A reflection without a rating');
  await save([{...entry,expected:state.reports[0].updated,score:null}]);
  assert.equal((await new work.LibraryWork(library).transaction()).reports.length,0);
  await assert.rejects(store.command('progress','save',{day:'2001-02-29',entries:[entry]}), /earlier date/);
});

test('previous days can be reported independently and a failed multi-workspace save is atomic', async t => {
  const {store}=await fixture(t);
  const entry={owner:'Resources/Literature',score:2,summary:'Field observations',expected:null};
  const save=entries=>store.command('progress','save',{day:'2020-02-29',entries});
  await assert.rejects(save([entry,{...entry,owner:'Resources/Missing'}]));
  assert.equal((await store.transaction()).reports,undefined);
  const first=(await save([entry])).reports[0];
  const revised=(await save([{...entry,expected:first.updated,summary:'Reviewed observations'}])).reports[0];
  assert.equal(revised.created,first.created);
  assert.equal(revised.day,'2020-02-29');
  assert.deepEqual(revised.evidence,[]);
});

test('dropped files preserve colliding originals and roll back an incomplete import', async t=>{
  const {root,store}=await fixture(t);
  const parent='Resources/Literature', folder=path.join(root,parent);
  const copy={name:'Observation.md',bytes:Buffer.from('external')};
  await fs.writeFile(path.join(folder,copy.name),'original');
  const state=await files.importFiles(store,parent,[copy]);
  assert.equal(await fs.readFile(path.join(folder,'Observation (2).md'),'utf8'),'external');
  assert.equal(await fs.readFile(path.join(folder,copy.name),'utf8'),'original');
  assert.equal(state.activity[0].path,parent+'/Observation (2).md');
  await assert.rejects(files.importFiles(store,parent,[copy,folder]));
  await assert.rejects(fs.access(path.join(folder,'Observation (3).md')));
});
