import { el, button, report } from '../ui/elements.js';
import { onContext } from '../ui/menu.js';
import { confirmAction } from '../ui/forms.js';
import { taskEditor, chooseTaskSource } from './task-editor.js';
import './tasks.css';

export { taskEditor } from './task-editor.js';

function taskMetadata(task) {
  const metadata = el('small', 'task-metadata muted');

  function append(className, text) {
    if (!text) return;
    if (metadata.childNodes.length) metadata.append(' · ');
    metadata.append(el('span', className, text));
  }

  append('task-workspace', task.owner?.split('/').at(-1));
  append('task-importance', task.importance);
  for (const [key, label] of [['start', 'From'], ['until', 'Until'], ['planned', 'Planned'], ['due', 'Due']]) {
    if (task[key]) {
      const date = [label, task[key], task[key + 'Time']].filter(Boolean).join(' ');
      append('task-date task-' + key, date);
    }
  }
  return metadata;
}

export function taskRow(ctx,task,afterChange = () => {}) {
  const row = el('div','task-row');
  row.dataset.id = task.id;
  const check = el('input'); check.type = 'checkbox'; check.checked = task.done;
  check.setAttribute('aria-label',(task.done ? 'Reopen ' : 'Complete ')+task.title);
  let toggling = false;
  check.onclick = event => { if (toggling) event.preventDefault(); };
  check.onchange = async () => {
    toggling = true;
    try { await ctx.tasks.setCompleted({id:task.id,done:check.checked}); afterChange(); }
    catch (e) { check.checked = task.done; report(e); } finally { toggling = false; }
  };
  row.append(check,button(task.title,async () => { await taskEditor(ctx,task); afterChange(); },{variant:'quiet'}));
  row.append(taskMetadata(task));
  async function relink() {
    const source=await chooseTaskSource(ctx,task,'Relink task source');
    if(!source)return;
    await ctx.tasks.attach({id:task.id,...source});
    afterChange();
  }
  if (task.location) row.append(button('Location',async() => {
    const path=task.location;
    const workspace=ctx.workspaces.contextFor(path,task.owner?.startsWith('Projects/') ? task.owner : ctx.workspaces.lastWorkspace());
    let source;
    try {
      if(ctx.workspaces.attachments(workspace).includes(path)) {
        await window.itacan.entries(ctx.library.session,path);
        source={kind:'folder'};
      } else {
        const parent=path.slice(0,path.lastIndexOf('/'));
        source=(await window.itacan.entries(ctx.library.session,parent)).find(item=>item.path===path);
      }
    } catch(error) {
      if(!/ENOENT|ENOTDIR/.test(error.message)) throw error;
    }
    if(!source)return relink();
    if(source.kind==='folder') return ctx.openFolder(path,{workspace});
    if(source.kind==='note' || source.openable) return ctx.openNote(path,undefined,'','replace',workspace);
    return relink();
  }));
  if (task.missingLocation || task.missingOwner) {
    row.append(el('small','muted','Missing source · '+(task.missingLocation || task.missingOwner)),button('Relink',relink));
  }
  onContext(row,()=>[
    {label:'Add to plan',run:()=>ctx.plans.add({kind:'task',ref:task.id})},
    {label:'Relink source',run:relink},
    {label:'Edit',run:async()=>{await taskEditor(ctx,task);afterChange();}},
    {label:'Delete',run:async()=>{if(await confirmAction('Delete task?',task.title,'Delete')) {await ctx.tasks.remove({id:task.id});afterChange();}}}
  ]);
  if (task.description) {
    const description=el('details'); description.append(el('summary','','Description'),el('p','multiline',task.description)); row.append(description);
  }
  if (task.steps?.length) {
    const steps = el('details','task-row-steps');
    steps.append(el('summary','','Steps · '+task.steps.filter(s=>s.done).length+'/'+task.steps.length));
    task.steps.forEach((step,index) => {
      const label = el('label');
      const box = el('input'); box.type='checkbox'; box.checked=step.done;
      box.onchange=async()=>{
        try { await ctx.tasks.setStepCompleted({id:task.id,index,stepId:step.id,done:box.checked}); afterChange(); }
        catch(error){ box.checked=step.done; report(error); }
      };
      label.append(box,step.text); steps.append(label);
    });
    row.append(steps);
  }
  return row;
}
// Retain the open details and keyboard control when a task is edited in either panel.
export function replaceTaskRow(ctx,task,previous,active = document.activeElement) {
  const row = taskRow(ctx,task);
  if (!previous) return {row};
  for (const open of previous.querySelectorAll('details[open]')) {
    const matching = [...row.querySelectorAll('details')].find(d => d.className === open.className);
    if (matching) matching.open = true;
  }
  const controls = 'input, button, summary';
  const index = [...previous.querySelectorAll(controls)].indexOf(active);
  previous.replaceWith(row);
  return {row, focus:row.querySelectorAll(controls)[index]};
}
export function taskPanel(ctx,owner,source) {
  const root = el('section','panel work-panel bounded-panel');
  const header = el('header','section-heading');
  header.append(el('h2','','Tasks'),button('Add task',() => {
    const path=typeof source==='function' ? source() : source;
    return taskEditor(ctx,path ? {owner:ctx.workspaces.contextFor(path,owner),location:path} : {owner});
  },{symbol:'plus'}));
  const list = el('div','task-list scroll-body'); root.append(header,list);
  const groups = new Map();
  for (const label of ['Oath','Open','Future','Window ended','Completed']) {
    const section = el(['Open','Oath'].includes(label) ? 'div' : 'details');
    if (label === 'Oath') section.append(el('strong','',label));
    else if (label !== 'Open') section.append(el('summary'));
    const rows = el('div');
    section.append(rows); list.append(section);
    groups.set(label,{section,rows});
  }
  const empty = el('p','empty','No tasks to do.');
  list.append(empty);
  function refresh(changedId) {
    const now = new Date();
    const clock = now.toLocaleDateString('sv-SE')+' '+now.toTimeString().slice(0,5);
    const oath = ctx.oaths.current();
    const pinned = new Set(oath && oath.status!=='scheduled' ? oath.taskIds : []);
    const inScope=(t,scope) => ctx.tasks.inWorkspace(scope,t);
    const due=t => (t.due || '9999')+' '+(t.dueTime || '23:59');
    const rank={'Must do':0,'Should do':1,'':2};
    const all = ctx.tasks.list().filter(t => (!owner || inScope(t,owner)) &&
        (oath?.status!=='active' || inScope(t,oath.owner)) &&
        (owner || pinned.has(t.id) || ctx.workspaces.status(t.owner)==='Active'))
      .sort((a,b) => due(a).localeCompare(due(b)) || (rank[a.importance] ?? 2)-(rank[b.importance] ?? 2));
    function group(t) {
      if (pinned.has(t.id)) return 'Oath';
      if (t.done) return 'Completed';
      if (t.start && t.start+' '+(t.startTime || '00:00') > clock) return 'Future';
      if (t.until && t.until+' '+(t.untilTime || '23:59') < clock) return 'Window ended';
      return 'Open';
    }
    const existing = new Map([...list.querySelectorAll('.task-row')].map(row => [row.dataset.id,row]));
    empty.hidden = !!all.length;
    const active = document.activeElement;
    let nextFocus;
    for (const [label,{section,rows}] of groups) {
      const tasks = all.filter(t => group(t) === label);
      if (label==='Oath') section.firstElementChild.textContent=oath?.condition==='tasks'?'Required for this Oath':'Pinned for this Oath';
      const summary = section.querySelector(':scope > summary');
      if (summary) summary.textContent = label+' ('+tasks.length+')';
      section.hidden = !tasks.length;
      for (const [index,task] of tasks.entries()) {
        const previous = existing.get(task.id);
        existing.delete(task.id);
        let row = previous;
        if (!row || !changedId || changedId === task.id) {
          const replacement = replaceTaskRow(ctx,task,previous,active);
          row = replacement.row;
          if (replacement.focus) nextFocus = summary && !section.open ? summary : replacement.focus;
        }
        if (rows.children[index] !== row) rows.insertBefore(row,rows.children[index] || null);
      }
    }
    for (const row of existing.values()) row.remove();
    nextFocus?.focus({preventScroll:true});
  }
  refresh(); return {root,refresh};
}
