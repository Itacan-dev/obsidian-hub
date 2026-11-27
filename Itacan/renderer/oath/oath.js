import {button,el,report} from '../ui/elements.js';
import {showDialog} from '../ui/dialog.js';
import {field} from '../ui/forms.js';
import {taskEditor} from '../tasks/tasks.js';
import './oath.css';

const conditions={duration:'Fixed duration',manual:'Until ended',tasks:'Until selected tasks are complete'};
function taskCandidates(ctx,owner) {
  return ctx.tasks.list().filter(t=>!t.done && ctx.tasks.inWorkspace(owner,t));
}
async function setup(ctx) {
  const body=el('div','oath-form');
  const workspaces=[...ctx.library.projects,...ctx.library.resources];
  if (!workspaces.length) throw Error('Create a workspace before taking an Oath.');
  const defaultOwner=ctx.workspaces.lastWorkspace() || ctx.workspaces.lastFolder()?.split('/').slice(0,2).join('/');
  const owner=field(body,'Workspace','select',workspaces.some(w=>w.path===defaultOwner)?defaultOwner:workspaces[0].path,workspaces.map(w=>w.path));
  const when=field(body,'Start','select','Now',['Now','Schedule']);
  const start=field(body,'Scheduled start','datetime-local');
  function schedule() { start.parentElement.hidden=when.value==='Now'; start.required=!start.parentElement.hidden; }
  when.onchange=schedule; schedule();
  const condition=field(body,'Fulfilment','select',conditions.duration,Object.values(conditions));
  const minutes=field(body,'Duration in minutes','number',50);
  minutes.min=1; minutes.max=10080;
  function duration() { minutes.parentElement.hidden=condition.value!==conditions.duration; minutes.required=!minutes.parentElement.hidden; }
  condition.onchange=duration; duration();
  const list=el('fieldset','oath-tasks');
  const selected=new Set();
  function draw() {
    list.replaceChildren(el('legend','','Selected work'));
    for (const t of taskCandidates(ctx,owner.value)) {
      const row=el('label'), box=el('input');
      box.type='checkbox'; box.checked=selected.has(t.id);
      box.onchange=()=>box.checked?selected.add(t.id):selected.delete(t.id);
      row.append(box,t.title); list.append(row);
    }
    if(list.children.length===1) list.append(el('p','empty','Create a task for this session.'));
  }
  owner.onchange=()=>{selected.clear();draw();};
  draw();
  body.append(list,button('New task',async()=>{
    const before=new Set(ctx.tasks.list().map(t=>t.id));
    await taskEditor(ctx,{owner:owner.value});
    for (const t of taskCandidates(ctx,owner.value)) if (!before.has(t.id)) selected.add(t.id);
    draw();
  }));
  body.append(el('p','oath-pledge','I solemnly swear that I will do the work, the whole work, and nothing but the work.'));
  return showDialog({title:'Take a Regular Oath',description:'Commit to one workspace and its attached folders. Itacan keeps you in that workspace until fulfilment or Break Oath. Other applications and their notifications remain available.',content:body,actions:[
    {label:'Cancel',value:false},{label:'Take Oath',value:true,primary:true,run:()=>ctx.oaths.start({
      owner:owner.value,condition:Object.keys(conditions).find(key=>conditions[key]===condition.value),
      taskIds:[...selected],minutes:minutes.valueAsNumber,startsAt:when.value==='Schedule'?new Date(start.value).toISOString():null
    })}
  ]});
}

export async function confirmBreak(ctx) {
  const oath=ctx.oaths.current();
  if (!oath) return true;
  return showDialog({title:'Break this Oath?',description:'Breaking ends this commitment and records the outcome in Oath history.',actions:[
    {label:'Keep Oath',value:false,primary:true},
    {label:'Break Oath',value:true,run:()=>ctx.oaths.break({id:oath.id})}
  ]});
}

