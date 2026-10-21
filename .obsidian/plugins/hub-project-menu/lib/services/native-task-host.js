"use strict";
// Dormant startup integration. There is deliberately no persisted setting or
// end-user activation switch: this gate admits synthetic OS Temp vaults only.
const approvals = new WeakMap();
const path = require("node:path"), fs = require("node:fs/promises"), os = require("node:os");
const copy = value => JSON.parse(JSON.stringify(value));
const within = (parent, child) => { const r = path.relative(parent, child); return !!r && r !== ".." && !r.startsWith(".." + path.sep) && !path.isAbsolute(r); };
async function ordinary(directory) {
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error("Ordinary disposable directory required.");
    return fs.realpath(directory);
}
async function authorizeNativeTaskRehearsal(plugin, input) {
    if (plugin.nativeTaskHost || approvals.has(plugin)) throw Error("Native host already configured.");
    const options = copy(input), vault = await ordinary(plugin.app.vault.adapter.getBasePath()), temp = await fs.realpath(os.tmpdir());
    const root = await ordinary(options.root), native = await ordinary(options.config.directory);
    if (options.version !== 1 || options.syntheticOnly !== true || !within(temp, root) || !within(root, vault) || !within(root, native) || native === vault || within(vault, native) || within(native, vault)) throw Error("Synthetic Temp vault and separate native root required.");
    for (const cloud of [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean)) if (within(path.resolve(cloud), root) || path.resolve(cloud) === root) throw Error("Cloud storage is not admitted.");
    if (options.owner?.type !== "project" || options.config.scope !== "inactive-disposable" || typeof options.projectRoot !== "string" || !options.projectRoot || typeof options.dashboard !== "string") throw Error("Explicit private synthetic Project required.");
    // No existing task source can become a second writable authority. This is
    // not a cutover permit and cannot retire or convert Markdown checkboxes.
    for (const file of plugin.app.vault.getMarkdownFiles()) if (file.path === options.projectRoot || file.path.startsWith(options.projectRoot + "/")) {
        if (/^\s*(?:[-*+]|\d+[.)])\s+\[[^\]]\]/m.test(await plugin.app.vault.read(file))) throw Error("Synthetic native Project must contain no Markdown tasks.");
    }
    const vaultStat = await fs.stat(vault, { bigint: true });
    approvals.set(plugin, { ...options, vaultPin: { real: vault, dev: String(vaultStat.dev), ino: String(vaultStat.ino) } });
}
function createNativeTaskHost(plugin) {
    const options = approvals.get(plugin); approvals.delete(plugin);
    if (!options) return null; // No native imports, storage access or host in Legacy mode.
    const { openProjectRuntime } = require("../../../../../ItacanTaskCore/integration/project-runtime");
    const { registryDigest } = require("../../../../../ItacanTaskCore/host/registry");
    const { policy, hash } = require("../../../../../ItacanTaskCore/writer/policy");
    const consumers = require("../../../../../ItacanTaskCore/integration/home-schedule");
    const { owner, config } = options, stops = [], registryListeners = new Set(), historyListeners = new Set();
    let runtime = null, feed = null, stopped = false, closing = null, state = "opening", ready;
    const matches = ref => ref?.type === "project" && ref.id === owner.id;
    const project = () => plugin.projectWizard.getProjectById(owner.id);
    const ownsPath = value => typeof value === "string" && (value === options.projectRoot || value.startsWith(options.projectRoot + "/"));
    const unavailable = () => { throw Error("Native task operation is unavailable. Markdown fallback is disabled."); };
    const rejectLegacy = value => {
        const ref = value?.nativeReference?.owner ?? value?.owner ?? value;
        const context = typeof value === "string" ? plugin.projectWizard.getContextForPath(value) : null;
        if (matches(ref) || context?.contextKind !== "resource" && context?.projectId === owner.id || value?.contextKind !== "resource" && value?.projectId === owner.id || ownsPath(typeof value === "string" ? value : value?.path)) unavailable();
    };
    function wrap(object, name, before) {
        const original = object[name]; if (typeof original !== "function") throw Error("Missing task boundary: " + name);
        const wrapped = function (...args) { before(...args); return original.apply(this, args); }; object[name] = wrapped;
        stops.push(() => { if (object[name] === wrapped) object[name] = original; });
    }
    // Instance-local admission guards; ordinary construction is untouched.
    for (const name of ["file", "destination", "create"]) wrap(plugin.taskEditor, name, rejectLegacy);
    wrap(plugin.taskEditor, "save", (snapshot, values) => { rejectLegacy(snapshot.file?.path ?? snapshot.path); rejectLegacy(values.location); });
    wrap(plugin, "mutateTask", request => rejectLegacy(request));
    wrap(plugin, "performClearCompletedTasks", requests => { for (const r of requests ?? []) rejectLegacy(r); });
    wrap(plugin.planning, "project", id => { if (id === owner.id) unavailable(); });
    const originalRead = plugin.taskData.readPages;
    const readPages = function (...args) { return originalRead.apply(this, args).filter(page => {
        const context = plugin.projectWizard.getContextForPath(page.file?.path);
        return !ownsPath(page.file?.path) && (context?.contextKind === "resource" || context?.projectId !== owner.id);
    }); };
    plugin.taskData.readPages = readPages;
    stops.push(() => { if (plugin.taskData.readPages === readPages) plugin.taskData.readPages = originalRead; });
    // Unsupported domain entry points are guarded before their queues/saves.
    const guardUnsupported = () => {
        wrap(plugin.inbox, "makeTask", (values, captureId) => {
            const capture = captureId ? plugin.inbox.required(captureId) : null;
            const candidates = [values, capture?.intent, capture?.operation];
            for (const c of candidates) if (c && (c.workspaceId === owner.id || ownsPath(c.location))) unavailable();
        });
        wrap(plugin.inbox, "taskDestination", values => { if (values.workspaceId === owner.id || ownsPath(values.location)) unavailable(); });
        const locations = plugin.inbox.taskLocations;
        const taskLocations = function (id) { return id === owner.id ? [] : locations.call(this, id); };
        plugin.inbox.taskLocations = taskLocations;
        stops.push(() => { if (plugin.inbox.taskLocations === taskLocations) plugin.inbox.taskLocations = locations; });
        wrap(plugin.oath, "take", draft => { if (matches(draft.workspace)) unavailable(); });
        const resolve = plugin.oath.resolveWorkspace;
        const resolveWorkspace = function (ref, ...args) { return matches(ref) ? null : resolve.call(this, ref, ...args); };
        plugin.oath.resolveWorkspace = resolveWorkspace;
        stops.push(() => { if (plugin.oath.resolveWorkspace === resolveWorkspace) plugin.oath.resolveWorkspace = resolve; });
        const workspaces = plugin.oath.workspaces;
        const oathWorkspaces = function (...args) { return workspaces.apply(this, args).filter(p => p.contextKind === "resource" || p.projectId !== owner.id); };
        plugin.oath.workspaces = oathWorkspaces;
        stops.push(() => { if (plugin.oath.workspaces === oathWorkspaces) plugin.oath.workspaces = workspaces; });
    };
    function changed() { for (const fn of [...registryListeners]) fn(); }
    for (const event of ["create", "delete", "rename", "modify"]) {
        const ref = plugin.app.vault.on(event, changed); stops.push(() => plugin.app.vault.offref(ref));
    }
    const registry = {
        async read() {
            const vault = await ordinary(plugin.app.vault.adapter.getBasePath()), stat = await fs.stat(vault, { bigint: true });
            if (vault !== options.vaultPin.real || String(stat.dev) !== options.vaultPin.dev || String(stat.ino) !== options.vaultPin.ino) throw Error("Native application context changed.");
            const p = project(), shared = !!p?.shared || require("./shared-projects").SHARED_PROJECT_ROOTS.includes(p?.root);
            const candidates = plugin.projectWizard.getProjectRecords().filter(p => p.projectId === owner.id), physical = plugin.projectWizard.getContextForPath(options.dashboard);
            const available = candidates.length === 1 && physical?.contextKind !== "resource" && physical?.projectId === owner.id && !!p && p.contextKind !== "resource" && p.root === options.projectRoot && p.path === options.dashboard && p.status === "active" && !shared;
            const body = { version: 1, registryId: config.registryId, applicationContextId: config.applicationContextId, revision: JSON.stringify([p?.projectId ?? null, p?.root ?? null, p?.path ?? null, p?.status ?? null, !!p?.shared]),
                owners: [{ owner, partitionId: options.partitionId, root: options.projectRoot, dashboard: options.dashboard, status: p?.status ?? "active", available, shared, shareApproval: null, locations: [], mounts: [] }] };
            return { ...body, digest: registryDigest(body) };
        }, subscribe(fn) { registryListeners.add(fn); return () => registryListeners.delete(fn); }
    };
    const legacyChanged = () => { for (const fn of [...historyListeners]) fn(); };
    document.addEventListener("hub-completed-tasks-changed", legacyChanged);
    stops.push(() => document.removeEventListener("hub-completed-tasks-changed", legacyChanged));
    const legacy = { async read() {
        const records = copy(plugin.projectWizard.completedTaskHistory ?? plugin.projectWizard.data.completedTaskHistory ?? []);
        return { version: 1, revision: hash(records), records };
    }, subscribe(fn) { historyListeners.add(fn); return () => historyListeners.delete(fn); } };
    const failedPanel = ({ component }) => {
        const stop = () => {}; component.register(stop);
        return { close: stop, actions: { mutate: unavailable, editTask: unavailable }, read: async () => ({ tasks: [], changed: true, availability: "unavailable", diagnostics: [{ code: "NATIVE_PROJECT_UNAVAILABLE" }] }), accept: stop, reconcile: unavailable, toggle: unavailable, clear: unavailable, reveal: unavailable, create: unavailable };
    };
    const nativeTasks = Object.freeze({ owner, consumerUiV1: true, mergeHome: consumers.mergeHome, taskKey: consumers.taskKey,
        createPanelRead(args) { return state === "ready" ? runtime.nativeTasks.createPanelRead(args) : failedPanel(args); } });
    const completionFeed = { async read(...args) { if (stopped || !feed) return unavailable(); return feed.read(...args); },
        subscribe(fn) { if (feed && !stopped) return feed.subscribe(fn); return () => {}; },
        async reveal(...args) { if (stopped || !feed) return unavailable(); return feed.reveal(...args); } };
    const host = {
        nativeTasks, completionFeed, matches, rejectLegacy, guardUnsupported,
        status: () => ({ mode: "native-project", state, owner: copy(owner) }),
        runtime: () => { if (stopped || state !== "ready") return unavailable(); return runtime; },
        create(options = {}) { const r = host.runtime(); return require("../ui/task-editor").openTaskCreator(r.formService(plugin.app), options); },
        async close() {
            if (closing) return closing; stopped = true; state = "closing";
            closing = (async () => { await ready; await runtime?.close(); for (const stop of stops.reverse()) stop(); registryListeners.clear(); historyListeners.clear(); state = "closed"; })();
            return closing;
        }
    };
    ready = (async () => {
        try {
            runtime = await openProjectRuntime(config, { owner, registry, writerPolicy: policy({ version: 1, owners: [{ owner, partitionId: options.partitionId }], commands: ["task.createRich", "task.save", "task.complete", "step.complete", "task.delete"], inventory: { version: 1, revision: "synthetic-empty", ids: [] }, phases: { version: 1, revision: "no-phases", values: [] } }),
                rehearsalId: options.rehearsalId, creating: options.creating === true, consumerUiV1: true, historyUiV1: true });
            if (!stopped) { feed = runtime.completionFeed({ legacy, app: plugin.app }); await runtime.list(); await feed.read(); state = "ready"; }
        } catch (_) { state = stopped ? "closing" : "unavailable"; await runtime?.close().catch(() => {}); }
    })();
    host.ready = ready; plugin.register(() => { void host.close().catch(error => console.error("Native task shutdown failed", error)); });
    return host;
}
module.exports = { authorizeNativeTaskRehearsal, createNativeTaskHost };
