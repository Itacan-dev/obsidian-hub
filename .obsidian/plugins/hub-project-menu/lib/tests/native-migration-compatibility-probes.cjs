"use strict";
// N1-A observation harness only. Existing parsers and an inactive MemoryStorage;
// no startup, migration, persistent repository, ledger, or real Oath enrollment.
const tasks = require("../domain/tasks");
const planning = require("../domain/task-planning");
const { normalizeLegacyTask, legacyTaskHandle } = require("../services/task-service-legacy-values");
const { taskProgressMutation } = require("../domain/task-progress");
const { queryHistory } = require("../domain/history");
const { prepareStatistics, aggregateStatistics, statisticsRange, RANGES } = require("../domain/statistics");
const native = require("../../../../../ItacanTaskCore/src");
const nf = require("./native-read-fixture.cjs");
const clone = v => JSON.parse(JSON.stringify(v));
const PATH = "Projects/Private/Folder/Synthetic.md";
const NOW = Date.parse("2026-10-17T10:00:00+02:00");
async function attempt(action) {
    try { return { status: "observed", value: clone(await action()) }; }
    catch (error) { return { status: "rejected", code: error.code ?? "ERROR", message: error.message }; }
}
function progress(input) {
    let checks = clone(input.checks ?? []), history = clone(input.history ?? []), seq = 0;
    const context = { projectId: "private", name: "Private at event", path: "Projects/Private/Private.md", root: "Projects/Private", contextKind: "project", status: "active" };
    return input.actions.map((action, i) => {
        const completed = action === "complete" || action === "step-complete";
        const step = action.startsWith("step-");
        const edit = { path: PATH, line: 0, oldText: "Parent", hubTaskId: "parent", lineDelta: 0, removedLines: action === "delete" ? 5 : 0,
            tasks: action === "delete" ? [] : [{ path: PATH, line: 0, text: "Parent", hubTaskId: "parent", completed, steps: [] }],
            wasCompleted: !completed, completed,
            ...(action === "delete" ? { operation: "delete" } : action === "edit" ? { operation: "edit" } : step ? { operation: "step", progressTransitions: [{ kind: "step", hubTaskId: "step", parentTaskId: "parent", parentText: "Parent", text: "Step", line: 1, completed }] } : {}) };
        const result = taskProgressMutation(checks, history, edit, context, NOW + i, () => "event-" + (++seq));
        checks = result.checks; history = result.history;
        return { action, checks: clone(checks), history: clone(history), changed: result.changed };
    });
}
async function legacy(input) {
    if (input.probe === "unverified") return { status: "unverified", reason: input.reason };
    if (input.probe === "source-inspected") return { status: "source-inspected", reason: input.reason };
    return attempt(async () => {
        switch (input.probe) {
        case "line": return { details: tasks.taskLineDetails(input.text), identity: tasks.taskIdentity(input.text), display: tasks.taskDisplayText(input.text) };
        case "groups": return planning.taskGroups(input.tasks, new Date(input.now));
        case "history-write-failure": {
            const { fixture, notices } = require("./task-service-fixture.cjs"), f = fixture();
            const previousNow = Date.now, previousError = console.error, start = notices.length;
            Date.now = () => NOW; const errors = []; console.error = message => errors.push(message);
            try { f.add(PATH, "- [ ] Parent <!-- hub-task:parent -->\n"); f.state.failHistory = true;
                await f.plugin.toggleTask(PATH, 0, "Parent", true, "parent");
                return { snapshot: f.snapshot(), state: f.state, notices: notices.slice(start), errors };
            } finally { Date.now = previousNow; console.error = previousError; await f.close(); }
        }
        case "clear-recorded": {
            const { fixture } = require("./task-service-fixture.cjs"), f = fixture(), previousNow = Date.now;
            Date.now = () => NOW;
            try {
                const file = f.add(PATH, "- [x] Parent <!-- hub-task:parent -->\n    - [x] Step <!-- hub-task:step -->\n- [ ] Following\n");
                Object.setPrototypeOf(file, require("obsidian").TFile.prototype);
                f.metadataCache.getFileCache = () => ({}); f.wizard.activityLog = [];
                Object.assign(f.wizard, { projectWorkRatings: {}, projectWorkLogs: {}, resourceWorkRatings: {}, resourceWorkLogs: {} });
                f.wizard.completedTaskHistory = clone(input.history);
                f.wizard.completedTaskChecks = [{ kind: "task", hubTaskId: "parent", path: PATH, line: 0, text: "Parent", timestamp: NOW - 1000, historyId: input.history[0].id }];
                await f.plugin.clearCompletedTasks([{ path: PATH, line: 0, text: "Parent", hubTaskId: "parent", projectId: "private" }], false);
                return f.snapshot();
            } finally { Date.now = previousNow; await f.close(); }
        }
        case "identity": return { identity: tasks.taskIdentity(input.text), display: tasks.taskDisplayText(input.text), normalized: tasks.normalizedTaskText(input.text),
            handle: legacyTaskHandle({ path: PATH, line: 0, text: input.text, hubTaskId: tasks.taskIdentity(input.text) }) };
        case "locate": return { line: tasks.locateTaskLine(input.source.split(/\r?\n/), input.line, input.text, input.id) };
        case "snapshot": {
            const snapshot = planning.readTaskSnapshot(input.source, { path: PATH, line: 0, text: input.title ?? "Parent", hubTaskId: input.id ?? null });
            const normalized = normalizeLegacyTask({ ...snapshot, ...input.metadata }, input.owner ?? nf.owners.private);
            return { snapshot, normalized };
        }
        case "append": return { content: planning.appendTask(input.source, input.title) };
        case "step-toggle": return planning.toggleTaskStep(input.source, input.request, () => "allocated-legacy");
        case "oath-bridge": {
            const { fixture, bridge, projection } = require("./oath-committed-fixture.cjs"); const f = fixture();
            try { const b = await bridge(f, { preexisting: input.preexisting }); await f.oath.resolveWork();
                return { id: b.id, pending: [...f.oath.awaitingIndex.keys()], work: projection(f.oath.work), state: f.oath.current.state, source: f.contents.get(b.note) };
            } finally { await f.close(); }
        }
        case "metadata": return planning.validateTaskMetadata(input.value);
        case "toggle-transport": return tasks.editTaskContent(input.source, { path: PATH, line: 0, text: input.title, hubTaskId: input.id, completed: input.completed }, () => input.callbackOutput);
        case "progress": return progress(input);
        case "history": {
            const records = queryHistory(input.records, input.query ?? {});
            const prepared = prepareStatistics({ completions: input.records, workspaces: input.workspaces ?? [] }, NOW);
            return { records, statistics: { completions: prepared.completions, cohorts: [...prepared.registry], ranges: RANGES.map(([key]) => {
                const model = aggregateStatistics(prepared, key); return { key, start: model.range.start, end: model.range.end, totals: model.rows.map(r => ({ key: r.key, tasks: r.tasks.reduce((a,b)=>a+b,0), steps: r.steps.reduce((a,b)=>a+b,0) })) };
            }) } };
        }
        case "local-calendar": return { endpoints: planning.validateTaskMetadata(input.value), range: statisticsRange("7d", input.now, input.earliest), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        case "indexed": {
            const { fixture } = require("./task-service-fixture.cjs"); const f = fixture();
            try { for (const note of input.notes) f.add(note.path, note.source);
                const pages = f.plugin.taskData.readPages({ pages: () => ({ array: () => [...f.pages.values()] }) });
                return pages.map(page => ({ path: page.file.path, tasks: page.file.tasks }));
            } finally { await f.close(); }
        }
        case "oath": {
            const { fixture, commit, projection, scenarios } = require("./oath-committed-fixture.cjs"); const f = fixture();
            try { commit(f); scenarios[input.scenario](f); await f.oath.resolveWork();
                return { work: projection(f.oath.work), pending: [...f.oath.awaitingIndex.keys()], references: clone(f.oath.current.tasks) };
            } finally { await f.close(); }
        }
        case "shared": {
            const { selectShared } = require("../services/shared-projects");
            return selectShared(input.data, { projects: input.projects, taskIds: new Set(input.taskIds) });
        }
        default: throw Error("Unknown legacy probe: " + input.probe);
        }
    });
}
async function memory(input) {
    let seq = 9000, armed = false;
    const storage = new native.MemoryStorage();
    const partitions = Object.values(nf.owners).map(owner => ({ id: owner.type + "-" + owner.id, kind: ["itacan", "hub"].includes(owner.id) ? "git-project" : owner.type === "resource" ? "resource" : "private-project", owner }));
    const options = { storage, partitions, idFactory: () => nf.id(++seq), clock: () => NOW,
        resolvers: { location: ref => input.locationOwner ? { ...ref, owner: input.locationOwner } : null, phase: ref => ref.projectId === "itacan" && ref.phaseId === "phase-1" ? ref : null },
        fault(stage) { if (armed && stage === input.fault) { armed = false; throw Error("Synthetic interruption"); } } };
    let repo = await native.createMemoryRepository(options);
    const outcomes = [], command = { type: "task.create", operationId: "create-1", payload: { task: { owner: nf.owners.private, title: "Parent", id: nf.id(1), createdAt: null, modifiedAt: null, ...input.task } } };
    try {
        for (const action of input.actions ?? ["create"]) {
            outcomes.push(await attempt(async () => {
                if (action === "reopen-store") { await repo.close(); repo = await native.openMemoryRepository(options); return { reopened: true }; }
                if (action === "arm") { armed = true; return { armed: true }; }
                if (action === "record-history") {
                    const operationId = "record-history";
                    return repo.execute({ type: "history.record", operationId, payload: { record: {
                        ...nf.dataset().history[4], id: nf.id(700), operationId, counted: true,
                        legacy: { originalRecord: input.rawHistory ?? { id: "old-completion", timestamp: null } }
                    } } });
                }
                let c;
                const current = repo.getTask(nf.id(1), { includeDeleted: true });
                if (action === "create" || action === "retry") c = clone(command);
                else if (action === "different-retry") c = { ...clone(command), payload: { task: { ...command.payload.task, title: "Changed input" } } };
                else if (action === "copy-parent") c = { ...clone(command), operationId: "copy" };
                else if (action === "copy-step-as-parent") c = { ...clone(command), operationId: "copy-step", payload: { task: { ...command.payload.task, id: nf.id(101), steps: [] } } };
                else {
                    const type = action === "delete" ? "task.delete" : action === "step-delete" ? "step.delete" : action === "step-reuse" ? "step.add" : action.startsWith("step-") ? "step.complete" : action === "edit" ? "task.update" : "task.complete";
                    const payload = {};
                    if (type === "task.complete") Object.assign(payload, { completed: action === "complete", completedAt: null });
                    if (type === "step.complete") Object.assign(payload, { stepId: nf.id(101), completed: action === "step-complete", completedAt: null });
                    if (type === "step.delete") Object.assign(payload, { stepId: nf.id(101), cascade: !!input.cascade });
                    if (type === "step.add") Object.assign(payload, { step: { id: nf.id(101), title: "Reuse", order: 0 } });
                    if (type === "task.update") Object.assign(payload, { patch: { title: "Edited later" } });
                    c = { type, operationId: "action-" + outcomes.length, taskId: current.id, expectedRevision: current.revision, payload };
                }
                const r = await repo.execute(c); return { replayed: r.replayed, taskId: r.taskId, revision: r.repositoryRevision };
            }));
        }
        return { outcomes, tasks: repo.queryTasks({ includeDeleted: true, includeArchived: true }), history: repo.queryHistory(), counted: repo.queryHistory({ counted: true }).length,
            bindings: clone(storage.state.bindings), retiredStepIds: clone(storage.state.retiredStepIds), receiptCount: storage.state.receipts.length, revision: repo.info().revision };
    } finally { await repo.close(); }
}
async function currentNative(input) {
    if (input.probe === "unsupported") return { status: "unsupported", reason: input.reason };
    return attempt(async () => {
        if (input.probe === "validate") { const record = nf.nativeTask(1, input.owner ?? nf.owners.private, input.patch ?? {}); native.validateTask(record); return record; }
        if (input.probe === "validate-history") { const record = { ...nf.dataset().history[4], ...input.patch }; native.validateHistory(record); return record; }
        if (input.probe === "memory") return memory(input);
        if (input.probe === "read-alias") {
            const f = nf.fixture(); try { return await f.service.read({ backend: "native", operation: "committed", workspace: nf.owners.private, references: [{ kind: "legacy-id", id: input.id ?? "parent" }] }); } finally { await f.service.close(); }
        }
        if (input.probe === "shared") {
            const owner = input.owner, partition = { id: owner.type + "-" + owner.id, kind: input.kind, owner, revision: 1, head: nf.id(500), parentHead: null };
            const task = nf.nativeTask(1, owner, { migration: { source: "synthetic", sourceId: "old-id", importedAt: null, evidence: { path: "private provenance" } }, captureSource: { path: "C:/synthetic/private.md" } });
            return JSON.parse(native.serializeSharedPartition({ partition, tasks: [task] }));
        }
        throw Error("Unknown native probe: " + input.probe);
    });
}
function readVectors(value) {
    if (value.fixtureVersion !== 1) throw Error("Unsupported compatibility fixture version");
    if (value.format !== "itacan-migration-compatibility" || value.nativeSchemaVersion !== 1 || value.observationRevision !== 1 || !Array.isArray(value.cases)) throw Error("Invalid compatibility dataset envelope");
    return value.cases;
}
module.exports = { legacy, currentNative, readVectors, NOW, PATH };
