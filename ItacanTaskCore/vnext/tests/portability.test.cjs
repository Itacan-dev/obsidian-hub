"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const path=require('node:path'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
const {workspaceIdentity,storageLocation}=require('../host/storage.cjs');
const {connect}=require('../host/renderer.cjs'),{openTaskService}=require('../host/electron.cjs');

test('Windows locations, identities and pending keys preserve the previous calculation',()=>{
 for(const vault of ['C:\\Users\\Jinhao\\OneDrive\\Work','D:\\Notes with spaces\\WORK']){
  const workspaceId=createHash('sha256').update(path.win32.resolve(vault).toLowerCase()).digest('hex').slice(0,24);
  const result=storageLocation(vault,{platform:'win32',env:{LOCALAPPDATA:'C:\\Users\\Jinhao\\AppData\\Local'}});
  assert.deepEqual(result,{workspaceId,file:path.win32.join('C:\\Users\\Jinhao\\AppData\\Local','Itacan/TaskCore',workspaceId,'tasks.sqlite'),pendingPrefix:'itacan-sqlite-pending:'+workspaceId+':'});
 }
});
test('Darwin storage needs no Windows environment and keeps case-sensitive vault identities',()=>{
 const options={platform:'darwin',env:{},home:'/Users/jinhao',canonicalize:value=>value};
 const location=storageLocation('/Users/jinhao/OneDrive/Work',options);
 assert.equal(location.file,'/Users/jinhao/Library/Application Support/Itacan/TaskCore/'+location.workspaceId+'/tasks.sqlite');
 assert.notEqual(workspaceIdentity('/Vault/Work','darwin'),workspaceIdentity('/Vault/work','darwin'));
 assert.throws(()=>storageLocation('/Vault',{...options,canonicalize:value=>value.includes('Application Support')?'/Vault/redirect/tasks.sqlite':value}),{code:'TASK_STORAGE_IN_VAULT'});
 assert.throws(()=>storageLocation('/Users/jinhao',options),{code:'TASK_STORAGE_IN_VAULT'});
});
function rendererFixture(overrides={}){
 const ipc=new EventEmitter(),diagnostics=[];let closes=0;
 ipc.invoke=async(_channel,message)=>{if(message.method==='versions')return{result:{node:'24.fake',sqlite:'3.fake'}};if(message.method==='close'){closes++;return{result:true}};return{result:'ok'}};
 const options={remote:{getCurrentWindow:()=>({id:1}),require:()=>({attach:()=>({channel:'tasks-test'})})},ipcRenderer:ipc,mainEntry:'fixture',file:'fixture',onDiagnostic:value=>diagnostics.push(value),...overrides};
 return{ipc,diagnostics,client:connect(options),closes:()=>closes};
}
test('renderer reports bridge, window and IPC capability failures and closes without a task backend',async()=>{
 for(const [overrides,code]of [[{remote:null},'TASK_BRIDGE_UNAVAILABLE'],[{ipcRenderer:{}},'TASK_IPC_UNAVAILABLE'],[{remote:{require(){},getCurrentWindow:()=>null}},'TASK_WINDOW_UNAVAILABLE']]){
  const f=rendererFixture(overrides);await assert.rejects(f.client.ready,{code});assert.equal(f.diagnostics.at(-1).error.code,code);await f.client.close();
 }
});
test('renderer readiness, diagnostics and cleanup retain sender-channel behavior',async()=>{
 const f=rendererFixture();await f.client.ready;assert.equal(f.client.versions.sqlite,'3.fake');
 f.ipc.emit('tasks-test',{}, {event:'diagnostic',diagnostic:{stage:'ready',versions:{sqlite:'3.fake'}}});
 assert.equal(f.diagnostics.at(-1).versions.sqlite,'3.fake');assert.equal(await f.client.listOwners(),'ok');
 await f.client.close();assert.equal(f.closes(),1);assert.equal(f.ipc.listenerCount('tasks-test'),0);
});
test('renderer startup failure releases its main-process channel',async()=>{
 const ipc=new EventEmitter();let closes=0;
 ipc.invoke=async(_channel,message)=>message.method==='close'?(closes++,{result:true}):{error:{code:'TASK_SQLITE_UNAVAILABLE',message:'No SQLite'}};
 const f=rendererFixture({ipcRenderer:ipc});await assert.rejects(f.client.ready,{code:'TASK_SQLITE_UNAVAILABLE'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(closes,1);assert.equal(ipc.listenerCount('tasks-test'),0);
});
function utilityFixture(startupTimeout=100){
 const child=new EventEmitter();child.stderr=new EventEmitter();let killed=0;
 child.kill=()=>{killed++;};child.postMessage=()=>{};
 const diagnostics=[],service=openTaskService({utilityProcess:{fork:()=>child},file:path.resolve('unused.sqlite'),startupTimeout,onDiagnostic:value=>diagnostics.push(value)});
 return{child,diagnostics,...service,killed:()=>killed};
}
test('utility capabilities and launch errors have actionable codes',()=>{
 assert.throws(()=>openTaskService({utilityProcess:null,file:'unused'}),{code:'TASK_UTILITY_UNAVAILABLE'});
 assert.throws(()=>openTaskService({utilityProcess:{fork(){throw Error('helper denied')}},file:'unused'}),{code:'TASK_UTILITY_LAUNCH_FAILED'});
});
test('utility handshake reports actual runtime and bounds stderr',async()=>{
 const f=utilityFixture();f.child.stderr.emit('data',Buffer.from('x'.repeat(3000)));
 f.child.emit('message',{event:'ready',versions:{node:'24.fake',sqlite:'3.fake'}});await f.client.ready;
 assert.equal(f.diagnostics.find(d=>d.stderr).stderr.length,2000);assert.equal(f.diagnostics.at(-1).versions.sqlite,'3.fake');
 f.child.emit('exit',0);
});
test('utility startup error and early exit preserve the specific failure',async()=>{
 const f=utilityFixture();f.child.emit('message',{event:'startup-error',versions:{node:'old'},error:{code:'TASK_SQLITE_UNAVAILABLE',message:'DatabaseSync unavailable'}});
 await assert.rejects(f.client.ready,{code:'TASK_SQLITE_UNAVAILABLE'});assert.equal(f.killed(),1);
 const g=utilityFixture();g.child.stderr.emit('data',Buffer.from('helper could not load'));g.child.emit('exit',7);
 await assert.rejects(g.client.ready,error=>error.code==='SERVICE_EXITED'&&/7.*helper could not load/.test(error.message));
 assert.equal(g.diagnostics.at(-1).exitCode,7);
});
test('utility timeout rejects readiness and stops only its own child',async()=>{
 const f=utilityFixture(10);await assert.rejects(f.client.ready,{code:'SERVICE_START_TIMEOUT'});assert.equal(f.killed(),1);
});
test('utility entry reports unavailable SQLite before loading engine or database',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../service.cjs'),'utf8');
 for(const sqlite of [null,{}]){
  const messages=[];let engineLoaded=false,exitCode;
  vm.runInNewContext(source,{require(name){if(name==='node:path')return path;if(name==='node:sqlite'){if(sqlite)return sqlite;throw Error('unknown builtin')}engineLoaded=true;throw Error('engine must not load')},process:{parentPort:{postMessage:value=>messages.push(value)},env:{},versions:{node:'fixture'},exit:code=>{exitCode=code}},setTimeout:fn=>fn()});
  assert.equal(engineLoaded,false);assert.equal(messages.at(-1).error.code,'TASK_SQLITE_UNAVAILABLE');assert.equal(exitCode,1);
 }
});
test('main host checks runtime readiness and utility support before creating a channel',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../host/main.cjs'),'utf8');
 for(const [ready,utility,code]of [[false,{},'TASK_MAIN_NOT_READY'],[true,null,'TASK_UTILITY_UNAVAILABLE']]){
  const module={exports:{}};
  vm.runInNewContext(source,{module,require(name){if(name==='electron')return{app:{on(){},isReady:()=>ready},utilityProcess:utility};if(name==='node:path')return path;return{};}});
  assert.throws(()=>module.exports.attach(1,'unused'),error=>error.code===code);
 }
});