async function activeDialog(ctx,oath) {
  const body=el('div','oath-form');
  const heading=el('strong','',conditions[oath.condition]);
  const status=el('p','muted');
  const list=el('div','oath-tasks');
  const actions=el('div','actions');
  body.append(heading,status,list,actions);
  function changed(operation,data={}) { return operation({id:oath.id,...data}); }
  let rendered='';
  function render() {
    const current=ctx.oaths.current();
    if (current?.id!==oath.id) {
      const finished=ctx.oaths.history().find(r=>r.id===oath.id);
      heading.textContent=finished?'Oath '+finished.status:'This Oath has ended';
      status.textContent=oath.owner;
      list.replaceChildren(); actions.replaceChildren();
      return;
    }
    const deadline=current.restUntil || (current.status==='scheduled' ? current.startsAt : current.endsAt);
    status.textContent=[current.owner,current.status,deadline && new Date(deadline).toLocaleString()].filter(Boolean).join(' · ');
    const tasks=current.taskIds.map(id=>ctx.tasks.find(id));
    const key=JSON.stringify([current.status,tasks.map(t=>[t?.title,t?.done]),ctx.tasks.list().map(t=>t.id)]);
    if(key===rendered)return;
    rendered=key;
    list.replaceChildren();
    for(const t of tasks) {
      const row=el('label'),check=el('input');
      check.type='checkbox';check.checked=!!t?.done;check.disabled=!t || current.status==='scheduled';
      check.onchange=async()=>{
        check.disabled=true;
        try {await ctx.tasks.setCompleted({id:t.id,done:check.checked});render();}
        catch(error){check.checked=t.done;check.disabled=false;report(error);}
      };
      row.append(check,t?.title || 'Task unavailable');list.append(row);
    }
    actions.replaceChildren();
    const candidates=taskCandidates(ctx,current.owner).filter(t=>!current.taskIds.includes(t.id));
    if(candidates.length) {
      const select=el('select','text-input'); select.setAttribute('aria-label','Additional task');
      for(const t of candidates) select.add(new Option(t.title,t.id));
      actions.append(select,button('Add task to Oath',async()=>{await changed(ctx.oaths.addTask,{taskId:select.value});render();}));
    }
    if(current.status==='active' && current.condition==='manual') actions.append(button('End Oath',async()=>{
      const answer=await showDialog({title:'Did you complete the work you swore to do?',actions:[
        {label:'Keep working',value:null},{label:'No',value:false},{label:'Yes',value:true,primary:true}
      ]});
      if(answer===true)await changed(ctx.oaths.end,{fulfilled:true});
      if(answer===false)await confirmBreak(ctx);
      render();
    }));
    if(current.status==='active' && current.condition!=='duration') {
      const minutes=field(actions,'Rest minutes','number',5);minutes.min=1;minutes.max=60;
      actions.append(button('Start rest',async()=>{await changed(ctx.oaths.rest,{minutes:minutes.valueAsNumber});render();}));
    }
    if(current.status==='rest') actions.append(button('Resume now',async()=>{await changed(ctx.oaths.resume);render();}));
    const day=new Intl.DateTimeFormat('sv-SE',{timeZone:current.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if(current.status==='scheduled' && day < current.day) actions.append(button('Cancel scheduled Oath',async()=>{await changed(ctx.oaths.cancelScheduled);render();}));
    else actions.append(button('Break Oath',async()=>{await confirmBreak(ctx);render();}));
  }
  render();
  const interval=setInterval(render,1000);
  try {return await showDialog({title:'The Oath',content:body,actions:[{label:'Done',value:true}]});}
  finally {clearInterval(interval);}
}

export function oathControl(ctx) {
  const root=button('The Oath',async()=>{
    await ctx.reloadWork();
    if(ctx.oaths.current()) await activeDialog(ctx,ctx.oaths.current());
    else await setup(ctx);
  });
  root.classList.add('oath-control');
  function refresh() {
    root.hidden=!ctx.library;
    const oath=ctx.oaths.current();
    root.textContent=oath?'The Oath · '+oath.status:'The Oath';
    root.classList.toggle('active',!!oath && oath.status!=='scheduled');
  }
  return {root,refresh};
}
