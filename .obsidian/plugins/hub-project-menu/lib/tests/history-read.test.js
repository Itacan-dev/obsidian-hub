"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createHistoryFixture,originalItems}=require("./history-read-fixture.cjs");
const {historyRecords,createTaskHistoryRead}=require("../services/task-history-read");
const {recordedHistoryQuery}=require("../services/task-history-legacy-read");
const clean=records=>records.map(({historyReadKey,...record})=>record);
function consumer(f){const cleanup=[],reader=createTaskHistoryRead({plugin:f.plugin,component:{register:fn=>cleanup.push(fn)}});return{reader,close:()=>cleanup.forEach(fn=>fn())};}
for(const scope of["projects","resources"])test("actual original Home recorded History parity: "+scope,async t=>{
    const f=createHistoryFixture();t.after(()=>f.close());const before=JSON.stringify(f.snapshot());
    const query=await f.service.queryHistory({projection:"recorded"}),records=clean(historyRecords(query));
    assert.deepEqual(originalItems(records,"home",scope),require("./history-read-baseline.json").home[scope]);
    assert.equal(JSON.stringify(f.snapshot()),before);assert.equal(f.counts.index+f.counts.sources+f.state.writes,0);
});
for(const id of["private","itacan","hub","resource:study","future","shelved","deleted","resource:literature","resource:references","resource:inspiration"])test("actual original workspace History attribution/filter parity: "+id,async t=>{
    const f=createHistoryFixture();t.after(()=>f.close());const owner=f.owners.find(owner=>owner.projectId===id);
    const records=clean(historyRecords(await f.service.queryHistory({projection:"recorded"})));
    assert.deepEqual(originalItems(records,"project",owner),require("./history-read-baseline.json").workspaces.find(item=>item.id===id).records);
});
test("recorded projection preserves all known historical fields, null/absence, IDs, scalar timestamps and array order",async t=>{
    const f=createHistoryFixture();t.after(()=>f.close());const result=await f.service.queryHistory({projection:"recorded"});
    assert.equal(result.consistency,"legacy-recorded");assert.equal(result.rows.length,f.records.length);
    assert.deepEqual(result.rows.map(row=>row.fact.recorded),f.records);
    const legacy=result.rows.find(row=>row.fact.title==="Legacy missing identity").fact.recorded;
    assert(!Object.hasOwn(legacy,"id"));const nullable=result.rows.find(row=>row.fact.title==="Explicit null identity").fact.recorded;
    assert(Object.hasOwn(nullable,"id")&&nullable.id===null);assert.equal(nullable.timestamp,null);
    const strings=result.rows.find(row=>row.fact.recordId==="noncanonical/event").fact;
    assert.equal(strings.timestamp,null);assert.equal(typeof strings.recorded.timestamp,"string");assert.equal(strings.recorded.archivedAt,Number(strings.recorded.timestamp)+1);
    assert.equal(strings.source.path,"Projects/Itacan/Missing.md");assert(!Object.hasOwn(strings.recordedSource,"line"));
});
test("recorded reads never deduplicate distinct completions, copied task IDs or duplicated legacy event evidence",async t=>{
    const f=createHistoryFixture();t.after(()=>f.close());const query=await f.service.queryHistory({projection:"recorded"});
    assert.equal(query.rows.filter(row=>row.fact.recordId==="event-0").length,2);
    assert(query.rows.filter(row=>row.fact.taskIdentity==="task-1").length>2);
    const records=historyRecords(query);assert.equal(new Set(records.map(record=>record.historyReadKey)).size,records.length);
    assert(!f.records.some(record=>Object.hasOwn(record,"historyReadKey")));assert.equal(f.state.writes,0);
});
test("History projection delegates owner filtering to the existing exact recorded Wizard convention",async t=>{
    const f=createHistoryFixture();t.after(()=>f.close());
    for(const owner of[{type:"project",id:"private"},{type:"resource",id:"literature"}]){
        const id=owner.type==="resource"?"resource:"+owner.id:owner.id;
        assert.deepEqual(clean(historyRecords(await f.service.queryHistory({projection:"recorded",owner}))),f.wizard.getCompletedTaskHistory(id));
    }
    await assert.rejects(f.service.queryHistory({projection:"native"}),{code:"VALIDATION"});
});
test("default HistoryFact API remains unchanged while task/Step handle filtering is source independent",async t=>{
    const f=createHistoryFixture();t.after(()=>f.close());const old=await f.service.queryHistory();
    assert.equal(old.length,f.records.length);assert(!Object.hasOwn(old[0],"recorded"));
    const handle={kind:"legacy",identity:{kind:"hidden-id",value:"task-parent"},locator:{path:"Missing.md",line:0,expectedTitle:"Changed current parent"}};
    const query=await f.service.queryHistory({projection:"recorded",handle});assert(query.rows.length);assert(query.rows.every(row=>row.fact.kind==="step"&&row.fact.taskIdentity==="task-parent"));
    assert.equal(f.counts.index+f.counts.sources+f.state.writes,0);
});
test("source/owner/title/status changes and source deletion cannot rewrite recorded historical evidence",async t=>{
    const f=createHistoryFixture();t.after(()=>f.close());const before=(await f.service.queryHistory({projection:"recorded"})).rows;
    f.move(f.files.get("Projects/Private/Tasks.md"),"Resources/Knowledge/Moved.md");
    f.owners[0].name="Renamed private";f.owners[0].root="Projects/Renamed";f.owners[0].status="shelved";f.owners[0].deleted=true;
    f.contents.set("Resources/Knowledge/Moved.md","# Entirely changed current tasks\n");f.remove(f.files.get("Resources/Knowledge/Tasks.md"));
    assert.deepEqual((await f.service.queryHistory({projection:"recorded"})).rows,before);
    const conflict=before.find(row=>row.fact.recordId==="presentation").fact;
    assert.deepEqual(conflict.ownerAtEvent,{type:"project",id:"private"});assert.equal(conflict.recorded.path,"Resources/Knowledge/Tasks.md");
});
test("malformed individual rows/fields retain safe evidence without suppressing unrelated recorded events",()=>{
    const result=recordedHistoryQuery([null,{}, {text:"Good",path:"Gone.md",id:"good",timestamp:10},
        {text:"Partial",path:"Unsafe/../note.md",timestamp:{bad:true},projectName:null}]);
    assert.equal(result.rows.length,4);assert.equal(result.rows[2].fact.title,"Good");assert.equal(result.rows[3].state,"partial");
    assert.equal(result.rows[3].fact.recordedSource,null);assert(!Object.hasOwn(result.rows[3].fact.recorded,"timestamp"));
    assert.equal(result.rows[3].fact.recorded.projectName,null);assert(result.diagnostics.length>=4);
});
test("recorded DTOs and render compatibility are detached from persistence",async t=>{
    const f=createHistoryFixture();t.after(()=>f.close());const before=JSON.stringify(f.records),q=await f.service.queryHistory({projection:"recorded"});
    q.rows[0].fact.recorded.text="Not persisted";q.rows[0].fact.ownerAtEvent.id="Not persisted";
    assert.equal(JSON.stringify(f.records),before);assert.equal(JSON.parse(JSON.stringify(q)).rows.length,q.rows.length);
});
test("History read session caches/coalesces queries, explicit History invalidation refreshes, and task invalidation does not recompute",async t=>{
    const f=createHistoryFixture(),c=consumer(f);t.after(async()=>{c.close();await f.close();});
    const[a,b]=await Promise.all([c.reader.read(),c.reader.read()]);assert.equal(f.counts.history,1);assert.equal(a.records,b.records);
    c.reader.accept(a);assert.equal((await c.reader.read()).changed,false);
    f.plugin.taskData.invalidateAll();f.flush();await c.reader.read();assert.equal(f.counts.history,1);assert.equal(f.plugin.taskData.subscribers.size,0);
    c.reader.invalidate();assert.equal((await c.reader.read()).changed,false);assert.equal(f.counts.history,2);
});
test("History A cannot replace newer B or a new consumer after invalidation/disposal",async t=>{
    const f=createHistoryFixture(),actual=f.plugin.taskService,gates=[];
    f.plugin.taskService={queryHistory:query=>new Promise((resolve,reject)=>gates.push({resolve,reject,query}))};
    const c=consumer(f);t.after(async()=>{c.close();await f.close();});const a=c.reader.read();await Promise.resolve();c.reader.invalidate();const b=c.reader.read();await Promise.resolve();
    const result=await actual.queryHistory({projection:"recorded"});gates[1].resolve(result);assert((await b).records.length);
    gates[0].resolve(result);assert.equal(await a,null);
    c.reader.invalidate();const pending=c.reader.read();await Promise.resolve();c.close();gates[2].resolve(result);assert.equal(await pending,null);
    assert((await actual.queryHistory()).length);
});
test("whole History query failure is distinct from empty and can recover; obsolete rejections are suppressed",async t=>{
    const f=createHistoryFixture(),c=consumer(f);t.after(async()=>{c.close();await f.close();});const initial=await c.reader.read();c.reader.accept(initial);
    const original=f.wizard.getCompletedTaskHistory;f.wizard.getCompletedTaskHistory=()=>{throw Error("History store offline");};c.reader.invalidate();
    await assert.rejects(c.reader.read(),/History store offline/);f.wizard.getCompletedTaskHistory=original;assert.equal((await c.reader.read()).changed,false);
    f.wizard.completedTaskHistory=[];c.reader.invalidate();assert.equal((await c.reader.read()).records.length,0);
});
test("recorded-note reveal preserves exact-note compatibility without task/title lookup and rejects missing/unsafe paths",async t=>{
    const f=createHistoryFixture(),c=consumer(f);t.after(async()=>{c.close();await f.close();});await c.reader.read();
    assert.equal(c.reader.reveal({path:"Projects/Private/Tasks.md"}),f.files.get("Projects/Private/Tasks.md"));
    assert.equal(c.reader.reveal({path:"Projects/Private/Deleted.md"}),null);assert.equal(c.reader.reveal({path:"../Outside.md"}),null);
    assert.equal(f.counts.index+f.counts.sources+f.state.writes,0);c.close();assert.throws(()=>c.reader.reveal({path:"Projects/Private/Tasks.md"}),{code:"CLOSED"});
});
test("repeated History mounts and simultaneous windows share one plugin cleanup registration and no index watcher",async t=>{
    const f=createHistoryFixture();t.after(()=>f.close());for(let i=0;i<20;i++){const c=consumer(f);await c.reader.read();c.close();}
    const a=consumer(f),b=consumer(f);await Promise.all([a.reader.read(),b.reader.read()]);assert.equal(f.registrations.length,1);assert.equal(f.plugin.taskData.subscribers.size,0);
    f.registrations[0]();assert.equal(await a.reader.read(),null);assert.equal(await b.reader.read(),null);assert((await f.service.queryHistory()).length);
});
