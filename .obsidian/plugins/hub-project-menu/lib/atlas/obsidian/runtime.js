"use strict";

const { randomUUID } = require("crypto");
const Core = require("../core/index");

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
const blocked = reason => ({ type: "BLOCKED", reason });
/** @param {import('../core/index').AtlasControllerResponse} response
 * @returns {response is Extract<import('../core/index').AtlasControllerResponse, {type: 'ASSESSMENT'}>} */
const allowed = response => response?.type === "ASSESSMENT" && response.decision.outcome === "ALLOW";

/** @param {{repository: import('../core/index').AtlasRepository & {initialize: (snapshot: import('../core/index').AtlasSnapshot) => Promise<boolean>, issue?: string}, clock: import('../core/index').AtlasClock, configuration?: import('../core/index').AtlasConfiguration, managedBlacklist?: () => import('../core/index').ManagedBlacklist}} options */
function createAtlasRuntime({ repository, clock, configuration = DEVELOPMENT_CONFIGURATION, managedBlacklist }) {
    const controller = Core.createAtlasController({ repository, clock, configuration,
        ownerId: randomUUID(), ...(managedBlacklist === undefined ? {} : { managedBlacklist }) });
    const contexts = new Map(), subscribers = new Set();
    let queue = Promise.resolve(), enabled = true;
    const enqueue = work => {
        const task = queue.then(work).catch(() => { failAll("ADAPTER_FAILURE"); return blocked("ADAPTER_FAILURE"); });
        queue = task.then(() => undefined); return task;
    };
    const snapshot = () => controller.getView().snapshot;
    const journey = context => snapshot()?.journeyState.journeys.find(j => j.contextId === context.id && j.phase !== "ENDED");
    const binding = (context, continuation) => ({ contextId: context.id, journeyId: journey(context)?.id ?? null,
        ...(continuation ? { continuation } : {}) });
    const valid = (context, generation) => enabled && contexts.get(context.id) === context && context.generation === generation && !context.closed;
    function publish() {
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
    async function core(operation) {
        const response = await controller.handle(operation);
        if (response.type === "BLOCKED") failAll(response.reason);
        return response;
    }
    function attach(nativeId, effects) {
        const context = { id: randomUUID(), nativeId, effects, generation: 0, closed: false,
            phase: "BLANK", response: null, origin: null, flight: null, displayed: null, rootOrigin: null };
        contexts.set(context.id, context); publish(); return context;
    }
    async function open() {
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
        const view = await controller.open(); publish(); return view;
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
            if (!allowed(response)) { failContext(context, response); return response; }
            if (context.flight !== captured) return response; // completion saved; newer request still held
            context.displayed = { url, loaderId, response };
            context.flight = null; context.response = response; context.origin = homeOrigin(url);
            context.phase = "DISPLAYED"; context.effects.lease(response); publish(); return response;
        });
    }
    async function recheck(context) {
        if (context.closed && context.phase !== "BLOCKED") return;
        const loaded = context.displayed;
        if (!loaded) {
            if (context.phase === "BLOCKED" && context.origin) {
                context.response = await core({ kind: "CHECK_NAVIGATION", target: webTarget(context.origin), context: binding(context) });
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
        if (!allowed(response)) failContext(context, response);
        else {
            context.response = response; loaded.response = response;
            context.effects.lease(response);
        }
    }
    async function observe() {
        if (!enabled || controller.getView().status !== "READY") return;
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
        return { ...state, enabled, initialConfiguration: state.snapshot ? null : configuration, repositoryIssue: repository.issue ?? null,
            contexts: [...contexts.values()].map(context => ({ id: context.id, nativeId: context.nativeId,
                generation: context.generation, closed: context.closed, phase: context.phase,
                response: context.response, origin: context.origin, journey: snapshot()?.journeyState.journeys.find(j => j.contextId === context.id) ?? null })) };
    }
    async function command(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) return { type: "REJECTED", reason: "INVALID_OPERATION" };
        const kind = input.kind;
        if (kind === "RECOVER" && Object.keys(input).length === 1) return open();
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
    return Object.freeze({ controller, attach, navigate, arrive,
        open: () => enqueue(open), command: input => {
            let copy; try { copy = structuredClone(input); } catch (_) { copy = null; }
            return enqueue(() => command(copy));
        }, observe: () => enqueue(observe), close, retireDocument, view, now: () => clock.now(),
        block: (context, reason) => failContext(context, blocked(reason)),
        subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
        suspend() { enabled = false; failAll("INTEGRATION_SUSPENDED"); },
        forget(nativeId) {
            for (const [id, context] of contexts) if (context.nativeId === nativeId && context.closed) contexts.delete(id);
        }
    });
}

module.exports = { createAtlasRuntime, DEVELOPMENT_CONFIGURATION, webTarget, homeOrigin, blank, allowed };
