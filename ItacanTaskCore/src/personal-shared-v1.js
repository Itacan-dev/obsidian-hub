"use strict";
// Personal profile v1. Existing private receipts are a validated enrollment base,
// never renumbered remote local receipts. Git packet grammars remain separate.
const V = require("./value"), M = require("../personal/membership"), E = require("../personal/enrollment"), { check, fail } = require("./errors");
const same = (a,b) => V.canonical(a) === V.canonical(b), hash = M.hash, exact = M.exact;
const TYPES = ["task.createRich", "task.save", "task.complete", "step.complete", "task.delete"];
const PERSONAL = ["personal.enroll", "personal.bootstrap", "personal.receive"];
const VIEW = ["tasks", "history", "bindings", "retiredStepIds"];
const view = s => Object.fromEntries(VIEW.map(k => [k,V.clone(s[k])]));
const hex = v => check(typeof v === "string" && /^[a-f0-9]{64}$/.test(v), "Personal digest required.");
function packet(ns) { return { format: "itacan-personal-native", version: 1, ...Object.fromEntries(["binding","seed","members","head","frames"].map(k=>[k,V.clone(ns[k])])) }; }
function namespace(p) {
    V.jsonValue(p); exact(p,["format","version","binding","seed","members","head","frames"]);
    check(p.format === "itacan-personal-native" && p.version === 1, "Personal packet v1 required.");
    return { ...V.clone(p), format: "itacan-personal-origin-state" };
}
function delta(before,after,r) {
    return { history: r.result.change.eventIds.map(id=>{const e=after.history.find(e=>e.id===id);check(e,"Missing personal event effect.");return V.clone(e)}),
        bindings: { remove: before.bindings.filter(b=>!after.bindings.some(n=>same(b,n))).map(b=>b.eventId), add: after.bindings.filter(b=>!before.bindings.some(n=>same(b,n))).map(V.clone) },
        retiredStepIds: after.retiredStepIds.filter(id=>!before.retiredStepIds.includes(id)) };
}
function changes(before,after,summary) {
    return { taskIds: after.tasks.filter(t=>!same(t,before.tasks.find(x=>x.id===t.id)??null)).map(t=>t.id),
        eventIds: after.history.filter(e=>!same(e,before.history.find(x=>x.id===e.id)??null)).map(e=>e.id), partitionIds:[before.partitions[0].id], personal:summary };
}
function union(a,b) {
    check(same(a.binding,b.binding)&&same(a.seed,b.seed),"Personal binding/enrollment differs.");
    const records = key => {const m=new Map(a[key].map(v=>[key==="members"?v.digest:v.id,v]));for(const v of b[key]){const id=key==="members"?v.digest:v.id;check(!m.has(id)||same(m.get(id),v),"Conflicting immutable personal object.");m.set(id,v)}return [...m.values()].sort((x,y)=>(key==="members"?x.digest:x.id).localeCompare(key==="members"?y.digest:y.id))};
    return {...a,members:records("members"),frames:records("frames")};
}
function rootView(seed) {
    return { ...V.clone(seed.state), accepted:new Set(["seed:"+hash(seed)]),taskHeads:new Map(seed.state.tasks.map(t=>[t.id,"seed:"+hash(seed)])),conflicts:[] };
}
function empty(seed, revisionId) {
    V.uuid(revisionId); const p=seed.partition;
    return {schemaVersion:1,storeId:seed.authorityId,revision:0,revisionId,parentRevisionId:null,partitions:[{id:p.id,kind:p.kind,owner:V.clone(p.owner),revision:0,head:null,parentHead:null}],tasks:[],history:[],bindings:[],retiredStepIds:[],receipts:[],accepted:new Set(),taskHeads:new Map(),conflicts:[]};
}
function materialize(prior,f,seed) {
    const r=f.receipt,d=f.delta;exact(d,["history","bindings","retiredStepIds"]);exact(d.bindings,["remove","add"]);
    for(const value of [d.history,d.bindings.remove,d.bindings.add,d.retiredStepIds])check(Array.isArray(value),"Personal transition collection missing.");
    check(same(d.history.map(e=>e.id),r.result.change.eventIds),"Personal event coverage differs.");
    const replace=(a,b,key)=>{check(new Set(b.map(x=>x[key])).size===b.length,"Duplicate personal transition target.");const m=new Map(b.map(x=>[x[key],x]));return a.map(x=>{const v=m.get(x[key])??x;m.delete(x[key]);return v}).concat([...m.values()]).map(V.clone)};
    check(same(r.result.change.taskIds,r.result.tasks.map(t=>t.id)),"Personal task coverage differs.");
    r.result.tasks.forEach(t=>{require("./domain").validateTask(t);check(t.partitionId===seed.partition.id&&same(t.owner,seed.owner),"Foreign personal task.")});
    d.history.forEach(e=>{require("./domain").validateHistory(e);check(e.partitionId===seed.partition.id&&same(e.ownerAtEvent,seed.owner),"Foreign personal event.")});
    const removals=new Set(d.bindings.remove);check(removals.size===d.bindings.remove.length&&d.bindings.remove.every(id=>prior.bindings.some(b=>b.eventId===id)),"Unproven binding removal.");
    const out={schemaVersion:1,storeId:prior.storeId,revision:r.result.repositoryRevision,revisionId:r.result.revisionId,parentRevisionId:prior.revisionId,
        partitions:V.clone(r.result.change.partitions),tasks:replace(prior.tasks,r.result.tasks,"id"),history:replace(prior.history,d.history,"id"),
        bindings:prior.bindings.filter(b=>!removals.has(b.eventId)).concat(V.clone(d.bindings.add)),retiredStepIds:prior.retiredStepIds.concat(d.retiredStepIds),
        receipts:prior.receipts.concat(V.clone(r)),accepted:new Set(prior.accepted),taskHeads:new Map(prior.taskHeads),conflicts:V.clone(prior.conflicts)};
    if(JSON.parse(r.payload).type==="personal.receive"){out.tasks.sort((a,b)=>a.id.localeCompare(b.id));out.history.sort((a,b)=>a.id.localeCompare(b.id));out.bindings.sort((a,b)=>(a.stepId??a.taskId).localeCompare(b.stepId??b.taskId));out.retiredStepIds.sort();}
    return out;
}
function graph(ns,heads=[ns.head]) {
    V.jsonValue(ns);exact(ns,["format","version","binding","seed","members","head","frames"]);
    check(ns.format==="itacan-personal-origin-state"&&ns.version===1,"Personal namespace v1 required.");
    const seed=E.validate(ns.seed,ns.binding),keys=M.members(ns.binding,ns.members),baseline=rootView(seed),seedId=[...baseline.accepted][0];
    check(Array.isArray(ns.frames)&&ns.frames.length<=1024&&Buffer.byteLength(V.canonical(ns))<=64*1024*1024,"Personal proof capacity exceeded.");
    const frames=new Map(),commands=new Map(),operations=new Map(),memo=new Map(),visiting=new Set(),roots=new Set();let last=null;
    for(const f of ns.frames){
        exact(f,["version","id","parent","replicaId","clock","allocations","inventory","phases","receipt","packet","delta","signature"]);
        const {id,signature,...body}=f;hex(id);check(f.version===1&&hash(body)===id&&keys.has(f.replicaId)&&(!last||last<id),"Personal frame identity/order differs.");last=id;
        M.verify(keys.get(f.replicaId),["itacan-personal-frame-v1",ns.binding.spaceId,ns.seed.digest,id],signature);
        V.timestamp(f.clock);check(f.clock!==null,"Personal clock missing.");if(f.parent!==null)hex(f.parent);
        check(Array.isArray(f.allocations),"Personal allocations missing.");f.allocations.forEach(V.uuid);require("../shared/inventory").validate(f.inventory,seed.authorityId);
        exact(f.phases,["version","revision","values"]);check(f.phases.version===1&&Array.isArray(f.phases.values),"Personal Phase witness missing.");V.text(f.phases.revision);f.phases.values.forEach(p=>{exact(p,["projectId","phaseId"]);V.referenceId(p.projectId);V.referenceId(p.phaseId);check(seed.owner.type==="project"&&p.projectId===seed.owner.id,"Foreign personal Phase inventory.");});
        exact(f.receipt,["operationId","payload","result","partitionIds","coordination"]);
        const c=JSON.parse(f.receipt.payload);require("./commands").validateCommand(c);
        check(V.canonical(c)===f.receipt.payload&&c.operationId===f.receipt.operationId&&!operations.has(c.operationId)&&!seed.state.receipts.some(r=>r.operationId===c.operationId),"Conflicting personal operation.");
        check([...TYPES,...PERSONAL].includes(c.type)&&same(c.coordination??null,f.receipt.coordination),"Personal operation scope differs.");
        if(c.coordination){const x=c.coordination;exact(x,["service","id","evidence"]);const e=x.evidence;exact(e,["version","requestDigest","authorityId","ownerContextPin","identityPin","inventoryPin","phasePin","partitions"]);check(x.service==="itacan-native-writer-v1"&&x.id===c.operationId&&e.version===1&&e.authorityId===seed.authorityId&&e.inventoryPin===hash(f.inventory)&&e.phasePin===hash(f.phases)&&e.partitions.length===1&&e.partitions[0].id===seed.partition.id&&same(e.partitions[0].owner,seed.owner),"Personal writer evidence differs.");[e.requestDigest,e.ownerContextPin,e.inventoryPin,e.phasePin].forEach(hex);if(e.identityPin!==null)hex(e.identityPin);}
        frames.set(id,f);commands.set(id,c);operations.set(c.operationId,f);
    }
    const read=id=>{
        if(id===null||id===seedId)return baseline;if(memo.has(id))return memo.get(id);
        check(frames.has(id)&&!visiting.has(id),"Missing/cyclic personal ancestry.");visiting.add(id);
        const f=frames.get(id),c=commands.get(id),root=["personal.enroll","personal.bootstrap"].includes(c.type);
        let prior;
        if(root){check(f.parent===null&&!roots.has(f.replicaId),"Duplicate replica enrollment root.");roots.add(f.replicaId);check(c.payload.replicaId===f.replicaId&&c.payload.seedDigest===ns.seed.digest&&c.payload.bindingDigest===hash(ns.binding)&&c.payload.spaceId===ns.binding.spaceId,"Personal root commitment differs.");if(c.type==="personal.enroll")check(f.replicaId===ns.binding.root.replicaId,"Only the enrolled source may adopt.");prior=c.type==="personal.enroll"?baseline:empty(seed,c.payload.baseRevisionId);}
        else {check(f.parent!==null,"Personal operation lacks replica ancestry.");prior=read(f.parent);check(frames.get(f.parent).replicaId===f.replicaId,"Replica crossed local receipt lineage.");}
        const r=f.receipt,p=r.result.change.partitions[0];
        check(c.expectedRepositoryRevision===prior.revision&&r.result.repositoryRevision===prior.revision+1&&r.result.operationId===c.operationId&&r.result.replayed===false&&r.result.change.type===c.type&&r.result.change.operationId===c.operationId&&r.result.change.repositoryRevision===r.result.repositoryRevision,"Personal original publication guard differs.");
        check(r.partitionIds.length===1&&r.partitionIds[0]===seed.partition.id&&r.result.change.partitions.length===1&&p.id===seed.partition.id&&p.kind===seed.partition.kind&&same(p.owner,seed.owner)&&p.revision===prior.partitions[0].revision+1&&p.parentHead===prior.partitions[0].head,"Personal partition publication differs.");
        if(c.taskId)check(prior.tasks.find(t=>t.id===c.taskId)?.revision===c.expectedRevision,"Original personal task guard differs.");
        if(c.coordination)check(c.coordination.evidence.partitions[0].expectedRevision===prior.partitions[0].revision,"Original personal partition guard differs.");
        let out=materialize(prior,f,seed);
        if(root){check(f.packet===null,"Enrollment cannot claim a receive.");if(c.type==="personal.enroll")check(same(view(out),view(baseline)),"Enrollment changed native contents.");else check(same(view(out),view(baseline)),"Bootstrap changed enrollment contents.");out.accepted=new Set(baseline.accepted);out.taskHeads=new Map(baseline.taskHeads);}
        else if(c.type==="personal.receive"){
            exact(f.packet,["head","frameIds","members"]);check(Array.isArray(f.packet.frameIds)&&same(f.packet.frameIds,[...new Set(f.packet.frameIds)].sort()),"Personal packet references must be canonical and unique.");
            const packetMembers=M.members(ns.binding,f.packet.members),incoming={...ns,head:f.packet.head,frames:f.packet.frameIds.map(x=>{check(frames.has(x)&&packetMembers.has(frames.get(x).replicaId),"Personal packet dependency/member missing.");read(x);return frames.get(x)}),members:V.clone(f.packet.members)};
            const closure=new Set();function dependency(id){if(id===null||closure.has(id))return;check(f.packet.frameIds.includes(id),"Personal received packet omitted ancestry.");closure.add(id);const ref=frames.get(id);dependency(ref.parent);for(const x of ref.packet?.frameIds??[])dependency(x)}dependency(f.packet.head);check(closure.size===f.packet.frameIds.length,"Unreferenced received personal evidence.");
            check(c.payload.spaceId===ns.binding.spaceId&&c.payload.authorityId===seed.authorityId&&c.payload.partitionId===seed.partition.id&&c.payload.head===f.packet.head&&hash(packet(incoming))===c.payload.packetDigest,"Personal receive packet digest/binding differs.");
            const merged=reconcile(prior,read(f.packet.head));check(same(view(out),merged.view)&&same(r.result.personal,merged.summary),"Personal receive effects differ.");Object.assign(out,{accepted:merged.accepted,taskHeads:merged.taskHeads,conflicts:merged.conflicts});
        }else{check(f.packet===null&&!prior.conflicts.some(x=>x.taskId===c.taskId),"Personal operation targets a conflict.");out.accepted.add(id);for(const taskId of r.result.change.taskIds)out.taskHeads.set(taskId,id);}
        visiting.delete(id);memo.set(id,out);return out;
    };
    function reconcile(a,b){const nodes=new Map(frames);nodes.set(seedId,{parent:null});return require("./replication-graph").merge(a,b,nodes,read,id=>id===seedId?seed.state.tasks.map(t=>t.id):frames.get(id).receipt.result.change.taskIds,id=>id===seedId?seed.state.retiredStepIds:frames.get(id).receipt.result.atomicTask?.retiredStepIds??[]);}
    for(const f of ns.frames)read(f.id);const reachable=new Set();const visit=id=>{if(id===null||reachable.has(id))return;check(frames.has(id),"Missing personal head.");reachable.add(id);const f=frames.get(id);visit(f.parent);for(const ref of f.packet?.frameIds??[])visit(ref)};heads.forEach(visit);check(reachable.size===frames.size,"Unreferenced personal proof.");
    return {seed,seedId,baseline,frames,commands,operations,read,reconcile,current:read(ns.head),memo};
}
function checked(state){check(state.schemaVersion===1&&!state.gitShared&&!state.recurrence&&!state.historyImport,"Personal proof v1 cannot adopt other namespaces.");const g=graph(state.personalShared);for(const k of ["storeId","revision","revisionId","parentRevisionId","partitions","receipts",...VIEW])check(same(state[k],g.current[k]),"Personal materialized state differs: "+k);return g;}
async function validateState(state){
    const g=checked(state);
    let budget=0;for(const [id,after]of g.memo){if(++budget%8===0)await new Promise(resolve=>setImmediate(resolve));const f=g.frames.get(id),c=g.commands.get(id),root=PERSONAL.slice(0,2).includes(c.type),prior=root?(c.type==="personal.enroll"?g.baseline:empty(g.seed,c.payload.baseRevisionId)):g.read(f.parent),candidate=Object.fromEntries(Object.entries(prior).filter(([k])=>!["accepted","taskHeads","conflicts"].includes(k)).map(([k,v])=>[k,V.clone(v)]));
        let at=0;const nextId=()=>{check(at<f.allocations.length,"Personal allocation proof exhausted.");return f.allocations[at++]};let effect;
        if(root){Object.assign(candidate,view(g.baseline));effect=changes(prior,candidate,{version:1,acceptedOrigins:[g.seedId],conflicts:[]});if(c.type==="personal.enroll")effect={taskIds:[],eventIds:[],partitionIds:[g.seed.partition.id],personal:effect.personal};}
        else if(c.type==="personal.receive"){const merged=g.reconcile(prior,g.read(f.packet.head));Object.assign(candidate,V.clone(merged.view));effect=changes(prior,candidate,merged.summary);}
        else effect=await require("./commands").applyCommand(candidate,c,{now:f.clock,nextId,externalReservations:f.inventory,recoveryReservedIds:[],resolvers:{location:ref=>({...ref,owner:g.seed.owner}),phase:()=>null}});
        candidate.revision++;candidate.parentRevisionId=candidate.revisionId;candidate.revisionId=nextId();for(const p of candidate.partitions)if(effect.partitionIds.includes(p.id)){p.revision++;p.parentHead=p.head;p.head=nextId()}
        const result=require("./repository").publicationResult(candidate,c,effect);
        check(at===f.allocations.length&&same(result,f.receipt.result)&&same(delta(prior,candidate,f.receipt),f.delta),"Personal native execution proof differs.");
        require("../writer/policy").candidate({scope:{partitions:[g.seed.partition]}},candidate,prior,f.inventory);
    }
}
function validateRelations(state){checked(state);}
function validateCommand(c){
    V.revision(c.expectedRepositoryRevision);
    if(c.type==="personal.receive"){exact(c.payload,["version","spaceId","authorityId","partitionId","packetDigest","head"]);check(c.payload.version===1,"Personal receive v1 required.");V.uuid(c.payload.spaceId);V.uuid(c.payload.authorityId);V.referenceId(c.payload.partitionId);hex(c.payload.packetDigest);if(c.payload.head!==null)hex(c.payload.head);}
    else {exact(c.payload,["version","spaceId","seedDigest","bindingDigest","replicaId",...(c.type==="personal.bootstrap"?["baseRevisionId"]:[])]);check(c.payload.version===1,"Personal enrollment v1 required.");V.uuid(c.payload.spaceId);V.uuid(c.payload.replicaId);hex(c.payload.seedDigest);hex(c.payload.bindingDigest);if(c.type==="personal.bootstrap")V.uuid(c.payload.baseRevisionId);}
}
function admit(context){const o=context.personal;check(o&&o.signer&&o.pairing?.bindingDigest===hash(o.binding),"Explicit paired personal authority required.");const seed=E.validate(o.seed,o.binding),keys=M.members(o.binding,o.members);check(keys.get(o.signer.replicaId)===o.signer.publicKey,"Personal replica is not enrolled.");return {o,seed};}
async function apply(state,c,context){
    const {o,seed}=admit(context);check(state.storeId===seed.authorityId&&state.partitions.length===1&&state.partitions[0].id===seed.partition.id&&same(state.partitions[0].owner,seed.owner)&&state.partitions[0].kind===seed.partition.kind&&!state.gitShared,"Personal authority differs.");
    if(c.type!=="personal.receive"){
        check(!state.personalShared&&c.payload.replicaId===o.signer.replicaId&&c.payload.seedDigest===o.seed.digest&&c.payload.bindingDigest===hash(o.binding)&&c.payload.spaceId===o.binding.spaceId,"Personal enrollment context differs.");
        if(c.type==="personal.enroll")check(o.signer.replicaId===o.binding.root.replicaId&&same(state,seed.state),"Enrollment source changed.");
        else check(state.revision===0&&state.revisionId===c.payload.baseRevisionId&&state.tasks.length===0&&state.receipts.length===0&&state.history.length===0,"Bootstrap requires this exact empty local authority.");
        const before=V.clone(state);Object.assign(state,view(seed.state));state.personalShared={format:"itacan-personal-origin-state",version:1,binding:V.clone(o.binding),seed:V.clone(o.seed),members:V.clone(o.members),head:null,frames:[]};
        for(const t of state.tasks)if(t.deletedAt===null)await require("./domain").validateReferences(t,context.resolvers);
        return c.type==="personal.enroll"?{taskIds:[],eventIds:[],partitionIds:[seed.partition.id],personal:{version:1,acceptedOrigins:["seed:"+hash(seed)],conflicts:[]}}:changes(before,state,{version:1,acceptedOrigins:["seed:"+hash(seed)],conflicts:[]});
    }
    check(state.personalShared&&context.personalPacket,"Personal receive requires retained evidence.");const incoming=namespace(context.personalPacket);check(c.payload.spaceId===o.binding.spaceId&&c.payload.authorityId===state.storeId&&c.payload.partitionId===seed.partition.id&&c.payload.packetDigest===hash(context.personalPacket)&&c.payload.head===incoming.head,"Personal receive binding differs.");
    const remote=graph(incoming);await validateState({...Object.fromEntries(Object.entries(remote.current).filter(([k])=>!["accepted","taskHeads","conflicts"].includes(k))),personalShared:incoming});
    const combined=union(state.personalShared,incoming),g=graph(combined,[state.personalShared.head,incoming.head]),merged=g.reconcile(g.read(state.personalShared.head),g.read(incoming.head));
    if(!merged.summary.acceptedOrigins.length&&same(g.read(state.personalShared.head).conflicts,merged.conflicts))fail("PERSONAL_NO_CHANGES","No new personal effects.");
    const before=V.clone(state);Object.assign(state,V.clone(merged.view));state.personalShared=combined;
    for(const t of state.tasks)if(t.deletedAt===null)await require("./domain").validateReferences(t,context.resolvers);
    return changes(before,state,merged.summary);
}
function record(state,prior,receipt,context,received){
    const {o}=admit(context),ns=state.personalShared;const body={version:1,parent:prior.personalShared?.head??null,replicaId:o.signer.replicaId,clock:context.now,allocations:V.clone(context.allocations),inventory:V.clone(context.inventory),phases:V.clone(o.phases),receipt:V.clone(receipt),packet:received?{head:received.head,frameIds:received.frames.map(f=>f.id),members:V.clone(received.members)}:null,delta:delta(prior,state,receipt)};
    const id=hash(body),f={...body,id,signature:o.signer.sign(["itacan-personal-frame-v1",o.binding.spaceId,o.seed.digest,id])};ns.frames.push(f);ns.frames.sort((a,b)=>a.id.localeCompare(b.id));ns.head=id;
}
function receiptEvidence(state,id){
    const g=checked(state),f=g.operations.get(id);let receipt,origin,before,after;
    if(f&&g.current.accepted.has(f.id)&&TYPES.includes(g.commands.get(f.id).type)){receipt=f.receipt;origin={id:f.id};before=g.read(f.parent);after=g.read(f.id)}
    else {receipt=g.seed.state.receipts.find(r=>r.operationId===id);if(!receipt)return null;origin={id:g.seedId};before=null;after=g.seed.state;}
    let cursor=state.personalShared.head,application=null;while(cursor!==null){const frame=g.frames.get(cursor),prev=frame.parent===null?null:g.read(frame.parent);if(g.read(cursor).accepted.has(origin.id)&&!prev?.accepted.has(origin.id))application=frame.receipt;cursor=frame.parent;}
    const own=state.receipts.find(r=>r.operationId===id);if(own&&same(own,receipt))application=own;
    check(application,"Personal origin has no local application.");return {receipt,origin,before,after,application};
}
function atomicReceipt(state,r){const e=receiptEvidence(state,r.operationId);check(e&&same(e.receipt,r),"Unaccepted personal atomic receipt.");if(e.before===null)return require("./completion-effects").validateReceipt(e.after,r);const c=JSON.parse(r.payload),before=c.type==="task.save"?e.before.tasks.find(t=>t.id===c.taskId):null,after=r.result.task,F=require("./completion-effects");const expected=F.describe(e.after,c,before,before?F.bindingsFor(e.before,before):[],after,F.bindingsFor(e.after,after));check(same(expected,r.result.atomicTask),"Personal atomic descriptor differs.");return expected;}
function eventPublication(state,event){const e=receiptEvidence(state,event.operationId);check(e&&e.receipt.result.change.eventIds.includes(event.id),"Personal event origin missing.");const original=e.after.history.find(x=>x.id===event.id),immutable=x=>Object.fromEntries(Object.entries(x).filter(([k])=>!["counted","reopenedAt"].includes(k)));check(original&&same(immutable(original),immutable(event)),"Personal event attribution changed.");const origin=require("./completion-effects").creationKind(e.receipt,original);check(origin,"Personal event is not a completion.");return {origin,receipt:{operationId:e.application.operationId,repositoryRevision:e.application.result.repositoryRevision,revisionId:e.application.result.revisionId,digest:hash(e.application),index:e.application.result.change.eventIds.indexOf(event.id)},replication:{version:1,originId:e.origin.id,operationId:e.receipt.operationId,repositoryRevision:e.receipt.result.repositoryRevision,revisionId:e.receipt.result.revisionId,receiptDigest:hash(e.receipt)}};}
function inspectConflict(state,taskId){const g=checked(state),conflicts=g.current.conflicts.filter(c=>c.taskId===taskId);return V.clone(conflicts.map(c=>({...c,branches:c.origins.map(id=>{const s=g.read(id),task=s.tasks.find(t=>t.id===taskId);return {originId:id,receiptDigest:hash(g.frames.get(id).receipt),task:task?Object.fromEntries(["id","revision","owner","location","title","description","importance","start","due","completed","completedAt","archivedAt","deletedAt","steps"].map(k=>[k,V.clone(task[k])])):null,content:task?V.clone(require("./source-content").contentOf(task)?.revisions.at(-1).current??null):null,history:s.history.filter(e=>e.taskId===taskId).map(e=>Object.fromEntries(["id","operationId","kind","taskId","stepId","timestamp","recordedAt","ownerAtEvent","counted","reopenedAt","snapshot"].map(k=>[k,V.clone(e[k])]))),deleted:task?.deletedAt!==null}})})));}
function storageScope(state){
    const ns=state.personalShared;let f=ns.frames.find(f=>f.id===ns.head);while(f.parent!==null)f=ns.frames.find(x=>x.id===f.parent);
    const c=JSON.parse(f.receipt.payload);check(PERSONAL.slice(0,2).includes(c.type),"Personal local base missing.");
    return {version:1,spaceId:ns.binding.spaceId,seedDigest:ns.seed.digest,bindingDigest:hash(ns.binding),replicaId:f.replicaId,rootOperationId:c.operationId,rootCommandDigest:hash(c),sourceRevisionId:c.type==="personal.enroll"?ns.seed.body.sourceRevisionId:c.payload.baseRevisionId};
}
function previewReceive(localPacket,incomingPacket){const local=namespace(localPacket),incoming=namespace(incomingPacket),combined=union(local,incoming),g=graph(combined,[local.head,incoming.head]),before=g.read(local.head),next=g.reconcile(before,g.read(incoming.head));return {changed:next.summary.acceptedOrigins.length>0||!same(before.conflicts,next.conflicts),tasks:V.clone(next.view.tasks)};}
module.exports={TYPES,PERSONAL,packet,namespace,graph,checked,validateState,validateRelations,validateCommand,apply,record,receiptEvidence,atomicReceipt,eventPublication,inspectConflict,storageScope,previewReceive,hash};
