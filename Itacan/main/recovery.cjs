const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { atomicReplace, validName } = require('./library.cjs');
const { validateStoredWork } = require('./work-format.cjs');

const digest = value => value === null ? null : createHash('sha256').update(value).digest('hex');
const serialize = value => JSON.stringify(value, null, 2) + '\n';
const journalName = '.itacan-pending.json';

async function regularText(file) {
  try {
    if (!(await fs.lstat(file)).isFile()) throw Error('Expected a regular file at ' + path.basename(file));
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function identity(library, relative) {
  // Resolve the parent even when the final item is absent. Trash is an internal root.
  const parts = relative.split('/');
  const name = validName(parts.pop());
  const parent = parts.join('/');
  let directory;
  if (parent === 'Trash') {
    directory = path.join(library.root, parent);
    if (!(await fs.lstat(directory)).isDirectory()) throw Error('Invalid library Trash.');
  } else directory = await library.resolve(parent, 1);
  try {
    const entry = await fs.lstat(path.join(directory, name), { bigint: true });
    if (!entry.isDirectory() && !entry.isFile()) throw Error('Unexpected file type during move recovery.');
    return [entry.dev,entry.ino,entry.birthtimeNs].map(String).join('/');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function prepareMove(library, raw, next, source, target) {
  const file = path.join(library.root, journalName);
  const record = { version:1, source, target, identity:await identity(library,source),
    before:digest(raw), after:serialize(next) };
  if (!record.identity) throw Error('The item to move is missing.');
  await atomicReplace(file, serialize(record), undefined, async () => {
    if (await regularText(file) !== null) throw Error('Another library move is pending.');
  });
  return record.identity;
}

async function fileDigest(library,relative) {
  try {
    const file = await library.resolve(relative,3);
    if (!(await fs.lstat(file)).isFile()) throw Error('Expected a regular destination file.');
    return digest(await fs.readFile(file));
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function prepareFiling(library,raw,state,target,original,written) {
  if (await fileDigest(library,target) !== original) {
    const error = Error(original === null ? 'An item already has that name.' : 'The note changed on disk.');
    if (original === null) error.code = 'EEXIST';
    throw error;
  }
  const record = {version:1,kind:'filing',target,original,written,before:digest(raw),
    after:serialize({...state,revision:(state.revision || 0)+1})};
  const file = path.join(library.root,journalName);
  await atomicReplace(file,serialize(record),undefined,async()=>{
    if (await regularText(file) !== null) throw Error('Another library operation is pending.');
  });
}

async function recoverMove(library) {
  if (await fs.realpath(library.root) !== library.root) throw Error('The library moved. Choose its folder again.');
  const file = path.join(library.root,journalName);
  const raw = await regularText(file);
  if (raw === null) return;
  const p = JSON.parse(raw);
  const ambiguous = () => Error('An interrupted library operation needs review. Preserve the library and its .itacan-pending.json file before proceeding.');
  if (p.version !== 1 || typeof p.after !== 'string') throw ambiguous();
  let applied, unchanged;
  if (p.kind === 'filing') {
    const bytes = await fileDigest(library,p.target);
    applied = bytes === p.written;
    unchanged = bytes === p.original;
  } else {
    if (!p.identity) throw ambiguous();
    const [source,target] = await Promise.all([identity(library,p.source),identity(library,p.target)]);
    applied = source === null && target === p.identity;
    unchanged = source === p.identity && target === null;
  }
  const work = path.join(library.root,'itacan-work.json');
  const stored = await regularText(work);
  if (applied) {
    try { validateStoredWork(JSON.parse(p.after)); }
    catch { throw ambiguous(); }
    if (stored !== p.after) {
      if (digest(stored) !== p.before) throw ambiguous();
      await atomicReplace(work,p.after,undefined,async () => {
        if (stored !== await regularText(work)) throw ambiguous();
      });
    }
  } else if (!unchanged || digest(stored) !== p.before) throw ambiguous();
  await fs.unlink(file);
}

module.exports = { prepareMove, prepareFiling, digest, identity, recoverMove, regularText, serialize };
