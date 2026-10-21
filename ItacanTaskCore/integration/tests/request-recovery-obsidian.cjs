"use strict";
// Test-only extension of the existing genuine-Obsidian Project rehearsal.
// Its existing launcher/preload carry this module into the owned renderer.
const path=require("node:path"),Module=require("node:module");
if(process.env.ITACAN_RECOVERY_GUARD)require(process.env.ITACAN_RECOVERY_GUARD);
const original=Module._load,fixture=path.join(__dirname,"obsidian-fixture.cjs");
Module._load=function(name,parent,main){const value=original.apply(this,arguments);if(name!==fixture)return value;return async function(context,root){
 const report=await value(context,root),S=require("./support.cjs"),{assert}=S,dir=path.join(root,"evidence/recovery-native");await S.fs.mkdir(dir);const c=S.configuration(dir);
 assert.equal(typeof context.api.Modal,"function");let runtime=await S.openProjectRuntime(c.config,{...c,creating:true});const intent=S.B.create(await runtime.creationContext(),{text:"Operator recovery in genuine Obsidian",completed:true,steps:[{text:"Preserved Step",completed:true}]});intent.action.draft.id=S.crypto.randomUUID();
 const session=S.sessions.at(-1),cap=await session.authorize({version:1,owners:c.writerPolicy.owners,commands:c.writerPolicy.commands}),record=await session.requests.prepare(cap,intent);session.revoke(cap);await runtime.close();
 runtime=await S.openProjectRuntime(c.config,{...c,creating:false});const review=await runtime.recovery.inspect(intent.operationId);assert.equal(review.classification,"execution-uncertain");assert(review.canReplay);assert.equal((await runtime.replay(intent.operationId)).status,"uncertain");
 const result=await runtime.recovery.replay(review);assert.equal(result.status,"committed");assert.deepEqual(result.taskIds,[intent.action.draft.id]);assert.deepEqual(await runtime.getRetained(intent.operationId),record);assert.equal((await runtime.recovery.reconcile(intent.operationId)).presentation.state,"current");
 const replay=await runtime.recovery.replay(await runtime.recovery.inspect(intent.operationId));assert.equal(replay.status,"replayed");assert.deepEqual(replay.eventIds,result.eventIds);const rows=await runtime.list();assert.equal(rows.tasks.length,1);assert.equal(rows.tasks[0].steps[0].id,intent.action.draft.steps[0].id);
 const next=S.B.create(await runtime.creationContext(),{text:"Ordinary action after recovery",steps:[]});next.action.draft.id=S.crypto.randomUUID();assert.equal((await runtime.mutate(next)).status,"committed");await runtime.close();
 const checks=[...report.checks,"operator-inspected reconstructed request replays identically in genuine Obsidian with preserved task/Step IDs","authoritative receipt reconciliation and committed replay add no events; ordinary native mutations resume"];
 await S.fs.writeFile(path.join(root,"evidence/request-recovery.json"),JSON.stringify({review,result,replay,recordChecksum:record.checksum,checks:checks.slice(-2)},null,2));return{...report,checks,requestRecovery:true};
};};
if(require.main===module){
 const index=process.execArgv.indexOf("--require");if(index<0)throw Error("Established isolation guard required");process.env.ITACAN_RECOVERY_GUARD=process.execArgv[index+1];process.execArgv[index+1]=__filename;
 process.argv=[process.execPath,path.join(__dirname,"run-obsidian.cjs"),"project"];require("./run-obsidian.cjs");
}
