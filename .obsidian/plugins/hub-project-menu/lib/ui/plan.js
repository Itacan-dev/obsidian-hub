"use strict";

const {Modal,Component,Notice}=require("obsidian");

const {ownModalColors}=require("./color-system");

const {createModalHeader,layoutModal}=require("./window-title");


const {openPlanPicker}=require("./plan-picker");

class PlanModal extends Modal {

 constructor(plugin){super(plugin.app);this.plugin=plugin;this.plan=plugin.globalPlan;this.returnFocus=document.activeElement;}

 onOpen(){
  ownModalColors(this);this.modalEl.classList.add("hub-plan-modal");this.contentEl.classList.add("hub-button-scope");this.component=new Component();this.component.load();
  this.planId=this.requestedPlanId??this.plan.active()?.id??this.plan.listHistorical()[0]?.id;
  this.render();this.plan.subscribe(this.component,()=>{const p=this.plan.readPlan(this.planId);const key=(p?.id??'empty')+':'+p?.status;if(key!==this.renderKey)this.render();else this.update();});
 }
 render(){
  this.presentation?.unload();this.presentation=new Component();this.presentation.load();this.contentEl.empty();const p=this.plan.readPlan(this.planId),active=p?.status==='active';this.renderKey=(p?.id??'empty')+':'+p?.status;this.modalEl.classList.toggle('is-active-plan-editor',active);
  createModalHeader(this.contentEl,{title:"Plan",icon:"goal",subtitle:active?"Choose work to include in your plan.":p?"Historical plan - "+p.calendarDate:"No active plan for today"});
  this.body=this.contentEl.createDiv();this.scroller=document.createElement('div');this.scroller.className='hub-plan-editor-scroll hub-scrollbar';
  const bound=this.plan.bind(this.planId);
  const presentation=require('./plan-presentation').mountPlanPresentation({root:this.body,component:this.presentation,plan:bound,context:active?'editor':'report',scroller:this.scroller,editable:active,emptyMessage:false,onRelink:entry=>openPlanPicker(this.plugin,{relink:entry}),noteEditor:note=>{this.note=note;note.value=p.content.note;note.oninput=()=>{try{this.plan.setNote(note.value,this.planId);}catch(e){this.showError(e.message);}};}});
  this.body.append(this.scroller);this.scroller.append(presentation.collection);this.body.classList.add('hub-plan-editor-body');
  if(!active){presentation.note.hidden=!p;presentation.note.empty();if(p){presentation.note.classList.add('hub-plan-historical-note');const label=presentation.note.createSpan({text:require('./plan-home').dateLabel(p),cls:'hub-oath-muted'});label.title=p.timeZone;presentation.note.createSpan({text:p.snapshot.note||'No note',cls:p.snapshot.note?'hub-plan-historical-text':'hub-plan-historical-text hub-oath-muted'});const ended=presentation.note.createSpan({cls:p.status==='finished'?'hub-plan-finished':'hub-oath-muted'});require('./icons').setHubIcon(ended.createSpan(),p.status==='finished'?'circle-check':'clock');ended.createSpan({text:(p.status==='finished'?'Finished ':'Day ended ')+require('./plan-home').time(p,p.endedAt)});}this.note=null;}
  this.addButton=this.body.createEl('button',{cls:'hub-plan-add'});this.addButton.hidden=!active;require('./icons').setHubIcon(this.addButton.createSpan({cls:'hub-capture-icon'}),'plus');this.addButton.createSpan({text:'Add to plan'});this.addButton.onclick=()=>openPlanPicker(this.plugin);
  this.legacyButton=this.scroller.createEl('button',{cls:'hub-button-plain hub-plan-legacy',text:'Review previous Focus',attr:{hidden:''}});this.legacyButton.onclick=()=>void this.reviewLegacy().catch(e=>this.showError(e.message));
  this.status=this.body.createDiv({cls:'hub-plan-error',attr:{role:'alert',hidden:''}});this.recovery=this.scroller.createDiv();const footer=this.contentEl.createDiv({cls:'hub-project-advancement-actions hub-plan-footer'});this.footer=footer;
  footer.createEl('button',{text:'Done',cls:'mod-cta'}).onclick=()=>this.close();
  layoutModal(this,{body:this.body,footer});if(active)void this.legacySources().then(s=>{this.hasLegacy=s.length>0;if(this.contentEl.isConnected)this.update();}).catch(()=>{});this.update();
 }
 showError(message){this.status.textContent=message;this.status.hidden=!message;}
 update(){const active=this.plan.readPlan(this.planId)?.status==='active',blocked=this.plan.transitioning||this.plan.pendingTransition||this.plan.conflict||this.plan.readOnly;this.legacyButton.hidden=!active||!this.hasLegacy||this.plan.draft.legacyReview!=='pending';this.addButton.disabled=!!blocked;this.showError(this.plan.error||this.plan.conflict||this.plan.readOnly?this.plan.status:'');if(this.note){if(document.activeElement!==this.note)this.note.value=this.plan.readPlan(this.planId)?.content?.note??this.note.value;this.note.disabled=!!blocked;}
 this.recovery.empty();const button=(text,run)=>{this.recovery.createEl('button',{text}).onclick=()=>void Promise.resolve().then(run).catch(e=>this.showError(e.message));};if(this.plan.conflict){const details=this.recovery.createEl('details');details.createEl('summary',{text:'Review saved and recovered Plans'});for(const [label,state]of [['Saved',this.plan.baseState],['Recovered',this.plan.conflict.desired]]){const p=state.plansById?.[state.activePlanId];details.createEl('pre',{cls:'hub-plan-conflict',text:label+' ? '+(p?.id??'No active Plan')+'\n'+(p?.content.note??'')});}button('Keep saved plan',()=>this.plan.resolveConflict(false));button('Restore recovered draft',()=>this.plan.resolveConflict(true));}else if(this.plan.error){button('Retry',()=>this.plan.pendingTransition?this.plan.ensureLifecycle():this.plan.flush());button('Copy draft',()=>navigator.clipboard.writeText(this.note?.value??this.plan.deferredInput?.text??''));}
 if(this.plan.deferredInput){const text=this.plan.deferredInput.text;button('Copy preserved text',()=>navigator.clipboard.writeText(text));if(!this.plan.active())button('Use preserved text in new plan',async()=>{const id=await this.plan.createPlan();this.plan.setNote(text,id);await this.plan.flush();this.plan.deferredInput=null;this.plan.checkpoint();this.planId=id;this.render();});}
 }
 async legacySources(){const wizard=this.plugin.projectWizard,date=require("../domain/dates").localISODate(),sources=[];const add=(title,items)=>{if(items?.length)sources.push({title,items});};add("Pending Focus",wizard.getPendingFocus()?.items??wizard.data.pendingFocus?.items);add("Daily Focus - "+date,wizard.getDailyFocus(date));add("Report Focus - "+date,wizard.data.reportFocusByDate?.[date]);const daily=this.app.vault.getAbstractFileByPath("Daily Notes/"+date+".md");if(daily){const text=await this.app.vault.read(daily);const section=text.match(/^#{1,6} Focus\s*\n([\s\S]*?)(?=^#{1,6} |$(?![\s\S]))/m);if(section){const items=section[1].split("\n").map(line=>line.replace(/^\s*[-*]\s+(?:\[[ xX]\]\s*)?/," ").trim()).filter(Boolean).map(text=>({text}));add("Daily Note Focus - "+date,items);}}return sources;}
 async reviewLegacy(){if(this.legacy){this.legacy.remove();this.legacy=null;return;}const sources=await this.legacySources();if(!this.contentEl.isConnected)return;this.legacy=this.scroller.createDiv();this.legacy.createEl("p",{text:"Choose descriptions to append to your note. Historical records are preserved."});const selected=[];for(const source of sources)for(const item of source.items){const text=typeof item==="string"?item:item.text;if(!text)continue;const label=this.legacy.createEl("label",{cls:"hub-plan-picker-row"}),box=label.createEl("input",{attr:{type:"checkbox"}});label.createSpan({text:source.title+": "+text});selected.push({box,text:"["+source.title+"] "+text});}const preview=this.legacy.createEl("pre");const refresh=()=>preview.textContent=selected.filter(i=>i.box.checked).map(i=>i.text).join("\n");this.legacy.onchange=refresh;const importButton=this.legacy.createEl("button",{text:"Append selected descriptions"});importButton.onclick=()=>{refresh();if(!preview.textContent)return;this.plan.mutate(p=>{p.note=[p.note,preview.textContent].filter(Boolean).join("\n\n");p.legacyReview="completed";});this.note.value=this.plan.draft.note;this.legacy.remove();this.legacy=null;};const dismiss=this.legacy.createEl("button",{text:"Dismiss"});dismiss.onclick=()=>{this.plan.mutate(p=>p.legacyReview="dismissed");this.legacy.remove();this.legacy=null;};}

 close(){if(this.closing)return;this.closing=true;void (async()=>{const p=this.plan.readPlan(this.planId);if(p?.status==='active'&&!p.content.entries.length){await this.plan.abandonEmptyPlan(this.planId);return true;}return this.plan.closeSafe();})().then(safe=>{this.closing=false;if(safe)super.close();else{this.update();this.showError("Your latest draft could not be protected. Retry or copy it before closing.");const b=this.recovery.createEl("button",{text:"Discard unprotected changes"});b.onclick=()=>{this.plan.draft=JSON.parse(JSON.stringify(this.plan.base));this.plan.recovery.clear();this.plan.emit();super.close();};}}).catch(error=>{this.closing=false;this.update();this.showError(error.message);});}

 onClose(){if(this.plugin.planModal===this)this.plugin.planModal=null;this.presentation?.unload();this.component?.unload();this.returnFocus?.focus?.();}

}

function openPlan(plugin,planId){if(plugin.planModal?.containerEl?.isConnected){if(planId&&plugin.planModal.planId!==planId){plugin.planModal.planId=planId;plugin.planModal.render();}plugin.planModal.modalEl.focus();return plugin.planModal;}const modal=new PlanModal(plugin);plugin.planModal=modal;modal.requestedPlanId=planId;try{modal.open();if(!modal.contentEl.isConnected)throw Error("Plan could not open.");return modal;}catch(error){plugin.planModal=null;modal.component?.unload();Modal.prototype.close.call(modal);new Notice(error.message);return null;}}

module.exports={PlanModal,openPlan};

