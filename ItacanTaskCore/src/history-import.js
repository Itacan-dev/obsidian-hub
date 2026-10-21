"use strict";
// Portable durable invariants. Only the two explicit write operations lazily
// load the Node-only E1 verifier. No store or second dispatcher lives here.
const { check, fail } = require("./errors");
const { fields, canonical, clone, uuid, text, revision, timestamp, jsonValue } = require("./value");
const content = require("./source-content");
const DECISION = "N1-E2-E01-E09-r1", CAPABILITY = "private-history-import-v1";
const HISTORY_IMPORT_COMMANDS = Object.freeze({ version: 1, commands: Object.freeze(["history.prepareImport", "history.importBundle"]) });
const record = (v, keys) => fields(v, keys, keys);
const hash = v => content.sha256(canonical(v));
const digest = v => hash({ ...v, digest: null });
const stamp = v => ({ ...v, digest: digest(v) });
const same = (a, b) => canonical(a) === canonical(b);
const isImport = type => HISTORY_IMPORT_COMMANDS.commands.includes(type);
const unsupported = (v, expected = 1) => { if (v !== expected) fail("UNSUPPORTED_SCHEMA", "Unsupported private History import version."); };
const ownerKey = owner => canonical(owner);
const getPartition = (state, owner) => state.partitions.find(p => same(p.owner, owner));
function pinsFor(c, inventory) {
    const p = c.identity?.snapshot.plans.find(p => p.id === c.identity.planId);
    return { captureId: c.id, lineage: c.lineage, captureRevision: c.revision, captureDigest: c.digest,
        sourceRevision: c.sourceRevision, sourceDigest: p?.snapshotDigest ?? hash([]), historyRevision: c.historyRevision, historyDigest: hash(c.history), checksRevision: c.checksRevision, checksDigest: hash(c.checks),
        registryRevision: c.registryRevision, registryDigest: hash(c.registry), identity: c.identity === null ? null : { storeId: c.identity.storeId, revision: c.identity.revision, planId: c.identity.planId, planDigest: c.identity.planDigest, snapshotDigest: p.snapshotDigest },
        externalInventoryRevision: inventory.revision, externalInventoryDigest: hash(inventory) };
}
function validatePins(p) {
    record(p, ["captureId", "lineage", "captureRevision", "captureDigest", "sourceRevision", "sourceDigest", "historyRevision", "historyDigest", "checksRevision", "checksDigest", "registryRevision", "registryDigest", "identity", "externalInventoryRevision", "externalInventoryDigest"]);
    for (const [k, v] of Object.entries(p)) if (k !== "identity") text(v);
    if (p.identity !== null) { record(p.identity, ["storeId", "revision", "planId", "planDigest", "snapshotDigest"]); uuid(p.identity.storeId); revision(p.identity.revision); for (const k of ["planId", "planDigest", "snapshotDigest"]) text(p.identity[k]); }
}
function validateCommand(command) {
    check(command.expectedRepositoryRevision !== undefined && command.taskId === undefined && command.expectedRevision === undefined && command.context === undefined, "Import requires repository revision and no task/completion context.");
    const p = command.payload; unsupported(p.version);
    const keys = ["version", "decisionRevision", "planId", "bundleDigest", "pins", "partitions", "syntheticOnly", "reason"];
    record(p, [...keys, ...(command.type === "history.prepareImport" ? ["publicationOperationId", "bundle"] : ["expectedPlanRevision", "preparedPlanDigest"])]);
    check(p.decisionRevision === DECISION && p.syntheticOnly === true, "Reviewed closed synthetic import required."); uuid(p.planId); text(p.bundleDigest); text(p.reason); validatePins(p.pins);
    check(Array.isArray(p.partitions), "Explicit partition guards required."); const ids = new Set();
    for (const g of p.partitions) { record(g, ["owner", "partitionId", "expectedRevision"]); require("./domain").workspace(g.owner); text(g.partitionId); revision(g.expectedRevision); check(!ids.has(g.partitionId), "Duplicate partition guard."); ids.add(g.partitionId); }
    if (command.type === "history.prepareImport") { text(p.publicationOperationId); check(p.publicationOperationId !== command.operationId, "Preparation and publication operations must differ."); }
    else { check(p.expectedPlanRevision === 1, "Only immutable prepared plan revision 1 is supported."); text(p.preparedPlanDigest); }
}
function bundleOf(state) {
    const n = state.historyImport, receipt = state.receipts.find(r => r.operationId === n?.capture.prepareOperationId);
    check(receipt, "Missing authoritative preparation receipt."); const command = JSON.parse(receipt.payload);
    check(command.type === "history.prepareImport", "Capture points to a different command."); return command.payload.bundle;
}
function reservedIds(state) { const n = state.historyImport; return n ? [...n.plan.reservations.map(r => r.id), ...n.externalInventory.ids] : []; }
function claimedExternal(state, id) {
    const n = state.historyImport, r = n?.plan.reservations.find(r => r.id === id);
    return state.schemaVersion === 4 && !!n.outcome && !!r?.externalClaim && ["task", "step"].includes(r.kind) && n.outcome.taskIds.concat(n.outcome.stepIds).includes(id);
}
function importedTask(task) { return task.migration?.source === "history-import-v1"; }
function dependentPartitions(state) {
    const n = state.historyImport; if (!n) return [];
    return [...new Set([...n.plan.partitionIds, ...state.tasks.filter(importedTask).map(t => t.partitionId)])].sort();
}
function scopeOf(state) {
    const n = state.historyImport; if (!n) return null;
    return stamp({ version: 1, minimumSchemaVersion: 4, planId: n.plan.id, captureDigest: n.capture.digest,
        taskIds: n.plan.reservations.filter(r => r.kind === "task").map(r => r.id).sort(), stepIds: n.plan.reservations.filter(r => r.kind === "step").map(r => r.id).sort(),
        eventIds: n.plan.reservations.filter(r => r.kind === "event").map(r => r.id).sort(), partitionIds: dependentPartitions(state), digest: null });
}
function validateScope(s) {
    record(s, ["version", "minimumSchemaVersion", "planId", "captureDigest", "taskIds", "stepIds", "eventIds", "partitionIds", "digest"]); unsupported(s.version);
    check(s.minimumSchemaVersion === 4 && s.digest === digest(s), "Invalid import recovery scope."); uuid(s.planId); text(s.captureDigest); const ids = new Set();
    for (const k of ["taskIds", "stepIds", "eventIds", "partitionIds"]) { check(Array.isArray(s[k]) && new Set(s[k]).size === s[k].length, "Invalid recovery identity inventory."); for (const id of s[k]) { if (k === "partitionIds") text(id); else { uuid(id); check(!ids.has(id), "Recovery identity kinds collide."); ids.add(id); } } }
}
function mergeScope(a, b) {
    if (!a) return clone(b); if (!b) return clone(a); validateScope(a); validateScope(b);
    check(a.planId === b.planId && a.captureDigest === b.captureDigest, "Recovery scopes name different captures.");
    return stamp({ ...a, ...Object.fromEntries(["taskIds", "stepIds", "eventIds", "partitionIds"].map(k => [k, [...new Set([...a[k], ...b[k]])].sort()])), digest: null });
}
function bindingWrite(command, state, scope) {
    if (isImport(command.type)) return true;
    const task = state.tasks.find(t => t.id === command.taskId), protectedTask = importedTask(task ?? {}) || scope?.taskIds.includes(command.taskId);
    if (!protectedTask) return false;
    return ["task.complete", "task.save", "step.complete", "task.delete", "step.delete", "task.editStructure"].includes(command.type) || command.type === "step.add" && command.payload.step?.completed === true || command.type === "task.relocate" && !same(command.payload.owner, task?.owner ?? null);
}
function assertWritable(command, state, fence, scope) {
    if (fence && bindingWrite(command, state, scope)) fail("HISTORY_IMPORT_RECOVERY_FENCED", "Historical import/bindings require verified reconciliation after recovery.");
}
function nativePublication(state, event, owners, revisionLimit) {
    const receipt = state.receipts.find(r => r.operationId === event.operationId && r.result.change.eventIds.includes(event.id));
    check(receipt && receipt.result.repositoryRevision <= revisionLimit, "Native event lacks its creation receipt.");
    const command = JSON.parse(receipt.payload), witness = owners.find(o => event.ownerAtEvent !== null && same(o.owner, event.ownerAtEvent));
    return { version: 1, eventId: event.id, operationId: event.operationId, repositoryRevision: receipt.result.repositoryRevision, index: receipt.result.change.eventIds.indexOf(event.id),
        ownerSnapshot: witness ? clone(witness) : null, availability: event.legacy === null || independentLegacy(event.legacy, state.historyImport?.capture) ? "available" : "unavailable" };
}
function independentLegacy(legacy, capture) {
    return legacy && typeof legacy === "object" && !Array.isArray(legacy) && typeof legacy.sourceLineage === "string" && legacy.sourceLineage !== capture?.lineage && typeof legacy.sourceCaptureDigest === "string" && /^[0-9a-f]{64}$/.test(legacy.sourceCaptureDigest) && legacy.sourceCaptureDigest !== capture?.digest;
}
function reconcile(state, before, command, atomicEffects = null) {
    const n = state.historyImport; if (!n) return;
    if (command.type === "task.save") {
        const F = require("./completion-effects"), oldTask = before.tasks.find(t => t.id === command.taskId), task = state.tasks.find(t => t.id === command.taskId);
        check(same(atomicEffects, F.describe(state, command, oldTask, F.bindingsFor(before, oldTask), task, F.bindingsFor(state, task))), "Import reconciliation requires exact candidate effects.");
    }
    const old = new Map(before.history.map(e => [e.id, e]));
    for (const event of state.history) {
        if (n.outcome?.events.some(e => e.id === event.id)) {
            const previous = old.get(event.id);
            if (previous?.counted && !event.counted) {
                check(["task.complete", "step.complete"].includes(command.type) && command.payload.completed === false || command.type === "task.save" && atomicEffects.effects.some(e => e.transition === "reopen" && e.eventId === event.id && e.taskId === event.taskId && e.stepId === event.stepId), "Imported event suppression requires genuine reopening.");
                const allocation = n.plan.groups.find(g => g.eventId === event.id);
                check(!n.projection.suppressions.some(s => s.groupKey === allocation.key), "Imported group already suppressed.");
                n.projection.suppressions.push({ version: 1, groupKey: allocation.key, eventId: event.id, operationId: command.operationId, repositoryRevision: state.revision + 1 });
            }
        } else if (!old.has(event.id)) {
            const owner = n.plan.ownerSnapshots.find(o => event.ownerAtEvent !== null && same(o.owner, event.ownerAtEvent));
            n.projection.publications.push({ version: 1, eventId: event.id, operationId: command.operationId, repositoryRevision: state.revision + 1,
                index: atomicEffects ? atomicEffects.effects.filter(e => e.transition !== "detach").findIndex(e => e.eventId === event.id) : state.history.filter(e => !old.has(e.id)).indexOf(event), ownerSnapshot: owner ? clone(owner) : null,
                availability: event.legacy === null || independentLegacy(event.legacy, n.capture) ? "available" : "unavailable" });
        }
    }
}
async function observe(ctx, expected) {
    if (typeof process === "undefined" || !process.versions?.node) fail("UNSUPPORTED_OPERATION", "Historical import writes require the explicit Node-only E1 verifier.");
    const provider = ctx.historyImportEvidence;
    check(provider?.version === 1 && provider.mode === "closed-synthetic" && typeof provider.read === "function", "A closed synthetic read-only evidence provider is required.");
    const value = clone(await provider.read()); jsonValue(value); record(value, ["version", "exclusive", "capture", "externalInventory", "ownerSnapshots"]);
    check(value.version === 1 && value.exclusive === true, "Exclusive closed synthetic observation required.");
    require("./recurrence").validateExternalReservations(value.externalInventory);
    if (expected && !same(value, expected)) fail("SOURCE_CONFLICT", "Source, History, checks, identity, inventory or owner context changed."); return value;
}
async function applyImport(state, command, ctx) {
    validateCommand(command); const p = command.payload;
    await ctx.fault?.("history:beforePlanValidation");
    const observation = await observe(ctx);
    if (!same(p.pins, pinsFor(observation.capture, observation.externalInventory))) fail("SOURCE_CONFLICT", "Observed capture no longer matches command pins.");
    if (ctx.externalReservations && !same(ctx.externalReservations, observation.externalInventory) || state.recurrence && !same(state.recurrence.externalInventory, observation.externalInventory)) fail("RESERVATION_CONFLICT", "Immutable native external inventory differs.");
    if (command.type === "history.prepareImport") {
        if (state.historyImport) fail("HISTORY_IMPORT_CAPTURE_CONFLICT", "This repository already has its one global capture.");
        const b = p.bundle; jsonValue(b); record(b, ["format", "version", "proposal", "drafts", "partitionMappings", "ownerSnapshots", "nativeHistoryWitnesses", "digest"]);
        unsupported(b.version); check(b.format === "itacan-reviewed-history-import-bundle" && b.digest === digest(b) && b.digest === p.bundleDigest, "Reviewed bundle digest mismatch.");
        await ctx.fault?.("history:beforeEvidenceValidation");
        const H = require("../history"), proposal = H.proposeImportBundle(b.proposal.capture, b.proposal.review);
        check(same(proposal, b.proposal), "E1 proposal was altered or promoted to executable state.");
        if (!same(proposal.capture, observation.capture) || !same(b.ownerSnapshots, observation.ownerSnapshots)) fail("SOURCE_CONFLICT", "Bundle differs from current closed evidence.");
        const c = proposal.capture, a = proposal.analysis;
        validateOwners(state, b);
        check(Array.isArray(b.nativeHistoryWitnesses), "Native History witnesses required.");
        for (const event of state.history) if (event.legacy !== null) {
            const witness = b.nativeHistoryWitnesses.find(w => w.eventId === event.id);
            check(witness && witness.legacyDigest === hash(event.legacy) && independentLegacy(event.legacy, c), "Unproven overlap with pre-existing native historical evidence.");
        }
        check(b.nativeHistoryWitnesses.length === state.history.filter(e => e.legacy !== null).length, "Extra/missing native History witness.");
        const ids = new Set([...state.tasks.flatMap(t => [t.id, ...t.steps.map(s => s.id)]), ...state.retiredStepIds, ...state.history.map(e => e.id), ...(state.recurrence?.reservations.map(r => r.id) ?? [])]);
        const external = new Set(observation.externalInventory.ids), reservations = [], selected = new Set();
        const sourcePlan = c.identity?.snapshot.plans.find(x => x.id === c.identity.planId);
        for (const target of a.targets) if (target.nativeId) {
            await ctx.fault?.("history:beforeReservation"); const id = target.nativeId;
            if (ids.has(id) || selected.has(id)) fail("IDENTITY_CONFLICT", "Planned target is already live, retired or reserved.", { id });
            const entry = sourcePlan.entries.find(e => e.entryId === target.entryId), partition = getPartition(state, target.owner);
            const evidence = c.identity.snapshot.reservations.find(r => r.id === id && r.planId === sourcePlan.id && r.entryId === entry.entryId && r.kind === entry.kind && same(r.owner, entry.owner) && r.status === "published");
            check(evidence, "Target lacks its exact published N1-B reservation.");
            if (target.disposition === "eligible-evidence-only") check(partition, "Eligible tree has no native owner partition.");
            selected.add(id); ids.add(id); reservations.push({ id, kind: target.kind, entryId: target.entryId, groupKey: null, owner: clone(target.owner), partitionId: partition?.id ?? null, externalClaim: external.has(id), purpose: target.disposition === "eligible-evidence-only" ? "eligible-target" : "quarantined-target" });
        }
        const blocked = new Set([...ids, ...external, command.operationId, p.publicationOperationId, p.planId]);
        const allocate = () => { for (let i = 0; i < 16; i++) { const id = ctx.nextId(); uuid(id); if (!blocked.has(id) && !c.history.some(row => row && typeof row === "object" && row.id === id)) { blocked.add(id); return id; } } fail("IDENTITY_EXHAUSTED", "No free event UUID in sixteen draws."); };
        const groups = [];
        for (const g of a.groups) {
            const row = c.history[g.ordinals[0]], partition = g.owner && getPartition(state, g.owner), reasons = [...g.reasons];
            if (!partition) reasons.push("NATIVE_PARTITION_UNAVAILABLE");
            if (g.kind === "step" && row?.parentText != null && typeof row.parentText !== "string") reasons.push("NATIVE_PARENT_SNAPSHOT_UNSUPPORTED");
            if (a.globalBlockers.includes("RAW_SOURCE_UNAVAILABLE")) reasons.push("RAW_SOURCE_UNAVAILABLE");
            let eventId = null;
            if (!reasons.length) { await ctx.fault?.("history:beforeEventAllocation"); eventId = allocate(); reservations.push({ id: eventId, kind: "event", entryId: null, groupKey: g.key, owner: clone(g.owner), partitionId: partition.id, externalClaim: false, purpose: "historical-event" }); }
            groups.push({ key: g.key, rowKeys: clone(g.rowKeys), ordinals: clone(g.ordinals), eventId, reasons: [...new Set(reasons)].sort(), owner: clone(g.owner), partitionId: partition?.id ?? null, kind: g.kind, timestamp: g.canonicalTimestamp, timeQuality: g.timeQuality });
        }
        for (const e of state.history) if (c.history.some(row => row && typeof row === "object" && row.id === e.id)) fail("EVENT_ID_CONFLICT", "Existing native UUID collides with raw History identity.");
        validateDrafts(b, a, sourcePlan, c);
        for (const d of b.drafts) { const specimen = await constructTask(state, b, a, sourcePlan, d, p.planId, ctx.now, command.operationId, ctx.fault); require("./domain").validateTask(specimen); await require("./domain").validateReferences(specimen, ctx.resolvers); }
        const partitionIds = [...new Set([...reservations.map(r => r.partitionId).filter(Boolean), ...a.groups.map(g => g.owner && getPartition(state, g.owner)?.id).filter(Boolean)])].sort();
        partitionGuards(state, p.partitions, partitionIds);
        const plan = stamp({ version: 1, revision: 1, id: p.planId, bundleDigest: p.bundleDigest, pins: clone(p.pins), publicationOperationId: p.publicationOperationId, preparedAt: ctx.now,
            preparedRepositoryRevision: state.revision + 1, analysisDigest: hash(a), treeDispositions: clone(a.trees), groups, reservations, partitionIds, ownerSnapshots: clone(b.ownerSnapshots), digest: null });
        state.schemaVersion = 4; state.historyImport = { format: "itacan-private-history-import", version: 1, requiredCapabilities: [CAPABILITY], capture: { id: c.id, lineage: c.lineage, digest: c.digest, prepareOperationId: command.operationId }, plan, externalInventory: clone(observation.externalInventory), outcome: null, projection: { version: 1, publications: [], suppressions: [] } };
        for (const event of state.history) state.historyImport.projection.publications.push(nativePublication(state, event, b.ownerSnapshots, state.revision));
        await ctx.fault?.("history:afterPreparation");
        return { taskIds: [], eventIds: [], partitionIds, historyImport: resultOf(state), historyObservation: observation };
    }
    const n = state.historyImport;
    check(n && n.plan.id === p.planId && n.plan.digest === p.preparedPlanDigest && n.plan.bundleDigest === p.bundleDigest && same(n.plan.pins, p.pins), "Prepared import plan mismatch.");
    if (n.outcome) fail("HISTORY_IMPORT_ALREADY_PUBLISHED", "Capture already has its immutable import outcome.");
    check(command.operationId === n.plan.publicationOperationId, "Publication operation differs from preparation.");
    const b = bundleOf(state), c = b.proposal.capture, a = b.proposal.analysis;
    if (!same(c, observation.capture) || !same(b.ownerSnapshots, observation.ownerSnapshots)) fail("SOURCE_CONFLICT", "Prepared evidence is no longer current.");
    const verified = require("../history").proposeImportBundle(c, b.proposal.review); check(same(verified, b.proposal), "Prepared E1 evidence no longer verifies.");
    partitionGuards(state, p.partitions, n.plan.partitionIds);
    const sourcePlan = c.identity?.snapshot.plans.find(x => x.id === c.identity.planId);
    const occupied = new Set([...state.tasks.flatMap(t => [t.id, ...t.steps.map(s => s.id)]), ...state.retiredStepIds, ...state.history.map(e => e.id), ...(state.recurrence?.reservations.map(r => r.id) ?? [])]);
    for (const r of n.plan.reservations) { await ctx.fault?.("history:beforeReservation"); if (occupied.has(r.id)) fail("IDENTITY_CONFLICT", "Prepared identity became occupied."); }
    const tasks = [];
    for (const d of b.drafts) { await ctx.fault?.("history:beforeTaskConstruction"); const task = await constructTask(state, b, a, sourcePlan, d, n.plan.id, ctx.now, command.operationId, ctx.fault); await ctx.fault?.("history:afterContentAttachment"); require("./domain").validateTask(task); await require("./domain").validateReferences(task, ctx.resolvers); tasks.push(task); }
    const events = [], bindings = [];
    for (const g of n.plan.groups) if (g.eventId !== null) {
        await ctx.fault?.("history:beforeEventInsertion"); const row = c.history[g.ordinals[0]], binding = a.bindings.find(x => x.groupKey === g.key), target = binding && a.targets.find(t => t.entryId === binding.entryId), root = binding && a.targets.find(t => t.entryId === binding.taskEntryId);
        const event = { id: g.eventId, operationId: command.operationId, partitionId: g.partitionId, kind: g.kind, taskId: root?.nativeId ?? null, stepId: target?.kind === "step" ? target.nativeId : null,
            timestamp: g.timestamp, recordedAt: null, ownerAtEvent: clone(g.owner), workingContext: null, oathId: null, sessionId: null, snapshot: { title: row.text, parentTitle: g.kind === "step" ? row.parentText ?? null : null }, counted: true, reopenedAt: null,
            legacy: { format: "itacan-imported-history-ref", version: 1, captureDigest: c.digest, groupKey: g.key } };
        require("./domain").validateHistory(event); events.push(event);
        if (binding) { await ctx.fault?.("history:beforeBindingInsertion"); bindings.push({ taskId: root.nativeId, stepId: target.kind === "step" ? target.nativeId : null, eventId: event.id }); }
    }
    state.tasks.push(...tasks); state.history.push(...events); state.bindings.push(...bindings);
    await ctx.fault?.("history:beforeImportOutcome");
    n.outcome = stamp({ version: 1, planId: n.plan.id, planRevision: 1, operationId: command.operationId, receiptOperationId: command.operationId, repositoryRevision: state.revision + 1, importedAt: ctx.now,
        taskIds: tasks.map(t => t.id), stepIds: tasks.flatMap(t => t.steps.map(s => s.id)), eventIds: events.map(e => e.id), events: clone(events), bindings: clone(bindings), creationDigest: hash({ tasks, events, bindings }), digest: null });
    await ctx.fault?.("history:afterImportOutcome");
    return { taskIds: tasks.map(t => t.id).sort(), eventIds: events.map(e => e.id), partitionIds: n.plan.partitionIds, historyImport: resultOf(state), historyObservation: observation };
}
function validateOwners(state, b) {
    check(Array.isArray(b.partitionMappings) && b.partitionMappings.length === state.partitions.length && Array.isArray(b.ownerSnapshots) && b.ownerSnapshots.length === state.partitions.length, "Complete native partition/owner context required.");
    for (const p of state.partitions) {
        const maps = b.partitionMappings.filter(m => m.partitionId === p.id), owners = b.ownerSnapshots.filter(o => same(o.owner, p.owner));
        check(maps.length === 1 && owners.length === 1 && same(maps[0].owner, p.owner), "Partition mapping/owner context conflict."); record(maps[0], ["owner", "partitionId"]);
        record(owners[0], ["owner", "label", "status", "evidence"]); text(owners[0].label); check(owners[0].status === null || typeof owners[0].status === "string", "Owner status must be explicit."); check(owners[0].evidence === "reviewed-closed-synthetic", "Reviewed synthetic label evidence required.");
    }
}
function partitionGuards(state, guards, ids) {
    check(same(guards.map(g => g.partitionId).sort(), [...ids].sort()), "Partition guards must cover exactly the dependent set.");
    for (const g of guards) { const p = state.partitions.find(p => p.id === g.partitionId); if (!p || !same(p.owner, g.owner) || p.revision !== g.expectedRevision) fail("REVISION_CONFLICT", "Native partition changed."); }
}
function validateDrafts(b, a, sourcePlan, c) {
    check(Array.isArray(b.drafts), "Explicit eligible tree drafts required.");
    const eligible = a.trees.filter(t => t.disposition === "eligible-evidence-only");
    check(b.drafts.length === eligible.length && new Set(b.drafts.map(d => d.entryId)).size === eligible.length, "Drafts must contain exactly eligible complete trees.");
    for (const d of b.drafts) {
        record(d, ["entryId", "title", "description", "continuation", "steps"]); check(eligible.some(t => t.taskEntryId === d.entryId), "Draft targets a quarantined tree.");
        check(typeof d.title === "string" && !!d.title.trim() && !/[\r\n]/.test(d.title) && typeof d.description === "string" && typeof d.continuation === "string" && Array.isArray(d.steps), "Explicit task content required.");
        const steps = sourcePlan.entries.filter(e => e.kind === "step" && e.parentEntryId === d.entryId);
        check(d.steps.length === steps.length && new Set(d.steps.map(s => s.entryId)).size === steps.length, "Full Step content required.");
        for (const s of d.steps) { record(s, ["entryId", "title", "body"]); check(steps.some(e => e.entryId === s.entryId) && typeof s.title === "string" && typeof s.body === "string", "Step content has foreign identity."); }
    }
}
async function constructTask(state, b, a, sourcePlan, d, planId, importedAt, operationId, fault) {
    const e = sourcePlan.entries.find(e => e.entryId === d.entryId), target = a.targets.find(t => t.entryId === d.entryId), stateTarget = b.proposal.capture.targets.find(t => t.entryId === d.entryId), metadata = stateTarget.metadata;
    const elements = sourcePlan.entries.filter(x => x.kind === "step" && x.parentEntryId === d.entryId), byEntry = new Map(sourcePlan.entries.map(e => [e.entryId, e]));
    const steps = [];
    for (const s of elements) { await fault?.("history:beforeStepConstruction"); const t = a.targets.find(t => t.entryId === s.entryId), draft = d.steps.find(d => d.entryId === s.entryId); steps.push({ id: s.nativeId, parentStepId: s.parentStepEntryId === null ? null : byEntry.get(s.parentStepEntryId).nativeId, order: s.order, title: draft.title, completed: t.completed, completedAt: t.completed ? t.binding.canonicalTimestamp : null, createdAt: null, modifiedAt: null }); }
    const { recurrence: ignored, ...taskMetadata } = metadata;
    const task = require("./commands").newTask({ schemaVersion: 1, id: e.nativeId, owner: clone(e.owner), title: d.title, description: d.description, completed: target.completed, completedAt: target.completed ? target.binding.canonicalTimestamp : null,
        ...clone(taskMetadata), steps, createdAt: null, modifiedAt: null, archivedAt: null, deletedAt: null, captureSource: null,
        migration: { source: "history-import-v1", sourceId: canonical([planId, e.entryId]), importedAt, evidence: { format: "itacan-imported-task-ref", version: 1, planId, captureDigest: b.proposal.capture.digest, entryId: e.entryId } } }, getPartition(state, e.owner).id, importedAt, () => { fail("VALIDATION", "Imported task identities must all be explicit."); });
    // recurrence is an evidence classification, never a task creation field.
    const before = clone(task), originals = b.proposal.capture.content.filter(x => [d.entryId, ...elements.map(s => s.entryId)].includes(x.entryId)).map(x => x.envelope);
    await fault?.("history:beforeContentAttachment");
    const current = content.setContentIntent(task, before, { version: 1, expectedRevision: 0, appendOriginals: originals, continuation: d.continuation }, elements.map(s => ({ id: s.nativeId, body: d.steps.find(d => d.entryId === s.entryId).body })));
    content.finishContentRevision(task, before, operationId, current); return task;
}
function resultOf(state) { const n = state.historyImport; return { version: 1, kind: n.outcome ? "published" : "prepared", planId: n.plan.id, planRevision: 1, planDigest: n.plan.digest, bundleDigest: n.plan.bundleDigest, captureDigest: n.capture.digest, plan: clone(n.plan), outcome: clone(n.outcome), accounting: { allocatedEvents: n.plan.groups.filter(g => g.eventId !== null).length, importedTasks: n.outcome?.taskIds.length ?? 0, importedSteps: n.outcome?.stepIds.length ?? 0, importedEvents: n.outcome?.eventIds.length ?? 0, quarantinedTrees: n.plan.treeDispositions.filter(t => t.disposition === "quarantined-tree").length } }; }
function validateNamespace(state) {
    const n = state.historyImport;
    if (!n || n.version !== 1 || n.format !== "itacan-private-history-import" || !same(n.requiredCapabilities ?? null, [CAPABILITY])) fail("UNSUPPORTED_SCHEMA", "Missing/unknown required private import namespace.");
    record(n, ["format", "version", "requiredCapabilities", "capture", "plan", "externalInventory", "outcome", "projection"]);
    record(n.capture, ["id", "lineage", "digest", "prepareOperationId"]);
    const b = bundleOf(state), p = n.plan, c = b.proposal.capture, a = b.proposal.analysis;
    check(b.version === 1 && b.format === "itacan-reviewed-history-import-bundle" && b.digest === digest(b) && b.proposal.version === 1 && b.proposal.digest === digest(b.proposal) && c.version === 1 && c.privacy === "local-private" && c.digest === digest(c), "Stored capture/proposal integrity mismatch.");
    check(p.digest === digest(p) && p.version === 1 && p.revision === 1 && p.bundleDigest === b.digest && same(p.pins, pinsFor(c, n.externalInventory)) && p.analysisDigest === hash(a) && same(p.treeDispositions, a.trees) && n.capture.id === c.id && n.capture.lineage === c.lineage && n.capture.digest === c.digest, "Prepared plan/evidence changed.");
    const preparation = state.receipts.find(r => r.operationId === n.capture.prepareOperationId), prepareCommand = JSON.parse(preparation.payload);
    check(prepareCommand.payload.planId === p.id && prepareCommand.payload.bundleDigest === b.digest && prepareCommand.payload.publicationOperationId === p.publicationOperationId && preparation.result.repositoryRevision === p.preparedRepositoryRevision && same(preparation.result.historyImport?.plan, p) && preparation.result.historyImport.kind === "prepared" && preparation.result.historyImport.outcome === null && preparation.result.tasks.length === 0 && preparation.result.change.eventIds.length === 0, "Preparation receipt/allocation was rewritten.");
    require("./recurrence").validateExternalReservations(n.externalInventory); validateOwners(state, b); validateDrafts(b, a, c.identity?.snapshot.plans.find(x => x.id === c.identity.planId), c);
    check(p.groups.length === a.groups.length && new Set(p.groups.map(g => g.key)).size === a.groups.length, "Missing/duplicate group disposition.");
    const allocated = new Set();
    for (const g of p.groups) {
        const original = a.groups.find(x => x.key === g.key); check(original && same(g.rowKeys, original.rowKeys) && same(g.ordinals, original.ordinals) && same(g.owner, original.owner) && g.kind === original.kind && g.timestamp === original.canonicalTimestamp && g.timeQuality === original.timeQuality, "Group mapping differs from reviewed analysis.");
        check(g.eventId === null || g.reasons.length === 0 && original.reasons.length === 0, "Quarantined group acquired a canonical winner.");
        if (g.eventId !== null) { uuid(g.eventId); check(!allocated.has(g.eventId), "Duplicate event allocation."); allocated.add(g.eventId); check(!c.history.some(row => row && typeof row === "object" && row.id === g.eventId), "Raw/native event ID collision."); }
    }
    const ids = new Set(), sourcePlan = c.identity?.snapshot.plans.find(x => x.id === c.identity.planId);
    check(p.reservations.length === a.targets.filter(t => t.nativeId).length + allocated.size, "Reservation coverage differs.");
    for (const r of p.reservations) {
        record(r, ["id", "kind", "entryId", "groupKey", "owner", "partitionId", "externalClaim", "purpose"]); uuid(r.id); check(!ids.has(r.id), "Duplicate native reservation."); ids.add(r.id);
        if (r.kind === "event") check(allocated.has(r.id) && p.groups.some(g => g.key === r.groupKey && g.eventId === r.id && g.partitionId === r.partitionId && same(g.owner, r.owner)) && !r.externalClaim && r.purpose === "historical-event", "Unbacked event reservation.");
        else {
            const t = a.targets.find(t => t.entryId === r.entryId), e = sourcePlan?.entries.find(e => e.entryId === r.entryId), external = c.identity?.snapshot.reservations.find(x => x.id === r.id && x.entryId === e?.entryId && x.planId === sourcePlan.id && x.kind === e.kind && same(x.owner, e.owner) && x.status === "published");
            check(t?.nativeId === r.id && t.kind === r.kind && same(t.owner, r.owner) && external && r.purpose === (t.disposition === "eligible-evidence-only" ? "eligible-target" : "quarantined-target") && r.externalClaim === n.externalInventory.ids.includes(r.id), "Unproven target reservation claim.");
        }
        const task = state.tasks.find(t => t.id === r.id || t.steps.some(s => s.id === r.id)), event = state.history.find(e => e.id === r.id), retired = state.retiredStepIds.includes(r.id);
        if (!n.outcome || r.purpose === "quarantined-target") check(!task && !event && !retired, "Held/quarantined reservation was consumed.");
        else if (r.kind === "event") check(event && n.outcome.eventIds.includes(r.id) && !task && !retired, "Published event identity disappeared or changed kind.");
        else check(!event && (r.kind === "task" ? task?.id === r.id : task || retired) && (r.kind === "task" ? n.outcome.taskIds : n.outcome.stepIds).includes(r.id), "Published target identity disappeared or changed kind.");
        check(!state.recurrence?.reservations.some(x => x.id === r.id), "Import and recurrence reservations collide.");
    }
    record(n.projection, ["version", "publications", "suppressions"]); unsupported(n.projection.version); check(Array.isArray(n.projection.publications) && Array.isArray(n.projection.suppressions), "Missing projection metadata.");
    if (n.outcome !== null) validateOutcome(state, b);
    const expectedEvents = state.history.filter(e => !n.outcome?.eventIds.includes(e.id)), publications = new Set();
    for (const pub of n.projection.publications) {
        record(pub, ["version", "eventId", "operationId", "repositoryRevision", "index", "ownerSnapshot", "availability"]); unsupported(pub.version);
        const e = expectedEvents.find(e => e.id === pub.eventId), receipt = state.receipts.find(r => r.operationId === pub.operationId);
        check(e && !publications.has(e.id) && e.operationId === pub.operationId && receipt?.result.repositoryRevision === pub.repositoryRevision && receipt.result.change.eventIds.includes(e.id) && pub.index === receipt.result.change.eventIds.indexOf(e.id), "Native publication lacks original event/receipt order."); publications.add(e.id);
        const owner = e.ownerAtEvent !== null && p.ownerSnapshots.find(o => same(o.owner, e.ownerAtEvent)); check(same(pub.ownerSnapshot, owner || null) && pub.availability === (e.legacy === null || independentLegacy(e.legacy, n.capture) ? "available" : "unavailable"), "Publication owner/provenance changed.");
        if (JSON.parse(receipt.payload).type === "history.record") check(same(JSON.parse(receipt.payload).payload.record, e), "Historical-only native event was rewritten.");
        check(!c.history.some(row => row && typeof row === "object" && row.id === e.id), "Native/source event collision.");
    }
    check(publications.size === expectedEvents.length, "Native event omitted from compatibility metadata.");
    const suppressed = new Set();
    for (const s of n.projection.suppressions) {
        record(s, ["version", "groupKey", "eventId", "operationId", "repositoryRevision"]); unsupported(s.version);
        const group = p.groups.find(g => g.key === s.groupKey), e = state.history.find(e => e.id === s.eventId), receipt = state.receipts.find(r => r.operationId === s.operationId), command = receipt && JSON.parse(receipt.payload);
        const ordinary = ["task.complete", "step.complete"].includes(command?.type) && command.payload.completed === false && command.taskId === e?.taskId && (e.stepId === null ? command.type === "task.complete" : command.type === "step.complete" && command.payload.stepId === e.stepId);
        const atomic = command?.type === "task.save" && require("./completion-effects").validateReceipt(state, receipt).effects.some(x => x.transition === "reopen" && x.eventId === e?.id && x.taskId === e.taskId && x.stepId === e.stepId);
        check(group?.eventId === e?.id && e.counted === false && e.reopenedAt !== null && !suppressed.has(s.groupKey) && (ordinary || atomic) && receipt.result.repositoryRevision === s.repositoryRevision && receipt.result.change.eventIds.includes(e.id), "Suppression lacks genuine reopening evidence."); suppressed.add(s.groupKey);
    }
    for (const original of n.outcome?.events ?? []) { const current = state.history.find(e => e.id === original.id); check(current.counted || suppressed.has(original.legacy.groupKey), "Imported event lost counting without suppression evidence."); }
    // Namespace/receipts are immutable relative to their original command result;
    // lifecycle state is validated separately from creation evidence.
    for (const r of state.receipts) if (isImport(JSON.parse(r.payload).type)) check(r.result.historyImport?.version === 1 && r.result.historyImport.planDigest === p.digest && same(r.result.historyImport.plan, p) && (r.result.historyImport.kind === "published" ? same(r.result.historyImport.outcome, n.outcome) : r.operationId === n.capture.prepareOperationId), "Import receipt no longer names its original outcome.");
    scopeOf(state); jsonValue(n);
}
function validateOutcome(state, b) {
    const n = state.historyImport, o = n.outcome, receipt = state.receipts.find(r => r.operationId === o.operationId), command = receipt && JSON.parse(receipt.payload), a = b.proposal.analysis;
    check(o.version === 1 && o.digest === digest(o) && o.planId === n.plan.id && o.planRevision === 1 && o.operationId === n.plan.publicationOperationId && o.receiptOperationId === o.operationId && receipt?.result.repositoryRevision === o.repositoryRevision && command.type === "history.importBundle" && command.payload.preparedPlanDigest === n.plan.digest && same(receipt.result.historyImport?.outcome, o), "Import outcome/receipt mismatch."); timestamp(o.importedAt); check(o.importedAt !== null, "Import clock must be known.");
    check(same(o.eventIds, n.plan.groups.filter(g => g.eventId !== null).map(g => g.eventId)) && same(o.taskIds.slice().sort(), a.trees.filter(t => t.disposition === "eligible-evidence-only").map(t => a.targets.find(x => x.entryId === t.taskEntryId).nativeId).sort()), "Outcome differs from prepared eligible subset.");
    const tasks = receipt.result.tasks; check(same(o.stepIds.slice().sort(), tasks.flatMap(t => t.steps.map(s => s.id)).sort()) && o.creationDigest === hash({ tasks: o.taskIds.map(id => tasks.find(t => t.id === id)), events: o.events, bindings: o.bindings }), "Creation evidence changed.");
    check(o.events.length === o.eventIds.length && o.bindings.length === a.bindings.length && new Set(o.bindings.map(x => x.eventId)).size === o.bindings.length, "Original binding/event coverage differs.");
    for (const original of o.events) {
        require("./domain").validateHistory(original); const g = n.plan.groups.find(g => g.eventId === original.id), raw = g && b.proposal.capture.history[g.ordinals[0]], current = state.history.find(e => e.id === original.id), binding = a.bindings.find(x => x.groupKey === g?.key), root = binding && a.targets.find(t => t.entryId === binding.taskEntryId), target = binding && a.targets.find(t => t.entryId === binding.entryId);
        check(g && current && original.operationId === o.operationId && original.timestamp === g.timestamp && original.recordedAt === null && original.counted && original.reopenedAt === null && original.kind === g.kind && same(original.ownerAtEvent, g.owner) && original.partitionId === g.partitionId && original.snapshot.title === raw.text && original.snapshot.parentTitle === (g.kind === "step" ? raw.parentText ?? null : null) && original.taskId === (root?.nativeId ?? null) && original.stepId === (target?.kind === "step" ? target.nativeId : null) && same(original.legacy, { format: "itacan-imported-history-ref", version: 1, captureDigest: n.capture.digest, groupKey: g.key }), "Imported event differs from frozen mapping.");
        check(same({ ...current, counted: original.counted, reopenedAt: original.reopenedAt }, original), "Immutable imported event fields changed.");
        if (binding) check(o.bindings.some(x => x.taskId === root.nativeId && x.stepId === original.stepId && x.eventId === original.id), "Proven original binding omitted.");
    }
    for (const created of tasks) {
        check(importedTask(created) && created.revision === 1 && created.createdAt === null && created.modifiedAt === null && created.archivedAt === null && created.deletedAt === null && created.captureSource === null && created.migration.importedAt === o.importedAt, "Imported task fabricated source clocks or provenance.");
        for (const step of created.steps) check(step.createdAt === null && step.modifiedAt === null, "Imported Step fabricated source clocks.");
        const current = state.tasks.find(t => t.id === created.id); check(current && importedTask(current) && current.migration.sourceId === created.migration.sourceId && current.migration.importedAt === o.importedAt, "Imported task provenance disappeared.");
    }
}
function rejectUnplannedReferences(state) {
    for (const t of state.tasks) if (importedTask(t)) check(state.historyImport?.outcome?.taskIds.includes(t.id), "Unplanned imported task provenance.");
    for (const e of state.history) if (e.legacy?.format === "itacan-imported-history-ref") check(state.historyImport?.outcome?.eventIds.includes(e.id), "Unplanned imported event provenance.");
}
module.exports = { HISTORY_IMPORT_COMMANDS, DECISION, CAPABILITY, isImport, hash, digest, stamp, pinsFor, validateCommand, bundleOf, reservedIds, claimedExternal, importedTask, dependentPartitions, scopeOf, validateScope, mergeScope, bindingWrite, assertWritable, reconcile, observe, applyImport, resultOf, validateNamespace, rejectUnplannedReferences };
