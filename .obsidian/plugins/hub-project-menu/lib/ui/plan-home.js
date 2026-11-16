"use strict";
const {Component}=require('obsidian');
const {setHubIcon}=require('./icons');
const {localISODate,formatDate}=require('../domain/dates');
const {createHistoryPager}=require('./history-pager');
function dateLabel(p){const today=new Date(),yesterday=new Date(today);yesterday.setDate(today.getDate()-1);return p.calendarDate===localISODate(today)?'Today':p.calendarDate===localISODate(yesterday)?'Yesterday':formatDate(p.calendarDate,'numeric');}
function time(p,stamp){return new Intl.DateTimeFormat('en-GB',{timeZone:p.timeZone,hour:'2-digit',minute:'2-digit'}).format(new Date(stamp));}
function mountPlanHome({root,component,plugin}){
 const plan=plugin.globalPlan;let historyExpanded=false,child,renderedHistory=false,expandedPlanId=null,pager,loadedCount=50,noteLines=1,notePlanId;const positions={main:0,history:0};
 const footer=root.createDiv({cls:'hub-plan-home-footer'});let footerMode,historyToggle,historyChevron,historyLabel;
 const report=e=>{plan.status=e.message;render();};
 const action=(host,text,run,cls='')=>{const b=host.createEl('button',{text,cls});b.onclick=()=>void Promise.resolve().then(run).catch(report);return b;};
 const header=root.parentElement?.querySelector('.home-panel-title button');
 let headerIcon,headerLabel;
 if(header){
  header.empty();header.classList.add('hub-panel-action','hub-panel-add');
  headerIcon=header.createSpan({cls:'hub-task-add-icon',attr:{'aria-hidden':'true'}});setHubIcon(headerIcon,'plus');
  headerLabel=header.createSpan();
 }
 const newPlan=async()=>{const id=await plan.createPlan();historyExpanded=false;render();require('./plan').openPlan(plugin,id);};
 function render(){
  const oldNote=root.querySelector(':scope > .hub-plan-note-excerpt:not(.is-empty-note) .hub-plan-note-text');
  if(oldNote){const line=parseFloat(root.ownerDocument.defaultView.getComputedStyle(oldNote).lineHeight);if(line)noteLines=Math.max(1,Math.min(2,Math.round(oldNote.getBoundingClientRect().height/line)));}
  const focused=root.contains(document.activeElement)?document.activeElement:null,focusHistory=focused?.closest('[data-history-id]')?.dataset.historyId,focusEntry=focused?.closest('[data-plan-id]')?.dataset.planId;
  if(pager)loadedCount=Math.max(loadedCount,pager.renderedCount);pager=null;
  const old=root.querySelector('.hub-plan-history-list')??root.querySelector('.hub-plan-collection');if(old)positions[renderedHistory?'history':'main']=old.scrollTop;
  child?.unload();child=new Component();child.load();for(const node of [...root.children])if(node!==footer)node.remove();root.classList.add('hub-plan-home');
  const active=plan.active(),finished=plan.readPlan(plan.finishedPreviewPlanId),p=active??(finished?.status==='finished'?finished:null),records=plan.listHistorical();
  if(p){historyExpanded=false;expandedPlanId=null;}if(expandedPlanId&&!records.some(r=>r.id===expandedPlanId))expandedPlanId=null;renderedHistory=historyExpanded;
  if(header){header.hidden=false;headerIcon.hidden=!!active;headerIcon.style.display=active?'none':'';headerLabel.textContent=active?'Edit':'Plan';header.setAttribute('aria-label',active?'Edit plan':'New plan');header.disabled=!!(plan.transitioning||plan.pendingTransition||plan.conflict||plan.readOnly);header.onclick=()=>void Promise.resolve().then(()=>active?require('./plan').openPlan(plugin,active.id):newPlan()).catch(report);}
  if(p){
   const bound=plan.bind(p.id);require('./plan-presentation').mountPlanPresentation({root,component:child,plan:bound,context:'home',interactive:p.status==='active',emptyMessage:false});
   root.classList.toggle('is-finished-plan',p.status==='finished');
   const note=root.querySelector('.hub-plan-note-excerpt'),text=(p.content??p.snapshot).note,empty=!text.trim();if(notePlanId!==p.id){noteLines=1;notePlanId=p.id;}note.hidden=false;note.classList.toggle('is-empty-note',empty);note.style.setProperty('--hub-plan-note-lines',String(noteLines));note.querySelector('.hub-plan-note-text').textContent=empty?'':text;
  }else{
   root.classList.remove('is-finished-plan');
   if(historyExpanded&&records.length){
    const list=root.createDiv({cls:'hub-plan-history-list hub-scrollbar'});list.id='hub-plan-home-history';
    const rows=new Map();let expansion;
    child.register(()=>expansion?.unload());
    const expand=(id,anchor)=>{
     const top=anchor?.getBoundingClientRect().top;
     expansion?.unload();expansion=null;
     for(const [key,row]of rows){row.content.empty();row.content.hidden=key!==id;row.button.setAttribute('aria-expanded',String(key===id));setHubIcon(row.chevron,key===id?'chevron-down':'chevron-right');}
     const row=rows.get(id);
     if(row&&row.record.snapshot.entries.length){
      expansion=new Component();expansion.load();const collection=row.content.createDiv({cls:'hub-plan-collection'});
      require('./plan-list').mountPlanList({root:collection,component:expansion,plan:plan.bind(id),editable:false,interactive:true,emptyMessage:false,scroller:list,onRendered:()=>{if(focusHistory===id&&focusEntry){const target=[...row.content.querySelectorAll('[data-plan-id]')].find(e=>e.dataset.planId===focusEntry)?.querySelector('.hub-plan-title');target?.focus({preventScroll:true});}}});
     }
     if(anchor&&top!==undefined)list.scrollTop+=anchor.getBoundingClientRect().top-top;
    };
    pager=createHistoryPager(list,child);pager.render(records,record=>{
     const wrapper=list.createDiv({cls:'hub-plan-history-entry'});wrapper.dataset.historyId=record.id;
     const b=action(wrapper,'',()=>{expandedPlanId=expandedPlanId===record.id?null:record.id;expand(expandedPlanId,b);b.focus({preventScroll:true});},'hub-plan-history-row'),status=b.createDiv({cls:'hub-plan-history-status'});
     setHubIcon(status.createSpan({cls:record.status==='finished'?'hub-plan-finished':'hub-oath-muted'}),record.status==='finished'?'circle-check':'clock');
     status.createSpan({text:dateLabel(record)+' \u00b7 '+time(record,record.createdAt)+'\u2013'+time(record,record.endedAt)});
     const chevron=status.createSpan({cls:'hub-task-group-chevron'});chevron.setAttribute('aria-hidden','true');setHubIcon(chevron,'chevron-right');
     b.title=(record.status==='finished'?'Manually finished':'Day ended')+' \u00b7 '+record.timeZone;b.setAttribute('aria-description',b.title);
     b.createDiv({text:record.snapshot.note||'No note',cls:'hub-plan-history-note'+(record.snapshot.note?'':' hub-oath-muted')});b.createDiv({text:record.snapshot.entries.length+' planned items',cls:'hub-plan-history-count hub-oath-muted'});
     const content=wrapper.createDiv({cls:'hub-plan-history-content hub-plan-presentation',attr:{hidden:''}});content.dataset.planContext='home';content.id='hub-plan-history-'+record.id;b.setAttribute('aria-controls',content.id);b.setAttribute('aria-expanded','false');
     rows.set(record.id,{button:b,content,chevron,record});
    },loadedCount);expand(expandedPlanId);list.scrollTop=positions.history;
    if(focusHistory){const row=rows.get(focusHistory);row?.button.focus({preventScroll:true});}
   }else root.createDiv({cls:'hub-plan-empty',text:'No active plan for today'});
  }
  const mode=p?p.status+':'+p.id:(records.length?'history':'empty');
  if(mode!==footerMode){footer.empty();footerMode=mode;historyToggle=null;
  if(p?.status==='active'){
   const b=action(footer,'',()=>require('./plan-finish').confirmFinish(plugin,p.id,b),'hub-plan-finish'),icon=b.createSpan({cls:'hub-capture-icon'});setHubIcon(icon,'circle-dashed-check');b.createSpan({text:'Finish plan'});
   for(const event of ['mouseenter','focus'])b.addEventListener(event,()=>setHubIcon(icon,'circle-check'));
   for(const event of ['mouseleave','blur'])b.addEventListener(event,()=>setHubIcon(icon,b.matches(':hover,:focus')?'circle-check':'circle-dashed-check'));
   b.disabled=!!(plan.transitioning||plan.pendingTransition||plan.conflict||plan.readOnly);
  }else if(p){
   const status=footer.createSpan({cls:'hub-plan-finished-status'});setHubIcon(status.createSpan(),'circle-check');status.createSpan({text:'Finished '+time(p,p.endedAt)});
   action(footer,'Hide',()=>{plan.dismissHomePlan(p.id);header?.focus();},'hub-button-plain hub-plan-hide');
  }else if(records.length){
   const b=action(footer,'',()=>{historyExpanded=!historyExpanded;render();root.querySelector('.hub-task-group-toggle')?.focus();},'hub-task-group-toggle');b.setAttribute('aria-expanded',String(historyExpanded));b.setAttribute('aria-controls','hub-plan-home-history');historyToggle=b;historyChevron=b.createSpan({cls:'hub-task-group-chevron',attr:{'aria-hidden':'true'}});b.classList.add('hub-plan-history-toggle');const label=b.createSpan({cls:'hub-plan-history-toggle-label'});label.createSpan({text:'Show earlier plans',cls:'hub-plan-history-toggle-measure',attr:{'aria-hidden':'true'}});historyLabel=label.createSpan();
  }
  }
  const finish=footer.querySelector('.hub-plan-finish');if(finish)finish.disabled=!!(plan.transitioning||plan.pendingTransition||plan.conflict||plan.readOnly);
  if(historyToggle){historyToggle.setAttribute('aria-expanded',String(historyExpanded));setHubIcon(historyChevron,historyExpanded?'chevron-down':'chevron-right');historyLabel.textContent=historyExpanded?'Hide earlier plans':'Show earlier plans';}
  if(plan.error||plan.status!=='Saved')root.createDiv({text:plan.status,cls:'hub-oath-muted',attr:{role:'status'}});
  for(const node of [...root.children])if(node!==footer)root.insertBefore(node,footer);
  const list=renderedHistory?null:root.querySelector('.hub-plan-collection');if(list){list.dataset.planScrollRestore=String(positions.main);list.scrollTop=positions.main;}
 }
 plan.subscribe(component,render);component.register(()=>{child?.unload();if(header)header.onclick=null;});render();
}
module.exports={mountPlanHome,dateLabel,time};
