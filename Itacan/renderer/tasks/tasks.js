import { el, button, icon, report } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';
import { reorderRows,reorderHandle } from '../ui/reorder.js';
import { onContext } from '../ui/menu.js';
import { field, pickPath, confirmAction } from '../ui/forms.js';

function propertyControl(parent, label, symbol, render, display) {
  const group = el('div','task-property');
  const section = el('div','task-property-fields');
  section.id = 'property-' + crypto.randomUUID();
  section.hidden = true;
  const caption = el('span','',display() || label);
  const trigger = button('', () => {
    const open = section.hidden;
    if (!open) return close();
    parent.querySelector('button[aria-expanded=true]')?.click();
    section.hidden = false;
    trigger.setAttribute('aria-expanded','true');
    render(section, close);
    section.querySelector('input,textarea,select')?.focus();
  }, {variant:'quiet'});
  function close() {
    section.hidden = true;
    section.replaceChildren();
    trigger.setAttribute('aria-expanded','false');
    caption.textContent = display() || label;
    trigger.focus({preventScroll:true});
  }
  section.onkeydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  };
  trigger.append(icon(symbol),caption,icon('chevron'));
  trigger.setAttribute('aria-label',label);
  trigger.setAttribute('aria-controls',section.id);
  trigger.setAttribute('aria-expanded','false');
  group.append(trigger,section);
  parent.append(group);
  return group;
}

