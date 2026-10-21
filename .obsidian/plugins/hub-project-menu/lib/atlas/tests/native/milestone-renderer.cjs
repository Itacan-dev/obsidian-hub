"use strict";
// Actual installed Obsidian CSS and Electron focus/layout, isolated adapter data.
// The editing bridge calls the real runtime/repository; it cannot authorize guests.
const assert = require("assert/strict"), fs = require("fs"), path = require("path");
const { fixture } = require("../helpers");
const Core = require("../../core/index");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) {
    for (let i = 0; i < 250; i++) { if (predicate()) return; await delay(10); }
    throw Error("Milestone renderer timeout: " + label);
}
const control = (parent, text) => [...parent.querySelectorAll("button")].find(b => b.textContent === text);
async function click(parent, text) { const b = control(parent, text); assert.ok(b && !b.disabled, "Available action: " + text); b.click(); await delay(20); }
function input(parent, label, value, event = "input") {
    const node = parent.querySelector('[aria-label="' + label + '"]'); assert.ok(node, label); node.value = value; node.dispatchEvent(new Event(event)); return node;
}
module.exports = async function milestoneRenderer({ pluginDirectory, baselineDirectory = null, only = null }) {
    const mountAtlasSettings = require(path.join(baselineDirectory ?? pluginDirectory, "lib/atlas/obsidian/settings-ui")).mountAtlasSettings;
    const remoteWindow = window.electron.remote.getCurrentWindow(), contents = remoteWindow.webContents, size = remoteWindow.getContentSize(), zoom = contents.getZoomFactor();
    const root = document.createElement("main"); document.body.appendChild(root); root.style.cssText = "position:fixed;inset:0;z-index:200;background:#f8f5ed";
    let dispose = () => {}, cleanups = [];
    try {
        if (only !== "layout") {
            const f = await fixture({ after: fn => cleanups.push(fn) }, { whitelist: ["github.com"], blacklist: ["www.github.com"] }), commands = [];
            const bridge = { view: () => structuredClone(f.runtime.view()), subscribe: fn => f.runtime.subscribe(fn),
                command: async command => { commands.push(command); return f.runtime.command(command); } };
            dispose = mountAtlasSettings(root, bridge);
            const search = root.querySelector('[aria-label="Search destinations"]'); search.value = "github"; search.dispatchEvent(new Event("input"));
            const originalRow = root.querySelector(".hub-atlas-site-row:not([hidden])");
            await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: ["github.com", "unrelated.test"], blacklist: ["www.github.com"] } });
            f.advance(31); await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: f.snapshot().vaultState.pendingProposal.id });
            assert.ok(originalRow.isConnected, "F04 regression really retains the unchanged visual row");
            await click(originalRow, "Edit");
            let draft = root.querySelector(".hub-atlas-draft");
            input(draft, "Name", "Fresh bases");
            assert.ok(control(draft, "Save display details"));
            const before = structuredClone(f.snapshot().policy);
            await click(draft, "Save display details");
            assert.equal(commands.findLast(c => c.kind === "SAVE_DISPLAY_DETAILS").basePolicyRevision, 1);
            assert.equal(commands.findLast(c => c.kind === "SAVE_DISPLAY_DETAILS").baseApplicationRevision, 1);
            assert.deepEqual(f.snapshot().policy, before); assert.equal(f.snapshot().vaultState.pendingProposal, null);

            await click(root.querySelector(".hub-atlas-site-row:not([hidden])"), "Edit"); draft = root.querySelector(".hub-atlas-draft");
            input(draft, "Primary host access", "BLACKLIST", "change"); input(draft, "Primary host access", "WHITELIST", "change");
            const scope = draft.querySelector('[aria-label="Apply primary access to all hosts"]');
            scope.checked = true; scope.dispatchEvent(new Event("input")); scope.checked = false; scope.dispatchEvent(new Event("input"));
            input(draft, "Access for www.github.com", "WHITELIST", "change"); input(draft, "Access for www.github.com", "BLACKLIST", "change");
            input(draft, "Name", "Round trip"); assert.ok(control(draft, "Save display details"), "F05 away/back has no host intent");
            await click(draft, "Save display details"); assert.deepEqual(f.snapshot().policy, before); assert.equal(f.snapshot().vaultState.pendingProposal, null);
            await click(root.querySelector(".hub-atlas-site-row:not([hidden])"), "Edit"); draft = root.querySelector(".hub-atlas-draft");
            const retainedName = input(draft, "Name", "My concurrent draft"); input(draft, "Primary host access", "BLACKLIST", "change");
            const old = f.runtime.view().application.destinations.find(d => d.hostname === "github.com");
            await f.runtime.command({ kind: "SAVE_DISPLAY_DETAILS", destinationId: old.id, label: "Other window", category: old.category, pinned: old.pinned,
                basePolicyRevision: f.snapshot().policyRevision, baseApplicationRevision: f.runtime.view().application.revision });
            await click(draft, "Review change in Vault");
            assert.equal(retainedName.value, "My concurrent draft"); assert.ok(retainedName.isConnected);
            assert.ok(draft.textContent.includes("Your input is preserved"));
            assert.equal(f.snapshot().vaultState.pendingProposal, null, "F04 conflict cannot publish a candidate");
            await click(draft, "Review current changes"); assert.ok(draft.textContent.includes("Other window")); assert.ok(draft.textContent.includes("github.com: current whitelist"));
            input(draft, "Category", "Changed during review"); await click(draft, "Use reviewed revisions");
            assert.ok(control(draft, "Review current changes"), "Changed input requires another explicit review");
            assert.equal(draft.querySelector('[aria-label="Category"]').value, "Changed during review");
            await click(draft, "Review current changes"); await click(draft, "Use reviewed revisions"); assert.equal(retainedName.value, "My concurrent draft");
            await click(draft, "Review change in Vault");
            let pending = f.snapshot().vaultState.pendingProposal;
            assert.ok(pending); let reviewed = await f.runtime.command({ kind: "REVIEW_POLICY", proposalId: pending.id });
            assert.deepEqual(reviewed.review.classifications.map(c => c.hostname), ["github.com"], "Only the explicitly changed primary is reclassified");
            f.advance(31); await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: pending.id });
            assert.deepEqual(f.snapshot().policy.blacklist, ["github.com", "www.github.com"]);
            assert.equal(f.runtime.view().application.destinations.find(d => d.id === old.id).label, "My concurrent draft");

            await click(root, "Sites & Access"); await click(root.querySelector(".hub-atlas-site-row:not([hidden])"), "Edit"); draft = root.querySelector(".hub-atlas-draft");
            input(draft, "Primary hostname", "code.test"); input(draft, "Primary host access", "WHITELIST", "change");
            assert.ok(draft.querySelector('[aria-label="Access for www.github.com"]'), "Changing primary retains its committed www alias: " + JSON.stringify({ base: require("../../obsidian/session").getAtlasSession(bridge).draft.base.destination, visibleRows: [...root.querySelectorAll(".hub-atlas-site-row")].map(n => [n.dataset.atlasDestinationId, n.hidden]), preview: draft.querySelector(".hub-atlas-exact-hosts")?.textContent }));
            assert.equal(draft.querySelector('[aria-label="Access for www.github.com"]').value, "BLACKLIST");
            await click(draft, "Review change in Vault"); pending = f.snapshot().vaultState.pendingProposal;
            assert.ok(pending.candidatePolicy.blacklist.includes("www.github.com")); assert.ok(pending.candidatePolicy.whitelist.includes("code.test"));
            f.advance(31); await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: pending.id });

            // A Greylist primary has no manual entry, but its white alias must
            // remain white through repeated changes returning to the initial value.
            const grey = { id: "grey-destination", label: "Mixed grey", category: "Mixed", hostname: "grey.test", aliases: ["white.test"], destinations: [], pinned: false };
            await f.runtime.command({ kind: "PROPOSE_DESTINATION", destination: grey, previousId: null,
                hostAccess: [{ hostname: "grey.test", access: "GREYLIST" }, { hostname: "white.test", access: "WHITELIST" }],
                basePolicyRevision: f.snapshot().policyRevision, baseApplicationRevision: f.runtime.view().application.revision });
            f.advance(31); await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: f.snapshot().vaultState.pendingProposal.id });
            await click(root, "Sites & Access"); search.value = "grey.test"; search.dispatchEvent(new Event("input"));
            await click(root.querySelector(".hub-atlas-site-row:not([hidden])"), "Edit"); draft = root.querySelector(".hub-atlas-draft");
            for (let i = 0; i < 3; i++) { input(draft, "Primary host access", "BLACKLIST", "change"); input(draft, "Primary host access", "GREYLIST", "change"); }
            input(draft, "Name", "Grey display only"); input(draft, "Category", "Display"); draft.querySelector('[aria-label="Pin on Home after commit"]').checked = true;
            const mixedBefore = structuredClone(f.snapshot().policy); await click(draft, "Save display details");
            assert.deepEqual(f.snapshot().policy, mixedBefore); assert.equal(f.snapshot().vaultState.pendingProposal, null);
            await click(root.querySelector(".hub-atlas-site-row:not([hidden])"), "Edit"); draft = root.querySelector(".hub-atlas-draft");
            input(draft, "Primary host access", "BLACKLIST", "change");
            const all = draft.querySelector('[aria-label="Apply primary access to all hosts"]'); all.checked = true; all.dispatchEvent(new Event("input"));
            await click(draft, "Review change in Vault"); pending = f.snapshot().vaultState.pendingProposal;
            reviewed = await f.runtime.command({ kind: "REVIEW_POLICY", proposalId: pending.id });
            assert.deepEqual(reviewed.review.classifications.map(c => [c.hostname, c.after]), [["grey.test", "BLACKLIST"], ["white.test", "BLACKLIST"]]);
            f.advance(31); await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: pending.id });
            assert.ok(f.snapshot().policy.blacklist.includes("white.test")); assert.ok(f.snapshot().policy.blacklist.includes("grey.test"));

            await click(root, "Sites & Access"); await click(root.querySelector(".hub-atlas-site-row:not([hidden])"), "Edit"); draft = root.querySelector(".hub-atlas-draft");
            input(draft, "Name", "Preserved through policy conflict");
            await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { ...f.snapshot().policy, whitelist: [...f.snapshot().policy.whitelist, "second-window.test"] } });
            f.advance(31); await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: f.snapshot().vaultState.pendingProposal.id });
            const concurrentPolicy = structuredClone(f.snapshot().policy);
            await click(draft, "Save display details"); assert.ok(draft.textContent.includes("Your input is preserved"));
            await click(draft, "Review current changes"); await click(draft, "Use reviewed revisions"); await click(draft, "Save display details");
            assert.deepEqual(f.snapshot().policy, concurrentPolicy); assert.equal(f.snapshot().vaultState.pendingProposal, null);

            // UI distinguishes an unresolved outcome, a non-authoritative saved
            // recovery draft, and a verified replacement pending in Core.
            await click(root, "Sites & Access"); await click(root, "Add a destination"); draft = root.querySelector(".hub-atlas-draft");
            input(draft, "Primary hostname", "temporary-draft.test");
            await click(draft, "Review change in Vault");
            const stableDraftId = require("../../obsidian/session").getAtlasSession(bridge).draft.id;
            assert.equal(f.snapshot().vaultState.pendingProposal, null, "Invalid name keeps the editable draft");
            input(draft, "Name", "Recovery UI"); input(draft, "Primary hostname", "recovery.test");
            await click(draft, "Review change in Vault");
            assert.equal(commands.findLast(c => c.kind === "PROPOSE_DESTINATION").destination.id, stableDraftId, "New destination identity is independent of primary edits");
            pending = f.snapshot().vaultState.pendingProposal; f.advance(91);
            const rename = f.io.renameSync; let injected = false;
            f.io.renameSync = (from, to) => {
                const next = JSON.parse(fs.readFileSync(from, "utf8")), saved = next.application?.recovery, p = next.snapshot.vaultState.pendingProposal;
                if (saved && p && p.id !== saved.sourceProposalId) { injected = true; throw Error("replacement UI failure"); }
                rename(from, to);
            };
            await click(root, "Recreate proposal"); f.io.renameSync = rename; assert.ok(injected);
            let recovery = root.querySelector(".hub-atlas-recovery-draft");
            assert.ok(recovery.textContent.includes("not active policy")); assert.ok(recovery.textContent.includes("unresolved"));
            assert.ok(control(recovery, "Create reviewed replacement").disabled);
            await click(recovery, "Recover saved state");
            assert.equal(f.snapshot().vaultState.pendingProposal, null, "Reconciliation never retries the saved draft");
            recovery = root.querySelector(".hub-atlas-recovery-draft"); recovery.querySelector("details").open = true;
            await click(recovery, "Create reviewed replacement");
            assert.notEqual(f.snapshot().vaultState.pendingProposal.id, pending.id);
            assert.equal(f.snapshot().vaultState.pendingProposal.readyAt - f.snapshot().vaultState.pendingProposal.createdAt, 30);
            assert.equal(f.snapshot().policy.whitelist.includes("recovery.test"), false);
            await f.runtime.command({ kind: "CANCEL_POLICY", proposalId: f.snapshot().vaultState.pendingProposal.id });
            dispose(); dispose = () => {}; root.replaceChildren();
        }
        if (only !== "editing") {
            const config = { accessTiming: { waitMs: 10000, confirmationWindowMs: 60000, grantDurationMs: 60000 },
                vaultTiming: { waitMs: 30000, confirmationWindowMs: 600000 }, journeyLimits: { lifetimeMs: 300000, maxHops: 12 } };
            for (const spec of [{ width: 800, height: 900 }, { width: 800, height: 500 }, { width: 800, height: 400 },
                { width: 1300, height: 940, embedded: true }, { width: 800, height: 500, zoom: 1.5 }, { width: 800, height: 400, long: true }, { width: 800, height: 500, theme: "light" }, { width: 1300, height: 940, embedded: true, theme: "light" }]) {
                document.body.classList.toggle("theme-dark", spec.theme !== "light"); document.body.classList.toggle("theme-light", spec.theme === "light");
                contents.setZoomFactor(spec.zoom ?? 1); remoteWindow.setContentSize(spec.width, spec.height); await delay(30);
                root.replaceChildren(); root.style.cssText = "position:fixed;inset:0;z-index:200";
                const container = document.createElement("div"); container.className = spec.embedded ? "hub-settings-panel" : "modal-container"; root.appendChild(container);
                let mount;
                if (spec.embedded) { container.style.cssText = "width:420px;height:360px;display:block"; mount = container; }
                else { const modal = document.createElement("div"); modal.className = "modal hub-atlas-dialog"; container.appendChild(modal); mount = document.createElement("div"); mount.className = "modal-content"; modal.appendChild(mount); }
                const snapshot = { policy: { whitelist: [], blacklist: [] }, policyRevision: 0, configuration: config, configurationRevision: 0,
                    accessState: Core.createAccessState(), vaultState: Core.createVaultState(), journeyState: Core.createJourneyState() };
                const hosts = spec.long ? Array.from({ length: 300 }, (_, i) => "long-" + i + ".test") : ["ready.test"];
                const plan = Core.planAtlasOperation({ kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: hosts, blacklist: [] } }, { snapshot, configuration: config, now: Date.now() - 31000 });
                assert.ok(plan.candidateSnapshot); const state = { status: "READY", enabled: true, snapshot: plan.candidateSnapshot, application: { schemaVersion: 2, revision: 0, destinations: [], pending: null, recovery: null },
                    contexts: [], destinations: [], temporaryDestinations: [], starter: { policy: snapshot.policy }, managed: null };
                const bridge = { view: () => structuredClone(state), subscribe: () => () => {}, command: async command =>
                    Core.planAtlasOperation(command, { snapshot: state.snapshot, configuration: config, now: Date.now() }).result };
                dispose = mountAtlasSettings(mount, bridge); await click(mount, "Vault");
                await until(() => !control(mount, "Confirm change").disabled, "ready confirmation");
                if (spec.long) mount.querySelector(".hub-atlas-message").textContent = "A long saved proposal description. ".repeat(60);
                const section = mount.querySelector('[data-atlas-page="vault"]'), details = section.querySelector(".hub-atlas-vault-details");
                if (spec.embedded) assert.equal(getComputedStyle(mount.querySelector(".hub-atlas-settings-shell")).gridTemplateColumns.split(" ").length, 1, "Embedded width, independently of viewport, selects one column");
                const label = JSON.stringify(spec);
                // Focus via actual Tab events and verify the hit-tested interactive
                // bounds after each scroll, including all clipping ancestors.
                // Normal scrolling must reach the real controls before keyboard
                // focus can force even an overflow:hidden ancestor to scroll.
                if (["auto", "scroll"].includes(getComputedStyle(section).overflowY)) section.scrollTop = section.scrollHeight;
                if (["auto", "scroll"].includes(getComputedStyle(mount).overflowY)) mount.scrollTop = mount.scrollHeight;
                await delay(20);
                for (const text of ["Confirm change", "Cancel proposal"]) {
                    const target = control(mount, text), bounds = target.getBoundingClientRect(), clip = section.getBoundingClientRect();
                    assert.ok(bounds.top >= Math.max(0, clip.top) && bounds.bottom <= Math.min(innerHeight, clip.bottom) + 1,
                        "Normal scrolling reaches " + text + " at " + label + " bounds=" + JSON.stringify(bounds.toJSON()) + " clip=" + JSON.stringify(clip.toJSON()));
                }
                contents.debugger.attach("1.3");
                try {
                    await contents.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true });
                    const nav = mount.querySelector("nav button:last-child"); nav.focus();
                    for (const text of ["Confirm change", "Cancel proposal"]) {
                        const target = control(mount, text);
                        for (let step = 0; step < 12 && document.activeElement !== target; step++) {
                            await contents.debugger.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
                            await contents.debugger.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
                        }
                        assert.equal(document.activeElement, target, "Keyboard reaches " + text + " at " + label);
                        await delay(20);
                        const bounds = target.getBoundingClientRect(), clip = section.getBoundingClientRect();
                        assert.ok(bounds.height > 10 && bounds.width > 10 && bounds.top >= 0 && bounds.bottom <= innerHeight && bounds.left >= 0 && bounds.right <= innerWidth, text + " viewport bounds " + label + " " + JSON.stringify(bounds.toJSON()));
                        assert.ok(bounds.top >= clip.top && bounds.bottom <= clip.bottom + 1, text + " inside scroll region " + label);
                        assert.ok(target.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)), text + " is interactive and unobscured " + label);
                    }
                } finally { contents.debugger.detach(); }
                const paragraphs = details.querySelectorAll("p"); assert.ok(paragraphs.length, "Exact changes remain present");
                for (const node of [paragraphs[0], paragraphs[paragraphs.length - 1]]) {
                    node.scrollIntoView({ block: "start" }); await delay(10); const bounds = node.getBoundingClientRect(), clip = section.getBoundingClientRect();
                    assert.ok(bounds.top >= Math.max(0, clip.top) - 1 && bounds.top < Math.min(innerHeight, clip.bottom), "First and final terms are reachable " + label);
                }
                assert.equal(getComputedStyle(section.querySelector("footer")).position, "static", "Actions cannot obscure terms");
                dispose(); dispose = () => {}; root.replaceChildren();
            }
        }
        return "PASS Milestone 1: current editor bases, concurrent review/retry, mixed-host round trips, explicit all-host changes, primary edits, recovery UI, and eight actual-theme keyboard/button layouts";
    } finally {
        dispose(); for (const cleanup of cleanups.reverse()) cleanup();
        root.remove(); contents.setZoomFactor(zoom); remoteWindow.setContentSize(size[0], size[1]);
    }
};
