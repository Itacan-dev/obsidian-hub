"use strict";
// Private portable read validation. No repository, identity, storage or host imports.
const clone = value => structuredClone(value);
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? "[" + value.map(canonical).join(",") + "]" : "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
const same = (a, b) => canonical(a) === canonical(b);
function check(value) { if (!value) { const error = Error("Invalid private Oath proof contract."); error.code = "OATH_PROOF_CONTRACT"; throw error; } }
const text = value => typeof value === "string" && value.length > 0;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const time = value => value === null || Number.isSafeInteger(value) && value >= 0;
const owner = value => value && ["project", "resource"].includes(value.type) && text(value.id);
const READINESS = ["ready", "not-ready", "unavailable", "recovering", "unsupported"];
const RESOLUTION = ["resolved-native", "resolved-legacy", "awaiting-index", "pending-native-publication", "missing", "deleted", "retired-step", "ambiguous", "quarantined", "owner-mismatch", "authority-mismatch", "unavailable"];
const ORIGINS = ["task-completion", "recurrence-completion", "initial-completed-creation", "step-completion", "historical-import", "history-record", "historical-only", "unverifiable"];
function fields(value, allowed) { check(value && typeof value === "object" && !Array.isArray(value)); check(Object.keys(value).every(k => allowed.includes(k))); }
function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function head(value) { check(value && uuid(value.authorityId) && integer(value.repositoryRevision) && uuid(value.revisionId)); }
function validateTargets(targets, authorityId, session, physicalOwner) {
 check(uuid(authorityId) && text(session?.deviceId) && text(session?.oathId) && owner(physicalOwner) && Array.isArray(targets) && targets.length > 0);
 const ids = new Set();
 for (const t of targets) {
  const a = t?.authority; check(t?.version === 1 && same(t.session, session) && same(t.owner, physicalOwner) && a?.kind === "native" && a.authorityId === authorityId && uuid(a.taskId) && text(a.partitionId) && !ids.has(a.taskId)); ids.add(a.taskId);
  check(integer(a.enrollment?.repositoryRevision) && uuid(a.enrollment.revisionId) && integer(a.enrollment.taskRevision) && a.enrollment.taskRevision > 0);
  if (t.original?.kind === "native-task") check(t.original.taskId === a.taskId && typeof t.original.text === "string" && a.aliasPin === null);
  else { const p = a.aliasPin; check(t.original?.kind === "legacy-task" && text(t.original.reference?.id) && typeof t.original.reference.path === "string" && typeof t.original.reference.text === "string" && p && p.legacyId === t.original.reference.id && text(p.storeId) && integer(p.ledgerRevision) && text(p.planId) && text(p.planDigest) && text(p.snapshotDigest)); }
 }
}
function validateOrder(order, scope) {
 check(order?.version === 1 && ["unproven", "closed-synthetic"].includes(order.kind));
 if (order.kind === "unproven") { check(text(order.reason)); return; }
 head(order.cut); check(order.cut.authorityId === scope.authorityId && same(order.session, scope.commitment.session) && same(order.targets, scope.commitment.targets));
 check(order.save?.acknowledgement === "observed" && /^[a-f0-9]{64}$/i.test(order.save.snapshotDigest) && Array.isArray(order.openTasks) && order.openTasks.length === order.targets.length);
 const ids = new Set(); for (const t of order.targets) { const rows = order.openTasks.filter(x => x.taskId === t.authority.taskId); check(rows.length === 1 && !ids.has(rows[0].taskId) && integer(rows[0].taskRevision) && rows[0].taskRevision >= t.authority.enrollment.taskRevision && order.cut.repositoryRevision >= t.authority.enrollment.repositoryRevision); ids.add(rows[0].taskId); }
}
function validateTree(steps, taskId) {
 check(Array.isArray(steps)); const ids = new Set();
 for (const s of steps) { check(uuid(s.id) && s.taskId === taskId && !ids.has(s.id) && (s.parentStepId === null || uuid(s.parentStepId)) && integer(s.order) && typeof s.completed === "boolean" && time(s.completedAt)); ids.add(s.id); }
 const byId = new Map(steps.map(s => [s.id, s]));
 const positions = new Set(); for (const s of steps) { check(s.parentStepId === null || byId.has(s.parentStepId)); const key = s.parentStepId + ":" + s.order; check(!positions.has(key)); positions.add(key); const chain = new Set([s.id]); let p = s.parentStepId; while (p !== null) { check(!chain.has(p)); chain.add(p); p = byId.get(p).parentStepId; } }
}
function taskView(value) {
 fields(value, ["kind", "handle", "id", "revision", "owner", "location", "title", "description", "completed", "completedAt", "importance", "start", "due", "phase", "steps", "archivedAt", "deletedAt", "presentation"]);
 check(value.kind === "native-task-read" && uuid(value.id) && value.handle?.kind === "native" && value.handle.id === value.id && integer(value.revision) && value.revision > 0 && owner(value.owner) && typeof value.title === "string" && typeof value.description === "string" && typeof value.completed === "boolean" && time(value.completedAt) && time(value.archivedAt) && time(value.deletedAt));
 fields(value.handle, ["kind", "id"]); fields(value.owner, ["type", "id"]);
 for (const s of value.steps ?? []) { fields(s, ["kind", "id", "taskId", "parentStepId", "order", "title", "completed", "completedAt"]); check(s.kind === "native-step-read" && typeof s.title === "string"); }
 validateTree(value.steps, value.id);
 // Nested presentation/location values are allowlisted, never arbitrary provider objects.
 check(value.presentation?.state === "unresolved" && text(value.presentation.reason)); fields(value.presentation, ["state", "reason"]);
 for (const endpoint of [value.start, value.due]) if (endpoint !== null) { fields(endpoint, ["date", "time"]); check(typeof endpoint.date === "string" && (endpoint.time === null || typeof endpoint.time === "string")); }
 if (value.location !== null) { fields(value.location, ["type", "id"]); check(["note", "folder"].includes(value.location.type) && text(value.location.id)); }
 if (value.phase !== null) { fields(value.phase, ["projectId", "phaseId"]); check(text(value.phase.projectId) && text(value.phase.phaseId)); }
 check(["must", "should", null].includes(value.importance)); return clone(value);
}
function taskState(task, partitionId) { return { id: task.id, revision: task.revision, owner: clone(task.owner), partitionId, completed: task.completed, completedAt: task.completedAt, archivedAt: task.archivedAt, deletedAt: task.deletedAt, steps: task.steps.map(s => ({ id: s.id, taskId: s.taskId, parentStepId: s.parentStepId, order: s.order, completed: s.completed, completedAt: s.completedAt })) }; }
function validateRead(proof, request) {
 check([1,2].includes(request.version) && proof?.version === request.version && proof.privacy === "local-private" && proof.requestGeneration === request.requestGeneration && proof.ownerContextPin === request.ownerContextPin && integer(proof.providerEpoch) && READINESS.includes(proof.readiness?.state) && text(proof.readiness.reason) && ["current-snapshot", "stale", "unknown"].includes(proof.freshness) && ["intact", "affected", "unknown"].includes(proof.recovery));
 check(Array.isArray(proof.rows) && proof.rows.length === request.targets.length && Array.isArray(proof.partitions));
 if (proof.head !== null) { head(proof.head); check(proof.head.authorityId === request.authorityId); }
 if (proof.cutEvidence !== null) { head(proof.cutEvidence.cut); check(["verified-current-lineage", "unproven"].includes(proof.cutEvidence.state) && same(proof.cutEvidence.cut, request.enrollmentCut)); }
 const indexes = new Set();
 for (const r of proof.rows) {
  check(integer(r.targetIndex) && r.targetIndex < request.targets.length && !indexes.has(r.targetIndex) && RESOLUTION.includes(r.resolution?.state) && /^[A-Z][A-Z0-9_]{0,95}$/.test(r.resolution.reason)); indexes.add(r.targetIndex);
  if (r.task !== null) { const t = request.targets[r.targetIndex]; check(r.task.id === t.authority.taskId && integer(r.task.revision) && r.task.revision > 0 && owner(r.task.owner) && text(r.task.partitionId) && typeof r.task.completed === "boolean" && time(r.task.completedAt) && time(r.task.archivedAt) && time(r.task.deletedAt)); validateTree(r.task.steps, r.task.id); }
  if (r.binding !== null) check(uuid(r.binding.taskId) && (r.binding.stepId === null || uuid(r.binding.stepId)) && uuid(r.binding.eventId));
  if (r.event !== null) { const e = r.event; check(uuid(e.eventId) && text(e.operationId) && [...ORIGINS,...(proof.version===2?["task-save-completion","initial-completed-step"]:[])].includes(e.origin) && ["task", "step"].includes(e.kind) && typeof e.counted === "boolean" && time(e.timestamp) && time(e.reopenedAt)); }
  if (r.creation !== null) { const c = r.creation; check(text(c.operationId) && text(c.commandType) && integer(c.repositoryRevision) && uuid(c.revisionId) && /^[a-f0-9]{64}$/i.test(c.receiptDigest) && uuid(c.createdEventId) && c.taskAfter && time(c.taskAfter.completedAt)); if(proof.version===2){check(c.atomicEffect!==undefined);if(c.atomicEffect!==null){const x=c.atomicEffect;fields(x,["version","effectsDigest","index","taskId","stepId","eventId","transition","origin"]);check(x.version===1&&/^[a-f0-9]{64}$/.test(x.effectsDigest)&&integer(x.index)&&uuid(x.taskId)&&(x.stepId===null||uuid(x.stepId))&&x.eventId===c.createdEventId&&["complete","initial"].includes(x.transition)&&["genuine-parent-completion","genuine-step-completion","initial-parent-completion","initial-step-completion"].includes(x.origin));}} }
 }
 return proof;
}
function navigation(value, target) {
 if (value === null) return null;
 if (value.kind === "native-task") { fields(value, ["kind", "id"]); check(value.id === target.authority.taskId); }
 else if (value.kind === "native-location") { fields(value, ["kind", "owner", "location"]); check(same(value.owner, target.owner)); fields(value.location, ["type", "id"]); check(["note", "folder"].includes(value.location.type) && text(value.location.id)); }
 else { check(value.kind === "historical-provenance"); fields(value, ["kind", "source"]); fields(value.source, ["kind", "path", "line"]); check(value.source.kind === "recorded-legacy-note" && text(value.source.path) && (value.source.line === undefined || integer(value.source.line))); }
 return clone(value);
}
function assessQualifiedCompletion(target, row, proof, order, orderIntact = true) {
 const result = (state, reason) => ({ version: 1, state, reason, displayCompleted: row.task?.completed ?? null });
 if (proof.readiness.state !== "ready" || proof.freshness !== "current-snapshot" || proof.recovery !== "intact" || row.resolution.state !== "resolved-native") return result("unknown", "AUTHORITATIVE_EVIDENCE_UNAVAILABLE");
 const task = row.task, a = target.authority;
 if (!task || task.id !== a.taskId || task.partitionId !== a.partitionId || !same(task.owner, target.owner) || task.deletedAt !== null) return result("unknown", "TARGET_SCOPE_MISMATCH");
 if (!task.completed) return result("ineligible", "TARGET_OPEN");
 const b = row.binding, e = row.event, c = row.creation;
 if (!b || !e) return result("unknown", "CURRENT_BINDING_UNAVAILABLE");
 if (["historical-import", "history-record", "historical-only", "initial-completed-creation", "step-completion", ...(proof.version===2?["initial-completed-step"]:[])].includes(e.origin)) return result("ineligible", "NOT_GENUINE_PARENT_WORK");
 const save = proof.version===2 && e.origin==="task-save-completion";
 if (!c || !["task-completion", "recurrence-completion", ...(proof.version===2?["task-save-completion"]:[])].includes(e.origin)) return result("unknown", "CREATION_RECEIPT_UNAVAILABLE");
 if(save){const x=c.atomicEffect;if(!x||x.version!==1||x.transition!=="complete"||x.origin!=="genuine-parent-completion"||x.taskId!==task.id||x.stepId!==null||x.eventId!==e.eventId||!integer(x.index)||!/^[a-f0-9]{64}$/.test(x.effectsDigest)||c.requestedCompletion!==true)return result("unknown","COMPLETION_EFFECT_MISMATCH");}
 const command = save ? "task.save" : e.origin === "task-completion" ? "task.complete" : "recurrence.complete";
 if (b.taskId !== task.id || b.stepId !== null || b.eventId !== e.eventId || e.taskId !== task.id || e.stepId !== null || e.kind !== "task" || e.partitionId !== a.partitionId || !same(e.ownerAtEvent, target.owner) || !e.counted || e.reopenedAt !== null || e.timestamp !== task.completedAt || c.operationId !== e.operationId || c.commandType !== command || c.commandTaskId !== task.id || command === "task.complete" && c.requestedCompletion !== true || c.createdEventId !== e.eventId || c.taskAfter.id !== task.id || c.taskAfter.partitionId !== a.partitionId || !same(c.taskAfter.owner, target.owner) || !c.taskAfter.completed || c.taskAfter.completedAt !== e.timestamp || !proof.head || c.repositoryRevision > proof.head.repositoryRevision || c.repositoryRevision === proof.head.repositoryRevision && c.revisionId !== proof.head.revisionId) return result("unknown", "COMPLETION_RECEIPT_MISMATCH");
 if (!orderIntact || order.kind !== "closed-synthetic") return result("unknown", "ENROLLMENT_ORDER_UNPROVEN");
 if (!proof.cutEvidence || proof.cutEvidence.state !== "verified-current-lineage" || !same(proof.cutEvidence.cut, order.cut) || !text(proof.cutEvidence.receiptOperationId)) return result("unknown", "ENROLLMENT_CUT_UNAVAILABLE");
 if (c.repositoryRevision <= order.cut.repositoryRevision) return result("ineligible", "COMPLETION_NOT_AFTER_CUT");
 return result("eligible", "CLOSED_SYNTHETIC_POST_ENROLLMENT_COMPLETION");
}
module.exports = { clone, same, check, freeze, validateTargets, validateOrder, validateRead, taskView, taskState, navigation, assessQualifiedCompletion };
