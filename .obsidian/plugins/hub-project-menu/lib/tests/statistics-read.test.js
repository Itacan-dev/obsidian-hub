"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {fixture,plain,aggregates,original}=require("./statistics-read-fixture.cjs");
const {readStatistics,statisticsCompletions}=require("../services/statistics");
const {recordedHistoryQuery}=require("../services/task-history-legacy-read");
const {aggregateStatistics,RANGES,seriesFor,prepareStatistics}=require("../domain/statistics");
const {historyRecords}=require("../services/task-history-read");
const sum=xs=>xs.reduce((a,b)=>a+b,0);
test("frozen original snapshot and every numerical range/workspace model match",async t=>{
 const f=fixture();t.after(()=>f.close());const baseline=require("./statistics-read-baseline.json"),before=JSON.stringify(f.wizard.data);
 const source=await readStatistics(f.plugin,f.now);
 assert.deepEqual(plain(source),baseline.snapshot);assert.deepEqual(aggregates(source),baseline.aggregates);
 assert.equal(JSON.stringify(f.wizard.data),before);assert.equal(f.counts.history,1);
 assert.deepEqual(f.counts,{...baseline.counts,history:1});assert.equal(f.counts.index+f.counts.source+f.counts.writes,0);
});
for(const stamp of["2026-03-29T12:00:00+02:00","2026-10-25T12:00:00+01:00","2026-01-01T00:00:00+01:00","2024-02-29T23:59:59+01:00","2026-05-31T12:00:00+02:00"])
test("exact local calendar/start/end/DST/month/leap range parity: "+stamp,async t=>{
 const f=fixture(30,Date.parse(stamp));t.after(()=>f.close());
 for(const[range]of RANGES){const model=aggregateStatistics(original.readStatistics(f.plugin,f.now),range);f.records.push(...[model.range.start-1,model.range.start,model.range.end-1,model.range.end,f.now,f.now+1].map((timestamp,i)=>({id:range+"-"+i,text:"Boundary",path:"Gone.md",timestamp,projectId:"private"})));}
 assert.deepEqual(aggregates(await readStatistics(f.plugin,f.now)),aggregates(original.readStatistics(f.plugin,f.now)));
});
for(const id of["private","itacan","hub","future","shelved","resource:study","resource:literature","resource:references","resource:inspiration","deleted","deleted-modern","deleted-null","deleted-empty",null])
test("historical attribution and legacy project fallback: "+id,async t=>{
 const f=fixture(20);t.after(()=>f.close());const a=await readStatistics(f.plugin,f.now),b=original.readStatistics(f.plugin,f.now);
 const matching=a.completions.filter(r=>r.projectId===id);assert.deepEqual(plain(matching),plain(b.completions.filter(r=>r.projectId===id)));
 assert.deepEqual([...a.registry],[...b.registry]);
 if(id==="deleted")assert.equal(a.registry.get("project:deleted").name,"Legacy deleted name");
 if(id==="private")assert.equal(a.registry.get("project:private").name,"Renamed private");
 if(id==="deleted-modern")assert.equal(a.registry.get("project:deleted-modern").name,"Modern name");
 if(id==="deleted-null")assert.equal(a.registry.get("project:deleted-null").name,"Null fallback");
 if(id==="deleted-empty")assert.equal(a.registry.get("project:deleted-empty").name,"");
});
test("first truthy ID wins before invalid timestamp filtering; ID-less/empty/null/zero and related task/Step events remain",async t=>{
 const f=fixture(0);t.after(()=>f.close());const source=await readStatistics(f.plugin,f.now);
 assert(!source.completions.some(r=>r.id==="duplicate"));
 for(const value of[undefined,null,"",0])assert.equal(source.completions.filter(r=>r.id===value).length,2);
 assert.equal(source.completions.filter(r=>r.id===17).length,1);assert.equal(source.completions.filter(r=>r.id==="17").length,1);
 assert.deepEqual(plain(source),plain(original.readStatistics(f.plugin,f.now)));
});
test("partial missing title/source evidence counts exactly while previous History UI still excludes invalid rows",()=>{
 const records=[{id:"old",timestamp:10,projectId:"p",project:"Old label"},{text:"Display",path:"Gone.md",timestamp:11}],query=recordedHistoryQuery(records);
 assert.equal(query.rows[0].state,"invalid");assert.equal(query.rows[0].fact,null);assert.deepEqual(query.rows[0].recorded,records[0]);
 assert.equal(historyRecords(query).length,1);
 assert.deepEqual(prepareStatistics({completions:statisticsCompletions(query)},20),prepareStatistics({completions:records},20));
});
test("projection preserves project null/absence/scalars without deriving identity or writing",()=>{
 const records=[{}, {project:null},{project:"Old"},{project:0}].map(r=>({text:"Event",path:"Gone.md",timestamp:10,...r}));
 const before=JSON.stringify(records),q=recordedHistoryQuery(records);assert.deepEqual(q.rows.map(r=>r.fact.recorded),records);
 q.rows[2].fact.recorded.project="Changed";assert.equal(JSON.stringify(records),before);
});
test("unsupported relevant evidence fails explicitly; malformed non-countable time can be isolated",()=>{
 assert.throws(()=>statisticsCompletions(recordedHistoryQuery([{text:"Bad ID",path:"Gone.md",id:{bad:true},timestamp:10}])),/interpret/);
 const records=[{text:"Bad time",path:"Gone.md",id:"x",timestamp:Infinity},{text:"Good",path:"Gone.md",timestamp:10}];
 assert.deepEqual(aggregates(prepareStatistics({completions:statisticsCompletions(recordedHistoryQuery(records))},20)),aggregates(prepareStatistics({completions:records},20)));
});
test("every non-task provider is read once per snapshot; ranges and cached models never scan",async t=>{
 const f=fixture();t.after(()=>f.close());const snapshot=await readStatistics(f.plugin,f.now),counts={...f.counts},cache=new Map();
 for(let repeat=0;repeat<3;repeat++)for(const[range]of RANGES)for(const workspace of["all",...snapshot.registry.keys()]){const key=range+workspace;if(!cache.has(key))cache.set(key,aggregateStatistics(snapshot,range,workspace));}
 assert.deepEqual(f.counts,counts);assert.equal(counts.history,1);assert.equal(counts.projects,1);assert.equal(counts.resources,1);assert.equal(counts.notes,1);assert.equal(counts.reports,2);
});
test("query failure rejects the whole snapshot, never returns zero-completion partial data or raw fallback",async t=>{
 const f=fixture();t.after(()=>f.close());f.plugin.taskService={queryHistory:async()=>{throw Error("Offline");}};
 await assert.rejects(readStatistics(f.plugin,f.now),/Offline/);assert.equal(f.counts.history,0);
});
test("one coherent opening snapshot freezes independent inputs across a deferred History query",async t=>{
 const f=fixture();t.after(()=>f.close());const expected=structuredClone(original.readStatistics(f.plugin,f.now)),query=await f.plugin.taskService.queryHistory({projection:"recorded"});
 let resolve;f.plugin.taskService={queryHistory:()=>new Promise(done=>{resolve=done;})};
 const pending=readStatistics(f.plugin,f.now);
 f.owners[0].name="Changed while loading";f.wizard.activityLog[0].timestamp=f.now+1000;f.reports[0].score=4;
 f.wizard.data.oathsByDevice.a.history[0].completedAt=f.now;f.wizard.data.oathsByDevice.a.history[0].workspace.name="Changed Oath label";
 f.records.push({id:"later",timestamp:f.now});resolve(query);
 assert.deepEqual(await pending,expected);
});
test("aggregation domain source is byte-identical to frozen original",()=>{
 assert.equal(fs.readFileSync(path.join(__dirname,"../domain/statistics.js"),"utf8"),fs.readFileSync(path.join(__dirname,"statistics-read-domain-original.cjs"),"utf8"));
});
test("Standard/Strict cross-device Oaths, invalid reports and all non-task models retain original semantics",async t=>{
 const f=fixture(30);t.after(()=>f.close());
 const oath=f.wizard.data.oathsByDevice.a.history[0];
 f.wizard.data.oathsByDevice.b.history.push({...oath,id:"strict",policy:{mode:"strict"},state:"broken"},{...oath,state:"broken"});
 f.reports.push({date:"2026-10-25",score:"4"},{date:"2026-02-30",score:4},{date:"2026-10-25",score:5});
 const a=await readStatistics(f.plugin,f.now),b=original.readStatistics(f.plugin,f.now);assert.deepEqual(a,b);assert.deepEqual(aggregates(a),aggregates(b));
 assert.equal(a.sessions.filter(s=>s.id==="synced").length,1);assert(a.sessions.some(s=>s.policy?.mode==="strict"));
});
test("reading remains independent of task/source changes and current physical owner",async t=>{
 const f=fixture();t.after(()=>f.close());const first=await readStatistics(f.plugin,f.now);
 f.plugin.taskData.readPages=()=>{throw Error("Forbidden");};f.plugin.app.vault.read=()=>{throw Error("Forbidden");};
 assert.deepEqual(await readStatistics(f.plugin,f.now),first);assert.equal(f.counts.source+f.counts.index+f.counts.writes,0);
 const model=aggregateStatistics(first,"all");assert(sum(seriesFor(model,"tasks","project"))>0);assert(sum(seriesFor(model,"steps","resource"))>0);
});
