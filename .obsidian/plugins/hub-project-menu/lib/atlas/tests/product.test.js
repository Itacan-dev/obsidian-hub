"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const Core = require("../core/index");
const { fixture, CONFIG } = require("./helpers");
const { AtlasFileRepository } = require("../obsidian/persistence");
const { createAtlasRuntime } = require("../obsidian/runtime");
const { curatedWhitelist, compileCuratedWhitelist, serviceHostnames } = require("../presets/curated-whitelist");
const { canOpenAtlas, registerNoteAtlasAction } = require("../obsidian/note-context");
const { browserViewState, prepareNoteLayout } = require("../../domain/navigation");
const destination = (hostname, changes = {}) => ({ id: `destination:${hostname}`, label: "My research", category: "Research",
    hostname, aliases: [`www.${hostname}`], destinations: [], pinned: true, ...changes });
const propose = (f, entry, previousId = null, access = "WHITELIST") => f.runtime.command({ kind: "PROPOSE_DESTINATION", destination: entry, previousId, access,
    basePolicyRevision: f.snapshot().policyRevision, baseApplicationRevision: f.runtime.view().application.revision });

test("canonical preset compiler deduplicates valid exact hosts and rejects invalid entries", () => {
    const policy = compileCuratedWhitelist(); assert.equal(policy.whitelist.length, 58);
    for (const group of curatedWhitelist) for (const service of group.services) for (const hostname of serviceHostnames(service)) assert.ok(policy.whitelist.includes(hostname));
    const duplicated = [...curatedWhitelist, curatedWhitelist[0]]; assert.deepEqual(compileCuratedWhitelist(duplicated), policy);
    for (const hostname of ["*.example.com", "https://example.com", "exämple.com", "a..com", "192.0.2.1", "EXAMPLE.com"]) {
        assert.throws(() => compileCuratedWhitelist([{ label: "Invalid", services: [{ hostname, label: "Bad" }] }]));
    }
    for (const hostname of ["chatgpt.com", "www.chatgpt.com", "github.com", "www.github.com", "www.claude.ai", "www.arxiv.org", "www.doi.org", "www.crossref.org", "www.orcid.org", "www.springer.com"]) {
        assert.equal(Core.evaluate(`https://${hostname}/`, policy).outcome, "ALLOW");
    }
    for (const hostname of ["www.mail.google.com", "www.scholar.google.com", "www.canvas.kth.se", "www.student.ladok.se", "www.journals.aps.org", "login.chatgpt.com"]) {
        assert.equal(policy.whitelist.includes(hostname), false);
        assert.equal(Core.evaluate(`https://${hostname}/`, policy).outcome, "GREYLIST");
    }
    assert.equal(Core.evaluate("https://login.github.com/", policy).outcome, "GREYLIST");
    assert.equal(Core.evaluate("https://outlook.office.com/", policy).outcome, "ALLOW");
});
test("explicit fresh initialization persists the curated preset; restart and reinitialize never overwrite policy", async t => {
    const f = await fixture(t); f.repository.close();
    // A separate unused directory under this fixture's validated temp root.
    const repository = new AtlasFileRepository(path.join(f.directory, "fresh"), { configuration: CONFIG });
    const runtime = createAtlasRuntime({ repository, clock: { now: () => 1000 }, configuration: CONFIG }); await runtime.open();
    assert.equal(runtime.view().status, "UNINITIALIZED");
    await runtime.command({ kind: "INITIALIZE_CURATED", configuration: CONFIG });
    assert.deepEqual(runtime.view().snapshot.policy, compileCuratedWhitelist()); assert.equal(runtime.view().destinations.length, 32);
    assert.deepEqual(JSON.parse(fs.readFileSync(repository.file("authority.json"), "utf8")).snapshot.policy, compileCuratedWhitelist());
    await runtime.command({ kind: "INITIALIZE_CURATED", configuration: CONFIG }); assert.equal(runtime.view().snapshot.policyRevision, 0);
    repository.close();
    const reopened = new AtlasFileRepository(repository.directory, { configuration: CONFIG });
    const restored = createAtlasRuntime({ repository: reopened, clock: { now: () => 1001 }, configuration: CONFIG }); await restored.open();
    assert.deepEqual(restored.view().snapshot.policy, compileCuratedWhitelist()); assert.equal(restored.view().application.destinations.length, 32);
    reopened.close();
});
test("existing initialized policy remains intact; curated import is a Vault proposal", async t => {
    const f = await fixture(t, { whitelist: [], blacklist: ["github.com"] });
    assert.equal((await f.runtime.command({ kind: "INITIALIZE_CURATED", configuration: CONFIG })).reason, "ALREADY_INITIALIZED");
    assert.deepEqual(f.snapshot().policy, { whitelist: [], blacklist: ["github.com"] });
    await f.runtime.command({ kind: "IMPORT_CURATED" }); assert.deepEqual(f.snapshot().policy.whitelist, []);
    assert.ok(f.snapshot().vaultState.pendingProposal.candidatePolicy.whitelist.includes("github.com"));
    f.advance(31); const id = f.snapshot().vaultState.pendingProposal.id;
    await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: id });
    assert.ok(f.snapshot().policy.whitelist.includes("github.com")); assert.deepEqual(f.snapshot().policy.blacklist, ["github.com"]);
    assert.equal(Core.evaluate("https://github.com", f.snapshot().policy).outcome, "DENY");
});
test("curated alias repair preserves custom metadata and Blacklist, then updates an already-blocked context live", async t => {
    const f = await fixture(t, { whitelist: ["chatgpt.com", "private.test"], blacklist: ["www.github.com"] });
    const original = f.runtime.view().destinations.find(d => d.hostname === "chatgpt.com");
    await f.runtime.command({ kind: "SAVE_DISPLAY_DETAILS", destinationId: original.id, label: "My assistant", category: "Work", pinned: false,
        basePolicyRevision: 0, baseApplicationRevision: 0 });
    const context = f.attach(); await f.navigate(context, "https://www.chatgpt.com/private?never-replay=yes");
    assert.equal(context.response.decision.outcome, "GREYLIST");
    const before = structuredClone(f.snapshot().policy);
    await f.runtime.command({ kind: "IMPORT_CURATED" });
    assert.deepEqual(f.snapshot().policy, before); f.advance(31);
    const proposalId = f.snapshot().vaultState.pendingProposal.id;
    await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId });
    const repaired = f.runtime.view().destinations.find(d => d.hostname === "chatgpt.com");
    assert.equal(repaired.label, "My assistant"); assert.equal(repaired.category, "Work"); assert.equal(repaired.pinned, false);
    assert.deepEqual(repaired.aliases, ["www.chatgpt.com"]);
    assert.equal(f.runtime.view().destinations.some(d => d.hostname === "www.chatgpt.com"), false);
    assert.ok(f.snapshot().policy.whitelist.includes("private.test")); assert.deepEqual(f.snapshot().policy.blacklist, ["www.github.com"]);
    assert.equal(context.response.decision.outcome, "ALLOW"); assert.equal(context.response.decision.reason, "WHITELISTED"); assert.equal(f.snapshot().policyRevision, 1);
    assert.equal(f.effects.releases.length, 0, "commit never replays a denied request");
});
test("expired proposal recreation keeps frozen policy/display values and requires a new full wait and confirmation", async t => {
    const f = await fixture(t), before = structuredClone(f.snapshot().policy);
    await propose(f, destination("research.test")); const old = structuredClone(f.snapshot().vaultState.pendingProposal);
    assert.equal((await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id })).reason, "PROPOSAL_NOT_EXPIRED");
    f.advance(90);
    assert.equal((await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: old.id })).reason, "PROPOSAL_EXPIRED");
    assert.equal((await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id, unexpected: true })).reason, "INVALID_OPERATION");
    await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id });
    const pending = f.snapshot().vaultState.pendingProposal;
    assert.notEqual(pending.id, old.id); assert.deepEqual(pending.candidatePolicy, old.candidatePolicy);
    assert.equal(pending.readyAt - pending.createdAt, CONFIG.vaultTiming.waitMs);
    assert.deepEqual(f.snapshot().policy, before);
    assert.equal((await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: pending.id })).reason, "NOT_READY");
    f.advance(31); await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: pending.id });
    assert.equal(f.runtime.view().destinations.find(d => d.hostname === "research.test").label, "My research");
});
test("expired timing recreation uses committed timing terms, and failed cancellation cannot discard or publish a proposal", async t => {
    const f = await fixture(t), candidateConfiguration = { ...CONFIG, vaultTiming: { waitMs: 45, confirmationWindowMs: 70 } };
    await f.runtime.command({ kind: "PROPOSE_SETTINGS", candidateConfiguration }); const old = f.snapshot().vaultState.pendingProposal;
    f.advance(90); f.failWrites(true);
    assert.equal((await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id })).type, "BLOCKED");
    assert.deepEqual(f.snapshot().configuration, CONFIG);
    f.failWrites(false); await f.runtime.open(); assert.equal(f.snapshot().vaultState.pendingProposal.id, old.id);
    await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id });
    const pending = f.snapshot().vaultState.pendingProposal;
    assert.equal(pending.readyAt - pending.createdAt, CONFIG.vaultTiming.waitMs);
    assert.deepEqual(pending.candidateConfiguration, candidateConfiguration);
    f.advance(31); await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: pending.id });
    assert.deepEqual(f.snapshot().configuration, candidateConfiguration); assert.equal(f.snapshot().configurationRevision, 1);
});
test("destination draft, policy and metadata commit together; waiting, cancel, expiry and replay do not apply", async t => {
    const f = await fixture(t), original = f.snapshot().policy;
    await propose(f, destination("research.test")); const id = f.snapshot().vaultState.pendingProposal.id;
    assert.deepEqual(f.snapshot().policy, original); assert.equal(f.runtime.view().destinations.some(d => d.hostname === "research.test"), false);
    f.advance(31); await f.runtime.observe(); assert.deepEqual(f.snapshot().policy, original);
    await f.runtime.command({ kind: "REVIEW_POLICY", proposalId: id }); await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: id });
    const item = f.runtime.view().destinations.find(d => d.hostname === "research.test"); assert.equal(item.label, "My research"); assert.equal(item.pinned, true);
    assert.equal(item.decision.outcome, "ALLOW"); assert.ok(f.snapshot().policy.whitelist.includes("www.research.test"));
    assert.equal((await f.navigate(f.attach(), "https://other.research.test")).decision.outcome, "GREYLIST");
    const revision = f.snapshot().policyRevision; await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: id }); assert.equal(f.snapshot().policyRevision, revision);
    await propose(f, null, item.id, "GREYLIST"); const cancelId = f.snapshot().vaultState.pendingProposal.id;
    await f.runtime.command({ kind: "CANCEL_POLICY", proposalId: cancelId }); assert.ok(f.runtime.view().destinations.some(d => d.id === item.id));
    await propose(f, null, item.id, "GREYLIST"); const expiredId = f.snapshot().vaultState.pendingProposal.id; f.advance(91);
    assert.equal((await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: expiredId })).reason, "PROPOSAL_EXPIRED");
    assert.ok(f.snapshot().policy.whitelist.includes(item.hostname));
});
test("failed confirmation and acknowledgement loss do not publish mismatched metadata; recovery restores both", async t => {
    const f = await fixture(t); await propose(f, destination("research.test")); const id = f.snapshot().vaultState.pendingProposal.id; f.advance(31);
    f.loseAcknowledgement(true); const result = await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: id });
    assert.equal(result.type, "BLOCKED"); assert.equal(f.runtime.view().destinations.some(d => d.hostname === "research.test"), false);
    assert.equal(f.snapshot().policy.whitelist.includes("research.test"), false);
    f.loseAcknowledgement(false); await f.runtime.open();
    assert.ok(f.snapshot().policy.whitelist.includes("research.test")); assert.equal(f.runtime.view().destinations.find(d => d.hostname === "research.test").label, "My research");
});
test("display-only names, categories and pins persist without changing any policy, even with mixed host classifications", async t => {
    const f = await fixture(t, { whitelist: ["github.com"], blacklist: ["www.github.com"] });
    const item = f.runtime.view().destinations.find(d => d.hostname === "github.com"), original = f.snapshot().policy;
    const input = { kind: "SAVE_DISPLAY_DETAILS", destinationId: item.id, label: "Work code", category: "Work", pinned: false,
        basePolicyRevision: f.snapshot().policyRevision, baseApplicationRevision: f.runtime.view().application.revision };
    assert.equal((await f.runtime.command(input)).type, "COMMITTED"); assert.deepEqual(f.snapshot().policy, original); assert.equal(f.snapshot().policyRevision, 0);
    const updated = f.runtime.view().destinations.find(d => d.id === item.id); assert.equal(updated.category, "Work"); assert.equal(updated.pinned, false);
    assert.equal((await f.runtime.command(input)).reason, "STALE_DRAFT");
    assert.equal((await f.runtime.command({ ...input, baseApplicationRevision: 1, hostname: "bypass.test" })).reason, "INVALID_OPERATION");
});
test("old schema-2 authority gains versioned presentation metadata atomically and preserves all Core state", async t => {
    const f = await fixture(t), disk = JSON.parse(fs.readFileSync(f.repository.file("authority.json"), "utf8"));
    f.repository.close(); delete disk.application; fs.writeFileSync(f.repository.file("authority.json"), JSON.stringify(disk));
    const repository = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    const loaded = await repository.load(); assert.equal(loaded.type, "READY"); assert.deepEqual(loaded.envelope.snapshot, disk.snapshot);
    assert.equal(Object.hasOwn(loaded.envelope, "application"), false); assert.equal(repository.application().schemaVersion, 2);
    assert.deepEqual(repository.application().destinations.map(d => d.hostname).sort(), ["blocked.test", "trusted.test"]);
    repository.close();
});

