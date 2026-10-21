"use strict";
const fs=require("node:fs"),{performance}=require("node:perf_hooks"),assert=require("node:assert/strict");
const {fixture,commit,bridge}=require("./oath-committed-fixture.cjs");
const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
function workload(size,count,original){const f=fixture({original});
 for(let note=0;note<5;note++){let text="";for(let i=note*10;i<note*10+10;i++)text+=`- [${i%4===0?"x":" "}] Benchmark ${i} <!-- hub-task:bench-${i} -->\n    - [x] Step ${i}\n        - [ ] Nested ${i}\n`;f.add(`Projects/Private/Bench-${note}.md`,text);}
 const current=f.oath.tasks().length;for(let i=current;i<size;i++){const owner=f.owners.filter(o=>o.projectId!=="deleted")[i%9];f.add(owner.root+`/Fill-${i}.md`,`- [ ] Global ${i} <!-- hub-task:global-${i} -->\n${i%3===0?"    - [ ] A Step\n":""}`);}
 f.move(f.files.get("Projects/Private/Bench-4.md"),"Projects/Private/Nested/Moved-Bench.md");
 f.add("Outside/Benchmark-Copy.md","- [ ] Copied benchmark <!-- hub-task:bench-8 -->\n");
 const ids=Array.from({length:count},(_,i)=>i===count-1&&count>1?"missing-benchmark":"bench-"+i);commit(f,ids);
 let owners=0;const lookup=f.wizard.getProjectById;f.wizard.getProjectById=(...args)=>{owners++;return lookup(...args);};
 return{f,get owners(){return owners;}};
}
async function sample(w,work){global.gc?.();const before={...w.f.counts},owners=w.owners,start=performance.now();await work();return{ms:performance.now()-start,scans:w.f.counts.queries-before.queries,sources:w.f.counts.sources-before.sources,owners:w.owners-owners};}
async function measure(size,count,original){const w=workload(size,count,original),{f}=w;try{
 const cold=await sample(w,()=>f.oath.resolveWork()),repeated=[],invalidated=[];
 for(let i=0;i<7;i++){repeated.push(await sample(w,()=>f.oath.resolveWork()));const p="Projects/Private/Bench-0.md";f.contents.set(p,f.contents.get(p).replace(/Benchmark 0(?: revised)?/,i%2?"Benchmark 0":"Benchmark 0 revised"));f.index(f.files.get(p));invalidated.push(await sample(w,()=>f.oath.refresh()));}
 const before={...f.counts};for(let i=0;i<100;i++){f.oath.tickDisplay();await f.oath.refresh(false);}assert.deepEqual(f.counts,before,"Countdown reads zero");
 const coldSamples=[],startupSamples=[];
 for(let i=0;i<7;i++){
  const fresh=workload(size,count,original);try{coldSamples.push(await sample(fresh,()=>fresh.f.oath.resolveWork()));}finally{await fresh.f.close();}
  const startup=workload(size,count,original);try{startupSamples.push(await sample(startup,()=>startup.f.oath.start()));}finally{await startup.f.close();}
 }
 return{globalParents:f.oath.tasks().length,commitments:count,cold,coldMedianMs:median(coldSamples.map(s=>s.ms)),repeatedFreshMedianMs:median(repeated.map(s=>s.ms)),invalidatedMedianMs:median(invalidated.map(s=>s.ms)),perBatch:repeated[0],startupMedianMs:median(startupSamples.map(s=>s.ms)),startup:startupSamples[0],countdownAdditionalScans:0,countdownAdditionalSourceReads:0,identityPasses:original?1:2};
 }finally{await f.close();}}
async function delayed(original,preexisting){const times=[];let scans=0,sources=0;for(let i=0;i<7;i++){const f=fixture({original});try{const b=await bridge(f,{preexisting}),before={...f.counts},start=performance.now();await f.oath.resolveWork();times.push(performance.now()-start);assert(f.oath.work[0].task);scans=f.counts.queries-before.queries;sources=f.counts.sources-before.sources;b.import();await f.oath.resolveWork();assert.equal(f.oath.awaitingIndex.size,0);}finally{await f.close();}}return{medianMs:median(times),scans,sources};}
(async()=>{const rows=[];for(const size of[100,1000,5000])for(const count of[1,10,50]){const original=await measure(size,count,true),current=await measure(size,count,false);rows.push({size,count,original,current});console.log(JSON.stringify({size,count,originalMs:original.repeatedFreshMedianMs,currentMs:current.repeatedFreshMedianMs,sourceReads:current.perBatch.sources}));}const bridges=[];for(const preexisting of[false,true])bridges.push({preexisting,original:await delayed(true,preexisting),current:await delayed(false,preexisting)});const output={environment:{node:process.versions.node,platform:process.platform,timeZone:process.env.TZ,samples:7,description:"Synthetic Node Maps; not live Obsidian latency. Repeated reads are fresh for both implementations, not cached. One TaskData global identity pass plus one dedicated parent/Step lookup pass for current."},rows,bridges};if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(output,null,2)+"\n");console.log("PASS nine workload/commitment combinations; both delayed histories; countdown scans/reads zero.");})().catch(e=>{console.error(e);process.exitCode=1;});
