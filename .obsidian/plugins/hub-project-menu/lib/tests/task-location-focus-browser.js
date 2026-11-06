"use strict";
window.process={platform:'win32',env:{}};
window.testDone=(async()=>{
 let checks=0;const check=(v,message)=>{if(!v)throw Error(message);checks++;},frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 HTMLElement.prototype.createEl=function(tag,options={}){const e=document.createElement(tag);if(options.cls)e.className=options.cls;if(options.text!=null)e.textContent=options.text;for(const [k,v]of Object.entries(options.attr??{}))e.setAttribute(k,v);this.append(e);return e;};
 HTMLElement.prototype.createDiv=function(o={}){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o={}){return this.createEl('span',o)};HTMLElement.prototype.empty=function(){this.replaceChildren()};
 class Modal{constructor(app){this.app=app;this.containerEl=document.body.createDiv({cls:'modal-container'});this.modalEl=this.containerEl.createDiv({cls:'modal'});this.contentEl=this.modalEl.createDiv({cls:'modal-content'});this.closeButton=this.modalEl.createEl('button',{cls:'modal-close-button',text:'?',attr:{'aria-label':'Close'}});this.closeButton.onclick=()=>this.close();}open(){this.previousFocus=document.activeElement;this.onOpen();if(this.hasInitialInputFocus!==false)this.modalEl.querySelector('button:not(:disabled),[tabindex="0"]')?.focus();this.escape=e=>{if(e.key==='Escape'&&this===window.editor?.locationPicker){e.stopImmediatePropagation();this.close()}};document.addEventListener('keydown',this.escape)}close(){document.removeEventListener('keydown',this.escape);this.onClose();this.containerEl.remove();this.previousFocus?.focus({preventScroll:true})}}
 const icon=(e,name)=>{e.dataset.icon=name;e.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="5" width="16" height="14" rx="2"/></svg>'};
 const obsidian={Modal,setIcon:icon,getIcon:()=>true,addIcon(){}};
 const modules=new Map();async function preload(id){if(modules.has(id))return;const source=await(await fetch('../'+id)).text();modules.set(id,{source});for(const m of source.matchAll(/require\(["'](\.[^"']+)["']\)/g)){const target=new URL(m[1],new URL(id,location.origin+'/')).pathname.slice(1);await preload(target.endsWith('.js')?target:target+'.js')}}
 function load(id){const record=modules.get(id);if(record.exports)return record.exports;const module={exports:{}};record.exports=module.exports;new Function('require','module','exports',record.source)(request=>{if(request==='obsidian')return obsidian;const target=new URL(request,new URL(id,location.origin+'/')).pathname.slice(1);return load(target.endsWith('.js')?target:target+'.js')},module,module.exports);return record.exports=module.exports;}
 await preload('ui/task-location-picker.js');await preload('ui/workspace-thumbnail.js');
 const {openTaskLocationPicker}=load('ui/task-location-picker.js'),{mountWorkspaceThumbnail}=load('ui/workspace-thumbnail.js');
 const owners=[{type:'project',id:'p'},{type:'resource',id:'references'}],records=owners.map((owner,i)=>({owner,name:i?'Explorations':'Itacan',root:i?'Resources/E':'Projects/P',contextKind:owner.type,available:true,image:'cover.png',cover:'cover.png'}));
 const long='A very long workspace or folder title '.repeat(12);for(let i=0;i<75;i++)records.push({owner:{type:'project',id:'p'+i},name:i===0?long:'Project '+i,root:'Projects/P'+i,available:true});
 const key=o=>JSON.stringify(o),record=o=>records.find(w=>key(w.owner)===key(o)),tree=new Map(),refs=new Map();
 for(const w of records){tree.set(w.root,[{path:w.root+'/Meta',name:'Meta',type:'folder'},{path:w.root+'/README.md',name:'README.md',type:'note'}]);tree.set(w.root+'/Meta',[{path:w.root+'/Meta/Nested',name:'Nested',type:'folder'},...Array.from({length:30},(_,i)=>({path:w.root+'/Meta/'+(i===0?long:i===1?'ARCHITECTURE.md':'Note '+i+'.md'),name:i===0?long:i===1?'ARCHITECTURE.md':'Note '+i+'.md',type:'note'}))]);tree.set(w.root+'/Meta/Nested',[]);}
 const events=new Map(),app={vault:{on:(name,fn)=>{events.set(name,fn);return name},offref:name=>events.delete(name)}};
 const plugin={app:{vault:{getAbstractFileByPath:p=>p==='cover.png'?{path:p}:null,getResourcePath:()=> 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}},projectWizard:{getCategories:()=>[]}};
 const locations={workspace:record,workspaces:()=>records,mountThumbnail:(host,o)=>mountWorkspaceThumbnail(host,plugin,record(o)),describe:(o,r)=>({workspaceName:record(o).name,segments:r?r.id.slice(record(o).root.length+1).split('/'):[],available:true}),resolve:(o,r)=>{const w=record(o),p=r?.id??w.root;if(!r)return{path:w.root,type:'folder'};return [...tree.values()].flat().find(x=>x.path===p&&x.type===r.type)??null},select:(o,p,type)=>{if(type==='folder'&&!tree.has(p)||type==='note'&&![...tree.values()].flat().some(x=>x.path===p))throw Error('Unavailable');return{owner:o,path:p,type,reference:p===record(o).root?null:{id:p,type}}},browse:(o,p)=>{if(!tree.has(p))throw Error('Unavailable');return{rows:tree.get(p)}}};
 let accepted=null;const open=(reference=null,allowOwnerChange=true,taskTitle="")=>openTaskLocationPicker(app,{locations,owner:owners[0],reference,allowOwnerChange,taskTitle,onChoose:x=>accepted=x});

 // Exercise the real editor, location trigger presentation and picker. Only
 // unrelated task fields/persistence are replaced by a minimal form adapter.
 await preload('ui/task-card.js');
 const {createTaskRow,mountTaskCardPresentation}=load('ui/task-card.js');
 modules.set('ui/task-live-form.js',{exports:{mountLiveTaskForm({host,state,onLocation}){
  const input=host.createEl('input');input.value=state.text;
  const parts=createTaskRow(host,state);
  const presentation=mountTaskCardPresentation(parts.row,parts.textEl,state,()=>'',{
   description:false,dates:false,locationWorkspace:state.nativeOwner,locationAction:onLocation,
   nativeDisplay:()=>locations.describe(state.nativeOwner,state.nativeLocation?{id:state.nativeLocation,type:state.nativeLocationType}:null)
  });
  return{input,presentation,phase:{refresh(){},value:()=>({})},resizeTitle(){},closePopovers(){},refresh(){presentation.update(state)},destroy(){presentation.destroy()}};
 }}});
 await preload('ui/task-editor.js');
 const {openTaskCreator,openTaskEditor}=load('ui/task-editor.js');
 window.openEditor=async(mode,kind)=>{
  window.editor?.close();
  const reference=kind==='root'?null:{id:'Projects/P/Meta'+(kind==='note'?'/ARCHITECTURE.md':''),type:kind==='note'?'note':'folder'};
  const snapshot={text:'Focus regression',steps:[],nativeOwner:owners[0],nativeLocation:reference?.id??'',nativeLocationType:reference?.type};
  const service={app,nativeLocations:locations,formContext:()=>({nativeOwner:owners[0]}),read:async()=>snapshot};
  window.editor=mode==='Add'?openTaskCreator(service,snapshot):openTaskEditor(service,{});
  await editor.ready;return Boolean(editor.taskFields);
 };
 window.trigger=()=>editor.taskFields.presentation.sourceControl;
 return {ready:true};
})();
