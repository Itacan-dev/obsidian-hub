const fs = require('node:fs/promises');
const {randomUUID} = require('node:crypto');

function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) throw Error('Choose a date.');
  const parsed=new Date(value+'T00:00:00Z');
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0,10)!==value) throw Error('Choose a valid date.');
  return value;
}

async function roadmapAction(state,action,data,library) {
  const {owner,id}=data;
  if(typeof owner!=='string' || !/^Projects\/[^/]+$/.test(owner) || !(await fs.stat(await library.resolve(owner))).isDirectory()) {
    throw Error('Choose an existing Project.');
  }
  const maps=state.roadmaps ||= {};
  const items=maps[owner] ||= [];
  const existing=id && items.find(entry=>entry.id===id);
  if (id && !existing) throw Error('This roadmap item is unavailable.');
  if (action==='delete' && existing) {
    items.splice(items.indexOf(existing),1);
    return;
  }
  if(action!=='save' || !['phase','milestone'].includes(data.kind)) throw Error('Unknown roadmap operation.');
  const title=String(data.title || '').trim();
  if(!title) throw Error('Enter a name.');
  const start=day(data.start);
  const item={id:existing?.id || randomUUID(),kind:data.kind,title,start};
  if(item.kind==='phase') {
    item.end=day(data.end);
    if (item.end<start) throw Error('The phase must end on or after its start.');
    item.taskIds=[...new Set(data.taskIds || [])];
    if(item.taskIds.some(id=>!state.tasks.some(t=>t.id===id && t.owner===owner))) throw Error('Choose tasks from this Project.');
  } else {
    item.achieved=!!data.achieved;
  }
  if (existing) items.splice(items.indexOf(existing),1,item);
  else items.push(item);
}
function moveRoadmaps(state,from,to) {
  if(!state.roadmaps?.[from]) return;
  if(to) state.roadmaps[to]=state.roadmaps[from];
  delete state.roadmaps[from];
}
module.exports = {roadmapAction,moveRoadmaps};
