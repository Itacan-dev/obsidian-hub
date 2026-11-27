const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { atomicReplace, validName } = require('./library.cjs');
const { taskAction } = require('./tasks.cjs');
const { saveReports, recordTaskChanges, moveProgress } = require('./progress.cjs');
const { today, expired, finish, planAction } = require('./plan.cjs');

function empty() {
  return { version: 1, tasks: [], inbox: [], plan: null, history: [], presets: [], lastLayout: null };
}
function rewriteRefs(state, from, to) {
  function rewrite(value) {
    if (value !== from && !value?.startsWith(from + '/')) return value;
    return to ? to + value.slice(from.length) : '';
  }
  moveProgress(state,from,to);
  for(const [status,order] of Object.entries(state.projectOrder || {}))
    state.projectOrder[status]=order.map(rewrite).filter(Boolean);
  if (state.explorers) {
    const views = {};
    for (const [path,view] of Object.entries(state.explorers)) {
      if (rewrite(path)) {
        views[rewrite(path)] = {...view,folder:rewrite(view.folder),expanded:view.expanded.map(rewrite).filter(Boolean)};
        if(view.order) views[rewrite(path)].order=view.order.map(rewrite).filter(p=>p && p.slice(0,p.lastIndexOf('/'))===rewrite(path));
      }
    }
    state.explorers = views;
  }
  if (state.lastFolder) state.lastFolder = rewrite(state.lastFolder);
  if (state.projectStatus?.[from]) {
    const status = state.projectStatus[from];
    delete state.projectStatus[from];
    if (to) state.projectStatus[to] = status;
  }
  for (const task of state.tasks) {
    task.owner = rewrite(task.owner);
    if (task.location && rewrite(task.location) !== task.location) {
      task.location = rewrite(task.location);
      if (task.location) task.owner = task.location.split('/').slice(0, 2).join('/');
    }
  }
  for (const entry of state.plan?.entries || []) {
    if (entry.kind === 'task' || entry.missing) continue;
    const ref = rewrite(entry.ref);
    if (!ref) entry.missing = true;
    else { entry.ref = ref; entry.label = ref.split('/').at(-1); }
  }
  for (const plan of state.history) for (const entry of plan.entries) {
    if (entry.kind === 'task' || entry.missing) continue;
    entry.route ||= entry.ref;
    const ref = rewrite(entry.ref);
    if (ref) entry.ref = ref; else entry.missing = true;
  }
  for (const layout of [state.lastLayout, ...state.presets.map(p => p.layout)].filter(Boolean)) {
    if (layout.explorer) {
      if(layout.explorer.order) layout.explorer.order=layout.explorer.order.map(rewrite).filter(Boolean);
      layout.explorer.folder = rewrite(layout.explorer.folder);
      layout.explorer.expanded = layout.explorer.expanded.map(rewrite).filter(Boolean);
    }
    if (layout.folder) layout.folder = rewrite(layout.folder);
    if (layout.expanded) layout.expanded = layout.expanded.map(rewrite).filter(Boolean);
    for (const pane of layout.panes) {
      if (pane.views) pane.views=Object.fromEntries(Object.entries(pane.views).filter(([file])=>rewrite(file)).map(([file,prefs])=>[rewrite(file),prefs]));
      pane.tabs = pane.tabs.map(rewrite).filter(Boolean);
      pane.file = rewrite(pane.file) || pane.tabs[0] || '';
    }
    layout.panes = layout.panes.filter(p => p.file);
    if (!layout.panes.length) layout.panes.push({ file: '', tabs: [], edit: false });
    layout.active = Math.min(layout.active, layout.panes.length - 1);
  }
}

function updateLayout(state, action, {name, layout, next}) {
  const index = state.presets.findIndex(p => p.name === name);
  if (['rename','up','down','reorder'].includes(action)) {
    if (index < 0) throw Error('Preset is unavailable.');
    if (action === 'rename') {
      validName(next);
      if (state.presets.some(p => p.name === next && p.name !== name)) throw Error('Name already in use.');
      state.presets[index].name = next;
    } else {
      const to = action==='reorder' ? state.presets.findIndex(p=>p.name===next) : index + (action === 'up' ? -1 : 1);
      if (to >= 0 && to < state.presets.length) state.presets.splice(to,0,state.presets.splice(index,1)[0]);
    }
    return;
  }
  if (action === 'remove') {
    state.presets = state.presets.filter(preset => preset.name !== name);
    return;
  }
  const panes = layout?.panes;
  if (!Array.isArray(panes) || panes.length < 1 ||
      !Number.isInteger(layout.active) || !panes[layout.active] ||
      panes.some(pane => !Array.isArray(pane.tabs) || pane.tabs.some(file => typeof file !== 'string') ||
        (pane.file ? !pane.tabs.includes(pane.file) : pane.tabs.length))) throw Error('Invalid document layout.');
  if (action === 'remember') state.lastLayout = layout;
  else if (action === 'preset') {
    validName(name);
    if (index >= 0) state.presets[index].layout = layout;
    else state.presets.push({name, layout});
  } else throw Error('Unknown layout action.');
}

