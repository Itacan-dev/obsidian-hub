"use strict";
// Run measured operations after fixture construction, with no concurrent seed job.
const fs=require('node:fs'),path=require('node:path'),W=require('./workload.cjs');
const [kind,directory]=process.argv.slice(2),dir=path.resolve(directory);
if(!['old','vnext'].includes(kind)||!dir.startsWith(path.join(process.env.LOCALAPPDATA,'Itacan/DevelopmentEvidence/TaskCoreVNext')+path.sep))throw Error('Explicit private benchmark required');
(async()=>{const a=await W.adapter(kind,path.join(dir,kind==='vnext'?'tasks.sqlite':'repository'),false);try{const before=a.count(),warm=await W.warm(a,200,p=>fs.writeFileSync(path.join(dir,'final-warm-progress.json'),JSON.stringify(p)),Date.now()+30*60*1000);fs.writeFileSync(path.join(dir,'final-warm.json'),JSON.stringify({kind,versions:process.versions,operationsBefore:before,operationsAfter:a.count(),warm},null,2));console.log('PASS final warm '+kind+' '+dir);}finally{await a.close()}})().catch(e=>{console.error(e);process.exitCode=1});