export async function taskEditor(ctx, original = {}, captureId) {
  const body = el('div','task-form');
  const task = structuredClone(original);
  task.owner ||= ctx.state.lastFolder?.split('/').slice(0,2).join('/') || [...ctx.library.projects,...ctx.library.resources][0]?.path;
  const card = el('section','task-preview panel');
  const title = el('input','text-input'); title.setAttribute('aria-label','Title'); title.value = task.title || '';
  const done = el('input'); done.type='checkbox'; done.checked=!!task.done;
  done.setAttribute('aria-label','Task complete');
  const titleRow = el('div','task-title'); card.prepend(titleRow); titleRow.append(done,title);
  title.autofocus = true;
  title.required = true; title.placeholder = 'What needs doing?';
  const location = button(task.location || task.owner,async () => {
    const path = await pickPath(ctx,'Task location','location',task.owner);
    if (!path) return;
    task.owner = path.split('/').slice(0,2).join('/');
    task.location = task.owner === path ? '' : path;
    location.textContent = path;
  },{variant:'quiet',symbol:'folder'});
  card.append(location);
  const checklist = el('details','task-checklist'); checklist.open = !!task.steps?.length;
  const summary = el('summary','','Steps');
  const steps = el('div','task-steps');
  reorderRows(steps,'.task-step',(row,index,items)=>{
    if(index>items.indexOf(row))items[index].after(row);else items[index].before(row);
    row.querySelector('[draggable]').focus({preventScroll:true});
  });
  function updateCount() {
    const boxes = [...steps.querySelectorAll('input[type=checkbox]')];
    summary.textContent = boxes.length ? 'Steps · '+boxes.filter(b => b.checked).length+'/'+boxes.length : 'Add steps';
  }
  function addStep(step = {}) {
    const row = el('div','actions task-step');
    const grip=reorderHandle('Reorder step');
    if (step.id) row.dataset.step=step.id;
    const check = el('input'); check.type = 'checkbox'; check.checked = !!step.done; check.setAttribute('aria-label','Step complete');
    const input = el('input','text-input'); input.value = step.text || ''; input.setAttribute('aria-label','Step text');
    row.append(grip,check,input,button('Remove',() => { row.remove(); updateCount(); }));
    check.onchange = updateCount; steps.append(row); updateCount(); return input;
  }
  (task.steps || []).forEach(addStep); updateCount();
  checklist.append(summary,steps,button('Add step',() => addStep().focus())); card.append(checklist);
  const props = el('div','task-properties');
  for (const key of ['start','due']) {
    const label = key === 'start' ? 'Start date' : 'Due date';
    propertyControl(props,label,'calendar',(pop,close) => {
      const fields=el('div','task-dates'); pop.append(fields);
      const date = field(fields,label,'date',task[key]);
      const time = field(fields,label.replace('date','time'),'time',task[key+'Time']);
      time.disabled = !date.value;
      date.onchange = () => { time.disabled = !date.value; if (!date.value) time.value = ''; };
      pop.append(button('Cancel',close),button('Apply',() => { task[key] = date.value; task[key+'Time'] = time.value; syncRepeat(); close(); }));
    },() => task[key] && [task[key],task[key+'Time']].filter(Boolean).join(' '));
  }
  for (const [key,label] of [['importance','Set importance'],['description','Description']]) {
    propertyControl(props,label,key==='importance'?'flag':'lines',(pop,close) => {
      const input = field(pop,label,key === 'importance' ? 'select' : 'textarea',task[key] || '',
        key === 'importance' ? ['','Should do','Must do'] : undefined);
      pop.append(button('Cancel',close),button('Apply',() => { task[key] = input.value; close(); }));
    },() => task[key]);
  }
  const repeatGroup = propertyControl(props,'Repeat task','repeat',(pop,close) => {
    const repeat = field(pop,'Repeat frequency','select',task.repeat || '',['','daily','weekly']);
    const interval = field(pop,'Repeat interval','number',task.interval || 1);
    interval.min = 1; interval.max = 366; interval.step = 1;
    pop.append(button('Cancel',close),button('Apply',() => {
      if (repeat.value && (!interval.reportValidity() || !interval.value)) return;
      if (repeat.value && (!(task.start || task.due) || task.startTime || task.dueTime)) throw Error('Repeating tasks need a date without a time.');
      task.repeat = repeat.value; task.interval = Number(interval.value) || 1; close();
    }));
  },() => task.repeat && 'Repeats '+task.repeat);
  function syncRepeat() { repeatGroup.hidden = !(task.start || task.due || task.repeat); }
  syncRepeat();
  body.append(card,props);
  const actions = [{label:'Cancel',value:false}];
  if (task.id) actions.unshift({label:'Delete task',value:true,run:async () => {
    if (!await confirmAction('Delete task?',task.title,'Delete')) return false;
    await ctx.update('task','delete',{id:task.id});
  }});
  actions.push({label:task.id ? 'Save' : 'Add task',primary:true,value:true,run:() => ctx.update('task','save',{
    ...task,captureId,done:done.checked,title:title.value,steps:[...steps.children].map(row => {
      const [check,input] = row.querySelectorAll('input'); return {id:row.dataset.step,text:input.value,done:check.checked};
    })
  })});
  return showDialog({title:task.id ? 'Edit task' : 'Add task',wide:true,content:body,actions});
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
    try { await ctx.update('task','toggle',{id:task.id}); afterChange(); }
    catch (e) { check.checked = task.done; report(e); } finally { toggling = false; }
  };
  row.append(check,button(task.title,async () => { await taskEditor(ctx,task); afterChange(); },{variant:'quiet'}));
  row.append(el('small','muted',[task.owner?.split('/').at(-1),task.importance,task.due].filter(Boolean).join(' · ')));
  if (task.location) row.append(button('Location',() => /\.md$/i.test(task.location) ? ctx.openNote(task.location) : ctx.openFolder(task.location)));
  onContext(row,()=>[
    {label:'Add to plan',run:()=>ctx.update('plan','add',{kind:'task',ref:task.id})},
    {label:'Edit',run:async()=>{await taskEditor(ctx,task);afterChange();}},
    {label:'Delete',run:async()=>{if(await confirmAction('Delete task?',task.title,'Delete')) {await ctx.update('task','delete',{id:task.id});afterChange();}}}
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
        try { await ctx.update('task','step',{id:task.id,index,done:box.checked}); afterChange(); }
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
export function taskPanel(ctx,owner) {
  const root = el('section','panel work-panel bounded-panel');
  const header = el('header','section-heading');
  header.append(el('h2','','Tasks'),button('Add task',() => taskEditor(ctx,{owner}),{symbol:'plus'}));
  const list = el('div','task-list scroll-body'); root.append(header,list);
  const groups = new Map();
  for (const label of ['Open','Future','Completed']) {
    const section = el(label === 'Open' ? 'div' : 'details');
    if (label !== 'Open') section.append(el('summary'));
    const rows = el('div');
    section.append(rows); list.append(section);
    groups.set(label,{section,rows});
  }
  const empty = el('p','empty','No tasks to do.');
  list.append(empty);
  function refresh(changedId) {
    const today = new Date().toLocaleDateString('sv-SE');
    const all = ctx.state.tasks.filter(t => owner ? t.owner === owner : (!ctx.state.projectStatus?.[t.owner] || ctx.state.projectStatus[t.owner]==='Active'))
      .sort((a,b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const existing = new Map([...list.querySelectorAll('.task-row')].map(row => [row.dataset.id,row]));
    empty.hidden = !!all.length;
    const active = document.activeElement;
    let nextFocus;
    for (const [label,{section,rows}] of groups) {
      const tasks = all.filter(t => (t.done ? 'Completed' : t.start > today ? 'Future' : 'Open') === label);
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
