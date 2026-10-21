"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {D,id,registry,owner,snapshot,command,prepare,approve,publish,fixture,prepared,published}=require("./support.cjs");
const rejects=(fn,code)=>assert.rejects(fn,e=>e.code===code);
for(const kind of ["memory","directory"]) {
    test(kind+": D01 exact aliases preserve canonical/noncanonical/uppercase/compact spelling",async t=>{
        const f=await fixture(kind,t),s=snapshot([{entryId:"canonical",legacyId:id(1)},{entryId:"legacy",legacyId:"old-parent"},{entryId:"upper",legacyId:"ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF"},{entryId:"compact",legacyId:"abcdefabcdef4abc8abcabcdefabcdef"}]);
        const r=await published(f.repo,s);assert.equal(r.plan.entries[0].nativeId,id(1));
        for(const e of r.plan.entries){assert(D.isUUID(e.nativeId));assert.equal(f.repo.resolveAlias(e.evidence.legacyId).nativeId,e.nativeId);}
        assert.equal(f.repo.resolveAlias("OLD-PARENT").state,"missing");assert.equal(f.repo.resolveAlias("old-parent",owner("hub")).state,"owner-conflict");
        assert.equal(r.accounting.importedTasks,0);assert(!("tasks" in f.repo.snapshot()));
    });
    test(kind+": D02 same-title task and Step allocations persist without source-derived UUIDs",async t=>{
        const f=await fixture(kind,t),s=snapshot([{entryId:"a"},{entryId:"step",kind:"step",parent:"a"},{entryId:"b"}]);
        const before=f.repo.snapshot(),analysis=f.repo.analyze(s);assert.equal(analysis.entries.filter(e=>e.nativeId).length,0);assert.deepEqual(f.repo.snapshot(),before);
        const c=prepare(f.repo,s),result=await f.repo.execute(c),ids=result.plan.entries.map(e=>e.nativeId);assert.equal(new Set(ids).size,3);
        const reopened=await f.reopen(),replay=await reopened.execute(c);assert.equal(replay.replayed,true);assert.deepEqual(replay.plan,result.plan);assert.deepEqual(reopened.getPlan("plan-1").entries.map(e=>e.nativeId),ids);
        assert.equal(reopened.snapshot().aliases.length,0);assert.equal(reopened.resolveAlias("Same title").state,"missing");
        await rejects(()=>reopened.execute(prepare(reopened,s,"another-plan","another-operation")),"SOURCE_CONFLICT");
    });
    for(const other of registry.map(r=>r.key).concat("outside"))test(kind+": D03 global parent/Step collision includes "+other,async t=>{
        const f=await fixture(kind,t),s=snapshot([{entryId:"a",ownerKey:"itacan",legacyId:"copied"},{entryId:"parent",ownerKey:other,path:(registry.find(r=>r.key===other)?.root??"Outside")+"/Other.md"},{entryId:"b",kind:"step",parent:"parent",ownerKey:other,path:(registry.find(r=>r.key===other)?.root??"Outside")+"/Other.md",legacyId:"copied"}]);
        const r=await published(f.repo,s),copies=r.plan.entries.filter(e=>e.evidence.legacyId==="copied");assert(copies.every(e=>e.nativeId===null&&e.reasons.includes("AMBIGUOUS_IDENTITY")));
        assert.equal(f.repo.resolveAlias("copied").state,"ambiguous");const q=f.repo.snapshot().quarantines.find(q=>q.reason==="AMBIGUOUS_IDENTITY");assert.deepEqual(q.entryIds,["a","b"]);assert.equal(q.evidence.length,2);
        assert.equal(Object.values(r.accounting.dispositions).reduce((a,b)=>a+b,0),3);
    });
    for(const status of ["existing","deleted","retired"])test(kind+": D03 global "+status+" reservations cannot be reused",async t=>{
        const f=await fixture(kind,t,{reservations:[{id:id(1),kind:status==="retired"?"step":"task",owner:owner("private"),status}]}),s=snapshot([{entryId:"x",legacyId:id(1)}]);
        const r=await published(f.repo,s);assert.equal(r.plan.entries[0].nativeId,null);assert.equal(f.repo.resolveAlias(id(1)).state,"unavailable");assert.equal(f.repo.snapshot().reservations.length,1);
    });
    test(kind+": D02 allocator avoids every canonical legacy ID even when it occurs later",async t=>{
        let seq=0;const f=await fixture(kind,t,{idFactory:()=>[id(1),id(2),id(3)][seq++]??id(50+seq)}),s=snapshot([{entryId:"alloc"},{entryId:"reuse",legacyId:id(1)}]);
        const r=await prepared(f.repo,s);assert.equal(r.plan.entries[0].nativeId,id(2));assert.equal(r.plan.entries[1].nativeId,id(1));
    });
    test(kind+": D18 invalid syntax/context and deferred semantics retain distinct private dispositions",async t=>{
        const f=await fixture(kind,t),s=snapshot([{entryId:"malformed",raw:"- [ ] Bad <!-- hub-task:{bad} -->"},{entryId:"context",unresolved:true},{entryId:"recurrence",blockers:["D09","D10"],privateEvidence:{rule:"PRIVATE_RULE"}},{entryId:"date",blockers:["D07"]},{entryId:"history",blockers:["D11","D12"]},{entryId:"oath",blockers:["D15"]}]);
        const r=await published(f.repo,s);assert.equal(r.plan.entries[0].evidence.legacyId,null);assert.equal(r.plan.entries[0].nativeId,null);
        assert.equal(r.plan.entries[1].disposition,"unresolved-owner-context");assert(r.plan.entries[2].nativeId);assert.equal(r.accounting.quarantined,6);assert.equal(r.accounting.captured,6);
        assert(f.repo.snapshot().quarantines.some(q=>q.evidence.some(e=>e.privateEvidence?.rule==="PRIVATE_RULE")));assert.throws(()=>f.repo.publicProjection(),e=>e.code==="UNSUPPORTED");
    });
    for(const change of ["title","line","block","rename","note-move","between-notes","replacement","owner","delete","external-revision","ancestry"])test(kind+": D17 source conflict preserves original allocations: "+change,async t=>{
        const f=await fixture(kind,t),s=snapshot([{entryId:"p",legacyId:"parent"},{entryId:"s",kind:"step",parent:"p"}]);await prepared(f.repo,s);const original=f.repo.getPlan("plan-1"),next=D.clone(s);
        if(change==="owner")next.occurrences[0].owner=owner("hub");
        else if(change==="delete"){next.files=[];next.occurrences=[];}
        else if(change==="line"){next.files[0].content="\n"+next.files[0].content;for(const o of next.occurrences){o.line++;o.end++;}}
        else if(change==="ancestry")next.occurrences[1].parentStepEntryId="s";
        else if(change==="rename"||change==="note-move"||change==="between-notes"){next.files[0].path="Projects/Private/Moved/Other.md";for(const o of next.occurrences)o.folder.path="Projects/Private/Moved";}
        else if(change==="external-revision")next.files[0].revision="external-r2";
        else next.files[0].content=next.files[0].content.replace("Same title","Changed "+change);
        await rejects(()=>f.repo.execute(approve(f.repo,next)),change==="owner"?"OWNER_CONFLICT":"SOURCE_CONFLICT");assert.deepEqual(f.repo.getPlan("plan-1"),original);
    });
    test(kind+": D17 publication requires snapshot-specific approval and exact operation identity",async t=>{
        const f=await fixture(kind,t),s=snapshot();await prepared(f.repo,s);await rejects(()=>f.repo.execute(publish(f.repo,s)),"VALIDATION");
        await f.repo.execute(approve(f.repo,s));await rejects(()=>f.repo.execute({...publish(f.repo,s),operationId:"wrong"}),"OPERATION_CONFLICT");
        const c=publish(f.repo,s),r=await f.repo.execute(c);assert.equal(r.plan.status,"published");assert.equal((await f.repo.execute(c)).replayed,true);
        await rejects(()=>f.repo.execute({...c,payload:{...c.payload,snapshot:{...s,revision:"changed"}}}),"OPERATION_CONFLICT");
    });
    test(kind+": D17 ledger changes after review require explicit re-review",async t=>{
        const f=await fixture(kind,t),a=snapshot(),b=snapshot([{entryId:"b",legacyId:"other",path:"Projects/Private/B.md"}],{id:"snapshot-b"});await prepared(f.repo,a);await f.repo.execute(approve(f.repo,a));await prepared(f.repo,b,"plan-b");
        await rejects(()=>f.repo.execute(publish(f.repo,a)),"REVISION_CONFLICT");await f.repo.execute(approve(f.repo,a,"plan-1","review-again"));await f.repo.execute(publish(f.repo,a));assert.equal(f.repo.getPlan("plan-1").approvals.length,2);
    });
    test(kind+": D17 concurrent same-operation retries publish one whole state",async t=>{
        const f=await fixture(kind,t),s=snapshot(),c=prepare(f.repo,s);const results=await Promise.all([f.repo.execute(c),f.repo.execute(c)]);assert.equal(results[1].replayed,true);assert.equal(f.repo.snapshot().revision,1);
        await f.repo.execute(approve(f.repo,s));const p=publish(f.repo,s);const rs=await Promise.all([f.repo.execute(p),f.repo.execute(p)]);assert.equal(rs[1].replayed,true);assert.equal(f.repo.snapshot().aliases.length,1);await f.reopen();assert.equal(f.repo.resolveAlias("old-parent").state,"resolved-identity-only");
    });
    test(kind+": D03 competing plans cannot retarget a published alias",async t=>{
        const f=await fixture(kind,t),s=snapshot();await published(f.repo,s);const old=f.repo.resolveAlias("old-parent"),next=snapshot([{entryId:"copy",legacyId:"old-parent",ownerKey:"hub"}],{id:"later"});
        await rejects(()=>f.repo.execute(prepare(f.repo,next,"plan-copy","copy-op")),"ALIAS_CONFLICT");assert.deepEqual(f.repo.resolveAlias("old-parent"),old);
    });
    test(kind+": D17 abandon preserves reservations and source evidence",async t=>{
        const f=await fixture(kind,t),s=snapshot([{entryId:"a"}]);await prepared(f.repo,s);const ids=f.repo.getPlan("plan-1").entries.map(e=>e.nativeId);
        await f.repo.execute(command(f.repo,"abandon",{planId:"plan-1",reason:"Synthetic review deferred"},"abandon"));assert.deepEqual(f.repo.snapshot().reservations.map(r=>r.id),ids);assert(f.repo.snapshot().reservations.every(r=>r.status==="abandoned"));
        await rejects(()=>f.repo.execute(prepare(f.repo,s,"replace","replace-op")),"SOURCE_CONFLICT");assert.equal(f.repo.snapshot().aliases.length,0);
    });
    test(kind+": D16 every owner/private sentinel has no public export or task side effects",async t=>{
        const f=await fixture(kind,t),s=snapshot(registry.map(r=>({entryId:r.key,ownerKey:r.key,legacyId:"id-"+r.key,privateEvidence:{sentinel:"PRIVATE_"+r.key,path:"C:/PRIVATE_PATH",history:"PRIVATE_HISTORY",oath:"PRIVATE_OATH"}})));
        await published(f.repo,s);const state=f.repo.snapshot();assert.equal(state.aliases.length,7);assert.equal(state.registry.filter(r=>r.shared).length,2);
        assert.throws(()=>f.repo.publicProjection(),e=>e.code==="UNSUPPORTED");for(const name of ["tasks","steps","history","bindings","oaths","mounts"])assert.equal(Object.hasOwn(state,name),false);
        assert.equal(state.plans[0].entries.find(e=>e.owner.id==="study").owner.type,"resource");
        const detached=f.repo.snapshot();detached.aliases[0].nativeId=id(99);assert.notEqual(f.repo.snapshot().aliases[0].nativeId,id(99));
    });
}
test("D18 complete supplied global corpus is mandatory and same-position double accounting is rejected",async t=>{
    const f=await fixture("memory",t),s=snapshot([{entryId:"a"}]);s.files[0].content+="- [ ] Omitted copy\n";
    assert.throws(()=>f.repo.analyze(s),e=>e.code==="INCOMPLETE_CAPTURE");
    const duplicate=snapshot([{entryId:"a"}]);duplicate.occurrences.push({...duplicate.occurrences[0],entryId:"copy"});assert.throws(()=>f.repo.analyze(duplicate),/same source occurrence/);
});
for(const name of ["same-note-parents","cross-note-parents","step-step","mounted-resource","cross-shared-project"])test("D03 collision matrix "+name,async t=>{
    const f=await fixture("memory",t);let rows;
    if(name==="step-step")rows=[{entryId:"parent"},{entryId:"a",kind:"step",parent:"parent",legacyId:"collision"},{entryId:"b",kind:"step",parent:"parent",legacyId:"collision",order:1}];
    else rows=[{entryId:"a",legacyId:"collision",ownerKey:name==="cross-shared-project"?"itacan":"private"},{entryId:"b",legacyId:"collision",...(name==="cross-note-parents"?{path:"Projects/Private/B.md"}:name==="mounted-resource"?{ownerKey:"knowledge",path:"Resources/Knowledge/Mounted/Tasks.md",privateEvidence:{presentedIn:"itacan"}}:name==="cross-shared-project"?{ownerKey:"hub"}:{})}];
    const r=await published(f.repo,snapshot(rows));assert.equal(r.plan.entries.filter(e=>e.reasons.includes("AMBIGUOUS_IDENTITY")).length,2);assert.equal(f.repo.resolveAlias("collision").nativeId,null);
    if(name==="mounted-resource")assert.deepEqual(r.plan.entries[1].owner,owner("knowledge"));
});
test("D01 N1-A ID-* frozen parser observations remain the exact alias interpretation",async t=>{
    const path=require("node:path"),fs=require("node:fs"),vectors=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../../.obsidian/plugins/hub-project-menu/lib/tests/native-migration-compatibility-v1.json"),"utf8"));
    const f=await fixture("memory",t);let count=0;
    for(const c of vectors.cases.filter(c=>c.caseId.startsWith("ID-"))){const analysis=f.repo.analyze(snapshot([{entryId:"case",raw:"- [ ] "+c.legacyInput.text}]));assert.equal(analysis.entries[0].evidence.legacyId,c.observedLegacyResult.value.identity,c.caseId);count++;}
    assert.equal(count,7);
});
test("D18 unknown structures, unresolved owners and fenced examples remain unavailable",async t=>{
    const f=await fixture("memory",t),s=snapshot([{entryId:"quoted",raw:"> - [ ] Example <!-- hub-task:quoted -->"},{entryId:"unknown",ownerKey:"outside"},{entryId:"wrong",owner:owner("hub")},{entryId:"fenced"}]);
    const file=s.files.find(f=>f.id===s.occurrences[3].fileId),line=s.occurrences[3].line;const lines=file.content.split("\n");lines.splice(line,0,"```md");lines.splice(line+2,0,"```");file.content=lines.join("\n");s.occurrences[3].line++;s.occurrences[3].end++;
    const r=await prepared(f.repo,s);assert(r.plan.entries.every(e=>e.nativeId===null));assert(r.plan.entries[0].reasons.includes("INVALID_SOURCE_EVIDENCE"));assert(r.plan.entries[1].reasons.includes("OWNER_UNRESOLVED"));assert(r.plan.entries[2].reasons.includes("OWNER_CONFLICT"));assert(r.plan.entries[3].reasons.includes("INVALID_SOURCE_EVIDENCE"));
});
test("D17 stale owner registry and unknown parser versions fail before allocations",async t=>{
    const f=await fixture("memory",t),s=snapshot();await rejects(()=>f.repo.execute(prepare(f.repo,{...s,registryRevision:"r2"})),"OWNER_CONFLICT");await rejects(()=>f.repo.execute(prepare(f.repo,{...s,parserVersion:2})),"UNSUPPORTED_VERSION");assert.equal(f.repo.snapshot().revision,0);
    assert.throws(()=>D.registry([{owner:{type:"resource",id:"Knowledge"},root:"Resources/Knowledge",shared:false}]),/stable Resource identities/);
});
test("D02 allocator exhaustion cannot publish a duplicate planned/external UUID",async t=>{
    const f=await fixture("memory",t,{idFactory:()=>id(1),reservations:[{id:id(1),kind:"step",owner:owner("private"),status:"retired"}]});const before=f.repo.snapshot();await rejects(()=>f.repo.execute(prepare(f.repo,snapshot([{entryId:"a"}]))),"ALLOCATION_CONFLICT");assert.deepEqual(f.repo.snapshot(),before);
});
test("D02/D17 new operation/plan/snapshot labels cannot reallocate a captured ID-less occurrence",async t=>{
    const f=await fixture("memory",t),s=snapshot([{entryId:"idless"}]);await prepared(f.repo,s);const old=f.repo.snapshot();
    const renamed=D.clone(s);renamed.id="new-label";renamed.occurrences[0].entryId="new-entry-label";
    await rejects(()=>f.repo.execute(prepare(f.repo,renamed,"new-plan","new-operation")),"SOURCE_CONFLICT");
    renamed.files[0].id="new-file-label";renamed.occurrences[0].fileId="new-file-label";
    await rejects(()=>f.repo.execute(prepare(f.repo,renamed,"another-plan","another-operation")),"SOURCE_CONFLICT");assert.deepEqual(f.repo.snapshot(),old);
});