function noteFixture() {
    const document = {}, note = { getViewState: () => ({ type: "markdown", state: { file: "P/Note.md" } }) }, rail = { getViewState: () => ({ type: "hub-prepared-note-rail" }) };
    const mode = { ownerDocument: document, projectLeaf: rail, project: { projectId: "p" } }, events = new Map(); let created = 0;
    const plugin = { app: { workspace: { activeLeaf: note, on: (name, fn) => { events.set(name, fn); return {}; } } }, registerEvent() {},
        workspaceModes: { mode, state: { currentMode: "note" }, isMainLeaf: leaf => leaf === note || leaf === rail,
            leafDocument: () => document, leafPath: leaf => leaf.getViewState().state?.file ?? null, contentLeaves: () => [note], contextContainsFile: (_context, path) => path?.startsWith("P/") } };
    const action = registerNoteAtlasAction(plugin, async () => { created++; return true; });
    const menu = () => { const entries = []; events.get("leaf-menu")({ addItem(fn) { const item = { setTitle(value) { this.title = value; return this; }, setIcon() { return this; }, setSection() { return this; }, onClick(fn) { this.click = fn; return this; } }; fn(item); entries.push(item); } }, note); return entries; };
    return { plugin, mode, note, menu, action, count: () => created };
}
test("native header menu is note-only; global, Home, Settings, unrelated and stale mode callbacks cannot open Atlas", async () => {
    const f = noteFixture(); assert.equal(canOpenAtlas(f.plugin, f.note), true); const [item] = f.menu(); assert.equal(item.title, "Open Atlas");
    await item.click(); assert.equal(f.count(), 1);
    for (const currentMode of ["home", "global", "full", "settings"]) { f.plugin.workspaceModes.state.currentMode = currentMode; assert.equal(f.menu().length, 0); await item.click(); assert.equal(f.count(), 1); }
    f.plugin.workspaceModes.state.currentMode = "note"; f.plugin.settingsControl = { isOpen: () => true }; assert.equal(f.menu().length, 0);
    f.plugin.settingsControl = null; const nativeScope = {}; f.plugin.app.setting = { scope: nativeScope };
    f.plugin.app.keymap = { getWindowStack: () => ({ scope: {}, prevScopes: [nativeScope] }) }; assert.equal(f.menu().length, 0); await item.click(); assert.equal(f.count(), 1);
    delete f.plugin.app.keymap; delete f.plugin.app.setting;
    f.plugin.settingsControl = null; f.plugin.app.workspace.activeLeaf = { getViewState: () => ({ type: "graph" }) }; assert.equal(f.menu().length, 0);
    f.plugin.app.workspace.activeLeaf = f.note; f.note.getViewState = () => ({ type: "markdown", state: { file: "Home.md" } }); assert.equal(f.menu().length, 0);
    f.note.getViewState = () => ({ type: "markdown", state: { file: "Other/Note.md" } }); assert.equal(f.menu().length, 0);
    f.note.getViewState = () => ({ type: "markdown", state: { file: "P/Note.md" } }); f.plugin.workspaceModes.mode = { ...f.mode }; await item.click(); assert.equal(f.count(), 1);
    f.plugin.workspaceModes.mode = null; assert.equal(await f.action.open(f.note), false);
});
test("Atlas Home serializes as a native sterile webviewer tab and restores without a URL note", () => {
    const view = { type: "webviewer", state: { url: "about:blank", atlasHome: true, title: "Atlas" } };
    assert.deepEqual(browserViewState(view), view.state);
    const layout = { main: { type: "tabs", children: [{ type: "leaf", id: "rail", state: { type: "markdown", state: { file: "P/Hub.md" } } }, { type: "leaf", id: "atlas", state: view }] }, active: "atlas" };
    assert.equal(prepareNoteLayout(layout, "P/Hub.md", () => true).main.children[1].state.state.atlasHome, true);
    assert.equal(browserViewState({ type: "webviewer", state: { url: "about:blank" } }), null);
});
