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
    plugin.fileOperations={trash:p=>vault.delete(files.get(p)),captureMove:async(id,move,reverse)=>plugin.app.fileManager.renameFile(files.get(reverse?move.to:move.from),reverse?move.from:move.to)};
    const runtime={getOperation:async id=>operations.get(id),async createTask(values,id,taskId){creates++;operations.set(id,{taskId,values});}};
    plugin.nativeTaskHost={matches:()=>true,nativeTasks:{availabilityFor:()=> 'current'},runtime:()=>runtime,refreshInventory:async()=>{},status:()=>({owners:[{owner:{type:'project',id:'p'},state:'ready'},{owner:{type:'resource',id:'references'},state:'ready'}]})};
    let service=new HubInboxService(plugin);
    return {plugin,files,add,operations,runtime,get service(){return service;},get persisted(){return persisted;},get creates(){return creates;},get moves(){return moves;},failNext:predicate=>{fail=predicate??(()=>true);},restart(){service.destroy();plugin.projectWizard.data=JSON.parse(JSON.stringify(persisted));service=new HubInboxService(plugin);return service;}};
}
const destination={workspaceId:'p',folder:'Projects/P/Nested'};
const sourceFile=(name='file.pdf',text='bytes')=>({name,size:text.length,type:'application/pdf',arrayBuffer:async()=>Buffer.from(text)});

