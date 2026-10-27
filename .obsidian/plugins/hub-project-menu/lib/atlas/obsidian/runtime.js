"use strict";

const { randomUUID } = require("crypto");
const { increment } = require("./storage-diagnostics");
const Core = require("../core/index");
const { compileCuratedWhitelist, curatedWhitelist, serviceHostnames } = require("../presets/curated-whitelist");
const { initialApplication, buildDestinationChange, validateDestinations, mergeCuratedDestinations, replacementMatches, samePolicy } = require("./application");

// These are the copied D19 development values, disclosed during first setup.
// Once initialized, only snapshot.configuration governs operations.
const DEVELOPMENT_CONFIGURATION = Object.freeze({
    accessTiming: Object.freeze({ waitMs: 10_000, confirmationWindowMs: 60_000, grantDurationMs: 60_000 }),
    vaultTiming: Object.freeze({ waitMs: 30_000, confirmationWindowMs: 60_000 }),
    journeyLimits: Object.freeze({ lifetimeMs: 300_000, maxHops: 12 })
});
const blank = url => url === "about:blank" || url === "data:text/plain,";
function webTarget(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url) ? Core.normalizeTarget(url) : null;
}
function homeOrigin(url) {
    if (!webTarget(url)) return null;
    try { return new URL(url).origin + "/"; } catch (_) { return null; }
}
const { createPresentation, presentationKey, starter, freeze } = require("./presentation");
const blocked = reason => ({ type: "BLOCKED", reason });
/** @param {import('../core/index').AtlasControllerResponse} response
 * @returns {response is Extract<import('../core/index').AtlasControllerResponse, {type: 'ASSESSMENT'}>} */
const allowed = response => response?.type === "ASSESSMENT" && response.decision.outcome === "ALLOW";

