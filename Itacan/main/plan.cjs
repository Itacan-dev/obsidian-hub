const { randomUUID } = require('node:crypto');
const { findTask } = require('./tasks.cjs');
const fs = require('node:fs/promises');

function today(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}
function expired(plan) {
  return plan && (plan.endsAt ? Date.now() >= Date.parse(plan.endsAt) : plan.day !== today());
}
function finish(state, manual = false) {
  if (!state.plan) return;
  if (!manual && !state.plan.entries.length && !state.plan.note.trim()) {
    state.plan=null;
    return;
  }
  const ended = new Date(state.plan.day+'T00:00:00');
  ended.setDate(ended.getDate()+1);
  const dayEnd = state.plan.endsAt || ended.toISOString();
  const entries = state.plan.entries.map(entry => {
    const task = entry.kind === 'task' && state.tasks.find(t => t.id === entry.ref);
    return { ...entry, label: task ? task.title : entry.label, route:task?.location || task?.owner || entry.ref, ...(task && manual ? { done: task.done } : {}) };
  });
  state.finishedPreview = manual ? state.plan.id : null;
  state.history.unshift({ ...state.plan, entries, reason: manual ? 'Finished' : 'Day ended', finished: manual ? new Date().toISOString() : dayEnd });
  state.plan = null;
}
function active(state) {
  if (state.plan) return state.plan;
  const now=new Date(), end=new Date(now);
  end.setHours(24,0,0,0);
  return state.plan={id:randomUUID(),day:today(now),started:now.toISOString(),endsAt:end.toISOString(),
    timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,note:'',entries:[]};
}
async function planAction(state, action, data, library) {
  if (!data.planId && expired(state.plan)) finish(state);
  if (data.planId && state.plan?.id !== data.planId) throw Error('This Plan has ended. Reopen Plan to see its history.');
  if (data.planId && expired(state.plan) && !['note','abandon'].includes(action)) throw Error('This Plan has ended. Close the picker to view its history.');
  if (action === 'hide') { state.finishedPreview = null; return; }
  if (action === 'finish') return finish(state,true);
  const plan = active(state);
  if (action === 'start') return;
  if (action === 'abandon') {
    if (!plan.entries.length && !plan.note.trim()) state.plan = null;
    return;
  }
  if (action === 'note') { plan.note = String(data.note); return; }
  if (action === 'addMany') {
    for (const item of data.items) await planAction(state,'add',{...item,planId:plan.id},library);
    return;
  }
  if (action === 'add') {
    const { kind, ref } = data;
    let label;
    if (kind === 'task') label = findTask(state, ref).title;
    else if (kind === 'note') { await library.notePath(ref); label = ref.split('/').at(-1); }
    else if (kind === 'file') { await library.attachmentPath(ref); label = ref.split('/').at(-1); }
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
  if (action === 'relink') {
    const entry = plan.entries[index];
    if (!['note','file'].includes(entry.kind)) throw Error('Choose a file entry.');
    const kind = /\.md$/i.test(data.ref) ? 'note' : 'file';
    if (kind === 'note') await library.notePath(data.ref); else await library.attachmentPath(data.ref);
    if (plan.entries.some(e => e.id!==entry.id && !e.missing && e.ref===data.ref)) throw Error('Already in plan.');
    Object.assign(entry,{kind,ref:data.ref,label:data.ref.split('/').at(-1),missing:false}); return;
  }
  if (action === 'move') {
    if (!Number.isInteger(data.to)) throw Error('Choose a position.');
    const [entry] = plan.entries.splice(index,1);
    plan.entries.splice(Math.max(0,Math.min(plan.entries.length,data.to)),0,entry); return;
  }
  if (action === 'remove') plan.entries.splice(index, 1);
  else if (action === 'up' || action === 'down') {
    const to = index + (action === 'up' ? -1 : 1);
    if (to >= 0 && to < plan.entries.length) plan.entries.splice(to, 0, plan.entries.splice(index, 1)[0]);
  } else throw Error('Unknown Plan action.');
}
module.exports = { today, expired, finish, planAction };
