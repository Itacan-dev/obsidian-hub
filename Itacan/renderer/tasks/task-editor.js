import { el, button } from '../ui/elements.js';
import { icon } from '../ui/icons.js';
import { showDialog } from '../ui/dialog.js';
import { reorderRows, reorderHandle } from '../ui/reorder.js';
import { field, pickPath, confirmAction } from '../ui/forms.js';
import './tasks.css';

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

export async function chooseTaskSource(ctx,task,title) {
  const workspaces = [...ctx.library.projects, ...ctx.library.resources];
  const currentOwner = workspaces.some(workspace => workspace.path === task.owner) ? task.owner : '';
  let source;
  const path = await pickPath(ctx, title, 'location', currentOwner, {
    commit(path, workspace) {
      const candidate = workspace?.startsWith('Projects/') ? workspace : currentOwner;
      const owner = ctx.workspaces.contextFor(path, candidate);
      source = { owner, location: path === owner ? '' : path };
    }
  });
  return path && source;
}

export async function taskEditor(ctx, original = {}, captureId) {
  const body = el('div','task-form');
  const task = structuredClone(original);
  if (!task.id && !task.owner) {
    const firstWorkspace = ctx.library.projects[0] || ctx.library.resources[0];
    task.owner = ctx.oaths.current()?.owner || ctx.workspaces.lastWorkspace()
      || ctx.workspaces.lastFolder()?.split('/').slice(0, 2).join('/') || firstWorkspace?.path;
  }
  const card = el('section','task-preview panel');
  const title = el('input', 'text-input');
  title.setAttribute('aria-label', 'Title');
  title.value = task.title || '';
  const done = el('input');
  done.type = 'checkbox';
  done.checked = !!task.done;
  done.setAttribute('aria-label','Task complete');
  const titleRow = el('div', 'task-title');
  titleRow.append(done, title);
  card.prepend(titleRow);
  title.autofocus = true;
  title.required = true; title.placeholder = 'What needs doing?';
  const location = button(task.location || task.owner || 'Choose workspace',async () => {
    const source=await chooseTaskSource(ctx,task,'Task location');
    if (!source) return;
    Object.assign(task,source);
    location.textContent = task.location || task.owner;
  },{variant:'quiet',symbol:'folder'});
  card.append(location);
  const checklist = el('details', 'task-checklist');
  checklist.open = !!task.steps?.length;
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
    check.onchange = updateCount;
    steps.append(row);
    updateCount();
    return input;
  }
  (task.steps || []).forEach(addStep); updateCount();
  checklist.append(summary,steps,button('Add step',() => addStep().focus())); card.append(checklist);
  const props = el('div','task-properties');
  for (const [key,label] of [['start','Start date'],['due','Due date'],['until','Until date'],['planned','Planned date']]) {
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
    await ctx.tasks.remove({id:task.id});
  }});
  actions.push({label:task.id ? 'Save' : 'Add task',primary:true,value:true,run:() => ctx.tasks.save({
    ...task,captureId,done:done.checked,title:title.value,steps:[...steps.children].map(row => {
      const [check,input] = row.querySelectorAll('input'); return {id:row.dataset.step,text:input.value,done:check.checked};
    })
  })});
  return showDialog({title:task.id ? 'Edit task' : 'Add task',wide:true,content:body,actions});
}
