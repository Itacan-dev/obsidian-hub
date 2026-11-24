const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { atomicReplace, validName } = require('./library.cjs');
const { taskAction } = require('./tasks.cjs');
const { today, finish, planAction } = require('./plan.cjs');

function empty() {
  return { version: 1, tasks: [], inbox: [], plan: null, history: [], presets: [], lastLayout: null };
}
function rewriteRefs(state, from, to) {
  function rewrite(value) {
    if (value !== from && !value?.startsWith(from + '/')) return value;
    return to ? to + value.slice(from.length) : '';
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
  for (const layout of [state.lastLayout, ...state.presets.map(p => p.layout)].filter(Boolean)) {
    for (const pane of layout.panes) {
      pane.tabs = pane.tabs.map(rewrite).filter(Boolean);
      pane.file = rewrite(pane.file) || pane.tabs[0] || '';
    }
    layout.panes = layout.panes.filter(p => p.file);
    if (!layout.panes.length) layout.panes.push({ file: '', tabs: [], edit: false });
    layout.active = Math.min(layout.active, layout.panes.length - 1);
  }
}

function updateLayout(state, action, {name, layout}) {
  if (action === 'remove') {
    state.presets = state.presets.filter(preset => preset.name !== name);
    return;
  }
  const panes = layout?.panes;
  if (!Array.isArray(panes) || panes.length < 1 || panes.length > 2 ||
      !Number.isInteger(layout.active) || !panes[layout.active] ||
      panes.some(pane => !Array.isArray(pane.tabs) || pane.tabs.some(file => typeof file !== 'string') ||
        (pane.file ? !pane.tabs.includes(pane.file) : pane.tabs.length))) throw Error('Invalid document layout.');
  if (action === 'remember') state.lastLayout = layout;
  else if (action === 'preset') {
    validName(name);
    state.presets = state.presets.filter(preset => preset.name !== name);
    state.presets.push({name, layout});
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
      const rollover = !change && state.plan && state.plan.day !== today();
      if (!change && !rollover) return state;
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
      if (group === 'task') {
        const capture = action === 'save' && data.captureId;
        if (capture && !state.inbox.some(item => item.id === capture && item.text)) throw Error('Capture already resolved.');
        await taskAction(state, action, data, this.library);
        if (capture) state.inbox = state.inbox.filter(item => item.id !== capture);
      } else if (group === 'plan') {
        await planAction(state, action, data, this.library);
      } else if (group === 'layout') {
        updateLayout(state, action, data);
      } else if (group === 'inbox') {
        if (action === 'add' && data.text?.trim()) state.inbox.unshift({ id: randomUUID(), text: data.text, created: new Date().toISOString() });
        else if (action === 'remove') state.inbox = state.inbox.filter(item => item.id !== data.id);
        else throw Error('Enter capture text.');
      } else throw Error('Unknown library operation.');
    });
  }
}
module.exports = { LibraryWork, rewriteRefs };
