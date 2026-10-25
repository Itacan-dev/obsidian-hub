"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const lib=path.resolve(__dirname,"../../../.obsidian/plugins/hub-project-menu/lib"),L=require(lib+"/domain/native-task-location"),{createNativeTaskLocations,locationService}=require(lib+"/services/native-task-locations");
function fixture(){
 const byPath=new Map(),listeners=new Map(),cleanups=[];let scans=0;
 const add=(path,folder=false)=>{if(byPath.has(path))return byPath.get(path);const file={path,name:path.split("/").at(-1),...(folder?{children:[]}:{extension:path.split(".").at(-1)})};byPath.set(path,file);const parent=path.slice(0,path.lastIndexOf("/"));if(parent&&parent!==path)add(parent,true).children.push(file);return file};
 const projects=[{projectId:"p",contextKind:"project",name:"Project",root:"Projects/P",path:"Projects/P/P.md",status:"active",resourceFolderIds:["mount"]},{projectId:"q",contextKind:"project",name:"Other",root:"Projects/Q",path:"Projects/Q/Q.md",status:"shelved"}],resource={contextKind:"resource",resourceType:"study",name:"Knowledge",root:"Resources/Knowledge",path:"Resources/Knowledge/Knowledge.md"};
 add(projects[0].root,true);add(projects[1].root,true);add(resource.root,true);for(const name of ['Alpha/Deep/Note.md','Alpha/Other.md','Empty/','Root.md','image.png'])add(projects[0].root+'/'+name.replace(/\/$/,''),name.endsWith('/'));add(resource.root+'/Mounted/Resource.md');
 const plugin={register:fn=>cleanups.push(fn),app:{vault:{getAbstractFileByPath:p=>byPath.get(p),getAllLoadedFiles(){throw Error("whole vault scan")},on(event,fn){const ref={event,fn};if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(ref);return ref},offref(ref){listeners.get(ref.event).delete(ref)}}},projectWizard:{getProjectRecords(){scans++;return projects},getResourceTypes:()=>[resource],getContextForPath(){throw Error("per-row ownership scan")}},nativeTaskHost:{matches:()=>true,status:()=>({owners:[...projects.map(p=>({owner:{type:'project',id:p.projectId},state:'ready'})),{owner:{type:'resource',id:'study'},state:'ready'}]})}};
 const port=createNativeTaskLocations(plugin),owner={type:'project',id:'p'};
 return{plugin,port,owner,projects,resource,add,byPath,scans:()=>scans,emit(event,file,old){for(const ref of listeners.get(event)??[])ref.fn(file,old)},close(){cleanups.reverse().forEach(fn=>fn())}};
}
test('portable references are owner-qualified and independent of local vault/workspace prefixes',()=>{
 const o={type:'project',id:'shared'};assert.deepEqual(L.locationReference(o,'Projects/A','Projects/A/Folder/Note.md','note'),L.locationReference(o,'Different/B','Different/B/Folder/Note.md','note'));assert.notDeepEqual(L.locationReference(o,'A','A/N.md','note'),L.locationReference({type:'project',id:'other'},'A','A/N.md','note'));assert.deepEqual(L.locationReference(o,'A','A/N.md','note'),L.locationReference({id:o.id,type:o.type},'A','A/N.md','note'));assert.equal(L.locationReference(o,'A','A','folder'),null);for(const bad of ['Elsewhere/N.md','A/../N.md','C:/A/N.md'])assert.throws(()=>L.locationReference(o,'A',bad,'note'));assert(!/[\\/]/.test(L.locationReference(o,'A','A/N.md','note').id));
});
test('browser lists only immediate folders/Markdown notes and does not rescan the vault or descendants per click',()=>{
 const f=fixture();try{const start=f.scans();const root=f.port.browse(f.owner);assert.deepEqual(root.rows.map(r=>r.name),['Alpha','Empty','Root.md']);assert.deepEqual(f.port.browse(f.owner,'Projects/P/Alpha').rows.map(r=>r.name),['Deep','Other.md']);assert.equal(f.port.browse(f.owner,'Projects/P/Empty').rows.length,0);assert.equal(f.scans()-start,1);assert(!root.rows.some(r=>r.path.includes('Resources')));assert.throws(()=>f.port.browse(f.owner,'Resources/Knowledge'));assert.throws(()=>f.port.select(f.owner,'Projects/P/image.png','note'));}finally{f.close()}
});
test('Resource mounts retain physical Resource ownership and legacy references remain resolvable',()=>{
 const f=fixture(),owner={type:'resource',id:'study'};try{const selection=f.port.select(owner,'Resources/Knowledge/Mounted/Resource.md','note');assert.equal(selection.owner.type,'resource');assert(!f.port.catalog(f.owner).some(r=>r.id===selection.reference.id));const refs=f.port.catalog(owner),legacy=refs.find(r=>r.id.startsWith('resource-location:')&&f.port.resolve(owner,r)?.path==='Resources/Knowledge/Mounted/Resource.md');assert(legacy);assert.equal(f.port.resolve(owner,legacy).path,selection.path);assert.equal(f.port.resolve(owner,null).path,'Resources/Knowledge');}finally{f.close()}
});
test('renamed/deleted destinations become unavailable without redirecting the reference to root',()=>{
 const f=fixture();try{const selected=f.port.select(f.owner,'Projects/P/Root.md','note'),file=f.byPath.get(selected.path);f.byPath.delete(file.path);const old=file.path;file.path='Projects/P/Renamed.md';file.name='Renamed.md';f.byPath.set(file.path,file);f.emit('rename',file,old);assert.equal(f.port.resolve(f.owner,selected.reference),null);assert.equal(f.port.describe(f.owner,selected.reference).available,false);assert(f.port.select(f.owner,file.path,'note').reference.id!==selected.reference.id);f.byPath.delete(file.path);f.byPath.get('Projects/P').children.splice(f.byPath.get('Projects/P').children.indexOf(file),1);f.emit('delete',file);assert.equal(f.port.describe(f.owner,selected.reference).available,false);}finally{f.close()}
});
test('card routes omit the current owner, retain outside owners, root labels and full hover routes',()=>{
 const owner={type:'resource',id:'study'},task={nativeReference:{owner},nativeLocationDisplay:{workspaceName:'Knowledge',available:true,segments:[]}};
 assert.equal(L.locationBreadcrumb(task,owner).label,'Workspace root');assert.equal(L.locationBreadcrumb(task).label,'Knowledge');
 for(const segments of [['One'],['One','Two'],['One','Two','Note.md'],['One','Two','Three','Note.md']]){task.nativeLocationDisplay.segments=segments;const same=L.locationBreadcrumb(task,owner),outside=L.locationBreadcrumb(task);assert.equal(same.label,segments.length<=3?segments.join(' / '):'One / \u2026 / Note.md');assert.equal(outside.label,["Knowledge",...segments].length<=3?["Knowledge",...segments].join(' / '):'Knowledge / \u2026 / '+segments.at(-1));assert.equal(outside.full,['Knowledge',...segments].join(' / '));assert(!same.label.startsWith('\u2026'));}
 task.nativeLocationDisplay.available=false;assert.equal(L.locationBreadcrumb(task,owner).label,'Location unavailable');
});
test('Add routes to a selected ready authority once, preserves uncertain request scope, and Edit rejects ownership changes',async()=>{
 const f=fixture(),owner=f.owner,other={type:'project',id:'q'},calls=[];
 const make=o=>({app:f.plugin.app,formContext:()=>({destination:{owner:o,authorityId:o.id}}),create:async(d,text,values)=>{calls.push({d,text,values});if(text==='uncertain')throw Error('uncertain');return'done'},save:async()=>{calls.push('saved')}}),a=make(owner),b=make(other);f.plugin.nativeTaskHost.runtime=()=>({formService:()=>b});
 try{const service=locationService(a,f.plugin,owner);assert.equal(await service.create({},'title',{nativeOwner:other,nativeLocation:'target'}),'done');assert.deepEqual(calls[0].d.owner,other);await assert.rejects(service.save({},{nativeOwner:other}),/Moving an existing task/);assert.equal(calls.length,1);const uncertain=locationService(a,f.plugin,owner);await assert.rejects(uncertain.create({},'uncertain',{}),/uncertain/);await assert.rejects(uncertain.create({},'retry',{nativeOwner:other}),/original creation request/);assert.equal(calls.length,2);}finally{f.close()}
});