/** @param {{repository: import('./persistence').AtlasFileRepository, clock: import('../core/index').AtlasClock, configuration?: import('../core/index').AtlasConfiguration, managedBlacklist?: () => import('../core/index').ManagedBlacklist | null}} options */
function createAtlasRuntime({ repository, clock, configuration = DEVELOPMENT_CONFIGURATION, managedBlacklist }) {
    const controller = Core.createAtlasController({ repository, clock, configuration,
        ownerId: randomUUID(), ...(managedBlacklist === undefined ? {} : { managedBlacklist }) });
    const contexts = new Map(), subscribers = new Set();
    let queue = Promise.resolve(), enabled = true, batchDepth = 0, pendingPublication = false, lastPublication = null;
    let epoch = 0, recoveryEpoch = -1, recoveryUsed = false, recovering = false, opening = 0;
    const recovery = { automaticAttempts: 0, automaticSucceeded: 0, automaticFailed: 0, manualAttempts: 0, manualSucceeded: 0, manualFailed: 0, status: "IDLE" };
    const describe = createPresentation(); let applicationVersion, cachedApplication;
    const presentationTime = () => { try { return clock.now(); } catch (_) { return NaN; } };
    const enqueue = work => {
        const task = queue.then(async () => { batchDepth++; epoch++; try { return await work(); }
            catch (_) { failAll("ADAPTER_FAILURE"); return blocked("ADAPTER_FAILURE"); }
            finally { batchDepth--; if (pendingPublication) { pendingPublication = false; publish(); } } });
        queue = task.then(() => undefined, () => undefined); return task;
    };
    const snapshot = () => controller.getView().snapshot;
    const journey = context => snapshot()?.journeyState.journeys.find(j => j.contextId === context.id && j.phase !== "ENDED");
    const binding = (context, continuation) => ({ contextId: context.id, journeyId: journey(context)?.id ?? null,
        ...(continuation ? { continuation } : {}) });
    const valid = (context, generation) => enabled && contexts.get(context.id) === context && context.generation === generation && !context.closed;
    function publish() {
        if (batchDepth) { pendingPublication = true; return; }
        if (!subscribers.size) { lastPublication = null; return; }
        const key = presentationKey(view(), presentationTime());
        if (key === lastPublication) return;
        lastPublication = key;
        for (const callback of subscribers) { try { callback(); } catch (_) { subscribers.delete(callback); } }
    }
    function failContext(context, response, origin = context.origin) {
        context.generation++;
        context.flight = null; context.displayed = null; context.response = response;
        context.origin = origin;
        context.phase = "BLOCKED";
        // Closing a browser is an adapter effect; it never waits for persistence.
        try { context.effects.block(response); } catch (_) { context.phase = "ENFORCEMENT_FAILED"; }
        publish();
    }
    function failAll(reason) { for (const context of contexts.values()) failContext(context, blocked(reason)); }
    function storageView() { try { return repository.getDiagnostics?.() ?? null; } catch (_) { return null; } }
    async function recoverTransientStorage() {
        const state = controller.getView(), failure = storageView()?.lastFailure;
        if (!enabled || opening || recovering || recoveryUsed || state.status !== "UNAVAILABLE" || state.reason !== "WRITE_FAILED" ||
            state.pendingCommitId !== null || failure?.operation !== "COMMIT" || failure.outcome !== "NOT_WRITTEN" ||
            !["BUSY", "INTERRUPTED", "IO_ERROR"].includes(failure.cause)) return false;
        recoveryUsed = true; recovering = true; recoveryEpoch = epoch;
        recovery.automaticAttempts = increment(recovery.automaticAttempts); recovery.status = "ATTEMPTING";
        try {
            // A released/loading request cannot retain correlation through a
            // controller reload. Never replay its request, body or confirmation.
            for (const context of contexts.values()) {
                context.rootOrigin = null;
                if (context.flight) failContext(context, blocked("RECOVERY_REQUIRED"));
            }
            await controller.open(); // same owner, repository and clock floor
            if (controller.getView().status === "READY") {
                // Core ends old Journeys. Only fresh checks may retain a loaded
                // page; an intermediate without independent access is closed.
                for (const context of contexts.values()) if (context.displayed && !context.closed) await recheck(context);
            }
        } catch (_) { /* A recovery error cannot create authority. */ }
        finally { recovering = false; }
        const ready = controller.getView().status === "READY";
        recovery[ready ? "automaticSucceeded" : "automaticFailed"] = increment(recovery[ready ? "automaticSucceeded" : "automaticFailed"]);
        recovery.status = ready ? "RECOVERED" : "BLOCKED"; publish(); return ready;
    }
    async function core(operation) {
        let response = await controller.handle(operation), recovered = false, reassessed = false;
        if (response.type === "BLOCKED") {
            recovered = await recoverTransientStorage();
            // Repeat only a pure assessment/clock observation after verified
            // recovery. BEGIN, grants, proposals and confirmations never replay.
            if (recovered && ["CHECK_NAVIGATION", "OBSERVE_TIME"].includes(operation.kind)) {
                const context = operation.kind === "CHECK_NAVIGATION" ? contexts.get(operation.context.contextId) : null;
                reassessed = true; response = await controller.handle(context ? { ...operation, context: binding(context) } : operation);
            }
            if (response.type === "BLOCKED" && (reassessed || !recovered || controller.getView().status !== "READY")) failAll(response.reason);
        } else if (!recovering && !opening && recoveryEpoch !== epoch && controller.getView().status === "READY") {
            // A separate healthy operation establishes a new failure episode.
            recoveryUsed = false;
        }
        return response;
    }
    function attach(nativeId, effects) {
        const context = { id: randomUUID(), nativeId, effects, generation: 0, closed: false,
            phase: "BLANK", response: null, origin: null, flight: null, displayed: null, rootOrigin: null };
        contexts.set(context.id, context); publish(); return context;
    }
    async function open(manual = false) {
        opening++; if (manual) { recovery.manualAttempts = increment(recovery.manualAttempts); }
        try {
        enabled = true;
        // Recovery invalidates all browser provenance before Core closes old
        // Journey bindings. It never resumes an old held request/confirmation.
        for (const context of contexts.values()) failContext(context, blocked("RECOVERY_REQUIRED"));
        // Core.open is intentionally a no-op while READY. Explicit adapter
        // recovery must still reload authority and retire browser bindings.
        if (controller.getView().status === "READY") {
            await core({ kind: "OBSERVE_TIME" });
            if (controller.getView().status === "READY") {
                for (const active of snapshot().journeyState.journeys) {
                    if (active.phase !== "ENDED") await core({ kind: "CLOSE_JOURNEY_CONTEXT", journeyId: active.id, contextId: active.contextId });
                }
            }
        }
        const view = await controller.open();
        if (manual) { const ready = view.status === "READY"; recoveryUsed = !ready; recovery[ready ? "manualSucceeded" : "manualFailed"] = increment(recovery[ready ? "manualSucceeded" : "manualFailed"]); recovery.status = ready ? "RECOVERED" : "BLOCKED"; }
        publish(); return view;
        } finally { opening--; }
    }
    async function initialize(policy, terms = configuration) {
        if (controller.getView().status !== "UNINITIALIZED") return blocked("ALREADY_INITIALIZED");
        const initial = Core.validateAtlasSnapshot({ policy, policyRevision: 0, configuration: terms, configurationRevision: 0,
            accessState: Core.createAccessState(), vaultState: Core.createVaultState(), journeyState: Core.createJourneyState() });
        if (initial.ok === false) return { type: "REJECTED", reason: initial.reason };
        if (!await repository.initialize(initial.snapshot)) {
            await controller.open(); publish(); return blocked("INITIALIZATION_FAILED");
        }
        await controller.open(); publish(); return controller.getView();
    }
    function navigate(context, request, release, reject) {
        // Only the native guard calls this method. request carries native facts;
        // no UI message, URL query or website postMessage reaches this boundary.
        const generation = ++context.generation;
        context.phase = "CHECKING";
        const target = webTarget(request.url), origin = homeOrigin(request.url);
        return enqueue(async () => {
            const cancel = response => {
                try { reject(); } catch (_) { /* request may already be cancelled */ }
                if (valid(context, generation)) failContext(context, response, origin);
                return response;
            };
            if (!valid(context, generation)) return cancel(blocked("SUPERSEDED"));
            if (target === null) return cancel(blocked("INVALID_TARGET"));
            // Save only the sanitized browser destination before Core can close
            // all guests for unavailable authority. Recovery can then explain
            // and reassess this destination without retaining the held URL/body.
            context.origin = origin;
            let continuation;
            const active = journey(context), previous = context.flight;
            if (request.redirectedFrom && previous?.requestId === request.redirectedFrom && previous.released &&
                request.url === request.redirectTarget && active) {
                continuation = { kind: "HTTP_REDIRECT", sourceHostname: active.currentHostname };
            } else if (request.initiatorURL && context.displayed &&
                request.initiatorURL === context.displayed.url && request.initiatorIsMainFrame === true) {
                const source = webTarget(context.displayed.url);
                if (source && source.hostname === target.hostname && active?.currentHostname === source.hostname) {
                    continuation = { kind: "SAME_HOST", sourceHostname: source.hostname };
                } else if (source && context.displayed.response.decision.reason === "WHITELISTED" && source.hostname !== target.hostname) {
                    continuation = { kind: "ROOT_DEPARTURE", sourceHostname: source.hostname };
                } else if (source && request.method === "POST" && active?.phase === "IN_TRANSIT" && active.currentHostname === source.hostname) {
                    continuation = { kind: "FORM_POST", sourceHostname: source.hostname };
                }
            } else if (active && context.displayed && webTarget(context.displayed.url)?.hostname === target.hostname &&
                active.currentHostname === target.hostname) {
                // A reload of the physically loaded current intermediate remains
                // bounded; it cannot renew the attempt or attest another host.
                continuation = { kind: "SAME_HOST", sourceHostname: target.hostname };
            }
            let response = await core({ kind: "BEGIN_NAVIGATION", target, context: binding(context, continuation) });
            if (!allowed(response) || !valid(context, generation)) return cancel(response);
            const current = journey(context);
            if (current && target.hostname !== current.rootHostname) {
                response = await core({ kind: "RECORD_JOURNEY_NAVIGATION", target, context: binding(context, continuation) });
                if (!allowed(response) || !valid(context, generation)) return cancel(response);
            }
            const now = clock.now();
            const expiresAt = "expiresAt" in response.decision ? response.decision.expiresAt : undefined;
            if (controller.getView().status !== "READY" || !Number.isSafeInteger(now) ||
                (expiresAt !== undefined && now >= expiresAt)) {
                return cancel(blocked("REEVALUATION_REQUIRED"));
            }
            if (response.decision.reason === "WHITELISTED" && current?.rootHostname === target.hostname) context.rootOrigin = origin;
            if (continuation?.kind === "ROOT_DEPARTURE") context.rootOrigin = homeOrigin(context.displayed.url);
            const flight = { requestId: request.requestId, loaderId: request.loaderId, url: request.url,
                response, journeyId: current?.id ?? null, generation, released: false };
            context.flight = flight; context.response = response; context.origin = origin;
            // Queue ownership is retained until native continue has acknowledged.
            // No UI policy command can race between the last check and release.
            flight.released = true; // release issued; arrivals queue behind its acknowledgement
            try { await release(response); } catch (_) { return cancel(blocked("RELEASE_FAILED")); }
            if (!valid(context, generation)) return cancel(blocked("SUPERSEDED"));
            context.phase = "LOADING"; publish(); return response;
        });
    }
    function arrive(context, { url, loaderId }) {
        const captured = context.flight;
        // Capture before queuing: a next page action cannot discard actual root
        // completion by superseding UI publication while its save is pending.
        const matches = captured?.released && captured.url === url && captured.loaderId === loaderId;
        return enqueue(async () => {
            if (context.closed || !enabled) return blocked("CONTEXT_CLOSED");
            if (!matches) {
                if (blank(url)) { context.displayed = null; publish(); return { type: "BLANK" }; }
                failContext(context, blocked("UNCORRELATED_ARRIVAL")); return blocked("UNCORRELATED_ARRIVAL");
            }
            const active = journey(context);
            let response = captured.response;
            if (active && active.id === captured.journeyId) {
                response = await core({ kind: "RECORD_JOURNEY_NAVIGATION", target: webTarget(url),
                    context: binding(context, { kind: "ARRIVAL", sourceHostname: active.currentHostname }) });
            } else {
                response = await core({ kind: "CHECK_NAVIGATION", target: webTarget(url), context: binding(context) });
            }
            if (context.closed || !enabled) return blocked("CONTEXT_CLOSED");
            if (!allowed(response)) { if (context.flight === captured) failContext(context, response); return response; }
            if (context.flight !== captured) return response; // completion saved; newer request still held
            context.displayed = { url, loaderId, response };
            context.flight = null; context.response = response; context.origin = homeOrigin(url);
            context.phase = "DISPLAYED"; context.effects.lease(response); publish(); return response;
        });
    }
    async function recheck(context) {
        if (context.closed && context.phase !== "BLOCKED") return;
        const loaded = context.displayed, generation = context.generation;
        if (!loaded) {
            if (context.phase === "BLOCKED" && context.origin) {
                const origin = context.origin, response = await core({ kind: "CHECK_NAVIGATION", target: webTarget(origin), context: binding(context) });
                if (enabled && contexts.get(context.id) === context && context.generation === generation && context.phase === "BLOCKED" && context.origin === origin) context.response = response;
            }
            return;
        }
        // Pending navigation has an adopted cursor distinct from the old page.
        // Do not invent an old-page hop. Its saved lease may only veto retention.
        if (context.flight) {
            if (loaded.response.decision.expiresAt !== undefined && clock.now() >= loaded.response.decision.expiresAt) {
                failContext(context, blocked("AUTHORIZATION_EXPIRED"));
            }
            return;
        }
        const current = journey(context);
        const response = await core({ kind: "CHECK_NAVIGATION", target: webTarget(loaded.url),
            context: binding(context, current ? { kind: "RETAINED", sourceHostname: current.currentHostname } : undefined) });
        if (!valid(context, generation) || context.displayed !== loaded) return;
        if (!allowed(response)) failContext(context, response);
        else {
            context.response = response; loaded.response = response;
            context.effects.lease(response);
        }
    }
    async function observe() {
        if (!enabled) return;
        if (controller.getView().status !== "READY") { await recoverTransientStorage(); if (controller.getView().status !== "READY") { publish(); return; } }
        await core({ kind: "OBSERVE_TIME" });
        for (const context of contexts.values()) await recheck(context);
        publish();
    }
    function close(context) {
        context.closed = true; context.generation++; context.flight = null; context.displayed = null;
        return enqueue(async () => {
            const current = journey(context);
            if (current) await core({ kind: "CLOSE_JOURNEY_CONTEXT", journeyId: current.id, contextId: context.id });
            // Keep the blocked explanation for the renderer until it replaces
            // this dead guest. Closed contexts cannot execute or be selected anew.
            publish(); return { type: "CLOSED" };
        });
    }
    function retireDocument(context) {
        context.generation++; context.flight = null; context.displayed = null;
        context.response = null; context.origin = null; context.rootOrigin = null; context.phase = "BLANK";
        return enqueue(async () => {
            const current = journey(context);
            if (current) await core({ kind: "CLOSE_JOURNEY_CONTEXT", journeyId: current.id, contextId: context.id });
            publish(); return { type: "BLANK" };
        });
    }
    function view() {
        const state = controller.getView();
        if (applicationVersion !== state.storageVersion || cachedApplication === undefined) {
            cachedApplication = freeze(repository.application?.(state.storageVersion) ?? (state.snapshot ? initialApplication(state.snapshot.policy) : null));
            applicationVersion = state.storageVersion;
        }
        let managed; try { managed = managedBlacklist?.(); } catch (_) { managed = null; }
        const display = describe(state, cachedApplication, enabled, presentationTime(), managed, managedBlacklist !== undefined);
        return { ...state, enabled, application: cachedApplication, ...display, starter,
            initialConfiguration: state.snapshot ? null : configuration, repositoryIssue: repository.issue ?? null,
            storage: storageView(), recovery: { ...recovery },
            contexts: [...contexts.values()].map(context => ({ id: context.id, nativeId: context.nativeId,
                generation: context.generation, closed: context.closed, phase: context.phase,
                response: context.response, origin: context.origin, journey: snapshot()?.journeyState.journeys.find(j => j.contextId === context.id) ?? null })) };
    }
    async function command(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) return { type: "REJECTED", reason: "INVALID_OPERATION" };
        const kind = input.kind;
        if (kind === "SAVE_DISPLAY_DETAILS" && Object.keys(input).length === 7 &&
            ["destinationId", "label", "category", "pinned", "basePolicyRevision", "baseApplicationRevision"].every(key => Object.hasOwn(input, key))) {
            if (controller.getView().status !== "READY") return blocked("NOT_READY");
            const application = repository.application(), old = application.destinations.find(d => d.id === input.destinationId);
            if (!old || input.basePolicyRevision !== snapshot().policyRevision || input.baseApplicationRevision !== application.revision) return { type: "REJECTED", reason: "STALE_DRAFT" };
            if (application.pending) return { type: "REJECTED", reason: "PROPOSAL_PENDING" };
            const destinations = application.destinations.map(d => d === old ? { ...d, label: input.label, category: input.category, pinned: input.pinned } : d);
            if (!validateDestinations(destinations)) return { type: "REJECTED", reason: "INVALID_DESTINATION" };
            return savePresentation({ ...application, revision: application.revision + 1, destinations });
        }
        if (kind === "INITIALIZE_CURATED" && Object.keys(input).length === 2 && Object.hasOwn(input, "configuration")) {
            return initialize(compileCuratedWhitelist(), input.configuration);
        }
        if (kind === "IMPORT_CURATED" && Object.keys(input).length === 1) {
            if (controller.getView().status !== "READY") return blocked("NOT_READY");
            const candidatePolicy = { whitelist: [...new Set([...snapshot().policy.whitelist,
                ...compileCuratedWhitelist().whitelist])], blacklist: [...snapshot().policy.blacklist] };
            try { repository.stageApplication(mergeCuratedDestinations(repository.application(), candidatePolicy)); }
            catch (_) { repository.clearApplicationStage(); return { type: "REJECTED", reason: "CURATED_METADATA_CONFLICT" }; }
            try { return await command({ kind: "PROPOSE_POLICY", candidatePolicy }); }
            finally { repository.clearApplicationStage(); }
        }
        if (kind === "RECREATE_POLICY" && Object.keys(input).length === 2 && Object.hasOwn(input, "proposalId")) {
            if (controller.getView().status !== "READY") return blocked("NOT_READY");
            const pending = snapshot().vaultState.pendingProposal;
            if (!pending || pending.id !== input.proposalId) return { type: "REJECTED", reason: "STALE_PROPOSAL" };
            if (pending.basePolicyRevision !== snapshot().policyRevision ||
                pending.baseConfigurationRevision !== undefined && pending.baseConfigurationRevision !== snapshot().configurationRevision) return { type: "REJECTED", reason: "STALE_PROPOSAL" };
            if (clock.now() < pending.confirmBy) return { type: "REJECTED", reason: "PROPOSAL_NOT_EXPIRED" };
            // Core owns cancellation, new IDs, the full wait and confirmation.
            // Never replay a confirmation or apply any of these candidate values.
            let application = repository.application(), recovery = application.recovery;
            if (recovery && recovery.sourceProposalId !== pending.id && !replacementMatches(pending, recovery, application.pending?.destinations))
                return { type: "REJECTED", reason: "RECOVERY_DRAFT_PENDING" };
            if (!recovery || recovery.sourceProposalId !== pending.id) {
                recovery = { id: randomUUID(), sourceProposalId: pending.id,
                    operation: pending.candidateConfiguration && JSON.stringify(pending.candidateConfiguration) !== JSON.stringify(snapshot().configuration) ? "PROPOSE_SETTINGS" : "PROPOSE_POLICY",
                    basePolicyRevision: snapshot().policyRevision, baseConfigurationRevision: snapshot().configurationRevision,
                    baseApplicationRevision: application.revision, policy: structuredClone(pending.candidatePolicy),
                    configuration: structuredClone(pending.candidateConfiguration ?? snapshot().configuration),
                    destinations: application.pending?.destinations ?? null };
                // The only recoverable copy must be durable BEFORE cancellation.
                // This metadata transaction cannot publish policy or shorten waits.
                const saved = await savePresentation({ ...application, recovery }, "RECOVERY_SAVE_UNRESOLVED");
                if (saved.type !== "COMMITTED") return saved;
            }
            return restoreRecovery(recovery, recovery);
        }
        if (kind === "RESTORE_RECOVERY" && Object.keys(input).length === 5 &&
            ["recoveryId", "basePolicyRevision", "baseConfigurationRevision", "baseApplicationRevision"].every(key => Object.hasOwn(input, key))) {
            if (controller.getView().status !== "READY") return blocked("NOT_READY");
            const recovery = repository.application().recovery;
            if (!recovery || recovery.id !== input.recoveryId) return { type: "REJECTED", reason: "STALE_RECOVERY" };
            return restoreRecovery(recovery, input);
        }
        if (kind === "DISCARD_RECOVERY" && Object.keys(input).length === 2 && Object.hasOwn(input, "recoveryId")) {
            if (controller.getView().status !== "READY") return blocked("NOT_READY");
            const application = repository.application();
            if (!application.recovery || application.recovery.id !== input.recoveryId) return { type: "REJECTED", reason: "STALE_RECOVERY" };
            return savePresentation({ ...application, recovery: null }, "RECOVERY_SAVE_UNRESOLVED");
        }
        if (kind === "PROPOSE_DESTINATION" && Object.keys(input).length === 6 &&
            ["destination", Object.hasOwn(input, "hostAccess") ? "hostAccess" : "access", "previousId", "basePolicyRevision", "baseApplicationRevision"].every(key => Object.hasOwn(input, key))) {
            if (controller.getView().status !== "READY") return blocked("NOT_READY");
            try {
                const application = repository.application(), change = buildDestinationChange(snapshot(), application, input);
                if (change.presentationOnly) {
                    // Names/categories/pins confer no access. Save only display
                    // preferences, atomically, with the same owner/CAS/journal.
                    if (application.pending) return { type: "REJECTED", reason: "PROPOSAL_PENDING" };
                    return savePresentation({ ...application, revision: application.revision + 1, destinations: change.destinations });
                }
                repository.stageApplication(change.destinations);
                try { return await command({ kind: "PROPOSE_POLICY", candidatePolicy: change.policy }); }
                finally { repository.clearApplicationStage(); }
            } catch (error) { return { type: "REJECTED", reason: error.message }; }
        }
        if (kind === "REVIEW_STORAGE_OWNERSHIP" && Object.keys(input).length === 1) {
            if (controller.getView().status !== "UNAVAILABLE" || snapshot() !== null) return { type: "REJECTED", reason: "STORAGE_REPAIR_NOT_AVAILABLE" };
            return repository.reviewOwnershipRepair();
        }
        if (kind === "REPAIR_STORAGE_OWNERSHIP" && Object.keys(input).length === 3 && Object.hasOwn(input, "repairId") && Object.hasOwn(input, "localCopyConfirmed")) {
            if (controller.getView().status !== "UNAVAILABLE" || snapshot() !== null) return { type: "REJECTED", reason: "STORAGE_REPAIR_NOT_AVAILABLE" };
            const result = repository.repairOwnership(input);
            if (result.type !== "STORAGE_OWNERSHIP_REPAIRED") { publish(); return result; }
            const state = await open(true);
            // Explicit repair includes reconciliation of a discovered exact
            // pending journal. No operation/confirmation is executed again.
            return state.status === "RECONCILING" ? open(true) : state;
        }
        if (kind === "RECOVER" && Object.keys(input).length === 1) return open(true);
        if (kind === "INITIALIZE" && Object.keys(input).length === 3) return initialize(input.policy, input.configuration);
        if (["PROPOSE_POLICY", "PROPOSE_SETTINGS", "REVIEW_POLICY", "CONFIRM_POLICY", "CANCEL_POLICY"].includes(kind)) {
            const oldRevision = snapshot()?.policyRevision;
            const result = await core(input);
            if (result.type === "COMMITTED" && snapshot()?.policyRevision !== oldRevision) {
                for (const context of contexts.values()) {
                    if (context.flight) failContext(context, blocked("POLICY_CHANGED"));
                    else await recheck(context);
                }
            }
            publish(); return result;
        }
        if (!["START_ACCESS", "CONFIRM_ACCESS_AND_OPEN", "CANCEL_ACCESS", "OPEN_HOME", "RETRY_JOURNEY", "CANCEL_JOURNEY"].includes(kind) ||
            !["kind", "contextId", "generation"].every(key => Object.hasOwn(input, key)) || Object.keys(input).length !== 3) {
            return { type: "REJECTED", reason: "INVALID_OPERATION" };
        }
        const context = contexts.get(input.contextId);
        if (!context || context.generation !== input.generation || !enabled) return blocked("STALE_CONTEXT");
        // Closed guest explanations remain usable for a deliberate fresh home
        // opening in the same Obsidian view; they never reuse the dead binding.
        const decision = context.response?.decision;
        let response;
        if (kind === "START_ACCESS") {
            if (!context.origin || !["GREYLIST", "WAIT", "REQUIRE_CONFIRMATION"].includes(decision?.outcome)) return blocked("NOT_GREYLIST");
            response = await core({ kind: "START_ACCESS", target: webTarget(context.origin) });
        } else if (kind === "CANCEL_ACCESS" || kind === "CONFIRM_ACCESS_AND_OPEN") {
            if (!decision?.requestId || !["WAIT", "REQUIRE_CONFIRMATION"].includes(decision.outcome)) return blocked("STALE_REQUEST");
            response = await core({ kind: kind === "CANCEL_ACCESS" ? "CANCEL_ACCESS" : "CONFIRM_ACCESS", requestId: decision.requestId });
            if (kind === "CONFIRM_ACCESS_AND_OPEN" && response.type === "COMMITTED" && context.generation === input.generation) {
                context.effects.openHome(context.origin); // new GET; new context, fresh Core gate
            }
        } else if (kind === "CANCEL_JOURNEY") {
            const current = journey(context);
            if (!current) return blocked("STALE_JOURNEY");
            response = await core({ kind, journeyId: current.id, contextId: context.id });
        } else {
            const origin = kind === "RETRY_JOURNEY" ? context.rootOrigin : context.origin;
            if (!origin) return blocked("NO_DESTINATION");
            context.effects.openHome(origin);
            response = { type: "OPEN_REQUESTED" };
        }
        await recheck(context); publish(); return response;
    }
    async function restoreRecovery(recovery, bases) {
        const application = repository.application(), current = snapshot();
        if (bases.basePolicyRevision !== current.policyRevision || bases.baseConfigurationRevision !== current.configurationRevision ||
            bases.baseApplicationRevision !== application.revision) return { type: "REJECTED", reason: "STALE_DRAFT" };
        const pending = current.vaultState.pendingProposal;
        if (replacementMatches(pending, recovery, application.pending?.destinations)) return { type: "REJECTED", reason: "REPLACEMENT_ALREADY_SAVED" };
        if (pending) {
            if (pending.id !== recovery.sourceProposalId) return { type: "REJECTED", reason: "PROPOSAL_PENDING" };
            if (clock.now() < pending.confirmBy) return { type: "REJECTED", reason: "PROPOSAL_NOT_EXPIRED" };
            const cancelled = await command({ kind: "CANCEL_POLICY", proposalId: pending.id });
            if (cancelled.type !== "COMMITTED") return cancelled;
        }
        const latest = repository.application();
        const unchanged = recovery.operation === "PROPOSE_SETTINGS"
            ? JSON.stringify(snapshot().configuration) === JSON.stringify(recovery.configuration) : samePolicy(snapshot().policy, recovery.policy);
        if (unchanged) {
            // Another explicitly confirmed operation may already have installed
            // these security values. Only reviewed display data remains to save;
            // do not invent a no-op protected proposal or drop the saved work.
            return savePresentation({ ...latest, recovery: null, ...(recovery.destinations === null ? {} :
                { destinations: recovery.destinations, revision: latest.revision + 1 }) }, "RECOVERY_SAVE_UNRESOLVED");
        }
        if (recovery.destinations) repository.stageApplication(recovery.destinations);
        let result;
        try { result = await command(recovery.operation === "PROPOSE_SETTINGS"
            ? { kind: "PROPOSE_SETTINGS", candidateConfiguration: recovery.configuration }
            : { kind: "PROPOSE_POLICY", candidatePolicy: recovery.policy }); }
        finally { repository.clearApplicationStage(); }
        // An ambiguous write stops here. Reconciliation only reads it; neither
        // proposal creation nor confirmation is ever retried automatically.
        if (result.type !== "COMMITTED") return result;
        const verified = repository.application();
        if (!replacementMatches(snapshot().vaultState.pendingProposal, recovery, verified.pending?.destinations)) return blocked("RECOVERY_SAVE_UNRESOLVED");
        const cleaned = await savePresentation({ ...verified, recovery: null }, "RECOVERY_SAVE_UNRESOLVED");
        return cleaned.type === "COMMITTED" ? result : cleaned;
    }
    async function savePresentation(application, reason = "PRESENTATION_SAVE_FAILED") {
        const prior = controller.getView();
        const receipt = await repository.replace(prior.storageVersion, `presentation:${randomUUID()}`,
            { schemaVersion: 2, snapshot: prior.snapshot, application });
        if (receipt.type !== "COMMITTED") {
            // A proven aborted metadata save cannot revoke otherwise-valid
            // browsing. Unknown outcomes still close content before reconciling.
            if (receipt.type !== "NOT_WRITTEN") failAll(reason);
            await core({ kind: "OBSERVE_TIME" }); publish();
            return blocked(receipt.type === "NOT_WRITTEN" && controller.getView().status === "READY" ? "PRESENTATION_NOT_WRITTEN" : reason);
        }
        await core({ kind: "OBSERVE_TIME" }); publish();
        return controller.getView().status === "READY" ? { type: "COMMITTED", operation: "PRESENTATION" } : blocked(reason);
    }
    return Object.freeze({ controller, attach, navigate, arrive,
        updateManaged: work => enqueue(async () => { const result = await work(); if (result && controller.getView().status === "READY") await observe(); else publish(); return result; }),
        open: () => enqueue(open), command: input => {
            let copy; try { copy = structuredClone(input); } catch (_) { copy = null; }
            return enqueue(() => enabled ? command(copy) : blocked("INTEGRATION_SUSPENDED"));
        }, observe: () => enqueue(observe), close, retireDocument, view, now: () => clock.now(),
        block: (context, reason) => failContext(context, blocked(reason)),
        subscribe(callback) { if (!subscribers.size) lastPublication = presentationKey(view(), presentationTime()); subscribers.add(callback); return () => subscribers.delete(callback); },
        suspend() { enabled = false; failAll("INTEGRATION_SUSPENDED"); },
        forget(nativeId) {
            for (const [id, context] of contexts) if (context.nativeId === nativeId && context.closed) contexts.delete(id);
        }
    });
}

module.exports = { createAtlasRuntime, DEVELOPMENT_CONFIGURATION, webTarget, homeOrigin, blank, allowed };