test('bulk naming uses one timestamp, parenthesized numbers, and skips existing filenames',()=>{
    const {allocateBulkTitles}=require('../domain/inbox-bulk'),date=new Date(2031,0,2,3,4),base='Inbox — 2031-01-02 03-04';
    const names=allocateBulkTitles([{},{}],'P',p=>[1,3].some(n=>p===`P/${base} (${n}).md`),date);
    assert.deepEqual(names,[base+' (2)',base+' (4)']);
});
test('bulk append preserves exact LF/CRLF captures and adds only external separators',()=>{
    const {appendCapturedTexts}=require('../domain/inbox-bulk'),a='\n  First\r\n\t  ',b='Second\n\n';
    assert.equal(appendCapturedTexts('',[a,b]),a+'\n\n'+b);
    assert.equal(appendCapturedTexts('Existing',[a,b]),'Existing\n\n'+a+'\n\n'+b);
    assert.equal(appendCapturedTexts('Existing\r\n',[a,b]),'Existing\r\n\r\n'+a+'\r\n\r\n'+b);
});
test('bulk notes are exact, unique, durable, and leave unrelated records and Quick Add unchanged',async()=>{
    const f=fixture(),s=f.service,a=await s.capture({text:'\n A  \r\n',source:{path:'Resources/E/E.md'}}),b=await s.capture({text:'B\n\n'}),other=await s.capture({text:'Other'});
    const d=s.quickDraft();await s.saveQuickDraft({text:'Private draft'},d.id);
    const batch=await s.prepareBulk('note',[b.id,a.id],destination);assert.equal(f.persisted.inbox.version,2);assert.equal(batch.members.length,2);
    const result=await f.restart().runBulk(batch.id);assert.equal(result.batch.state,'done');
    for(const member of result.batch.members){assert.equal(f.files.get(destination.folder+'/'+member.title+'.md').text,member.input.text);assert(member.receipt.note.verbatim);}
    assert.deepEqual(f.service.captures.map(c=>c.id),[other.id]);assert.equal(f.service.quickDraft().text,'Private draft');assert.equal(f.moves,0);
    await f.service.runBulk(batch.id);assert.equal([...f.files.keys()].filter(p=>p.includes('Inbox —')).length,2);
});
test('bulk tasks stop on failure, retain original order and IDs, and resume without duplicates',async()=>{
    const f=fixture(),s=f.service,a=await s.capture({text:'First\nComplete description'}),b=await s.capture({text:'Second'}),c=await s.capture({text:'Third'}),original=f.runtime.createTask;let attempts=0;
    f.runtime.createTask=async(...args)=>{if(++attempts===2)throw Error('Task failed');return original(...args);};
    const batch=await s.prepareBulk('task',[a.id,b.id,c.id],{workspaceId:'p',nativeLocation:''});
    await assert.rejects(s.runBulk(batch.id),/1 of 3 items completed; 2 remain/);assert(!s.get(a.id));assert(s.get(b.id)&&s.get(c.id));
    const op=s.get(b.id).operation;assert.equal(s.bulk.members[0].receipt.values.text,'First');assert.equal(s.bulk.members[0].receipt.values.description,'Complete description');assert.deepEqual(s.bulk.members[0].receipt.values.steps,[]);
    await f.restart().runBulk(batch.id);assert.equal(f.creates,3);assert(f.operations.has(op.requestKey.slice(10)));assert.equal(f.service.count,0);assert.deepEqual(f.service.bulk.members.map(m=>m.id),[a.id,b.id,c.id]);
});
test('bulk task cleanup failure retains original native command across restart',async()=>{
    const f=fixture(),s=f.service,a=await s.capture({text:'A'}),b=await s.capture({text:'B'}),batch=await s.prepareBulk('task',[a.id,b.id],{workspaceId:'p',nativeLocation:''});
    f.failNext(data=>data.inbox.bulk.members[0].state==='done');await assert.rejects(s.runBulk(batch.id));assert.equal(f.creates,1);assert(s.get(a.id));
    await f.restart().runBulk(batch.id);assert.equal(f.creates,2);assert.equal(f.service.count,0);
});
test('bulk file placement handles legacy groups and shared references once without companion notes',async()=>{
    const f=fixture(),s=f.service,refs=await s.stageFiles([sourceFile('A.pdf'),sourceFile('B.pdf')]),a=await s.capture({attachments:refs}),b=await s.capture({attachments:[refs[0]]}),batch=await s.prepareBulk('file',[a.id,b.id],destination);
    await s.runBulk(batch.id);assert.equal(f.moves,2);assert.equal(s.count,0);assert.equal(f.files.get(destination.folder+'/A.pdf').text,'bytes');assert(![...f.files.keys()].some(p=>p.includes('Captured files')));
});
test('bulk append writes all texts once and removes all sources in one metadata save after recovery',async()=>{
    const f=fixture(),s=f.service,a=await s.capture({text:'\n First  \r\n'}),b=await s.capture({text:'Second\n\n'}),dest={workspaceId:'p',noteLocation:{path:'Projects/P/Nested/Note.md',targetType:'note',position:'end'}},batch=await s.prepareBulk('text',[b.id,a.id],dest);
    f.failNext(data=>data.inbox.captures.length===0);await assert.rejects(s.runBulk(batch.id),/Text is already saved/);assert.equal(s.count,2);assert.equal(s.bulk.append.state,'ready');const expected='Existing\r\n\r\nSecond\n\n\r\n\r\n\n First  \r\n';assert.equal(f.files.get(dest.noteLocation.path).text,expected);
    await f.restart().runBulk(batch.id);assert.equal(f.files.get(dest.noteLocation.path).text,expected);assert.equal(f.service.count,0);assert.equal(f.service.bulk.state,'done');
});
test('bulk append retains sources for review after an uncertain write and an external edit',async()=>{
    const f=fixture(),s=f.service,a=await s.capture({text:'A'}),b=await s.capture({text:'B'}),dest={workspaceId:'p',noteLocation:{path:'Projects/P/Nested/Note.md',targetType:'note',position:'end'}},batch=await s.prepareBulk('text',[a.id,b.id],dest);
    f.failNext(data=>data.inbox.captures.length===0);await assert.rejects(s.runBulk(batch.id));f.files.get(dest.noteLocation.path).text+='User edit';
    await assert.rejects(f.restart().runBulk(batch.id),/changed/);assert.equal(f.service.count,2);assert.equal((f.files.get(dest.noteLocation.path).text.match(/A/g)??[]).length,1);
});
test('bulk preflight excludes mixed/pending items, rejects limits, and locks confirmed members',async()=>{
    const f=fixture(),s=f.service,a=await s.capture({text:'A'}),b=await s.capture({text:'B'});
    await s.prepareBulk('note',[a.id,b.id],destination);await assert.rejects(s.updateCapture(a.id,{text:'Edited'}),/retained batch/);await assert.rejects(s.delete(a.id),/retained batch/);await assert.rejects(s.makeTask({workspaceId:'p',taskTitle:'A'},a.id),/retained batch/);
    const g=fixture(),x=await g.service.capture({text:'x'.repeat(10001)}),y=await g.service.capture({text:'Y'});await assert.rejects(g.service.prepareBulk('task',[x.id,y.id],{workspaceId:'p',nativeLocation:''}),/limit/);assert.equal(g.service.bulk,null);assert.equal(g.creates,0);
});
test('failed bulk preparation writes nothing and reuses the retained submission identity',async()=>{
    const f=fixture(),s=f.service,a=await s.capture({text:'A'}),b=await s.capture({text:'B'}),id='retained-batch';f.failNext();
    await assert.rejects(s.prepareBulk('note',[a.id,b.id],destination,id));assert.equal(s.bulk,null);assert.equal(s.count,2);
    const batch=await s.prepareBulk('note',[a.id,b.id],destination,id);assert.equal(batch.id,id);assert.equal((await s.prepareBulk('note',[a.id,b.id],destination,id)).id,id);
    await assert.rejects(s.prepareBulk('note',[b.id,a.id],destination,id),/original/);
});
test('legacy completed receipts cannot be recruited into a new batch and recreated',async()=>{
    const {bulkEligibility}=require('../domain/inbox-bulk'),f=fixture(),s=f.service,a=await s.capture({text:'Already processed'}),b=await s.capture({text:'New'});
    await s.replace({...a,operation:{kind:'native-task',engine:'archived',state:'done',taskId:'original'}});assert(bulkEligibility(s.get(a.id)).reason);
    await assert.rejects(s.prepareBulk('task',[a.id,b.id],{workspaceId:'p',nativeLocation:''}),/retained operations/);assert.equal(s.bulk,null);assert.equal(s.count,2);
});
test('bulk file rollback stops later items and preserves grouped sources for retry',async()=>{
    const f=fixture(),s=f.service,refs=await s.stageFiles([sourceFile('A.pdf'),sourceFile('B.pdf'),sourceFile('C.pdf'),sourceFile('D.pdf')]),a=await s.capture({attachments:[refs[0]]}),b=await s.capture({attachments:refs.slice(1,3)}),c=await s.capture({attachments:[refs[3]]});
    const batch=await s.prepareBulk('file',[a.id,b.id,c.id],destination),rename=f.plugin.app.fileManager.renameFile;let fail=true;
    f.plugin.app.fileManager.renameFile=async(file,to)=>{if(fail&&file.name==='C.pdf'){fail=false;throw Error('Move failed');}return rename(file,to);};
    await assert.rejects(s.runBulk(batch.id),/1 of 3 items completed; 2 remain/);assert(!s.get(a.id)&&s.get(b.id)&&s.get(c.id));assert(f.files.has(refs[1].path)&&f.files.has(refs[2].path)&&f.files.has(refs[3].path));
    await f.restart().runBulk(batch.id);assert.equal(f.service.count,0);assert(['A','B','C','D'].every(n=>f.files.has(destination.folder+'/'+n+'.pdf')));
});
test('bulk note interruption after creation resumes the allocated path without numbering again',async()=>{
    const f=fixture(),s=f.service,a=await s.capture({text:'A'}),b=await s.capture({text:'B'}),batch=await s.prepareBulk('note',[a.id,b.id],destination),create=f.plugin.app.vault.create;let fail=true;
    f.plugin.app.vault.create=async(p,t)=>{const result=await create(p,t);if(fail){fail=false;throw Error('Lost note reply');}return result;};await assert.rejects(s.runBulk(batch.id),/Lost note reply/);assert.equal(s.count,2);
    await f.restart().runBulk(batch.id);assert.equal(f.service.count,0);assert.equal([...f.files.keys()].filter(p=>p.includes('Inbox —')).length,2);assert.equal(f.files.get(destination.folder+'/'+batch.members[0].title+'.md').text,'A');
});
test('competing bulk note names never overwrite a user file or silently change numbering',async()=>{
    const f=fixture(),s=f.service,a=await s.capture({text:'A'}),b=await s.capture({text:'B'}),batch=await s.prepareBulk('note',[a.id,b.id],destination),path=destination.folder+'/'+batch.members[0].title+'.md';f.add(path,'User file');
    await assert.rejects(s.runBulk(batch.id),/filename was taken/);assert.equal(f.files.get(path).text,'User file');assert.equal(s.count,2);assert(![...f.files.keys()].some(p=>/\(1\) 2\.md$/.test(p)));
});
test('bulk append safely reprepares a concurrent pre-write edit and preserves the destination prefix',async()=>{
    const f=fixture(),s=f.service,a=await s.capture({text:'A'}),b=await s.capture({text:'B'}),dest={workspaceId:'p',noteLocation:{path:'Projects/P/Nested/Note.md',targetType:'note',position:'end'}},batch=await s.prepareBulk('text',[a.id,b.id],dest),process=f.plugin.app.vault.process;let first=true;
    f.plugin.app.vault.process=async(file,fn)=>{if(first){first=false;file.text+='Concurrent\r\n';}return process(file,fn);};await s.runBulk(batch.id);assert.equal(f.files.get(dest.noteLocation.path).text,'Existing\r\nConcurrent\r\n\r\nA\r\n\r\nB');assert.equal(s.count,0);
});
test('bulk native tasks recover a lost SQLite creation reply after reopening the application',async t=>{
    const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
    const {TaskEngine}=require('../../../../../ItacanTaskCore/vnext/engine.cjs'),{createApplication}=require('../../../../../ItacanTaskCore/vnext/application.cjs');
    const f=fixture(),file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'itacan-bulk-sqlite-')),'tasks.sqlite'),owner={type:'project',id:'p'};
    f.plugin.projectWizard.getProjectRecords()[0].path='Projects/P/P.md';f.add('Projects/P/P.md','# P');let host;
    const open=async()=>{const engine=new TaskEngine(file);engine.ready=Promise.resolve(engine);host=createApplication({plugin:f.plugin,service:engine,authorityId:'2eab707f-1674-485f-ae7e-752c9286af65',locations:createNativeTaskLocations(f.plugin),openEditor:()=>{},openCreator:()=>{}});f.plugin.nativeTaskHost=host;await host.ready;return host;};
    t.after(async()=>{f.service.destroy();await host?.close();});await open();
    const controlId=randomUUID();await host.runtime(owner).createTask({text:'Existing control task',description:'Keep',nativeLocation:'',steps:[{text:'Existing Step',completed:false}],necessity:'must'},randomUUID(),controlId);
    const before=(await host.runtime(owner).list()).tasks.find(task=>task.id===controlId),a=await f.service.capture({text:'Bulk first\nFull description'}),b=await f.service.capture({text:'Bulk second'}),batch=await f.service.prepareBulk('task',[a.id,b.id],{workspaceId:'p',nativeLocation:''});
    const runtime=host.runtime(owner),create=runtime.createTask;runtime.createTask=async(...args)=>{await create(...args);throw Error('Lost SQLite reply');};
    await assert.rejects(f.service.runBulk(batch.id),/Lost SQLite reply/);const originalId=f.service.get(a.id).operation.taskId;await host.close();f.restart();await open();await f.service.runBulk(batch.id);
    const tasks=(await host.runtime(owner).list()).tasks;assert.equal(tasks.length,3);assert(tasks.some(task=>task.id===originalId&&task.text==='Bulk first'&&task.description==='Full description'));assert.deepEqual(tasks.find(task=>task.id===controlId),before);assert.equal(f.service.count,0);
});

