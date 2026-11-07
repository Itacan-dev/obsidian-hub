"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { canOpenAtlas, registerNoteAtlasAction } = require("../obsidian/note-context");
function note() {
    const doc = {}, rail = { getViewState: () => ({ type: "hub-prepared-note-rail" }) };
    const leaf = type => ({ type, path: null, getViewState() { return { type: this.type, state: this.path ? { file: this.path } : {} }; } });
    const markdown = leaf("markdown"); markdown.path = "P/Note.md";
    const empty = leaf("empty"), pdf = leaf("pdf"); pdf.path = "P/Paper.pdf";
    const web = leaf("webviewer"), foreign = leaf("empty"), leaves = [markdown, empty, pdf, web], events = new Map();
    const mode = { ownerDocument: doc, projectLeaf: rail, project: {} };
    const plugin = { app: { workspace: { activeLeaf: markdown, on: (name, callback) => { events.set(name, callback); return {}; } } }, registerEvent() {},
        workspaceModes: { mode, state: { currentMode: "note" }, isMainLeaf: l => leaves.includes(l) || l === rail,
            leafDocument: () => doc, leafPath: l => l.path, contextContainsFile: (_, p) => p?.startsWith("P/"), contentLeaves: () => leaves } };
    return { plugin, mode, leaves, markdown, empty, pdf, web, foreign, events };
}

test("pop-out controls use live workspace membership without enabling the Note-only launcher", () => {
    const { canUseAtlasContext } = require("../obsidian/note-context"), f = note();
    const document = {}, win = { document, closed: false }, container = { win };
    const leaf = { getContainer: () => container, view: { contentEl: { ownerDocument: document, isConnected: true } } };
    const workspace = f.plugin.app.workspace;
    workspace.rootSplit = {}; workspace.getLeavesOfType = () => [leaf];
    f.plugin.workspaceModes.mode = null;
    assert.equal(canUseAtlasContext(f.plugin, leaf), true);
    assert.equal(canOpenAtlas(f.plugin, leaf), false);
    leaf.view.contentEl.isConnected = false; assert.equal(canUseAtlasContext(f.plugin, leaf), false);
    leaf.view.contentEl.isConnected = true; win.closed = true; assert.equal(canUseAtlasContext(f.plugin, leaf), false);
    win.closed = false; workspace.getLeavesOfType = () => []; assert.equal(canUseAtlasContext(f.plugin, leaf), false);
    workspace.getLeavesOfType = () => [leaf]; container.win = { document: {} }; assert.equal(canUseAtlasContext(f.plugin, leaf), false);
});
test("M2: launcher is Note-context scoped for Markdown, empty, PDF and webviewer leaves", () => {
    const f = note();
    for (const leaf of f.leaves) { f.plugin.app.workspace.activeLeaf = leaf; assert.equal(canOpenAtlas(f.plugin, leaf), true, leaf.type); }
    assert.equal(canOpenAtlas(f.plugin, f.foreign), false);
    f.plugin.app.workspace.activeLeaf = f.pdf; f.pdf.path = "Elsewhere/Unowned.pdf";
    assert.equal(canOpenAtlas(f.plugin, f.pdf), false);
});
test("M2: launcher excludes changed modes, native Settings, unowned groups and detached callbacks", async () => {
    const f = note(); let launches = 0;
    const action = registerNoteAtlasAction(f.plugin, async () => { launches++; return true; });
    assert.equal(await action.open(f.markdown), true);
    for (const mode of ["home", "global", "full", "settings"]) {
        f.plugin.workspaceModes.state.currentMode = mode; assert.equal(await action.open(f.markdown), false);
    }
    f.plugin.workspaceModes.state.currentMode = "note"; assert.equal(await action.open(f.foreign), false);
    f.plugin.workspaceModes.mode = { ...f.mode }; assert.equal(await action.open(f.markdown, f.mode), false);
    f.plugin.workspaceModes.mode = f.mode; f.markdown.view = { containerEl: { isConnected: false } };
    assert.equal(await action.open(f.markdown), false);
    assert.equal(launches, 1); action.destroy();
});

