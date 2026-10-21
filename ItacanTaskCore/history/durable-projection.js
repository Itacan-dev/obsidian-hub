"use strict";
// Explicit private Node-only read adapter. It never opens or mutates a store.
const { check, fail } = require("../src/errors");
const { clone, fields } = require("../src/value");
const imports = require("../src/history-import");
function projectDurableHistoryCompatibility(state, options) {
    require("../src/domain").validateState(state);
    fields(options, ["version", "projection"], ["version", "projection"]);
    if (options.version !== 1) fail("UNSUPPORTED_SCHEMA", "Unsupported durable compatibility projection.");
    check(["recorded", "statistics"].includes(options.projection), "Unknown compatibility projection.");
    const n = state.historyImport;
    if (!n?.outcome) fail("HISTORY_NOT_IMPORTED", "Preparation creates no published compatibility activity.");
    const b = imports.bundleOf(state), capture = b.proposal.capture, analysis = b.proposal.analysis;
    const reopenedTargets = n.projection.suppressions.map(s => analysis.bindings.find(b => b.groupKey === s.groupKey)?.entryId);
    const visibility = { version: 1, captureDigest: capture.digest, reopenedTargets };
    const H = require("./index");
    const raw = options.projection === "recorded" ? H.projectRecordedHistory(b.proposal, visibility) : H.projectStatisticsCompletions(b.proposal, [], visibility);
    if (options.projection === "recorded") return { ...raw, repositoryRevision: state.revision };
    const publications = [...n.projection.publications].sort((a, b) => b.repositoryRevision - a.repositoryRevision || b.index - a.index);
    const native = [];
    for (const p of publications) {
        const e = state.history.find(e => e.id === p.eventId);
        if (!e.counted) continue;
        if (p.availability !== "available" || e.ownerAtEvent !== null && !p.ownerSnapshot) fail("HISTORY_UNAVAILABLE", "Native historical provenance/owner context is unavailable.");
        native.push({ id: e.id, kind: e.kind, text: e.snapshot.title, ...(e.kind === "step" ? { parentText: e.snapshot.parentTitle } : {}), timestamp: e.timestamp,
            projectId: e.ownerAtEvent === null ? null : e.ownerAtEvent.type === "resource" ? "resource:" + e.ownerAtEvent.id : e.ownerAtEvent.id,
            contextKind: e.ownerAtEvent?.type ?? "project", resourceType: e.ownerAtEvent?.type === "resource" ? e.ownerAtEvent.id : null,
            ...(p.ownerSnapshot ? { projectName: p.ownerSnapshot.label, projectStatus: p.ownerSnapshot.status } : {}) });
    }
    return { ...raw, records: [...native, ...raw.records], representedNativeEventIds: clone(n.outcome.eventIds), repositoryRevision: state.revision };
}
module.exports = { projectDurableHistoryCompatibility };
