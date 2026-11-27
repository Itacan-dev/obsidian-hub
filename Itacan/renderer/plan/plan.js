import { el,button,report } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';
import { confirmAction } from '../ui/forms.js';
import { taskRow,taskEditor,replaceTaskRow } from '../tasks/tasks.js';
import { reorderRows,reorderHandle } from '../ui/reorder.js';
import { planPicker } from './picker.js';

async function openEntry(ctx,entry){
  if(entry.kind==='task'){
    const task=ctx.state.tasks.find(t=>t.id===entry.ref);
    if(!task) throw Error('Task unavailable.');
    await taskEditor(ctx,task); return false;
  }
  if(entry.kind==='note') return ctx.openNote(entry.ref);
  if(entry.kind==='workspace') return ctx.openFolder(entry.ref);
  await window.itacan.openAttachment(ctx.library.session,entry.ref); return false;
}

function entryList(ctx,plan,{edit=false,historical=false,refresh=()=>{},before=async()=>{},leave=()=>{}}={}) {
  const list=el('ol','plan-list');

  const contents = new Map();
  const change=async(action,data)=>{await before();await ctx.update('plan',action,{planId:plan.id,...data});refresh();};
  if(edit) reorderRows(list,'.plan-entry',(row,to)=>change('move',{id:row.dataset.entry,to}));
  for(const entry of plan.entries){
    const row=el('li','plan-entry');
    row.dataset.entry = entry.id;
    const task=entry.kind==='task' && ctx.state.tasks.find(t=>t.id===entry.ref);
    if(task && !historical) row.append(taskRow(ctx,task,refresh));
    else {
      const open=button(entry.label,async()=>{
        await before();
        if(await openEntry(ctx,entry)) leave();
      },{variant:'quiet'});
      open.disabled=!!entry.missing || entry.kind==='task' && !task;
      const status = entry.kind === 'task' ? entry.done == null ? 'State at day end unknown' : entry.done ? 'Completed' : 'Open' : '';
      const route = entry.kind === 'workspace' ? entry.ref.startsWith('Projects/')?'Project':'Resource' : entry.ref.split('/').slice(0,-1).join(' / ');
      const detail = historical ? [status,entry.route || route].filter(Boolean).join(' · ') : route;
      row.append(open,el('small','muted',entry.missing?'Source unavailable':detail));
    }
    if(edit){
      if(['note','file'].includes(entry.kind)){
        const relink=button('Relink',async()=>{await before();await planPicker(ctx,plan,entry);refresh();});
        row.append(relink); relink.hidden=!entry.missing;
        if (!entry.missing) {
          const parent=entry.ref.split('/').slice(0,-1).join('/');
          if (!contents.has(parent)) contents.set(parent,window.itacan.entries(ctx.library.session,parent).catch(()=>[]));
          contents.get(parent).then(items=>{
            const available=items.some(item=>item.path===entry.ref);
            relink.hidden=available;
            row.querySelector('button').disabled=!available;
          });
        }
      }
      const controls=el('div','actions entry-controls');
      const grip=reorderHandle('Reorder '+entry.label,'');
      controls.append(grip,button('Remove',()=>change('remove',{id:entry.id})));row.append(controls);
    }
    list.append(row);
  }
  return list;
}
async function editor(ctx) {
  const body=el('div','daily-plan');
  const {id,day,endsAt}=ctx.state.plan;
  const end=new Date(endsAt || day+'T00:00:00');
  if (!endsAt) end.setDate(end.getDate()+1);
  let pending;
  const current=()=>ctx.state.plan?.id===id;
  const notes=el('textarea','text-input'); notes.setAttribute('aria-label','Plan notes');
  notes.rows=2; notes.value=ctx.state.plan.note; body.append(notes);
  notes.placeholder='Add a note for today…';
  const collection=el('div','plan-collection');
  async function flush(){if(current() && notes.value!==ctx.state.plan.note)await ctx.update('plan','note',{planId:id,note:notes.value});}
  notes.oninput=()=>{clearTimeout(pending);pending=setTimeout(()=>flush().catch(report),350);};
  function refresh(){
    if (!current()) return;
    const focused = document.activeElement.closest('[data-entry]')?.dataset.entry;
    const label = document.activeElement.getAttribute('aria-label');
    collection.replaceChildren(entryList(ctx,ctx.state.plan,{edit:true,before:flush,refresh,leave:()=>body.closest('dialog')?.close()}));
    if (!ctx.state.plan.entries.length) collection.append(el('p','empty','Add at least one item to save this plan.'));
    if (focused && label) [...collection.querySelectorAll('[aria-label]')].find(b=>b.closest('[data-entry]')?.dataset.entry===focused && b.getAttribute('aria-label')===label)?.focus({preventScroll:true});
  }
  body.append(collection,button('Add to plan',async()=>{await flush();await planPicker(ctx,ctx.state.plan);refresh();}));
  refresh();
  const answer=showDialog({title:'Plan',description:'Choose work to include in your plan.',wide:true,content:body,beforeClose:async()=>{
    clearTimeout(pending); await flush();
    if (current() && !ctx.state.plan.entries.length) await ctx.update('plan','abandon',{planId:id});
  },actions:[{label:'Done',value:true}]});
  const dialog=body.closest('dialog');
  // Let a nested task form or picker finish before turning this editor into history.
  async function checkDay(){
    if (Date.now()<end || !dialog.open || dialog!==[...document.querySelectorAll('dialog[open]')].at(-1)) return;
    clearTimeout(pending);
    await flush(); await ctx.reloadWork();
    const history=ctx.state.history.find(p=>p.id===id);
    if (!dialog.open) return;
    if (!history) { dialog.close(); return; }
    dialog.querySelector('.dialog-description').textContent='Historical plan · '+history.day;
    body.classList.add('historical-plan');
    body.replaceChildren(el('p','multiline',history.note || 'No note'),entryList(ctx,history,{historical:true,leave:()=>dialog.close()}));
    stop();
  }
  const check=()=>checkDay().catch(report);
  const timer=setTimeout(check,end-Date.now()+100);
  function stop(){
    clearTimeout(timer);clearTimeout(pending);
    window.removeEventListener('focus',check);document.removeEventListener('close',check,true);
  }
  window.addEventListener('focus',check);document.addEventListener('close',check,true);
  try { return await answer; } finally { stop(); }
}
export async function openPlan(ctx,plan) {
  if (ctx.state.plan?.id === plan.id) return editor(ctx);
  const body=el('div','daily-plan historical-plan');
  body.append(el('p','multiline',plan.note || 'No note'),entryList(ctx,plan,{historical:true,leave:()=>body.closest('dialog')?.close()}));
  return showDialog({title:'Plan',description:'Historical plan · '+plan.day,wide:true,content:body,actions:[{label:'Done',value:true}]});
}

