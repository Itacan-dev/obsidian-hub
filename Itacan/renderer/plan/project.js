import {button,el} from '../ui/elements.js';
import {showDialog} from '../ui/dialog.js';
import {confirmAction,field} from '../ui/forms.js';
import {taskRow} from '../tasks/tasks.js';
import {openPlan} from './plan.js';

async function editItem(ctx,owner,kind,item={}) {
  const body=el('div','daily-plan');
  const title=field(body,'Name','text',item.title || ''); title.required=true;
  const start=field(body,kind==='phase'?'Start date':'Milestone date','date',item.start || '');start.required=true;
  let end,achieved;
  const linked=new Set(item.taskIds || []);
  if(kind==='phase'){
    end=field(body,'End date','date',item.end || ''); end.required=true;
    const tasks=el('details');tasks.append(el('summary','','Tasks in this phase'));
    for(const t of ctx.tasks.list().filter(t=>t.owner===owner)) {
      const row=el('label','field'),check=el('input');check.type='checkbox';check.checked=linked.has(t.id);
      check.onchange=()=>check.checked?linked.add(t.id):linked.delete(t.id);
      row.append(t.title,check);tasks.append(row);
    }
    body.append(tasks);
  } else {
    achieved=field(body,'Milestone achieved','checkbox');achieved.checked=!!item.achieved;
  }
  const actions=[{label:'Cancel',value:false}];
  if(item.id)actions.push({label:'Delete',value:true,run:async()=>{
    if(!await confirmAction('Delete '+kind+'?',item.title,'Delete'))return false;
    await ctx.roadmaps.remove({owner,id:item.id});
  }});
  actions.push({label:'Save',primary:true,value:true,run:()=>ctx.roadmaps.save({
    owner,id:item.id,kind,title:title.value,start:start.value,end:end?.value,achieved:achieved?.checked,taskIds:[...linked]
  })});
  return showDialog({title:(item.id?'Edit ':'New ')+kind,content:body,actions});
}

export function roadmapDialog(ctx,owner) {
  const body=el('div','daily-plan'),list=el('div','plan-collection'),actions=el('div','actions');
  for(const kind of ['phase','milestone']) actions.append(button('Add '+kind,async()=>{await editItem(ctx,owner,kind);draw();}));
  body.append(actions,list);
  function draw() {
    list.replaceChildren();
    const items=[...ctx.roadmaps.entries(owner)].sort((a,b)=>a.start.localeCompare(b.start));
    for(const item of items) {
      const row=el('section','panel'),label=item.kind==='phase'?'Phase':'Milestone';
      row.append(el('small','muted',label+' · '+item.start+(item.end?' – '+item.end:'')+(item.achieved?' · Achieved':'')),
        button(item.title,async()=>{await editItem(ctx,owner,item.kind,item);draw();},{variant:'quiet'}));
      for(const id of item.taskIds || []){
        const t=ctx.tasks.find(id);
        if(t)row.append(taskRow(ctx,t,draw));
      }
      list.append(row);
    }
    if(!items.length)list.append(el('p','empty','No phases or milestones yet.'));
  }
  draw();
  return showDialog({title:'Roadmap',description:owner,wide:true,content:body,actions:[{label:'Done',value:true}]});
}

export function workspacePlan(ctx,owner) {
  const body=el('div','daily-plan'),list=el('div','plan-collection');
  function draw(){
    list.replaceChildren();
    for(const entry of ctx.plans.current()?.entries || []) {
      const task=entry.kind==='task' && ctx.tasks.find(entry.ref);
      if(task ? !ctx.tasks.inWorkspace(owner,task) : ctx.workspaces.contextFor(entry.ref,owner)!==owner)continue;
      if(task)list.append(taskRow(ctx,task,draw));
      else list.append(button(entry.label,async()=>{
        const opened=entry.kind==='workspace'?await ctx.openFolder(entry.ref):await ctx.openNote(entry.ref);
        if(opened)body.closest('dialog')?.close();
      },{variant:'quiet'}));
    }
    if(!list.children.length)list.append(el('p','empty','No entries from this workspace in today’s plan.'));
  }
  body.append(list,button('Edit daily plan',async()=>{
    if(!ctx.plans.current())await ctx.plans.start({});
    await openPlan(ctx,ctx.plans.current());draw();
  }));
  draw();
  return showDialog({title:'Today’s plan',description:owner,content:body,actions:[{label:'Done',value:true}]});
}