test('long Unicode paths remain bounded opaque references and owner key ordering cannot fork a creation attempt',async()=>{
 const owner={type:'project',id:'p'},relative='Long '+String.fromCodePoint(0x03b1).repeat(200)+'/Note.md';assert.equal(L.locationReference(owner,'A','A/'+relative,'note').id.length,'workspace-location:v1:'.length+64);
 const f=fixture(),calls=[];try{const base={app:f.plugin.app,formContext:()=>({destination:{owner,authorityId:'a'}}),create:async()=>{calls.push('original');throw Error('uncertain')},save(){}};f.plugin.nativeTaskHost.runtime=()=>{throw Error('must reuse original service')};const service=locationService(base,f.plugin,owner);await assert.rejects(service.create({},'x',{nativeOwner:owner}),/uncertain/);await assert.rejects(service.create({},'x',{nativeOwner:{id:'p',type:'project'}}),/uncertain/);assert.equal(calls.length,2);}finally{f.close()}
});

test('Home Add keeps its Explorations default native, while explicit destinations and legacy owners retain their authority',()=>{
 const {nativeCreationOwner}=require(lib+'/services/native-task-locations'),project={projectId:'p'},resource={contextKind:'resource',resourceType:'study'},plugin={taskEditor:{context:p=>p==='resource'?resource:p==='project'?project:null,currentContext:()=>null},nativeTaskHost:{matches:o=>['p','study','references'].includes(o.id)}};
 assert.deepEqual(nativeCreationOwner(plugin),{type:'resource',id:'references'});assert.deepEqual(nativeCreationOwner(plugin,{location:'resource'}),{type:'resource',id:'study'});assert.deepEqual(nativeCreationOwner(plugin,{root:'project'}),{type:'project',id:'p'});assert.equal(nativeCreationOwner(plugin,{location:'missing'}),null);plugin.taskEditor.currentContext=()=>({projectId:'legacy'});assert.equal(nativeCreationOwner(plugin),null);
});
test('actual Project dashboard forwards complete Schedule owner context without defaults', () => {
    const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../../System/Dashboards/Project/view.js'), 'utf8');
    const start = source.indexOf('taskWorkspace = window.hubMountTaskWorkspace?.({');
    assert(start >= 0);
    const call = source.slice(start, source.indexOf('\n});', start) + 4);
    for (const status of ['active', 'future', 'shelved', undefined]) {
        const current = { file: { name: 'Project', path: 'Projects/Project/Project.md' }, status };
        let options;
        Function('window', 'current', `const dv={component:{}},root={},shortcutsBar={},grid={},folderStack={},left={},projectRoot='Projects/Project',contextId='owner',isResourceContext=false;let taskWorkspace;${call}`)({ hubMountTaskWorkspace(value) { options = value; } }, current);
        assert.equal(options.workspace.path, current.file.path);
        assert.equal(options.workspace.status, status);
        assert.equal(options.workspace.root, 'Projects/Project');
        assert.equal(options.workspace.projectId, 'owner');
    }
});
