"use strict";
window.process={platform:'win32',env:{}};
window.testDone=(async()=>{
 const centerDelta=parts=>{const title=parts.textEl.getBoundingClientRect(),checkbox=parts.checkbox.getBoundingClientRect();return Math.abs(title.top+title.height/2-checkbox.top-checkbox.height/2);};
 let checks=0;const check=(v,message)=>{if(!v)throw Error(message);checks++;},frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 HTMLElement.prototype.createEl=function(tag,options={}){const e=document.createElement(tag);if(options.cls)e.className=options.cls;if(options.type)e.type=options.type;if(options.text!=null)e.textContent=options.text;for(const [k,v]of Object.entries(options.attr??{}))e.setAttribute(k,v);this.append(e);return e;};
 HTMLElement.prototype.createDiv=function(o={}){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o={}){return this.createEl('span',o)};HTMLElement.prototype.empty=function(){this.replaceChildren()};
 class Modal{constructor(app){this.app=app;this.containerEl=document.body.createDiv({cls:'modal-container'});this.modalEl=this.containerEl.createDiv({cls:'modal'});this.contentEl=this.modalEl.createDiv({cls:'modal-content'});this.closeButton=this.modalEl.createEl('button',{cls:'modal-close-button',text:'?',attr:{'aria-label':'Close'}});this.closeButton.onclick=()=>this.close();}open(){this.onOpen()}close(){this.onClose();this.containerEl.remove()}}
 const drawIcon=(e,name)=>{e.dataset.icon=name;e.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(name.endsWith('chevron-right')?'<path d="m9 5 7 7-7 7"/>':'<rect x="4" y="5" width="16" height="14" rx="2"/>')+'</svg>'};
 const originalDrawIcon=drawIcon;
 const renderIcon=(el,name)=>{originalDrawIcon(el,name);if(name.endsWith('map-pin-pen'))el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+[[6,"M17.97 9.304A8 8 0 0 0 2 10c0 4.69 4.887 9.562 7.022 11.468"],[6,"M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"],[1,10,10,3]].map(shape=>'<path d="'+shape[1]+'"/>').join('')+'</svg>'};
 const svgDefaults=document.createElement('style');svgDefaults.textContent='.svg-icon {color:var(--icon-color,var(--text-muted));opacity:.6}';document.head.append(svgDefaults);
 const obsidian={Modal,setIcon:(el,name)=>{renderIcon(el,name);el.querySelector('svg')?.classList.add('svg-icon');},getIcon:()=>true,addIcon(){}};
 const modules=new Map();async function preload(id){if(modules.has(id))return;const source=await(await fetch('../'+id)).text();modules.set(id,{source});for(const m of source.matchAll(/require\(["'](\.[^"']+)["']\)/g)){const target=new URL(m[1],new URL(id,location.origin+'/')).pathname.slice(1);await preload(target.endsWith('.js')?target:target+'.js')}}
 function load(id){const record=modules.get(id);if(record.exports)return record.exports;const module={exports:{}};record.exports=module.exports;new Function('require','module','exports',record.source)(request=>{if(request==='obsidian')return obsidian;const target=new URL(request,new URL(id,location.origin+'/')).pathname.slice(1);return load(target.endsWith('.js')?target:target+'.js')},module,module.exports);return record.exports=module.exports;}

 await preload('ui/task-card.js');
 const {createTaskRow,mountTaskCardPresentation}=load('ui/task-card.js');
 const {locationBreadcrumb}=load('domain/native-task-location.js');
 const owner={type:'resource',id:'knowledge'},other={type:'project',id:'p'};
 let clicks=0;
 const host=document.body.createDiv({cls:'hub-button-scope'});host.style.cssText='width: min(480px, calc(100vw - 40px));margin:20px';
 const task={text:'Read Lecture 2',steps:[],nativeOwner:owner,nativeReference:{owner}};
 let display={workspaceName:'Knowledge',segments:['Physics','SI2215 Symmetries in Physics']};
 const parts=createTaskRow(host,task);parts.row.style.cssText='padding:12px;';
 const plain=createTaskRow(host,task);
 const card=mountTaskCardPresentation(parts.row,parts.textEl,task,()=>'',{description:false,dates:false,locationAction:()=>clicks++,locationWorkspace:owner,nativeDisplay:()=>display});
 const panel=mountTaskCardPresentation(plain.row,plain.textEl,{...task,nativeLocationDisplay:display},()=>'',{description:false,dates:false,locationWorkspace:owner});
 const button=card.sourceControl,text=button.querySelector('.hub-task-location-text'),icon=button.querySelector('.hub-task-location-edit-icon');
 await frame();
 check(text.textContent===plain.source.textContent,'Editor and Tasks panel use identical route');
 check(text.textContent==='Physics / SI2215 Symmetries in Physics','Owning workspace is omitted');
 for(const key of ['fontSize','fontWeight','color'])check(getComputedStyle(button)[key]===getComputedStyle(plain.source)[key],'Panel typography: '+key+' '+getComputedStyle(button)[key]+' vs '+getComputedStyle(plain.source)[key]+' parent '+getComputedStyle(parts.source)[key]);
 check(icon.dataset.icon.endsWith('map-pin-pen')&&!button.querySelector('[data-icon$="folder"]'),'Leading edit icon replaces folder');
 check(button.firstElementChild===icon&&icon.nextElementSibling===text,'Icon precedes route');
 check(Math.abs(icon.getBoundingClientRect().left-parts.textEl.getBoundingClientRect().left)<0.5,'Location icon aligns with title left edge');
 check(getComputedStyle(icon.querySelector('svg')).color===getComputedStyle(document.body).color&&getComputedStyle(icon.querySelector('svg')).opacity==='1','Native SVG retains full foreground color and opacity');
 check(getComputedStyle(icon).color===getComputedStyle(document.body).color,'Edit icon uses normal foreground');
 check(getComputedStyle(button).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(button).borderWidth==='0px','No permanent fill or border');
 check(button.getBoundingClientRect().width<parts.source.getBoundingClientRect().width,'Short control fits visible content');
 text.click();icon.click();check(clicks===2,'Path and icon activate single location control');
 const before=JSON.stringify(task);
 let mounted;
 for(const mode of ['Add','Edit'])for(const contextOwner of [null,owner]){
  const current=createTaskRow(host,task),state={...task};
  display={workspaceName:'Knowledge',segments:['Mathematics','Complex Analysis','Definitions.md']};
  mounted=mountTaskCardPresentation(current.row,current.textEl,state,()=>'',{description:false,dates:false,locationAction:()=>clicks++,locationWorkspace:contextOwner,nativeDisplay:()=>display});
  check(mounted.sourceControl.querySelector('.hub-task-location-text').textContent===(contextOwner?'Mathematics / Complex Analysis / Definitions.md':'Knowledge / \u2026 / Complex Analysis / Definitions.md'),mode+' follows originating context');
  const currentSteps=load('ui/task-card.js').createTaskChecklist(current.info,{emptyAction:true});currentSteps.update(false,0,0);
  const stepsPosition=()=>{const r=currentSteps.toggle.getBoundingClientRect();return JSON.stringify([r.x,r.y,r.width,r.height]);};const initialSteps=stepsPosition();
  display={workspaceName:'Knowledge',segments:[]};mounted.update(state);
  const action=mounted.sourceControl;
  check(action.textContent==='Edit task location',mode+' root uses action label in Home/workspace');
  check(getComputedStyle(action.querySelector('.hub-task-location-text')).color===getComputedStyle(document.body).color,mode+' root action text has normal foreground');
  check(Math.abs(action.firstElementChild.getBoundingClientRect().left-current.textEl.getBoundingClientRect().left)<0.5,mode+' root icon aligns with title');
  const rootHeight=current.row.getBoundingClientRect().height;

  check(action.firstElementChild.classList.contains('hub-task-location-edit-icon')&&current.info.contains(action),mode+' root keeps visible leading edit icon');
  display={workspaceName:'Knowledge',segments:['Folder','Note.md']};mounted.update(state);
  check(action.textContent===(contextOwner?'Folder / Note.md':'Knowledge / Folder / Note.md'),mode+' draft selection updates from root immediately');
  check(getComputedStyle(action.querySelector('.hub-task-location-text')).color===getComputedStyle(current.source).color,mode+' actual path retains metadata foreground');
  check(Math.abs(action.firstElementChild.getBoundingClientRect().left-current.textEl.getBoundingClientRect().left)<0.5,mode+' folder/note icon aligns with title');
  check(current.row.getBoundingClientRect().height===rootHeight,mode+' location state keeps card height unchanged');
  check(stepsPosition()===initialSteps,mode+' Steps geometry remains unchanged across root/path states');
  const unchanged=action.textContent;mounted.update(state);check(action.textContent===unchanged,mode+' cancelled selection leaves display unchanged');
  display={workspaceName:'Knowledge',segments:[]};mounted.update(state);check(action.textContent==='Edit task location',mode+' choosing root restores action');
  mounted.destroy();current.row.remove();
 }

 for(const segments of [[],['Folder'],['Folder','Note.md'],['One','Two','Three','Note '+ 'long'.repeat(90)+'.md']]){
  display={workspaceName:'Knowledge',segments};card.update(task);await frame();
  check(text.textContent===(segments.length?locationBreadcrumb({...task,nativeLocationDisplay:display},owner).label:'Edit task location'),'Shared formatting for root/folder/note/deep route');
  check(icon.getBoundingClientRect().right<=parts.source.getBoundingClientRect().right+1,'Icon stays within card');
  check(button.scrollWidth<=button.clientWidth+1,'Long control has no horizontal overflow');
  const separators=[...text.querySelectorAll('.hub-route-separator')];
  const labels=[...text.querySelectorAll('.hub-route-label')].map(e=>e.textContent);
  check(JSON.stringify(labels)===JSON.stringify(segments.length?locationBreadcrumb({...task,nativeLocationDisplay:display},owner).visibleSegments:['Edit task location']),'Rendered segments preserve context and abbreviation');
  check(separators.length===Math.max(0,labels.length-1),'Exactly one chevron between adjacent segments');
  for(const separator of separators){
   const svg=separator.querySelector('svg'),size=svg.getBoundingClientRect(),style=getComputedStyle(separator);
   check(separator.dataset.icon.endsWith('chevron-right')&&separator.getAttribute('aria-hidden')==='true'&&svg.querySelector('path').getAttribute('d')==='m9 5 7 7-7 7','Decorative Lucide chevron geometry');
   check(size.width===10&&size.height===10&&style.marginLeft==='3px'&&style.marginRight==='3px','Compact icon size and balanced spacing survive editor SVG rules');
   check(getComputedStyle(svg).color===getComputedStyle(text).color&&getComputedStyle(svg).opacity==='1','Chevron follows metadata color without native SVG dimming');
  }
 }

 for(const type of ['project','resource']){
  const rootOwner={type,id:'root-'+type},rootDisplay={workspaceName:type==='project'?'Project A':'Knowledge',segments:[]},rootTask={text:'Root task',steps:[],nativeReference:{owner:rootOwner},nativeLocationDisplay:rootDisplay};
  const home=createTaskRow(host,rootTask,false,{variant:'home'}),workspace=createTaskRow(host,rootTask),reference=createTaskRow(host,rootTask);
  const homeCard=mountTaskCardPresentation(home.row,home.textEl,rootTask,()=>'',{description:false,dates:false});
  const workspaceCard=mountTaskCardPresentation(workspace.row,workspace.textEl,rootTask,()=>'',{description:false,dates:false,locationWorkspace:rootOwner});
  reference.row.classList.add("hub-planned-task-row");reference.source.remove();await frame();
  check(home.source.textContent===rootDisplay.workspaceName&&home.info.contains(home.source),type+' Home root shows workspace name');
  check(!workspace.info.querySelector('.project-task-location')&&!workspace.info.contains(workspace.source),type+' owning workspace omits whole location element');
  check(workspace.row.getBoundingClientRect().height<=reference.row.getBoundingClientRect().height,type+' root uses compact height without empty metadata '+JSON.stringify({root:workspace.row.getBoundingClientRect().height,ref:reference.row.getBoundingClientRect().height,rows:getComputedStyle(workspace.row).gridTemplateRows,infoRows:getComputedStyle(workspace.info).gridTemplateRows,info:getComputedStyle(workspace.info).gridRow,margin:getComputedStyle(workspace.checkbox).marginTop,title:workspace.textEl.getBoundingClientRect().height}));
  check(centerDelta(workspace)<0.6,type+' title line and checkbox centers align');
  check(getComputedStyle(workspace.row).paddingTop===getComputedStyle(reference.row).paddingTop&&getComputedStyle(workspace.row).columnGap===getComputedStyle(reference.row).columnGap,type+' padding and horizontal spacing remain unchanged');
  check(!home.row.classList.contains('hub-workspace-root-task')&&getComputedStyle(home.checkbox).marginTop===getComputedStyle(reference.checkbox).marginTop,type+' Home retains established alignment');
  workspaceCard.update({...rootTask,completed:true});await frame();check(centerDelta(workspace)<0.6&&workspace.checkbox.checked===false,type+' completed presentation retains centered layout without mutating completion');
  workspaceCard.update(rootTask);

  check(workspace.textEl.textContent==='Root task'&&workspace.checkbox.isConnected,type+' title and completion remain');
  const folder={...rootTask,nativeLocationDisplay:{...rootDisplay,segments:['Folder']}};workspaceCard.update(folder);
  check(workspace.info.contains(workspace.source)&&workspace.source.textContent==='Folder',type+' folder path remains and restores detached metadata');
  check(!workspace.row.classList.contains('hub-workspace-root-task')&&getComputedStyle(workspace.checkbox).marginTop===getComputedStyle(reference.checkbox).marginTop,type+' two-line folder alignment remains unchanged');
  workspaceCard.update({...rootTask,nativeLocationDisplay:{...rootDisplay,segments:['Folder','Note.md']}});check(!workspace.row.classList.contains('hub-workspace-root-task'),type+' note keeps two-line layout');
  const missing={...rootTask,nativeLocationDisplay:{...rootDisplay,available:false}};workspaceCard.update(missing);
  check(workspace.info.contains(workspace.source)&&workspace.source.textContent==='Location unavailable',type+' unavailable root-like display stays visible');
  workspaceCard.update(rootTask);check(!workspace.info.contains(workspace.source),type+' return to root removes location');
  homeCard.destroy();workspaceCard.destroy();home.row.remove();workspace.row.remove();reference.row.remove();
 }
 // Root tasks can still have dates, Steps, importance and phase metadata.
 const richTask={text:'Root with metadata',nativeReference:{owner},nativeLocationDisplay:{workspaceName:'Knowledge',segments:[]},necessity:'should',dueDate:'2026-11-17',steps:[],description:'Root details'};
 const rich=createTaskRow(host,richTask);let phaseName='Planning';
 const richCard=mountTaskCardPresentation(rich.row,rich.textEl,richTask,()=>'',{locationWorkspace:owner,phaseLabel:()=>phaseName});
 const steps=load('ui/task-card.js').createTaskChecklist(rich.info);steps.update(false,0,1);
 check(!rich.info.querySelector('.project-task-location')&&richCard.phase?.isConnected&&richCard.phase.textContent==='Planning','Root keeps phase badge independently of location');
 check(richCard.dates?.isConnected&&richCard.indicator?.isConnected&&steps.toggle.isConnected,'Root preserves dates, importance and Steps');
 await frame();check(centerDelta(rich)<0.6,'Dates, phase and Steps do not move checkbox off title center');
 check(richCard.descriptionIndicator?.isConnected&&richCard.descriptionIndicator.getBoundingClientRect().height===28,'Information icon retains its existing control size');
 check(richCard.dates.getBoundingClientRect().top>=rich.textEl.getBoundingClientRect().bottom&&steps.host.getBoundingClientRect().top>=rich.textEl.getBoundingClientRect().bottom,'Metadata and Steps retain separate rows below title');
 steps.createRow({text:'Expanded step',completed:false});steps.update(true,0,1);await frame();check(centerDelta(rich)<0.6,'Expanded Steps preserve title/checkbox alignment');

 richCard.update({...richTask,nativeLocationDisplay:{workspaceName:'Knowledge',segments:['Folder']}});
 check(richCard.phase.parentElement===rich.source,'Folder transition restores inline phase metadata');
 phaseName='';richCard.update(richTask);check(!richCard.phase&&!rich.info.querySelector('.project-task-location'),'Removing phase leaves root location absent');richCard.destroy();rich.row.remove();
 task.nativeOwner=other;display={workspaceName:'Other project',segments:['Folder','Note.md']};card.update(task);
 check(text.textContent==='Other project / Folder / Note.md','Changed draft owner includes workspace name');
 task.nativeOwner=owner;display={workspaceName:'Knowledge',segments:['Physics','SI2215 Symmetries in Physics']};card.update(task);
 check(JSON.stringify(task)===before,'Presentation preserves task data');
 // Cover the independent route consumers through their current UI entry points.
 modules.set('ui/tasks.js', {exports: {createTaskRow}});
 obsidian.Notice = class {};
 await preload('ui/task-view-primitives.js');
 const fullHost = host.createDiv(), fullTask = {...task, nativeLocationDisplay: display};
 load('ui/task-view-primitives.js').source(fullHost, fullTask, {
  workspace: {projectId: 'p'},
  locationLabel: () => locationBreadcrumb(fullTask, {type: 'project', id: 'p'}).label
 });
 const fullLocation = fullHost.querySelector('.hub-full-location');
 check(fullLocation.disabled && fullLocation.title === locationBreadcrumb(fullTask).full, 'Full-view route retains disabled state and complete tooltip');
 check(fullLocation.querySelectorAll('.hub-route-separator').length === 2 && getComputedStyle(fullLocation).textOverflow === 'ellipsis', 'Full-view location uses compact chevrons within existing clipping');
 fullHost.remove();

 obsidian.Component = class {
  constructor() { this.stops = []; }
  register(stop) { this.stops.push(stop); }
  unload() { this.stops.splice(0).forEach(stop => stop()); }
 };
 obsidian.FuzzySuggestModal = Modal;
 await preload('ui/planning-editor.js');
 const phaseTask = {id: 'phase-task', text: 'Associated task', phaseId: 'phase', nativeReference: {taskRevision: 1}};
 const phaseBefore = JSON.stringify(phaseTask);
 const phaseService = {
  plugin: {
   app: {}, register() {},
   nativeTaskHost: {nativeTasks: {createPanelRead: () => ({
    read: async () => ({availability: 'current', tasks: [phaseTask]}), close() {}
   })}}
  },
  read: () => ({revision: 1, phases: [], milestones: []}), subscribe() {}
 };
 const phaseModal = load('ui/planning-editor.js').openPlanningEditor(phaseService, 'p', 'phases', {
  id: 'phase', name: 'Research', start: '2026-11-01', end: '2026-11-30'
 }, {});
 await phaseModal.ready;
 const phaseEntry = phaseModal.phaseRead.selected.get(phaseTask.id);
 check(phaseModal.contentEl.querySelector('.hub-task-help.hub-route').textContent === 'Source unavailable', 'Native Phase entries retain their existing path availability display');
 phaseEntry.path = 'Projects/P/A › B/Note.md';
 await phaseModal.refreshPhaseTasks();
 const phaseRoute = phaseModal.contentEl.querySelector('.hub-task-help.hub-route');
 check(phaseRoute.textContent === 'A › B › Note' && phaseRoute.querySelectorAll('.hub-route-separator').length === 1, 'Phase refresh renders structured legacy path segments');
 check(phaseRoute.querySelector('.hub-route-label').textContent === 'A › B', 'Phase segment punctuation is preserved');
 phaseEntry.path = 'Projects/P/Folder/Deep/Note.md';
 await phaseModal.refreshPhaseTasks();
 check(phaseRoute.querySelectorAll('.hub-route-separator').length === 2 && phaseModal.contentEl.querySelectorAll('.hub-phase-task-item').length === 1, 'Repeated Phase updates replace only route content');
 check(JSON.stringify(phaseTask) === phaseBefore, 'Phase presentation preserves native task references');
 phaseModal.close();

 await preload('services/context-search.js');
 await preload('ui/context-search.js');
 const workspace = {projectId: 'p', root: 'Projects/P', path: 'Projects/P/P.md', name: 'Research / Notes', contextKind: 'project'};
 const searchFile = {path: 'Projects/P/A › B/Note.md', name: 'Note.md', basename: 'Note', extension: 'md', parent: {path: 'Projects/P/A › B'}};
 const snapshotService = Object.create(load('services/context-search.js').ContextSearchService.prototype);
 snapshotService.plugin = {
  projectWizard: {getProjectRecords: () => [workspace]},
  app: {vault: {getAllLoadedFiles: () => [searchFile]}, metadataCache: {getFileCache: () => null}}
 };
 const result = snapshotService.fileSnapshot().files[0], resultBefore = JSON.stringify(result);
 check(JSON.stringify(result.contextSegments) === JSON.stringify(['Research / Notes', 'A › B']) && result.context === 'Research / Notes › A › B', 'Search snapshot supplies structured labels alongside its existing scoring text');
 let opened = null;
 const searchHost = host.createDiv(), toolbar = searchHost.createDiv(), component = new obsidian.Component();
 const search = load('ui/context-search.js').mountContextSearch({
  root: searchHost, toolbar, component,
  service: {
   subscribe() {},
   search: async () => [
    {kind: 'files', items: [result]},
    {kind: 'milestones', items: [{kind: 'milestones', title: 'Launch', context: '2026-11-30', path: workspace.path}]}
   ],
   open: async value => { opened = value; }
  }
 });
 search.input.focus();
 search.input.value = 'Note';
 search.input.dispatchEvent(new Event('input', {bubbles: true}));
 await new Promise(resolve => setTimeout(resolve, 150));
 await frame();
 const searchRoute = searchHost.querySelector('.hub-context-result-path');
 check(searchRoute.textContent === result.context && searchRoute.querySelectorAll('.hub-route-separator').length === 1, 'File search uses chevrons while preserving route text');
 check(searchHost.querySelectorAll('.hub-context-result-path')[1].textContent === '2026-11-30', 'Search keeps ordinary date metadata readable');
 search.input.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
 search.input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
 await frame();
 check(opened === result && JSON.stringify(result) === resultBefore, 'Search keyboard activation preserves the original result and path');
 component.unload();
 searchHost.remove();

 const legacyHost = host.createDiv();
 const renderHistory = new Function('item', 'projectRoot', 'current', 'isResourceContext', 'el', 'info', window.historyRouteSource);
 const dashboardElement = (parent, tag, cls, value) => parent.createEl(tag, {cls, text: value});
 window.hubSetIcon = obsidian.setIcon;
 for (const [record, expected] of [
  [{path: 'Projects/P/A › B/Note.md'}, ['A › B', 'Note']],
  [{path: 'Projects/P/', projectPath: 'Projects/P/P.md'}, ['Project Root']],
  [{path: 'Projects/P/P.md', projectPath: 'Projects/P/P.md'}, ['Project Hub']],
  [{path: 'Other/Note.md'}, ['Note']],
  [{nativeHistory: {}, projectName: 'Native / Project'}, ['Native / Project']]
 ]) {
  legacyHost.replaceChildren();
  const original = JSON.stringify(record);
  renderHistory(record, 'Projects/P', {file: {path: 'Projects/P/P.md'}}, false, dashboardElement, legacyHost);
  const labels = [...legacyHost.querySelectorAll('.hub-route-label')].map(label => label.textContent);
  check(JSON.stringify(labels) === JSON.stringify(expected), 'Completed history retains existing path branches and literal names');
  check(legacyHost.textContent === expected.join(' › ') && legacyHost.querySelectorAll('.hub-route-separator').length === expected.length - 1, 'Completed history displays decorative chevrons with accessible separators');
  check(JSON.stringify(record) === original, 'History presentation preserves its saved record');
 }
 legacyHost.remove();

 for (const zoom of [1, 1.25, 1.5]) {
  document.body.style.zoom = zoom;
  for (const color of ['rgb(120, 70, 160)', 'rgb(60, 130, 110)']) {
   parts.source.style.color = color;
   parts.source.style.opacity = '0.7';
   await frame();
   const svg = text.querySelector('.hub-route-separator svg');
   check(getComputedStyle(svg).color === color && getComputedStyle(svg).opacity === '1', 'Palette foreground and ancestor opacity compose once');
   check(Math.abs(svg.getBoundingClientRect().width / zoom - 10) < 0.1, 'Chevron dimensions track application zoom');
  }
 }
 document.body.style.zoom = '';
 parts.source.style.removeProperty('color');
 parts.source.style.removeProperty('opacity');
 const alignmentTask={text:'Workspace root task',steps:[],nativeReference:{owner},nativeLocationDisplay:{workspaceName:'Knowledge',segments:[]}};
 const alignmentParts=createTaskRow(host,alignmentTask);
 const alignmentCard=mountTaskCardPresentation(alignmentParts.row,alignmentParts.textEl,alignmentTask,()=>'',{description:false,dates:false,locationWorkspace:owner});
 window.alignmentPreview={parts:alignmentParts,card:alignmentCard,task:alignmentTask,delta:()=>centerDelta(alignmentParts)};
 window.preview={button,text,icon,get clicks(){return clicks},showRoot(){display={workspaceName:'Knowledge',segments:[]};card.update(task);},showPath(){display={workspaceName:'Knowledge',segments:['Physics','SI2215 Symmetries in Physics']};card.update(task);}};
 document.querySelector('#result').textContent='PASS '+checks;
 return {checks,width:innerWidth};
})().catch(error=>{document.querySelector('#result').textContent=error.stack;throw error});
