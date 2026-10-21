"use strict";
const{test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),{spawnSync}=require("node:child_process");
const S=require("./step-content-support.cjs"),{core,privateContent,id,fixture,edit,attachment,visible,diskState,clone}=S;
const{openJsonRepository,digest,encodeManifest}=require("../src/json-repository"),{preserveAbandonedIdentityLock}=require("../identity/node-store");
function cascade(task){const c=edit(task,{},"atomic-cascade");c.payload.draft.steps=c.payload.draft.steps.filter(s=>s.id===id(104));c.payload.draft.steps[0].order=0;c.payload.taskPatch.title="Cascade and content committed";c.payload.content.continuation="AFTER_CASCADE_CURRENT";c.payload.deletions=[{stepId:id(101),cascade:true,descendantIds:[id(102),id(103)]}];return c;}
const preStages=["beforeCommandValidation","beforeDraftNormalization","beforeHierarchyValidation","beforeSourceEnvelopeAttachment","afterContentStaging","beforeReceiptPersistence","beforeCommit"];
for(const kind of["memory","json"]){
    for(const stage of preStages)test(kind+": D05/D06 precommit failure keeps one coherent old task: "+stage,async t=>{
        let armed=false;const f=await fixture(kind,t,{fault:s=>{if(armed&&s===stage){armed=false;throw Error("Synthetic boundary failure");}}}),c=attachment(f.initial);c.payload.taskPatch.title="New content title";const before=visible(f.repo);armed=true;
        await assert.rejects(()=>f.repo.execute(c));assert.deepEqual(visible(f.repo),before);assert.equal(f.repo.getReceipt(c.operationId),null);await f.reopen();assert.deepEqual(visible(f.repo),before);const r=await f.repo.execute(c);assert.equal(privateContent.contentOf(r.task).revisions.at(-1).taskRevision,r.task.revision);
    });
    test(kind+": D05/D06 committed reply loss reopens/replays one structure/content revision",async t=>{
        let armed=false;const f=await fixture(kind,t,{fault:s=>{if(armed&&s==="beforeAcknowledgement"){armed=false;throw Error("reply lost");}}});const task=(await f.repo.execute(attachment(f.initial))).task,c=cascade(task),original=clone(privateContent.contentOf(task).originals);armed=true;
        await assert.rejects(()=>f.repo.execute(c),e=>e.code==="ACKNOWLEDGEMENT_LOST");await f.reopen();const r=await f.repo.execute(c);assert(r.replayed);assert.deepEqual(r.task.steps.map(s=>s.id),[id(104)]);assert.deepEqual(privateContent.contentOf(r.task).originals,original);assert.equal(privateContent.contentOf(r.task).revisions.length,2);assert.equal(f.repo.queryHistory().length,0);
    });
    test(kind+": D05/D06 concurrent reparent/reorder/edit/delete rejects stale winner alternatives",async t=>{
        const f=await fixture(kind,t),task=(await f.repo.execute(attachment(f.initial))).task,a=edit(task,{taskPatch:{title:"First writer"}},"first"),b=cascade(task);
        a.payload.draft.steps.find(s=>s.id===id(101)).parentStepId=id(104);a.payload.draft.steps.find(s=>s.id===id(104)).order=0;
        const rs=await Promise.allSettled([f.repo.execute(a),f.repo.execute(b)]);assert.equal(rs.filter(r=>r.status==="fulfilled").length,1);assert.equal(rs.find(r=>r.status==="rejected").reason.code,"REVISION_CONFLICT");assert.equal(f.repo.getReceipt(b.operationId),null);core.validateTask(f.repo.getTask(task.id));
    });
    test(kind+": D05/D06 same operation receipts retain original result after later content edits",async t=>{
        const f=await fixture(kind,t),c=attachment(f.initial),first=await f.repo.execute(c);const later=edit(first.task,{taskPatch:{title:"Later title"}},"later");await f.repo.execute(later);const replay=await f.repo.execute(c);assert.deepEqual(replay.task,first.task);assert(replay.replayed);assert.notEqual(f.repo.getTask(id(1)).title,replay.task.title);
        await assert.rejects(()=>f.repo.execute({...c,payload:{...c.payload,taskPatch:{title:"Changed replay"}}}),e=>e.code==="OPERATION_CONFLICT");
    });
    test(kind+": D05/D06 unknown versions and corrupt capture reject atomically",async t=>{
        const f=await fixture(kind,t),before=visible(f.repo);
        for(const type of["command","draft","content","envelope","checksum","capability","range"]){const c=attachment(f.initial,{},"bad-"+type);if(type==="command")c.payload.version=2;else if(type==="draft")c.payload.draft.version=2;else if(type==="content")c.payload.content.version=2;else if(type==="envelope")c.payload.content.appendOriginals[0].version=2;else if(type==="checksum")c.payload.content.appendOriginals[0].checksum="0".repeat(64);else if(type==="capability")c.payload.content.requiredCapabilities=["unknown"];else c.payload.content.appendOriginals[0].region.start++;
            await assert.rejects(()=>f.repo.execute(c));assert.deepEqual(visible(f.repo),before);assert.equal(f.repo.getReceipt(c.operationId),null);}
    });
}
for(const stage of["beforeSerialize","beforeTemporaryWrite","duringTemporaryWrite","beforeFlush","afterFlush","beforeGenerationVerify","afterGenerationPublish","beforeManifestReplace","afterManifestCommit"])test("JSON: D05/D06 actual generation failure "+stage,async t=>{
    let armed=false;const f=await fixture("json",t,{fault:s=>{if(armed&&s===stage){armed=false;throw Error("storage fault");}}}),task=(await f.repo.execute(attachment(f.initial))).task,c=cascade(task);armed=true;
    await assert.rejects(()=>f.repo.execute(c));await f.reopen();const committed=stage==="afterManifestCommit",current=f.repo.getTask(task.id),content=privateContent.contentOf(current);assert.equal(current.steps.length,committed?1:4);assert.equal(content.revisions.length,committed?2:1);assert.equal(content.revisions.at(-1).taskRevision,current.revision);const r=await f.repo.execute(c);assert.equal(r.replayed,committed);assert.equal(f.repo.queryHistory().length,0);
});
async function corruptCurrent(directory,change){const pp=path.join(directory,"CURRENT.json"),m=JSON.parse(await fs.readFile(pp,"utf8")).payload,file=path.join(directory,m.current.file),state=JSON.parse(await fs.readFile(file,"utf8"));change(state);const raw=privateContent.canonical(state)+"\n";await fs.writeFile(file,raw);m.current.sha256=digest(raw);await fs.writeFile(pp,encodeManifest(m));}
for(const type of["capture checksum","revision checksum","content linkage","receipt","byte range","originals removed","carrier removed","previous evidence changed"])test("JSON: D06 corrupt current state recovers only a reported coherent committed ancestor: "+type,async t=>{
    const f=await fixture("json",t),attached=(await f.repo.execute(attachment(f.initial))).task;await f.repo.execute(edit(attached,{taskPatch:{title:"Latest"}},"latest"));await f.close();
    await corruptCurrent(f.directory,s=>{const c=privateContent.contentOf(s.tasks[0]);if(type==="capture checksum")c.originals[0].checksum="0".repeat(64);else if(type==="revision checksum")c.revisions.at(-1).digest="0".repeat(64);else if(type==="content linkage")c.revisions.at(-1).taskRevision++;else if(type==="receipt")s.receipts.pop();else if(type==="originals removed")c.originals=[];else if(type==="carrier removed")s.tasks[0].migration=null;else if(type==="previous evidence changed")c.previousEvidence={corrupt:true};else c.originals[0].region.start++;});
    const r=await openJsonRepository(f.options);try{assert(r.info().recovery);assert.equal(r.getTask(id(1)).revision,attached.revision);assert.equal(privateContent.contentOf(r.getTask(id(1))).revisions.at(-1).taskRevision,attached.revision);assert.deepEqual(privateContent.contentOf(r.getTask(id(1))).originals,privateContent.contentOf(attached).originals);}finally{await r.close();}
});
test("JSON: D06 transient I/O failure during reopening preserves committed evidence",async t=>{
    const f=await fixture("json",t),task=(await f.repo.execute(attachment(f.initial))).task;await f.close();
    const{NodeDirectory}=require("../src/node-directory"),port=new NodeDirectory(f.directory),read=port.read.bind(port);let armed=true;
    port.read=async name=>{if(armed&&name==="CURRENT.json"){armed=false;throw Object.assign(Error("Synthetic recovery read failure"),{code:"EIO"});}return read(name);};
    const before=await diskState(f.directory);await assert.rejects(()=>openJsonRepository({...f.options,storagePort:port}));assert.deepEqual(await diskState(f.directory),before);
    const r=await f.reopen();assert.deepEqual(r.getTask(task.id),task);assert.equal((await r.execute(attachment(f.initial))).replayed,true);
});
for(const type of["content version","envelope version","parser version","required capability","decision revision"])test("JSON: D06 newer private contracts stop without ancestry downgrade: "+type,async t=>{
    const f=await fixture("json",t),attached=(await f.repo.execute(attachment(f.initial))).task;await f.repo.execute(edit(attached,{taskPatch:{title:"Latest"}},"latest"));await f.close();
    await corruptCurrent(f.directory,s=>{const c=privateContent.contentOf(s.tasks[0]);if(type==="content version")c.version=2;else if(type==="envelope version")c.originals[0].version=2;else if(type==="parser version")c.originals[0].parserVersion=2;else if(type==="required capability")c.requiredCapabilities.push("future-content");else c.decisionRevision="future";});
    const before=await fs.readdir(f.directory),raw=await fs.readFile(path.join(f.directory,"CURRENT.json"));await assert.rejects(()=>openJsonRepository(f.options),e=>e.code==="UNSUPPORTED_SCHEMA");assert.deepEqual(await fs.readdir(f.directory),before);assert.deepEqual(await fs.readFile(path.join(f.directory,"CURRENT.json")),raw);
});
for(const stage of["afterContentStaging","beforeReceiptPersistence","duringTemporaryWrite","afterGenerationPublish","beforeManifestReplace","afterManifestCommit","beforeAcknowledgement"])test("process crash: D05/D06 whole structure/content recovery "+stage,async t=>{
    const f=await fixture("json",t),task=(await f.repo.execute(attachment(f.initial))).task,c=cascade(task);await f.close();
    const guard=process.execArgv.filter(a=>a!=="--test"),child=spawnSync(process.execPath,[...guard,path.join(__dirname,"step-content-crash.cjs"),f.directory,stage,JSON.stringify(c)],{env:{...process.env,ELECTRON_RUN_AS_NODE:"1"},windowsHide:true,timeout:20000,encoding:"utf8"});assert.equal(child.status,84,child.stderr);
    await assert.rejects(()=>openJsonRepository(f.options),e=>e.code==="LOCK_HELD");const lockRaw=await fs.readFile(path.join(f.directory,"WRITER.lock"),"utf8");await preserveAbandonedIdentityLock({directory:f.directory,expectedRaw:lockRaw,confirmDeadWriter:true});
    const r=await f.reopen(),committed=["afterManifestCommit","beforeAcknowledgement"].includes(stage),current=r.getTask(id(1));assert.equal(current.steps.length,committed?1:4);assert.equal(privateContent.contentOf(current).revisions.length,committed?2:1);core.validateTask(current);
    const result=await r.execute(c);assert.equal(result.replayed,committed);assert.equal(result.task.steps.length,1);assert.equal(privateContent.contentOf(result.task).revisions.at(-1).taskRevision,result.task.revision);assert.equal(r.queryHistory().length,0);const state=await diskState(f.directory);assert.deepEqual(state.retiredStepIds.sort(),[id(101),id(102),id(103)].sort());assert.equal(Object.hasOwn(state,"stepTombstones"),false);
});
