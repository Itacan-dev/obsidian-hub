"use strict";
const test = require('node:test'), assert = require('node:assert/strict');
const { HubInboxService } = require('../services/inbox');
const { captureIntent } = require('../domain/inbox');
const { createNativeTaskLocations } = require('../services/native-task-locations');
function fixture() {
    const files = new Map(), events = new Map(), operations = new Map(); let persisted = {}, fail = null, creates = 0, moves = 0;
    const emit = (name,...args) => { for (const ref of events.get(name) ?? []) ref.fn(...args); };
    const add = (path,text=null) => { const folder=text===null, parent=files.get(path.slice(0,path.lastIndexOf('/'))); const file={path,name:path.split('/').at(-1),...(folder?{children:[]}:{extension:path.split('.').at(-1),basename:path.split('/').at(-1).replace(/\.[^.]+$/,''),text,bytes:Buffer.from(text),stat:{size:Buffer.byteLength(text)}}),parent}; files.set(path,file);parent?.children.push(file);return file; };
    const vault = { getAbstractFileByPath:p=>files.get(p),getAllLoadedFiles:()=>[...files.values()],getMarkdownFiles:()=>[...files.values()].filter(f=>f.extension==='md'),
        on(name,fn){const ref={name,fn};if(!events.has(name))events.set(name,new Set());events.get(name).add(ref);return ref;},offref:r=>events.get(r.name)?.delete(r),
        async createFolder(p){const f=add(p);emit('create',f);return f;},async create(p,t){if(files.has(p))throw Error('Collision');const f=add(p,t);emit('create',f);return f;},
        async createBinary(p,b){return this.create(p,Buffer.from(b).toString());},async read(f){return f.text;},async readBinary(f){return f.bytes;},
        async process(f,fn){f.text=fn(f.text);f.bytes=Buffer.from(f.text);emit('modify',f);},
        async delete(f){files.delete(f.path);if(f.parent)f.parent.children=f.parent.children.filter(x=>x!==f);emit('delete',f);}
    };
    add('Projects');add('Projects/P');add('Projects/P/Nested');add('Projects/P/Nested/Note.md','Existing\r\n');add('Resources');add('Resources/E');add('Resources/E/E.md','# Resource');
    const project={projectId:'p',contextKind:'project',name:'Project',root:'Projects/P',path:'Projects/P/P.md',status:'active'};
    const resource={contextKind:'resource',resourceType:'references',id:'references',projectId:'resource:references',name:'Explorations',root:'Resources/E',path:'Resources/E/E.md'};
    const plugin={app:{vault,fileManager:{generateMarkdownLink:f=>'[['+f.path+']]',async renameFile(f,p){moves++;if(files.has(p))throw Error('Collision');const old=f.path;files.delete(old);if(f.parent)f.parent.children=f.parent.children.filter(x=>x!==f);f.path=p;f.parent=files.get(p.slice(0,p.lastIndexOf('/')));f.parent.children.push(f);files.set(p,f);emit('rename',f,old);}},workspace:{}},
        projectWizard:{data:{},getProjectRecords:()=>[project],getResourceTypes:()=>[resource],getContextForPath:p=>[project,resource].find(w=>p===w.root||p?.startsWith(w.root+'/'))},register(){},planning:{phases:()=>[]},oath:{canOpen:()=>true},
        dataStore:{async save(data){if(fail?.(data)){fail=null;throw Error('Synthetic disk failure');}persisted=JSON.parse(JSON.stringify(data));}}
    };
    const runtime={getOperation:async id=>operations.get(id),async createTask(values,id,taskId){creates++;operations.set(id,{taskId,values});}};
    plugin.nativeTaskHost={matches:()=>true,nativeTasks:{availabilityFor:()=> 'current'},runtime:()=>runtime,refreshInventory:async()=>{},status:()=>({owners:[{owner:{type:'project',id:'p'},state:'ready'},{owner:{type:'resource',id:'references'},state:'ready'}]})};
    let service=new HubInboxService(plugin);
    return {plugin,files,add,operations,runtime,get service(){return service;},get persisted(){return persisted;},get creates(){return creates;},get moves(){return moves;},failNext:predicate=>{fail=predicate??(()=>true);},restart(){service.destroy();plugin.projectWizard.data=JSON.parse(JSON.stringify(persisted));service=new HubInboxService(plugin);return service;}};
}
const destination={workspaceId:'p',folder:'Projects/P/Nested'};
const sourceFile=(name='file.pdf',text='bytes')=>({name,size:text.length,type:'application/pdf',arrayBuffer:async()=>Buffer.from(text)});