class LibraryWork {
  constructor(library) {
    this.library = library;
    this.file = path.join(library.root, 'itacan-work.json');
    this.queue = Promise.resolve();
  }
  async load() {
    if (await fs.realpath(this.library.root) !== this.library.root) throw Error('The library moved. Choose its folder again.');
    try {
      if (!(await fs.lstat(this.file)).isFile()) throw Error('Invalid library work file.');
      const raw = await fs.readFile(this.file, 'utf8');
      const state = JSON.parse(raw);
      if (state.version !== 1 || !Array.isArray(state.tasks) || !Array.isArray(state.inbox)) throw Error('Unknown library work format.');
      return { raw, state };
    } catch (error) { if (error.code === 'ENOENT') return { raw: null, state: empty() }; throw error; }
  }
  transaction(change) {
    const run = async () => {
      const { state, raw } = await this.load();
      const expiredPreview = state.finishedPreview && state.history.find(p=>p.id===state.finishedPreview)?.day !== today();
      const rollover = !change && expired(state.plan);
      if (expiredPreview) state.finishedPreview=null;
      if (!change && !rollover && !expiredPreview) return state;
      if (rollover) finish(state);
      let rollback;
      try {
        rollback = await change?.(state);
        const next = JSON.stringify(state, null, 2) + '\n';
        if (next !== (raw ?? JSON.stringify(empty(), null, 2) + '\n')) {
          await atomicReplace(this.file, next, undefined, async () => {
            const current = await fs.readFile(this.file, 'utf8').catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
            if (raw !== current) throw Error('Library data changed on disk. Reopen this view and retry.');
          });
        }
      } catch (error) { if (typeof rollback === 'function') await rollback(); throw error; }
      return state;
    };
    const result = this.queue.then(run);
    this.queue = result.catch(() => { });
    return result;
  }
  command(group, action, data = {}) {
    return this.transaction(async state => {
      if (group === 'progress' && action === 'save') {
        await saveReports(state,data,this.library);
      } else if (group === 'task') {
        if (action==='captures') {
          const owner=data.path.split('/').slice(0,2).join('/');
          const ids=new Set(data.ids);
          for (const id of ids) {
            const item=state.inbox.find(i=>i.id===id && !i.name);
            if (!item) throw Error('Capture is no longer available.');
            const [title,...lines]=item.text.split('\n');
            await taskAction(state,'save',{owner,location:owner===data.path?'':data.path,title,description:lines.join('\n')},this.library);
          }
          state.inbox=state.inbox.filter(i=>!ids.has(i.id));
          return;
        }
        const capture = action === 'save' && data.captureId;
        if (capture && !state.inbox.some(item => item.id === capture && item.text)) throw Error('Capture already resolved.');
        const before = structuredClone(state.tasks.find(t => t.id === data.id));
        const saved = await taskAction(state, action, data, this.library);
        const changed = action === 'save' ? saved : state.tasks.find(t => t.id === data.id);
        recordTaskChanges(state,before,changed);
        if (data.quick) state.quickText = '';
        if (capture) state.inbox = state.inbox.filter(item => item.id !== capture);
      } else if (group === 'workspace') {
        await this.library.resolve(data.path);
        if (action === 'visit') {
          state.lastFolder = data.path;
          const owner = data.path.split('/').slice(0,2).join('/');
          const views = state.explorers ||= {};
          (views[owner] ||= {expanded:[]}).folder = data.path;
        }
        else if (action === 'explorer') {
          (state.explorers ||= {})[data.path] = {folder:data.folder,expanded:data.expanded,sort:data.sort,direction:data.direction,width:data.width,order:data.order};
        } else if(action==='project-order' && ['Active','Future','Shelved'].includes(data.status) && Array.isArray(data.order)) {
          (state.projectOrder ||= {})[data.status]=[...new Set(data.order.filter(p=>typeof p==='string' && /^Projects\/[^/]+$/.test(p)))];
        } else if (action === 'status' && data.path.startsWith('Projects/') && ['Active','Future','Shelved'].includes(data.status)) {
          (state.projectStatus ||= {})[data.path] = data.status;
        } else throw Error('Unknown workspace action.');
      } else if (group === 'plan') {
        await planAction(state, action, data, this.library);
      } else if (group === 'layout') {
        updateLayout(state, action, data);
      } else if (group === 'capture') {
        if (action === 'draft') {
          if (state.quickFiles?.length && data.text.trim()) throw Error('File capture is active.');
          state.quickText = data.text;
        } else if (action === 'send') {
          if (state.quickFiles?.length) state.inbox.unshift(...state.quickFiles);
          else if (data.text?.trim()) state.inbox.unshift({id:randomUUID(),text:data.text,created:new Date().toISOString()});
          else throw Error('Enter text or choose files.');
          state.quickFiles = []; state.quickText = '';
        } else throw Error('Unknown capture action.');
      } else if (group === 'inbox') {
        if (action === 'edit') {
          const item = state.inbox.find(i => i.id === data.id && !i.name);
          if (!item || !data.text.trim()) throw Error('Capture text is required.');
          item.text = data.text; return;
        }
        if (action === 'sort') { state.inboxSort = data.sort; return; }
        if (action === 'add' && data.text?.trim()) state.inbox.unshift({ id: randomUUID(), text: data.text, created: new Date().toISOString() });
        else if (action === 'remove') state.inbox = state.inbox.filter(item => item.id !== data.id);
        else throw Error('Enter capture text.');
      } else throw Error('Unknown library operation.');
    });
  }
}
module.exports = { LibraryWork, rewriteRefs };
