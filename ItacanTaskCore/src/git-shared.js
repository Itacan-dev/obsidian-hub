"use strict";
// Git-specific evidence. Original publication frames are immutable; receive is
// another local publication, never a renumbered remote receipt. No IO or queue.
const V = require("./value"), { check, fail } = require("./errors");
const hash = value => require("./source-content").sha256(V.canonical(value));
const same = (a, b) => V.canonical(a) === V.canonical(b);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const TYPES = ["task.createRich", "task.save", "task.complete", "step.complete", "task.delete"];
const VIEW = ["tasks", "history", "bindings", "retiredStepIds"];
const view = state => Object.fromEntries(VIEW.map(k => [k, V.clone(state[k])]));
const sorted = values => [...values].sort();
const hex = x => check(typeof x === "string" && /^[a-f0-9]{64}$/.test(x), "Invalid shared evidence digest.");
const exact = (o, keys) => V.fields(o, keys, keys);
function initialize(state, genesis) {
    check(state.schemaVersion === 1 && state.revision === 0 && state.partitions.length === 1 && state.partitions[0].kind === "git-project" && state.partitions[0].owner.type === "project", "New single Git Project required.");
    if (genesis !== undefined) {
        exact(genesis, ["authorityId", "revisionId", "partition"]); V.uuid(genesis.revisionId);
        check(genesis.authorityId === state.storeId && same(genesis.partition, state.partitions[0]), "Bootstrap Project/authority differs.");
        state.revisionId = genesis.revisionId;
    }
    state.gitShared = { format: "itacan-git-origin-state", version: 2,
        genesis: { authorityId: state.storeId, revisionId: state.revisionId, partition: V.clone(state.partitions[0]) }, head: null, frames: [] };
}
function base(genesis) {
    return { schemaVersion: 1, storeId: genesis.authorityId, revision: 0, revisionId: genesis.revisionId, parentRevisionId: null,
        partitions: [V.clone(genesis.partition)], tasks: [], history: [], bindings: [], retiredStepIds: [], receipts: [],
        accepted: new Set(), taskHeads: new Map(), conflicts: [] };
}
function checkView(v, genesis) {
    exact(v, VIEW); VIEW.forEach(k => check(Array.isArray(v[k]), "Shared view collection missing."));
    for (const t of v.tasks) {
        require("./domain").validateTask(t);
        check(t.partitionId === genesis.partition.id && same(t.owner, genesis.partition.owner) && t.phase === null && t.captureSource === null, "Private/foreign task in shared evidence.");
        const content = require("./source-content").contentOf(t);
        check(content && content.originals.length === 0 && content.previousEvidence === null, "Private source evidence cannot be transported.");
    }
    for (const e of v.history) {
        require("./domain").validateHistory(e);
        check(e.partitionId === genesis.partition.id && same(e.ownerAtEvent, genesis.partition.owner) && e.legacy === null && e.oathId === null && e.sessionId === null && (e.workingContext === null || same(e.workingContext, genesis.partition.owner)), "Private/foreign completion evidence.");
    }
}
function packet(ns, head = ns.head, ids = ns.frames.map(f => f.id)) {
    const byId = new Map(ns.frames.map(f => [f.id, f]));
    return { format: "itacan-git-native", version: 3, genesis: V.clone(ns.genesis), head,
        frames: sorted(ids).map(id => { check(byId.has(id), "Missing packet frame."); return V.clone(byId.get(id)); }) };
}
function namespace(p) {
    exact(p, ["format", "version", "genesis", "head", "frames"]);
    if (p.format !== "itacan-git-native" || p.version !== 3) fail("UNSUPPORTED_SCHEMA", "Git receive requires compact provenance packet version 3.");
    return { format: "itacan-git-origin-state", version: 2, genesis: V.clone(p.genesis), head: p.head, frames: V.clone(p.frames) };
}
function union(a, b) {
    check(same(a.genesis, b.genesis), "Shared authority/genesis differs.");
    const byId = new Map(a.frames.map(f => [f.id, f]));
    for (const f of b.frames) { if (byId.has(f.id)) check(same(byId.get(f.id), f), "Conflicting immutable frame."); else byId.set(f.id, f); }
    return { ...a, frames: [...byId.values()].sort((x, y) => compare(x.id, y.id)) };
}
// These scopes never accept a caller callback or a caller-supplied trusted graph.
// They exist only while our synchronous receipt/History routines run.
const validationScopes = new WeakMap();
// A proof fact, not materialized state: immutable frame ID + exact genesis.
// Every use still rehashes live bytes and checks the complete required DAG.
const verifiedOrigins = new Map(), MAX_VERIFIED_ORIGINS = 4096;
function rememberProof(key) {
    verifiedOrigins.delete(key); verifiedOrigins.set(key, true);
    if (verifiedOrigins.size > MAX_VERIFIED_ORIGINS) verifiedOrigins.delete(verifiedOrigins.keys().next().value);
}
function transition(prior, state, receipt) {
    const events = new Map(state.history.map(e => [e.id, e]));
    const beforeBindings = new Map(prior.bindings.map(b => [b.eventId, b])), afterBindings = new Map(state.bindings.map(b => [b.eventId, b]));
    return { history: receipt.result.change.eventIds.map(id => { check(events.has(id), "Changed event is missing."); return V.clone(events.get(id)); }),
        bindings: { remove: prior.bindings.filter(b => !afterBindings.has(b.eventId) || !same(b, afterBindings.get(b.eventId))).map(b => b.eventId),
            add: state.bindings.filter(b => !beforeBindings.has(b.eventId) || !same(b, beforeBindings.get(b.eventId))).map(V.clone) },
        retiredStepIds: state.retiredStepIds.filter(id => !prior.retiredStepIds.includes(id)) };
}
function replaceRecords(before, changes) {
    const pending = new Map(changes.map(value => [value.id, value]));
    check(pending.size === changes.length, "Duplicate transition identity.");
    const result = before.map(value => { const next = pending.get(value.id); pending.delete(value.id); return next ?? value; });
    return result.concat([...pending.values()]);
}
function materialize(prior, f) {
    const r = f.receipt, changed = new Set(r.result.change.taskIds), d = f.delta;
    exact(d, ["history", "bindings", "retiredStepIds"]); exact(d.bindings, ["remove", "add"]);
    check(Array.isArray(d.history) && Array.isArray(d.bindings.remove) && Array.isArray(d.bindings.add) && Array.isArray(d.retiredStepIds), "Compact transition collections required.");
    checkView({ tasks: r.result.tasks, history: d.history, bindings: d.bindings.add, retiredStepIds: d.retiredStepIds }, {authorityId:prior.storeId,partition:prior.partitions[0]});
    check(same(d.history.map(e => e.id), r.result.change.eventIds) && new Set(r.result.change.eventIds).size === r.result.change.eventIds.length, "Transition event coverage differs.");
    check(r.result.tasks.length === changed.size && r.result.tasks.every(t => changed.has(t.id)), "Transition task coverage differs.");
    const removed = new Set(d.bindings.remove); check(removed.size === d.bindings.remove.length, "Duplicate binding removal.");
    d.bindings.remove.forEach(id => { V.uuid(id); check(prior.bindings.some(b => b.eventId === id && changed.has(b.taskId)), "Unproven binding removal."); });
    const bindings = prior.bindings.filter(b => !removed.has(b.eventId)), bound = new Set(bindings.map(b => b.stepId ?? b.taskId)), boundEvents = new Set(bindings.map(b => b.eventId));
    for (const binding of d.bindings.add) {
        exact(binding, ["taskId", "stepId", "eventId"]); V.uuid(binding.taskId); if (binding.stepId !== null) V.uuid(binding.stepId); V.uuid(binding.eventId);
        const key = binding.stepId ?? binding.taskId;
        check(changed.has(binding.taskId) && !bound.has(key) && !boundEvents.has(binding.eventId), "Duplicate/foreign binding addition.");
        bindings.push(binding); bound.add(key); boundEvents.add(binding.eventId);
    }
    d.retiredStepIds.forEach(V.uuid);
    check(new Set(d.retiredStepIds).size === d.retiredStepIds.length && d.retiredStepIds.every(id => !prior.retiredStepIds.includes(id)), "Retirement is not append-only.");
    const current = { schemaVersion: 1, storeId: prior.storeId, revision: r.result.repositoryRevision, revisionId: r.result.revisionId, parentRevisionId: prior.revisionId,
        partitions: r.result.change.partitions, tasks: replaceRecords(prior.tasks, r.result.tasks), history: replaceRecords(prior.history, d.history), bindings,
        retiredStepIds: prior.retiredStepIds.concat(d.retiredStepIds), receipts: prior.receipts.concat(r), accepted: new Set(prior.accepted), taskHeads: new Map(prior.taskHeads), conflicts: prior.conflicts };
    if (JSON.parse(r.payload).type === "git.receive") {
        current.tasks.sort((a,b) => compare(a.id,b.id)); current.history.sort((a,b) => compare(a.id,b.id));
        current.bindings.sort((a,b) => compare(a.stepId ?? a.taskId,b.stepId ?? b.taskId)); current.retiredStepIds.sort();
    }
    return current;
}
function graph(ns) { return buildGraph(ns,[ns.head]); }
// Internal structural memo only. Live canonical bytes (including genesis and
// every frame) must match exactly. Detach before retaining; no cached Map, Set,
// frame or materialized view is returned through a public function.
const structuralGraphs=new Map();let structuralBytes=0;
function observedGraph(ns){
    const raw=V.canonical(ns),existing=structuralGraphs.get(raw);if(existing)return existing;
    const detached=JSON.parse(raw),g=graph(detached);
    if(raw.length<=8*1024*1024){while(structuralGraphs.size>=2||structuralBytes+raw.length>8*1024*1024){const key=structuralGraphs.keys().next().value;if(key===undefined)break;structuralBytes-=key.length;structuralGraphs.delete(key);}structuralGraphs.set(raw,g);structuralBytes+=raw.length;}
    return g;
}
function buildGraph(ns,heads) {
    V.jsonValue(ns); exact(ns, ["format", "version", "genesis", "head", "frames"]);
    if (ns.format !== "itacan-git-origin-state" || ns.version !== 2) fail("UNSUPPORTED_SCHEMA", "Compact Git namespace version 2 required.");
    exact(ns.genesis, ["authorityId", "revisionId", "partition"]); V.uuid(ns.genesis.authorityId); V.uuid(ns.genesis.revisionId);
    require("./domain").validatePartition(ns.genesis.partition);
    const p = ns.genesis.partition;
    check(p.kind === "git-project" && p.owner.type === "project" && p.revision === 0 && p.head === null && p.parentHead === null, "Explicit empty Git genesis required.");
    check(Array.isArray(ns.frames) && ns.frames.length <= 1024, "Shared evidence capacity exceeded.");
    const frames = new Map(), operations = new Map(), memo = new Map(), visiting = new Set(), commands = new Map(); let previousId=null;
    for (const f of ns.frames) {
        exact(f, ["version", "id", "parent", "replicaId", "clock", "allocations", "inventory", "receipt", "packet", "delta"]);
        check(f.version === 2, "Compact publication frame version 2 required."); hex(f.id); check(previousId===null||compare(previousId,f.id)<0,"Canonical unique frame order required.");previousId=f.id; if (f.parent !== null) hex(f.parent); V.uuid(f.replicaId); V.timestamp(f.clock); check(f.clock !== null, "Publication clock missing.");
        const {id,...body} = f; check(hash(body) === id && !frames.has(id), "Changed/duplicate immutable origin frame.");
        check(Array.isArray(f.allocations), "Allocation evidence missing."); f.allocations.forEach(V.uuid);
        require("../shared/inventory").validate(f.inventory, ns.genesis.authorityId);
        check(f.inventory.version === 2 || f.inventory.ids.length === 0, "Raw private reservations cannot be shared.");
        exact(f.receipt, ["operationId", "payload", "result", "partitionIds", "coordination"]);
        const command = JSON.parse(f.receipt.payload); require("./commands").validateCommand(command);
        if (command.coordination !== undefined) {
            const c = command.coordination, e = c.evidence; exact(c,["service","id","evidence"]);
            check(c.service === "itacan-native-writer-v1" && c.id === command.operationId,"Only bounded writer correlation can be shared.");
            exact(e,["version","requestDigest","authorityId","ownerContextPin","identityPin","inventoryPin","phasePin","partitions"]);
            check(e.version === 1 && e.authorityId === ns.genesis.authorityId,"Writer authority evidence differs.");
            [e.requestDigest,e.ownerContextPin,e.inventoryPin,e.phasePin].forEach(hex); if(e.identityPin!==null)hex(e.identityPin);
            check(e.inventoryPin === hash(f.inventory) && (f.inventory.version !== 2 || e.phasePin === f.inventory.phasePin),"Origin inventory commitment differs.");
            check(Array.isArray(e.partitions)&&e.partitions.length===1,"Single shared owner evidence required.");exact(e.partitions[0],["id","owner","expectedRevision"]);
            check(e.partitions[0].id===p.id&&same(e.partitions[0].owner,p.owner),"Foreign writer partition evidence.");V.revision(e.partitions[0].expectedRevision);
        }
        check(V.canonical(command) === f.receipt.payload && command.operationId === f.receipt.operationId,"Original command identity differs.");
        check(TYPES.includes(command.type)||command.type==="git.receive","Unsupported shared operation.");
        check(command.context?.oathId==null&&command.context?.sessionId==null&&(command.context?.workingContext==null||same(command.context.workingContext,p.owner)),"Private command context cannot be shared.");
        check(!operations.has(command.operationId),"Conflicting/duplicate origin operation receipts.");
        operations.set(command.operationId,f);frames.set(id,f);commands.set(id,command);
    }
    function read(id) {
        if (id === null) return base(ns.genesis);
        if (memo.has(id)) return memo.get(id);
        check(!visiting.has(id)&&frames.has(id),"Invalid/cyclic publication ancestry.");visiting.add(id);
        const f=frames.get(id),prior=read(f.parent),r=f.receipt,c=commands.get(id),part=r.result.change.partitions[0];
        check(r.result.repositoryRevision===prior.revision+1&&c.expectedRepositoryRevision===prior.revision&&r.result.operationId===r.operationId&&r.result.replayed===false,"Original linear publication context differs.");
        if(c.taskId!==undefined)check(prior.tasks.find(t=>t.id===c.taskId)?.revision===c.expectedRevision,"Original target revision differs.");
        if(c.coordination)check(c.coordination.evidence.partitions[0].expectedRevision===prior.partitions[0].revision,"Original partition guard differs.");
        check(r.partitionIds.length===1&&r.partitionIds[0]===p.id&&r.result.change.partitions.length===1&&part.id===p.id&&same(part.owner,p.owner)&&part.kind==="git-project"&&part.revision===prior.partitions[0].revision+1&&part.parentHead===prior.partitions[0].head,"Original partition publication differs.");
        const current=materialize(prior,f);
        if(c.type==="git.receive") {
            exact(f.packet,["head","frameIds"]);check(Array.isArray(f.packet.frameIds)&&new Set(f.packet.frameIds).size===f.packet.frameIds.length,"Packet evidence differs.");
            f.packet.frameIds.forEach(x=>{check(frames.has(x),"Packet frame missing.");read(x);});
            const transport=packet(ns,f.packet.head,f.packet.frameIds);check(hash(transport)===c.payload.packetDigest&&same(transport.genesis,ns.genesis),"Received packet digest differs.");
            const merged=merge(prior,read(f.packet.head),frames,read);
            check(same(transition(prior,merged.view,r),f.delta)&&same(r.result.tasks,merged.view.tasks.filter(t=>r.result.change.taskIds.includes(t.id)))&&same(r.result.gitShared,merged.summary),"Local application differs from accepted origins/conflicts.");
            current.accepted=merged.accepted;current.taskHeads=merged.taskHeads;current.conflicts=merged.conflicts;
        } else {
            check(f.packet===null&&!prior.conflicts.some(x=>x.taskId===c.taskId),"Native operation claims packet/conflicted target.");
            current.accepted.add(id);for(const taskId of r.result.change.taskIds)current.taskHeads.set(taskId,id);
        }
        visiting.delete(id);memo.set(id,current);return current;
    }
    ns.frames.forEach(f=>read(f.id));const current=read(ns.head);
    const reachable=new Set();function visit(id){if(id===null||reachable.has(id))return;check(frames.has(id),"Missing reachable frame.");reachable.add(id);const f=frames.get(id);visit(f.parent);for(const ref of f.packet?.frameIds??[])visit(ref);}
    heads.forEach(visit);check(reachable.size===frames.size,"Unreferenced origin evidence is not a compact packet.");
    return {frames,read,current,memo,operations,commands};
}
function merge(local, remote, frames, read) {
    // A conflicted branch is evidence even when its effects were not accepted.
    // Propagate both heads to new replicas; acceptance alone would hide the
    // unaccepted side and incorrectly make the target writable again.
    const all = new Set([...local.accepted, ...remote.accepted, ...local.conflicts.flatMap(c => c.origins), ...remote.conflicts.flatMap(c => c.origins)]), accepted = new Set(local.accepted), taskHeads = new Map(local.taskHeads), conflicts = V.clone(local.conflicts), value = view(local);
    const candidates = new Map();
    for (const id of all) for (const taskId of frames.get(id).receipt.result.change.taskIds) { if (!candidates.has(taskId)) candidates.set(taskId, []); candidates.get(taskId).push(id); }
    const conflicting = new Set();
    for (const [taskId, ids] of candidates) {
        const heads = ids.filter(id => !ids.some(other => id !== other && read(frames.get(other).parent).accepted.has(id))).sort();
        if (heads.length > 1) {
            conflicting.add(taskId); const body = { taskId, origins: heads }, conflict = { ...body, digest: hash(body) };
            if (!conflicts.some(x => x.digest === conflict.digest)) conflicts.push(conflict);
        } else if (heads.length === 1) taskHeads.set(taskId, heads[0]);
    }
    for (const id of remote.accepted) if (!frames.get(id).receipt.result.change.taskIds.some(taskId => conflicting.has(taskId))) accepted.add(id);
    for (const [taskId, head] of taskHeads) {
        if (conflicting.has(taskId)) { if (local.taskHeads.has(taskId)) taskHeads.set(taskId, local.taskHeads.get(taskId)); else taskHeads.delete(taskId); continue; }
        const source = read(head), task = source.tasks.find(t => t.id === taskId);
        check(task, "Origin task snapshot missing.");
        value.tasks = value.tasks.filter(t => t.id !== taskId).concat(V.clone(task));
        value.history = value.history.filter(e => e.taskId !== taskId).concat(V.clone(source.history.filter(e => e.taskId === taskId)));
        value.bindings = value.bindings.filter(e => e.taskId !== taskId).concat(V.clone(source.bindings.filter(e => e.taskId === taskId)));
    }
    // Retired identities are permanent reservations, even if their task is no
    // longer live. Unaccepted conflict branches do not become accepted effects.
    value.retiredStepIds = sorted(new Set([...accepted].flatMap(id => frames.get(id).receipt.result.atomicTask?.retiredStepIds ?? [])));
    value.tasks.sort((a, b) => compare(a.id, b.id)); value.history.sort((a, b) => compare(a.id, b.id)); value.bindings.sort((a, b) => compare(a.stepId ?? a.taskId, b.stepId ?? b.taskId)); value.retiredStepIds.sort();
    conflicts.sort((a, b) => compare(a.digest, b.digest));
    return { view: value, accepted, taskHeads, conflicts, summary: { version: 1, acceptedOrigins: sorted([...accepted].filter(id => !local.accepted.has(id))), conflicts } };
}
function checkedNamespace(state, internal = false) {
    check(state.schemaVersion === 1 && !state.recurrence && !state.historyImport && state.partitions.length === 1 && state.partitions[0].kind === "git-project", "Git provenance is not a private/recurrence/import upgrade.");
    const g = internal ? observedGraph(state.gitShared) : graph(state.gitShared), c = g.current;
    for (const k of ["storeId", "revision", "revisionId", "parentRevisionId", "partitions", "receipts", ...VIEW]) check(same(state[k], c[k]), "Materialized state differs from its publication evidence: " + k);
    return g;
}
function validateNamespace(state){return checkedNamespace(state);}
function record(state, prior, receipt, context, received = null) {
    const body={version:2,parent:prior.gitShared.head,replicaId:context.replicaId,clock:context.now,allocations:V.clone(context.allocations),inventory:V.clone(context.inventory),receipt:V.clone(receipt),packet:received?{head:received.head,frameIds:received.frames.map(f=>f.id).sort()}:null,delta:transition(prior,state,receipt)};
    const f={...body,id:hash(body)};state.gitShared.frames.push(f);state.gitShared.frames.sort((a,b)=>compare(a.id,b.id));state.gitShared.head=f.id;
}
function replayCandidate(prior,command) {
    // Only supported native commands run here. They mutate one task, its events,
    // collection arrays and the single partition; historical snapshots stay private.
    return {schemaVersion:1,storeId:prior.storeId,revision:prior.revision,revisionId:prior.revisionId,parentRevisionId:prior.parentRevisionId,
        partitions:prior.partitions.map(V.clone),tasks:prior.tasks.map(t=>t.id===command.taskId?V.clone(t):t),
        history:prior.history.map(e=>e.taskId===command.taskId?V.clone(e):e),bindings:prior.bindings.slice(),retiredStepIds:prior.retiredStepIds.slice(),receipts:prior.receipts};
}
async function validateState(state) {
    const g=checkedNamespace(state,true),genesis=hash(state.gitShared.genesis);
    for(const f of [...g.memo.keys()].map(id=>g.frames.get(id))) {
        const key=genesis+":"+f.id;if(verifiedOrigins.has(key))continue;
        const prior=g.read(f.parent),command=g.commands.get(f.id),candidate=replayCandidate(prior,command);
        let at=0;const nextId=()=>{check(at<f.allocations.length,"Origin allocation proof exhausted.");return f.allocations[at++];};
        const context={now:f.clock,nextId,gitInventory:true,externalReservations:f.inventory,recoveryReservedIds:[],resolvers:{location:ref=>({...ref,owner:state.gitShared.genesis.partition.owner})}};
        let changes;
        if(command.type==="git.receive"){const merged=merge(prior,g.read(f.packet.head),g.frames,g.read);Object.assign(candidate,merged.view);changes=receiveChanges(prior,candidate,merged.summary);}
        else changes=await require("./commands").applyCommand(candidate,command,context);
        candidate.revision++;candidate.parentRevisionId=candidate.revisionId;candidate.revisionId=nextId();
        for(const part of candidate.partitions)if(changes.partitionIds.includes(part.id)){part.revision++;part.parentHead=part.head;part.head=nextId();}
        check(at===f.allocations.length,"Unused origin allocation evidence.");
        const result=require("./repository").publicationResult(candidate,command,changes);
        if(f.inventory.version===2)require("../writer/policy").candidate({scope:{partitions:[state.gitShared.genesis.partition]}},candidate,prior,f.inventory);
        check(same(result,f.receipt.result)&&same(transition(prior,candidate,f.receipt),f.delta)&&same(f.receipt.partitionIds,changes.partitionIds)&&same(f.receipt.coordination,command.coordination??null),"Origin command/receipt/transition replay differs.");
        const {id:liveId,...liveBody}=f;check(liveId===key.slice(genesis.length+1)&&hash(liveBody)===liveId&&hash(state.gitShared.genesis)===genesis,"Origin changed during proof validation.");
        rememberProof(key);
    }
    // Retained graph remains private.
}
function validateRelations(state) {
    const g=checkedNamespace(state,true);validationScopes.set(state,g);
    try {require("./source-content").validateContentContinuity(state);require("./completion-effects").validateState(state);}
    finally {validationScopes.delete(state);}
}
function eventPublications(state,events) {
    const g=checkedNamespace(state,true);validationScopes.set(state,g);
    try {return new Map(events.map(event=>[event.id,eventPublication(state,event)]));}
    finally {validationScopes.delete(state);}
}
function receiveChanges(prior, candidate, summary) {
    const taskIds = candidate.tasks.filter(t => !same(prior.tasks.find(p => p.id === t.id) ?? null, t)).map(t => t.id);
    const eventIds = candidate.history.filter(e => !same(prior.history.find(p => p.id === e.id) ?? null, e)).map(e => e.id);
    return { taskIds, eventIds, partitionIds: [prior.partitions[0].id], gitShared: summary };
}
async function applyReceive(state, command, context) {
    check(state.gitShared && context.sharedPacket, "Explicit shared packet evidence required.");
    const incoming = namespace(context.sharedPacket); check(hash(context.sharedPacket) === command.payload.packetDigest && command.payload.head === incoming.head && command.payload.authorityId === state.storeId && command.payload.projectId === state.partitions[0].owner.id && command.payload.partitionId === state.partitions[0].id, "Packet request binding differs.");
    const combined = union(state.gitShared, incoming), remoteGraph = observedGraph(incoming);
    // Validate every remote frame through the actual native command interpreter.
    const remoteState = { ...remoteGraph.current, gitShared: incoming }; await validateState(remoteState);
    const g = buildGraph(combined,[state.gitShared.head,incoming.head]), merged = merge(g.read(state.gitShared.head), g.read(incoming.head), g.frames, g.read);
    const old = g.read(state.gitShared.head);
    if (!merged.summary.acceptedOrigins.length && same(old.conflicts, merged.conflicts)) fail("SHARED_NO_CHANGES", "No unaccepted shared effects.");
    state.gitShared.frames = combined.frames;
    Object.assign(state, V.clone(merged.view));
    for (const task of state.tasks) await require("./domain").validateReferences(task, context.resolvers);
    return receiveChanges(old, state, merged.summary);
}
function validateReceiveCommand(c) {
    V.revision(c.expectedRepositoryRevision); exact(c.payload, ["version", "authorityId", "projectId", "partitionId", "packetDigest", "head"]);
    check(c.payload.version === 2, "Compact receive command version 2 required."); V.uuid(c.payload.authorityId); V.referenceId(c.payload.projectId); V.referenceId(c.payload.partitionId); hex(c.payload.packetDigest); if (c.payload.head !== null) hex(c.payload.head);
}
function receiveCommand(state, p, operationId) { return { type: "git.receive", operationId, expectedRepositoryRevision: state.revision, payload: { version: 2, authorityId: state.storeId, projectId: state.partitions[0].owner.id, partitionId: state.partitions[0].id, packetDigest: hash(p), head: p.head } }; }
// Advisory only: production admission and publication still validate full proof.
function previewReceive(localPacket,incomingPacket){const local=namespace(localPacket),incoming=namespace(incomingPacket),combined=union(local,incoming),g=buildGraph(combined,[local.head,incoming.head]),before=g.read(local.head),next=merge(before,g.read(incoming.head),g.frames,g.read);return {version:1,changed:next.summary.acceptedOrigins.length>0||!same(before.conflicts,next.conflicts),...V.clone(next.summary)};}
function receiptEvidence(state, operationId) {
    const scoped = validationScopes.has(state), g = validationScopes.get(state) ?? observedGraph(state.gitShared), selected = g.operations.get(operationId), f = selected && g.current.accepted.has(selected.id) && g.commands.get(selected.id).type !== "git.receive" ? selected : null;
    if (!f) return null;
    let cursor = state.gitShared.head, application = null;
    while (cursor !== null) { const frame = g.frames.get(cursor), before = g.read(frame.parent); if (g.read(cursor).accepted.has(f.id) && !before.accepted.has(f.id)) application = frame.receipt; cursor = frame.parent; }
    const evidence={ origin: f, receipt: f.receipt, application, before: g.read(f.parent), after: g.read(f.id) };
    if(scoped)return evidence;
    const portable=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['accepted','taskHeads'].includes(key)));
    return V.clone({...evidence,before:portable(evidence.before),after:portable(evidence.after)});
}
function atomicReceipt(state, receipt) {
    const evidence = receiptEvidence(state, receipt.operationId); check(evidence && same(evidence.receipt, receipt), "Unaccepted shared atomic receipt.");
    const { origin, before, after } = evidence, command = JSON.parse(receipt.payload), task = receipt.result.task, previous = command.type === "task.save" ? before.tasks.find(t => t.id === task.id) : null;
    const F = require("./completion-effects"), expected = F.describe(after, command, previous, previous ? F.bindingsFor(before, previous) : [], task, F.bindingsFor(after, task));
    check(same(expected, receipt.result.atomicTask), "Shared atomic descriptor differs."); return V.clone(origin.receipt.result.atomicTask);
}
function eventPublication(state, event) {
    const evidence = receiptEvidence(state, event.operationId);
    check(evidence && evidence.receipt.result.change.eventIds.filter(id => id === event.id).length === 1, "Remote event has no accepted creation origin.");
    const original = evidence.after.history.find(e => e.id === event.id), immutable = e => Object.fromEntries(Object.entries(e).filter(([k]) => !["counted", "reopenedAt"].includes(k)));
    check(original && same(immutable(event), immutable(original)), "Original completion attribution/time changed.");
    const kind = require("./completion-effects").creationKind(evidence.receipt, original), application = evidence.application;
    check(kind && application && application.result.change.eventIds.includes(event.id), "Completion application evidence missing.");
    return { origin: kind, receipt: { operationId: application.operationId, repositoryRevision: application.result.repositoryRevision, revisionId: application.result.revisionId, digest: hash(application), index: application.result.change.eventIds.indexOf(event.id) },
        replication: { version: 1, originId: evidence.origin.id, operationId: evidence.receipt.operationId, repositoryRevision: evidence.receipt.result.repositoryRevision, revisionId: evidence.receipt.result.revisionId, receiptDigest: hash(evidence.receipt) } };
}
module.exports = { initialize, graph, hash, view, packet, namespace, validateNamespace, validateState, validateRelations, eventPublications, record, applyReceive, previewReceive, validateReceiveCommand, receiveCommand, receiptEvidence, atomicReceipt, eventPublication, TYPES };
