"use strict";
const D = require("./domain"), { check, fail } = require("../src/errors");
const { uuid, text, revision } = require("../src/value");

function initialState(options) {
    D.registry(options.registry); text(options.registryRevision); uuid(options.storeId);
    const reservations = (options.reservations ?? []).map(r=>({ version:1, ...D.clone(r), planId:null, entryId:null }));
    return D.validateState({ format:"itacan-private-identity-planning",versions:{...D.VERSIONS},decisionRevision:D.DECISION_REVISION,
        requiredCapabilities:[...D.CAPABILITIES],storeId:options.storeId,revision:0,registryRevision:options.registryRevision,
        registry:D.clone(options.registry),plans:[],aliases:[],reservations,quarantines:[],receipts:[] });
}
function commandValue(c) {
    D.record(c,["version","decisionRevision","type","operationId","expectedRevision","payload"]);
    D.version(c.version,"plan"); if(c.decisionRevision!==D.DECISION_REVISION)fail("UNSUPPORTED_DECISION","Unknown decision revision.");
    check(["prepare","approve","publish","abandon"].includes(c.type),"Unsupported identity operation."); text(c.operationId); revision(c.expectedRevision); D.canonical(c);
}
function checkEvidence(plan, snapshot, registryRevision) {
    D.validateSnapshot(snapshot);
    if(snapshot.registryRevision!==registryRevision)fail("OWNER_CONFLICT","Owner registry changed since planning.");
    for(const original of plan.snapshot.occurrences) {
        const current=snapshot.occurrences.find(o=>o.entryId===original.entryId);
        if(current && !D.sameOwner(current.owner,original.owner) && !(current.owner===null && original.owner===null))fail("OWNER_CONFLICT","Captured physical owner changed.");
    }
    if(D.hash(snapshot)!==plan.snapshotDigest)fail("SOURCE_CONFLICT","Captured source changed; original plan retained.");
}
function allocate(state, snapshot, entries, idFactory) {
    const avoided = new Set([...state.reservations.map(r=>r.id),...entries.map(e=>e.evidence.legacyId).filter(D.isUUID)]);
    for(const e of entries) {
        if(e.identityBlocked)continue;
        let id = D.isUUID(e.evidence.legacyId) ? e.evidence.legacyId : null;
        if(id===null)for(let attempt=0;attempt<64;attempt++) { const next=idFactory(); uuid(next); if(!avoided.has(next)){id=next;break;} }
        if(id===null)fail("ALLOCATION_CONFLICT","Allocator could not provide a globally unreserved UUID.");
        avoided.add(id); e.nativeId=id;
    }
}
function quarantines(plan) {
    const result=[],seen=new Set();
    for(const entry of plan.entries)for(const reason of entry.reasons) {
        const collision=reason==="AMBIGUOUS_IDENTITY", legacyId=entry.evidence.legacyId;
        const key=collision?reason+":"+legacyId:reason+":"+entry.entryId;if(seen.has(key))continue;seen.add(key);
        const entries=collision?plan.entries.filter(e=>e.evidence.legacyId===legacyId):[entry];
        result.push({version:1,id:plan.id+":q:"+result.length,planId:plan.id,decisionRevision:D.DECISION_REVISION,entryIds:entries.map(e=>e.entryId),reason,legacyId,
            evidence:entries.map(e=>({entryId:e.entryId,owner:e.owner,evidence:e.evidence,privateEvidence:e.privateEvidence,reasons:e.reasons})),
            candidateNativeIds:entries.map(e=>e.nativeId).filter(Boolean),reviews:[],status:"quarantined",privacy:"local-private"});
    }
    return result;
}
async function candidate(previous, command, options) {
    const state=D.clone(previous),p=command.payload,hook=stage=>options.fault?.(stage);
    let plan;
    if(command.type==="prepare") {
        D.record(p,["planId","snapshot","publishOperationId"]); text(p.planId); text(p.publishOperationId); D.validateSnapshot(p.snapshot);
        if(p.snapshot.registryRevision!==state.registryRevision)fail("OWNER_CONFLICT","Owner registry changed.");
        if(state.plans.some(x=>x.id===p.planId))fail("PLAN_CONFLICT","Plan already exists; retry its original operation.");
        if(state.plans.some(x=>x.publishOperationId===p.publishOperationId || x.prepareOperationId===p.publishOperationId) || state.receipts.some(x=>x.operationId===p.publishOperationId))fail("OPERATION_CONFLICT","Operation identity is reserved by another plan.");
        if(state.plans.some(x=>x.snapshot.id===p.snapshot.id))fail("SOURCE_CONFLICT","Source snapshot identity already planned; no automatic replacement allocation.");
        if(state.plans.some(x=>x.snapshot.files.some(old=>p.snapshot.files.some(file=>file.id===old.id || file.path===old.path))))fail("SOURCE_CONFLICT","Source lineage/path already captured by a frozen plan; explicit rebase is unsupported.");
        const analysis=D.analyze(p.snapshot,state);
        for(const e of analysis.entries)if(e.evidence.legacyId && state.plans.some(x=>x.entries.some(old=>old.evidence.legacyId===e.evidence.legacyId)))fail("ALIAS_CONFLICT","Alias already captured; no silent retarget or partial invalidation.");
        allocate(state,p.snapshot,analysis.entries,options.idFactory);
        plan={version:1,id:p.planId,decisionRevision:D.DECISION_REVISION,capturedLedgerRevision:state.revision,registryDigest:D.hash(state.registry),snapshot:D.clone(p.snapshot),snapshotDigest:analysis.snapshotDigest,
            entries:analysis.entries,createdAt:options.clock?.()??null,prepareOperationId:command.operationId,publishOperationId:p.publishOperationId,digest:"",status:"prepared",approvals:[],publicationOperationId:null};
        plan.digest=D.planDigest(plan);await hook("beforePlanPersistence");state.plans.push(plan);await hook("afterPlanStaging");
        await hook("duringEvidenceSerialization");D.canonical(plan.snapshot);
        await hook("duringReservationPublication");
        for(const e of plan.entries)if(e.nativeId)state.reservations.push({version:1,id:e.nativeId,kind:e.kind,owner:D.clone(e.owner),status:"planned",planId:plan.id,entryId:e.entryId});
        await hook("duringQuarantinePublication");state.quarantines.push(...quarantines(plan));
    } else {
        if(command.type==="abandon")D.record(p,["planId","reason"]);
        else if(command.type==="approve")D.record(p,["planId","snapshot","reviewer","syntheticOnly"]);
        else D.record(p,["planId","snapshot"]);
        plan=state.plans.find(x=>x.id===p.planId);if(!plan)fail("NOT_FOUND","Identity plan missing.");
        if(command.type==="abandon") {
            text(p.reason);check(["prepared","approved"].includes(plan.status),"Only an unpublished plan may be abandoned.");plan.status="abandoned";
            for(const r of state.reservations)if(r.planId===plan.id)r.status="abandoned";
        } else {
            checkEvidence(plan,p.snapshot,state.registryRevision);
            if(command.type==="approve") {
                text(p.reviewer);check(p.syntheticOnly===true,"Only explicit synthetic plan approval is supported.");
                check(["prepared","approved"].includes(plan.status),"Plan is not awaiting review.");
                plan.approvals.push({operationId:command.operationId,reviewer:p.reviewer,planDigest:plan.digest,sourceDigest:plan.snapshotDigest,registryDigest:plan.registryDigest,ledgerRevision:state.revision+1,syntheticOnly:true});plan.status="approved";
            } else {
                check(plan.status==="approved","Explicit plan approval required before publication.");
                if(command.operationId!==plan.publishOperationId)fail("OPERATION_CONFLICT","Use the plan's original publication operation identity.");
                if(plan.approvals.at(-1).ledgerRevision!==state.revision)fail("REVISION_CONFLICT","Ledger changed after review; explicit re-review required.");
                await hook("beforeAliasPublication");
                const aliases=new Map();for(const e of plan.entries)if(e.evidence.legacyId){const list=aliases.get(e.evidence.legacyId)??[];list.push(e);aliases.set(e.evidence.legacyId,list);}
                for(const[legacyId,entries]of aliases) {
                    if(state.aliases.some(a=>a.legacyId===legacyId))fail("ALIAS_CONFLICT","Alias publication conflict.");
                    const active=entries.length===1 && entries[0].nativeId!==null && entries[0].reasons.length===0,e=entries[0];
                    state.aliases.push({version:1,legacyId,nativeId:active?e.nativeId:null,kind:active?e.kind:null,owner:active?D.clone(e.owner):null,planId:plan.id,entryIds:entries.map(e=>e.entryId),status:active?"active":entries.some(e=>e.reasons.includes("AMBIGUOUS_IDENTITY"))?"ambiguous":"unavailable",ledgerRevision:state.revision+1});
                }
                await hook("duringReservationPublication");for(const r of state.reservations)if(r.planId===plan.id)r.status="published";
                await hook("duringQuarantinePublication");plan.status="published";plan.publicationOperationId=command.operationId;
            }
        }
    }
    state.revision++;
    const result={operationId:command.operationId,revision:state.revision,plan:D.clone(plan),accounting:D.accounting(plan.entries),replayed:false};
    await hook("duringReceiptPersistence");const payload=D.canonical(command);
    state.receipts.push({version:1,operationId:command.operationId,payload,payloadDigest:D.hash(payload),revision:state.revision,result:D.clone(result),resultDigest:D.hash(result)});
    D.validateState(state);return{state,result};
}
class MemoryIdentityStorage {
    constructor(){this.state=null;this.leased=false;}
    async acquire(){if(this.leased)fail("LOCK_HELD","Identity writer already held.");this.leased=true;}
    async load(){check(this.leased&&this.state!==null,"Identity store is not open.");return D.clone(D.validateState(this.state));}
    async commit(state,expected){check(this.leased,"Identity writer is not held.");if(this.state && this.state.revision!==expected)fail("REVISION_CONFLICT","Storage revision changed.");D.validateState(state);this.state=D.clone(state);}
    async close(){this.leased=false;}
}
class IdentityRepository {
    #storage;#state;#options;#queue=Promise.resolve();#closing=false;
    constructor(storage,state,options){check(typeof options.idFactory==="function","Explicit UUID allocator required.");this.#storage=storage;this.#state=D.clone(D.validateState(state));this.#options=options;}
    #open(){if(this.#closing)fail("CLOSED","Identity planning store is closed.");}
    snapshot(){this.#open();return D.clone(this.#state);}
    getPlan(id){this.#open();return D.clone(this.#state.plans.find(p=>p.id===id)??null);}
    analyze(snapshot){this.#open();return D.clone(D.analyze(snapshot,this.#state));}
    resolveAlias(legacyId,expectedOwner=null){this.#open();const a=this.#state.aliases.find(a=>a.legacyId===legacyId);
        if(!a)return{state:"missing",nativeId:null};if(a.status!=="active")return{state:a.status,nativeId:null};
        if(expectedOwner&&!D.sameOwner(a.owner,expectedOwner))return{state:"owner-conflict",nativeId:null};
        return{state:"resolved-identity-only",nativeId:a.nativeId,owner:D.clone(a.owner),kind:a.kind};}
    publicProjection(){this.#open();fail("UNSUPPORTED","Identity planning artifacts have no public/shared export.");}
    execute(input){this.#open();commandValue(input);const command=D.clone(input),payload=D.canonical(command);
        const run=this.#queue.then(async()=>{
            const current=await this.#storage.load();this.#state=D.clone(current);
            const receipt=current.receipts.find(r=>r.operationId===command.operationId);
            if(receipt){if(receipt.payload!==payload)fail("OPERATION_CONFLICT","Operation identity has different canonical payload.");return{...D.clone(receipt.result),replayed:true};}
            if(current.plans.some(p=>p.publishOperationId===command.operationId) && command.type!=="publish")fail("OPERATION_CONFLICT","Operation ID reserved for plan publication.");
            if(command.expectedRevision!==current.revision)fail("REVISION_CONFLICT","Planning ledger revision changed.");
            const next=await candidate(current,command,this.#options);await this.#options.fault?.("beforeCommit");
            await this.#storage.commit(next.state,current.revision);this.#state=D.clone(next.state);
            try{await this.#options.fault?.("afterDurableCommit");await this.#options.fault?.("beforeAcknowledgement");}
            catch(_){fail("ACKNOWLEDGEMENT_LOST","Identity operation committed; retry original operation and payload.");}
            return D.clone(next.result);
        });this.#queue=run.catch(()=>{});return run;
    }
    async close(){if(this.#closing)return;this.#closing=true;await this.#queue;await this.#storage.close();}
}
async function openMemoryIdentity(options,creating=false){
    const storage=options.storage??new MemoryIdentityStorage();await storage.acquire();
    try {if(creating){if(storage.state!==null)fail("ALREADY_EXISTS","Planning storage already exists.");await storage.commit(initialState(options),null);}return new IdentityRepository(storage,await storage.load(),options);}
    catch(e){await storage.close();throw e;}
}
module.exports={initialState,IdentityRepository,MemoryIdentityStorage,createMemoryIdentity:options=>openMemoryIdentity(options,true),openMemoryIdentity:options=>openMemoryIdentity(options,false)};
