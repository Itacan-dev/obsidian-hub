"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {fixture,owners,id,sessionPort}=require("./native-read-fixture.cjs");
const {TaskReadSession}=require("../services/task-read-session");
async function setup(t,options){const f=fixture(options);t.after(()=>f.service.close());return f;}
test("multiple native contract read sessions share one facade, own caches/subscriptions and close independently",async t=>{
 const {service,adapter}=await setup(t),port=sessionPort(service),first=new TaskReadSession(port),second=new TaskReadSession(port);
 t.after(()=>{first.close();second.close();});
 assert.equal(adapter.listenerCount,2);await Promise.all([first.read({owner:owners.private}),second.read({owner:owners.itacan})]);assert.equal(adapter.counts.reads,2);
 await first.read({owner:owners.private});assert.equal(adapter.counts.reads,2);
 first.close();first.close();assert.equal(adapter.listenerCount,1);
 await second.read({owner:owners.itacan});assert.equal(adapter.counts.reads,2);second.close();assert.equal(adapter.listenerCount,0);
 assert.equal((await service.readiness()).state,"ready");
});
test("native snapshot invalidation requeries while warm session reads add no work",async t=>{
 const {service,adapter}=await setup(t);let notices=0;const session=new TaskReadSession(sessionPort(service),()=>notices++);t.after(()=>session.close());
 await session.read({});await session.read({});assert.equal(adapter.counts.reads,1);
 adapter.invalidate();await session.read({});assert.equal(adapter.counts.reads,2);assert.equal(notices,1);
});
test("invalidation during a deferred native read discards old snapshot and retries current generation",async t=>{
 const {service,adapter}=await setup(t),session=new TaskReadSession(sessionPort(service));t.after(()=>session.close());
 const gate=adapter.deferNext(),pending=session.read({owner:owners.private});await gate.entered;
 const record=adapter.snapshot().tasks[0];adapter.replaceRecord({...record,revision:2,title:"New snapshot"});
 gate.release();const result=await pending;assert.equal(result.rows.find(task=>task.id===id(1)).title,"New snapshot");assert.equal(adapter.counts.reads,2);
});
test("session closed during a deferred read cannot publish and releases only its subscription",async t=>{
 const {service,adapter}=await setup(t),session=new TaskReadSession(sessionPort(service)),other=new TaskReadSession(sessionPort(service));t.after(()=>other.close());
 const gate=adapter.deferNext(),pending=session.read({});await gate.entered;session.close();gate.release();
 assert.equal(await pending,null);assert.equal(adapter.listenerCount,1);assert((await other.read({})).rows.length>0);
});
test("consumer cancellation during pending read suppresses late result",async t=>{
 const {service,adapter}=await setup(t),session=new TaskReadSession(sessionPort(service));t.after(()=>session.close());let cancelled=false;
 const gate=adapter.deferNext(),pending=session.read({},()=>cancelled);await gate.entered;cancelled=true;gate.release();assert.equal(await pending,null);
});
test("failed native read is observable and evicted so retry can succeed",async t=>{
 const {service,adapter}=await setup(t),session=new TaskReadSession(sessionPort(service));t.after(()=>session.close());
 adapter.failNext();await assert.rejects(()=>session.read({}),e=>e.code==="READ_FAILED");
 assert((await session.read({})).rows.length>0);assert.equal(adapter.counts.reads,2);
});
test("unavailable backend is never cached as successful empty; readiness recovery invalidates",async t=>{
 const {service,adapter}=await setup(t,{state:"recovering"}),session=new TaskReadSession(sessionPort(service));t.after(()=>session.close());
 await assert.rejects(()=>session.read({}),e=>e.code==="BACKEND_RECOVERING");assert.equal(adapter.counts.reads,0);
 adapter.setState("ready");assert((await session.read({})).rows.length>0);assert.equal(adapter.counts.reads,1);
});
test("cached native projections cannot be mutated to corrupt a later consumer read",async t=>{
 const {service}=await setup(t),session=new TaskReadSession(sessionPort(service));t.after(()=>session.close());
 const result=await session.read({});assert.throws(()=>result.rows.splice(0,1),TypeError);
 assert.equal((await session.read({})).rows.length,result.rows.length);assert.throws(()=>{result.rows[0].completedAt=1;},TypeError);
});
test("adapter/facade close clear subscriptions and reject future calls without late publication",async t=>{
 const {service,adapter}=await setup(t),session=new TaskReadSession(sessionPort(service));
 const gate=adapter.deferNext(),pending=session.read({});await gate.entered;session.close();await service.close();gate.release();
 assert.equal(await pending,null);assert.equal(adapter.listenerCount,0);
 assert.throws(()=>service.readiness(),e=>e.code==="CLOSED");assert.throws(()=>service.read({backend:"native",operation:"structured"}),e=>e.code==="CLOSED");
});
test("ephemeral read invalidation never advertises a committed mutation/receipt",async t=>{
 const {service,adapter}=await setup(t);const seen=[];const stop=service.subscribeReads(change=>seen.push(change));
 adapter.invalidate();assert.deepEqual(seen,[{backend:"native",kind:"snapshot-invalidated",durability:"ephemeral"}]);stop();
 assert.throws(()=>service.subscribe(()=>{}),e=>e.code==="UNSUPPORTED");
});
test("one failing synthetic read subscriber does not prevent another consumer invalidation",async t=>{
 const {service,adapter}=await setup(t);const first=service.subscribeReads(()=>{throw Error("Controlled subscriber failure");});
 let notified=0;const second=service.subscribeReads(()=>notified++);
 adapter.invalidate();assert.equal(notified,1);assert.equal(adapter.notificationErrors.length,1);first();second();
});

