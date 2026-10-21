"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),{spawnSync}=require("node:child_process");
const {D,M,N,id,owner,snapshot,command,prepare,approve,publish,fixture,prepared,published}=require("./support.cjs");
const rejects=(fn,code)=>assert.rejects(fn,e=>e.code===code);
const prepareFaults=["beforePlanPersistence","afterPlanStaging","duringEvidenceSerialization","duringReservationPublication","duringQuarantinePublication","duringReceiptPersistence","beforeCommit"];
const publishFaults=["beforeAliasPublication","duringReservationPublication","duringQuarantinePublication","duringReceiptPersistence","beforeCommit"];
for(const kind of ["memory","directory"]) {
    for(const stage of prepareFaults)test(kind+": D17 preparation fault leaves no allocation/receipt: "+stage,async t=>{
        let armed=false;const f=await fixture(kind,t,{fault:s=>{if(armed&&s===stage){armed=false;throw Error("Synthetic fault");}}}),s=snapshot([{entryId:"a"},{entryId:"bad",raw:"- [ ] Bad <!-- hub-task:{bad} -->"}]),c=prepare(f.repo,s),before=f.repo.snapshot();
        armed=true;await assert.rejects(()=>f.repo.execute(c));assert.deepEqual(f.repo.snapshot(),before);await f.reopen();assert.deepEqual(f.repo.snapshot(),before);
        const r=await f.repo.execute(c);assert.equal(r.accounting.plannedIdentities,1);assert.equal(f.repo.snapshot().receipts.length,1);
    });
    for(const stage of publishFaults)test(kind+": D17 publication fault exposes no half aliases: "+stage,async t=>{
        let armed=false;const f=await fixture(kind,t,{fault:s=>{if(armed&&s===stage){armed=false;throw Error("Synthetic fault");}}}),s=snapshot();await prepared(f.repo,s);await f.repo.execute(approve(f.repo,s));const c=publish(f.repo,s),before=f.repo.snapshot();
        armed=true;await assert.rejects(()=>f.repo.execute(c));assert.deepEqual(f.repo.snapshot(),before);await f.reopen();assert.equal(f.repo.resolveAlias("old-parent").state,"missing");await f.repo.execute(c);assert.equal(f.repo.snapshot().aliases.length,1);
    });
    for(const stage of ["afterDurableCommit","beforeAcknowledgement"])test(kind+": D17 committed acknowledgement loss replays exact IDs: "+stage,async t=>{
        let armed=false;const f=await fixture(kind,t,{fault:s=>{if(armed&&s===stage){armed=false;throw Error("Lost reply");}}}),s=snapshot();await prepared(f.repo,s);await f.repo.execute(approve(f.repo,s));const c=publish(f.repo,s),ids=f.repo.getPlan("plan-1").entries.map(e=>e.nativeId);
        armed=true;await rejects(()=>f.repo.execute(c),"ACKNOWLEDGEMENT_LOST");await f.reopen();const r=await f.repo.execute(c);assert.equal(r.replayed,true);assert.deepEqual(r.plan.entries.map(e=>e.nativeId),ids);assert.equal(f.repo.snapshot().receipts.length,3);
    });
    test(kind+": D17 concurrent readers see complete old or new state",async t=>{
        let entered,release,armed=false;const hit=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
        const f=await fixture(kind,t,{fault:async stage=>{if(armed&&stage==="duringReceiptPersistence"){entered();await gate;}}}),s=snapshot();await prepared(f.repo,s);await f.repo.execute(approve(f.repo,s));const old=f.repo.snapshot();armed=true;
        const run=f.repo.execute(publish(f.repo,s));await hit;assert.deepEqual(f.repo.snapshot(),old);release();await run;const next=f.repo.snapshot();assert.equal(next.plans[0].status,"published");assert.equal(next.aliases.length,1);assert.equal(next.receipts.length,3);D.validateState(next);
    });
    test(kind+": D17 competing plans from one revision have one winner",async t=>{
        const f=await fixture(kind,t),a=prepare(f.repo,snapshot(),"a","a-op"),b=prepare(f.repo,snapshot([{entryId:"b",legacyId:"different",path:"Projects/Private/B.md"}],{id:"b"}),"b","b-op");
        const rs=await Promise.allSettled([f.repo.execute(a),f.repo.execute(b)]);assert.equal(rs.filter(r=>r.status==="fulfilled").length,1);assert.equal(rs.find(r=>r.status==="rejected").reason.code,"REVISION_CONFLICT");assert.equal(f.repo.snapshot().plans.length,1);
    });
    test(kind+": D17 queued concurrent retry survives committed reply loss",async t=>{
        let armed=false;const f=await fixture(kind,t,{fault:stage=>{if(armed&&stage==="beforeAcknowledgement"){armed=false;throw Error("lost first reply");}}}),s=snapshot();await prepared(f.repo,s);await f.repo.execute(approve(f.repo,s));const c=publish(f.repo,s);armed=true;
        const rs=await Promise.allSettled([f.repo.execute(c),f.repo.execute(c)]);assert.equal(rs[0].status,"rejected");assert.equal(rs[0].reason.code,"ACKNOWLEDGEMENT_LOST");assert.equal(rs[1].value.replayed,true);await f.reopen();assert.equal(f.repo.snapshot().aliases.length,1);assert.equal(f.repo.snapshot().receipts.length,3);
    });
    test(kind+": D03 concurrent competing aliases fail without retarget or second allocation",async t=>{
        const f=await fixture(kind,t),a=snapshot(),b=snapshot([{entryId:"copy",legacyId:"old-parent",ownerKey:"hub"}],{id:"other-snapshot"});
        const ca=prepare(f.repo,a,"a","a-op"),cb=prepare(f.repo,b,"b","b-op"),rs=await Promise.allSettled([f.repo.execute(ca),f.repo.execute(cb)]);assert.equal(rs[0].status,"fulfilled");assert.equal(rs[1].reason.code,"REVISION_CONFLICT");
        await rejects(()=>f.repo.execute({...cb,expectedRevision:f.repo.snapshot().revision}),"ALIAS_CONFLICT");assert.equal(f.repo.snapshot().plans.length,1);assert.equal(f.repo.snapshot().reservations.length,1);
    });
}
for(const stage of ["beforeGenerationWrite","generation:duringTemporaryWrite","generation:beforeFlush","generation:afterFlush","afterGenerationFlush","afterGenerationPublication","pointer:duringTemporaryWrite","pointer:beforeFlush","pointer:afterFlush","beforePointerReplace","afterPointerReplace","afterDirectorySync"])test("directory: D17 real publication boundary fault "+stage,async t=>{
    let armed=false;const f=await fixture("directory",t,{fault:s=>{if(armed&&s===stage){armed=false;throw Error("Disk boundary fault");}}}),s=snapshot();await prepared(f.repo,s);await f.repo.execute(approve(f.repo,s));const c=publish(f.repo,s),ids=f.repo.getPlan("plan-1").entries.map(e=>e.nativeId);armed=true;
    await assert.rejects(()=>f.repo.execute(c));await f.reopen();const committed=["afterPointerReplace","afterDirectorySync"].includes(stage);assert.equal(f.repo.getPlan("plan-1").status,committed?"published":"approved");
    assert.equal(f.repo.snapshot().aliases.length,committed?1:0);const r=await f.repo.execute(c);assert.equal(r.replayed,committed);assert.deepEqual(r.plan.entries.map(e=>e.nativeId),ids);
    const files=await fs.readdir(f.directory);if(stage==="generation:duringTemporaryWrite")assert(files.some(n=>n.endsWith(".tmp")),"Partial staged evidence retained");
});
async function editCommitted(directory,change){
    const pointerPath=path.join(directory,"CURRENT.json"),wrapper=JSON.parse(await fs.readFile(pointerPath,"utf8")),file=path.join(directory,wrapper.payload.file),state=JSON.parse(await fs.readFile(file,"utf8"));
    change(state);const bytes=D.canonical(state)+"\n";await fs.writeFile(file,bytes);wrapper.payload.sha256=D.hash(bytes);wrapper.sha256=D.hash(wrapper.payload);await fs.writeFile(pointerPath,D.canonical(wrapper)+"\n");
}
const corruptions={
    "missing receipt":s=>s.receipts.pop(),"corrupt receipt digest":s=>s.receipts[0].payloadDigest="0".repeat(64),
    "duplicate reservation":s=>s.reservations.push(D.clone(s.reservations[0])),"invalid canonical UUID":s=>s.reservations[0].id="NOT-UUID",
    "unexpected owner":s=>s.aliases[0].owner={type:"project",id:"unknown"},"conflicting alias":s=>s.aliases.push(D.clone(s.aliases[0])),
    "missing alias disposition":s=>s.aliases=[],"missing quarantine evidence":s=>s.quarantines[0].evidence=[],
    "missing plan field":s=>delete s.plans[0].snapshot,"unknown decision revision":s=>s.decisionRevision="future-decision",
    "unknown required capability":s=>s.requiredCapabilities.push("future-import"),"unsupported plan format":s=>s.plans[0].version=2,
    "unsupported snapshot format":s=>s.versions.snapshot=2,"unsupported evidence format":s=>s.plans[0].snapshot.version=2,
    "unsupported alias format":s=>s.aliases[0].version=2,"unsupported reservations format":s=>s.reservations[0].version=2,
    "unsupported quarantine format":s=>s.quarantines[0].version=2,"unsupported receipts format":s=>s.receipts[0].version=2,
    "unrecognized field":s=>s.futureField="must-not-disappear", "conflicting revision":s=>s.revision++
};
for(const[name,change]of Object.entries(corruptions))test("directory: D17/D18 no-write reopen rejects "+name,async t=>{
    const f=await fixture("directory",t),s=snapshot([{entryId:"a",legacyId:"one"},{entryId:"blocked",blockers:["D09"]}]);await published(f.repo,s);await f.close();await editCommitted(f.directory,change);
    const names=await fs.readdir(f.directory),bytes=await Promise.all(names.map(n=>fs.readFile(path.join(f.directory,n))));await assert.rejects(()=>N.openDirectoryIdentity(f.options));
    assert.deepEqual(await fs.readdir(f.directory),names);for(let i=0;i<names.length;i++)assert.deepEqual(await fs.readFile(path.join(f.directory,names[i])),bytes[i]);
});
for(const kind of ["invalid JSON","truncated generation","missing pointer","new pointer format"])test("directory: D17 preserve corrupt pointer/generation: "+kind,async t=>{
    const f=await fixture("directory",t);await prepared(f.repo);await f.close();const pp=path.join(f.directory,"CURRENT.json"),w=JSON.parse(await fs.readFile(pp,"utf8"));
    if(kind==="invalid JSON")await fs.writeFile(pp,"{");
    else if(kind==="truncated generation")await fs.writeFile(path.join(f.directory,w.payload.file),"{");
    else if(kind==="missing pointer")await fs.rename(pp,path.join(f.directory,"RETAINED-CURRENT.json"));
    else {w.payload.version=2;w.sha256=D.hash(w.payload);await fs.writeFile(pp,D.canonical(w));}
    const files=await fs.readdir(f.directory);await assert.rejects(()=>N.openDirectoryIdentity(f.options));assert.deepEqual(await fs.readdir(f.directory),files);assert((await N.inspectIdentityDirectory(f.directory)).error);
});
test("directory: D17 recovery failure retains the valid committed plan",async t=>{
    const f=await fixture("directory",t);await prepared(f.repo);await f.close();await assert.rejects(()=>N.openDirectoryIdentity({...f.options,fault:stage=>{if(stage==="duringRecovery")throw Error("recovery interruption");}}));
    const r=await N.openDirectoryIdentity(f.options);try{assert.equal(r.getPlan("plan-1").status,"prepared");}finally{await r.close();}
});
test("directory: D17 exclusive live writer and explicit OS Temp boundary",async t=>{
    const f=await fixture("directory",t);await rejects(()=>N.openDirectoryIdentity(f.options),"LOCK_HELD");
    await assert.rejects(()=>N.createDirectoryIdentity({...f.options,directory:process.cwd()}),/OS Temp/);
    const inspect=await N.inspectIdentityDirectory(f.directory);await assert.rejects(()=>N.preserveAbandonedIdentityLock({directory:f.directory,expectedRaw:inspect.lockRaw,confirmDeadWriter:true}),/abandoned local writer/);
});
for(const stage of ["generation:duringTemporaryWrite","afterGenerationFlush","afterGenerationPublication","pointer:duringTemporaryWrite","beforePointerReplace","afterPointerReplace","afterDirectorySync","afterDurableCommit","beforeAcknowledgement"])test("directory: D17 child-process crash/restart "+stage,async t=>{
    const f=await fixture("directory",t),s=snapshot();await prepared(f.repo,s);await f.repo.execute(approve(f.repo,s));const c=publish(f.repo,s),ids=f.repo.getPlan("plan-1").entries.map(e=>e.nativeId);await f.close();
    const guard=process.execArgv.slice(0,process.execArgv.indexOf("--test")<0?process.execArgv.length:process.execArgv.indexOf("--test")).filter(x=>x!=="--test");
    const result=spawnSync(process.execPath,[...guard,path.join(__dirname,"crash-child.cjs"),f.directory,stage],{env:{...process.env,ELECTRON_RUN_AS_NODE:"1"},encoding:"utf8",timeout:15000,windowsHide:true});
    assert.equal(result.status,81,result.stderr);const inspect=await N.inspectIdentityDirectory(f.directory);assert(inspect.lockRaw);assert.equal(inspect.error,null);
    await rejects(()=>N.openDirectoryIdentity(f.options),"LOCK_HELD");await N.preserveAbandonedIdentityLock({directory:f.directory,expectedRaw:inspect.lockRaw,confirmDeadWriter:true});
    const r=await N.openDirectoryIdentity(f.options);try{const committed=["afterPointerReplace","afterDirectorySync","afterDurableCommit","beforeAcknowledgement"].includes(stage);assert.equal(r.snapshot().aliases.length,committed?1:0);const replay=await r.execute(c);assert.equal(replay.replayed,committed);assert.deepEqual(replay.plan.entries.map(e=>e.nativeId),ids);assert.equal(r.snapshot().receipts.length,3);assert((await fs.readdir(f.directory)).some(n=>n.startsWith("abandoned-lock-")));}finally{await r.close();}
});
