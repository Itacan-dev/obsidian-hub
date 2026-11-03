"use strict";
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(process.argv[2]??'');if(!root.startsWith(path.join(process.env.LOCALAPPDATA,'Itacan/DevelopmentEvidence/TaskCoreVNext')+path.sep))throw Error('Owned completed UI run required');
const launch=JSON.parse(fs.readFileSync(path.join(root,'launch.json'))),prior=JSON.parse(fs.readFileSync(path.join(root,'ui.json')));assert(prior.pass);let client,verified=false;
const child=cp.spawn(launch.exe,['--user-data-dir='+launch.profile,'--remote-debugging-address=127.0.0.1','--remote-debugging-port='+launch.port],{windowsHide:true,stdio:['ignore','pipe','pipe'],cwd:root});let stderr='';child.stderr.on('data',b=>stderr+=b);child.stdout.on('data',()=>{});const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{try{
 for(let i=0;i<150;i++){try{client=await connect(launch.port);break}catch{}await delay(100)}assert(client);
 let current;for(let i=0;i<300;i++){current=await client.evaluate(`(()=>{const p=window.app?.plugins?.plugins?.['hub-project-menu'];return{vault:window.app?.vault?.adapter?.basePath,profile:window.electron?.remote?.app.getPath('userData'),state:p?.nativeTaskHost?.status()}})()`);if(current.state?.mode==='sqlite')break;await delay(100)}
 assert.equal(path.resolve(current.vault),path.resolve(launch.vault));assert.equal(path.resolve(current.profile),path.resolve(launch.profile));verified=true;
 const persisted=await client.evaluate(`(async()=>{const host=app.plugins.plugins['hub-project-menu'].nativeTaskHost;await host.ready;return{tasks:(await Promise.all(host.nativeTasks.owners.map(async owner=>(await host.runtime(owner).list()).tasks))).flat().map(t=>({id:t.id,revision:t.revision,completed:t.completed,stepIds:t.steps.map(s=>s.id)})).sort((a,b)=>a.id.localeCompare(b.id)),historyIds:(await host.completionFeed.read()).records.map(r=>r.id).sort()}})()`);
 assert.deepEqual(persisted,prior.persisted);await client.evaluate(`app.plugins.plugins['hub-project-menu'].nativeTaskHost.close().then(()=>true)`);
 const result={pass:true,pid:child.pid,persisted,checks:['genuine installed Obsidian application restart retains exact Task/Step identities, revisions, completion states and History events','production utility drains cleanly after restart']};fs.writeFileSync(path.join(root,'restart.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({pass:true,root,tasks:persisted.tasks.length,history:persisted.historyIds.length}));
 }catch(e){fs.writeFileSync(path.join(root,'restart-error.txt'),e.stack);console.error(e.stack);process.exitCode=1}
 finally{if(client){if(verified)try{await client.evaluate('window.close();true')}catch{}client.close()}fs.writeFileSync(path.join(root,'restart-process.json'),JSON.stringify({pid:child.pid,stderr},null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