const { getAtlasSession, normalizeRoute, createDestinationDraft } = require("../obsidian/session");
const { describeOutcome } = require("../obsidian/feedback");
const { pendingActions, presentationNow } = require("../obsidian/pending");
const { fixture } = require("./helpers");
test("M2: routes select only known presentation targets and cannot carry authorization commands", () => {
    const current = { section: "vault", context: { proposalId: 1 } };
    assert.equal(normalizeRoute(undefined, current), current);
    assert.deepEqual(normalizeRoute({ section: "temporary", context: { requestId: 2, contextId: "ctx" } }), { section: "temporary", context: { requestId: 2, contextId: "ctx" } });
    for (const route of [{ section: "unknown" }, { section: "vault", confirm: true }, { section: "vault", context: { grant: true } },
        { section: "vault", context: [] }, { section: "vault", context: { proposalId: -1 } }]) assert.equal(normalizeRoute(route), null);
});
test("M2: session draft clearing is identity checked and never changes Core state", async t => {
    const f = await fixture(t), view = f.runtime.view(), before = structuredClone(f.snapshot()), bridge = {};
    const session = getAtlasSession(bridge), old = createDestinationDraft(view, null), newer = createDestinationDraft(view, null);
    old.fields = { name: "Unfinished" }; old.dirty = true; session.draft = old;
    session.navigate({ section: "vault" }); assert.equal(getAtlasSession(bridge).draft, old);
    session.draft = newer; assert.equal(session.clearDraft(old.token), false); assert.equal(session.draft, newer);
    assert.equal(session.clearDraft(newer.token), true); assert.deepEqual(f.snapshot(), before); session.dispose();
});
test("M2: pending Greylist phases route to existing workflow without creating or confirming access", async t => {
    const f = await fixture(t), context = f.attach(); await f.navigate(context, "https://pending.test/");
    await f.command(context, "START_ACCESS"); const request = f.snapshot().accessState.pendingRequests[0], original = structuredClone(f.snapshot());
    const waiting = pendingActions(f.runtime.view(), 1000).find(i => i.key === "access:" + request.id);
    assert.equal(waiting.phase, "WAITING"); assert.equal(waiting.contextId, context.id);
    assert.deepEqual(waiting.route, { section: "temporary", context: { requestId: request.id, contextId: context.id } });
    assert.equal(pendingActions(f.runtime.view(), 1010).find(i => i.key === waiting.key).phase, "READY");
    assert.equal(pendingActions(f.runtime.view(), 1070).find(i => i.key === waiting.key).phase, "EXPIRED");
    const absent = pendingActions({ ...f.runtime.view(), contexts: [] }, 1010).find(i => i.key === waiting.key);
    assert.equal(absent.contextId, null); assert.match(absent.detail, /Note tab/);
    assert.deepEqual(f.snapshot(), original); assert.equal(f.snapshot().accessState.grants.length, 0);
});
test("M2: Vault, recovery and unresolved pending state remain distinct and respect observed clock floors", async t => {
    const f = await fixture(t); await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: ["new.test"], blacklist: [] } });
    const view = f.runtime.view(), p = view.snapshot.vaultState.pendingProposal;
    assert.equal(pendingActions(view, 1000)[0].phase, "WAITING");
    assert.equal(pendingActions(view, p.readyAt)[0].phase, "READY");
    assert.equal(pendingActions(view, p.confirmBy)[0].phase, "EXPIRED");
    const recovered = { ...view, application: { ...view.application, recovery: { id: "saved" } } };
    assert.equal(pendingActions(recovered, 1000).filter(i => i.phase === "RECOVERY").length, 1);
    const unknown = pendingActions({ ...recovered, status: "RECONCILING" }, p.readyAt);
    assert.ok(unknown.every(i => i.phase === "UNRESOLVED")); assert.equal(unknown.find(i => i.key === "authority").route.section, "diagnostics");
    const clock = structuredClone(view); clock.snapshot.vaultState.lastObservedAt = p.confirmBy;
    assert.equal(presentationNow(clock, 1), p.confirmBy); assert.equal(pendingActions(clock, 1)[0].phase, "EXPIRED");
    assert.equal(f.snapshot().policyRevision, 0);
});
test("M2: feedback follows actual proposed, cancelled, stale-context and expired-access results", async t => {
    const f = await fixture(t), context = f.attach(); await f.navigate(context, "https://feedback.test/"); await f.command(context, "START_ACCESS");
    const stale = { kind: "CONFIRM_ACCESS_AND_OPEN", contextId: context.id, generation: context.generation - 1 };
    assert.match(describeOutcome(stale, await f.runtime.command(stale), f.runtime.view()).text, /no longer applicable/);
    f.advance(71); const command = { kind: "CONFIRM_ACCESS_AND_OPEN", contextId: context.id, generation: context.generation };
    assert.match(describeOutcome(command, await f.runtime.command(command), f.runtime.view()).text, /expired|changed/);
    assert.equal(f.snapshot().accessState.grants.length, 0);
    const propose = { kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: ["feedback.test"], blacklist: [] } };
    assert.match(describeOutcome(propose, await f.runtime.command(propose), f.runtime.view()).text, /Vault review/);
    const cancel = { kind: "CANCEL_POLICY", proposalId: f.snapshot().vaultState.pendingProposal.id };
    const message = describeOutcome(cancel, await f.runtime.command(cancel), f.runtime.view());
    assert.match(message.text, /cancelled/); assert.doesNotMatch(message.text, /saved/i); assert.equal(f.snapshot().policyRevision, 0);
});
test("M2: real acknowledgement loss reports unresolved and explicit recovery does not replay the operation", async t => {
    const f = await fixture(t), command = { kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: ["unknown.test"], blacklist: [] } };
    f.loseAcknowledgement(true); const result = await f.runtime.command(command);
    const feedback = describeOutcome(command, result, f.runtime.view());
    assert.equal(feedback.tone, "unresolved"); assert.equal(feedback.section, "diagnostics"); assert.match(feedback.text, /draft is kept/);
    f.loseAcknowledgement(false); const recovered = await f.runtime.command({ kind: "RECOVER" });
    assert.match(describeOutcome({ kind: "RECOVER" }, recovered, f.runtime.view()).text, /nothing was automatically confirmed/);
    assert.equal(f.snapshot().policyRevision, 0); assert.ok(f.snapshot().vaultState.pendingProposal);
});

