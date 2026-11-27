const fs = require('node:fs/promises');
const { today } = require('./plan.cjs');

function recordActivity(state, action, path, details = {}) {
  const at = new Date();
  const events = state.activity ||= [];
  const owner = details.owner || path.split('/').slice(0,2).join('/');
  const event = {day:today(at), at:at.toISOString(), action, owner, path, title:path.split('/').at(-1), ...details};
  if (action === 'edited') {
    const previous = events.findIndex(e => e.action === action && e.path === path && e.day === event.day &&
      !e.removed && e.owner === owner && at - Date.parse(e.at) < 600000);
    if (previous !== -1) events.splice(previous,1);
  }
  events.unshift(event);
}

function recordTaskChanges(state, before, task) {
  if (!task) return;
  const details = {owner:task.owner, taskId:task.id, title:task.title};
  const path = task.location || task.owner;
  function transition(action,wasDone,done,step) {
    if (!!wasDone===!!done) return;
    if(done) recordActivity(state,action,path,{...details,...(step?{step:step.text,stepId:step.id}:{})});
    else {
      const previous=state.activity?.find(e=>e.action===action && e.taskId===task.id && !e.reopened && (!step || e.stepId===step.id));
      if(previous)previous.reopened=true;
    }
  }
  transition('task',before?.done,task.done);
  task.steps.forEach((step,index)=>{
    const prior=before?.steps?.find(s=>s.id && s.id===step.id) || (!before?.steps?.[index]?.id ? before?.steps?.[index] : null);
    transition('step',prior?.done,step.done,step);
  });
}

async function saveReports(state, {day,entries}, library) {
  const date = new Date(day+'T12:00:00');
  if (!/^\d{4}-\d\d-\d\d$/.test(day) || today(date)!==day || day>today()) throw Error('Choose today or an earlier date.');
  const reports = state.reports ||= [];
  const owners=new Set();
  for (const {owner,score,summary,expected} of entries) {
    if (owners.has(owner)) throw Error('Duplicate report workspace.');
    owners.add(owner);
    if (typeof owner !== 'string' || owner.split('/').length !== 2) throw Error('Choose a workspace.');
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 4)) throw Error('Choose a rating from 0 to 4.');
    if (typeof summary !== 'string' || summary.length > 1000) throw Error('Use up to 1000 characters for the reflection.');
    const previous = reports.find(r => r.owner===owner && r.day===day && !r.removed);
    if ((previous?.updated || null) !== expected) throw Error('This report changed. Reopen it to review the latest version.');
    if (!(await fs.stat(await library.resolve(owner))).isDirectory()) throw Error('The workspace is unavailable.');
    const note = summary.trim();
    if (score === null && !note) {
      if (previous) reports.splice(reports.indexOf(previous),1);
    } else {
      const stamp = new Date().toISOString();
      const evidence = (state.activity || []).filter(e=>e.owner===owner && e.day===day && !e.reopened && !e.removedWorkspace)
        .map(({at,action,path,title,step})=>({at,action,path,title,...(step?{step}:{})}));
      if (previous) Object.assign(previous,{score,summary:note,updated:stamp,evidence});
      else reports.push({day,owner,score,summary:note,created:stamp,updated:stamp,evidence});
    }
  }
}

function moveProgress(state, from, to) {
  const matches = p => p === from || p?.startsWith(from+'/');
  for (const record of [...state.activity || [], ...state.reports || []]) {
    if (record.removedWorkspace) continue;
    if (matches(record.owner)) {
      if (to) record.owner = to + record.owner.slice(from.length);
      else {record.removed = true;record.removedWorkspace = true;}
    }
    if (!record.removed && matches(record.path)) {
      if (to) record.path = to + record.path.slice(from.length);
      else record.removed = true;
    }
  }
}
// Statistics reads note metadata only when its window is opened.
async function statisticsNotes(library) {
  const home=await library.home();
  const notes=[];
  async function visit(folder,owner) {
    for (const entry of await library.entries(folder,2,true)) {
      if (entry.kind==='folder') await visit(entry.path,owner);
      else if (entry.kind==='note') notes.push({path:entry.path,owner,day:today(new Date(entry.ctime))});
    }
  }
  for (const space of [...home.projects,...home.resources]) await visit(space.path,space.path);
  return notes;
}
module.exports = {statisticsNotes,recordActivity,recordTaskChanges,saveReports,moveProgress};
