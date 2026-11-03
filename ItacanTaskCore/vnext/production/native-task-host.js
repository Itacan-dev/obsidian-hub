"use strict";
const path=require('node:path');
const {createApplication,stableId}=require('../../../../../ItacanTaskCore/vnext/application.cjs');
const {connect,unavailable}=require('../../../../../ItacanTaskCore/vnext/host/renderer.cjs');
const {storageLocation,workspaceIdentity}=require('../../../../../ItacanTaskCore/vnext/host/storage.cjs');
function createNativeTaskHost(plugin){
 const vault=plugin.app.vault.adapter.getBasePath(),workspaceId=workspaceIdentity(vault);
 const diagnostics={stage:'initializing',platform:process.platform,arch:process.arch,rendererVersions:{...process.versions},versions:null,error:null};
 const diagnostic=value=>{const {stage,versions,mainVersions,error,stderr,exitCode}=value;if(stage&&stage!=='utility-stderr')diagnostics.stage=stage;if(versions)diagnostics.versions={...versions};if(mainVersions)diagnostics.mainVersions={...mainVersions};if(error)diagnostics.error={code:error.code,message:String(error.message).slice(0,2000)};if(stderr)diagnostics.stderr=String(stderr).slice(-2000);if(exitCode!==undefined)diagnostics.exitCode=exitCode;};
 const mainEntry=path.join(vault,plugin.manifest.dir,'lib/sqlite-taskcore/host/main.cjs');
 const storage=window.localStorage,prefix='itacan-sqlite-pending:'+workspaceId+':';
 const pendingStore={put:c=>storage.setItem(prefix+c.operationId,JSON.stringify(c)),remove:id=>storage.removeItem(prefix+id),list:()=>Object.keys(storage).filter(k=>k.startsWith(prefix)).map(k=>JSON.parse(storage.getItem(k)))};
 const started=performance.now();let host,service;
 try{
  const {file}=storageLocation(vault);diagnostics.database=file;
  let remote=window.electron?.remote;
  if(!remote){try{remote=require('@electron/remote')}catch{throw Object.assign(Error('Obsidian does not expose the required main-process bridge.'),{code:'TASK_BRIDGE_UNAVAILABLE'});}}
  service=connect({remote,ipcRenderer:require('electron').ipcRenderer,mainEntry,file,syncOptions:{vault,authorityId:stableId(['itacan-sqlite-workspace',workspaceId])},onState:state=>host?.setState(state),onDiagnostic:diagnostic});
 }catch(error){diagnostic({stage:'failed',error:{code:error.code??'TASK_HOST_UNAVAILABLE',message:error.message}});service=unavailable(error);}
 const locations=require('./native-task-locations').createNativeTaskLocations(plugin),ui=require('../ui/task-editor');
 const metadataReady=new Promise(resolve=>{const cache=plugin.app.metadataCache;if(cache.initialized){resolve();return;}let done=false;const finish=()=>{if(done)return;done=true;cache.offref(ref);resolve()};const ref=cache.on('resolved',finish);plugin.register(finish);if(cache.initialized)finish();});
 host=createApplication({plugin,service,authorityId:stableId(['itacan-sqlite-workspace',workspaceId]),locations,openEditor:ui.openTaskEditor,openCreator:ui.openTaskCreator,pendingStore,metadataReady});
 host.diagnostics=()=>JSON.parse(JSON.stringify(diagnostics));
 host.ready.then(()=>{host.startupMs=performance.now()-started;host.startupFromPluginMs=plugin.taskStartupClock===undefined?null:performance.now()-plugin.taskStartupClock},error=>{
  diagnostic({stage:'failed',error:{code:error.code??'TASK_START_FAILED',message:error.message}});
  console.error('Itacan task startup failed',host.diagnostics(),error);
  new (require('obsidian').Notice)('Tasks could not start ('+(error.code??'TASK_START_FAILED')+'). '+error.message+' Run Task runtime diagnostics for details.',0);
 });
 plugin.addCommand({id:'task-runtime-diagnostics',name:'Task runtime diagnostics',callback:()=>{
  console.info('Itacan task runtime diagnostics',host.diagnostics());
  new (require('obsidian').Notice)('Task runtime: '+diagnostics.stage+(diagnostics.error?' — '+diagnostics.error.code+': '+diagnostics.error.message:'')+'. Details are in the developer console.',10000);
 }});
 host.pendingOperations=()=>pendingStore.list();host.retryPending=async()=>{for(const c of pendingStore.list()){await host.retryOriginal(c)}await host.refreshInventory();};
 let timer;const refresh=()=>{clearTimeout(timer);timer=setTimeout(()=>void host.refreshInventory().catch(console.error),50)};
 for(const event of ['create','delete','rename'])plugin.registerEvent(plugin.app.vault.on(event,refresh));
 plugin.registerEvent(plugin.app.metadataCache.on('changed',refresh));
 plugin.registerEvent(plugin.app.workspace.on('quit',tasks=>tasks.add(()=>host.close())));
 plugin.register(()=>{clearTimeout(timer);void host.close().catch(console.error)});
 require('./task-sync').mountTaskSync(plugin,host,service);
 return host;
}
// Product activation is one SQLite host; obsolete repository admission is retired.
async function authorizeNativeTaskActivation(){}
module.exports={createNativeTaskHost,authorizeNativeTaskActivation};
