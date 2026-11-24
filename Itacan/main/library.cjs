const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const collections = ['Projects', 'Resources'];
const resourceNames = ['Knowledge', 'Research', 'Explorations', 'Inspiration'];
const marker = 'itacan-library.json';
const imageTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' };
const canOpenAttachment = name => !!imageTypes[path.extname(name).toLowerCase()] || /\.pdf$/i.test(name);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function validName(value) {
  if (typeof value !== 'string' || !value || value.length > 180 || value !== value.trim() ||
      /^[.]/.test(value) || /[. ]$/.test(value) || /[<>:"/\\|?*\u0000-\u001f]/.test(value) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(value)) {
    throw Error('Choose a file or folder name that works on both Mac and Windows.');
  }
  return value;
}

async function writableFile(file, data, mode) {
  const handle = await fs.open(file, 'wx', mode);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicReplace(file, data, mode, check) {
  const temp = path.join(path.dirname(file), '.itacan-' + randomUUID() + '.tmp');
  try {
    await writableFile(temp, data, mode);
    await check?.();
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true });
  }
}

async function openLibrary(directory, initialize = false) {
  const root = await fs.realpath(directory);
  const manifest = path.join(root, marker);
  let contents;
  try {
    if (!(await fs.lstat(manifest)).isFile()) throw Error('The library marker must be a regular file.');
    contents = await fs.readFile(manifest, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (!initialize) throw Error('Choose an existing Itacan library.');
    const entries = await fs.readdir(root);
    if (entries.some(name => !['.DS_Store', 'desktop.ini', 'Thumbs.db'].includes(name))) {
      throw Error('Choose an empty folder for a new library, or a folder with an Itacan library marker.');
    }
    contents = JSON.stringify({ format: 'itacan-library', version: 1 }, null, 2) + '\n';
    await writableFile(manifest, contents);
  }
  const info = JSON.parse(contents);
  if (info?.format !== 'itacan-library' || info.version !== 1) throw Error('Unrecognized Itacan library format.');
  // Repeatable initialization also completes a first open interrupted between mkdir calls.
  for (const relative of [...collections, ...resourceNames.map(name => 'Resources/' + name)]) {
    const file = path.join(root, relative);
    try { await fs.mkdir(file); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    if (!(await fs.lstat(file)).isDirectory()) throw Error('Expected a local directory at ' + relative);
  }
  return new Library(root);
}

class Library {
  constructor(root) {
    this.root = root;
    this.session = randomUUID();
    this.writes = Promise.resolve();
  }

  async resolve(relative, minimum = 2) {
    if (await fs.realpath(this.root) !== this.root) throw Error('The library moved. Choose its folder again.');
    if (typeof relative !== 'string') throw Error('Invalid library path.');
    const parts = relative.split('/');
    if (!collections.includes(parts[0]) || parts.length < minimum) throw Error('Choose a location in a Project or Resource.');
    let file = this.root;
    for (const part of parts) {
      file = path.join(file, validName(part));
      if ((await fs.lstat(file)).isSymbolicLink()) throw Error('Symbolic links cannot be opened inside the library.');
    }
    return file;
  }

  async entries(relative, minimum = 2) {
    const entries = await fs.readdir(await this.resolve(relative, minimum), { withFileTypes: true });
    return entries.filter(entry => {
      try { validName(entry.name); } catch { return false; }
      return entry.isDirectory() || entry.isFile();
    }).map(entry => ({
      name: entry.name, path: relative + '/' + entry.name, openable: entry.isFile() && canOpenAttachment(entry.name),
      kind: entry.isDirectory() ? 'folder' : /\.md$/i.test(entry.name) ? 'note' : 'file'
    })).sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') ||
      a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  async home() {
    const [projects, resources] = await Promise.all(collections.map(name => this.entries(name, 1)));
    return { name: path.basename(this.root), session: this.session,
      projects: projects.filter(e => e.kind === 'folder'), resources: resources.filter(e => e.kind === 'folder') };
  }

  async create(parent, name, kind, text = '') {
    validName(name);
    if (typeof text !== 'string') throw Error('Invalid note text.');
    if (!['folder', 'note'].includes(kind)) throw Error('Unknown item type.');
    const collection = collections.includes(parent);
    if (collection && (parent !== 'Projects' || kind !== 'folder')) throw Error('Choose a workspace first.');
    const folder = await this.resolve(parent, collection ? 1 : 2);
    const filename = kind === 'note' && !/\.md$/i.test(name) ? name + '.md' : name;
    validName(filename);
    const file = path.join(folder, filename);
    try {
      if (kind === 'folder') await fs.mkdir(file);
      else await writableFile(file, text);
    } catch (error) {
      if (error.code === 'EEXIST') throw Error('An item already has that name.');
      throw error;
    }
    return parent + '/' + filename;
  }

  async notePath(relative) {
    const file = await this.resolve(relative, 3);
    if (!/\.md$/i.test(file) || !(await fs.stat(file)).isFile()) throw Error('Choose a Markdown document.');
    return file;
  }

  async attachmentPath(relative) {
    const file = await this.resolve(relative, 3);
    if (!canOpenAttachment(file) || !(await fs.stat(file)).isFile()) throw Error('Choose a local image or PDF.');
    return file;
  }

  async readNote(relative) {
    const bytes = await fs.readFile(await this.notePath(relative));
    const bom = bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw Error('This document must be UTF-8 to edit it safely.'); }
    return { text, revision: digest(bytes), bom, newline: text.includes('\r\n') ? '\r\n' : '\n' };
  }

  saveNote(relative, text, revision) {
    const write = async () => {
      if (typeof text !== 'string') throw Error('Invalid note text.');
      const file = await this.notePath(relative);
      const before = await this.readNote(relative);
      const changed = () => Error('This note changed on disk. Save a copy to keep your edits, or reopen the disk version.');
      if (revision !== before.revision) throw changed();
      const bytes = Buffer.from((before.bom ? '\ufeff' : '') + text.replace(/\r\n|\r|\n/g, before.newline));
      const { mode } = await fs.stat(file);
      await atomicReplace(file, bytes, mode, async () => {
        if (digest(await fs.readFile(await this.notePath(relative))) !== revision) throw changed();
      });
      return digest(bytes);
    };
    const result = this.writes.then(write);
    this.writes = result.catch(() => {});
    return result;
  }
}

module.exports = { openLibrary, atomicReplace, imageTypes };
