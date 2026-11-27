const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

function date(value) {
  if (!value) return '';
  const parsed = new Date(value + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value) throw Error('Choose a valid date.');
  return value;
}
function time(value, day) {
  if (!value) return '';
  if (!day || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw Error('A time needs a date.');
  return value;
}
async function saveTask(state, values, library) {
  const owner = values.owner;
  if (typeof owner !== 'string' || owner.split('/').length !== 2 || !(await fs.stat(await library.resolve(owner))).isDirectory()) throw Error('Choose a workspace.');
  const location = values.location || '';
  if (location) {
    if (!location.startsWith(owner + '/')) throw Error('Choose a location in the task workspace.');
    await library.resolve(location, 3);
  }
  const title = values.title.trim();
  if (!title) throw Error('Give the task a title.');
  const start = date(values.start), due = date(values.due);
  const startTime = time(values.startTime, start), dueTime = time(values.dueTime, due);
  if (start && due && start + (startTime || '00:00') > due + (dueTime || '23:59')) throw Error('Start must precede the due date.');
  const repeat = values.repeat || '';
  const interval = Number(values.interval || 1);
  if (!['', 'daily', 'weekly'].includes(repeat) || repeat && (!(start || due) || startTime || dueTime ||
    !Number.isInteger(interval) || interval < 1 || interval > 366)) throw Error('Repeating tasks need a date, a whole interval from 1 to 366, and no time.');
  if (!['', 'Should do', 'Must do'].includes(values.importance || '')) throw Error('Unknown importance.');
  const old = values.id ? findTask(state, values.id) : null;
  const task = {
    id: old?.id || randomUUID(), title, owner, location, description: String(values.description || ''),
    start, due, startTime, dueTime, importance: values.importance || '', repeat, interval,
    steps: (values.steps || []).map((step, index) => {
      const existing=old?.steps?.find(s=>s.id && s.id===step.id);
      const legacy=old?.steps?.[index];
      const id=existing?.id || (legacy?.text===step.text && legacy.id) || randomUUID();
      return {id, text:step.text.trim(), done:!!step.done};
    }).filter(step => step.text),
    done: old?.done || false, successor: old?.successor || null
  };
  if (old) Object.assign(old, task);
  else state.tasks.push(task);
  if (typeof values.done==='boolean' && task.done!==values.done) toggleTask(state,task.id);
  return old || task;
}
function findTask(state, id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) throw Error('Task is unavailable.');
  return task;
}
function toggleTask(state, id) {
  const task = findTask(state, id);
  task.done = !task.done;
  if (!task.done || !task.repeat || task.successor) return;
  const next = structuredClone(task);
  next.id = randomUUID();
  next.done = false;
  for (const step of next.steps) step.done = false;
  const offset = task.interval * (task.repeat === 'weekly' ? 7 : 1);
  for (const field of ['start', 'due']) {
    if (!next[field]) continue;
    const day = new Date(next[field] + 'T00:00:00Z');
    day.setUTCDate(day.getUTCDate() + offset);
    next[field] = day.toISOString().slice(0, 10);
  }
  task.successor = next.id;
  state.tasks.push(next);
}
async function taskAction(state, action, data, library) {
  if (action === 'save') return saveTask(state, data, library);
  if (action === 'step') {
    const step = findTask(state,data.id).steps[data.index];
    if (!step) throw Error('Task step is unavailable.');
    step.id ||= randomUUID();
    step.done = !!data.done;
    return;
  }
  if (action === 'toggle') return toggleTask(state, data.id);
  if (action !== 'delete') throw Error('Unknown task action.');
  const task = findTask(state, data.id);
  for (const entry of state.plan?.entries || []) {
    if (entry.kind === 'task' && entry.ref === task.id) {
      entry.missing = true;
      entry.label = task.title;
    }
  }
  state.tasks = state.tasks.filter(t => t.id !== task.id);
}
module.exports = { taskAction, findTask };
