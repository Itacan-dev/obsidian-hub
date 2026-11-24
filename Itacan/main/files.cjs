const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { validName } = require('./library.cjs');
const { rewriteRefs } = require('./work.cjs');

async function privateFolder(library, name) {
  const folder = path.join(library.root, name);
  await fs.mkdir(folder).catch(e => { if (e.code !== 'EEXIST') throw e; });
  if (!(await fs.lstat(folder)).isDirectory()) throw Error('Expected a library directory.');
  return folder;
}
async function moveItem(work, from, parent, name, trash) {
  const { library } = work;
  let removed;
  const state = await work.transaction(async data => {
    const source = await library.resolve(from);
    const parts = from.split('/');
    if (parts.length === 2 && (parts[0] !== 'Projects' || parent !== 'Projects' && !trash)) throw Error('Keep workspaces in their collection.');
    let target, relative;
    if (trash) {
      const folder = await privateFolder(library, 'Trash');
      removed = path.join(folder, randomUUID() + '-' + path.basename(source));
      target = removed;
      relative = '';
    } else {
      validName(name);
      if (/\.md$/i.test(from) && !/\.md$/i.test(name)) throw Error('Keep the .md extension on notes.');
      const directory = await library.resolve(parent, parts.length === 2 ? 1 : 2);
      if (!(await fs.stat(directory)).isDirectory()) throw Error('Choose a folder.');
      target = path.join(directory, name);
      relative = parent + '/' + name;
      if (target === source) return;
      if (parent === from || parent.startsWith(from + '/')) throw Error('Choose a folder outside the item.');
      await fs.lstat(target).then(() => { throw Error('An item already has that name.'); }, e => { if (e.code !== 'ENOENT') throw e; });
    }
    rewriteRefs(data, from, relative);
    await fs.rename(source, target);
    return () => fs.rename(target, source);
  });
  return { state, removed };
}
async function captureFiles(work, paths, text = '') {
  const copies = [];
  const cleanup = () => Promise.all(copies.map(file => fs.rm(file, { force: true })));
  return work.transaction(async data => {
    const folder = await privateFolder(work.library, 'Inbox attachments');
    try {
      for (const source of paths) {
        const name = validName(path.basename(source));
        const id = randomUUID();
        const dest = path.join(folder, id + '-' + name);
        await fs.copyFile(source, dest, fs.constants.COPYFILE_EXCL);
        copies.push(dest);
        data.inbox.unshift({ id, name, created: new Date().toISOString() });
      }
      if (text.trim()) data.inbox.unshift({ id: randomUUID(), text, created: new Date().toISOString() });
    } catch (error) { await cleanup(); throw error; }
    return cleanup;
  });
}
async function resolveAttachment(work, id, parent) {
  let source;
  const state = await work.transaction(async data => {
    const item = data.inbox.find(i => i.id === id);
    if (!item?.name) throw Error('Attachment unavailable.');
    const folder = await privateFolder(work.library, 'Inbox attachments');
    source = path.join(folder, validName(item.id) + '-' + validName(item.name));
    if (!(await fs.lstat(source)).isFile()) throw Error('Invalid attachment.');
    let dest;
    if (parent) {
      dest = path.join(await work.library.resolve(parent), item.name);
      await fs.copyFile(source, dest, fs.constants.COPYFILE_EXCL);
    }
    data.inbox = data.inbox.filter(i => i.id !== id);
    if (dest) return () => fs.unlink(dest);
  });
  await fs.unlink(source).catch(() => { }); // A leftover staging copy is harmless.
  return state;
}
// Resolve Inbox text only after its destination has committed. Roll back that write if
// saving the work file fails. Revision checks also protect edits made outside Itacan.
async function fileText(work, { id, text, folder, name, path: note, draft, revision }) {
  let saved;
  const library = work.library;
  const state = await work.transaction(async data => {
    if (id) {
      const item = data.inbox.find(i => i.id === id);
      if (!item?.text) throw Error('Capture is no longer available.');
      text = item.text;
    }
    if (typeof text !== 'string' || !text.trim()) throw Error('Enter capture text.');
    let rollback;
    if (note) {
      const before = await library.readNote(note);
      if (before.revision !== revision) throw Error('This note changed on disk. Reopen the note before appending.');
      const content = draft + (draft ? '\n\n' : '') + text;
      saved = { text: content, revision: await library.saveNote(note, content, revision) };
      rollback = () => library.saveNote(note, before.text, saved.revision);
    } else {
      const created = await library.create(folder, name, 'note', text);
      rollback = async () => {
        if ((await library.readNote(created)).text === text) await fs.unlink(await library.notePath(created));
      };
    }
    if (id) data.inbox = data.inbox.filter(i => i.id !== id);
    return rollback;
  });
  return { state, saved };
}
module.exports = { moveItem, captureFiles, resolveAttachment, fileText };