export function reportPlan(ctx,day) {
  const host=el('details');
  host.append(el('summary','','Current plan - optional'));
  function render(){
    const records=[ctx.state.plan,...ctx.state.history].filter(p=>p?.day===day);
    host.replaceChildren(host.firstElementChild);
    if (!records.length) host.append(el('p','muted','No plan for this date.'));
    else {
      const current=records[0];
      host.append(el('p','multiline',current.note),entryList(ctx,current,{historical:current!==ctx.state.plan,refresh:render}));
      for (const [i,p] of records.entries()) host.append(button(i?'Earlier plan · '+new Date(p.finished).toLocaleTimeString():p===ctx.state.plan?'Edit plan':'View plan',async()=>{await openPlan(ctx,p);render();}));
    }
  }
  host.ontoggle=()=>{if(host.open)render();};
  return host;
}

export function planPanel(ctx) {
  const root=el('section','panel work-panel bounded-panel plan-panel');
  const header=el('header','section-heading');
  const body=el('div','scroll-body');
  const configure=button('Plan',async()=>{
    await ctx.reloadWork();
    if(!ctx.state.plan)await ctx.update('plan','start',{});
    await editor(ctx);
  });
  header.append(el('h2','','Plan'),configure);
  const excerpt=el('p','plan-excerpt multiline'), footer=el('footer','actions plan-footer');
  root.append(header,excerpt,body,footer);
  let historyOpen=false;
  function refresh(changedTask){
    const active=ctx.state.plan, past=ctx.state.history;
    if (changedTask) {
      const previous = [...body.querySelectorAll('.task-row')].find(row => row.dataset.id === changedTask);
      const task = ctx.state.tasks.find(t => t.id === changedTask);
      if (previous && task) {
        replaceTaskRow(ctx,task,previous).focus?.focus({preventScroll:true});
        return;
      }
    }
    const preview=past.find(p=>p.id===ctx.state.finishedPreview);
    const expanded = body.querySelector('details[open]')?.dataset.id;
    const top=body.scrollTop;
    body.replaceChildren(); footer.replaceChildren();
    configure.textContent=active?'Edit':'Plan';
    configure.setAttribute('aria-label',active?'Edit plan':'New plan');
    const plan=active || preview;
    excerpt.hidden=!plan; excerpt.textContent=plan?'Today · '+(plan.note || ''):'';
    if(plan){
      historyOpen=false;
      body.append(entryList(ctx,plan,{historical:!active}));
      if(active)footer.append(button('Finish plan',async()=>{
        if(await confirmAction('Finish this plan?','Unfinished tasks will stay open.','Finish plan'))await ctx.update('plan','finish',{planId:active.id});
      }));
      else footer.append(el('small','muted','Finished '+new Date(plan.finished).toLocaleTimeString()),button('Hide',()=>ctx.update('plan','hide',{})));
    }else {
      if (!historyOpen) body.append(el('p','empty','No active plan for today.'));
      if(past.length)footer.append(button(historyOpen?'Hide earlier plans':'Show earlier plans',()=>{historyOpen=!historyOpen;refresh();}));
      if(historyOpen)for(const p of past){
        const details=el('details','plan-history');
        details.name='earlier-plans'; details.dataset.id=p.id; details.open=p.id===expanded;
        const time=stamp=>new Date(stamp).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',timeZone:p.timeZone});
        const label=el('summary','',[p.day,p.started && time(p.started)+'–'+time(p.finished),p.reason].filter(Boolean).join(' · '));
        label.title=[p.reason,p.timeZone].filter(Boolean).join(' · ');
        label.append(el('span','plan-history-note',p.note || 'No note'),el('small','muted',p.entries.length+' planned items'));
        const entries=el('div');
        details.append(label,entries);
        details.ontoggle=()=>entries.replaceChildren(...(details.open?[entryList(ctx,p,{historical:true})]:[]));
        body.append(details);
      }
    }
    body.scrollTop=top;
  }
  refresh();return {root,refresh};
}