test('multi-file promotion creates one independent capture per file in one atomic save',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft({origin:'Quick Add',workspaceName:'Source'});
    await s.stageQuickFiles([sourceFile('A.pdf'),sourceFile('B.pdf'),sourceFile('C.pdf')],d.id);
    const refs=s.quickDraft().attachments,save=f.plugin.dataStore.save;let writes=0;
    f.plugin.dataStore.save=async data=>{writes++;return save(data);};
    const result=await s.sendQuickDraft(d.id);
    assert.equal(writes,1);assert.equal(s.count,3);assert.equal(f.persisted.inbox.quickAddDraft,null);
    assert(result.captures.every(c=>c.attachments.length===1&&c.quickAddDraftId===d.id&&c.source.workspaceName==='Source'));
    assert.deepEqual(result.captures.map(c=>c.attachments[0]),refs);
    assert.equal(new Set(result.captures.map(c=>c.id)).size,3);
    const next=s.quickDraft();await s.saveQuickDraft({text:'Next draft'},next.id);
    const replay=await s.sendQuickDraft(d.id);assert.deepEqual(replay.captures.map(c=>c.id),result.captures.map(c=>c.id));assert.equal(s.count,3);assert.equal(s.quickDraft().text,'Next draft');
});
test('failed batch promotion preserves every file and retries the same capture identities after restart',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await s.stageQuickFiles([sourceFile('A.pdf'),sourceFile('B.pdf'),sourceFile('C.pdf')],d.id);
    const refs=s.quickDraft().attachments;let attemptedIds;
    f.failNext(data=>{attemptedIds=data.inbox.captures.map(c=>c.id);return true;});
    await assert.rejects(s.sendQuickDraft(d.id),/disk failure/);assert.equal(s.count,0);assert.deepEqual(s.quickDraft().attachments,refs);assert(refs.every(ref=>f.files.has(ref.path)));
    f.restart();const result=await f.service.sendQuickDraft(d.id);assert.deepEqual(result.captures.map(c=>c.id),attemptedIds);assert.equal(f.service.count,3);
    f.restart();await f.service.sendQuickDraft(d.id);assert.equal(f.service.count,3);
});
test('a missing file aborts the entire batch without clearing or partially promoting the draft',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await s.stageQuickFiles([sourceFile('A.pdf'),sourceFile('B.pdf'),sourceFile('C.pdf')],d.id);
    const refs=s.quickDraft().attachments;await f.plugin.app.vault.delete(f.files.get(refs[1].path));
    await assert.rejects(s.sendQuickDraft(d.id),/B.pdf/);assert.equal(s.count,0);assert.equal(s.quickDraft().attachments.length,3);assert(f.files.has(refs[0].path)&&f.files.has(refs[2].path));
});
test('promoted file items can be deleted and organized independently',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await s.stageQuickFiles([sourceFile('A.pdf'),sourceFile('B.pdf'),sourceFile('C.pdf')],d.id);
    const {captures}=await s.sendQuickDraft(d.id);await s.delete(captures[0].id);
    assert.equal(s.count,2);assert(!f.files.has(captures[0].attachments[0].path));assert(f.files.has(captures[1].attachments[0].path)&&f.files.has(captures[2].attachments[0].path));
    await s.addFiles({...destination,filesOnly:true},captures[1].id);assert.equal(s.count,1);assert(f.files.has('Projects/P/Nested/B.pdf'));assert.equal(s.captures[0].id,captures[2].id);
    await s.delete(captures[2].id);await assert.rejects(s.sendQuickDraft(d.id),/already/);assert.equal(s.count,0);
});
test('a lost batch acknowledgement clears only the matching stale draft',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await s.stageQuickFiles([sourceFile('A.pdf'),sourceFile('B.pdf')],d.id);
    const stale=s.quickDraft(),first=await s.sendQuickDraft(d.id);s.draftSession=stale;
    const replay=await s.sendQuickDraft(d.id);assert.deepEqual(replay.captures.map(c=>c.id),first.captures.map(c=>c.id));assert.equal(s.count,2);assert.notEqual(s.quickDraft().id,d.id);
});
test('pending multi-file placement is retained and retried before splitting into Inbox',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await s.stageQuickFiles([sourceFile('A.pdf'),sourceFile('B.pdf')],d.id);
    f.failNext(data=>data.inbox.quickAddDraft?.operation?.state==='ready');
    await assert.rejects(s.addFiles({...destination,filesOnly:true},d.id),/disk failure/);
    const operation=s.quickDraft().operation;assert.equal(operation.state,'prepared');
    await assert.rejects(s.sendQuickDraft(d.id),/Retry the saved file placement/);assert.equal(s.count,0);assert.equal(s.quickDraft().operation.id,operation.id);assert.equal(s.quickDraft().attachments.length,2);
    f.restart();await f.service.addFiles({...destination,filesOnly:true},d.id);assert(f.files.has('Projects/P/Nested/A.pdf')&&f.files.has('Projects/P/Nested/B.pdf'));assert.equal(f.service.quickDraft().attachments.length,0);
});
test('single-file pending placement still transfers its original recovery operation to Inbox',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();await s.stageQuickFiles([sourceFile('A.pdf')],d.id);
    f.failNext(data=>data.inbox.quickAddDraft?.operation?.state==='ready');await assert.rejects(s.addFiles({...destination,filesOnly:true},d.id));
    const operationId=s.quickDraft().operation.id,capture=await s.sendQuickDraft(d.id);assert.equal(capture.attachments.length,1);assert.equal(capture.operation.id,operationId);
    await s.addFiles({...destination,filesOnly:true},capture.id);assert.equal(s.count,0);assert(f.files.has('Projects/P/Nested/A.pdf'));
});
test('existing grouped and mixed Inbox records remain unchanged when a new file batch is promoted',async()=>{
    const f=fixture(),s=f.service;const legacyRefs=await s.stageFiles([sourceFile('OldA.pdf'),sourceFile('OldB.pdf')]);
    const old={id:'old-group',createdAt:1,text:'Legacy text',attachments:legacyRefs,custom:'preserve'};await s.save([old]);
    const d=s.quickDraft();await s.stageQuickFiles([sourceFile('NewA.pdf'),sourceFile('NewB.pdf')],d.id);await s.sendQuickDraft(d.id);
    assert.equal(s.count,3);assert.deepEqual(s.get(old.id),old);assert(s.captures.filter(c=>c.id!==old.id).every(c=>c.attachments.length===1));
});

