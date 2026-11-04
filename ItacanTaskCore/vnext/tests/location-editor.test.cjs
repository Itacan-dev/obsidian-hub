"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){
 let calls=0,opened=0;const selections=[],notices=[];
 class Modal{constructor(){this.contentEl={empty(){}}}open(){opened++;}close(){this.closed=true;}}
 const module={exports:{}},code=fs.readFileSync(path.resolve(__dirname,'../../../.obsidian/plugins/hub-project-menu/lib/ui/task-editor.js'),'utf8');
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>id==='obsidian'?{Modal,Notice:class{constructor(message){notices.push(message)}}}:{},console});
 const owner={type:'project',id:'p'},service={app:{vault:{getAbstractFileByPath:p=>({path:p,...(!p.endsWith('.md')?{children:[]}:{})})}},nativeOwner:owner,context:()=>({root:'Projects/P'}),formContext:s=>({nativeOwner:owner,nativeLocation:s.nativeLocation??''}),nativeLocations:{select:(o,p,type)=>{selections.push({o,p,type});return{reference:{id:p,type}}}},defaultCreationLocation:async()=>{calls++;return{nativeOwner:owner,nativeLocation:'recent',nativeLocationType:'note'}}};
 return{...module.exports,service,selections,notices,get calls(){return calls},get opened(){return opened}};
}
test('new editor waits for the resolved default before any visible modal is opened',async()=>{
 const f=fixture();let release;f.service.defaultCreationLocation=()=>new Promise(r=>release=r);
 const modal=f.openTaskCreator(f.service);assert.equal(f.opened,0);assert.equal(modal.snapshot,undefined);
 release({nativeOwner:f.service.nativeOwner,nativeLocation:'correct',nativeLocationType:'note'});await modal.ready;
 assert.equal(f.opened,1);assert.equal(modal.snapshot.nativeLocation,'correct');
});
test('workspace root scopes creation defaults while explicit notes and folders bypass them',async()=>{
 const f=fixture(),scoped=f.openTaskCreator(f.service,{root:'Projects/P'});await scoped.ready;assert.equal(f.calls,1);assert.equal(scoped.snapshot.nativeLocation,'recent');
 for(const options of [{location:'Projects/P/N/Note.md'},{path:'Projects/P/N'},{root:'Projects/P/N'},{location:'Projects/P'}]){
  const modal=f.openTaskCreator(f.service,options);await modal.ready;assert.equal(f.calls,1);assert.equal(modal.snapshot.nativeLocation,Object.values(options)[0]);
 }
 assert.deepEqual(f.selections.map(s=>s.type),['note','folder','folder','folder']);
});
test('explicit native root or note selection is never replaced by recent-task defaults',async()=>{
 const f=fixture();for(const nativeLocation of ['', 'explicit']){const modal=f.openTaskCreator(f.service,{nativeLocation});await modal.ready;assert.equal(modal.snapshot.nativeLocation,nativeLocation);}assert.equal(f.calls,0);
});
test('editing uses the original snapshot even when newer tasks exist',async()=>{
 const f=fixture();f.service.read=async()=>({text:'Original',steps:[],nativeLocation:'original',nativeLocationType:'folder'});
 const modal=f.openTaskEditor(f.service,{id:'old'});await modal.ready;assert.equal(modal.snapshot.nativeLocation,'original');assert.equal(f.calls,0);
});
test('failure resolving defaults leaves no transient editor with the wrong location',async()=>{
 const f=fixture();f.service.defaultCreationLocation=async()=>{throw Error('Unavailable')};const modal=f.openTaskCreator(f.service);assert.equal(await modal.ready,null);assert.equal(f.opened,0);assert.equal(f.notices[0],'Unavailable');
});
