"use strict";
// These are detached compatibility INPUT specimens. No renderer, chart engine,
// binding importer, completion writer or persistence authority lives here.
const { check, fail } = require("../src/errors");
const { fields, clone, canonical, revision, jsonValue } = require("../src/value");
const { validateHistory } = require("../src/domain");
const { captureOf, analyzeHistoryCapture, historyRowKey } = require("./evidence");
const record = (v, keys) => fields(v, keys, keys);
function projected(evidence, visibility) {
    const capture = captureOf(evidence), analysis = analyzeHistoryCapture(capture);
    if (analysis.globalBlockers.includes("RAW_SOURCE_UNAVAILABLE")) fail("HISTORY_UNAVAILABLE", "Exact raw History is unavailable; no empty totals or parsed fallback.");
    const hidden = new Set();
    if (visibility !== undefined) {
        jsonValue(visibility);
        record(visibility, ["version", "captureDigest", "reopenedTargets"]);
        if (visibility.version !== 1) fail("UNSUPPORTED_SCHEMA", "Unsupported History visibility specimen.");
        check(visibility.captureDigest === capture.digest && Array.isArray(visibility.reopenedTargets) && new Set(visibility.reopenedTargets).size === visibility.reopenedTargets.length, "Visibility evidence is stale or duplicated.");
        for (const target of visibility.reopenedTargets) {
            const binding = analysis.bindings.find(b => b.entryId === target);
            check(binding, "Only a proven eligible current binding can be suppressed in a reopen specimen.");
            binding.rowKeys.forEach(key => hidden.add(key));
        }
    }
    const records = capture.history.filter((_, ordinal) => !hidden.has(historyRowKey(capture, ordinal))).map(clone);
    return { capture, analysis, hidden, records };
}
function projectRecordedHistory(evidence, visibility) {
    const p = projected(evidence, visibility);
    return { version: 1, kind: "recorded-history-input-specimen", privacy: "local-private", captureDigest: p.capture.digest, records: p.records, suppressedRowKeys: [...p.hidden] };
}
function projectStatisticsCompletions(evidence, canonicalEvents = [], visibility) {
    jsonValue(canonicalEvents);
    const p = projected(evidence, visibility), ids = new Set(), positions = new Set(), represented = [], genuine = [];
    check(Array.isArray(canonicalEvents), "Explicit canonical event specimens required.");
    for (const item of canonicalEvents) {
        record(item, ["version", "origin", "event", "publication", "groupKey"]);
        if (item.version !== 1) fail("UNSUPPORTED_SCHEMA", "Unsupported canonical History specimen.");
        validateHistory(item.event); const event = item.event;
        check(!ids.has(event.id), "Duplicate native event UUID in projection."); ids.add(event.id);
        record(item.publication, ["revision", "index"]); revision(item.publication.revision); revision(item.publication.index);
        check(item.publication.revision > 0, "Known committed publication revision required.");
        const position = canonical(item.publication); check(!positions.has(position), "Ambiguous event publication order."); positions.add(position);
        if (p.capture.history.some(row => row && typeof row === "object" && row.id === event.id)) fail("EVENT_ID_CONFLICT", "Native UUID collides with raw source event identity; no automatic rekey.");
        if (item.origin === "represented-import") {
            const group = p.analysis.groups.find(g => g.key === item.groupKey);
            check(group && group.disposition === "historical-event-evidence" && event.legacy?.format === "itacan-imported-history-ref" && event.legacy.version === 1 && event.legacy.captureDigest === p.capture.digest && event.legacy.groupKey === group.key && canonical(event.ownerAtEvent) === canonical(group.owner) && event.kind === group.kind && event.timestamp === group.canonicalTimestamp, "Imported event does not match its proven source group.");
            const binding = p.analysis.bindings.find(b => b.groupKey === group.key);
            if (binding) {
                const task = p.analysis.targets.find(t => t.entryId === binding.taskEntryId), target = p.analysis.targets.find(t => t.entryId === binding.entryId);
                check(event.taskId === task.nativeId && event.stepId === (target.kind === "step" ? target.nativeId : null), "Represented binding targets a foreign task/Step.");
            } else check(event.taskId === null && event.stepId === null, "Unbound historical evidence cannot invent a live target.");
            represented.push(event.id); // Raw rows already supply the one input representation.
        } else {
            check(item.origin === "native-completion" && item.groupKey === null && event.legacy === null && event.taskId !== null && (event.kind !== "step" || event.stepId !== null), "Only genuine native completion may add Statistics input.");
            check(event.ownerAtEvent && p.capture.registry.some(r => canonical(r.owner) === canonical(event.ownerAtEvent)), "Native event owner is not in the captured registry.");
            if (event.counted) genuine.push(item);
        }
    }
    genuine.sort((a, b) => b.publication.revision - a.publication.revision || b.publication.index - a.publication.index);
    const fresh = genuine.map(({ event: e }) => ({ id: e.id, kind: e.kind, text: e.snapshot.title, ...(e.kind === "step" ? { parentText: e.snapshot.parentTitle } : {}), timestamp: e.timestamp,
        projectId: e.ownerAtEvent.type === "resource" ? "resource:" + e.ownerAtEvent.id : e.ownerAtEvent.id, contextKind: e.ownerAtEvent.type, resourceType: e.ownerAtEvent.type === "resource" ? e.ownerAtEvent.id : null }));
    return { version: 1, kind: "statistics-completion-input-specimen", privacy: "local-private", captureDigest: p.capture.digest,
        records: [...fresh, ...p.records], representedNativeEventIds: represented, suppressedRowKeys: [...p.hidden] };
}
module.exports = { projectRecordedHistory, projectStatisticsCompletions };
