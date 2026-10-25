"use strict";
// Legacy by default; real admission requires the external verified owner cutover.
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
    if (Array.isArray(input)) {
        if (!input.length) throw Error("Explicit synthetic owners required.");
        const checked = [];
        for (const value of input) { const token = { ...plugin }; await authorizeNativeTaskRehearsal(token, value); checked.push(approvals.get(token)); approvals.delete(token); }
        if (new Set(checked.map(o => JSON.stringify(o.owner))).size !== checked.length || new Set(checked.map(o => o.config.authorityId)).size !== checked.length || new Set(checked.map(o => o.config.directory)).size !== checked.length) throw Error("Distinct native owners and authorities required.");
        approvals.set(plugin, checked); return;
    }
    const options = copy(input), vault = await ordinary(plugin.app.vault.adapter.getBasePath()), temp = await fs.realpath(os.tmpdir());
    const root = await ordinary(options.root), native = await ordinary(options.config.directory);
    if (options.version !== 1 || options.syntheticOnly !== true || !within(temp, root) || !within(root, vault) || !within(root, native) || native === vault || within(vault, native) || within(native, vault)) throw Error("Synthetic Temp vault and separate native root required.");
    for (const cloud of [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean)) if (within(path.resolve(cloud), root) || path.resolve(cloud) === root) throw Error("Cloud storage is not admitted.");
    if (!["project", "resource"].includes(options.owner?.type) || options.config.scope !== "inactive-disposable" || typeof options.projectRoot !== "string" || !options.projectRoot || typeof options.dashboard !== "string") throw Error("Explicit private synthetic Project required.");
    // No existing task source can become a second writable authority. This is
    // not a cutover permit and cannot retire or convert Markdown checkboxes.
    for (const file of plugin.app.vault.getMarkdownFiles()) if (file.path === options.projectRoot || file.path.startsWith(options.projectRoot + "/")) {
        if (/^\s*(?:[-*+]|\d+[.)])\s+\[[^\]]\]/m.test(await plugin.app.vault.read(file))) throw Error("Synthetic native Project must contain no Markdown tasks.");
    }
    const vaultStat = await fs.stat(vault, { bigint: true });
    approvals.set(plugin, { ...options, vaultPin: { real: vault, dev: String(vaultStat.dev), ino: String(vaultStat.ino) } });
}
async function authorizeNativeTaskActivation(plugin) {
    if (approvals.has(plugin)) return; // Synthetic approval cannot select permanent scope.
    const options = await require("./native-task-activation").loadActivations(plugin);
    if (options?.length) approvals.set(plugin, options);
}
function createOwnerHost(plugin, options, coordinated = false) {
    if (!options) return null; // No native imports, storage access or host in Legacy mode.
    const { openProjectRuntime } = require("../../../../../ItacanTaskCore/integration/project-runtime");
    const { registryDigest } = require("../../../../../ItacanTaskCore/host/registry");
    const { policy, hash } = require("../../../../../ItacanTaskCore/writer/policy");
    const consumers = require("../../../../../ItacanTaskCore/integration/home-schedule");
    const { owner } = options, stops = [], registryListeners = new Set(), historyListeners = new Set(), stateListeners = new Set(), feedListeners = new Map();
    let config = options.config, cancelReadiness = null;
    let locationSource;
    const taskLocations = () => locationSource ??= require("./native-task-locations").createNativeTaskLocations(plugin);
    let runtime = null, feed = null, synchronization = null, stopped = false, closing = null, state = "opening", ready;
    const matches = ref => ref?.type === owner.type && ref.id === owner.id;
    const workspaceRef = require("./task-service-legacy-values").workspaceRef;
    const workspaceId = owner.type === "resource" ? "resource:" + owner.id : owner.id;
    const project = () => (owner.type === "resource" ? plugin.projectWizard.getResourceById(owner.id) : plugin.projectWizard.getProjectById(owner.id));
    const ownsPath = value => typeof value === "string" && (value === options.projectRoot || value.startsWith(options.projectRoot + "/"));
    const unavailable = () => { throw Error("Native task operation is unavailable. Markdown fallback is disabled."); };
    const changedState = () => { for (const fn of [...stateListeners]) { try { Promise.resolve(fn()).catch(() => {}); } catch (_) {} } };
    function waitFor(register) {
        return new Promise(resolve => {
            let done = false, stop = () => {};
            const finish = () => { if (done) return; done = true; stop(); cancelReadiness = null; resolve(); };
            cancelReadiness = finish; stop = register(finish) ?? (() => {});
            if (done) stop(); else if (stopped) finish();
        });
    }
    async function waitForMetadata() {
        const workspace = plugin.app.workspace;
        if (workspace?.onLayoutReady && !workspace.layoutReady) await waitFor(done => { workspace.onLayoutReady(done); });
        if (stopped) return;
        const cache = plugin.app.metadataCache, file = plugin.app.vault.getAbstractFileByPath?.(options.dashboard);
        if (file && cache?.getFileCache && !cache.getFileCache(file)) await waitFor(done => {
            const refs = [cache.on("changed", changed => { if (changed.path === file.path) done(); }), cache.on("resolved", done)];
            if (cache.getFileCache(file)) done();
            return () => refs.forEach(ref => cache.offref(ref));
        });
    }
    const rejectLegacy = value => {
        const ref = value?.nativeReference?.owner ?? value?.owner ?? value;
        const context = typeof value === "string" ? plugin.projectWizard.getContextForPath(value) : null;
        if (matches(ref) || matches(workspaceRef(context)) || matches(workspaceRef(value)) || ownsPath(typeof value === "string" ? value : value?.path)) unavailable();
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
    wrap(plugin.planning, "project", id => { if (owner.type === "project" && id === owner.id) unavailable(); });
    const originalRead = plugin.taskData.readPages;
    const readPages = function (...args) {
        // Resolve physical ownership once per owner/query, never per Markdown page.
        // Resource mounts do not create another physical task owner.
        const current = project(), root = matches(workspaceRef(current)) ? current.root : null;
        return originalRead.apply(this, args).filter(page => {
            const file = page.file?.path;
            return !ownsPath(file) && !(typeof root === "string" && typeof file === "string" && (file === root || file.startsWith(root + "/")));
        });
    };
    plugin.taskData.readPages = readPages;
    stops.push(() => { if (plugin.taskData.readPages === readPages) plugin.taskData.readPages = originalRead; });
    // Unsupported domain entry points are guarded before their queues/saves.
    const guardUnsupported = () => {
        wrap(plugin.inbox, "makeTask", (values, captureId) => {
            const capture = captureId ? plugin.inbox.required(captureId) : null;
            const candidates = [values, capture?.intent, capture?.operation];
            for (const c of candidates) if (c && (c.workspaceId === workspaceId || matches(c.workspace) || ownsPath(c.location))) unavailable();
        });
        wrap(plugin.inbox, "taskDestination", values => { if (values.workspaceId === workspaceId || matches(values.workspace) || ownsPath(values.location)) unavailable(); });
        const locations = plugin.inbox.taskLocations;
        const taskLocations = function (id) { return id === workspaceId ? [] : locations.call(this, id); };
        plugin.inbox.taskLocations = taskLocations;
        stops.push(() => { if (plugin.inbox.taskLocations === taskLocations) plugin.inbox.taskLocations = locations; });
        wrap(plugin.oath, "take", draft => { if (matches(draft.workspace)) unavailable(); });
        const resolve = plugin.oath.resolveWorkspace;
        const resolveWorkspace = function (ref, ...args) { return matches(ref) ? null : resolve.call(this, ref, ...args); };
        plugin.oath.resolveWorkspace = resolveWorkspace;
        stops.push(() => { if (plugin.oath.resolveWorkspace === resolveWorkspace) plugin.oath.resolveWorkspace = resolve; });
        const workspaces = plugin.oath.workspaces;
        const oathWorkspaces = function (...args) { return workspaces.apply(this, args).filter(p => !matches(workspaceRef(p))); };
        plugin.oath.workspaces = oathWorkspaces;
        stops.push(() => { if (plugin.oath.workspaces === oathWorkspaces) plugin.oath.workspaces = workspaces; });
    };
    function changed() { for (const fn of [...registryListeners]) fn(); }
    for (const event of ["create", "delete", "rename", "modify"]) {
        const ref = plugin.app.vault.on(event, changed); stops.push(() => plugin.app.vault.offref(ref));
    }
    const registry = {
        async read() {
            await options.assertActivation?.();
            const vault = await ordinary(plugin.app.vault.adapter.getBasePath()), stat = await fs.stat(vault, { bigint: true });
            if (vault !== options.vaultPin.real || String(stat.dev) !== options.vaultPin.dev || String(stat.ino) !== options.vaultPin.ino) throw Error("Native application context changed.");
            const p = project(), shared = !!p?.shared || require("./shared-projects").SHARED_PROJECT_ROOTS.includes(p?.root);
            const candidates = owner.type === "resource" ? plugin.projectWizard.getResourceTypes().filter(p => p.resourceType === owner.id) : plugin.projectWizard.getProjectRecords().filter(p => p.projectId === owner.id), physical = plugin.projectWizard.getContextForPath(options.dashboard);
            const available = candidates.length === 1 && matches(workspaceRef(physical)) && matches(workspaceRef(p)) && p.root === options.projectRoot && p.path === options.dashboard && (owner.type === "resource" || ["active", "future", "shelved"].includes(p.status)) && shared === !!options.gitSharing;
            const locations = taskLocations().catalog(owner);
            const body = { version: 1, registryId: config.registryId, applicationContextId: config.applicationContextId, revision: JSON.stringify([p?.projectId ?? null, p?.root ?? null, p?.path ?? null, p?.status ?? null, shared]),
                owners: [{ owner, partitionId: options.partitionId, root: options.projectRoot, dashboard: options.dashboard, status: p?.status ?? "active", available, shared, shareApproval: options.gitSharing ? {version:1,projectId:owner.id,root:options.projectRoot,reviewDigest:config.binding?.namespaceDigest ?? options.namespaceDigest} : null, locations, mounts: [] }] };
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
        return { close: stop, actions: { mutate: unavailable, editTask: unavailable }, read: async () => ({ tasks: [], changed: true, availability: state === "opening" ? "loading" : "unavailable", diagnostics: [{ code: state === "opening" ? "NATIVE_PROJECT_INITIALIZING" : "NATIVE_PROJECT_UNAVAILABLE" }] }), accept: stop, reconcile: unavailable, toggle: unavailable, clear: unavailable, reveal: unavailable, create: unavailable };
    };
    const nativeTasks = Object.freeze({ owner, consumerUiV1: true, availability: () => state === "ready" ? "current" : state === "opening" ? "loading" : "unavailable", mergeHome: consumers.mergeHome, taskKey: consumers.taskKey,
        createPanelRead(args) {
            let inner = null, closed = false;
            // The core subscription emits immediately. Defer its UI callback
            // until the delegate is assigned, so a refresh cannot reenter its
            // construction and create duplicate subscriptions.
            let queued = false;
            const refresh = () => { if (queued || closed) return; queued = true; queueMicrotask(() => { queued = false; if (!closed && !stopped) args.changed?.(); }); };
            const current = () => { if (closed || stopped || state !== "ready") return null; return inner ??= runtime.nativeTasks.createPanelRead({ ...args, changed: refresh }); };
            const changed = () => args.changed?.(); stateListeners.add(changed);
            const close = () => { if (closed) return; closed = true; stateListeners.delete(changed); inner?.close(); };
            args.component.register(close);
            const call = (name, ...values) => { const panel = current(); if (!panel) return unavailable(); return panel[name](...values); };
            return { close, read: () => current()?.read() ?? failedPanel({ component: { register() {} } }).read(),
                accept: tasks => current()?.accept(tasks), reconcile: (...a) => call("reconcile", ...a), toggle: (...a) => call("toggle", ...a),
                clear: (...a) => call("clear", ...a), reveal: (...a) => call("reveal", ...a), create: (...a) => call("create", ...a),
                actions: { mutate: (...a) => { const p = current(); return p ? p.actions.mutate(...a) : unavailable(); }, editTask: (...a) => { const p = current(); return p ? p.actions.editTask(...a) : unavailable(); } } };
        } });
    const completionFeed = { async read(...args) { if (stopped || !feed) return unavailable(); return feed.read(...args); },
        subscribe(fn) { if (stopped) return () => {}; const token = {}; feedListeners.set(token, { fn, stop: feed?.subscribe(fn) }); return () => { feedListeners.get(token)?.stop?.(); feedListeners.delete(token); }; },
        async reveal(...args) { if (stopped || !feed) return unavailable(); return feed.reveal(...args); } };
    let released = false;
    const release = () => { if (released) return; released = true; for (const stop of stops.reverse()) stop(); for (const l of feedListeners.values()) l.stop?.(); feedListeners.clear(); registryListeners.clear(); historyListeners.clear(); stateListeners.clear(); };
    const host = {
        nativeTasks, completionFeed, matches, rejectLegacy, guardUnsupported, release,
        owner, historyEvidence: { read: () => host.runtime().historyEvidence.read(), subscribe(fn) { let stop = null; const bind = () => { if (!stop && state === "ready") stop = runtime.historyEvidence.subscribe(fn); fn({ reason: "registry" }); }; stateListeners.add(bind); if (state === "ready") stop = runtime.historyEvidence.subscribe(fn); return () => { stateListeners.delete(bind); stop?.(); }; } },
        status: () => ({ mode: "native-project", state, owner: copy(owner), ...(synchronization ? {sharing:synchronization.status()} : {}) }),
        synchronization: () => synchronization,
        runtime: () => { if (stopped || state !== "ready") return unavailable(); return runtime; },
        create(options = {}) { const r = host.runtime(); return require("../ui/task-editor").openTaskCreator(require("./native-task-locations").locationService(r.formService(plugin.app), plugin, owner), options); },
        async close() {
            if (closing) return closing; stopped = true; state = "closing"; cancelReadiness?.(); changedState();
            closing = (async () => { await ready; await synchronization?.close(); await runtime?.close(); if (!coordinated) release(); state = "closed"; })();
            return closing;
        }
    };
    ready = (async () => {
        try {
            await waitForMetadata(); if (stopped) return;
            if (options.joinExisting) await require("./native-git-transition").join(plugin, owner);
            if (options.blocked || config.scope !== "inactive-disposable") {
                const admitted = (await require("./native-task-activation").loadActivations(plugin, owner)).find(p => matches(p.owner));
                if (!admitted || admitted.blocked || !matches(admitted.owner) || admitted.projectRoot !== options.projectRoot || admitted.dashboard !== options.dashboard ||
                    !options.blocked && JSON.stringify(admitted.config) !== JSON.stringify(config)) throw Error("Cutover requires explicit recovery review.");
                Object.assign(options, admitted, { blocked: false }); config = options.config;
            }
            if (stopped) return;
            if (options.blocked) throw Error("Cutover requires explicit recovery review.");
            let inventory={version:1,revision:"synthetic-empty",ids:[]},phases={version:1,revision:"no-phases",values:[]},inventoryEvidence;
            if(options.gitSharing){inventoryEvidence=require("./native-git-inventory").createInventoryEvidence(plugin,owner,config.authorityId);const observed=await inventoryEvidence.read();phases=observed.phases;inventory=require("../../../../../ItacanTaskCore/shared/inventory").capture(config.authorityId,observed.inventory,phases);}
            runtime = await openProjectRuntime(config, { owner, registry, writerPolicy: policy({version:1,owners:[{owner,partitionId:options.partitionId}],commands:["task.createRich","task.save","task.complete","step.complete","task.delete",...(options.gitSharing?["git.receive"]:[])],inventory,phases}),
                inventoryEvidence,gitSharing:options.gitSharing,sharedGenesis:options.sharedGenesis,
                locationLabel: ref => taskLocations().resolve(owner, ref)?.path ?? "Location unavailable", describeLocation: ref => taskLocations().describe(owner, ref), rehearsalId: options.rehearsalId, creating: options.creating === true, consumerUiV1: true, historyUiV1: true });
            if(options.gitSharing){
                const project=await require("../../../../../ItacanTaskCore/shared/project-binding").admitProject({vaultRoot:options.vaultPin.real,projectId:owner.id,projectRoot:options.projectRoot,dashboard:options.dashboard});
                const transport=await require("../../../../../ItacanTaskCore/shared/git-transport").createGitPacketTransport({version:1,root:project.gitRoot,authorityId:config.authorityId,projectId:owner.id});
                synchronization=require("../../../../../ItacanTaskCore/shared/runtime-sync").createRuntimeSync({runtime,transport,assertBinding:async()=>{await options.assertActivation?.();const current=await require("../../../../../ItacanTaskCore/shared/project-binding").admitProject({vaultRoot:options.vaultPin.real,projectId:owner.id,projectRoot:options.projectRoot,dashboard:options.dashboard});if(current.namespaceDigest!==project.namespaceDigest)throw Error("Shared namespace changed.");}});
                let syncing=null,dirty=false;const requestSync=()=>{if(stopped)return;dirty=true;if(syncing)return;syncing=(async()=>{while(dirty&&!stopped){dirty=false;await synchronization.sync().catch(()=>{});}})().finally(()=>{syncing=null;if(dirty&&!stopped)requestSync();});};
                stops.push(runtime.sharing.subscribe(change=>{if(change.reason==="repository")requestSync();}));
                // Startup publishes committed-but-unexported receipts and scans
                // incoming files. A failed scan stays visible for explicit retry.
                await synchronization.sync().catch(()=>{});
                const watch=require("node:fs").watch(path.join(project.gitRoot,".itacan-native/v3",config.authorityId,"heads"),(_event,name)=>{if(!name||String(name).endsWith(".json"))requestSync();});watch.on("error",()=>{});stops.push(()=>watch.close());
            }
            if (!stopped) { feed = runtime.completionFeed({ legacy, app: plugin.app }); await runtime.list(); await feed.read();
                if (!stopped) { for (const l of feedListeners.values()) l.stop = feed.subscribe(l.fn); state = "ready"; changedState(); for (const l of feedListeners.values()) { try { Promise.resolve(l.fn()).catch(() => {}); } catch (_) {} } }
            }
        } catch (error) { console.error("Native task owner unavailable", owner.id, error.code ?? "INITIALIZATION_FAILED", String(error.message).slice(0, 160)); state = stopped ? "closing" : "unavailable"; await synchronization?.close().catch(() => {}); await runtime?.close().catch(() => {}); changedState(); }
    })();
    // The shared helper registers one owning-window drain and Obsidian Tasks
    // callback; multi-owner composition installs it only once for all hosts.
    host.ready = ready;
    if (!coordinated) {
        plugin.register(() => { void host.close().catch(error => console.error("Native task shutdown failed", error)); });
        try { stops.push(require("./native-task-host-multi").registerNativeQuit(plugin, host)); }
        catch (error) { void host.close().catch(e => console.error("Native task shutdown failed", e)); throw error; }
    }
    return host;
}
function createNativeTaskHost(plugin) {
    const configured = approvals.get(plugin); approvals.delete(plugin);
    if (!configured || Array.isArray(configured) && !configured.length) return null;
    const options = Array.isArray(configured) ? configured : [configured];
    if (options.length === 1) return createOwnerHost(plugin, options[0]);
    return require("./native-task-host-multi").composeNativeHosts(plugin, options.map(o => createOwnerHost(plugin, o, true)));
}
module.exports = { authorizeNativeTaskRehearsal, authorizeNativeTaskActivation, createNativeTaskHost };