test('draft is private, preserves text/action values across restart, and rejects mixed input',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft({origin:'Quick Add'});await s.saveQuickDraft({text:'Title\nDescription'},d.id);
    await s.saveQuickAction(d.id,'task',{type:'task',taskTitle:'Edited',description:'Draft description',pendingStep:{text:'Unfinished',completed:true},nativeLocation:''});
    assert.equal(s.count,0);const next=f.restart().quickDraft();assert.equal(next.text,'Title\nDescription');assert.equal(next.actionDrafts.task.pendingStep.text,'Unfinished');
    await assert.rejects(f.service.saveQuickDraft({attachments:[{id:'a',path:'Resources/E/E.md',ownership:'reference'}]},next.id),/Write something or add a file/);
    assert.equal(f.service.quickDraft().text,next.text);
});
test('failed autosave retains latest memory; a later checkpoint persists it',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();f.failNext();await assert.rejects(s.saveQuickDraft({text:'Do not lose'},d.id),/disk failure/);assert.equal(s.quickDraft().text,'Do not lose');await s.flushQuickDraft();assert.equal(f.restart().quickDraft().text,'Do not lose');
});
test('queued stale autosaves cannot resurrect a cleared draft',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();const a=s.saveQuickDraft({text:'First'},d.id),b=s.saveQuickDraft({text:'Latest'},d.id);await Promise.all([a,b]);await s.clearQuickDraft(d.id);await assert.rejects(s.saveQuickDraft({text:'Stale'},d.id),/already/);assert.equal(f.restart().quickDraft().text,'');
});
test('Inbox promotion is atomic, idempotent and excludes subsequent draft edits',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await s.saveQuickDraft({text:'Captured'},d.id);f.failNext();await assert.rejects(s.sendQuickDraft(d.id),/disk failure/);assert.equal(s.count,0);assert.equal(s.quickDraft().text,'Captured');await s.sendQuickDraft(d.id);assert.equal(s.count,1);assert.equal(s.quickDraft().text,'');const next=s.quickDraft();await s.saveQuickDraft({text:'Next capture'},next.id);await s.sendQuickDraft(d.id);assert.equal(s.count,1);assert.equal(s.quickDraft().text,'Next capture');
});
test('attachments remain recoverable after draft metadata failure and restart',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();f.failNext(data=>data.inbox.quickAddDraft?.attachments?.some(ref=>f.files.has(ref.path)));await assert.rejects(s.stageQuickFiles([sourceFile()],d.id),/disk failure/);const ref=s.quickDraft().attachments[0];assert(f.files.has(ref.path));await s.flushQuickDraft();const restored=f.restart().quickDraft();assert.equal(restored.attachments[0].path,ref.path);await f.service.clearQuickDraft(restored.id);assert(!f.files.has(ref.path));
});
test('draft Clear never deletes referenced vault files or copies used by Inbox',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();const ref={id:'existing',path:'Resources/E/E.md',name:'E.md',ownership:'reference'};await s.saveQuickDraft({attachments:[ref]},d.id);await s.clearQuickDraft(d.id);assert(f.files.has(ref.path));const next=s.quickDraft();await s.stageQuickFiles([sourceFile()],next.id);const owned=s.quickDraft().attachments[0];await s.capture({attachments:[owned]});await s.clearQuickDraft(next.id);assert(f.files.has(owned.path));
});
test('ordinary file placement creates no companion note and resolves hidden draft',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft({workspaceName:'Source workspace'});await s.stageQuickFiles([sourceFile(),sourceFile()],d.id);const refs=s.quickDraft().attachments;await s.addFiles({...destination,attachments:refs,text:'',filesOnly:true},d.id);assert(f.files.has('Projects/P/Nested/file.pdf'));assert(f.files.has('Projects/P/Nested/file 2.pdf'));assert(![...f.files.keys()].some(p=>p.includes('Captured files')));assert.equal(s.count,0);assert.equal(s.quickDraft().attachments.length,0);
});
test('existing vault file is moved with original bytes and collisions numbered',async()=>{
    const f=fixture(),s=f.service;f.add('Resources/E/file.pdf','original');f.add('Projects/P/Nested/file.pdf','competing');const c=await s.capture({attachments:[{id:'a',name:'file.pdf',path:'Resources/E/file.pdf',ownership:'reference'}]});await s.addFiles({...destination,filesOnly:true},c.id);assert(!f.files.has('Resources/E/file.pdf'));assert.equal(f.files.get('Projects/P/Nested/file 2.pdf').text,'original');assert.equal(f.files.get('Projects/P/Nested/file.pdf').text,'competing');
});
test('new note uses capture source links and safely numbers filename collisions',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft({path:'Resources/E/E.md'});await s.saveQuickDraft({text:'Body'},d.id);f.add('Projects/P/Nested/Title.md','Other');const result=await s.createNote({...destination,title:'Title',text:'Body'},d.id);assert.equal(result.file.path,'Projects/P/Nested/Title 2.md');assert(result.file.text.includes('Body'));assert(result.file.text.includes('Resources/E/E.md'));assert.equal(s.quickDraft().text,'');
});
test('append cleanup failure replays original receipt without duplicate insertion',async()=>{
    const f=fixture(),s=f.service,c=await s.capture({text:'Captured'}),values={workspaceId:'p',text:'Captured',noteAction:'existing',noteLocation:{path:'Projects/P/Nested/Note.md',targetType:'note',position:'end'}};
    f.failNext(data=>data.inbox.captures.length===0);await assert.rejects(s.createNote(values,c.id),/disk failure/);assert.equal(s.get(c.id).operation.state,'ready');f.restart();await f.service.createNote(values,c.id);assert.equal(f.files.get(values.noteLocation.path).text,'Existing\r\n\r\nCaptured\r\n');assert.equal(f.service.count,0);
});
test('append retry refuses changed destination values and preserves capture',async()=>{
    const f=fixture(),s=f.service,c=await s.capture({text:'Captured'}),values={workspaceId:'p',text:'Captured',noteAction:'existing',noteLocation:{path:'Projects/P/Nested/Note.md',targetType:'note',position:'end'}};f.failNext(data=>data.inbox.captures.length===0);await assert.rejects(s.createNote(values,c.id));await assert.rejects(s.updateCapture(c.id,{...values,noteLocation:{...values.noteLocation,position:'start'}}),/original note/);assert(s.get(c.id));
});
test('native task cleanup failure retains operation/task IDs and exact retry',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await s.saveQuickDraft({text:'Title\nDescription'},d.id);const create=f.runtime.createTask;f.runtime.createTask=async(...args)=>{await create(...args);f.failNext();};const values={text:'Title\nDescription',taskTitle:'Title',description:'Description',workspaceId:'p',nativeLocation:'',steps:[]};await assert.rejects(s.makeTask(values,d.id),/disk failure/);const op=s.quickDraft().operation;assert(op.taskId);f.runtime.createTask=create;f.restart();await f.service.makeTask(values,d.id);assert.equal(f.creates,1);assert.equal(f.operations.get(op.requestKey.slice(10)).taskId,op.taskId);assert.equal(f.service.quickDraft().text,'');
});
test('explicit native workspace root overrides source-derived folder',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft({path:'Projects/P/Nested/Note.md'});await s.saveQuickDraft({text:'Root task'},d.id);await s.makeTask({text:'Root task',taskTitle:'Root task',workspaceId:'p',nativeLocation:'',steps:[]},d.id);assert.equal([...f.operations.values()][0].values.nativeLocation,'');
});
test('pending operation cannot be cleared and remains hidden',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await s.saveQuickDraft({text:'Title'},d.id);await s.replace({...s.quickDraft(),operation:{kind:'native-task',state:'reserved'}});await assert.rejects(s.clearQuickDraft(d.id),/saved action/);assert.equal(s.count,0);assert.equal(s.quickDraft().text,'Title');
});
test('legacy mixed/file-note captures retain title and content without migration',async()=>{
    const f=fixture(),ref={id:'a',path:'Resources/E/E.md',name:'E.md',ownership:'reference'};
    assert.equal(captureIntent({type:'note',title:'File note',noteAction:'new'},[ref]).title,'File note');
    f.plugin.projectWizard.data.inbox={version:1,captures:[{id:'legacy',createdAt:1,text:'Legacy text',attachments:[ref],custom:'preserve'}]};await f.service.createNote({...destination,title:'Legacy',type:'note',noteAction:'new',text:'Legacy text'},'legacy');assert(f.files.get('Projects/P/Nested/Legacy.md').text.includes('Legacy text'));assert(f.files.get('Projects/P/Nested/Legacy.md').text.includes('E.md'));
});
test('unsupported draft versions and invalid new filenames fail without writes',async()=>{
    const f=fixture();f.plugin.projectWizard.data.inbox={version:1,captures:[],quickAddDraft:{version:2,id:'future'}};assert.throws(()=>f.service.quickDraft(),/newer/);assert.equal(f.persisted.inbox,undefined);
    const {captureNoteTitle}=require('../domain/inbox');for(const name of ['CON','NUL.md','Bad.','Bad/Name'])assert.throws(()=>captureNoteTitle(name));
});
test('staging journals each path before copying and preserves interrupted import evidence',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();const create=f.plugin.app.vault.createBinary;
    f.plugin.app.vault.createBinary=async(path,bytes)=>{assert(f.persisted.inbox.quickAddDraft.attachments.some(ref=>ref.path===path));await create.call(f.plugin.app.vault,path,bytes);throw Error('Interrupted after copy');};
    await assert.rejects(s.stageQuickFiles([sourceFile()],d.id),/Interrupted/);const restored=f.restart().quickDraft();assert.equal(restored.attachments.length,1);assert(f.files.has(restored.attachments[0].path));
});
test('partial multi-file import retains successful bytes and removable missing reference',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await assert.rejects(s.stageQuickFiles([sourceFile('first.pdf'),{...sourceFile('second.pdf'),arrayBuffer:async()=>{throw Error('Read failed');}}],d.id),/Read failed/);const refs=f.restart().quickDraft().attachments;assert.equal(refs.length,2);assert(f.files.has(refs[0].path));assert(!f.files.has(refs[1].path));await f.service.removeQuickAttachment(d.id,refs[1].id);await f.service.sendQuickDraft(d.id);assert.equal(f.service.count,1);
});
test('failed Clear preserves file ownership and successful draft state',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await s.stageQuickFiles([sourceFile()],d.id);const ref=s.quickDraft().attachments[0];f.failNext();await assert.rejects(s.clearQuickDraft(d.id),/disk failure/);assert.equal(s.quickDraft().attachments[0].path,ref.path);assert(f.files.has(ref.path));
});
test('changed note after uncertain insertion retains source and refuses duplicate retry',async()=>{
    const f=fixture(),s=f.service,c=await s.capture({text:'Captured'}),values={workspaceId:'p',text:'Captured',noteAction:'existing',noteLocation:{path:'Projects/P/Nested/Note.md',targetType:'note',position:'end'}};f.failNext(data=>data.inbox.captures.length===0);await assert.rejects(s.createNote(values,c.id));const note=f.files.get(values.noteLocation.path);note.text+='External edit\r\n';await assert.rejects(s.createNote(values,c.id),/changed/);assert.equal((note.text.match(/Captured/g)??[]).length,1);assert(s.get(c.id));
});
test('moving an Inbox attachment updates the private draft reference in the same save',async()=>{
    const f=fixture(),s=f.service,ref={id:'a',path:'Resources/E/E.md',name:'E.md',ownership:'reference'},d=s.quickDraft();await s.saveQuickDraft({attachments:[ref]},d.id);const c=await s.capture({attachments:[ref]});await s.addFiles({...destination,filesOnly:true},c.id);assert.equal(s.quickDraft().attachments[0].path,'Projects/P/Nested/E.md');assert.equal(f.restart().quickDraft().attachments[0].path,'Projects/P/Nested/E.md');
});
test('Inbox transfer preserves an unfinished task action and original source text',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await s.saveQuickDraft({text:'Original\nBody'},d.id);await s.saveQuickAction(d.id,'task',{taskTitle:'Edited title',description:'Edited description',nativeLocation:'',workspaceId:'p',pendingStep:{text:'Pending',completed:false}});const c=await s.sendQuickDraft(d.id);assert.equal(c.text,'Original\nBody');assert.equal(c.intent.taskTitle,'Edited title');assert.equal(c.actionDrafts.task.pendingStep.text,'Pending');
});
test('shared note title helper derives safe defaults without loading retired forms',()=>{
    const {noteTitle}=require('../domain/inbox');assert.equal(noteTitle({text:'  A title: with/slashes\nBody'}),'A title with slashes');assert.equal(noteTitle({text:'',attachments:[{name:'example.pdf'}]}),'example');assert.equal(noteTitle({text:''}),'Untitled');
});
