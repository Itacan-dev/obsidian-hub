"use strict";
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const audit=path.resolve(process.argv[2]),root=path.resolve(__dirname,'..');if(!audit.startsWith(path.join(process.env.LOCALAPPDATA,'Itacan/DevelopmentEvidence/TaskCoreVNext')+path.sep))throw Error('Private audit root required');
const log=value=>fs.appendFileSync(path.join(audit,'final-sequence.jsonl'),JSON.stringify({at:new Date().toISOString(),...value})+'\n');
function run(label,args,env={}){return new Promise((resolve,reject)=>{log({label,state:'start'});const fd=fs.openSync(path.join(audit,label+'.log'),'w'),child=cp.spawn(process.execPath,args,{cwd:path.resolve(root,'../..'),env:{...process.env,...env},windowsHide:true,stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',code=>{fs.closeSync(fd);log({label,state:'exit',code});code===0?resolve():reject(Error(label+' failed'))});});}
const electron=(label,entry,env)=>run(label,[path.join(root,'tools/run-electron.cjs'),audit,label,path.join(root,entry)],env);
(async()=>{
while(!fs.existsSync(path.join(audit,'bench-old-scoped-large/result.json')))await new Promise(r=>setTimeout(r,1000));
await run('final-package',[path.join(root,'tools/package.cjs'),audit]);
await run('verified-tests',['--test',...['engine','process','presentation','outbox'].map(n=>path.join(root,'tests/'+n+'.test.cjs'))]);
for(const tier of ['work','medium','large'])await electron('service-verified-'+tier,'bench/service-main.cjs',{ITACAN_VNEXT_TIER:tier});
await electron('recovery-verified','tests/recovery-main.cjs');
for(let i=1;i<=5;i++)await electron('ui-verified-'+i,'tests/ui-main.cjs');
await electron('ui-verified-medium','tests/ui-main.cjs',{ITACAN_VNEXT_UI_TIER:'medium'});
for(const tier of ['work','medium','large'])for(let i=1;i<=5;i++)await run('old-startup-'+tier+'-'+i,[path.join(root,'bench/open.cjs'),'old',path.join(audit,'bench-old-scoped-'+tier,'repository')]);
await run('final-integrity',[path.join(root,'tools/verify-evidence.cjs'),audit]);
await run('final-report',[path.join(root,'tools/report.cjs'),audit]);
log({state:'complete'});console.log('Final verification and report complete');
})().catch(e=>{log({state:'failed',error:e.stack});console.error(e);process.exitCode=1});
