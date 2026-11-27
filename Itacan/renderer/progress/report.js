import {el,button} from '../ui/elements.js';
import {field} from '../ui/forms.js';
import {showDialog} from '../ui/dialog.js';
import {reportPlan} from '../plan/plan.js';

export const localDay = (date=new Date()) => date.toLocaleDateString('sv-SE');
export const workspaces = ctx => [...ctx.library.projects,...ctx.library.resources];
// A visit can make a workspace eligible for a report. Only its latest visit in
// this library session is needed. Visits never become activity or statistics.
const visits=new WeakMap();
const sessionStart=new Date().toISOString();
export function observeWorkspace(ctx,path) {
  if (!path || !ctx.documents) return;
  const owner=path.split('/').slice(0,2).join('/');
  if (!visits.has(ctx.documents)) visits.set(ctx.documents,new Map());
  visits.get(ctx.documents).set(owner,new Date().toISOString());
}
export function pendingWorkspaces(ctx,day) {
  const latest=new Map(visits.get(ctx.documents));
  for (const event of ctx.progress.activity()) {
    if (event.day!==day || event.at<sessionStart || event.removedWorkspace) continue;
    if (!latest.has(event.owner) || latest.get(event.owner)<event.at) latest.set(event.owner,event.at);
  }
  const available=new Set(workspaces(ctx).map(w=>w.path));
  return [...latest].filter(([owner,at])=>available.has(owner) && localDay(new Date(at))===day &&
    !ctx.progress.reports().some(r=>!r.removed && r.owner===owner && r.day===day && r.updated>=at))
    .sort((a,b)=>b[1].localeCompare(a[1])).map(([owner])=>owner);
}
export function eventLabel(e) {
  if (e.action === 'step') return e.title+' · '+e.step;
  if (e.action === 'task') return e.title;
  const action=e.action.replace('project-','');
  const verb=action[0].toUpperCase()+action.slice(1);
  return verb+(e.action.startsWith('project-')?' project':'')+' · '+(e.title || e.path.split('/').at(-1));
}
function evidence(ctx,day,owner,saved) {
  const rows=saved || ctx.progress.activity().filter(e=>!e.reopened && !e.removedWorkspace && e.day===day && e.owner===owner);
  const box=el('details','report-evidence');
  box.append(el('summary','','Recorded work ('+rows.length+')'));
  const tasks=rows.filter(e=>e.taskId || ['task','step'].includes(e.action));
  const activity=rows.filter(e=>!['task','step'].includes(e.action));
  const line=e=>el('p','',new Date(e.at).toLocaleTimeString()+' · '+eventLabel(e));
  if (tasks.length) box.append(el('strong','','Task progress'),...tasks.map(line));
  if (activity.length) {
    const details=el('details');
    details.append(el('summary','','Activity summary ('+activity.length+')'),...activity.map(line));
    box.append(details);
  } else box.append(el('p','muted','No activity recorded for this day.'));
  return box;
}
async function chooseWorkspace(ctx) {
  const body=el('div','report-picker');
  const search=field(body,'Search Projects and Resources','search');
  const list=el('div','picker-list');
  let selected;
  function render(){
    list.replaceChildren();
    for(const type of ['Projects','Resources']){
      list.append(el('h3','',type));
      for(const w of workspaces(ctx).filter(w=>w.path.startsWith(type+'/') && w.name.toLowerCase().includes(search.value.toLowerCase())))
        list.append(button(w.name,()=>{selected=w.path;body.closest('dialog').close();}));
    }
  }
  search.oninput=render; render(); body.append(list);
  await showDialog({title:'Add workspace',content:body,actions:[{label:'Cancel'}]});
  return selected;
}
const ratingTitles={
  Projects:['No work','Showed up','Clearly advanced','A few substantive advances','Many substantive advances or one major advance'],
  Resources:['No work','Showed up','Meaningful engagement','Substantial engagement','Major engagement']
};

