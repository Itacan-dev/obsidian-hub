"use strict";
const { randomUUID } = require("node:crypto"), V = require("../src/value"), P = require("../writer/policy"), I = require("../application/intents");
const { check } = require("../src/errors"), { freeze } = require("../src/snapshot-read");
const { createNativeWriterSession } = require("../writer"), { createNativeReadAdapter } = require("../host"), { createNativeEditorReadPort } = require("../host/editor-read");
const App = require("../application"), B = require("../product-ui/bridge.cjs");
const pluginRoot = "../../.obsidian/plugins/hub-project-menu/lib/";
const { TaskService } = require(pluginRoot + "services/task-service");
const same = P.same, consumers = require("./home-schedule");
function view(t, authorityId) {
    return { id: t.id, nativeReference: { authorityId, owner: V.clone(t.owner), taskId: t.id, taskRevision: t.revision }, owner: V.clone(t.owner),
        location: V.clone(t.location), text: t.title, description: t.description, completed: t.completed, necessity: t.importance,
        fromDate: t.start?.date ?? null, fromTime: t.start?.time ?? null, dueDate: t.due?.date ?? null, dueTime: t.due?.time ?? null,
        steps: t.steps.map(s => ({ id: s.id, taskId: t.id, text: s.title, completed: s.completed, parentStepId: s.parentStepId })),
        nativeReadOnly: !!t.phase || t.steps.some(s => s.parentStepId !== null) || t.consumerFacts?.recurrenceMember === true };
}
async function openProjectRuntime(config, options) {
    check(options.consumerUiV1 === undefined || options.consumerUiV1 === true, "Explicit consumer rehearsal option required.");
    config = freeze(V.clone(config)); options = { ...options, writerPolicy: freeze(V.clone(options.writerPolicy)) };
    check(["project", "resource"].includes(options.owner?.type) && options.writerPolicy.owners.length === 1 && same(options.owner, options.writerPolicy.owners[0].owner), "One private Project required.");
    const owner = freeze(V.clone(options.owner)), session = createNativeWriterSession(config, { registry: options.registry, identity: options.identity,
        writerPolicy: options.writerPolicy, repositoryOptions: options.repositoryOptions, requestRetention: { version: 1, rehearsalId: options.rehearsalId } });
    let closed = false, lastOutcome = null, refreshedOperation = null, resourceLocations = [];
    const authority = { backend: "native", authorityId: config.authorityId, applicationContextId: config.applicationContextId };
    try {
        const r = await options.registry.read(); const o = r.owners.find(o => same(o.owner, owner)); check(o && !o.shared && o.available && o.partitionId === options.writerPolicy.owners[0].partitionId, "Private owner evidence required.");
        if (options.creating) await session.host.create({ version: 2, authorityId: config.authorityId, partitions: [{ id: o.partitionId, owner, kind: owner.type === "resource" ? "resource" : "private-project" }], reason: "Explicit owner-scoped authority creation", ...(config.scope === "device-private-project" ? { verifiedCutover: true } : { syntheticOnly: true }), taskMutationVersion: 1 });
        else await session.host.open({ version: 1, expectedAuthorityId: config.authorityId, ...(config.scope === "device-private-project" ? { verifiedCutover: true } : { syntheticOnly: true }) });
    } catch (error) { await session.dispose().catch(() => {}); throw error; }
    const taskService = new TaskService(createNativeReadAdapter(session.host)), editorPort = createNativeEditorReadPort(session.host, { writerPolicy: options.writerPolicy });
    const grant = () => session.authorize({ version: 1, owners: options.writerPolicy.owners, commands: options.writerPolicy.commands });
    async function withGrant(fn) { const cap = await grant(); try { return await fn(cap); } finally { session.revoke(cap); } }
    const alive = () => check(!closed, "Project runtime is closed.");
    async function capture() { alive(); const r = await session.host.readScoped({ version: 2, authorityId: config.authorityId, owners: [owner], selection: "tasks", ...(options.consumerUiV1 ? { includeConsumerFacts: true } : {}) }); check(r.status === "ok" && r.info.readiness.state === "ready", "Native Project unavailable."); return r; }
    async function consumerContext(stamp) {
        const registry = require("../host/registry").validateRegistry(await options.registry.read(), config), h = session.host.info();
        check(registry.digest === stamp.ownerContextPin && h.hostEpoch === stamp.hostEpoch && h.readiness.state === "ready", "Consumer context changed.");
        const entry = registry.owners.find(o => same(o.owner, owner));
        check(entry && entry.available && entry.dashboard && !entry.shared && entry.partitionId === options.writerPolicy.owners[0].partitionId, "Native owner unavailable.");
        resourceLocations = entry.locations;
        return { owner, root: entry.root, dashboard: entry.dashboard, status: entry.status };
    }
    async function list() { const r = await capture(); const context = options.consumerUiV1 ? await consumerContext(r.stamp) : undefined;
        return freeze({ stamp: r.stamp, tasks: r.snapshot.tasks.map(t => view(t, config.authorityId)), ...(context ? { context } : {}) }); }
    async function rawEditor(id) { alive(); const r = await editorPort.read({ version: 1, authorityId: config.authorityId, owner, partitionId: options.writerPolicy.owners[0].partitionId, taskId: id }); check(r.status === "ok", "Native editor unavailable."); return r.editor; }
    const editor = async id => B.editable(await rawEditor(id));
    async function creationContext() { const r = await capture(); return { authority, owner, guard: { expectedRepositoryRevision: r.stamp.head.repositoryRevision, ownerContextPin: r.stamp.ownerContextPin, identityPin: r.stamp.identityPin,
        inventoryPin: P.hash(options.writerPolicy.inventory), phasePin: P.hash(options.writerPolicy.phases), partitions: r.snapshot.partitions.map(p => ({ id: p.id, owner, expectedRevision: p.revision })) } }; }
    async function dispatch(cap, intent, writer = session.writer, signal) {
        const adapter = App.createNativeApplicationAdapter({ authority, host: session.host, writer, capability: cap });
        const service = App.createApplicationMutationService({ taskService, adapter }); let out;
        try { out = await service.mutate(intent, signal); } finally { service.dispose(); }
        if (!closed) { lastOutcome = out; refreshedOperation = null; } return out;
    }
    async function mutate(input) {
        alive(); const compiled = I.compile(input), intent = compiled.intent; check(same(intent.authority, authority) && same(intent.owner, owner), "Project authority differs.");
        return withGrant(async cap => {
            let retained = null;
            try { retained = await session.requests.get(cap, intent.operationId); } catch (error) { if (error.code !== "ENOENT") throw error; }
            if (!retained) {
                if (intent.action.kind === "rich-create") { const d = intent.action.draft; check(d.continuation === "" && d.metadata.phase === null && (owner.type === "resource" || d.metadata.location === null) && d.steps.every(s => s.body === "" && s.parentStepId === null), "Creation exceeds compact form."); }
                else {
                    const e = await editor(intent.action.target.taskId);
                    if (intent.action.kind === "full-save") { const d = intent.action.draft, originals = new Map(e.draft.steps.map(s => [s.id, s]));
                        check(d.continuation === e.draft.continuation && (owner.type === "resource" || same(d.metadata.location, e.draft.metadata.location)) && same(d.metadata.phase, e.draft.metadata.phase) && d.steps.every(s => s.parentStepId === null && s.body === (originals.get(s.id)?.body ?? "") && (!originals.has(s.id) || s.order === originals.get(s.id).order)), "Hidden native content must survive."); }
                }
            }
            await session.requests.prepare(cap, intent);
            return dispatch(cap, intent);
        });
    }
    const recoveryReviews = new WeakMap();
    function recoveryUnavailable(id) { return freeze({ version: 1, privacy: "local-private", authorityId: config.authorityId, applicationContextId: config.applicationContextId, operationId: id,
        classification: "authority-unavailable", code: "AUTHORITY_UNAVAILABLE", owner: null, partitionId: null, recordChecksum: null, commandDigest: null, observation: null, receipt: null, taskIds: [], eventIds: [], canReplay: false, replayCode: "AUTHORITY_UNAVAILABLE" }); }
    function recoveryReview(raw) {
        const failedRefresh = raw.classification === "confirmed-committed" && refreshedOperation !== raw.operationId && lastOutcome?.operationId === raw.operationId && ["committed", "replayed"].includes(lastOutcome.status) && lastOutcome.readAfterWrite?.state !== "current";
        const report = freeze({ ...raw, classification: failedRefresh ? "committed-refresh-unavailable" : raw.classification });
        if (raw.canReplay) recoveryReviews.set(report, raw); return report;
    }
    const recovery = Object.freeze({
        async inspect(id) { V.text(id); if (closed) return recoveryUnavailable(id); try { return await withGrant(async cap => recoveryReview(await session.requests.inspect(cap, id))); } catch (_) { return recoveryUnavailable(id); } },
        async reconcile(id) {
            V.text(id); if (closed) return freeze({ inspection: recoveryUnavailable(id), presentation: { state: "unavailable", code: "RUNTIME_CLOSED" } });
            try { return await withGrant(async cap => {
                const outcome = await session.requests.reconcile(cap, id), raw = await session.requests.inspect(cap, id), inspection = recoveryReview(raw);
                if (outcome.state !== "committed") return freeze({ inspection, presentation: { state: "not-requested", code: "OUTCOME_UNCONFIRMED" } });
                try { const current = await list(); if (!closed) refreshedOperation = id; return freeze({ inspection: recoveryReview(raw), presentation: { state: "current", stamp: current.stamp } }); }
                catch (_) { const failed = freeze({ ...inspection, classification: "committed-refresh-unavailable" }); if (raw.canReplay) recoveryReviews.set(failed, raw); return freeze({ inspection: failed, presentation: { state: "unavailable", code: "PRESENTATION_UNAVAILABLE" } }); }
            }); } catch (_) { return freeze({ inspection: await this.inspect(id), presentation: { state: "unavailable", code: "OUTCOME_UNCONFIRMED" } }); }
        },
        async replay(review, signal) {
            alive(); const original = recoveryReviews.get(review); check(original, "An original accepted operator recovery review is required."); recoveryReviews.delete(review);
            return withGrant(async cap => {
                const retained = await session.requests.get(cap, original.operationId);
                const exact = (capability, request, cancellation) => { check(capability === cap && P.same(request, retained.writerRequest), "Recovery must use the exact original request."); return session.requests.replay(cap, original, cancellation); };
                return dispatch(cap, retained.intent, Object.freeze({ task: exact, step: exact, recurrence: exact }), signal);
            });
        }
    });
    async function editResult(out) {
        if (!["committed", "replayed"].includes(out.status)) { const e = Error("Task outcome requires review (" + (out.code || out.status) + ")."); e.operationId = out.operationId; throw e; }
        try { const r = await list(); return freeze({ backend: "native", owner, authorityId: config.authorityId, outcome: out, availability: "current", tasks: r.tasks }); }
        catch (_) { return freeze({ backend: "native", owner, authorityId: config.authorityId, outcome: out, availability: "unavailable", tasks: [] }); }
    }
    function formService(app, sourceLabel = owner.type === "resource" ? "Resource" : "Project") {
        let original = null, attempt = null;
        async function issue(values, build) {
            const fingerprint = V.canonical([B.fingerprint(values), owner.type === "resource" ? values.nativeLocation ?? null : null]);
            check(!attempt || attempt.fingerprint === fingerprint, "Keep the original request until reviewed.");
            if (!attempt) attempt = { fingerprint, intent: await build() };
            return editResult(await mutate(attempt.intent));
        }
        const location = values => {
            if (owner.type !== "resource") return null;
            const id = values.nativeLocation ?? "";
            if (!id) return null;
            const ref = resourceLocations.find(l => l.id === id); check(ref, "Resource location changed or is unavailable."); return V.clone(ref);
        };
        return { app, formContext: snapshot => ({ destination: { authorityId: config.authorityId, owner }, sourcePath: null, sourceLabel,
            ...(owner.type === "resource" ? { resourceLocations: resourceLocations.map(l => ({ ...V.clone(l), label: options.locationLabel?.(l) ?? l.id })), nativeLocation: snapshot?.nativeLocation ?? "" } : {}) }), context: () => null, phases: () => [],
            async read(task) { original = await editor(task.id ?? task.nativeReference?.taskId); return { ...B.toForm(original), ...(owner.type === "resource" ? { nativeLocation: original.draft.metadata.location?.id ?? "" } : {}) }; },
            async create(destination, text, values) { check(destination.authorityId === config.authorityId && same(destination.owner, owner), "Destination changed."); return issue(values, async () => { const i = B.create(await creationContext(), values); i.action.draft.id = randomUUID(); i.action.draft.metadata.location = location(values); return i; }); },
            async save(snapshot, values) { check(original, "Editor snapshot missing."); return issue(values, () => { if (values.operation === "delete") return B.remove(original); const i = B.save(original, values); if (owner.type === "resource") i.action.draft.metadata.location = location(values); return i; }); }
        };
    }
    function createPanelRead({ plugin, component, workspace, changed = () => {} }) {
        check(same(workspace, owner), "Project panel owner differs.");
        let disposed = false, generation = 0, last = null, availability = "current";
        const stop = session.host.subscribe(() => { generation++; if (!disposed) changed(); });
        const close = () => { if (disposed) return; disposed = true; generation++; stop(); }; component.register(close);
        const reference = task => { if (options.consumerUiV1) { check(availability === "current", "Native Project unavailable."); check(!task.nativeReadOnly, "Native task action is unavailable."); } const r = task.nativeReference; check(r && r.authorityId === config.authorityId && same(r.owner, owner), "Native action scope differs."); return r; };
        async function change(request) { const r = reference(request), e = await editor(r.taskId); check(e.taskRevision === r.taskRevision, "Task changed; reopen it.");
            check(!disposed, "Panel is closed."); let i;
            if (request.operation === "step") { check(e.draft.steps.some(s => s.id === request.step?.id), "Step unavailable."); i = B.complete(e, request.stepCompleted, request.step.id); }
            else { check(request.operation === undefined && typeof request.completed === "boolean", "Native source action unavailable."); i = B.complete(e, request.completed); }
            return editResult(await mutate(i));
        }
        const controller = { close, actions: { mutate: change, editTask(task, saved) { check(!disposed, "Panel is closed."); reference(task); return require(pluginRoot + "ui/task-editor").openTaskEditor(formService(plugin.app), task, saved); } },
            async read() { const ticket = generation; try { const r = await list(); if (disposed || ticket !== generation) return null; const signature = V.canonical(r.tasks); availability = "current"; return { tasks: r.tasks, changed: signature !== last, diagnostics: [], availability, ...(options.consumerUiV1 ? { stamp: r.stamp, context: r.context } : {}) }; }
                catch (_) { if (disposed) return null; availability = "unavailable"; return { tasks: [], changed: true, availability, diagnostics: [{ code: "NATIVE_PROJECT_UNAVAILABLE" }] }; } },
            accept(tasks) { last = V.canonical(tasks); },
            reconcile(items, edit) { if (disposed) return []; check(edit.backend === "native" && same(edit.owner, owner) && edit.authorityId === config.authorityId, "Native edit scope differs."); generation++; availability = edit.availability; changed(); return edit.tasks; },
            toggle: (task, completed) => change({ ...task, completed }),
            clear: async () => { throw Error("Native clear-completed is unavailable."); },
            reveal: async () => { throw Error("Native source navigation is unavailable."); },
            create(options = {}) { check(!disposed, "Panel is closed."); return require(pluginRoot + "ui/task-editor").openTaskCreator(formService(plugin.app), options); }
        };
        return controller;
    }
    const historyFeeds = new Set();
    const historyEvidence = options.historyUiV1 ? require("../host/history-read").createHistoryReadPort(session.host, { authorityId: config.authorityId, owners: [owner] }) : null;
    function completionFeed({ legacy, app, navigate }) {
        alive(); check(options.historyUiV1 === true, "Explicit History rehearsal option required.");
        const port = historyEvidence;
        const feed = require("./completion-feed").createCompletionFeed({ native: port, legacy, navigate: navigate ?? (async ref => {
            check(app && same(ref.owner, owner), "Native History navigation scope differs.");
            const r = await list(), task = r.tasks.find(t => t.id === ref.taskId); check(task && !task.nativeReadOnly, "Native History navigation unavailable.");
            require(pluginRoot + "ui/task-editor").openTaskEditor(formService(app), task, () => {});
            return { kind: "native-task", taskId: task.id, owner };
        }) });
        historyFeeds.add({ feed, port }); return feed;
    }
    const nativeTasks = Object.freeze({ owner, createPanelRead, ...(options.consumerUiV1 ? { consumerUiV1: true, mergeHome: consumers.mergeHome, taskKey: consumers.taskKey } : {}) });
    return Object.freeze({ nativeTasks, owner, list, editor, creationContext, mutate, formService, completionFeed, historyEvidence, recovery,
        info: () => freeze({ authority, owner, scope: config.scope, lastOutcome, history: options.historyUiV1 ? "rehearsal" : "unavailable", statistics: options.historyUiV1 ? "rehearsal" : "unavailable", home: options.consumerUiV1 ? "rehearsal" : "unavailable", schedule: options.consumerUiV1 ? "rehearsal" : "unavailable" }),
        retained: () => withGrant(cap => session.requests.list(cap)),
        getRetained: id => withGrant(cap => session.requests.get(cap, id)),
        reconcile: id => withGrant(cap => session.requests.reconcile(cap, id)),
        async replay(id) { const r = await withGrant(cap => session.requests.get(cap, id)); return mutate(r.intent); },
        async close() { if (closed) return; closed = true; for (const { feed } of historyFeeds) feed.dispose(); historyFeeds.clear(); historyEvidence?.dispose(); await taskService.close(); await session.dispose(); }
    });
}
module.exports = { openProjectRuntime };