test('plugin host remains available for diagnostics and retains pending commands when the bridge is missing',async t=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../../.obsidian/plugins/hub-project-menu/lib/services/native-task-host.js'),'utf8');
 const vault=path.resolve('unused-fixture-vault'),workspaceId=workspaceIdentity(vault),pending={operationId:'retained-operation',type:'task.create'};
 const storage={['itacan-sqlite-pending:'+workspaceId+':'+pending.operationId]:JSON.stringify(pending)};
 storage.setItem=(key,value)=>storage[key]=value;storage.getItem=key=>storage[key];storage.removeItem=key=>delete storage[key];
 const notices=[],commands=[],cleanups=[];t.mock.method(console,'error',()=>{});
 const plugin={manifest:{dir:'.obsidian/plugins/hub-project-menu'},projectWizard:{getProjectRecords:()=>[],getResourceTypes:()=>[]},
  app:{vault:{adapter:{getBasePath:()=>vault},on:()=>({})},metadataCache:{initialized:true,on:()=>({})},workspace:{on:()=>({})}},
  register:fn=>cleanups.push(fn),registerEvent(){},addCommand:command=>commands.push(command)};
 const module={exports:{}};
 vm.runInNewContext(source,{module,process,performance,window:{localStorage:storage},console,setTimeout,clearTimeout,require(name){
  if(name==='node:path')return path;
  if(name.endsWith('/application.cjs'))return require('../application.cjs');
  if(name.endsWith('/host/renderer.cjs'))return require('../host/renderer.cjs');
  if(name.endsWith('/host/storage.cjs'))return require('../host/storage.cjs');
  if(name==='./native-task-locations')return{createNativeTaskLocations:()=>({})};
  if(name==='../ui/task-editor')return{};
  if(name==='./task-sync')return{mountTaskSync(){}};
  if(name==='obsidian')return{Notice:class{constructor(message){notices.push(message)}}};
  throw Error('Missing fixture capability: '+name);
 }});
 const host=module.exports.createNativeTaskHost(plugin);await assert.rejects(host.ready,{code:'TASK_BRIDGE_UNAVAILABLE'});
 assert.equal(host.nativeTasks.availability(),'unavailable');assert.deepEqual(Array.from(host.pendingOperations(),p=>p.operationId),[pending.operationId]);
 assert.equal(notices.length,1);assert.equal(commands[0].id,'task-runtime-diagnostics');
 const snapshot=host.diagnostics();snapshot.error.code='changed';assert.equal(host.diagnostics().error.code,'TASK_BRIDGE_UNAVAILABLE');
 await host.close();for(const cleanup of cleanups)cleanup();
});
