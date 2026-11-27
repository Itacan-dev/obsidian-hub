const fs = require('node:fs/promises');
const path = require('node:path');
const { atomicReplace } = require('./library.cjs');
const { taskAction } = require('./tasks.cjs');
const { saveReports, recordTaskChanges, moveProgress } = require('./progress.cjs');
const { today, expired, finish, planAction } = require('./plan.cjs');

const { setPlaylist, rewriteMusicRefs } = require('./music.cjs');
const { protectFormat } = require('./library-format.cjs');
const { validateStoredWork } = require('./work-format.cjs');
const { workspaceContext } = require('../contracts/workspace.cjs');
const { recoverMove, serialize } = require('./recovery.cjs');
const { oathAction, advanceOath, moveOath } = require('./oath.cjs');
const { roadmapAction, moveRoadmaps } = require('./project-planning.cjs');
const { setPreferences } = require('./settings.cjs');
const { workspaceAction, relinkDestination, rewriteWorkspaceRefs } = require('./workspaces.cjs');
const { updateLayout } = require('./presets.cjs');
const { captureAction, inboxAction, fileCapturesAsTasks } = require('./capture-state.cjs');

function empty() {
  return { version: 1, tasks: [], inbox: [], plan: null, history: [], presets: [], lastLayout: null };
}
function rewriteRefs(state, from, to) {
  function rewrite(value) {
    if (value !== from && !value?.startsWith(from + '/')) return value;
    return to ? to + value.slice(from.length) : '';
  }
  moveProgress(state,from,to);
  rewriteMusicRefs(state,from,to);
  moveOath(state,from,to);
  moveRoadmaps(state,from,to);
  rewriteWorkspaceRefs(state,from,to);
  for (const cover of Object.values(state.settings?.covers || {})) {
    if (cover.path) cover.path = rewrite(cover.path);
  }
  if (state.workspaceLayouts) state.workspaceLayouts = Object.fromEntries(
    Object.entries(state.workspaceLayouts).filter(([key])=>rewrite(key)).map(([key,value])=>[rewrite(key),value]));
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
    if (task.owner && !rewrite(task.owner)) task.missingOwner = task.owner;
    task.owner = rewrite(task.owner);
    if (task.location && rewrite(task.location) !== task.location) {
      if (!rewrite(task.location)) task.missingLocation = task.location;
      task.location = rewrite(task.location);
      if (task.location) task.owner = workspaceContext(state,task.location,task.owner);
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
  for (const layout of new Set([state.lastLayout, ...Object.values(state.workspaceLayouts || {}), ...state.presets.map(p => p.layout)].filter(Boolean))) {
    if (layout.workspace) layout.workspace = rewrite(layout.workspace);
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

// Coordinated task changes share one commit with dependent progress, Oath and capture records.
async function applyTaskChange(state, action, data, library) {
  const capture = action === 'save' && data.captureId;
  if (capture && !state.inbox.some(item => item.id === capture && item.text)) throw Error('Capture already resolved.');
  const before = structuredClone(state.tasks.find(task => task.id === data.id));
  const saved = await taskAction(state, action, data, library);
  const after = action === 'save' ? saved : state.tasks.find(task => task.id === data.id);
  recordTaskChanges(state, before, after);
  advanceOath(state);
  if (data.quick) state.quickText = '';
  if (capture) state.inbox = state.inbox.filter(item => item.id !== capture);
}

class LibraryWork {
  constructor(library) {
    this.library = library;
    this.file = path.join(library.root, 'itacan-work.json');
    this.queue = Promise.resolve();
    this.firstRead = true;
  }
  async load() {
    if (await fs.realpath(this.library.root) !== this.library.root) throw Error('The library moved. Choose its folder again.');
    try {
      if (!(await fs.lstat(this.file)).isFile()) throw Error('Invalid library work file.');
      const raw = await fs.readFile(this.file, 'utf8');
      const state = JSON.parse(raw);
      validateStoredWork(state);
      state.history ??= [];
      state.presets ??= [];
      return { raw, state };
    } catch (error) { if (error.code === 'ENOENT') return { raw: null, state: empty() }; throw error; }
  }
  transaction(change) {
    const run = async () => {
      await recoverMove(this.library);
      const { state, raw } = await this.load();
      const oathChanged = advanceOath(state,{recover:this.firstRead});
      const expiredPreview = state.finishedPreview && state.history.find(p=>p.id===state.finishedPreview)?.day !== today();
      const rollover = !change && expired(state.plan);
      if (expiredPreview) state.finishedPreview=null;
      if (!change && !rollover && !expiredPreview && !oathChanged) { this.firstRead = false; this.latest = state; return state; }
      if (state.revision === Number.MAX_SAFE_INTEGER) throw Error('Library revision exhausted. Preserve the work file for recovery.');
      if (rollover) finish(state);
      await protectFormat(this.library,raw,atomicReplace);
      let rollback;
      try {
        rollback = await change?.(state,raw);
        let next = serialize(state);
        if (next !== (raw ?? JSON.stringify(empty(), null, 2) + '\n')) {
          state.revision = (state.revision || 0) + 1;
          next = serialize(state);
          await atomicReplace(this.file, next, undefined, async () => {
            const current = await fs.readFile(this.file, 'utf8').catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
            if (raw !== current) throw Error('Library data changed on disk. Reopen this view and retry.');
          });
        }
      } catch (error) { if (typeof rollback === 'function') await rollback(); throw error; }
      this.firstRead = false;
      this.latest = state;
      return state;
    };
    const result = this.queue.then(run);
    this.queue = result.catch(() => { });
    return result;
  }
  command(group, action, data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid operation arguments.');
    return this.transaction(async state => {
      switch (group) {
        case 'workspace':
          if (action === 'relink-document') {
            const destination = await relinkDestination(this.library, data);
            rewriteRefs(state, data.from, destination);
          } else await workspaceAction(state, action, data, this.library);
          return;
        case 'layout': return updateLayout(state, action, data);
        case 'capture': return captureAction(state, action, data);
        case 'inbox': return inboxAction(state, action, data);
        case 'plan': return planAction(state, action, data, this.library);
        case 'oath': return oathAction(state, action, data, this.library);
        case 'roadmap': return roadmapAction(state, action, data, this.library);
        case 'music':
          if (action === 'setPlaylist') return setPlaylist(state,data,this.library);
          break;
        case 'settings':
          if (action === 'save') return setPreferences(state, data, this.library);
          break;
        case 'progress':
          if (action === 'save') return saveReports(state, data, this.library);
          break;
        case 'task':
          if (action === 'captures') return fileCapturesAsTasks(state, data, this.library);
          return applyTaskChange(state, action, data, this.library);
      }
      throw Error('Unknown library operation.');
    });
  }
}
module.exports = { LibraryWork, rewriteRefs };