test('consecutive file selections append unique attachments and retain them after restart',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft(),first=sourceFile('first.pdf'),second=sourceFile('second.pdf');
    await s.stageQuickFiles([first],d.id);const initial=s.quickDraft().attachments[0];
    await s.stageQuickFiles([first,second],d.id);assert.equal(s.quickDraft().attachments.length,2);assert.equal(s.quickDraft().attachments[0].id,initial.id);
    await s.stageQuickFiles([sourceFile('first.pdf')],d.id);assert.equal(s.quickDraft().attachments.length,2);
    const restored=f.restart().quickDraft();assert.equal(restored.attachments.length,2);assert(restored.attachments.every(ref=>f.service.attachmentExists(ref)));
    await f.service.removeQuickAttachment(d.id,initial.id);assert.equal(f.service.quickDraft().attachments.length,1);assert.equal(f.service.quickDraft().attachments[0].name,'second.pdf');
    const capture=await f.service.sendQuickDraft(d.id);assert.equal(capture.attachments.length,1);assert.equal(f.service.count,1);
});
test('deduplication preserves changed content and files from distinct original paths',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();
    await s.stageQuickFiles([{...sourceFile('same.pdf'),path:'C:\\External\\first\\same.pdf'}],d.id);
    await s.stageQuickFiles([{...sourceFile('same.pdf'),path:'C:\\External\\second\\same.pdf'}],d.id);
    assert.equal(s.quickDraft().attachments.length,2);
    await s.stageQuickFiles([{...sourceFile('same.pdf'),path:'c:/external/first/same.pdf'}],d.id);assert.equal(s.quickDraft().attachments.length,2);
    await s.stageQuickFiles([{...sourceFile('same.pdf','new bytes'),path:'C:\\External\\first\\same.pdf'}],d.id);assert.equal(s.quickDraft().attachments.length,3);
});
test('reselecting a vault file retains a single live reference',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft();f.plugin.app.vault.adapter={getBasePath:()=> 'C:\\FixtureVault'};
    const file={...sourceFile('E.md','# Resource'),path:'C:\\FixtureVault\\Resources\\E\\E.md'};
    await s.stageQuickFiles([file,file],d.id);await s.stageQuickFiles([file],d.id);
    assert.equal(s.quickDraft().attachments.length,1);assert.equal(s.quickDraft().attachments[0].ownership,'reference');
    await s.clearQuickDraft(d.id);assert(f.files.has('Resources/E/E.md'));
});

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
    const f=fixture(),s=f.service,d=s.quickDraft({workspaceName:'Source workspace'});await s.stageQuickFiles([sourceFile(),sourceFile('file.pdf','different bytes')],d.id);const refs=s.quickDraft().attachments;await s.addFiles({...destination,attachments:refs,text:'',filesOnly:true},d.id);assert(f.files.has('Projects/P/Nested/file.pdf'));assert(f.files.has('Projects/P/Nested/file 2.pdf'));assert(![...f.files.keys()].some(p=>p.includes('Captured files')));assert.equal(s.count,0);assert.equal(s.quickDraft().attachments.length,0);
});
test('existing vault file is moved with original bytes and collisions numbered',async()=>{
    const f=fixture(),s=f.service;f.add('Resources/E/file.pdf','original');f.add('Projects/P/Nested/file.pdf','competing');const c=await s.capture({attachments:[{id:'a',name:'file.pdf',path:'Resources/E/file.pdf',ownership:'reference'}]});await s.addFiles({...destination,filesOnly:true},c.id);assert(!f.files.has('Resources/E/file.pdf'));assert.equal(f.files.get('Projects/P/Nested/file 2.pdf').text,'original');assert.equal(f.files.get('Projects/P/Nested/file.pdf').text,'competing');
});
test('Quick Add note keeps its captured body and safely numbers filename collisions',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft({path:'Resources/E/E.md'});await s.saveQuickDraft({text:'Body'},d.id);f.add('Projects/P/Nested/Title.md','Other');const result=await s.createNote({...destination,title:'Title',text:'Body'},d.id);assert.equal(result.file.path,'Projects/P/Nested/Title 2.md');assert.equal(result.file.text,'Body');assert.equal(s.quickDraft().text,'');
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

test('Quick Add note titles use local calendar time and persist with the action draft',async()=>{
    const {quickNoteTitle}=require('../domain/inbox');
    assert.equal(quickNoteTitle(new Date(2031,0,2,3,4,59)),'Quick Add — 2031-01-02 03-04');
    assert.equal(quickNoteTitle(new Date(2031,11,31,23,59)),'Quick Add — 2031-12-31 23-59');
    const f=fixture(),s=f.service,d=s.quickDraft();await s.saveQuickDraft({text:'Original'},d.id);
    await s.saveQuickAction(d.id,'note',{...destination,title:quickNoteTitle(new Date(2031,0,2,3,4)),noteAction:'new'});
    assert.equal(f.restart().quickDraft().actionDrafts.note.title,'Quick Add — 2031-01-02 03-04');
});

test('Quick Add notes preserve exact text and safely number timestamp collisions',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft({origin:'Quick Add',path:'Projects/P/Nested/Note.md'}),text='\r\n  Original — 😀\r\n\tBody\t  \r\n\r\n',title='Quick Add — 2031-01-02 03-04';
    await s.saveQuickDraft({text},d.id);f.add(destination.folder+'/'+title+'.md','Existing');
    const result=await s.createNote({...destination,title,noteAction:'new'},d.id);
    assert.equal(result.file.path,destination.folder+'/'+title+' 2.md');assert.equal(result.file.text,text);
    assert.equal(f.files.get(destination.folder+'/'+title+'.md').text,'Existing');assert.notEqual(s.quickDraft().id,d.id);
});

