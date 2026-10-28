"use strict";
// Host-owned immutable request evidence; receipts alone establish task outcomes.
const V = require("../src/value"), P = require("../writer/policy"), A = require("../writer/admission");
const { check, fail } = require("../src/errors"), { freeze } = require("../src/snapshot-read");
const markerName = "REQUEST-RETENTION-v1.json", prefix = "REQUEST-v1-";
const fields = (v, keys) => V.fields(v, keys, keys);
function createPendingRequests(port, config, settings, inspect, inspectCommitted, proveBootstrapRejection, personalContext, provePrivateSaveRejection) {
    fields(settings, ["version", "rehearsalId"]); check([1,2,3,4].includes(settings.version), "Unsupported retention version."); V.uuid(settings.rehearsalId);
    let observedMarkerVersion=settings.version;
    const markerBody = { format: "itacan-native-request-retention", version: settings.version, authorityId: config.authorityId, applicationContextId: config.applicationContextId, rehearsalId: settings.rehearsalId };
    let stopped = false, ready = false, reviews = new WeakMap(), permits = new WeakMap(); const privateSaveReviews = new WeakMap(), rejectionReviews = new WeakMap(), inflight = new Set(), preparing = new Map(), prior = new Set();
    const sealed = body => ({ ...body, checksum: P.hash(body) });
    const name = id => prefix + P.hash(id) + ".json";
    const rejectionName = id => "REQUEST-REJECTED-v1-" + P.hash(id) + ".json";
    const owned = () => port.assertWriter();
    function tracked(work) {
        check(ready && !stopped, "Retention is closed."); const job = work().catch(error => { const code = ["OPERATION_CONFLICT", "OUTCOME_RECONCILIATION_REQUIRED", "WRITER_ADMISSION_REQUIRED", "LOCK_LOST", "ROOT_IDENTITY_CHANGED", "ENOENT", "VALIDATION", "RECOVERY_REVIEW_REQUIRED", "RECOVERY_REVIEW_STALE", "ORIGINAL_GUARDS_STALE", "EXACT_REPLAY_SAFETY_UNPROVEN"].includes(error?.code) ? error.code : "REQUEST_RETENTION_INVALID"; fail(code, "Retained request evidence is unavailable."); }); inflight.add(job); job.finally(() => inflight.delete(job)).catch(() => {}); return job;
    }
    function record(intent) {
        if(intent?.kind==="personal-operation"&&intent.version===2){
            check(settings.version===4,"Personal v2 requires retention v4.");fields(intent,["version","kind","prepared"]);const p=intent.prepared;fields(p,["version","request","evidence"]);check(p.version===2,"Personal preparation v2 required.");fields(p.evidence,["version","binding","seed","members","packet","review"]);check(p.evidence.version===2&&p.evidence.binding.version===2,"Personal v2 evidence required.");const r=P.request(p.request,"personal"),seed=require("../personal/enrollment").validate(p.evidence.seed,p.evidence.binding);require("../personal/membership").members(p.evidence.binding,p.evidence.members);check(r.scope.authorityId===config.authorityId&&seed.authorityId===config.authorityId&&r.scope.partitions.length===1&&P.same(r.scope.partitions[0].owner,seed.owner)&&r.scope.partitions[0].id===seed.partition.id&&r.command.payload.bindingDigest===P.hash(p.evidence.binding)&&r.command.payload.profileDigest===p.evidence.binding.profile.digest,"Personal v2 retained scope differs.");
            if(r.command.type==="personal.receive"){check(p.evidence.packet!==null&&P.hash(p.evidence.packet)===r.command.payload.packetDigest&&P.same(p.evidence.packet.binding,p.evidence.binding)&&P.same(p.evidence.packet.seed,p.evidence.seed),"Personal v2 retained packet differs.");require("../src/personal-shared-v2").namespace(p.evidence.packet);}else check(p.evidence.packet===null,"Non-receive cannot retain an incoming packet.");
            if(r.command.type==="personal.resolve")check(p.evidence.review&&p.evidence.review.previewDigest===r.command.payload.previewDigest&&p.evidence.review.conflictDigest===r.command.payload.conflictDigest&&p.evidence.review.selectedOriginId===r.command.payload.choice.originId&&P.same(p.evidence.review.reviewedHeads,r.command.payload.reviewedHeads),"Original resolution review required.");else check(p.evidence.review===null,"Foreign resolution review.");
            return sealed({format:"itacan-native-personal-request",version:4,authorityId:config.authorityId,applicationContextId:config.applicationContextId,rehearsalId:settings.rehearsalId,owner:V.clone(seed.owner),partitionId:seed.partition.id,operationId:r.command.operationId,intent:V.clone(intent),intentDigest:P.hash(intent),writerRequest:V.clone(r),writerRequestDigest:P.hash(r),commandDigest:P.hash(A.compile(r))});
        }
        if(intent?.kind==="personal-operation") {
            check([3,4].includes(settings.version),"Personal operations require retention v3/v4.");fields(intent,["version","kind","prepared"]);check(intent.version===1,"Personal intent v1 required.");const p=intent.prepared;fields(p,["version","request","evidence"]);check(p.version===1,"Personal preparation v1 required.");fields(p.evidence,["version","binding","seed","members","packet"]);check(p.evidence.version===1,"Personal retained evidence v1 required.");
            const r=P.request(p.request,"personal"),E=require("../personal/enrollment"),G=require("../src/personal-shared"),seed=E.validate(p.evidence.seed,p.evidence.binding);require("../personal/membership").members(p.evidence.binding,p.evidence.members);
            check(r.scope.authorityId===config.authorityId&&seed.authorityId===config.authorityId&&r.scope.partitions.length===1&&P.same(r.scope.partitions[0].owner,seed.owner)&&r.scope.partitions[0].id===seed.partition.id,"Personal retained scope differs.");
            if(r.command.type==="personal.receive"){check(p.evidence.packet!==null&&G.hash(p.evidence.packet)===r.command.payload.packetDigest&&P.same(p.evidence.packet.binding,p.evidence.binding)&&P.same(p.evidence.packet.seed,p.evidence.seed),"Personal retained packet differs.");G.namespace(p.evidence.packet);}else check(p.evidence.packet===null&&r.command.payload.bindingDigest===P.hash(p.evidence.binding)&&r.command.payload.seedDigest===p.evidence.seed.digest,"Personal retained enrollment differs.");
            return sealed({format:"itacan-native-personal-request",version:3,authorityId:config.authorityId,applicationContextId:config.applicationContextId,rehearsalId:settings.rehearsalId,owner:V.clone(seed.owner),partitionId:seed.partition.id,operationId:r.command.operationId,intent:V.clone(intent),intentDigest:P.hash(intent),writerRequest:V.clone(r),writerRequestDigest:P.hash(r),commandDigest:P.hash(A.compile(r))});
        }
        if (intent?.kind === "git-receive") {
            check(settings.version === 2, "Git receive requires explicit retention version 2.");
            fields(intent,["version","kind","prepared"]); check(intent.version === 1,"Unsupported retained shared intent.");
            const prepared=intent.prepared; fields(prepared,["version","request","packet"]);check(prepared.version===1,"Exact shared preparation required.");
            const r=P.request(prepared.request,"shared"),packet=prepared.packet,G=require("../src/git-shared");
            G.namespace(packet);check(r.command.type==="git.receive"&&r.scope.authorityId===config.authorityId&&packet.genesis.authorityId===config.authorityId&&r.scope.partitions.length===1&&r.scope.partitions[0].owner.type==="project"&&P.same(r.scope.partitions[0].owner,packet.genesis.partition.owner)&&r.scope.partitions[0].id===packet.genesis.partition.id&&r.command.payload.packetDigest===G.hash(packet)&&r.command.payload.head===packet.head,"Retained shared binding differs.");
            return sealed({format:"itacan-native-shared-request",version:2,authorityId:config.authorityId,applicationContextId:config.applicationContextId,rehearsalId:settings.rehearsalId,owner:V.clone(r.scope.partitions[0].owner),partitionId:r.scope.partitions[0].id,operationId:r.command.operationId,intent:V.clone(intent),intentDigest:P.hash(intent),writerRequest:V.clone(r),writerRequestDigest:P.hash(r),commandDigest:P.hash(A.compile(r))});
        }
        const compiled = require("../application/intents").compile(intent), i = compiled.intent;
        check(compiled.request && ["rich-create", "full-save", "set-completion", "set-step-completion", "delete-tree"].includes(i.action.kind), "Action is outside Project rehearsal.");
        check(i.authority.backend === "native" && i.authority.authorityId === config.authorityId && i.authority.applicationContextId === config.applicationContextId && ["project", "resource"].includes(i.owner.type) && i.guard.partitions.length === 1, "Retention scope differs.");
        if (i.action.kind === "rich-create") { V.uuid(i.action.draft.id); for (const step of i.action.draft.steps) V.uuid(step.id); }
        return sealed({ format: "itacan-native-ui-request", version: 1, authorityId: config.authorityId, applicationContextId: config.applicationContextId,
            rehearsalId: settings.rehearsalId, owner: V.clone(i.owner), partitionId: i.guard.partitions[0].id, operationId: i.operationId,
            intent: V.clone(i), intentDigest: P.hash(i), writerRequest: V.clone(compiled.request), writerRequestDigest: P.hash(compiled.request), commandDigest: P.hash(A.compile(compiled.request)) });
    }
    function validate(raw, expectedName) {
        const value = JSON.parse(raw); V.jsonValue(value);
        fields(value, ["format", "version", "authorityId", "applicationContextId", "rehearsalId", "owner", "partitionId", "operationId", "intent", "intentDigest", "writerRequest", "writerRequestDigest", "commandDigest", "checksum"]);
        const expected = record(value.intent); check(P.same(value, expected) && (!expectedName || expectedName === name(value.operationId)), "Retained request integrity differs."); return freeze(expected);
    }
    async function names() {
        const all = await port.list();
        check(all.filter(n => n.startsWith("REQUEST-")).every(n => n === markerName || /^REQUEST-v1-[a-f0-9]{64}\.json$/.test(n) || [1,2,4].includes(settings.version) && /^REQUEST-REJECTED-v1-[a-f0-9]{64}\.json$/.test(n)), "Unsupported request evidence.");
        return all.filter(n => n.startsWith(prefix));
    }
    async function rejection(r, state = null) {
        let value; try { value = JSON.parse(await port.read(rejectionName(r.operationId))); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
        if(value.format==="itacan-native-rejected-private-save"){
            const {checksum,...body}=value;fields(body,["format","version","authorityId","applicationContextId","rehearsalId","operationId","recordChecksum","commandDigest","proof"]);
            check([1,4].includes(settings.version)&&checksum===P.hash(body)&&body.version===1&&body.authorityId===config.authorityId&&body.applicationContextId===config.applicationContextId&&body.rehearsalId===settings.rehearsalId&&body.operationId===r.operationId&&body.recordChecksum===r.checksum&&body.commandDigest===r.commandDigest&&r.format==="itacan-native-ui-request"&&r.writerRequest.command.type==="task.save","Private save rejection identity differs.");
            if(state)require("../src/private-save-rejection").verify(state,A.compile(r.writerRequest),body.proof);
            else{check(typeof provePrivateSaveRejection==="function","Private save proof unavailable.");check(P.same(await provePrivateSaveRejection(r,body.proof),body.proof),"Private save rejection evidence differs.");}
            return freeze(value);
        }
        if(value.format==="itacan-native-rejected-personal-resolution"){
            const {checksum,...body}=value;fields(body,["format","version","authorityId","operationId","recordChecksum","commandDigest","proof"]);const p=require("../personal/membership").open(body.proof,personalContext?.signer.publicKey,personalContext?.signer.replicaId);
            fields(p,["authorityId","head","operationId","commandDigest","code","publication","bindingDigest","replicaId"]);check(p.bindingDigest===P.hash(personalContext.binding)&&p.replicaId===personalContext.signer.replicaId&&["PERSONAL_REVIEW_STALE","REPOSITORY_CONFLICT","PARTITION_CONFLICT","WRITER_EVIDENCE_CONFLICT","REFERENCE_UNRESOLVED"].includes(p.code),"Personal rejection attestation differs.");
            check(settings.version===4&&checksum===P.hash(body)&&body.version===1&&body.authorityId===config.authorityId&&body.operationId===r.operationId&&r.writerRequest.command.type==="personal.resolve"&&body.recordChecksum===r.checksum&&body.commandDigest===r.commandDigest&&p.publication==="not-attempted"&&p.authorityId===config.authorityId&&p.operationId===r.operationId&&p.commandDigest===r.commandDigest,"Personal terminal rejection differs.");
            if(state)check(state.revision>=p.head.repositoryRevision&&!(state.receipts.some(x=>x.operationId===r.operationId))&&!state.personalShared?.frames.some(f=>f.receipt.operationId===r.operationId),"Rejected resolution has contradictory evidence.");else{const o=await observation(r);check(o.ready&&o.operation.state==="missing"&&o.stamp.head.repositoryRevision>=p.head.repositoryRevision,"Rejected resolution outcome contradicts authoritative observation.");}return freeze(value);
        }
        const { checksum, ...body } = value;
        fields(body, ["format", "version", "authorityId", "applicationContextId", "rehearsalId", "operationId", "recordChecksum", "proof"]);
        check(checksum === P.hash(body) && body.format === "itacan-native-rejected-bootstrap" && body.version === 1 && body.authorityId === config.authorityId && body.applicationContextId === config.applicationContextId && body.rehearsalId === settings.rehearsalId && body.operationId === r.operationId && body.recordChecksum === r.checksum && r.intent.kind === "git-receive", "Rejected bootstrap integrity differs.");
        const p = body.proof;
        fields(p, ["version", "kind", "code", "genesis", "originalOwnerContextPin", "reviewedOwnerContextPin", "inventoryPin", "phasePin"]);
        check(p.version === 1 && p.kind === "bootstrap-empty-location-catalog" && p.code === "REJECTED_BEFORE_COMMIT" && P.same(p.genesis, r.intent.prepared.packet.genesis) && p.originalOwnerContextPin === r.writerRequest.scope.ownerContextPin && p.inventoryPin === r.writerRequest.scope.inventoryPin && p.phasePin === r.writerRequest.scope.phasePin && /^[a-f0-9]{64}$/.test(p.reviewedOwnerContextPin), "Rejected bootstrap proof differs.");
        // A terminal rejection must never coexist with a matching or conflicting receipt.
        if (state) check(!state.receipts.some(x => x.operationId === r.operationId) && state.gitShared && P.same(state.gitShared.genesis, p.genesis) && !state.gitShared.frames.some(f => f.receipt.operationId === r.operationId), "Rejected bootstrap has a receipt or different genesis.");
        else { const o = await observation(r); check(o.ready && o.operation.state === "missing", "Rejected bootstrap outcome conflicts."); }
        return freeze(value);
    }
    async function marker() { check(P.same(JSON.parse(await port.read(markerName)), sealed({...markerBody,version:observedMarkerVersion})), "Retention marker differs."); }
    async function getRaw(id) { await owned(); await marker(); const n = name(id), raw = await port.read(n), value = validate(raw, n); await owned(); return value; }
    async function all() { await owned(); await marker(); const records = []; for (const n of await names()) records.push(validate(await port.read(n), n));
        for (const n of (await port.list()).filter(n => n.startsWith("REQUEST-REJECTED-"))) check(records.some(r => rejectionName(r.operationId) === n), "Orphan rejected bootstrap evidence.");
        await owned(); return records; }
    async function write(n, value) {
        const raw = V.canonical(value) + "\n"; await owned();
        try { await port.writeNew(n, raw); }
        catch (error) { if (error.code !== "EEXIST") throw error; if (await port.read(n) !== raw) fail("OPERATION_CONFLICT", "Retained operation conflicts."); }
        check(await port.read(n) === raw, "Retention readback differs."); await owned();
    }
    async function observation(r) { await owned(); const value = await inspect(r); await owned(); return value; }
    async function reconcileRecord(r) { return (await observation(r)).operation; }
    async function requireResolved(records, currentId = null, state = null, recovery = false) {
        const batch = !state && (settings.version === 2 || settings.version === 4 && personalContext?.binding.version === 2) && inspectCommitted ? await inspectCommitted(records) : null;
        for (const r of records) {
            if (await rejection(r, state)) continue;
            if (r.operationId === currentId && (!prior.has(r.operationId) || recovery)) continue;
            if (state) {
                const receipt = state.receipts.find(x => x.operationId === r.operationId);
                if (!receipt || P.hash(JSON.parse(receipt.payload)) !== r.commandDigest) fail("OUTCOME_RECONCILIATION_REQUIRED", "A retained request requires review.");
            } else if (!batch?.has(r.operationId)) {
                const out = await reconcileRecord(r);
                if (out.state !== "committed") fail("OUTCOME_RECONCILIATION_REQUIRED", "A retained request requires review.");
            }
        }
    }
    function replayCode(r, o) {
        if (!o?.ready || !o.stamp) return "AUTHORITY_UNAVAILABLE";
        if (r.writerRequest.scope.ownerContextPin !== o.stamp.ownerContextPin || r.writerRequest.scope.identityPin !== o.stamp.identityPin) return "ORIGINAL_GUARDS_STALE";
        if (o.operation.state === "committed") return "EXACT_COMMITTED_REPLAY";
        if (o.operation.state !== "missing") return "OPERATION_CONFLICT";
        // Enabled roots fence every write/replay after known fallback. Missing
        // evidence alone never establishes nonexecution or permits rebasing.
        if (o.taskMutationVersion !== 1) return "EXACT_REPLAY_SAFETY_UNPROVEN";
        if (r.writerRequest.command.expectedRepositoryRevision !== o.stamp.head.repositoryRevision ||
            r.writerRequest.scope.partitions.some(p => !o.partitions.some(q => q.id === p.id && P.same(q.owner, p.owner) && q.revision === p.expectedRevision))) return "ORIGINAL_GUARDS_STALE";
        return "EXACT_ORIGINAL_HEAD_REPLAY";
    }
    const sameObservation = (a, b) => P.same(a.head, b.head) && a.hostEpoch === b.hostEpoch && a.ownerContextPin === b.ownerContextPin && a.identityPin === b.identityPin;
    function replayPermit(permission, r, state, info) {
        const p = permission && permits.get(permission);
        if (!p || !p.active || stopped || p.record.checksum !== r.checksum || !sameObservation(p.stamp, { head: { authorityId: state.storeId, repositoryRevision: state.revision, revisionId: state.revisionId }, hostEpoch: info.hostEpoch, ownerContextPin: info.ownerContextPin, identityPin: info.identityPin })) fail("RECOVERY_REVIEW_STALE", "Recovery review is unavailable.");
        return p;
    }
    return Object.freeze({
        reviewPrivateSaveRejection(id){return tracked(async()=>{
            check([1,4].includes(settings.version)&&typeof provePrivateSaveRejection==="function","Private save recovery is unavailable.");
            const r=await getRaw(id),existing=await rejection(r);if(existing)return freeze({operationId:id,state:"proven-not-executed",proof:existing.proof});
            check(r.format==="itacan-native-ui-request"&&r.writerRequest.command.type==="task.save","Only original private saves may be reviewed.");
            const proof=await provePrivateSaveRejection(r),report=freeze({operationId:id,state:"reviewable-nonexecution",recordChecksum:r.checksum,proof});privateSaveReviews.set(report,{record:r,proof});return report;
        });},
        concludePrivateSaveRejection(review){return tracked(async()=>{
            const selected=privateSaveReviews.get(review);check(selected,"Original private save nonexecution review required.");privateSaveReviews.delete(review);
            const r=await getRaw(selected.record.operationId);check(r.checksum===selected.record.checksum&&P.same(await provePrivateSaveRejection(r),selected.proof),"Private save recovery review is stale.");
            await write(rejectionName(r.operationId),sealed({format:"itacan-native-rejected-private-save",version:1,authorityId:config.authorityId,applicationContextId:config.applicationContextId,rehearsalId:settings.rehearsalId,operationId:r.operationId,recordChecksum:r.checksum,commandDigest:r.commandDigest,proof:selected.proof}));await rejection(r);return freeze({operationId:r.operationId,state:"proven-not-executed"});
        });},
        reviewBootstrapRejection(id) { return tracked(async () => {
            const r = await getRaw(id), existing = await rejection(r);
            if (existing) return freeze({ operationId: id, state: "rejected-before-commit", proof: existing.proof });
            check(typeof proveBootstrapRejection === "function", "Bootstrap rejection review unavailable.");
            const proof = await proveBootstrapRejection(r), report = freeze({ operationId: id, state: "reviewable-rejection", recordChecksum: r.checksum, proof });
            rejectionReviews.set(report, { record: r, proof }); return report;
        }); },
        concludeBootstrapRejection(review) { return tracked(async () => {
            const selected = rejectionReviews.get(review); check(selected, "An original bootstrap rejection review is required."); rejectionReviews.delete(review);
            const r = await getRaw(selected.record.operationId); check(r.checksum === selected.record.checksum, "Bootstrap request changed.");
            check(P.same(await proveBootstrapRejection(r), selected.proof), "Bootstrap rejection review is stale.");
            await write(rejectionName(r.operationId), sealed({ format: "itacan-native-rejected-bootstrap", version: 1, authorityId: config.authorityId, applicationContextId: config.applicationContextId, rehearsalId: settings.rehearsalId, operationId: r.operationId, recordChecksum: r.checksum, proof: selected.proof }));
            await rejection(r); return freeze({ operationId: r.operationId, state: "rejected-before-commit" });
        }); },
        isRejected(id) { return tracked(async () => !!(await rejection(await getRaw(id)))); },
        concludePersonalResolutionRejection(proof){return tracked(async()=>{check(settings.version===4,"Personal retention v4 required.");const p=require("../src/repository").consumePersonalResolutionRejection(proof),r=await getRaw(p.operationId),o=await observation(r);check(r.writerRequest.command.type==="personal.resolve"&&r.commandDigest===p.commandDigest&&p.authorityId===config.authorityId&&o.ready&&o.operation.state==="missing"&&P.same(o.stamp.head,{authorityId:config.authorityId,...p.head}),"Personal rejection observation changed.");await write(rejectionName(r.operationId),sealed({format:"itacan-native-rejected-personal-resolution",version:1,authorityId:config.authorityId,operationId:r.operationId,recordChecksum:r.checksum,commandDigest:r.commandDigest,proof:require("../personal/membership").seal({...p,bindingDigest:P.hash(personalContext.binding),replicaId:personalContext.signer.replicaId},personalContext.signer)}));return freeze({operationId:r.operationId,state:"rejected",code:"REJECTED_BEFORE_COMMIT"});});},
        async start(creating) {
            stopped = false; ready = false; prior.clear(); await owned();
            if (creating) await write(markerName, sealed(markerBody));
            else {const value=JSON.parse(await port.read(markerName));if((settings.version===3&&value.version===1)||(settings.version===4&&[1,3].includes(value.version)))observedMarkerVersion=value.version;check(P.same(value,sealed({...markerBody,version:observedMarkerVersion})),"Retention marker differs.");}
            for (const r of await all()) prior.add(r.operationId); ready = true;
        },
        prepare(input) {
            const r = record(input), id = r.operationId;
            if (preparing.has(id)) { const held = preparing.get(id); if (held.digest !== r.checksum) fail("OPERATION_CONFLICT", "Retained operation conflicts."); return held.promise; }
            const promise = tracked(async () => {
                check(preparing.size === 0, "Another request preparation is in progress.");
                const records = await all(), old = records.find(x => x.operationId === id);
                if (old) { if (!P.same(old, r)) fail("OPERATION_CONFLICT", "Retained operation conflicts."); check(!(await rejection(old)), "Rejected bootstrap cannot be prepared again."); return old; }
                await requireResolved(records);
                if((settings.version===3&&observedMarkerVersion===1)||(settings.version===4&&[1,3].includes(observedMarkerVersion))){await owned();await marker();const temp="retention-personal-"+require("node:crypto").randomUUID()+".tmp";await port.writeNew(temp,V.canonical(sealed(markerBody))+"\n");await port.replace(temp,markerName);observedMarkerVersion=settings.version;await marker();await port.syncDirectory();}
                if([2,3,4].includes(settings.version)){const o=await observation(r);check(o.ready&&o.stamp&&r.writerRequest.command.expectedRepositoryRevision===o.stamp.head.repositoryRevision&&r.writerRequest.scope.ownerContextPin===o.stamp.ownerContextPin&&r.writerRequest.scope.identityPin===o.stamp.identityPin,"Preparation context changed before retention.");}
                await write(name(id), r); return freeze(V.clone(r));
            });
            preparing.set(id, { digest: r.checksum, promise }); promise.finally(() => preparing.delete(id)).catch(() => {}); return promise;
        },
        assertResolved() { return tracked(async () => { await requireResolved(await all()); }); },
        assertRejectedCandidate(state){return tracked(async()=>{check(settings.version===4,"Personal v4 candidate check required.");for(const r of await all())await rejection(r,state);});},
        assertIncomingPacket(packet){return tracked(async()=>{check(settings.version===4,"Personal v4 packet check required.");for(const r of await all())if(await rejection(r))check(!packet.frames.some(f=>f.receipt.operationId===r.operationId),"Incoming origin contradicts terminal nonexecution evidence.");});},
        list() { return tracked(async () => freeze((await all()).map(r => ({ operationId: r.operationId, intentDigest: r.intentDigest, owner: r.owner, partitionId: r.partitionId })))); },
        get(id) { V.text(id); return tracked(() => getRaw(id)); },
        reconcile(id) { V.text(id); return tracked(async () => { const r = await getRaw(id); const terminal=await rejection(r);return terminal ? freeze({state:"rejected",code:terminal.format==="itacan-native-rejected-private-save"?"PROVEN_NOT_EXECUTED":"REJECTED_BEFORE_COMMIT",operationId:id,receipt:null,taskIds:[],eventIds:[]}) : reconcileRecord(r); }); },
        inspect(id) { V.text(id); return tracked(async () => {
            let r = null, o, damaged = false;
            try { r = await getRaw(id); o = await observation(r); await all(); }
            catch (error) {
                if (["LOCK_LOST", "ROOT_IDENTITY_CHANGED"].includes(error?.code)) return freeze({ version: 1, privacy: "local-private", authorityId: config.authorityId, applicationContextId: config.applicationContextId, operationId: id, classification: "authority-unavailable", code: error.code, owner: null, partitionId: null, recordChecksum: null, commandDigest: null, observation: null, receipt: null, taskIds: [], eventIds: [], canReplay: false, replayCode: "AUTHORITY_UNAVAILABLE" });
                damaged = true; o = await observation(null);
            }
            const terminal = r && !damaged ? await rejection(r) : null;
            const op = o.operation, classification = !o.ready ? "authority-unavailable" : damaged ? "damaged" : terminal ? "confirmed-rejected" : op.state === "committed" ? "confirmed-committed" : op.state === "missing" ? "execution-uncertain" : op.state === "conflict" ? "conflict" : "authority-unavailable";
            let code = !o.ready ? "AUTHORITY_UNAVAILABLE" : damaged ? "REQUEST_RETENTION_INVALID" : op.code, replay = damaged ? "REQUEST_RETENTION_INVALID" : replayCode(r, o);
            if (terminal) { code = terminal.format==="itacan-native-rejected-private-save"?"PROVEN_NOT_EXECUTED":"REJECTED_BEFORE_COMMIT"; replay = "TERMINAL_REJECTION"; }
            if (["EXACT_COMMITTED_REPLAY", "EXACT_ORIGINAL_HEAD_REPLAY"].includes(replay)) {
                try { await requireResolved((await all()).filter(x => x.operationId !== id)); } catch (_) { replay = "OTHER_REQUEST_UNRESOLVED"; }
            }
            const report = freeze({ version: 1, privacy: "local-private", authorityId: config.authorityId, applicationContextId: config.applicationContextId, operationId: id, classification, code,
                owner: damaged ? null : r.owner, partitionId: damaged ? null : r.partitionId, recordChecksum: damaged ? null : r.checksum, commandDigest: damaged ? null : r.commandDigest,
                observation: o.stamp, receipt: classification === "confirmed-committed" ? op.receipt : null, taskIds: classification === "confirmed-committed" ? op.taskIds : [], eventIds: classification === "confirmed-committed" ? op.eventIds : [],
                canReplay: ["EXACT_COMMITTED_REPLAY", "EXACT_ORIGINAL_HEAD_REPLAY"].includes(replay), replayCode: replay });
            if (report.canReplay) reviews.set(report, { record: r, stamp: o.stamp }); return report;
        }); },
        permit(review) { return tracked(async () => {
            const selected = reviews.get(review); if (!selected) fail("RECOVERY_REVIEW_REQUIRED", "An original accepted recovery review is required."); reviews.delete(review);
            const r = await getRaw(selected.record.operationId), o = await observation(r);
            check(!(await rejection(r)), "Rejected bootstrap cannot be replayed.");
            if (r.checksum !== selected.record.checksum || !o.ready || !sameObservation(selected.stamp, o.stamp)) fail("RECOVERY_REVIEW_STALE", "Recovery observation changed.");
            const code = replayCode(r, o); if (!["EXACT_COMMITTED_REPLAY", "EXACT_ORIGINAL_HEAD_REPLAY"].includes(code)) fail(code, "Exact replay cannot be admitted.");
            await requireResolved((await all()).filter(x => x.operationId !== r.operationId));
            const permission = Object.freeze({ version: 1 }); permits.set(permission, { active: true, record: r, stamp: o.stamp }); return permission;
        }); },
        finishReplay(permission) { const p = permits.get(permission); if (p) p.active = false; },
        assertReplayContext(permission, context, info) {
            const p = permits.get(permission); if (!p?.active || stopped || p.stamp.hostEpoch !== info.hostEpoch || p.stamp.ownerContextPin !== context.ownerContextPin || p.stamp.identityPin !== context.identityPin) fail("RECOVERY_REVIEW_STALE", "Recovery context changed.");
        },
        async verify(request, state, permission, info) {
            check(ready, "Retention unavailable.");
            const records = await all(), r = records.find(x => x.operationId === request.command.operationId);
            if (!r || r.writerRequestDigest !== P.hash(request) || r.commandDigest !== P.hash(A.compile(request))) fail("WRITER_ADMISSION_REQUIRED", "Exact retained request required.");
            check(!(await rejection(r, state)), "Rejected bootstrap cannot execute.");
            if (permission) replayPermit(permission, r, state, info);
            await requireResolved(records, r.operationId, state, !!permission);
            return r;
        },
        stop() { stopped = true; reviews = new WeakMap(); permits = new WeakMap(); },
        async drain() { await Promise.allSettled([...inflight]); },
        markerName
    });
}
module.exports = { createPendingRequests, markerName };
