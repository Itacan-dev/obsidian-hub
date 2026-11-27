import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, rename, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {openLibrary} from '../main/library.cjs';
import {LibraryWork} from '../main/work.cjs';
import {createItem, importFiles, moveItem} from '../main/files.cjs';

function onePagePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((body, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return String(offset).padStart(10, '0') + ' 00000 n \n';
  });
  const xref = pdf.length;
  return Buffer.from(pdf + 'xref\n0 4\n0000000000 65535 f \n' + offsets.join('') +
    `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`, 'ascii');
}

test('the entire workday reopens together after a managed note move and a library relocation', async t => {
  t.mock.timers.enable({apis:['Date'], now:new Date(2026, 8, 7, 10)});
  const temp = await mkdtemp(path.join(tmpdir(), 'itacan-portable-day-'));
  t.after(() => rm(temp, {recursive:true, force:true}));
  const original = path.join(temp, 'Field library');
  const relocated = path.join(temp, 'Another device', 'Restored library');
  await mkdir(original);
  const library = await openLibrary(original, true);
  const store = new LibraryWork(library);
  const project = await createItem(store, 'Projects', 'Canopy survey', 'folder');
  const literature = 'Resources/Literature';
  const shared = await createItem(store, literature, 'Methods', 'folder');
  const working = await createItem(store, shared, 'Working', 'folder');
  const filed = await createItem(store, shared, 'Filed', 'folder');
  await store.command('workspace', 'attach', {project, folder:shared});

  const noteText = '# Sampling\n\n[Protocol](../Protocol.pdf)\n\n![Canopy](../canopy.jpg)\n';
  const note = await createItem(store, working, 'Field notes', 'note', noteText);
  const pdf = shared + '/Protocol.pdf', image = shared + '/canopy.jpg';
  const pdfBytes = onePagePdf();
  const imageBytes = await readFile(new URL('../examples/Field Library/Projects/Forest survey/canopy.jpg', import.meta.url));
  await importFiles(store, shared, [{name:'Protocol.pdf', bytes:pdfBytes}, {name:'canopy.jpg', bytes:imageBytes}]);

  const capture = (await store.command('capture', 'send', {text:'Check the sampling method'})).inbox[0];
  const [captured] = (await store.command('task', 'save', {
    captureId:capture.id, title:capture.text, owner:project
  })).tasks;
  assert.equal(captured.importance,'');
  assert.equal(captured.location,'');
  await store.command('task','attach',{id:captured.id,owner:project,location:note});
  const [must] = (await store.command('task','save',{
    ...captured,location:note,importance:'Must do',steps:[{text:'Compare the readings',done:false}]
  })).tasks;
  const should = (await store.command('task', 'save', {
    title:'Review next site', owner:project, importance:'Should do'
  })).tasks.find(task => task.id !== must.id);
  const entries = [
    {kind:'task', ref:must.id}, {kind:'task', ref:should.id}, {kind:'note', ref:note},
    {kind:'file', ref:pdf}, {kind:'file', ref:image}, {kind:'workspace', ref:project}
  ];
  const {plan} = await store.command('plan', 'addMany', {items:entries});
  await store.command('plan', 'note', {planId:plan.id, note:'Compare the method with the field photograph.'});
  const layout = {
    workspace:project, active:0,
    panes:[
      {id:'notes', edit:'live', file:note, tabs:[note], views:{[note]:{editing:'live', editTop:120}}},
      {id:'sources', file:pdf, tabs:[pdf, image], views:{[pdf]:{page:1}}}
    ],
    split:{axis:'row', first:'notes', second:'sources', share:0.6}
  };
  await store.command('layout', 'preset', {name:'Field desk', layout});
  await store.command('layout', 'remember', {layout});
  const settings = {theme:'dark', saveMode:'manual', editorMode:'source'};
  await store.command('settings', 'save', settings);

  const startOath = (condition, task) => store.command('oath', 'start', {
    mode:'regular', owner:project, condition, minutes:10, taskIds:[task.id]
  });
  const {oath:committed} = await startOath('tasks', must);
  const afterStep=await store.command('task','step',{id:must.id,stepId:must.steps[0].id,done:true});
  assert.equal(afterStep.oath.id,committed.id);
  t.mock.timers.tick(60_000);
  await store.command('task', 'complete', {id:must.id, done:true});
  const {oath:abandoned} = await startOath('duration', should);
  t.mock.timers.tick(30_000);
  const {oathHistory} = await store.command('oath', 'break', {id:abandoned.id});
  const {history:[finished]} = await store.command('plan', 'finish', {planId:plan.id});
  const reflection = {owner:project, score:0, summary:'The sample needs another reading before it can be used.', expected:null};
  const {reports:[report]} = await store.command('progress', 'save', {day:plan.day, entries:[reflection]});

  await moveItem(store, note, filed, 'Verified sampling.md');
  const moved = filed + '/Verified sampling.md';
  await mkdir(path.dirname(relocated));
  await rename(original, relocated);
  const reopened = await openLibrary(relocated);
  const state = await new LibraryWork(reopened).transaction();
  assert.notEqual(reopened.session, library.session);
  assert.deepEqual(state.sharedFolders[project], [shared]);
  assert.deepEqual(state.settings, settings);
  assert.deepEqual(state.inbox, []);
  assert.deepEqual(state.tasks, [{...afterStep.tasks[0], location:moved, done:true}, should]);
  assert.deepEqual(state.tasks.map(task => [task.owner, task.importance]), [[project, 'Must do'], [project, 'Should do']]);

  assert.equal(state.plan, null);
  assert.equal(state.history.length, 1);
  const [history] = state.history;
  assert.equal(history.id, plan.id);
  assert.equal(history.reason, 'Finished');
  assert.equal(history.note, 'Compare the method with the field photograph.');
  assert.deepEqual(history.entries.map(entry => entry.id), plan.entries.map(entry => entry.id));
  assert.deepEqual(history.entries.map(({kind,ref}) => ({kind,ref})),
    entries.map(entry => entry.ref === note ? {...entry, ref:moved} : entry));
  assert.deepEqual(history.entries.filter(entry => entry.kind === 'task').map(entry => entry.done), [true, false]);
  assert.deepEqual(history.entries.map(entry => entry.label), finished.entries.map(entry => entry.label));
  assert.equal(history.entries.find(entry => entry.kind === 'note').route, note);

  assert.equal(state.oath, null);
  assert.deepEqual(state.oathHistory, oathHistory);
  assert.deepEqual(state.oathHistory.map(({id,mode,status,taskIds,activeMs}) => [id,mode,status,taskIds,activeMs]), [
    [abandoned.id, 'regular', 'broken', [should.id], 30_000],
    [committed.id, 'regular', 'fulfilled', [must.id], 60_000]
  ]);
  assert.deepEqual(state.reports, [report]);
  assert.equal(report.score, reflection.score);
  assert.equal(report.summary, reflection.summary);
  assert.ok(report.evidence.some(event => event.action === 'task' && event.title === must.title && event.path === note));
  assert.ok(state.activity.some(event => event.action === 'task' && event.taskId === must.id && event.path === moved));

  const movedPane = {...layout.panes[0], file:moved, tabs:[moved], views:{[moved]:layout.panes[0].views[note]}};
  const movedLayout = {...layout, panes:[movedPane, layout.panes[1]]};
  assert.deepEqual(state.presets, [{name:'Field desk', layout:movedLayout}]);
  assert.deepEqual(state.workspaceLayouts[project], movedLayout);
  assert.deepEqual(state.lastLayout, movedLayout);
  await assert.rejects(reopened.documentPath(note), {code:'ENOENT'});
  assert.deepEqual(await readFile(await reopened.documentPath(moved)), Buffer.from(noteText));
  assert.deepEqual(await readFile(await reopened.documentPath(pdf)), pdfBytes);
  assert.deepEqual(await readFile(await reopened.documentPath(image)), imageBytes);
});
