"use strict";
const { RepositoryError, fail, check } = require("./errors");
const { clone, canonical, fields, uuid, timestamp, revision } = require("./value");
const { validateState, validatePartition, workspace, workspaceKey, location, phase, dateEndpoint } = require("./domain");
const { validateCommand, applyCommand } = require("./commands");
const { buildIndexes } = require("./indexes");
const Admission = require("./command-admission");
const resolutionErrors=new WeakMap(),resolutionProofs=new WeakMap();
function personalResolutionRejection(error){const body=resolutionErrors.get(error);if(!body)return null;resolutionErrors.delete(error);const proof=Object.freeze({version:1});resolutionProofs.set(proof,body);return proof;}
function consumePersonalResolutionRejection(proof){const body=resolutionProofs.get(proof);check(body,"Writer-proven personal rejection required.");resolutionProofs.delete(proof);return clone(body);}


function publicationResult(candidate, command, changes) {
    const affectedTasks = changes.taskIds.map(id => candidate.tasks.find(task => task.id === id));
    const targetTask = command.taskId ? candidate.tasks.find(task => task.id === command.taskId) : affectedTasks.length === 1 ? affectedTasks[0] : null;
    const result = { operationId: command.operationId, repositoryRevision: candidate.revision, revisionId: candidate.revisionId,
        taskId: targetTask?.id ?? null, taskRevision: targetTask?.revision ?? null, task: targetTask ? clone(targetTask) : null,
        tasks: affectedTasks.map(clone), change: { type: command.type, operationId: command.operationId, repositoryRevision: candidate.revision,
    taskIds: changes.taskIds, eventIds: changes.eventIds, partitions: candidate.partitions.filter(p => changes.partitionIds.includes(p.id)).map(clone) }, replayed: false, ...(changes.recurrence ? { recurrence: clone(changes.recurrence) } : {}), ...(changes.historyImport ? { historyImport: clone(changes.historyImport) } : {}) };
    if (changes.atomicTask) result.atomicTask = clone(changes.atomicTask);
    if (changes.gitShared) result.gitShared = clone(changes.gitShared);
    if (changes.personal) result.personal = clone(changes.personal);
    return result;
}
function initialState(partitions, storeId, nextId, gitSharedVersion, sharedGenesis) {
    check(gitSharedVersion === undefined || gitSharedVersion === 2, "Unsupported Git proof capability.");
    check(Array.isArray(partitions), "Explicit partitions are required."); uuid(storeId);
    const state = { schemaVersion: 1, storeId, revision: 0, revisionId: nextId(), parentRevisionId: null,
        partitions: partitions.map(p => { fields(p, ["id", "kind", "owner"], ["id", "kind", "owner"]); return { ...clone(p), revision: 0, head: null, parentHead: null }; }),
        tasks: [], history: [], bindings: [], receipts: [], retiredStepIds: [] };
    if (gitSharedVersion === 2) require("./git-shared").initialize(state, sharedGenesis);
    validateState(state); return state;
}
class TaskRepository {
    #storage; #state; #indexes; #options; #clock; #resolvers; #listeners; #queue; #closed; #closing; #closePromise; #admission;
    constructor(storage, state, options = {}) {
        check(typeof options.idFactory === "function", "An injected UUID factory is required.");
        this.#admission = Admission.repositoryGate(storage, options.commandAdmission);
        this.#storage = storage; this.#state = clone(state); validateState(this.#state); this.#indexes = buildIndexes(this.#state);
        this.#options = { ...options, ...(options.externalReservations ? { externalReservations: clone(options.externalReservations) } : {}) }; this.#clock = options.clock ?? Date.now; this.#resolvers = options.resolvers ?? {};
        this.#listeners = new Set(); this.#queue = Promise.resolve(); this.#closed = false; this.#closing = false; this.notificationErrors = [];
    }
    assertOpen() { if (this.#closed || this.#closing) fail("CLOSED", "Repository is closed."); }
    nextId() { const id = this.#options.idFactory(); uuid(id); return id; }
    info() { this.assertOpen(); return clone({ schemaVersion: this.#state.schemaVersion, storeId: this.#state.storeId, revision: this.#state.revision,
        revisionId: this.#state.revisionId, parentRevisionId: this.#state.parentRevisionId, partitions: this.#state.partitions, recovery: this.#storage.recovery ?? null,
        ...(this.#storage.storageInfo?.() ? { storage: this.#storage.storageInfo() } : {}), ...(this.#storage.atomicTaskCapability?.() ? { taskMutationVersion: 1 } : {}) }); }
    getTask(id, { includeDeleted = false } = {}) { this.assertOpen(); uuid(id); const task = this.#indexes.tasks.get(id); return task && (includeDeleted || task.deletedAt === null) ? clone(task) : null; }
    readSnapshot(input) {
        this.assertOpen();
        const projection = require("./snapshot-read"), request = projection.validateRequest(input);
        const work = this.#queue.then(async () => {
            const state = await this.#storage.load(); validateState(state);
            if (state.storeId !== this.#state.storeId || state.revisionId !== this.#state.revisionId) fail("REPOSITORY_CONFLICT", "Repository generation changed outside this instance.");
            if (state.storeId !== request.authorityId) fail("STORAGE_AUTHORITY_MISMATCH", "Snapshot authority differs.");
            const observation = await this.#storage.beginReadObservation?.();
            const result = projection.projectSnapshot(state, request, { fenced: !!this.#storage.recurrenceFence || !!this.#storage.atomicTaskRecoveryKnown?.(), info: this.#storage.storageInfo?.() ?? null });
            await this.#options.fault?.("snapshot:beforeAcceptance");
            await this.#storage.assertReadObservation?.(observation);
            return result;
        });
        this.#queue = work.catch(() => {}); return work;
    }
    getReceipt(operationId) { this.assertOpen(); const receipt = this.#indexes.receipts.get(operationId); return receipt ? clone(receipt) : null; }
    getHistoryImportPlan(id, options) {
        this.assertOpen(); uuid(id); fields(options, ["version"], ["version"]); if (options.version !== 1) fail("UNSUPPORTED_SCHEMA", "Unsupported import read contract.");
        const n = this.#state.historyImport; return n?.plan.id === id ? clone({ version: 1, plan: n.plan, outcome: n.outcome, status: n.outcome ? "published" : "prepared" }) : null;
    }
    historyCompatibility(options) {
        this.assertOpen(); fields(options, ["version", "projection"], ["version", "projection"]); if (options.version !== 1) fail("UNSUPPORTED_SCHEMA", "Unsupported compatibility read contract.");
        if (this.#storage.recurrenceFence) fail("HISTORY_UNAVAILABLE", "Known recovery loss prevents authoritative compatibility totals.");
        return require("../history/durable-projection").projectDurableHistoryCompatibility(clone(this.#state), options);
    }
    getRecurrenceSeries(id, options) { this.assertOpen(); uuid(id); if (options !== undefined) { fields(options, ["version"], ["version"]); if (options.version !== 2) fail("UNSUPPORTED_SCHEMA", "Unsupported series read contract."); }
        const n = this.#state.recurrence, series = n?.series.find(s => s.id === id); if (!series) return null;
        if (options?.version === 2) { const view = require("./recurrence-generation").snapshot(this.#state, series); if (series.templateId === null) view.template = null; return clone(view); }
        if (require("./recurrence-generation").preparedMember(this.#state, series.initialOccurrenceId)) fail("UNSUPPORTED_SCHEMA", "Prepared definitions require series-read version 2.");
        return clone({ version: 1, series, rule: n.ruleRevisions.find(r => r.ruleId === series.ruleId && r.revision === series.ruleRevision), template: series.templateId === null ? null : { definition: n.templates.find(t => t.id === series.templateId), revision: n.templateRevisions.find(t => t.templateId === series.templateId && t.revision === series.templateRevision) }, membership: n.memberships.find(o => o.seriesId === id) }); }
    recurrenceReadiness(options) { this.assertOpen(); if (options !== undefined) { fields(options, ["version", "seriesId"], ["version", "seriesId"]); if (options.version !== 2) fail("UNSUPPORTED_SCHEMA", "Unsupported readiness contract."); uuid(options.seriesId); return clone(require("./recurrence-generation").readiness(this.#state, options.seriesId, this.#storage.recurrenceFence)); }
        return clone({ version: 1, definitionWritesAllowed: !this.#storage.recurrenceFence, generationSupported: false, recoveryFence: this.#storage.recurrenceFence ?? null }); }
    exportSharedPacket() {
        this.assertOpen();
        const work = this.#queue.then(async () => {
            const state = await this.#storage.load(); validateState(state);
            check(state.storeId === this.#state.storeId && state.revisionId === this.#state.revisionId && state.gitShared, "Shared authoritative capture unavailable.");
            const observation = await this.#storage.beginReadObservation?.();
            await this.#storage.assertAllWritable?.(state);
            await require("./git-shared").validateState(state);
            const packet = require("./git-shared").packet(state.gitShared);
            await this.#storage.assertReadObservation?.(observation);
            await this.#storage.assertAllWritable?.(state); return clone(packet);
        });
        this.#queue = work.catch(() => {}); return work;
    }
    exportPersonalPacket() {
        this.assertOpen();
        const work = this.#queue.then(async () => {
            const state = await this.#storage.load(); validateState(state);
            check(state.storeId === this.#state.storeId && state.revisionId === this.#state.revisionId && state.personalShared, "Personal authoritative capture unavailable.");
            const observation = await this.#storage.beginReadObservation?.();
            await this.#storage.assertAllWritable?.(state); await require("./personal-shared").validateState(state);
            const packet = require("./personal-shared").packet(state.personalShared);
            await this.#storage.assertReadObservation?.(observation); return packet;
        }); this.#queue = work.catch(() => {}); return work;
    }
    proveStalePrivateSave(command, proof = null) {
        this.assertOpen(); const detached=clone(command), held=proof===null?null:clone(proof);
        const work=this.#queue.then(async()=>{
            const state=await this.#storage.load(); validateState(state);
            check(state.storeId===this.#state.storeId&&state.revisionId===this.#state.revisionId,"Private save proof generation changed.");
            const observation=await this.#storage.beginReadObservation?.();
            check(this.#storage.atomicTaskCapability?.()&&!this.#storage.recovery&&!this.#storage.atomicTaskRecoveryKnown?.()&&!this.#storage.recurrenceFence,"Intact atomic authority required for nonexecution proof.");
            await this.#storage.assertAllWritable?.(state);
            const result=held===null?require("./private-save-rejection").prove(state,detached):require("./private-save-rejection").verify(state,detached,held);
            await this.#storage.assertReadObservation?.(observation); await this.#storage.assertAllWritable?.(state); return clone(result);
        }); this.#queue=work.catch(()=>{}); return work;
    }
    exportSharedPartition(partitionId) {
        this.assertOpen(); check(!this.#state.personalShared, "Personal evidence cannot enter a Git partition export."); const partition = this.#state.partitions.find(p => p.id === partitionId);
        check(!!partition, "Unknown partition.");
        if (require("./history-import").dependentPartitions(this.#state).includes(partitionId)) fail("UNSUPPORTED_OPERATION", "Import-dependent partition transport requires the separately reviewed N4 contract.");
        if (this.#state.recurrence?.memberships.some(o => o.partitionId === partitionId)) fail("UNSUPPORTED_OPERATION", "Recurrence partition transport requires the separately reviewed N4 shared contract.");
        const tasks = this.#state.tasks.filter(t => t.partitionId === partitionId), ids = new Set(tasks.map(task => task.id));
        return require("./serialization").serializeSharedPartition({ partition, tasks, completionRefs: this.#state.bindings.filter(binding => ids.has(binding.taskId)) });
    }
    queryTasks(query = {}) {
        this.assertOpen(); fields(query, ["owner", "completed", "location", "phase", "start", "due", "partitionId", "includeArchived", "includeDeleted", "predicate", "scope"]);
        for (const key of ["includeArchived", "includeDeleted"]) if (query[key] !== undefined) check(typeof query[key] === "boolean", "Invalid lifecycle query flag.");
        const sets = [];
        if (query.owner !== undefined) { workspace(query.owner); sets.push(this.#indexes.owner.get(workspaceKey(query.owner)) ?? new Set()); }
        if (query.completed !== undefined) { check(typeof query.completed === "boolean", "Invalid completion query."); sets.push(this.#indexes.completed.get(query.completed) ?? new Set()); }
        if (query.location !== undefined) { location(query.location); sets.push(this.#indexes.location.get(canonical(query.location)) ?? new Set()); }
        if (query.phase !== undefined) {
            check(query.phase !== null, "Phase query must specify a Phase."); phase(query.phase, { type: "project", id: query.phase.projectId });
            sets.push(this.#indexes.phase.get(canonical(query.phase)) ?? new Set());
        }
        for (const key of ["start", "due"]) if (query[key] !== undefined) {
            fields(query[key], ["from", "to"]);
            for (const date of Object.values(query[key])) dateEndpoint({ date, time: null });
            check(!query[key].from || !query[key].to || query[key].from <= query[key].to, "Invalid date query range.");
            const ids = new Set(); for (const day of this.#indexes[key + "Days"]) if ((!query[key].from || day >= query[key].from) && (!query[key].to || day <= query[key].to)) {
                for (const id of this.#indexes[key].get(day)) ids.add(id);
            }
            sets.push(ids);
        }
        if (query.scope !== undefined) {
            if (!this.#resolvers.queryScope) fail("REFERENCE_UNRESOLVED", "No hierarchy/mount query extension is installed.");
            const ids = this.#resolvers.queryScope(clone(query.scope)); check(Array.isArray(ids), "Query scope resolver must return task IDs synchronously."); sets.push(new Set(ids));
        }
        if (query.predicate !== undefined) check(typeof query.predicate === "function", "Invalid query predicate.");
        const seed = sets.length ? [...sets.reduce((a, b) => a.size <= b.size ? a : b)] : [...this.#indexes.tasks.keys()];
        return seed.filter(id => sets.every(set => set.has(id))).map(id => this.#indexes.tasks.get(id)).filter(Boolean)
            .filter(task => (query.includeDeleted || task.deletedAt === null) && (query.includeArchived || task.archivedAt === null) &&
                (query.partitionId === undefined || task.partitionId === query.partitionId))
            .map(clone).filter(task => !query.predicate || query.predicate(task)).sort((a, b) => a.id.localeCompare(b.id));
    }
    queryHistory(query = {}) {
        this.assertOpen(); fields(query, ["taskId", "stepId", "partitionId", "counted", "kind"]);
        if (query.taskId !== undefined) uuid(query.taskId); if (query.stepId !== undefined) uuid(query.stepId);
        if (query.counted !== undefined) check(typeof query.counted === "boolean", "Invalid history counting query.");
        if (query.kind !== undefined) check(["task", "step"].includes(query.kind), "Invalid history kind query.");
        const ids = query.stepId !== undefined ? this.#indexes.historyByStep.get(query.stepId) ?? new Set() :
            query.taskId !== undefined ? this.#indexes.historyByTask.get(query.taskId) ?? new Set() : this.#indexes.history.keys();
        return [...ids].map(id => this.#indexes.history.get(id)).filter(record =>
            (query.taskId === undefined || record.taskId === query.taskId) && (query.stepId === undefined || record.stepId === query.stepId) &&
            (query.partitionId === undefined || record.partitionId === query.partitionId) && (query.counted === undefined || record.counted === query.counted) &&
            (query.kind === undefined || record.kind === query.kind)).map(clone).sort((a, b) => (a.timestamp ?? -1) - (b.timestamp ?? -1) || a.id.localeCompare(b.id));
    }
    subscribe(listener) { this.assertOpen(); check(typeof listener === "function", "Subscriber must be a function."); this.#listeners.add(listener); return () => this.#listeners.delete(listener); }
    publish(state, change) {
        this.#state = clone(state); this.#indexes = buildIndexes(this.#state);
        for (const listener of [...this.#listeners]) {
            try { const result = listener(clone(change)); if (result?.then) result.catch(error => this.reportSubscriberError(error)); }
            catch (error) { this.reportSubscriberError(error); }
        }
    }
    reportSubscriberError(error) {
        this.notificationErrors.push(String(error?.message ?? error)); this.notificationErrors = this.notificationErrors.slice(-20);
        try { this.#options.onSubscriberError?.(error); } catch (_) { /* Commit already succeeded. */ }
    }
    execute(input, admissionTicket, replicationEvidence) {
        this.assertOpen(); const command = clone(input); validateCommand(command);
        let sharedPacket = null, replicationError = null;
        if (replicationEvidence !== undefined) { try { fields(replicationEvidence, ["version", "packet"], ["version", "packet"]); sharedPacket = clone(replicationEvidence.packet); check(replicationEvidence.version === 1 && ["git.receive", "personal.receive"].includes(command.type) && require("./git-shared").hash(sharedPacket) === command.payload.packetDigest, "Replication evidence is receive-only and digest-bound."); } catch (error) { replicationError = error; } }
        let resolutionBefore=null,publicationAttempted=false;
        const work = this.#queue.then(async () => {
            const state = await this.#storage.load(); validateState(state);
            if (state.storeId !== this.#state.storeId || state.revisionId !== this.#state.revisionId) fail("REPOSITORY_CONFLICT", "Repository generation changed outside this instance.");
            if (state.gitShared) { check(this.#storage.gitSharedCapability?.(), "Git capability required."); check([...require("./git-shared").TYPES, "git.receive"].includes(command.type), "Unsupported Git operation."); } else check(command.type !== "git.receive", "Git receive requires explicit creation capability.");
            if(command.type==="personal.resolve")resolutionBefore={authorityId:state.storeId,head:{repositoryRevision:state.revision,revisionId:state.revisionId},operationId:command.operationId,commandDigest:require("./personal-shared").hash(command)};
            if (state.personalShared) { check(this.#options.personalSync, "Personal replica context required."); check([...require("./personal-shared").TYPES, "personal.receive", ...(this.#options.personalSync?.binding.version===2?["personal.resolve","personal.upgrade"]:[])].includes(command.type), "Unsupported personal operation."); }
            if (command.type.startsWith("personal.")) check(this.#options.personalSync, "Explicit personal admission required.");
            this.#storage.assertPersonalEnrollmentCommand?.(command, state);
            await this.#storage.assertAllWritable?.(state);
            if (["task.save", "task.createRich"].includes(command.type) && !this.#storage.atomicTaskCapability?.()) fail("ATOMIC_TASK_CAPABILITY_REQUIRED", "Atomic commands require capability enabled at creation.");
            if (this.#admission && this.#storage.recurrenceFence) fail("RECOVERY_REQUIRED", "Writer-hosted commands require intact ready state.");
            const admission = await Admission.begin(this.#admission, admissionTicket, command, state);
            if (replicationError) throw replicationError;
            const payload = canonical(command), receipt = this.#indexes.receipts.get(command.operationId) ?? (state.gitShared ? require("./git-shared").receiptEvidence(state, command.operationId)?.receipt : state.personalShared ? require("./personal-shared").receiptEvidence(state, command.operationId)?.receipt : null);
            const imports = require("./history-import"), importScope = imports.mergeScope(this.#storage.importRecoveryScope ?? null, imports.scopeOf(state));
            await this.#storage.assertHistoryImportWritable?.(command, state);
            imports.assertWritable(command, state, this.#storage.recurrenceFence, importScope);
            const recurrenceWrite = command.type.startsWith("recurrence.") || ["task.complete", "task.save"].includes(command.type) && state.recurrence?.memberships.some(o => o.taskId === command.taskId);
            if (recurrenceWrite) {
                await this.#storage.assertRecurrenceWritable?.();
                if (this.#storage.recurrenceFence) fail("RECURRENCE_RECOVERY_FENCED", "Recurrence definitions require verified reconciliation after ancestry recovery.", { fence: clone(this.#storage.recurrenceFence) });
            }
            if (this.#admission && this.#storage.recurrenceFence) fail("RECOVERY_REQUIRED", "Observed recovery fence blocks writer replay.");
            if (receipt) {
                if (receipt.payload !== payload) fail("OPERATION_CONFLICT", "Operation ID was reused with a different command.");
                const origin = !this.#indexes.receipts.has(command.operationId) ? (state.gitShared ? require("./git-shared") : state.personalShared ? require("./personal-shared") : null)?.receiptEvidence(state, command.operationId) : null;
                return { ...clone(receipt.result), replayed: true, ...(origin ? { originReplay: { version: 1, originId: origin.origin.id,
                    application: { operationId: origin.application.operationId, repositoryRevision: origin.application.result.repositoryRevision, revisionId: origin.application.result.revisionId } } } : {}) };
            }
            await Admission.fresh(this.#admission, admission, state);
            if (command.expectedRepositoryRevision !== undefined && command.expectedRepositoryRevision !== state.revision) fail("REPOSITORY_CONFLICT", "Repository revision is stale.", { expected: command.expectedRepositoryRevision, actual: state.revision });
            const now = this.#clock(); timestamp(now); check(now !== null, "Clock must return a timestamp.");
            await this.#options.fault?.("beforeCommandValidation");
            const recoveryReservedIds = importScope ? [...importScope.taskIds, ...importScope.stepIds, ...importScope.eventIds] : state.personalShared?.version===2 ? require("./personal-shared-v2").reservedIds(state) : [];
            const allocations = [], allocate = () => { const id = this.nextId(); if (state.gitShared || state.personalShared || command.type.startsWith("personal.")) allocations.push(id); return id; };
            const context = { now, sharedPacket, personalPacket: command.type === "personal.receive" ? sharedPacket : null, personal: this.#options.personalSync, gitInventory: !!state.gitShared && !!this.#storage.gitSharedCapability?.(), nextId: () => { const id = allocate(); if (recoveryReservedIds.includes(id) && !require("./completion-effects").isAtomic(command.type)) fail("IDENTITY_CONFLICT", "Identity remains protected by import recovery scope."); return id; }, resolvers: this.#resolvers, fault: this.#options.fault, externalReservations: this.#options.externalReservations, historyImportEvidence: this.#options.historyImportEvidence, recoveryReservedIds };
            const candidate = clone(state), changes = await applyCommand(candidate, command, context);
            if (candidate.historyImport) await this.#options.fault?.("history:beforeProjectionMetadata");
            imports.reconcile(candidate, state, command, changes.atomicTask ?? null);
            if (changes.atomicTask && candidate.historyImport) await this.#options.fault?.("atomic:afterImportReconciliation");
            candidate.revision++; candidate.parentRevisionId = candidate.revisionId; candidate.revisionId = allocate();
            for (const partition of candidate.partitions) if (changes.partitionIds.includes(partition.id)) {
                partition.revision++; partition.parentHead = partition.head; partition.head = allocate(); validatePartition(partition);
            }
            const result = publicationResult(candidate, command, changes);
            await this.#options.fault?.("beforeReceiptPersistence");
            candidate.receipts.push({ operationId: command.operationId, payload, result: clone(result), partitionIds: changes.partitionIds, coordination: command.coordination ?? null });
            if (state.gitShared) { require("./git-shared").record(candidate, state, candidate.receipts.at(-1), { allocations, now, replicaId: this.#options.sharedReplicaId, inventory: this.#options.externalReservations }, sharedPacket); await require("./git-shared").validateState(candidate); }
            if (candidate.personalShared) { require("./personal-shared").record(candidate,state,candidate.receipts.at(-1),{personal:this.#options.personalSync,allocations,now,inventory:this.#options.externalReservations},command.type === "personal.receive" ? sharedPacket : null); await require("./personal-shared").validateState(candidate); }
            if (changes.historyImport) await this.#options.fault?.("history:beforeCandidateValidation");
            if (command.type === "recurrence.complete") await this.#options.fault?.("beforeRecurrenceCandidateValidation");
            validateState(candidate); if (changes.atomicTask) await this.#options.fault?.("atomic:afterReceiptValidation"); await this.#options.fault?.("beforeCommit");
            await this.#storage.assertAllWritable?.(candidate);
            if (changes.historyObservation) await imports.observe(context, changes.historyObservation);
            await this.#storage.assertHistoryImportWritable?.(command, state);
            imports.assertWritable(command, state, this.#storage.recurrenceFence, importScope);
            if (recurrenceWrite) { await this.#storage.assertRecurrenceWritable?.(); if (this.#storage.recurrenceFence) fail("RECURRENCE_RECOVERY_FENCED", "Recurrence state requires verified reconciliation."); }
            await Admission.seal(this.#admission, admission, candidate, state);
            try { publicationAttempted=true; await this.#storage.commit(candidate, state.revisionId, { command, priorState: state, admission }); }
            catch (error) { if (error.code === "ACKNOWLEDGEMENT_LOST") this.publish(candidate, result.change); throw error; }
            this.publish(candidate, result.change);
            try { await this.#options.fault?.("beforeAcknowledgement"); }
            catch (_) { throw new RepositoryError("ACKNOWLEDGEMENT_LOST", "Commit succeeded; retry the identical operation to retrieve its receipt.", { operationId: command.operationId, committed: true }); }
            return clone(result);
        }).catch(error=>{if(resolutionBefore&&!publicationAttempted&&["PERSONAL_REVIEW_STALE","REPOSITORY_CONFLICT","PARTITION_CONFLICT","WRITER_EVIDENCE_CONFLICT","REFERENCE_UNRESOLVED"].includes(error.code))resolutionErrors.set(error,{...resolutionBefore,code:error.code,publication:"not-attempted"});throw error;});
        this.#queue = work.catch(() => {}); return work;
    }
    async close() {
        if (this.#closed) return;
        if (this.#closing) return this.#closePromise;
        this.#closing = true; this.#closePromise = (async () => { await this.#queue; await this.#storage.close(); this.#listeners.clear(); this.#closed = true; })();
        try { await this.#closePromise; } catch (error) { this.#closing = false; throw error; }
    }
}
module.exports = { initialState, TaskRepository, publicationResult, personalResolutionRejection, consumePersonalResolutionRejection };
