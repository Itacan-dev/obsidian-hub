"use strict";
const {performance}=require("node:perf_hooks"),assert=require("node:assert/strict"),fs=require("node:fs");
const {fixture,original}=require("./statistics-read-fixture.cjs");
const {readStatistics,statisticsCompletions}=require("../services/statistics");
const {recordedHistoryQuery}=require("../services/task-history-legacy-read");
const {aggregateStatistics,RANGES}=require("../domain/statistics");
async function measure(work){const values=[];for(let i=0;i<7;i++){const start=performance.now();await work();values.push(performance.now()-start);}return +values.sort((a,b)=>a-b)[3].toFixed(3);}
(async()=>{const results=[];for(const count of[100,1000,5000]){
 const f=fixture(Math.max(0,count-36)),snapshot=await readStatistics(f.plugin,f.now),query=recordedHistoryQuery(f.records);
 const originalInput=await measure(()=>f.wizard.completedTaskHistory),facadeInput=await measure(()=>f.plugin.taskService.queryHistory({projection:"recorded"}));
 const normalization=await measure(()=>statisticsCompletions(query)),projection=await measure(()=>recordedHistoryQuery(f.records));
 const originalSnapshot=await measure(()=>original.readStatistics(f.plugin,f.now)),currentSnapshot=await measure(()=>readStatistics(f.plugin,f.now));
 const originalRange=await measure(()=>{for(const[r]of RANGES)aggregateStatistics(snapshot,r);}),workspace=await measure(()=>{for(const key of snapshot.registry.keys())aggregateStatistics(snapshot,"all",key);});
 const cache=new Map(RANGES.map(([r])=>[r,aggregateStatistics(snapshot,r)])),before={...f.counts};
 const cachedRange=await measure(()=>{for(const[r]of RANGES)cache.get(r);});assert.deepEqual(f.counts,before);
 const beforeReopen={...f.counts},reopen=await measure(()=>readStatistics(f.plugin,f.now));
 assert.equal(f.counts.history-beforeReopen.history,7);assert.equal(f.counts.notes-beforeReopen.notes,7);assert.equal(f.counts.reports-beforeReopen.reports,14);
 assert.equal(f.counts.index+f.counts.source+f.counts.writes,0);
 results.push({events:f.records.length,ms:{originalInput,facadeInput,projection,normalization,originalSnapshot,currentSnapshot,fiveRanges:originalRange,allWorkspaces:workspace,cachedFiveRanges:cachedRange,reopen},cachedQueries:0,reopenQueries:7,counts:f.counts});await f.close();
 }if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(results,null,2)+"\n");console.log(JSON.stringify(results,null,2));})().catch(error=>{console.error(error);process.exitCode=1;});
