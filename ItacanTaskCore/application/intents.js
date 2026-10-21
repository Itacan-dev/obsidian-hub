"use strict";
// Pure application vocabulary. No repository, host, persistence or allocation.
const V = require("../src/value"), D = require("../src/domain");
const { sha256 } = require("../src/source-content");
const { freeze } = require("../src/snapshot-read");
const { request: writerRequest } = require("../writer/policy");
const same = (a, b) => V.canonical(a) === V.canonical(b);
const hash = value => sha256(V.canonical(value));
function contract() { const e = Error("Invalid application mutation contract."); e.code = "APPLICATION_CONTRACT"; throw e; }
function check(value) { if (!value) contract(); }
function fields(value, names, required = names) { try { V.fields(value, names, required); } catch (_) { contract(); } }
function target(t, step = false) {
    fields(t, ["taskId", "expectedTaskRevision", "stepId"], ["taskId", "expectedTaskRevision"]);
    V.uuid(t.taskId); V.revision(t.expectedTaskRevision); check(t.expectedTaskRevision > 0);
    if (step) V.uuid(t.stepId); else check(t.stepId === undefined);
    return { taskId: t.taskId, expectedRevision: t.expectedTaskRevision };
}
const recurrence = Object.freeze({
    "define-series": "recurrence.defineSeries", "revise-rule": "recurrence.reviseRule",
    "define-template": "recurrence.defineTemplate", "revise-template": "recurrence.reviseTemplate",
    "prepare-generation": "recurrence.prepareGeneration", "complete-occurrence": "recurrence.complete"
});
const coordination = Object.freeze(["inbox-send", "quick-add-task", "phase-live", "phase-save-assignments", "oath-completion", "source-migration", "shared-sync"]);
const deferred = Object.freeze(["clear-completed", "source-edit", "source-position", "delete-promote-children", "cross-owner-move", "planning-edit", "save-inbox-draft"]);
function validate(input) {
    try {
        V.jsonValue(input); fields(input, ["version", "operationId", "reason", "authority", "owner", "guard", "action"], ["version", "operationId", "reason", "authority", "owner", "action"]);
        check([1,2].includes(input.version)); V.text(input.operationId); V.text(input.reason); D.workspace(input.owner);
        const a = input.authority;
        if (a.backend === "legacy-markdown") { fields(a, ["backend", "applicationContextId"]); check(input.version === 1 && input.guard === undefined); }
        else { fields(a, ["backend", "authorityId", "applicationContextId"]); check(a.backend === "native"); V.uuid(a.authorityId);
            const g = input.guard; fields(g, ["expectedRepositoryRevision", "ownerContextPin", "identityPin", "inventoryPin", "phasePin", "partitions"]);
            V.revision(g.expectedRepositoryRevision); for (const k of ["ownerContextPin", "inventoryPin", "phasePin"]) V.text(g[k]); if (g.identityPin !== null) V.text(g.identityPin);
            check(Array.isArray(g.partitions) && g.partitions.length > 0); const seen = new Set();
            for (const p of g.partitions) { fields(p, ["id", "owner", "expectedRevision"]); V.referenceId(p.id); D.workspace(p.owner); V.revision(p.expectedRevision); check(same(p.owner, input.owner) && !seen.has(p.id)); seen.add(p.id); }
        }
        V.text(a.applicationContextId); check(input.action && typeof input.action.kind === "string");
        // Detach before any asynchronous admission/read boundary.
        return freeze(V.clone(input));
    } catch (_) { contract(); }
}
function compile(input) {
    const r = validate(input), a = r.action;
    if (r.authority.backend === "legacy-markdown") return { intent: r, state: "legacy-only", code: "LEGACY_AUTHORITY_SELECTED" };
    if (r.version === 2) {
        check(["full-save", "rich-create"].includes(a.kind) && r.guard.partitions.length === 1);
        fields(a, a.kind === "full-save" ? ["kind","target","guards","draft"] : ["kind","draft"]);
        if (a.kind === "full-save") fields(a.guards,["expectedContentRevision","expectedTreeDigest","expectedBindings","recurrence"]);
        const g=r.guard.partitions[0], scope={authorityId:r.authority.authorityId,owner:V.clone(r.owner),partitionId:g.id,expectedPartitionRevision:g.expectedRevision,inventoryPin:r.guard.inventoryPin};
        const c={type:a.kind==="full-save"?"task.save":"task.createRich",operationId:r.operationId,expectedRepositoryRevision:r.guard.expectedRepositoryRevision,...(a.kind==="full-save"?target(a.target):{}),payload:{version:1,scope,...(a.kind==="full-save"?V.clone(a.guards):{}),draft:V.clone(a.draft)}};
        const {expectedRepositoryRevision:ignored,...guards}=r.guard;
        const request=writerRequest({version:1,reason:V.canonical({service:"itacan-application-mutation",version:2,intentDigest:hash(r),reason:r.reason}),scope:{authorityId:r.authority.authorityId,...guards},command:c},"task");
        return freeze({intent:r,state:"conditional-supplied-draft",code:"EXPLICIT_DRAFT_REQUIRED",family:"task",request});
    }
    if (coordination.includes(a.kind)) { fields(a, ["kind", "details"], ["kind", "details"]); return { intent: r, state: "requires-coordination", code: "CROSS_AUTHORITY_REQUIRED" }; }
    if (deferred.includes(a.kind)) { fields(a, ["kind", "details"], ["kind", "details"]); return { intent: r, state: "unsupported-input", code: "ACTION_DEFERRED" }; }
    if (["full-save", "rich-create", "compound"].includes(a.kind)) {
        fields(a, a.kind === "full-save" ? ["kind", "target", "draft"] : a.kind === "compound" ? ["kind", "actions"] : ["kind", "draft"]);
        if (a.kind === "full-save") target(a.target);
        if (a.kind === "compound") check(Array.isArray(a.actions));
        return { intent: r, state: "requires-atomic-extension", code: "ATOMIC_EXTENSION_REQUIRED" };
    }
    let c, supplied = false;
    const existing = type => ({ type, ...target(a.target) });
    if (a.kind === "create") {
        fields(a, ["kind", "draft"]); const d = a.draft;
        fields(d, ["id", "title", "description", "necessity", "start", "due", "location", "phase", "steps", "completed", "completedAt"], ["title", "description", "necessity", "start", "due", "location", "phase", "steps", "completed"]);
        check(Array.isArray(d.steps));
        for (const s of d.steps) fields(s, ["id", "parentStepId", "order", "title", "completed", "completedAt"], ["parentStepId", "order", "title", "completed"]);
        const { necessity, ...task } = V.clone(d); c = { type: "task.create", payload: { task: { ...task, owner: r.owner, importance: necessity } } };
    } else if (["edit-metadata", "edit-title", "set-necessity", "set-dates"].includes(a.kind)) {
        const keys = a.kind === "edit-metadata" ? ["kind", "target", "patch"] : a.kind === "edit-title" ? ["kind", "target", "title"] : a.kind === "set-necessity" ? ["kind", "target", "necessity"] : ["kind", "target", "start", "due"];
        fields(a, keys); let patch;
        if (a.kind === "edit-metadata") { fields(a.patch, ["title", "description", "necessity", "start", "due"], []); check(Object.keys(a.patch).length > 0); patch = V.clone(a.patch); }
        else patch = Object.fromEntries(keys.filter(k => !["kind", "target"].includes(k)).map(k => [k, V.clone(a[k])]));
        if (Object.hasOwn(patch, "necessity")) { patch.importance = patch.necessity; delete patch.necessity; }
        c = { ...existing("task.update"), payload: { patch } };
    } else if (a.kind === "set-completion") {
        fields(a, ["kind", "target", "completed", "completedAt"], ["kind", "target", "completed"]);
        c = { ...existing("task.complete"), payload: { completed: a.completed, ...(Object.hasOwn(a, "completedAt") ? { completedAt: a.completedAt } : {}) } };
    } else if (a.kind === "edit-structure") {
        fields(a, ["kind", "target", "draft"]); check(a.draft.content?.appendOriginals?.length === 0 && Array.isArray(a.draft.content.appendOriginals));
        c = { ...existing("task.editStructure"), payload: V.clone(a.draft) }; supplied = true;
    } else if (a.kind === "add-step") {
        fields(a, ["kind", "target", "step"]); fields(a.step, ["id", "parentStepId", "order", "title", "completed", "completedAt"], ["parentStepId", "order", "title", "completed"]);
        c = { ...existing("step.add"), payload: { step: V.clone(a.step) } };
    } else if (["edit-step", "reparent-step", "delete-step", "set-step-completion"].includes(a.kind)) {
        const t = target(a.target, true), sid = a.target.stepId;
        const keys = { "edit-step": ["title"], "reparent-step": ["parentStepId", "order"], "delete-step": ["cascade"], "set-step-completion": ["completed", "completedAt"] }[a.kind];
        fields(a, ["kind", "target", ...keys], ["kind", "target", ...keys.filter(k => k !== "completedAt")]);
        const type = a.kind === "delete-step" ? "step.delete" : a.kind === "set-step-completion" ? "step.complete" : "step.update";
        const values = Object.fromEntries(keys.filter(k => Object.hasOwn(a, k)).map(k => [k, V.clone(a[k])]));
        c = { type, ...t, payload: { stepId: sid, ...(type === "step.update" ? { patch: values } : values) } };
    } else if (a.kind === "reorder-steps") {
        fields(a, ["kind", "target", "parentStepId", "stepIds"]); c = { ...existing("step.reorder"), payload: { parentStepId: a.parentStepId, stepIds: V.clone(a.stepIds) } };
    } else if (["relocate", "set-phase"].includes(a.kind)) {
        fields(a, ["kind", "target", "location", "phase"]); c = { ...existing("task.relocate"), payload: { owner: V.clone(r.owner), location: V.clone(a.location), phase: V.clone(a.phase) } };
    } else if (a.kind === "archive") {
        fields(a, ["kind", "target", "archived"]); c = { ...existing("task.archive"), payload: { archived: a.archived } };
    } else if (a.kind === "delete-tree") {
        fields(a, ["kind", "target"]); c = { ...existing("task.delete"), payload: {} };
    } else if (a.kind === "recurrence") {
        fields(a, ["kind", "target", "change", "values"]); check(Object.hasOwn(recurrence, a.change)); c = { ...existing(recurrence[a.change]), payload: V.clone(a.values) }; supplied = true;
    } else contract();
    c.operationId = r.operationId; c.expectedRepositoryRevision = r.guard.expectedRepositoryRevision;
    const { expectedRepositoryRevision: ignored, ...guards } = r.guard;
    const request = writerRequest({ version: 1, reason: V.canonical({ service: "itacan-application-mutation", version: 1, intentDigest: hash(r), reason: r.reason }), scope: { authorityId: r.authority.authorityId, ...guards }, command: c }, c.type.startsWith("step.") ? "step" : c.type.startsWith("recurrence.") ? "recurrence" : "task");
    return freeze({ intent: r, state: supplied ? "conditional-supplied-draft" : "supported-native", code: supplied ? "EXPLICIT_DRAFT_REQUIRED" : "ONE_NATIVE_COMMAND", family: c.type.startsWith("step.") ? "step" : c.type.startsWith("recurrence.") ? "recurrence" : "task", request });
}
module.exports = Object.freeze({ validate, compile, hash, same, check, contract, coordination, deferred });
