const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { validName } = require('./library.cjs');
const { recordActivity } = require('./progress.cjs');
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
    if (/\.md$/i.test(from)) recordActivity(data,trash?'deleted':parent===parts.slice(0,-1).join('/')?'renamed':'moved',relative || from,{previous:from,removed:!!trash});
    if (parts.length===2) recordActivity(data,trash?'project-deleted':'project-renamed',relative || from,{removed:!!trash,removedWorkspace:!!trash});
    await fs.rename(source, target);
    return () => fs.rename(target, source);
  });
  return { state, removed };
}
async function copyItem(work, from, parent) {
  const {library}=work;
  const source = await fs.realpath(await library.resolve(from,3));
  const directory = await fs.realpath(await library.resolve(parent));
  const relative = path.relative(source,directory);
  if (!relative || (relative !== '..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative))) throw Error('Choose a folder outside the item.');
  const base = path.basename(source);
  const target = path.join(directory,base);
  if ((await fs.stat(source)).isFile()) {
    if (!/\.md$/i.test(base)) return fs.copyFile(source,target,fs.constants.COPYFILE_EXCL);
    await work.transaction(async state=>{
      await fs.copyFile(source,target,fs.constants.COPYFILE_EXCL);
      recordActivity(state,'created',library.relativePath(target));
      const copied=await fs.stat(target);
      return async ()=>{
        const current=await fs.stat(target);
        if(current.ino===copied.ino && current.size===copied.size && current.mtimeMs===copied.mtimeMs) await fs.unlink(target);
      };
    });
    return;
  }
  await fs.mkdir(target);
  try {
    await fs.cp(source,target,{recursive:true,errorOnExist:true,force:false,filter:async entry=>{
      const stat = await fs.lstat(entry);
      if (!(stat.isFile() || stat.isDirectory()) || stat.isSymbolicLink()) throw Error('Only regular files and folders can be copied.');
      return true;
    }});
  } catch (error) { await fs.rm(target,{recursive:true,force:true}); throw error; }
}
async function copyDroppedFile(source,destination) {
  if(typeof source==='string') {
    if(!(await fs.lstat(source)).isFile())throw Error('Choose individual files.');
    return fs.copyFile(source,destination,fs.constants.COPYFILE_EXCL);
  }
  const file=await fs.open(destination,'wx');
  try {await file.writeFile(source.bytes);}
  catch(error){await file.close();await fs.unlink(destination);throw error;}
  await file.close();
}
async function importFiles(work,parent,files) {
  return work.transaction(async state=>{
    const folder=await work.library.resolve(parent,2), copied=[];
    const rollback=()=>Promise.all(copied.map(file=>fs.unlink(file)));
    try {
      for(const source of files) {
        const name=validName(typeof source==='string'?path.basename(source):source.name);
        const {name:stem,ext}=path.parse(name);
        let counter=1;
        for(;;) {
          const candidate=counter===1?name:stem+' ('+counter+')'+ext;
          const destination=path.join(folder,candidate);
          try {await copyDroppedFile(source,destination);}
          catch(error){if(error.code==='EEXIST'){counter++;continue;}throw error;}
          copied.push(destination);
          if(/\.md$/i.test(name))recordActivity(state,'created',parent+'/'+candidate);
          break;
        }
      }
    } catch(error){await rollback();throw error;}
    return rollback;
  });
}
async function captureFiles(work, paths, text = '', stage = false) {
  const copies = [];
  const cleanup = () => Promise.all(copies.map(file => fs.rm(file, { force: true })));
  return work.transaction(async data => {
    if (stage && data.quickText?.trim()) throw Error('Clear the text before choosing files.');
    const target = stage ? (data.quickFiles ||= []) : data.inbox;
    const folder = await privateFolder(work.library, 'Inbox attachments');
    try {
      for (const source of paths) {
        const name = validName(typeof source === 'string' ? path.basename(source) : source.name);
        const id = randomUUID();
        const dest = path.join(folder, id + '-' + name);
        await copyDroppedFile(source,dest);
        copies.push(dest);
        target.unshift({ id, name, created: new Date().toISOString() });
      }
      if (text.trim()) data.inbox.unshift({ id: randomUUID(), text, created: new Date().toISOString() });
    } catch (error) { await cleanup(); throw error; }
    return cleanup;
  });
}
async function resolveAttachment(work, id, parent, staged = false) {
  let source;
  const state = await work.transaction(async data => {
    const records = staged ? data.quickFiles || [] : data.inbox;
    const item = records.find(i => i.id === id);
    if (!item?.name) throw Error('Attachment unavailable.');
    const folder = await privateFolder(work.library, 'Inbox attachments');
    source = path.join(folder, validName(item.id) + '-' + validName(item.name));
    if (!(await fs.lstat(source)).isFile()) throw Error('Invalid attachment.');
    let dest;
    if (parent) {
      dest = path.join(await work.library.resolve(parent), item.name);
      await fs.copyFile(source, dest, fs.constants.COPYFILE_EXCL);
    }
    records.splice(records.indexOf(item),1);
    if (dest) return () => fs.unlink(dest);
  });
  await fs.unlink(source).catch(() => { }); // A leftover staging copy is harmless.
  return state;
}
// Resolve Inbox text only after its destination has committed. Roll back that write if
// saving the work file fails. Revision checks also protect edits made outside Itacan.
async function fileText(work, { id, ids = id ? [id] : [], quick, text, folder, name, path: note, draft, revision, offset = draft?.length, marker }) {
  let saved;
  const library = work.library;
  const state = await work.transaction(async data => {
    if (ids.length) {
      text = ids.map(key => {
        const item = data.inbox.find(i => i.id === key);
        if (!item?.text) throw Error('Capture is no longer available.');
        return item.text;
      }).join('\n\n');
    }
    if (typeof text !== 'string' || !text.trim()) throw Error('Enter capture text.');
    let rollback;
    if (note) {
      const before = await library.readNote(note);
      if (before.revision !== revision) throw Error('This note changed on disk. Reopen the note before appending.');
      if (!Number.isInteger(offset) || offset<0 || offset>draft.length) throw Error('Select a current note position.');
      const beforeText = draft.slice(0,offset), afterText = draft.slice(offset);
      const gap = marker ? '\n' : '\n\n';
      const left = beforeText ? gap.slice(Math.min(gap.length,beforeText.match(/\n*$/)[0].length)) : '';
      const right = afterText ? gap.slice(Math.min(gap.length,afterText.match(/^\n*/)[0].length)) : '';
      const inserted = marker ? marker+' '+text.replace(/\n/g,'\n  ') : text;
      const content = beforeText+left+inserted+right+afterText;
      saved = { text: content, revision: await library.saveNote(note, content, revision) };
      recordActivity(data,'edited',before.path);
      rollback = () => library.saveNote(note, before.text, saved.revision);
    } else {
      const created = await library.create(folder, name, 'note', text);
      recordActivity(data,'created',created);
      rollback = async () => {
        if ((await library.readNote(created)).text === text) await fs.unlink(await library.notePath(created));
      };
    }
    if (ids.length) data.inbox = data.inbox.filter(i => !ids.includes(i.id));
    if (quick) data.quickText = '';
    return rollback;
  });
  return { state, saved };
}
async function createItem(work,parent,name,kind,text) {
  const project=parent==='Projects' && kind==='folder';
  if (kind !== 'note' && !project) return work.library.create(parent,name,kind,text);
  let created;
  await work.transaction(async state => {
    created = await work.library.create(parent,name,kind,text);
    recordActivity(state,project?'project-created':'created',created);
    if(project)return ()=>fs.rmdir(path.join(work.library.root,created));
    return async () => {
      if ((await work.library.readNote(created)).text === (text || '')) await fs.unlink(await work.library.notePath(created));
    };
  });
  return created;
}
async function saveDocument(work,file,text,revision) {
  let saved;
  await work.transaction(async state => {
    const previous = await work.library.readNote(file);
    saved = await work.library.saveNote(previous.path,text,revision);
    recordActivity(state,'edited',previous.path);
    return () => work.library.saveNote(previous.path,previous.text,saved);
  });
  return saved;
}
module.exports = { createItem, saveDocument, copyItem, moveItem, importFiles, captureFiles, resolveAttachment, fileText };
