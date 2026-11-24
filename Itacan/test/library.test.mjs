import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import libraryModule from '../main/library.cjs';
const { openLibrary } = libraryModule;

async function folder(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'itacan-library-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('fresh library, real workspace folders, exclusive creation and reopen', async t => {
  const root = await folder(t);
  const library = await openLibrary(root, true);
  assert.equal((await library.home()).resources.length, 4);
  const project = await library.create('Projects', 'Forest survey', 'folder');
  const notes = await library.create(project, 'Notes', 'folder');
  const note = await library.create(notes, 'Observation', 'note', '# Observation');
  await assert.rejects(library.create(notes, 'Observation.md', 'note'), /already/);
  assert.equal((await library.entries(notes))[0].path, note);
  assert.equal((await (await openLibrary(root)).readNote(note)).text, '# Observation');
});

test('stale saves preserve external edits and overlapping revisions commit once', async t => {
  const library = await openLibrary(await folder(t), true);
  const file = await library.create('Resources/Research', 'Paper', 'note', '\ufeff# Paper\r\nText\r\n');
  const original = await library.readNote(file);
  assert.equal(original.bom, true);
  const results = await Promise.allSettled(['First\n', 'Second\n'].map(text => library.saveNote(file, text, original.revision)));
  assert.deepEqual(results.map(r => r.status), ['fulfilled', 'rejected']);
  const disk = path.join(library.root, file);
  assert.equal(await fs.readFile(disk, 'utf8'), '\ufeffFirst\r\n');
  await fs.writeFile(disk, 'Outside edit');
  await assert.rejects(library.saveNote(file, 'Overwrite', results[0].value), /changed on disk/);
  assert.equal(await fs.readFile(disk, 'utf8'), 'Outside edit');
  await fs.writeFile(disk, Buffer.from([0xff]));
  await assert.rejects(library.readNote(file), /UTF-8/);
});

test('unrelated folders, invalid names and paths are protected', async t => {
  const root = await folder(t);
  await fs.writeFile(path.join(root, 'my-file'), 'keep');
  await assert.rejects(openLibrary(root, true), /empty folder/);
  assert.deepEqual(await fs.readdir(root), ['my-file']);
  const library = await openLibrary(await folder(t), true);
  for (const name of ['../escape', 'a:b', 'a\\b', 'nul.md', '.hidden', 'a.']) {
    await assert.rejects(library.create('Resources/Research', name, 'note'));
  }
  await assert.rejects(library.entries('Resources/../Projects'));
  await fs.symlink(root, path.join(library.root, 'Projects', 'Link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(library.entries('Projects/Link'), /Symbolic/);
  assert.equal((await library.home()).projects.length, 0);
  const paper = 'Resources/Research/Paper.pdf';
  await fs.writeFile(path.join(library.root, paper), '%PDF-');
  assert.equal(await library.attachmentPath(paper), path.join(library.root, paper));
  await fs.writeFile(path.join(library.root, 'Resources/Research/Script.cmd'), 'test');
  await assert.rejects(library.attachmentPath('Resources/Research/Script.cmd'), /image or PDF/);
});
