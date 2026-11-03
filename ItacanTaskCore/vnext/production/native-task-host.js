"use strict";
const path=require('node:path'),{createHash}=require('node:crypto');
const {createApplication,stableId}=require('../../../../../ItacanTaskCore/vnext/application.cjs');
const {connect}=require('../../../../../ItacanTaskCore/vnext/host/renderer.cjs');
function createNativeTaskHost(plugin){
 const remote=window.electron?.remote??require('@electron/remote'),ipcRenderer=require('electron').ipcRenderer;
 const vault=plugin.app.vault.adapter.getBasePath(),workspaceId=createHash('sha256').update(path.resolve(vault).toLowerCase()).digest('hex').slice(0,24);
 const file=path.join(process.env.LOCALAPPDATA,'Itacan/TaskCore',workspaceId,'tasks.sqlite');
 const mainEntry=path.join(vault,plugin.manifest.dir,'lib/sqlite-taskcore/host/main.cjs');
 const storage=window.localStorage,prefix='itacan-sqlite-pending:'+workspaceId+':';
 const pendingStore={put:c=>storage.setItem(prefix+c.operationId,JSON.stringify(c)),remove:id=>storage.removeItem(prefix+id),list:()=>Object.keys(storage).filter(k=>k.startsWith(prefix)).map(k=>JSON.parse(storage.getItem(k)))};
 const started=performance.now();let host;const service=connect({remote,ipcRenderer,mainEntry,file,syncOptions:{vault,authorityId:stableId(['itacan-sqlite-workspace',workspaceId])},onState:state=>host?.setState(state)});
 const locations=require('./native-task-locations').createNativeTaskLocations(plugin),ui=require('../ui/task-editor');
 const metadataReady=new Promise(resolve=>{const cache=plugin.app.metadataCache;if(cache.initialized){resolve();return;}let done=false;const finish=()=>{if(done)return;done=true;cache.offref(ref);resolve()};const ref=cache.on('resolved',finish);plugin.register(finish);if(cache.initialized)finish();});
 host=createApplication({plugin,service,authorityId:stableId(['itacan-sqlite-workspace',workspaceId]),locations,openEditor:ui.openTaskEditor,openCreator:ui.openTaskCreator,pendingStore,metadataReady});
 host.ready.then(()=>{host.startupMs=performance.now()-started;host.startupFromPluginMs=plugin.taskStartupClock===undefined?null:performance.now()-plugin.taskStartupClock},()=>{});
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