test('verbatim Quick Add note cleanup retries reuse their persisted path and bytes after restart',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft(),text='\nExact content  \n',values={...destination,title:'Quick Add — 2031-01-02 03-04',noteAction:'new'};
    await s.saveQuickDraft({text},d.id);f.failNext(data=>data.inbox.quickAddDraft===null);
    await assert.rejects(s.createNote(values,d.id),/disk failure/);const operation=s.quickDraft().operation;
    assert.equal(operation.state,'ready');assert.equal(operation.note.verbatim,true);assert.equal(operation.note.text,text);
    const restored=f.restart();const result=await restored.createNote(values,d.id);assert.equal(result.file.path,operation.note.path);assert.equal(result.file.text,text);
    assert.equal([...f.files.keys()].filter(p=>p.includes('Quick Add —')).length,1);assert.notEqual(restored.quickDraft().id,d.id);
});

test('an interrupted verbatim note write retains the source and recovers without a duplicate',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft(),values={...destination,title:'Quick Add — 2031-01-02 03-04',noteAction:'new'},text='Original\n\n';
    await s.saveQuickDraft({text},d.id);const create=f.plugin.app.vault.create;
    f.plugin.app.vault.create=async(p,t)=>{await create(p,t);throw Error('Lost creation reply');};
    await assert.rejects(s.createNote(values,d.id),/Lost creation reply/);assert.equal(s.quickDraft().text,text);
    const saved=s.quickDraft().operation;assert.equal(f.files.get(saved.note.path).text,text);
    f.plugin.app.vault.create=create;const restored=f.restart();const result=await restored.createNote(values,d.id);
    assert.equal(result.file.path,saved.note.path);assert.equal(result.file.text,text);assert.equal([...f.files.keys()].filter(p=>p.includes('Quick Add —')).length,1);
});

