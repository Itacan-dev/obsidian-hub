const { randomUUID } = require('node:crypto');
const { findTask } = require('./tasks.cjs');
const fs = require('node:fs/promises');

function today(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}
function finish(state) {
  if (!state.plan) return;
  const entries = state.plan.entries.map(entry => {
    const task = entry.kind === 'task' && state.tasks.find(t => t.id === entry.ref);
    return { ...entry, label: task ? task.title : entry.label, ...(task ? { done: task.done } : {}) };
  });
  state.history.unshift({ ...state.plan, entries, finished: new Date().toISOString() });
  state.plan = null;
}
function active(state) {
  return state.plan ||= { id: randomUUID(), day: today(), note: '', entries: [] };
}
async function planAction(state, action, data, library) {
  if (!data.planId && state.plan && state.plan.day !== today()) finish(state);
  if (data.planId && state.plan?.id !== data.planId) throw Error('This Plan has ended. Reopen Plan to see its history.');
  if (action === 'finish') return finish(state);
  const plan = active(state);
  if (action === 'start') return;
  if (action === 'note') { plan.note = String(data.note); return; }
  if (action === 'add') {
    const { kind, ref } = data;
    let label;
    if (kind === 'task') label = findTask(state, ref).title;
    else if (kind === 'note') { await library.notePath(ref); label = ref.split('/').at(-1); }
    else if (kind === 'workspace' && ref.split('/').length === 2) {
      if (!(await fs.stat(await library.resolve(ref))).isDirectory()) throw Error('Choose a workspace.');
      label = ref.split('/').at(-1);
    }
    else throw Error('Invalid Plan entry.');
    if (!plan.entries.some(e => !e.missing && e.kind === kind && e.ref === ref)) plan.entries.push({ id: randomUUID(), kind, ref, label });
    return;
  }
  const index = plan.entries.findIndex(e => e.id === data.id);
  if (index < 0) throw Error('Plan entry is unavailable.');
  if (action === 'remove') plan.entries.splice(index, 1);
  else if (action === 'up' || action === 'down') {
    const to = index + (action === 'up' ? -1 : 1);
    if (to >= 0 && to < plan.entries.length) plan.entries.splice(to, 0, plan.entries.splice(index, 1)[0]);
  } else throw Error('Unknown Plan action.');
}
module.exports = { today, finish, planAction };
