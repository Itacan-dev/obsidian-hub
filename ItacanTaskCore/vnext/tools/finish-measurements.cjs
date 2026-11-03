"use strict";
// Sequential measurements: no seed/retention workload competes with a measured case.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const audit=path.resolve(process.argv[2]),root=path.resolve(__dirname,'..');
if(!audit.startsWith(path.join(process.env.LOCALAPPDATA,'Itacan/DevelopmentEvidence/TaskCoreVNext')+path.sep))throw Error('Private audit root required');
const log=value=>fs.appendFileSync(path.join(audit,'measurement-sequence.jsonl'),JSON.stringify({at:new Date().toISOString(),...value})+'\n');
function run(label,entry,args=[],extra={}){return new Promise((resolve,reject)=>{log({label,state:'start'});const out=fs.openSync(path.join(audit,label+'.log'),'a'),child=cp.spawn(process.execPath,[path.join(root,entry),...args],{cwd:path.resolve(root,'../..'),env:{...process.env,...extra},windowsHide:true,stdio:['ignore',out,out]});child.on('error',reject);child.once('exit',(code,signal)=>{fs.closeSync(out);log({label,state:'exit',code,signal});code===0?resolve():reject(Error(label+' failed: '+code));});});}
const electron=(label,entry,extra)=>run(label,'tools/run-electron.cjs',[audit,label,path.join(root,entry)],extra);
(async()=>{const retention=path.join(audit,'bench-vnext-large/retention-final.json');while(!fs.existsSync(retention)||JSON.parse(fs.readFileSync(retention)).at(-1)?.operations<1000000)await new Promise(r=>setTimeout(r,1000));
for(const tier of ['work','medium','large'])await run('final-warm-'+tier,'bench/existing.cjs',['vnext',path.join(audit,'bench-vnext-'+tier)]);
for(const tier of ['work','medium','large'])await electron('service-accepted-'+tier,'bench/service-main.cjs',{ITACAN_VNEXT_TIER:tier});
await electron('recovery-accepted','tests/recovery-main.cjs');
for(let i=1;i<=5;i++)await electron('ui-accepted-'+i,'tests/ui-main.cjs');
for(const tier of ['work','medium','large'])await run('old-'+tier,'bench/run.cjs',['old',tier,path.join(audit,'bench-old-'+tier)]);
log({state:'complete'});console.log('All sequential measurements complete');
})().catch(e=>{log({state:'failed',error:e.stack});console.error(e);process.exitCode=1});