test('changed verbatim note destinations are retained for review instead of overwritten or deleted',async()=>{
    const f=fixture(),s=f.service,d=s.quickDraft(),values={...destination,title:'Quick Add — 2031-01-02 03-04',noteAction:'new'};
    await s.saveQuickDraft({text:'Original'},d.id);const create=f.plugin.app.vault.create;
    f.plugin.app.vault.create=async(p,t)=>{const file=await create(p,t);file.text='User edit';throw Error('Interrupted');};
    await assert.rejects(s.createNote(values,d.id),/Interrupted/);const saved=s.quickDraft().operation;
    f.plugin.app.vault.create=create;const restored=f.restart();await assert.rejects(restored.createNote(values,d.id),/changed/);
    assert.equal(f.files.get(saved.note.path).text,'User edit');assert.equal(restored.quickDraft().id,d.id);
    await assert.rejects(restored.createNote({...values,folder:'Projects/P'},d.id),/retained/);assert.equal(f.files.get(saved.note.path).text,'User edit');
});

test('Inbox note creation keeps existing titles, attribution, and recovery markers',async()=>{
    const f=fixture(),s=f.service,c=await s.capture({text:'Body  ',source:{origin:'Quick Add',path:'Projects/P/Nested/Note.md'}});
    const result=await s.createNote({...destination,title:'My Inbox note',noteAction:'new'},c.id);
    assert.equal(result.file.path,destination.folder+'/My Inbox note.md');assert(result.file.text.includes('Source:'));assert(result.file.text.includes('<!-- itacan-capture:'));
});
