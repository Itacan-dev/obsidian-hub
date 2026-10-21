"use strict";
const { test } = require("node:test"), S = require("./support.cjs"), { assert } = S;
const { createTaskPanelRead } = require("../../../.obsidian/plugins/hub-project-menu/lib/services/task-panel-read");
// This relative path is resolved below from the workspace, not a copied implementation.

test("actual Project controller uses native UUID rows and never invokes legacy actions/history", async t => {
 const f = await S.fixture(t); const intent = await f.intent({ description: "Description", necessity: "must", dueDate: "2026-10-23" });
 assert.equal((await f.runtime.mutate(intent)).status, "committed");
 const plugin = { app: {}, get taskService() { throw Error("Legacy facade touched"); }, mutateTask() { throw Error("Legacy mutation touched"); }, toggleTask() { throw Error("Legacy toggle touched"); } };
 const c = createTaskPanelRead({ plugin, component: f.component(), workspace: f.owner, nativeTasks: f.runtime.nativeTasks, changed() {} });
 let r; for (let i = 0; i < 4 && !r; i++) r = await c.read(); assert(r); assert.equal(r.tasks.length, 1); const task = r.tasks[0];
 for (const k of ["path", "line", "hubTaskId"]) assert.equal(Object.hasOwn(task, k), false);
 assert.equal(task.necessity, "must"); assert.equal(task.dueDate, "2026-10-23");
 const edit = await c.actions.mutate({ ...task, operation: "step", step: task.steps[1], stepCompleted: true }); assert.equal(edit.availability, "current");
 assert.equal(edit.tasks[0].completed, false); assert.deepEqual(edit.tasks[0].steps.map(s => s.completed), [false, true]);
 const completed = await c.toggle(edit.tasks[0], true); assert.equal(completed.tasks[0].completed, true);
 const reopened = await c.toggle(completed.tasks[0], false); assert.equal(reopened.tasks[0].completed, false);
 await assert.rejects(c.clear([])); await assert.rejects(c.reveal(task));
 await f.reopen(); assert.equal((await f.runtime.list()).tasks[0].id, task.id);
});
test("form service preserves flat Step identities, Description, dates and exact Save replay", async t => {
 const f = await S.fixture(t), service = f.runtime.formService({}), values = { text: "From modal", description: "Description", necessity: "should", fromDate: "2026-10-21", dueDate: "2026-10-23", steps: [{ text: "First", completed: true }] };
 const edit = await service.create({ authorityId: f.config.authorityId, owner: f.owner }, values.text, values); assert.equal(edit.outcome.status, "committed");
 const id = edit.tasks[0].id, editor = f.runtime.formService({}), state = await editor.read(edit.tasks[0]); const step = state.steps[0].id; state.text = "Edited";
 const saved = await editor.save(state, { ...state, operation: "edit" }); assert.equal(saved.outcome.status, "committed"); assert.equal(saved.tasks[0].steps[0].id, step);
 const retained = await f.runtime.retained(); await f.reopen(); const replay = await f.runtime.replay(retained.at(-1).operationId); assert.equal(replay.status, "replayed"); assert.equal((await f.runtime.list()).tasks[0].id, id);
});
test("other owners, including mounted Resource, keep the actual legacy branch", async t => {
 const f = await S.fixture(t); let queries = 0; const service = { subscribe: () => () => {}, async queryStructured() { queries++; return { rows: [], diagnostics: [] }; } };
 for (const workspace of [{ type: "project", id: "legacy" }, { type: "resource", id: "study" }]) {
  const component = f.component(), plugin = { taskService: service, register: fn => component.register(fn) };
  const c = createTaskPanelRead({ plugin, component, workspace, nativeTasks: f.runtime.nativeTasks, changed() {} });
  assert.deepEqual((await c.read()).tasks, []); c.close();
 } assert.equal(queries, 2);
});
test("changed registry rejects old requests; new reads never silently fallback", async t => {
 const f = await S.fixture(t), i = await f.intent(); f.registry.change(r => r.owners[0].available = false);
 await assert.rejects(f.runtime.mutate(i)); await assert.rejects(f.runtime.list());
});

