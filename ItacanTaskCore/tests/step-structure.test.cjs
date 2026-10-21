"use strict";
const{test}=require("node:test"),assert=require("node:assert/strict");
const S=require("./step-content-support.cjs"),{core,privateContent,id,fixture,drafts,edit,attachment,newStep,visible,envelope,clone}=S;
const reject=(fn,code)=>assert.rejects(fn,e=>!code||e.code===code);
for(const kind of["memory","json"]){
    for(const mode of["first","between","append","reorder","reparent","move-between-groups","three-level-insert"])test(kind+": D05 atomic sibling/subtree operation "+mode,async t=>{
        const f=await fixture(kind,t),task=f.initial,ds=drafts(task),by=id=>ds.find(s=>s.id===id);
        if(mode==="first"){for(const s of ds)if(s.parentStepId===null)s.order++;ds.push(newStep(201,null,0));}
        else if(mode==="between"){by(id(104)).order=2;ds.push(newStep(201,null,1));}
        else if(mode==="append")ds.push(newStep(201,null,2));
        else if(mode==="reorder"){by(id(101)).order=1;by(id(104)).order=0;}
        else if(mode==="reparent"){by(id(101)).parentStepId=id(104);by(id(101)).order=0;by(id(104)).order=0;}
        else if(mode==="move-between-groups"){by(id(102)).parentStepId=id(104);by(id(102)).order=0;}
        else ds.push(newStep(201,id(103),0));
        const c=edit(task,{draft:{version:1,taskId:task.id,expectedRevision:task.revision,steps:ds}}),r=await f.repo.execute(c);
        assert.equal(r.task.revision,2);assert.equal(r.task.completed,false);assert.equal(f.repo.queryHistory().length,0);assert.equal(r.change.eventIds.length,0);assert.equal(r.task.steps.find(s=>s.id===id(103)).parentStepId,id(102));
        assert(task.steps.every(s=>r.task.steps.some(n=>n.id===s.id)));core.validateTask(r.task);assert.deepEqual((await f.repo.execute(c)).task,r.task);assert.equal((await f.repo.execute(c)).replayed,true);
        await f.reopen();assert.deepEqual(f.repo.getTask(task.id),r.task);
    });
    for(const mode of["missing-parent","foreign-parent","self-parent","cycle","duplicate-id","duplicate-order","gapped-order","negative-order","omitted-step","missing-parent-field","wrong-parent-task","completion-change","new-completed-step"])test(kind+": D05 invalid full draft publishes nothing: "+mode,async t=>{
        const f=await fixture(kind,t),task=f.initial,ds=drafts(task);let draft={version:1,taskId:task.id,expectedRevision:task.revision,steps:ds};
        if(mode==="missing-parent"||mode==="foreign-parent")ds[0].parentStepId=id(999);
        else if(mode==="self-parent")ds[0].parentStepId=ds[0].id;
        else if(mode==="cycle")ds[0].parentStepId=id(102);
        else if(mode==="duplicate-id")ds.push({...ds[0]});
        else if(mode==="duplicate-order")ds[3].order=0;
        else if(mode==="gapped-order")ds[3].order=3;
        else if(mode==="negative-order")ds[0].order=-1;
        else if(mode==="omitted-step")ds.splice(3,1);
        else if(mode==="missing-parent-field")delete ds[0].parentStepId;
        else if(mode==="wrong-parent-task")draft.taskId=id(2);
        else if(mode==="completion-change")ds[0].completed=true;
        else ds.push({...newStep(201,null,2),completed:true});
        const before=visible(f.repo),revision=f.repo.info().revision,c=edit(task,{draft});await reject(()=>f.repo.execute(c));assert.deepEqual(visible(f.repo),before);assert.equal(f.repo.getReceipt(c.operationId),null);assert.equal(f.repo.info().revision,revision);
    });
    test(kind+": D05 global parent/Step IDs cannot be borrowed from another task",async t=>{
        const f=await fixture(kind,t);await f.repo.execute({type:"task.create",operationId:"other",payload:{task:{id:id(2),owner:f.ownerContext.owner,title:"Other",steps:[{id:id(301),title:"Foreign",order:0}]}}});
        const ds=drafts(f.initial);ds.push(newStep(301,null,2));const c=edit(f.initial,{draft:{version:1,taskId:id(1),expectedRevision:1,steps:ds}});await reject(()=>f.repo.execute(c),"IDENTITY_CONFLICT");assert.equal(f.repo.queryTasks().length,2);
    });
    test(kind+": D05 leaf deletion explicitly renumbers surviving siblings",async t=>{
        const f=await fixture(kind,t),task=f.initial,ds=drafts(task).filter(s=>s.id!==id(104));const r=await f.repo.execute(edit(task,{draft:{version:1,taskId:task.id,expectedRevision:1,steps:ds},deletions:[{stepId:id(104),cascade:false,descendantIds:[]}]}));assert.equal(r.task.steps.length,3);assert.equal(r.task.steps[0].order,0);assert.equal(f.repo.queryHistory().length,0);
    });
    test(kind+": D05 cascade is explicit, descendant-confirmed and revision guarded",async t=>{
        const f=await fixture(kind,t,{completedStep:true});let task=(await f.repo.execute(attachment(f.initial))).task;const original=clone(privateContent.contentOf(task).originals),history=f.repo.queryHistory();
        const ds=drafts(task).filter(s=>s.id===id(104));ds[0].order=0;const patch={draft:{version:1,taskId:task.id,expectedRevision:task.revision,steps:ds},deletions:[{stepId:id(101),cascade:false,descendantIds:[id(102),id(103)]}]};
        await reject(()=>f.repo.execute(edit(task,patch,"unsafe")));patch.deletions[0].cascade=true;
        const incomplete=clone(patch);incomplete.deletions[0].descendantIds=[id(102)];await reject(()=>f.repo.execute(edit(task,incomplete,"changed-descendants")));
        const c=edit(task,patch,"cascade"),r=await f.repo.execute(c);assert.deepEqual(r.task.steps.map(s=>s.id),[id(104)]);assert.deepEqual(f.repo.queryHistory(),history);assert.equal(r.change.eventIds.length,0);assert.deepEqual(privateContent.contentOf(r.task).originals,original);
        const priorBodies=privateContent.contentOf(r.task).revisions.flatMap(r=>r.current.stepBodies);assert(priorBodies.some(b=>b.id===id(101)&&b.body==="CURRENT_STEP_BODY"));assert.deepEqual(privateContent.contentOf(r.task).revisions.at(-1).removedStepIds.sort(),[id(101),id(102),id(103)].sort());
        assert.equal((await f.repo.execute(c)).replayed,true);await reject(()=>f.repo.execute({...c,payload:{...c.payload,taskPatch:{title:"Different replay"}}}),"OPERATION_CONFLICT");
        const again=edit(r.task,{},"reuse");again.payload.draft.steps.push(newStep(101,null,1));await reject(()=>f.repo.execute(again),"IDENTITY_CONFLICT");
        await reject(()=>f.repo.execute({...c,operationId:"stale-cascade"}),"REVISION_CONFLICT");await f.reopen();assert.deepEqual(f.repo.queryHistory(),history);
    });
    test(kind+": D06 reparent/title/body/description and source evidence commit together",async t=>{
        const f=await fixture(kind,t),c=attachment(f.initial,{taskPatch:{title:"Current title",description:"Current explicit description"}});const ds=c.payload.draft.steps;ds.find(s=>s.id===id(101)).parentStepId=id(104);ds.find(s=>s.id===id(104)).order=0;ds[0].title="Edited and moved";
        const r=await f.repo.execute(c),content=privateContent.contentOf(r.task);assert.equal(r.task.steps.find(s=>s.id===id(101)).parentStepId,id(104));assert.equal(content.revisions.at(-1).taskRevision,r.task.revision);assert.equal(content.originals.length,1);assert(Buffer.from(core.originalBytes(content.originals[0])).toString().includes("Original"));assert.equal(content.originals[0].parsed.explicitDescription,"Original explicit description");assert.equal(r.task.description,"Current explicit description");
        assert.equal(f.repo.queryHistory().length,0);await f.reopen();assert.deepEqual(f.repo.getTask(r.task.id),r.task);
    });
    test(kind+": D06 existing commands preserve original bytes and advance content/native linkage",async t=>{
        const f=await fixture(kind,t);let task=(await f.repo.execute(attachment(f.initial))).task;const originals=clone(privateContent.contentOf(task).originals);
        task=(await f.repo.execute({type:"task.update",operationId:"existing-update",taskId:task.id,expectedRevision:task.revision,payload:{patch:{title:"New native title",description:"New native description"}}})).task;
        task=(await f.repo.execute({type:"step.update",operationId:"existing-step-update",taskId:task.id,expectedRevision:task.revision,payload:{stepId:id(101),patch:{title:"New Step title"}}})).task;
        task=(await f.repo.execute({type:"step.reorder",operationId:"existing-reorder",taskId:task.id,expectedRevision:task.revision,payload:{parentStepId:null,stepIds:[id(104),id(101)]}})).task;
        assert.deepEqual(privateContent.contentOf(task).originals,originals);assert.equal(privateContent.contentOf(task).revisions.at(-1).taskRevision,task.revision);assert.equal(f.repo.queryHistory().length,0);core.validateTask(task);
    });
    test(kind+": D06 source-independent insertion keeps explicit body without fabricating provenance",async t=>{
        const f=await fixture(kind,t,{task:{steps:[]}}),task=f.initial,step={...newStep(201,null,0),body:"Fresh current body [[link|label]]"};
        const c=edit(task,{draft:{version:1,taskId:task.id,expectedRevision:1,steps:[step]},content:{version:1,expectedRevision:0,appendOriginals:[],continuation:"Fresh current continuation"}}),r=await f.repo.execute(c),e=privateContent.contentOf(r.task);
        assert.equal(r.task.captureSource,null);assert.deepEqual(e.originals,[]);assert.equal(e.revisions.at(-1).current.stepBodies[0].body,step.body);assert(!JSON.stringify(core.currentSearchProjection(r.task,r.task.owner)).includes("Source.md"));await f.reopen();assert.deepEqual(f.repo.getTask(task.id),r.task);
    });
    test(kind+": D06 earlier private migration evidence survives wrapping and public export",async t=>{
        const prior={aliasReceipt:"PRIVATE_IDENTITY_RECEIPT",quarantine:"PRIVATE_QUARANTINE",plan:"PRIVATE_PLAN"},migration={source:"synthetic-old",sourceId:"old-source",importedAt:null,evidence:prior};
        const f=await fixture(kind,t,{task:{migration}}),r=await f.repo.execute(attachment(f.initial));assert.deepEqual(privateContent.contentOf(r.task).previousEvidence,prior);assert.equal(r.task.migration.source,"synthetic-old");const packet=f.repo.exportSharedPartition("git-a");for(const value of Object.values(prior))assert(!packet.includes(value));await f.reopen();assert.deepEqual(privateContent.contentOf(f.repo.getTask(id(1))).previousEvidence,prior);
    });
    test(kind+": D06 old add/complete/reopen/delete commands keep content and History coherent",async t=>{
        const f=await fixture(kind,t);let task=(await f.repo.execute(attachment(f.initial))).task;const originals=clone(privateContent.contentOf(task).originals);
        const run=async(type,payload,operationId)=>{task=(await f.repo.execute({type,taskId:task.id,expectedRevision:task.revision,operationId,payload})).task;core.validateTask(task);assert.equal(privateContent.contentOf(task).revisions.at(-1).taskRevision,task.revision);};
        await run("step.add",{step:{id:id(201),order:2,title:"Old add"}},"old-add");assert.equal(privateContent.contentOf(task).revisions.at(-1).current.stepBodies.find(b=>b.id===id(201)).body,"");
        await run("step.complete",{stepId:id(201),completed:true,completedAt:null},"old-complete");await run("step.complete",{stepId:id(201),completed:false},"old-reopen");await run("step.delete",{stepId:id(201)},"old-delete");assert.equal(f.repo.queryHistory().length,1);assert.equal(f.repo.queryHistory()[0].counted,false);assert.deepEqual(privateContent.contentOf(task).originals,originals);await f.reopen();assert.deepEqual(f.repo.getTask(task.id),task);
    });
    test(kind+": D05 rejected draft does not reserve explicit new Step identities",async t=>{
        const f=await fixture(kind,t),ds=drafts(f.initial);ds.push(newStep(201,id(999),0));const draft={version:1,taskId:id(1),expectedRevision:1,steps:ds};await reject(()=>f.repo.execute(edit(f.initial,{draft},"bad-reservation")));ds.at(-1).parentStepId=null;ds.at(-1).order=2;const r=await f.repo.execute(edit(f.initial,{draft},"valid-reservation"));assert(r.task.steps.some(s=>s.id===id(201)));
    });
    test(kind+": D06 foreign physical source owner cannot attach to native task",async t=>{
        const f=await fixture(kind,t),foreign=clone(f.initial);foreign.owner=S.context("hub").owner;const c=attachment(f.initial);c.payload.content.appendOriginals=[envelope(foreign)];const before=visible(f.repo);await reject(()=>f.repo.execute(c),"OWNER_CONFLICT");assert.deepEqual(visible(f.repo),before);
    });
    test(kind+": D06 original capture cannot be replaced/relabelled and content guards are mandatory",async t=>{
        const f=await fixture(kind,t);const task=(await f.repo.execute(attachment(f.initial))).task,old=visible(f.repo),c=edit(task,{},"rebase");c.payload.content.appendOriginals=[envelope(task,"- [ ] Changed source\n",{id:"relabeled-source"})];await reject(()=>f.repo.execute(c),"SOURCE_CONFLICT");assert.deepEqual(visible(f.repo),old);
        await reject(()=>f.repo.execute(edit(task,{content:null},"no-guard")));const stale=edit(task,{},"stale-content");stale.payload.content.expectedRevision=0;await reject(()=>f.repo.execute(stale));assert.deepEqual(visible(f.repo),old);
    });
    test(kind+": D05 independent completion survives structure edits with unknown time",async t=>{
        const f=await fixture(kind,t,{completedStep:true}),task=f.initial,history=f.repo.queryHistory(),c=edit(task);c.payload.draft.steps[0].title="Renamed";const r=await f.repo.execute(c);assert.equal(r.task.completed,false);assert.equal(r.task.steps[0].completed,true);assert.equal(r.task.steps[0].completedAt,null);assert.deepEqual(f.repo.queryHistory(),history);
    });
    test(kind+": D05 two edits/reparent/delete on one revision cannot both succeed",async t=>{
        const f=await fixture(kind,t),task=f.initial,a=edit(task,{taskPatch:{title:"Winner"}},"a"),b=edit(task,{taskPatch:{title:"Other"}},"b");
        const rs=await Promise.allSettled([f.repo.execute(a),f.repo.execute(b)]);assert.equal(rs.filter(r=>r.status==="fulfilled").length,1);assert.equal(rs.find(r=>r.status==="rejected").reason.code,"REVISION_CONFLICT");assert.equal(f.repo.getReceipt("b"),null);
    });
}
for(const context of S.contexts)test("D06 owner/privacy export boundary "+context.key,async t=>{
    const f=await fixture("memory",t,{ownerKey:context.key}),c=attachment(f.initial);
    if(context.kind==="resource")c.payload.content.appendOriginals=[envelope(f.initial,S.source,{metadata:{unknown:"PRIVATE_METADATA",mountedIn:["Projects/Itacan","Projects/Obsidian Hub"],identityReceipt:"PRIVATE_IDENTITY_RECEIPT"}})];
    const task=(await f.repo.execute(c)).task,p=core.currentSearchProjection(task,context.owner),str=JSON.stringify(p);
    for(const sentinel of["HISTORICAL_ONLY_SENTINEL","PRIVATE_METADATA","PRIVATE_HISTORY","PRIVATE_OATH","Source.md","legacy-source"])assert(!str.includes(sentinel),sentinel);
    assert(str.includes("CURRENT_CONTINUATION")&&str.includes("CURRENT_STEP_BODY"));assert.equal(p.description,"Native explicit description");assert.equal(p.parity.startsWith("unverified"),true);
    assert.throws(()=>core.currentSearchProjection(task,S.context(context.key==="itacan"?"hub":"itacan").owner));
    if(context.kind==="git-project"){const packet=f.repo.exportSharedPartition(context.partition);for(const sentinel of["HISTORICAL_ONLY_SENTINEL","PRIVATE_METADATA","PRIVATE_HISTORY","PRIVATE_OATH","CURRENT_STEP_BODY","Source.md","legacy-source"])assert(!packet.includes(sentinel));assert.equal(JSON.parse(packet).tasks.length,1);}else assert.throws(()=>f.repo.exportSharedPartition(context.partition),e=>e.code==="PARTITION_PRIVATE");
    if(context.kind==="resource")for(const project of["git-a","git-b"]){const packet=f.repo.exportSharedPartition(project);assert.equal(JSON.parse(packet).tasks.length,0);for(const sentinel of["HISTORICAL_ONLY_SENTINEL","PRIVATE_METADATA","CURRENT_STEP_BODY"])assert(!packet.includes(sentinel));}
    assert.equal(task.owner.type,context.owner.type);assert.equal(task.location,null);
});
test("D06 current Search specimen distinguishes fields and same titles, without provenance promotion",async t=>{
    const f=await fixture("memory",t),task=(await f.repo.execute(attachment(f.initial))).task,p=core.currentSearchProjection(task,task.owner);
    const{nameScore}=require("../../.obsidian/plugins/hub-project-menu/lib/domain/context-search");assert(nameScore(p.title,"Native")>0);assert(p.description.includes("description"));assert(p.continuation.includes("CURRENT"));assert(p.steps.some(s=>s.body.includes("CURRENT_STEP")));assert(Object.hasOwn(p.metadata,"importance"));assert(!JSON.stringify(p).includes("HISTORICAL_ONLY"));
    const copy=clone(task);copy.description="Other current content";copy.migration=null;const other=core.currentSearchProjection(copy,copy.owner);assert.equal(p.title,other.title);assert.notEqual(p.description,other.description);
});
test("D06 N1-A content vectors define explicit future Search fields, with no ranking parity claim",async t=>{
    const fs=require("node:fs"),path=require("node:path"),{nameScore}=require("../../.obsidian/plugins/hub-project-menu/lib/domain/context-search");
    const vectors=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../.obsidian/plugins/hub-project-menu/lib/tests/native-migration-compatibility-v1.json"),"utf8")),projections=[];
    for(const caseId of["TEXT-markdown","TEXT-explicit-description","TEXT-extra-multiline-description","TEXT-extra-same-title-block-a","TEXT-extra-same-title-block-b"]){
        const vector=vectors.cases.find(c=>c.caseId===caseId),f=await fixture("memory",t,{task:{steps:[],importance:"must"}}),task=f.initial,e=envelope(task,vector.legacyInput.source),parsed=e.parsed;
        // Explicit synthetic current-content choices, never an automatic source import.
        const steps=parsed.steps.map((s,i)=>({...newStep(201+i,s.parentIndex===null?null:id(201+s.parentIndex),s.order,s.title),body:"Current nested body"}));
        const description=vector.observedLegacyResult.value.normalized.description;
        const c=edit(task,{draft:{version:1,taskId:task.id,expectedRevision:1,steps},taskPatch:{title:parsed.title,description},content:{version:1,expectedRevision:0,appendOriginals:[e],continuation:parsed.continuation}});
        const current=(await f.repo.execute(c)).task,p=core.currentSearchProjection(current,current.owner);assert.equal(nameScore(p.title,"Parent"),0);assert.equal(p.description,description);assert.equal(p.continuation,parsed.continuation);assert.equal(p.metadata.importance,"must");assert(!JSON.stringify(p).includes("PRIVATE_HISTORY"));assert(!Object.hasOwn(p,"source"));assert(p.parity.startsWith("unverified"));
        if(caseId==="TEXT-markdown"){assert(p.continuation.includes("[[Note|alias]]"));assert(p.continuation.includes("**bold**"));assert.equal(p.steps[0].title,"Child");assert.equal(p.steps[0].body,"Current nested body");}
        projections.push({caseId,p});
    }
    const a=projections.find(x=>x.caseId.endsWith("block-a")).p,b=projections.find(x=>x.caseId.endsWith("block-b")).p;assert.equal(a.title,b.title);assert.notEqual(a.continuation,b.continuation);
});
