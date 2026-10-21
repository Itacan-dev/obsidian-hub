"use strict";
const test = require("node:test"), S = require("./history-support.cjs"), { assert } = S;
test("v4 History joins actual fresh initial/task/Step/atomic receipt evidence, detached and allowlisted", async t => {
 const f = await S.fixture(t), task = await f.create({ completed: true, completedAt: null }); let r = await f.read(); assert.equal(r.completions.length, 1); assert.equal(r.records[0].timestamp, null);
 await f.complete(task.id, false); await f.complete(task.id, true); await f.complete(task.id, true, task.steps[0].id); r = await f.read(); assert.equal(r.completions.length, 2);
 const snapshot = await f.port.read(); assert.equal(snapshot.history.events.length, 3); assert(snapshot.history.events.every(e => e.receipt.digest.length === 64));
 for (const key of ["payload", "legacy", "oathId", "sessionId", "workingContext", "captureSource", "migration"]) assert(!Object.hasOwn(snapshot.history.events[0], key));
 assert(Object.isFrozen(snapshot)); assert.throws(() => { snapshot.history.events[0].title = "wrong"; });
 assert.equal(f.session.host.info().permissions.history, "unsupported");
});
test("v4 has fixed authority/owner selection and rejects unrestricted selectors", async t => {
 const f = await S.fixture(t); for (const patch of [{ authorityId: S.crypto.randomUUID() }, { owners: [] }, { selection: "state" }, { commands: true }, { targets: [] }]) await assert.rejects(f.session.host.readHistory({ version: 4, authorityId: f.config.authorityId, owners: [f.owner], selection: "history", ...patch }));
});
test("a changed event-to-creation relationship cannot become History", async t => {
 const f = await S.E.base.fixture("memory", t); await f.repo.execute(S.E.base.create({ completed: true })); const state = S.V.clone(f.storage.state), e = state.history[0]; e.snapshot.title = "Corrupt snapshot";
 assert.throws(() => require("../../src/history-read").projectHistory(state, { version: 4, authorityId: state.storeId, owners: [state.tasks[0].owner], selection: "history" }, {}));
});

test("Step event cannot masquerade as parent completion and a missing receipt remains unavailable",async t=>{
 const f=await S.fixture(t),task=await f.create();await f.complete(task.id,true,task.steps[0].id);
 const raw=await S.fs.readFile(S.path.join(f.directory,(await f.disk()).payload.current.file),"utf8"),original=require("../../src/private-storage-codec").decodePrivateGeneration(raw,f.config.authorityId).state;
 for(const kind of ["wrong-target","missing-receipt"]){const state=S.V.clone(original),e=state.history[0],r=state.receipts.find(r=>r.operationId===e.operationId);if(kind==="missing-receipt")state.receipts=state.receipts.filter(x=>x!==r);else{const c=JSON.parse(r.payload);c.type="task.complete";delete c.payload.stepId;r.payload=S.V.canonical(c);}
  assert.throws(()=>require("../../src/history-read").projectHistory(state,{version:4,selection:"history",authorityId:state.storeId,owners:[f.owner]}));
 }
});
test("in-flight context invalidation rejects old History pins, separate fresh demand may observe the new context", async t => {
 let f, armed = false, injected = 0; f = await S.fixture(t, { repositoryOptions: { fault(stage) { if (armed && stage === "snapshot:beforeAcceptance") { armed = false; injected++; f.registry.change(r => r.owners[0].status = "shelved"); } } } });
 await f.create({ completed: true }); armed = true; await assert.rejects(f.port.read()); assert.equal(injected, 1); assert((await f.port.read()).history.events.length);
});

test("atomic Save genuine completion and reopening join truthful selected effects",async t=>{
 const f=await S.fixture(t),task=await f.create(),form=f.runtime.formService({}),draft=await form.read(task);
 await form.save(draft,{...draft,operation:"edit",text:"Saved completion",completed:true,steps:draft.steps.map((s,i)=>({...s,completed:i===0}))});
 const read=await f.port.read();assert.deepEqual(new Set(read.history.events.map(e=>e.origin)),new Set(["genuine-parent-completion","genuine-step-completion"]));assert.equal(new Set(read.history.events.map(e=>e.receipt.operationId)).size,1);
 const reopeningForm=f.runtime.formService({}),next=await reopeningForm.read(task);await reopeningForm.save(next,{...next,operation:"edit",completed:false,steps:next.steps.map(s=>({...s,completed:false}))});
 const reopened=await f.port.read();assert(reopened.history.events.every(e=>!e.counted));assert.equal((await f.read()).completions.length,0);
});
