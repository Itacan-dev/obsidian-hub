"use strict";
// Test-only. Calls actual production helpers and actual N1-B memory planning.
// No plugin startup, real data, Dataview scan or source write is constructed.
const path = require("node:path"), fs = require("node:fs"), crypto = require("node:crypto");
const pluginRoot = path.resolve(__dirname, "../../../.obsidian/plugins/hub-project-menu/lib");
const { queryHistory } = require(path.join(pluginRoot, "domain/history"));
const { recordedHistoryQuery } = require(path.join(pluginRoot, "services/task-history-legacy-read"));
const { statisticsCompletions } = require(path.join(pluginRoot, "services/statistics"));
const statistics = require(path.join(pluginRoot, "domain/statistics"));
const { historyRecords } = require(path.join(pluginRoot, "services/task-history-read"));
const { taskProgressMutation } = require(path.join(pluginRoot, "domain/task-progress"));
const H = require("../index"), { canonical, clone } = require("../../src/value"), source = require("../../src/source-content");
const support = require("../../identity/tests/support.cjs");
const NOW = Date.parse("2026-10-17T10:00:00+02:00");
const seal = capture => ({ ...capture, digest: H.evidenceDigest(capture) });
function rawCapture(history = [], checks = [], patch = {}) {
    return seal({ format: "itacan-history-capture", version: 1, parserVersion: 1, decisionRevision: H.HISTORY_DECISION, privacy: "local-private", scope: "global-synthetic",
        id: "capture-1", lineage: "synthetic-history", revision: "capture-r1", registryRevision: "registry-r1", registry: support.registry.map(({ key, ...r }) => r), sourceRevision: "capture-r1", historyRevision: "history-r1", checksRevision: "checks-r1",
        rawSource: null, history: clone(history), checks: clone(checks), identity: null, content: [], targets: [], digest: null, ...patch });
}
function byteSource(history, checks, text = JSON.stringify({ history, checks })) {
    const bytes = Buffer.from(text); return { encoding: "utf-8", hex: bytes.toString("hex"), sha256: crypto.createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.length };
}
function review(c, patch = {}) {
    return { version: 1, decisionRevision: H.HISTORY_DECISION, captureDigest: c.digest, reviewer: "synthetic-reviewer", syntheticOnly: true, policyIds: [...H.HISTORY_POLICIES],
        expectedIdentityRevision: c.identity?.revision ?? null, expectedPlanDigest: c.identity?.planDigest ?? null, expectedRegistryRevision: c.registryRevision, expectedSourceRevision: c.sourceRevision, expectedHistoryRevision: c.historyRevision, expectedChecksRevision: c.checksRevision, priorCaptures: [], ...patch };
}
async function mappingCapture(items = [{ entryId: "parent", legacyId: "old-parent", completed: true }], options = {}) {
    const depth = item => item.kind !== "step" ? 0 : item.stepParent ? 1 + depth(items.find(x => x.entryId === item.stepParent)) : 1;
    const snap = support.snapshot(items.map(item => ({ ...item, raw: item.raw ?? ("    ".repeat(depth(item)) + "- [" + (item.completed ? "x" : " ") + "] Same title" + (item.legacyId == null ? "" : " <!-- hub-task:" + item.legacyId + " -->")) })));
    const f = await support.fixture("memory");
    try {
        const result = options.published === false ? await support.prepared(f.repo, snap) : await support.published(f.repo, snap);
        const plan = result.plan, state = f.repo.snapshot(), targets = [], content = [], history = [], checks = [];
        for (const e of plan.entries) {
            const item = items.find(x => x.entryId === e.entryId), file = snap.files.find(x => x.id === e.evidence.fileId), root = plan.entries.find(x => x.entryId === (e.kind === "task" ? e.entryId : e.parentEntryId));
            const metadata = e.kind === "step" ? null : { start: null, due: null, importance: null, location: { type: "folder", id: e.folder.locationId }, phase: null, recurrence: null, ...item.metadata };
            targets.push({ entryId: e.entryId, completed: !!item.completed, completedAt: Object.hasOwn(item, "completedAt") ? item.completedAt : item.completed ? NOW - 1000 : null, metadata });
            if (e.nativeId && root?.nativeId) content.push({ entryId: e.entryId, envelope: source.captureSourceEnvelope(new TextEncoder().encode(file.content), { id: "source-envelope-" + e.entryId, version: 1, parserVersion: 1, source: { documentId: file.id, path: file.path, root: state.registry.find(r => canonical(r.owner) === canonical(e.owner)).root, revision: file.revision, owner: e.owner }, target: { taskId: root.nativeId, stepId: e.kind === "step" ? e.nativeId : null, taskRevision: 1 }, line: e.evidence.line, expectedRange: null, metadata, explicitDescription: "" }) });
            if (item.completed && !item.noEvent) {
                const eventId = item.eventId ?? "legacy-event-" + e.entryId, time = Object.hasOwn(item, "completedAt") ? item.completedAt : NOW - 1000;
                history.push({ id: eventId, kind: e.kind, hubTaskId: e.evidence.legacyId, ...(e.kind === "step" ? { parentTaskId: root.evidence.legacyId, parentText: "Same title" } : {}), text: "Same title", path: file.path, line: e.evidence.line, timestamp: time, projectId: e.owner.type === "resource" ? "resource:" + e.owner.id : e.owner.id, contextKind: e.owner.type, resourceType: e.owner.type === "resource" ? e.owner.id : null });
                checks.push({ historyId: eventId, kind: e.kind, hubTaskId: e.evidence.legacyId, ...(e.kind === "step" ? { parentTaskId: root.evidence.legacyId } : {}), path: file.path, line: e.evidence.line, text: "Same title", timestamp: time });
            }
        }
        return rawCapture(history, checks, { identity: { version: 1, storeId: state.storeId, revision: state.revision, planId: plan.id, planDigest: plan.digest, snapshot: state }, targets, content });
    } finally { await f.close(); }
}
function legacy(records, inputs = {}, now = NOW) {
    const query = recordedHistoryQuery(queryHistory(records)), completions = statisticsCompletions(query);
    const prepared = statistics.prepareStatistics({ ...inputs, completions }, now);
    return { query, completions, display: historyRecords(query), prepared,
        models: statistics.RANGES.flatMap(([range]) => ["all", ...prepared.registry.keys()].map(workspace => ({ range, workspace, model: statistics.aggregateStatistics(prepared, range, workspace) }))) };
}
function normalize(value) { return JSON.parse(JSON.stringify(value, (_key, item) => item instanceof Map || item instanceof Set ? [...item] : item)); }
function observe(records, inputs = {}, now = NOW) {
    try {
        const result = legacy(records, inputs, now);
        return { status: "observed", completions: normalize(result.completions), display: normalize(result.display), prepared: normalize(result.prepared), models: normalize(result.models) };
    } catch (error) { return { status: "rejected", code: error.code ?? "ERROR", message: error.message }; }
}
function sourcePins() {
    const files = ["domain/history.js", "domain/task-progress.js", "domain/statistics.js", "services/task-history-legacy-read.js", "services/task-history-read.js", "services/statistics.js", "ui/statistics.js"].map(file => ".obsidian/plugins/hub-project-menu/lib/" + file);
    files.push(".obsidian/plugins/hub-project-menu/plugin.js", "ItacanTaskCore/src/commands.js", "ItacanTaskCore/src/completion-transition.js", "ItacanTaskCore/src/domain.js", "ItacanTaskCore/src/repository.js", "ItacanTaskCore/src/json-repository.js", "ItacanTaskCore/identity/domain.js", "ItacanTaskCore/src/source-content.js");
    const root = path.resolve(__dirname, "../../..");
    return files.map(file => ({ path: file, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex") }));
}
function nativeSpec(c, options = {}) {
    const { nativeTaskId = support.id(7001), eventId = support.id(7002), completedAt = NOW, owner = support.owner("private"), origin = "native-completion", groupKey = null, publication = { revision: 5, index: 0 } } = options;
    const group = H.analyzeHistoryCapture(c).groups.find(g => g.key === groupKey), binding = H.analyzeHistoryCapture(c).bindings.find(b => b.groupKey === groupKey), target = binding && H.analyzeHistoryCapture(c).targets.find(t => t.entryId === binding.entryId), root = binding && H.analyzeHistoryCapture(c).targets.find(t => t.entryId === binding.taskEntryId);
    const event = { id: eventId, operationId: "synthetic-completion", partitionId: "private", kind: group?.kind ?? "task", taskId: origin === "represented-import" ? root?.nativeId ?? null : nativeTaskId, stepId: target?.kind === "step" ? target.nativeId : null,
        timestamp: origin === "represented-import" ? group.canonicalTimestamp : completedAt, recordedAt: origin === "represented-import" ? null : NOW, ownerAtEvent: group?.owner ?? owner, workingContext: null, oathId: null, sessionId: null,
        snapshot: { title: "Synthetic native event", parentTitle: group?.kind === "step" ? "Parent" : null }, counted: true, reopenedAt: null,
        legacy: origin === "represented-import" ? { format: "itacan-imported-history-ref", version: 1, captureDigest: c.digest, groupKey } : null, ...options.event };
    return { version: 1, origin, event, publication, groupKey };
}
function summary(records, inputs = {}, now = NOW) {
    const observed = observe(records, inputs, now);
    if (observed.status !== "observed") return observed;
    const digest = v => crypto.createHash("sha256").update(canonical(v)).digest("hex");
    return { status: "observed", completionRows: observed.prepared.completions.length, displayRows: observed.display.length, cohorts: observed.prepared.registry.map(([key, r]) => ({ key, name: r.name, deleted: r.deleted })),
        ranges: observed.models.filter(m => m.workspace === "all").map(({ range, model }) => ({ range, start: model.range.start, end: model.range.end, days: model.range.days, binDays: model.range.binDays, bins: model.range.bins.length, tasks: model.rows.reduce((n, r) => n + r.tasks.reduce((a, b) => a + b, 0), 0), steps: model.rows.reduce((n, r) => n + r.steps.reduce((a, b) => a + b, 0), 0) })),
        preparedDigest: digest(observed.prepared), fullAggregateDigest: digest(observed.models), displayDigest: digest(observed.display) };
}
function vectorInputs() {
    const base = { text: "Historical", path: "Projects/Private/Missing.md", projectId: "private", contextKind: "project", timestamp: NOW - 1000 };
    const vectors = [], add = (id, records, patch = {}) => vectors.push({ id, records, inputs: {}, now: NOW, ...patch });
    for (const [name, value] of [["missing", undefined], ["null", null], ["empty", ""], ["zero", 0], ["false", false], ["string-zero", "0"], ["number-seven", 7], ["string-seven", "7"], ["true", true]]) {
        const row = { ...base, ...(value === undefined ? {} : { id: value }) }; add("raw-id-" + name, [row, { ...row }]);
    }
    add("mixed-id-types", [7, "7", 0, "0", false, "false", null].map(id => ({ ...base, id })));
    add("duplicate-invalid-first", [{ ...base, id: "dup", timestamp: null }, { ...base, id: "dup" }]);
    add("duplicate-valid-first", [{ ...base, id: "dup" }, { ...base, id: "dup", timestamp: null }]);
    add("duplicate-future-first", [{ ...base, id: "dup", timestamp: NOW + 1 }, { ...base, id: "dup" }]);
    add("duplicate-other-owner-first", [{ ...base, id: "dup", projectId: "hub" }, { ...base, id: "dup" }]);
    add("duplicate-step-first", [{ ...base, id: "dup", kind: "step" }, { ...base, id: "dup", kind: "task" }]);
    for (const [name, time] of [["missing", undefined], ["null", null], ["zero", 0], ["negative", -1], ["fractional", NOW - 0.5], ["string", String(NOW)], ["date-string", "2026-10-17"], ["invalid-string", "Invalid date"], ["future", NOW + 1], ["date-limit", 8640000000000001]]) add("timestamp-" + name, [{ ...base, id: name, ...(time === undefined ? { timestamp: null } : { timestamp: time }) }].map(row => { if (time === undefined) delete row.timestamp; return row; }));
    add("archive-time-retained", [{ ...base, archivedAt: NOW - 1000 }]);
    add("missing-display-fields", [{ id: "no-title-source", timestamp: NOW - 1000, projectId: "deleted", project: "Original owner" }]);
    add("invalid-source-navigation", [{ ...base, path: "../Gone.md", id: "invalid-source" }]);
    add("unsupported-relevant-id", [{ ...base, id: { invalid: true } }]);
    add("unsupported-relevant-owner", [{ ...base, projectId: ["private"] }]);
    add("unsupported-non-countable-time", [{ ...base, timestamp: { unsupported: true } }]);
    add("malformed-rows", [null, false, 0, "", "truthy-invalid", [], { timestamp: NOW - 1 }]);
    const workspaces = support.registry.map(({ key, owner }) => ({ projectId: owner.type === "resource" ? "resource:" + owner.id : owner.id, contextKind: owner.type, name: "Current " + key, status: key === "private" ? "shelved" : "active" }));
    add("all-owner-cohorts", [...workspaces.map(w => ({ ...base, ...w, id: "event-" + w.projectId, projectName: "Old label", path: "Moved/Elsewhere.md" })), { ...base, id: "deleted", projectId: "deleted", projectName: "Historical deleted" }, { ...base, id: "unassigned", projectId: null, projectName: "Not an identity" }, { ...base, id: "kind-conflict", projectId: "itacan", targetKind: "project", contextKind: "resource" }], { inputs: { workspaces } });
    add("history-display-order", [{ ...base, id: "old", timestamp: NOW - 1000 }, { ...base, id: "new", timestamp: NOW - 1 }, { ...base, id: "old", timestamp: NOW - 1000 }]);
    for (const stamp of ["2026-03-29T12:00:00+02:00", "2026-10-25T12:00:00+01:00", "2026-01-01T00:00:00+01:00", "2024-02-29T23:59:59+01:00", "2026-05-31T12:00:00+02:00", "2026-12-31T23:59:59+01:00"]) {
        const now = Date.parse(stamp), records = [];
        for (const [range] of statistics.RANGES) { const r = statistics.statisticsRange(range, now, now - 900 * 86400000); for (const [i, timestamp] of [r.start - 1, r.start, r.end - 1, r.end, now, now + 1].entries()) records.push({ ...base, id: range + "-" + i, timestamp, kind: i % 2 ? "step" : "task" }); }
        add("calendar-" + stamp, records, { now, inputs: { workspaces } });
    }
    for (const days of [1, 100, 101, 730, 731, 2000]) { const d = new Date(NOW); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days + 1); add("all-time-bins-" + days, [{ ...base, id: "earliest", timestamp: +d }]); }
    add("independent-metric-sentinels", [{ ...base, kind: "step", id: "history" }], { inputs: { workspaces, activity: [{ path: "Projects/Private/Note.md", projectId: "private", action: "created", timestamp: NOW - 2000 }, { path: "Projects/Private/Note.md", projectId: "private", action: "edited", timestamp: NOW - 1000 }], notes: [{ path: "Projects/Private/Note.md", projectId: "private", createdAt: NOW - 864000000 }], reports: [{ projectId: "private", date: "2026-10-16", score: 4 }, { projectId: "resource:study", date: "2026-10-16", score: 2 }, { projectId: "report-only", date: "2026-10-16", score: 3 }], oaths: [{ id: "native-oath-sentinel", state: "fulfilled", startedAt: NOW - 3000, completedAt: NOW - 2000, workspace: { type: "resource", id: "study" }, policy: { mode: "strict" } }] } });
    return vectors;
}
module.exports = { H, NOW, rawCapture, mappingCapture, byteSource, review, seal, legacy, observe, summary, vectorInputs, normalize, sourcePins, nativeSpec, support, taskProgressMutation, statistics, pluginRoot };
if (require.main === module && process.argv[2] === "--timezone-observations") process.stdout.write(JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, vectors: vectorInputs().filter(v => v.id.startsWith("calendar-") || v.id.startsWith("all-time-bins-")).map(v => ({ id: v.id, ...summary(v.records, v.inputs, v.now) })) }));