test("M2: a different main group or owner document is excluded even for an empty/PDF source", () => {
    const f = note(); f.plugin.app.workspace.activeLeaf = f.markdown;
    f.plugin.workspaceModes.contentLeaves = () => [f.markdown, f.empty, f.pdf];
    assert.equal(canOpenAtlas(f.plugin, f.web), false, "main-leaf membership alone is insufficient");
    f.plugin.workspaceModes.leafDocument = leaf => leaf === f.pdf ? {} : f.mode.ownerDocument;
    assert.equal(canOpenAtlas(f.plugin, f.pdf), false);
});
test("M2: canonical Settings can expose owned context controls while launch remains excluded", () => {
    const { canUseAtlasContext } = require("../obsidian/note-context"), f = note();
    f.plugin.settingsControl = { isOpen: () => true };
    assert.equal(canOpenAtlas(f.plugin, f.markdown), false); assert.equal(canUseAtlasContext(f.plugin, f.markdown), true);
    f.plugin.workspaceModes.state.currentMode = "full"; assert.equal(canUseAtlasContext(f.plugin, f.markdown), false);
});
test("M2: successful display, temporary grant and policy commit feedback correspond to persisted results", async t => {
    const f = await fixture(t), destination = f.runtime.view().application.destinations[0];
    const display = { kind: "SAVE_DISPLAY_DETAILS", destinationId: destination.id, label: "Readable name", category: destination.category, pinned: false, basePolicyRevision: 0, baseApplicationRevision: 0 };
    assert.match(describeOutcome(display, await f.runtime.command(display), f.runtime.view()).text, /Display details saved/);
    assert.equal(f.snapshot().policyRevision, 0);
    const context = f.attach(); await f.navigate(context, "https://granted.test/"); await f.command(context, "START_ACCESS"); f.advance(11);
    const grant = { kind: "CONFIRM_ACCESS_AND_OPEN", contextId: context.id, generation: context.generation };
    assert.match(describeOutcome(grant, await f.runtime.command(grant), f.runtime.view()).text, /Temporary access granted/);
    assert.equal(f.snapshot().accessState.grants.length, 1);
    await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: ["committed.test"], blacklist: [] } }); f.advance(31);
    const commit = { kind: "CONFIRM_POLICY", proposalId: f.snapshot().vaultState.pendingProposal.id };
    assert.match(describeOutcome(commit, await f.runtime.command(commit), f.runtime.view()).text, /committed/);
    assert.equal(f.snapshot().policyRevision, 1); assert.ok(f.snapshot().policy.whitelist.includes("committed.test"));
});

test("M2: an unresolved local acknowledgement stays discoverable when native authority is READY", async t => {
    const f = await fixture(t), before = structuredClone(f.snapshot());
    const items = pendingActions(f.runtime.view(), 1000, { draft: { submission: { status: "unresolved" } } });
    const local = items.find(item => item.key === "local-submission");
    assert.equal(local.phase, "UNRESOLVED"); assert.equal(local.route.section, "diagnostics");
    assert.match(local.detail, /local copy is kept/); assert.deepEqual(f.snapshot(), before);
});