export async function progressEditor(ctx,day=localDay(),scope=null,options={}) {
  const body=el('div','report-body'),cards=el('div','report-cards'),rows=new Map();
  const reports=ctx.progress.reports().filter(r=>r.day===day && !r.removed);
  function changed(r){return r.reviewed || r.score!== (r.initial?.score ?? null) || r.note.value.trim()!==(r.initial?.summary || '');}
  function update(){
    const save=body.closest('dialog')?.querySelector('footer .primary');
    if (save) save.disabled=![...rows.values()].some(changed);
  }
  function add(owner,expanded=true){
    if (rows.has(owner)) {rows.get(owner).card.open=true;return;}
    const initial=reports.find(r=>r.owner===owner);
    const card=el('details','panel report-card');card.open=expanded;
    const head=el('summary'), status=el('small','muted');
    head.append(el('strong','',owner),status);
    const controls=el('div','actions rating-controls');
    controls.setAttribute('role','group'); controls.setAttribute('aria-label','Rating for '+owner);
    const note=field(card,'Reflection for '+owner,'textarea',initial?.summary || '');
    note.maxLength=1000; note.placeholder='Optional reflection';
    const row={owner,initial,score:initial?.score ?? null,note,card};
    function rate(value){
      row.score=value;status.textContent=value===null?'Not rated':value+'/4';
      for(const b of controls.querySelectorAll('[data-score]')) b.setAttribute('aria-pressed',String(Number(b.dataset.score)===value));
      note.disabled=value===0; update();
    }
    ratingTitles[owner.split('/')[0]].forEach((title,n)=>{
      const b=button(String(n),()=>{row.reviewed=true;rate(n);});b.dataset.score=n;b.title=title;controls.append(b);
    });
    controls.append(button('Clear rating',()=>{row.reviewed=true;rate(null);}));
    row.useSaved=latest=>{
      row.note.value=latest?.summary || '';
      row.reviewed=false;
      rate(latest?.score ?? null);
    };
    card.prepend(head,controls);card.append(evidence(ctx,day,owner));cards.append(card);
    rows.set(owner,row);note.oninput=update;rate(row.score);
  }
  const candidates=workspaces(ctx).map(w=>w.path);
  const activeOwners=ctx.progress.activity().filter(e=>e.day===day && !e.removedWorkspace && !e.reopened).map(e=>e.owner);
  const suggested=options.pending || (scope?[scope]:[...new Set([options.current,...pendingWorkspaces(ctx,day),...reports.map(r=>r.owner),...activeOwners])]);
  for(const owner of suggested.filter(o=>candidates.includes(o))) add(owner,!rows.size);
  body.append(cards,button('Add workspace',async()=>{const owner=await chooseWorkspace(ctx);if(owner)add(owner);}),reportPlan(ctx,day));
  const actions=options.pending?[{label:'Keep working',value:false},{label:'Close without reporting',value:true}]:[{label:'Cancel',value:false}];
  actions.push({label:options.pending?'Save and close':'Save progress',primary:true,value:true,run:async()=>{
    const drafts=[...rows.values()].filter(changed);
    try {
      await ctx.progress.saveReport({day,entries:drafts.map(r=>({
        owner:r.owner,score:r.score,summary:r.note.value,expected:r.initial?.updated || null
      }))});
    } catch(error) {
      if (!error.message.includes('This report changed.')) throw error;
      await ctx.reloadWork();
      for (const row of drafts) {
        const latest=ctx.progress.reports().find(r=>r.owner===row.owner && r.day===day && !r.removed);
        if (latest?.updated===row.initial?.updated) continue;
        const saved=el('div','multiline');
        saved.append(el('p','',latest?'Saved rating · '+(latest.score ?? 'Unrated'):'Report removed'),el('p','',latest?.summary || 'No saved reflection'));
        const choice=await showDialog({title:'Review changed report',description:row.owner,content:saved,actions:[
          {label:'Use saved version',value:'saved'},{label:'Keep my draft',value:'draft'}
        ]});
        if (!choice) throw error;
        row.initial=latest;
        if (choice==='saved') row.useSaved(latest);
        else row.reviewed=true;
      }
      update();
      throw Error('Review your entries before saving.');
    }
  }});
  const result=showDialog({title:'Progress Report',description:day+' · Evaluate the whole day so far.',wide:true,content:body,actions});
  update();return result;
}

export async function dailyReport(ctx,day,scope=null) {
  const reports=ctx.progress.reports().filter(r=>r.day===day && (!scope || r.owner===scope && !r.removed));
  if (!reports.length) return progressEditor(ctx,day,scope);
  const body=el('div','report-body');
  const {renderPreview}=await import('../document/preview.js');
  for (const r of reports) {
    const card=el('section','panel report-card');
    const reflection=el('div','report-reflection');
    if (r.summary) renderPreview(reflection,r.summary,r.owner+'/',ctx.library.session,async (...args)=>{
      if(await ctx.openNote(...args)) body.closest('dialog')?.close();
    },ctx.report);
    else reflection.textContent='No reflection';
    card.append(el('h3','',r.owner+(r.removed?' (removed)':'')),el('strong','',r.score===null?'Unrated':r.score+'/4'),
      reflection,evidence(ctx,day,r.owner,r.evidence));body.append(card);
  }
  body.append(reportPlan(ctx,day));
  const edit=await showDialog({title:'Progress report',description:day+' · A summary of your work and progress for the day',content:body,wide:true,actions:[{label:'Edit progress',value:true},{label:'Close'}]});
  if(edit) return progressEditor(ctx,day,scope);
}