async function fixtureCreate(f,i){
 const c=await f.session.authorize({version:1,owners:f.writerPolicy.owners,commands:f.writerPolicy.commands});
 await f.session.requests.prepare(c,i);
 const out=await f.session.writer.task(c,require("../../application/intents").compile(i).request);f.session.revoke(c);assert.equal(out.status,"committed");return out;
}
test("compact Edit preserves hidden continuation, Step bodies and UUIDs without exporting them",async t=>{
 const f=await S.fixture(t),i=await f.intent();i.action.draft.continuation="PRIVATE_CONTINUATION";i.action.draft.steps[0].body="PRIVATE_STEP_BODY";const out=await fixtureCreate(f,i),id=out.tasks[0].id;
 const list=await f.runtime.list();assert(!JSON.stringify(list).includes("PRIVATE_"));const service=f.runtime.formService({}),state=await service.read(list.tasks[0]);assert(!JSON.stringify(state).includes("PRIVATE_"));
 const saved=await service.save(state,{...state,text:"Visible edit",operation:"edit"});assert.equal(saved.outcome.status,"committed");const e=await f.runtime.editor(id);assert.equal(e.draft.continuation,"PRIVATE_CONTINUATION");assert.equal(e.draft.steps[0].body,"PRIVATE_STEP_BODY");assert.equal(e.draft.steps[0].id,i.action.draft.steps[0].id);
 const changed=S.B.save(e,{...S.B.toForm(e),text:"Forged hidden edit"});changed.action.draft.continuation="lost";await assert.rejects(f.runtime.mutate(changed));assert.equal((await f.runtime.editor(id)).draft.continuation,"PRIVATE_CONTINUATION");
});
test("nested native data rejects compact editing and completion without flattening",async t=>{
 const f=await S.fixture(t),i=await f.intent();i.action.draft.steps[1].parentStepId=i.action.draft.steps[0].id;i.action.draft.steps[1].order=0;const out=await fixtureCreate(f,i),id=out.tasks[0].id;
 assert.equal((await f.runtime.list()).tasks[0].nativeReadOnly,true);await assert.rejects(f.runtime.editor(id),/Nested/);const c=f.runtime.nativeTasks.createPanelRead({plugin:{},component:f.component(),workspace:f.owner});const task=(await f.runtime.list()).tasks[0];await assert.rejects(c.toggle(task,true),/Nested/);assert.equal((await f.runtime.list()).tasks[0].steps[1].parentStepId,i.action.draft.steps[0].id);assert.equal((await f.runtime.retained()).length,1);
});
test("known commit with unavailable refresh remains committed and stale memory is not published",async t=>{
 let f,armed=false;f=await S.fixture(t,{repositoryOptions:{fault(stage){if(armed&&stage==="beforeAcknowledgement"){armed=false;f.registry.change(r=>r.owners[0].available=false);}}}});
 const service=f.runtime.formService({}),values={text:"Known committed",steps:[]};armed=true;const r=await service.create({authorityId:f.config.authorityId,owner:f.owner},values.text,values);
 assert.equal(r.outcome.status,"committed");assert.equal(r.availability,"unavailable");assert.deepEqual(r.tasks,[]);assert.equal(f.repository.queryTasks().length,1);
});
test("independent Step reopen preserves parent state and later reads are detached",async t=>{
 const f=await S.fixture(t),out=await f.runtime.mutate(await f.intent()),id=out.taskIds[0];let e=await f.runtime.editor(id);await f.runtime.mutate(S.B.complete(e,true,e.draft.steps[0].id));e=await f.runtime.editor(id);await f.runtime.mutate(S.B.complete(e,false,e.draft.steps[0].id));assert.equal((await f.runtime.list()).tasks[0].completed,false);assert.equal((await f.runtime.list()).tasks[0].steps[0].completed,false);assert.throws(()=>{(f.runtime.info()).authority.authorityId="other";});
});

test("identity-provider outage preserves the original request and prevents new publication",async t=>{
 let unavailable=false;const identity={read:async()=>{if(unavailable)throw Error("PRIVATE_IDENTITY_SENTINEL");return null;},subscribe:()=>()=>{}};
 const f=await S.fixture(t,{identity}),i=await f.intent();unavailable=true;await assert.rejects(f.runtime.mutate(i));assert.equal(f.repository.queryTasks().length,0);unavailable=false;assert.equal((await f.runtime.mutate(i)).status,"committed");assert.equal((await f.runtime.retained())[0].operationId,i.operationId);
});

test("disposal suppresses late panel publication while preserving an accepted native commit",async t=>{
 let armed=false,enter,release;const entered=new Promise(r=>enter=r),go=new Promise(r=>release=r);const f=await S.fixture(t,{repositoryOptions:{fault:async stage=>{if(armed&&stage==="beforeAcknowledgement"){armed=false;enter();await go;}}}});
 await f.runtime.mutate(await f.intent());let changes=0;const c=f.runtime.nativeTasks.createPanelRead({plugin:{},component:f.component(),workspace:f.owner,changed(){changes++;}}),task=(await f.runtime.list()).tasks[0];
 armed=true;const working=c.toggle(task,true);await entered;c.close();const before=changes,closing=f.runtime.close();release();const out=await working;await closing;assert.equal(out.outcome.status,"committed");assert.equal(out.availability,"unavailable");assert.deepEqual(c.reconcile([task],out),[]);assert.equal(changes,before);assert.equal(f.runtime.info().lastOutcome.taskIds[0],task.id);assert.notEqual(f.runtime.info().lastOutcome.operationId,out.outcome.operationId);
});
