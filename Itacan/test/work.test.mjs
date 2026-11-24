import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import storage from '../main/library.cjs';
import work from '../main/work.cjs';
import files from '../main/files.cjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'itacan-work-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const library = await storage.openLibrary(root, true);
  return { root, library, store: new work.LibraryWork(library) };
}

test('recurring capture task has one successor and finished Plan labels survive later edits', async t => {
  const { store, library } = await fixture(t);
  const capture = (await store.command('inbox', 'add', { text: 'Survey' })).inbox[0];
  const data = {
    captureId: capture.id, title: capture.text, owner: 'Resources/Research', due: '2026-03-29',
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
  const owner = 'Resources/Research';
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
  const owner = 'Resources/Research';
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
  await assert.rejects(library.create('Resources/Research', 'Partial', 'note', 'draft'), /interrupted/);
  assert.deepEqual(await library.entries('Resources/Research'), []);
});


test('a plan open at midnight can save its notes before the next day opens', async t => {
  const {store} = await fixture(t);
  const {plan} = await store.command('plan', 'start');
  await store.transaction(state => { state.plan.day = '2000-01-01'; });
  await store.command('plan', 'note', {planId:plan.id, note:'Late observation'});
  const reopened = await store.transaction();
  assert.equal(reopened.plan, null);
  assert.equal(reopened.history[0].note, 'Late observation');
  assert.equal(reopened.history[0].day, '2000-01-01');
  await assert.rejects(store.command('plan','note',{planId:plan.id,note:'stale'}), /ended/);
});
