const fs = require('node:fs/promises');
const {validName} = require('./library.cjs');

async function setAttachment(state, action, { project, folder }, library) {
  if (typeof project !== 'string' || !/^Projects\/[^/]+$/.test(project) ||
      !(await fs.stat(await library.resolve(project))).isDirectory()) throw Error('Choose a Project.');
  if (typeof folder !== 'string' || !/^Resources\/[^/]+\/[^/]+/.test(folder)) throw Error('Choose a folder inside a Resource.');
  const links = (state.sharedFolders ||= {})[project] ||= [];
  if (action === 'detach') {
    const linkedTasks = state.tasks.filter(task => within(task.location,folder));
    if (state.oath?.owner===project && linkedTasks.some(task => task.owner!==project && state.oath.taskIds.includes(task.id))) {
      throw Error('End the Oath before detaching the folder containing its selected tasks.');
    }
    state.sharedFolders[project] = links.filter(path => path !== folder);
    for (const task of linkedTasks.filter(task=>task.owner===project)) {
      task.missingLocation=task.location;
      task.location='';
    }
    const explorer = state.explorers?.[project];
    if (explorer && within(explorer.folder, folder)) explorer.folder = project;
    if (state.lastWorkspace === project && within(state.lastFolder,folder)) state.lastFolder = project;
    return;
  }
  if (action !== 'attach') throw Error('Unknown Resource folder action.');
  if (!(await fs.stat(await library.resolve(folder,3))).isDirectory()) throw Error('Choose a Resource folder.');
  if (links.some(path => within(path, folder) || within(folder, path))) throw Error('This folder overlaps an existing attachment.');
  links.push(folder);
}

function within(path, root) {
  return path === root || typeof path === 'string' && path.startsWith(root + '/');
}

function rewriteWorkspaceRefs(state, from, to) {
  const moved = path => !within(path, from) ? path : to ? to + path.slice(from.length) : '';
  if (state.lastWorkspace) state.lastWorkspace = moved(state.lastWorkspace);
  if (state.sharedFolders) {
    const next = {};
    for (const [workspace, folders] of Object.entries(state.sharedFolders)) {
      const owner = moved(workspace);
      if (owner) next[owner] = folders.map(moved).filter(folder => folder.startsWith('Resources/'));
    }
    state.sharedFolders = next;
  }
  for (const [status, order] of Object.entries(state.projectOrder || {})) {
    state.projectOrder[status] = order.map(moved).filter(Boolean);
  }
  if (state.explorers) {
    const explorers = {};
    for (const [path, view] of Object.entries(state.explorers)) {
      const owner = moved(path);
      if (!owner) continue;
      const next = { ...view, folder: moved(view.folder), expanded: view.expanded.map(moved).filter(Boolean) };
      if (view.order) {
        next.order = view.order.map(moved).filter(folder => folder && folder.slice(0, folder.lastIndexOf('/')) === owner);
      }
      explorers[owner] = next;
    }
    state.explorers = explorers;
  }
  if (state.lastFolder) state.lastFolder = moved(state.lastFolder);
  if (state.projectStatus?.[from]) {
    const status = state.projectStatus[from];
    delete state.projectStatus[from];
    if (to) state.projectStatus[to] = status;
  }
}
async function relinkDestination(library, {from,to}) {
  if(typeof from!=='string' || !/^(Projects|Resources)\//.test(from) || from.split('/').length<3) throw Error('Choose a missing library document.');
  from.split('/').forEach(validName);
  await library.resolve(from,3).then(()=>{throw Error('The original document still exists.');},error=>{if(error.code!=='ENOENT')throw error;});
  const resolved=library.relativePath(await library.documentPath(to));
  const kind=file=>/\.md$/i.test(file)?'note':/\.pdf$/i.test(file)?'pdf':'image';
  if(kind(from)!==kind(resolved))throw Error('Choose a replacement of the same document type.');
  return resolved;
}

async function workspaceAction(state, action, data, library) {
  if (action==='attach' || action==='detach') return setAttachment(state,action,data,library);
  await library.resolve(data.path);
  if (action==='visit') {
    const owner=data.workspace || data.path.split('/').slice(0,2).join('/');
    await library.resolve(owner);
    if (!within(data.path,owner) && !(state.sharedFolders?.[owner] || []).some(folder=>within(data.path,folder))) {
      throw Error('This folder is outside the workspace.');
    }
    state.lastFolder=data.path;
    state.lastWorkspace=owner;
    const views=state.explorers ||= {};
    (views[owner] ||= {expanded:[]}).folder=data.path;
    return;
  }
  if (action==='explorer') {
    const {folder,expanded,sort,direction,width,order}=data;
    if (!Array.isArray(expanded) || expanded.some(p=>typeof p!=='string') ||
        order!==undefined && (!Array.isArray(order) || order.some(p=>typeof p!=='string'))) throw Error('Invalid workspace folder list.');
    (state.explorers ||= {})[data.path]={folder,expanded,sort,direction,width,order};
    return;
  }
  if (['Active','Future','Shelved'].includes(data.status) && data.path.startsWith('Projects/')) {
    if (action==='status') {
      (state.projectStatus ||= {})[data.path]=data.status;
      return;
    }
    if (action==='project-order' && Array.isArray(data.order)) {
      (state.projectOrder ||= {})[data.status]=[...new Set(data.order.filter(p=>typeof p==='string' && /^Projects\/[^/]+$/.test(p)))];
      return;
    }
  }
  throw Error('Unknown workspace action.');
}
module.exports = { setAttachment, rewriteWorkspaceRefs, relinkDestination, workspaceAction };
