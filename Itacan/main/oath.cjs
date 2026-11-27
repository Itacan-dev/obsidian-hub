const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

const {includesPath,workspaceIncludes,taskInWorkspace} = require('../contracts/workspace.cjs');
function oathAllows(state, path) {
  return state.oath?.status !== 'active' || workspaceIncludes(state,state.oath.owner,path);
}
function localDay(stamp, timeZone) {
  return new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone}).format(stamp);
}
function stamp(ms) { return new Date(ms).toISOString(); }
function tasksComplete(state, oath) {
  return oath.taskIds.every(id => state.tasks.some(t => t.id === id && t.done));
}
function closeRest(oath, now) {
  if (!oath.restUntil) return;
  const interval = oath.rests.at(-1);
  interval.end = stamp(Math.min(now, Date.parse(oath.restUntil)));
  delete oath.restUntil;
  oath.status = 'active';
}
function finishOath(state, outcome, at) {
  const oath = state.oath;
  closeRest(oath,at);
  const restMs = oath.rests.reduce((ms,r) => ms + Math.max(0,Date.parse(r.end)-Date.parse(r.start)),0);
  const activeMs = oath.startedAt && outcome !== 'interrupted' ? Math.max(0,at-Date.parse(oath.startedAt)-restMs) : 0;
  const record = {...oath,status:outcome,endedAt:stamp(at),activeMs:outcome==='interrupted' ? null : activeMs};
  (state.oathHistory ||= []).unshift(record);
  state.oath = null;
}

// Reconcile at the boundary of the same transaction that changes tasks or the session.
function advanceOath(state, {recover = false, now = Date.now()} = {}) {
  const oath = state.oath;
  if (!oath) return false;
  if (recover && oath.status !== 'scheduled') {
    finishOath(state,'interrupted',now);
    return true;
  }
  let changed = false;
  if (oath.status === 'scheduled') {
    if (now < Date.parse(oath.startsAt)) return false;
    if (oath.condition === 'tasks' && tasksComplete(state,oath)) {
      finishOath(state,'fulfilled',Date.parse(oath.startsAt));
      return true;
    }
    if (recover) {
      finishOath(state,'missed',now);
      return true;
    }
    oath.status = 'active';
    oath.startedAt = oath.startsAt;
    changed = true;
  }
  if (oath.restUntil && now >= Date.parse(oath.restUntil)) {
    closeRest(oath,now);
    changed = true;
  }
  if (oath.status === 'active' && oath.condition === 'tasks' && tasksComplete(state,oath)) {
    finishOath(state,'fulfilled',now);
    return true;
  }
  if (oath.endsAt && now >= Date.parse(oath.endsAt)) {
    finishOath(state,'fulfilled',Date.parse(oath.endsAt));
    return true;
  }
  return changed;
}

async function oathAction(state, action, data, library, now = Date.now()) {
  if (action === 'start') {
    if (data.mode != null && data.mode !== 'regular') throw Error('Only Regular Oaths are available in this build.');
    if (state.oath) throw Error('Finish the existing Oath first.');
    const {owner,condition} = data;
    if (typeof owner !== 'string' || owner.split('/').length !== 2 ||
        !(await fs.stat(await library.resolve(owner))).isDirectory()) throw Error('Choose a workspace.');
    if (!['duration','manual','tasks'].includes(condition)) throw Error('Choose a fulfilment condition.');
    const duration = Number(data.minutes);
    if (condition === 'duration' && (!Number.isSafeInteger(duration) || duration < 1 || duration > 10080)) {
      throw Error('Choose a duration between 1 minute and 7 days.');
    }
    const start = data.startsAt ? Date.parse(data.startsAt) : now;
    if (!Number.isFinite(start) || start < now) throw Error('Choose a future start time.');
    if (!Array.isArray(data.taskIds) || !data.taskIds.length) throw Error('Select at least one open task.');
    const taskIds = [...new Set(data.taskIds)];
    const selected = taskIds.map(id => {
      const task = state.tasks.find(t => t.id === id);
      if (!task || task.done || !taskInWorkspace(state,owner,task)) throw Error('Choose open tasks in the selected workspace.');
      return {id, title:task.title};
    });
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    state.oath = {id:randomUUID(),mode:'regular',owner,originalOwner:owner,condition,taskIds,selected,
      status:start > now ? 'scheduled' : 'active',startsAt:stamp(start),startedAt:start > now ? null : stamp(now),
      day:localDay(start,timeZone),timeZone,rests:[]};
    if (condition === 'duration') state.oath.endsAt = stamp(start + duration*60000);
    return;
  }
  const oath = state.oath;
  if (!oath || oath.id !== data.id) throw Error('This Oath has ended. Open The Oath to see its current state.');
  if (action === 'add') {
    const task=state.tasks.find(t=>t.id===data.taskId);
    if (!task || task.done || !taskInWorkspace(state,oath.owner,task)) throw Error('Choose an open task in this workspace.');
    if (!oath.taskIds.includes(task.id)) {
      oath.taskIds.push(task.id);
      oath.selected.push({id:task.id,title:task.title});
    }
    return;
  }
  if (action === 'break') { finishOath(state,'broken',now); return; }
  if (action === 'cancel' && oath.status === 'scheduled') {
    if (localDay(now,oath.timeZone) >= oath.day) throw Error('The scheduled day has begun. Use Break Oath.');
    finishOath(state,'cancelled',now);
    return;
  }
  if (action === 'end' && oath.condition === 'manual' && oath.status === 'active' && data.fulfilled === true) {
    finishOath(state,'fulfilled',now);
    return;
  }
  if (action === 'rest' && oath.condition !== 'duration' && oath.status === 'active') {
    if (!Number.isInteger(data.minutes) || data.minutes < 1 || data.minutes > 60) throw Error('Choose a rest of 1–60 minutes.');
    oath.status = 'rest';
    oath.restUntil = stamp(now + data.minutes*60000);
    oath.rests.push({start:stamp(now)});
    return;
  }
  if (action === 'resume' && oath.status === 'rest') { closeRest(oath,now); return; }
  throw Error('This action is unavailable for the current Oath.');
}
function moveOath(state, from, to) {
  const oath=state.oath;
  if(oath) {
    const moved=path=>includesPath(from,path) ? (to ? to+path.slice(from.length) : '') : path;
    const owner=moved(oath.owner);
    if (!owner) throw Error('End the Oath before deleting its workspace.');
    const allowed=[owner,...(state.sharedFolders?.[oath.owner] || []).map(moved).filter(Boolean)];
    for(const id of oath.taskIds) {
      const task=state.tasks.find(t=>t.id===id);
      if(!task || ![task.owner,task.location].some(path=>includesPath(from,path)))continue;
      const next=moved(task.location) || moved(task.owner);
      if(!allowed.some(root=>includesPath(root,next))) throw Error('Keep selected work inside the Oath workspace.');
    }
    oath.owner = owner;
  }
  for (const record of state.oathHistory || []) {
    if (record.owner === from) {
      record.originalOwner ||= from;
      record.owner = to || '';
    }
  }
}
module.exports = {oathAction,advanceOath,oathAllows,moveOath,workspaceIncludes};
