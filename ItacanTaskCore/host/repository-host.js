"use strict";
const A = require("./authority"), G = require("./registry"), M = require("./monitor");
const J = require("../src/json-repository"), V = require("../src/value"), { freeze } = require("../src/snapshot-read");
const { RepositoryError, check } = require("../src/errors");
const contexts = new WeakMap();
const KNOWN = new Set(["VALIDATION", "UNSUPPORTED_SCHEMA", "STORAGE_PROFILE_MISMATCH", "STORAGE_AUTHORITY_MISMATCH", "STORAGE_PROFILE_REQUIRED", "RECOVERY_REQUIRED", "LOCK_HELD", "LOCK_LOST", "ROOT_IDENTITY_CHANGED", "REPOSITORY_CONFLICT", "SNAPSHOT_UNSTABLE", "ACKNOWLEDGEMENT_LOST", "ALREADY_EXISTS", "CLOSED", "IO_ERROR", "ENOENT", "REQUEST_RETENTION_REQUIRED"]);
function coded(error) { return KNOWN.has(error?.code) ? error.code : "HOST_EVIDENCE_UNAVAILABLE"; }
const safeError = code => new RepositoryError(code, "Inactive native host operation failed.");
const same = (a, b) => V.canonical(a) === V.canonical(b);
function createNativeRepositoryHost(input, options) { return constructHost(input, options, null); }
function createNativeWriterSession(input, options) {
    const make = require("../writer/repository-writer").createParticipant;
    return constructHost(input, options, make);
}
function constructHost(input, options, makeWriter) {
    let config;
    try { config = freeze(A.validateConfig(input)); check(options && options.registry && typeof options.registry.read === "function" && typeof options.registry.subscribe === "function", "Registry port required."); if (options.identity) check(typeof options.identity.read === "function" && typeof options.identity.subscribe === "function", "Identity port required."); }
    catch (_) { throw safeError("HOST_CONTRACT"); }
    options = Object.freeze({ ...options, repositoryOptions: Object.freeze({ ...options.repositoryOptions }) });
    let phase = "configured", repo = null, opening = null, closing = null, disposed = false, epoch = 0, generation = 0, readNumber = 0, monitorHealthy = false;
    let stops = [], listeners = new Set(), lastContext = null, retained = null;
    check(!options.requestRetention || !!makeWriter, "Retention requires a writer host.");
    check(config.scope !== "device-private-project" || !makeWriter || !!options.requestRetention, "Permanent writer requires retained requests.");
    if (options.requestRetention) {
        V.jsonValue(options.requestRetention); V.fields(options.requestRetention, ["version", "rehearsalId"], ["version", "rehearsalId"]);
        check(options.requestRetention.version === 1, "Unsupported retention version."); V.uuid(options.requestRetention.rehearsalId);
    }
    let last = { version: 1, privacy: "local-private", phase, authorityId: config.authorityId, storeId: null, applicationContextId: config.applicationContextId, storageFormat: "private-v4", wireVersion: 4, logicalSchemaVersion: null, namespaces: null, head: null, hostEpoch: epoch, generation, ownerContextPin: null, identityPin: null, readiness: { state: "not-ready", reason: "HOST_CONFIGURED" }, permissions: { taskReads: "unavailable", completionProof: "unavailable", mutations: "unsupported", history: "unsupported" } };
    const participant = makeWriter ? makeWriter(config, options, { info: () => info(), observe, execute: (command, ticket) => repo.execute(command, ticket), refresh: () => host.refresh(), retention: () => retained }) : null;
    function info() { return freeze(V.clone({ ...last, phase, hostEpoch: epoch, generation })); }
    function notify(reason, discontinuity = false) { if (discontinuity && reason !== "closing") participant?.invalidate(); if (discontinuity) epoch++; generation++; const change = freeze({ version: 1, kind: "snapshot-invalidated", durability: "ephemeral", hostEpoch: epoch, generation, reason }); for (const listener of [...listeners]) { try { Promise.resolve(listener(change)).catch(() => {}); } catch (_) {} } }
    function unavailable(code, state = "unavailable") { last = { ...last, readiness: { state, reason: code }, permissions: { taskReads: "unavailable", completionProof: "unavailable", mutations: "unsupported", history: "unsupported" } }; notify("unavailable", true); }
    function failure(code, state = "unavailable") { return freeze({ version: 1, state, code, retry: ["LOCK_LOST", "ROOT_IDENTITY_CHANGED", "REPOSITORY_CONFLICT", "RECOVERY_REQUIRED"].includes(code) ? "explicit-reopen" : state === "unsupported" ? "review" : "refresh" }); }
    async function observe(signal) { const registry = G.validateRegistry(await options.registry.read(signal), config); if (config.scope === "device-private-project") check(registry.owners.length === 1 && same(registry.owners[0].owner, require("./private-authority").bindingOwner(config.binding)) && registry.owners[0].partitionId === "private" && !registry.owners[0].shared, "Permanent owner scope differs."); const identity = options.identity ? await options.identity.read(signal) : null; return { registry, ownerContextPin: registry.digest, identity: identity === null ? null : V.clone(identity), identityPin: G.identityPin(identity) }; }
    function stopOwned() { for (const stop of stops.splice(0)) { try { stop(); } catch (_) {} } monitorHealthy = false; }
    function startOwned() {
        function own(stop) { check(typeof stop === "function", "Provider unsubscribe required."); stops.push(stop); }
        own(repo.subscribe(() => notify("repository")));
        own(options.registry.subscribe(() => { lastContext = null; unavailable("OWNER_CONTEXT_INVALIDATED"); }));
        if (options.identity) own(options.identity.subscribe(() => { lastContext = null; unavailable("IDENTITY_CONTEXT_INVALIDATED"); }));
        stops.push(M.monitorRoot(config.directory, () => notify("storage"), () => { monitorHealthy = false; unavailable("STORAGE_MONITOR_UNAVAILABLE"); })); monitorHealthy = true;
    }
    async function capture(request, signal, scoped = false) {
        if (disposed || phase !== "open") return { failure: failure(phase === "disposed" ? "HOST_DISPOSED" : "HOST_NOT_OPEN") };
        // One logical editor request retains its first observed context even if
        // repository instability requires another capture. A new request may
        // acquire new pins; an in-flight editor request may not rebase itself.
        let editorContext = null;
        function editorMismatch(observation) {
            if (!editorContext) return null;
            return observation.ownerContextPin !== editorContext.ownerContextPin ? "OWNER_CONTEXT_MISMATCH" : observation.identityPin !== editorContext.identityPin ? "IDENTITY_CONTEXT_MISMATCH" : null;
        }
        for (let attempt = 0; attempt < 3; attempt++) {
            const acceptedEpoch = epoch, acceptedGeneration = generation;
            try {
                if (signal?.aborted) return { failure: failure("READ_CANCELLED") };
                if (!monitorHealthy) { stopOwned(); startOwned(); }
                const before = await observe(signal);
                if (request.ownerContextPin !== undefined && request.ownerContextPin !== before.ownerContextPin) return { failure: failure("OWNER_CONTEXT_MISMATCH") };
                if ((scoped || request.selection === "operation") && request.identityPin !== undefined && request.identityPin !== before.identityPin) return { failure: failure("IDENTITY_CONTEXT_MISMATCH") };
                if (scoped && request.selection === "editor" || request.selection === "operation" || request.selection === "history") {
                    const mismatch = editorMismatch(before);
                    if (mismatch) return { failure: failure(mismatch) };
                    editorContext ??= { ownerContextPin: before.ownerContextPin, identityPin: before.identityPin };
                }
                const owners = request.owners ?? before.registry.owners.map(o => o.owner);
                // The former status preflight admitted every registered owner, even
                // when the following data read selected only one physical partition.
                for (const owner of scoped ? [...before.registry.owners.map(o => o.owner), ...owners] : owners) check(before.registry.owners.some(o => same(o.owner, owner) && o.available && o.dashboard !== null), "Owner unavailable.");
                const core = { version: request.selection === "history" ? 4 : request.selection === "operation" ? 3 : request.proofVersion ?? 1, authorityId: config.authorityId, owners, selection: request.selection, ...(request.selection === "operation" ? { operationId: request.operationId, commandDigest: request.commandDigest } : {}), ...(request.targets !== undefined ? { targets: request.targets } : {}), ...(request.includeArchived !== undefined ? { includeArchived: request.includeArchived } : {}), ...(request.includeDeleted !== undefined ? { includeDeleted: request.includeDeleted } : {}), ...(request.includeConsumerFacts !== undefined ? { includeConsumerFacts: request.includeConsumerFacts } : {}), ...(request.cut !== undefined ? { cut: request.cut } : {}) };
                // These are internal headers only, never cached task data. The queued
                // read still loads and validates the complete authoritative generation.
                const header = scoped ? repo.info() : null;
                const snapshot = await repo.readSnapshot(core), after = await observe(signal);
                if (disposed || phase !== "open" || signal?.aborted) return { failure: failure("READ_CANCELLED") };
                const mismatch = editorMismatch(after);
                if (mismatch) return { failure: failure(mismatch) };
                if (epoch !== acceptedEpoch || generation !== acceptedGeneration || before.ownerContextPin !== after.ownerContextPin || before.identityPin !== after.identityPin) continue;
                if (scoped) {
                    const finalHeader = repo.info();
                    const matchesHead = h => h.storeId === snapshot.authorityId && h.storeId === snapshot.head.authorityId && h.revision === snapshot.head.repositoryRevision && h.revisionId === snapshot.head.revisionId && h.schemaVersion === snapshot.logicalSchemaVersion;
                    if (!matchesHead(header) || !matchesHead(finalHeader) || !same(header.partitions, finalHeader.partitions)) continue;
                    // Complete partition inventory from that exact validated head:
                    // retain status coverage without disclosing unrelated partitions.
                    for (const p of header.partitions) check(before.registry.owners.some(o => same(o.owner, p.owner) && o.partitionId === p.id), "Owner partition mismatch.");
                    for (const p of snapshot.partitions) check(header.partitions.some(h => h.id === p.id && same(h.owner, p.owner) && h.revision === p.revision && h.head === p.head), "Partition header mismatch.");
                }
                for (const p of snapshot.partitions) check(before.registry.owners.some(o => same(o.owner, p.owner) && o.partitionId === p.id), "Owner partition mismatch.");
                for (const t of [...snapshot.tasks, ...snapshot.targets.map(t => t.task).filter(Boolean), ...(snapshot.editor?.state === "available" ? [{ ...snapshot.editor, location: snapshot.editor.draft.metadata.location }] : [])]) { const owner = before.registry.owners.find(o => same(o.owner, t.owner)); check(owner && owner.partitionId === t.partitionId, "Task partition mismatch."); if (t.location) check(owner.locations.some(l => same(l, t.location)), "Location evidence unavailable."); }
                const stamp = { version: 1, hostEpoch: epoch, readGeneration: ++readNumber, head: snapshot.head, ownerContextPin: before.ownerContextPin, identityPin: before.identityPin };
                lastContext = before;
                last = { ...last, storeId: snapshot.authorityId, logicalSchemaVersion: snapshot.logicalSchemaVersion, namespaces: snapshot.namespaces, storage: snapshot.storage, head: snapshot.head, ownerContextPin: before.ownerContextPin, identityPin: before.identityPin, readiness: snapshot.readiness, permissions: { taskReads: snapshot.readiness.state === "ready" ? "available" : "recovered-observation", completionProof: snapshot.readiness.state === "ready" ? "available" : "unavailable", mutations: "unsupported", history: "unsupported" } };
                return { value: freeze(scoped ? { version: 2, kind: "scoped-capture", status: "ok", info: info(), stamp, snapshot } : { version: 1, status: "ok", stamp, snapshot }), context: before };
            } catch (error) {
                const code = coded(error); if (code === "SNAPSHOT_UNSTABLE") continue;
                const state = code === "UNSUPPORTED_SCHEMA" ? "unsupported" : "unavailable"; unavailable(code, state); return { failure: failure(code, state) };
            }
        }
        last = { ...last, readiness: { state: "recovering", reason: "SNAPSHOT_UNSTABLE" }, permissions: { taskReads: "unavailable", completionProof: "unavailable", mutations: "unsupported", history: "unsupported" } }; return { failure: failure("SNAPSHOT_UNSTABLE", "recovering") };
    }
    async function start(creating, args) {
        if (disposed || phase === "disposed") throw safeError("HOST_DISPOSED");
        if (phase === "closing") throw safeError("HOST_CLOSING");
        try { const authorization = config.scope === "device-private-project" ? "verifiedCutover" : "syntheticOnly"; const keys = creating ? ["version", "authorityId", "partitions", "reason", authorization, ...(args.version === 2 ? ["taskMutationVersion"] : [])] : ["version", "expectedAuthorityId", authorization]; V.fields(args, keys, keys); check((args.version === 1 || creating && args.version === 2 && args.taskMutationVersion === 1) && args[authorization] === true && (creating ? args.authorityId : args.expectedAuthorityId) === config.authorityId, "Explicit authority required."); if (creating) V.text(args.reason); } catch (_) { throw safeError("HOST_CONTRACT"); }
        if (opening) { if (creating) throw safeError("HOST_OPENING"); return opening; }
        if (phase === "open") { if (creating) throw safeError("ALREADY_EXISTS"); return host.refresh(); }
        const detached = V.clone(args); phase = "opening"; last.readiness = { state: "not-ready", reason: "HOST_OPENING" }; notify("reopened", true);
        opening = (async () => {
            try {
                if (config.scope === "device-private-project") { await observe(); if (creating) check(detached.version === 2 && detached.taskMutationVersion === 1 && detached.partitions.length === 1 && detached.partitions[0].id === "private" && detached.partitions[0].kind === require("./private-authority").bindingKind(config.binding) && same(detached.partitions[0].owner, require("./private-authority").bindingOwner(config.binding)), "Permanent partition scope differs."); }
                const port = await A.admit(config, creating), settings = { ...(options.repositoryOptions ?? {}), directory: config.directory, storageFormat: "private-v4", storagePort: port, taskMutationVersion: creating && detached.version === 2 ? 1 : undefined, commandAdmission: participant?.gate, ...(participant ? { externalReservations: participant.inventory, resolvers: participant.resolvers } : {}) };
                if (makeWriter && !options.requestRetention && (await port.list()).some(n => n.startsWith("REQUEST-"))) throw safeError("REQUEST_RETENTION_REQUIRED");
                // Port/root/profile cannot be overridden by repository options.
                participant?.start(creating);
                repo = creating ? await J.createJsonRepository({ ...settings, storeId: config.authorityId, expectedAuthorityId: config.authorityId, partitions: detached.partitions }) : await J.openJsonRepository({ ...settings, expectedAuthorityId: config.authorityId });
                if (makeWriter && !options.requestRetention && (await port.list()).some(n => n.startsWith("REQUEST-"))) throw safeError("REQUEST_RETENTION_REQUIRED");
                if (options.requestRetention) {
                    retained = require("./pending-requests").createPendingRequests(port, config, options.requestRetention, async record => {
                        // A Resource's location inventory may legitimately change
                        // between sessions. Its immutable command/guards remain
                        // unchanged; only receipt inspection may use the current
                        // validated physical Resource binding. Inactive/unbound
                        // contexts retain the original strict pin contract.
                        let ownerContextPin = record?.writerRequest.scope.ownerContextPin;
                        const binding = config.binding;
                        if (record && config.scope === "device-private-project" && binding?.version === 2 && binding.owner.type === "resource") {
                            const current = await observe(), entry = current.registry.owners.find(o => same(o.owner, binding.owner));
                            check(same(record.owner, binding.owner) && record.partitionId === "private" && entry?.available && !entry.shared && entry.partitionId === "private" && entry.root === binding.ownerRoot && entry.dashboard === binding.dashboard, "Bound Resource receipt context differs.");
                            ownerContextPin = current.ownerContextPin;
                        }
                        const result = record ? await host.readOperation({ version: 3, authorityId: config.authorityId, selection: "operation", owners: [record.owner],
                            operationId: record.operationId, commandDigest: record.commandDigest,
                            ownerContextPin, identityPin: record.writerRequest.scope.identityPin }) : (await capture({ selection: "status" }, undefined, true)).value;
                        return { operation: result?.status === "ok" && record ? result.snapshot.operation : { state: "unavailable", code: result?.code ?? "AUTHORITY_UNAVAILABLE", operationId: record?.operationId ?? null, receipt: null, taskIds: [], eventIds: [] },
                            stamp: result?.status === "ok" ? result.stamp : null, partitions: result?.status === "ok" ? result.snapshot.partitions : [],
                            ready: result?.status === "ok" && result.snapshot.readiness.state === "ready" && result.snapshot.recovery.state === "intact",
                            taskMutationVersion: result?.snapshot?.storage?.taskMutationVersion ?? null };
                    });
                    await retained.start(creating);
                }
                if (phase === "closing" || disposed) return info();
                phase = "open"; startOwned(); await host.refresh(); return info();
            } catch (error) {
                stopOwned(); unavailable(coded(error), error.code === "UNSUPPORTED_SCHEMA" ? "unsupported" : "unavailable");
                if (repo) { try { await repo.close(); repo = null; } catch (_) { phase = "closing"; } }
                if (phase !== "closing") phase = "closed"; throw safeError(coded(error));
            } finally { participant?.finish(); opening = null; }
        })(); return opening;
    }
    const host = {
        info,
        create: args => start(true, args), open: args => start(false, args),
        async refresh() { const result = await capture({ selection: "status" }); if (result.failure) last.readiness = { state: result.failure.state, reason: result.failure.code }; return info(); },
        async read(request, signal) {
            try { V.jsonValue(request); V.fields(request, ["version", "authorityId", "ownerContextPin", "selection", "owners", "targets", "includeArchived", "includeDeleted", "cut"], ["version", "authorityId", "ownerContextPin", "selection"]); check(request.version === 1 && request.authorityId === config.authorityId, "Host read scope required."); V.text(request.ownerContextPin); }
            catch (_) { throw safeError("HOST_CONTRACT"); }
            const result = await capture(V.clone(request), signal); return result.failure ?? result.value;
        },
        async readScoped(request, signal) {
            let detached;
            try {
                V.jsonValue(request); V.fields(request, ["version", "authorityId", "ownerContextPin", "identityPin", "selection", "owners", "targets", "includeArchived", "includeDeleted", "includeConsumerFacts"], ["version", "authorityId", "selection", "owners"]);
                check(request.version === 2 && request.authorityId === config.authorityId && ["tasks", "editor"].includes(request.selection), "Scoped capture contract required.");
                if (request.ownerContextPin !== undefined) V.text(request.ownerContextPin);
                if (request.identityPin !== undefined && request.identityPin !== null) V.text(request.identityPin);
                const { ownerContextPin, identityPin, ...core } = request;
                require("../src/snapshot-read").validateRequest({ ...core, version: 1 });
                detached = V.clone(request);
            } catch (_) { throw safeError("HOST_CONTRACT"); }
            const result = await capture(detached, signal, true);
            return result.failure ? freeze({ ...result.failure, version: 2, kind: "scoped-capture" }) : result.value;
        },
        async readHistory(request, signal) {
            try { require("../src/history-read").validateRequest(request); check(request.authorityId === config.authorityId, "History authority differs."); }
            catch (_) { throw safeError("HOST_CONTRACT"); }
            const result = await capture(V.clone(request), signal, true);
            return result.failure ?? freeze({ version: 4, status: "ok", stamp: result.value.stamp, snapshot: result.value.snapshot });
        },
        async readOperation(request, signal) {
            try {
                V.jsonValue(request); V.fields(request, ["version", "authorityId", "selection", "owners", "operationId", "commandDigest", "ownerContextPin", "identityPin"], ["version", "authorityId", "selection", "owners", "operationId", "commandDigest", "ownerContextPin", "identityPin"]);
                const { ownerContextPin, identityPin, ...core } = request;
                V.text(ownerContextPin); if (identityPin !== null) V.text(identityPin);
                require("../src/snapshot-read").validateRequest(core); check(core.version === 3 && core.authorityId === config.authorityId, "Operation authority/version required.");
            } catch (_) { throw safeError("HOST_CONTRACT"); }
            const result = await capture(V.clone(request), signal);
            return result.failure ?? result.value;
        },
        subscribe(listener) { if (disposed || ["closing", "closed", "disposed"].includes(phase)) throw safeError("HOST_NOT_OPEN"); check(typeof listener === "function", "Listener required."); listeners.add(listener); try { Promise.resolve(listener(freeze({ version: 1, kind: "snapshot-invalidated", durability: "ephemeral", hostEpoch: epoch, generation, reason: "subscribed" }))).catch(() => {}); } catch (_) {} return () => listeners.delete(listener); },
        close() {
            if (closing) return closing;
            if (["closed", "disposed"].includes(phase) && !repo) return Promise.resolve();
            participant?.closing(); retained?.stop(); phase = "closing"; last.readiness = { state: "unavailable", reason: "HOST_CLOSING" }; last.permissions = { taskReads: "unavailable", completionProof: "unavailable", mutations: "unsupported", history: "unsupported" }; notify("closing", true); stopOwned(); listeners.clear(); lastContext = null;
            closing = (async () => { if (opening) { try { await opening; } catch (_) {} } await retained?.drain(); if (repo) await repo.close(); repo = null; retained = null; phase = disposed ? "disposed" : "closed"; last = { ...last, head: null, ownerContextPin: null, identityPin: null, readiness: { state: "unavailable", reason: disposed ? "HOST_DISPOSED" : "HOST_CLOSED" }, permissions: { taskReads: "unavailable", completionProof: "unavailable", mutations: "unsupported", history: "unsupported" } }; })().finally(() => { closing = null; }); return closing;
        },
        async dispose() { disposed = true; await host.close(); phase = "disposed"; }
    };
    contexts.set(host, { capture, context: () => lastContext, config }); Object.freeze(host); return participant ? participant.session(host) : host;
}
module.exports = { createNativeRepositoryHost, createNativeWriterSession, contexts, safeError, coded };
