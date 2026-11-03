"use strict";
// Exact-version Electron utility process, complete IPC command boundary. No SQL in main.
const {app,utilityProcess}=require('electron'),fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks'),W=require('./workload.cjs'),{openTaskService}=require('../host/electron.cjs');
const root=process.env.ITACAN_VNEXT_RUN,audit=path.dirname(root),tier=process.env.ITACAN_VNEXT_TIER;
if(!['work','medium','large'].includes(tier))throw Error('Explicit existing tier required');
fs.mkdirSync(root,{recursive:true});app.setPath('userData',path.join(root,'profile'));
app.whenReady().then(async()=>{let service;try{const startups=[];let versions;
for(let i=0;i<5;i++){const start=performance.now();service=openTaskService({utilityProcess,file:path.join(audit,'bench-vnext-'+tier,'tasks.sqlite'),entry:path.join(audit,'package/service.cjs')});await service.client.ready;const ready=performance.now(),page=await service.client.listTasks({ownerId:W.ownerIds[0],limit:100});startups.push({readyMs:ready-start,firstPageMs:performance.now()-start,rows:page.tasks.length});versions=service.client.versions;if(i<4){const exit=new Promise(r=>service.child.once('exit',r));await service.client.close();await exit;}}
const c=service.client,a={execute:v=>c.execute(v),get:async id=>(await c.getTask(id)).task,list:ownerId=>c.listTasks({ownerId,limit:100}),history:()=>c.readHistory({limit:100}),statistics:()=>c.readStatistics(),count:()=>null};
const warm=await W.warm(a,200,p=>fs.writeFileSync(path.join(root,'progress.json'),JSON.stringify(p)),Date.now()+10*60*1000);
const start=performance.now(),exit=new Promise(r=>service.child.once('exit',r));await c.close();await exit;
fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({tier,versions,hostVersions:process.versions,startups,startup:W.stats(startups.map(x=>x.firstPageMs)),warm,closeMs:performance.now()-start},null,2));console.log('PASS utility IPC '+tier);app.quit();
}catch(e){fs.writeFileSync(path.join(root,'error.txt'),e.stack);try{await service?.client.close()}catch{}console.error(e);app.exit(1)}});
