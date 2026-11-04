"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {TaskEngine}=require('../engine.cjs'),{createApplication}=require('../application.cjs');
const {createNativeTaskLocations}=require('../../../.obsidian/plugins/hub-project-menu/lib/services/native-task-locations');
async function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'itacan-location-defaults-'));let now=100;
 const service=new TaskEngine(path.join(directory,'tasks.sqlite'),{clock:()=>++now});service.ready=Promise.resolve(service);
 const project={projectId:'project',name:'Project',root:'Projects/P',path:'Projects/P/P.md',status:'active'},resource={contextKind:'resource',id:'references',resourceType:'references',name:'Explorations',root:'Resources/E',path:'Resources/E/E.md'};
 const files=new Map(),events=new Map(),folder=p=>{const f={path:p,name:p.split('/').at(-1),children:[]};files.set(p,f);return f;};
 for(const w of [project,resource]){const root=folder(w.root),nested=folder(w.root+'/Nested'),note={path:w.root+'/Nested/Note.md',name:'Note.md',extension:'md'};root.children.push(nested);nested.children.push(note);files.set(note.path,note);}
 const vault={getAbstractFileByPath:p=>files.get(p),on:(e,fn)=>{const ref={e,fn};if(!events.has(e))events.set(e,new Set());events.get(e).add(ref);return ref;},offref:ref=>events.get(ref.e).delete(ref)};
 const plugin={app:{vault,workspace:{getActiveFile:()=>null}},projectWizard:{getProjectRecords:()=>[project],getResourceTypes:()=>[resource],getContextForPath:p=>[project,resource].find(w=>p===w.root||p?.startsWith(w.root+'/'))},planning:{phases:()=>[]},register(){}};
 const locations=createNativeTaskLocations(plugin),creatorCalls=[],openCreator=(form,options)=>{const result={form,options};creatorCalls.push(result);return result;};
 const config={plugin,service,authorityId:'d444eb7e-f9a2-4a09-8d5e-0123456789ab',locations,openEditor(){},openCreator};let host=createApplication(config);plugin.nativeTaskHost=host;await host.ready;
 const owner={type:'project',id:'project'},other={type:'resource',id:'references'};
 const create=async(o,context=null,completed=false)=>{const form=host.runtime(o).formService();return (await form.create(form.formContext().destination,'Task',{text:'Task',nativeLocation:context?.id??'',completed})).result.task;};
 const remove=p=>{const f=files.get(p);files.delete(p);for(const x of files.values())if(x.children)x.children=x.children.filter(x=>x!==f);for(const ref of events.get('delete')??[])ref.fn(f);};
 const restart=async()=>{await host.close();const next=new TaskEngine(service.file,{clock:()=>++now});next.ready=Promise.resolve(next);host=createApplication({...config,service:next});plugin.nativeTaskHost=host;await host.ready;return host;};
 t.after(async()=>{await host.close();fs.rmSync(directory,{recursive:true,force:true});});
 return{plugin,locations,owner,other,create,remove,restart,get host(){return host},service,project,resource};
}
const location=(f,o,p,type)=>f.locations.select(o,p,type).reference;
test('Home selects latest created complete note context globally, including completed tasks',async t=>{
 const f=await fixture(t),ref=location(f,f.owner,'Projects/P/Nested/Note.md','note');await f.create(f.other);await f.create(f.owner,ref,true);
 const c=f.host.create();assert.deepEqual(await c.form.defaultCreationLocation(),{nativeOwner:f.owner,nativeLocation:ref.id,nativeLocationType:'note'});
});
test('workspace defaults remain scoped, and workspace root entry points retain recent context',async t=>{
 const f=await fixture(t),ref=location(f,f.owner,'Projects/P/Nested','folder');await f.create(f.owner,ref);await f.create(f.other);
 for(const options of [{owner:f.owner},{root:f.project.root}])assert.equal((await f.host.create(options).form.defaultCreationLocation()).nativeLocation,ref.id);
 f.plugin.workspaceModes={currentContext:()=>f.project};assert.equal((await f.host.create().form.defaultCreationLocation()).nativeLocation,ref.id);
});
test('empty Home falls back to Explorations, empty workspace to its root',async t=>{
 const f=await fixture(t);assert.deepEqual(await f.host.create().form.defaultCreationLocation(),{nativeOwner:f.other,nativeLocation:''});
 assert.deepEqual(await f.host.create({owner:f.owner}).form.defaultCreationLocation(),{nativeOwner:f.owner,nativeLocation:''});
});
test('invalid latest note or folder falls back immediately without trying an older valid task',async t=>{
 const f=await fixture(t);await f.create(f.other);const ref=location(f,f.owner,'Projects/P/Nested/Note.md','note');await f.create(f.owner,ref);f.remove('Projects/P/Nested/Note.md');
 assert.deepEqual(await f.host.create().form.defaultCreationLocation(),{nativeOwner:f.other,nativeLocation:''});
 assert.deepEqual(await f.host.create({owner:f.owner}).form.defaultCreationLocation(),{nativeOwner:f.owner,nativeLocation:''});
 const folder=location(f,f.owner,'Projects/P/Nested','folder');await f.create(f.owner,folder);f.remove('Projects/P/Nested');
 assert.equal((await f.host.create({owner:f.owner}).form.defaultCreationLocation()).nativeLocation,'');
});
test('editing, completion, rescheduling and moving older tasks preserve creation recency',async t=>{
 const f=await fixture(t),note=location(f,f.owner,'Projects/P/Nested/Note.md','note'),old=await f.create(f.owner),latest=await f.create(f.owner,note);
 let form=f.host.runtime(f.owner).formService(),snapshot=await form.read({id:old.id});await form.save(snapshot,{...snapshot,text:'Edited',completed:true,dueDate:'2026-11-12'});
 assert.equal((await f.host.create({owner:f.owner}).form.defaultCreationLocation()).nativeLocation,note.id);
 form=f.host.runtime(f.owner).formService();snapshot=await form.read({id:old.id});await form.save(snapshot,{...snapshot,nativeOwner:f.other,nativeLocation:''});
 assert.equal((await f.host.create().form.defaultCreationLocation()).nativeLocation,note.id);
 assert.equal((await f.service.getTask(latest.id)).task.createdAt,latest.createdAt);
});
test('persisted creation metadata resolves the same complete context after restart; edit reads original context',async t=>{
 const f=await fixture(t),folder=location(f,f.owner,'Projects/P/Nested','folder'),note=location(f,f.owner,'Projects/P/Nested/Note.md','note');const old=await f.create(f.owner,folder);await f.create(f.owner,note);await f.restart();
 assert.equal((await f.host.create().form.defaultCreationLocation()).nativeLocation,note.id);
 const snapshot=await f.host.runtime(f.owner).formService().read({id:old.id});assert.equal(snapshot.nativeLocation,folder.id);assert.equal(snapshot.nativeLocationType,'folder');
});
test('native location validation keeps roots, folder/note contexts and nested workspace ownership distinct',async t=>{
 const f=await fixture(t);assert.equal(f.locations.select(f.owner,'Projects/P','folder').reference,null);
 assert.throws(()=>f.locations.select(f.owner,'Resources/E','folder'));
 const note=location(f,f.owner,'Projects/P/Nested/Note.md','note');const task=await f.create(f.owner,note);assert.deepEqual(task.context,{kind:'note',reference:note.id});
});
test('pagination considers the whole native task collection and ties are stable',async t=>{
 const f=await fixture(t),ref=location(f,f.owner,'Projects/P/Nested','folder'),latest=await f.create(f.owner,ref),original=f.service.listTasks.bind(f.service);let pages=0;
 f.service.listTasks=async options=>{pages++;if(!options.afterId)return{tasks:[{...latest,id:'a',context:null}],next:'a'};return{tasks:[{...latest,id:'b'}],next:null}};
 assert.equal((await f.host.create().form.defaultCreationLocation()).nativeLocation,ref.id);assert.equal(pages,2);f.service.listTasks=original;
});

test('an unavailable latest workspace uses the Home fallback instead of an older valid location',async t=>{
 const f=await fixture(t),older=location(f,f.other,'Resources/E/Nested','folder');await f.create(f.other,older);await f.create(f.owner);f.project.status='archived';await f.host.refreshInventory();
 assert.deepEqual(await f.host.create().form.defaultCreationLocation(),{nativeOwner:f.other,nativeLocation:''});
});
