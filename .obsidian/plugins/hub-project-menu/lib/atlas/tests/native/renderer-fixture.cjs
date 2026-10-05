"use strict";
const assert = require("assert/strict"), path = require("path"), Module = require("module");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) {
    const end = Date.now() + 5000;
    while (Date.now() < end) { if (predicate()) return; await delay(10); }
    throw new Error(`Renderer timeout: ${label}`);
}
module.exports = async function runRendererFixture({ directory, pluginDirectory, baseUrl }) {
    baseUrl = baseUrl.replace(/\/$/, "");
    const style = document.createElement("style");
    style.textContent = require("fs").readFileSync(path.join(pluginDirectory, "styles.css"), "utf8"); document.head.appendChild(style);
    class Modal {
        constructor() { this.contentEl = document.createElement("div"); }
        open() { document.body.appendChild(this.contentEl); this.onOpen(); }
        close() { this.onClose(); this.contentEl.remove(); }
    }
    class Notice { constructor(message) { console.log(message); } }
    const originalLoad = Module._load;
    Module._load = function (name) { return name === "obsidian" ? { Modal, Notice } : originalLoad.apply(this, arguments); };
    let install;
    try { install = require(path.join(pluginDirectory, "lib/atlas/obsidian/integration.js")).installAtlasIntegration; }
    finally { Module._load = originalLoad; }
    window.electron = { remote: require("@electron/remote") };
    const host = window.electron.remote.require(path.join(directory, "atlas-native.cjs"))
        .getAtlasHost({ directory, partition: "persist:vault-atlas-ui" });
    const configuration = { accessTiming: { waitMs: 30, confirmationWindowMs: 5000, grantDurationMs: 3000 },
        vaultTiming: { waitMs: 30, confirmationWindowMs: 5000 }, journeyLimits: { lifetimeMs: 3000, maxHops: 4 } };
    const scratch = document.createElement("div");
    const readExact = require(path.join(pluginDirectory, "lib/atlas/obsidian/ui.js")).configurationInput(scratch,
        { ...configuration, accessTiming: { ...configuration.accessTiming, grantDurationMs: Number.MAX_SAFE_INTEGER } });
    assert.equal(readExact().accessTiming.grantDurationMs, Number.MAX_SAFE_INTEGER);
    await until(() => host.view().status === "UNINITIALIZED", "fresh host");
    const workspace = { getLeavesOfType: () => [leaf], iterateAllLeaves: callback => callback(leaf), on: () => ({}), onLayoutReady: callback => callback() };
    const app = { workspace, vault: { adapter: { getBasePath: () => directory } }, getWebviewPartition: () => "persist:vault-atlas-ui" };
    class NativeView {
        constructor() {
            this.containerEl = document.createElement("div"); this.contentEl = this.containerEl;
            document.body.appendChild(this.containerEl); this.url = `${baseUrl}/login?private=must-not-replay`;
            this.readerView = document.createElement("div"); this.contentEl.appendChild(this.readerView);
            this.instantiateWebView();
        }
        instantiateWebView() {
            this.webview?.remove(); this.webview = document.createElement("webview");
            this.webview.partition = app.getWebviewPartition(); this.webview.src = this.url;
            this.contentEl.appendChild(this.webview);
        }
        navigate(url) { this.url = url; return this.webview.loadURL(url); }
        displayWebView() {}
    }
    const leaf = { view: new NativeView() }, cleanup = [];
    const plugin = { app, manifest: { dir: "." }, register: callback => cleanup.push(callback), registerEvent() {}, addCommand() {}, addRibbonIcon() {} };
    const bridge = install(plugin);
    const click = (parent, label) => {
        const button = [...parent.querySelectorAll("button")].find(button => button.textContent === label);
        assert.ok(button, `Button ${label}`); assert.equal(button.disabled, false); button.click();
    };
    bridge.open();
    await until(() => document.querySelector(".hub-atlas-overview textarea"), "setup UI");
    // Exercise explicit first setup via the actual UI, not a repository shortcut.
    const overview = document.querySelector(".hub-atlas-overview");
    await until(() => host.view().contexts.some(context => context.closed), "setup prevents initial browser");
    const inputs = [...overview.querySelectorAll("input")];
    [0.03, 5, 3, 0.03, 5, 3, 4].forEach((value, index) => { inputs[index].value = String(value); });
    click(overview, "Initialize Atlas with these terms");
    await until(() => host.view().status === "READY", "committed first setup");
    await until(() => leaf.view.contentEl.querySelector(".hub-atlas-panel")?.textContent.includes("Request access"), "restored blocked explanation").catch(error => {
        error.message += `; panel=${leaf.view.contentEl.textContent}; contexts=${JSON.stringify(host.view().contexts)}`; throw error;
    });
    // Typed/app navigation recreates a guest that was blocked during setup.
    await leaf.view.navigate(`${baseUrl}/login?private=must-not-replay`);
    await until(() => leaf.view.contentEl.querySelector(".hub-atlas-panel")?.textContent.includes("Request access"), "Greylist panel");
    const panel = leaf.view.contentEl.querySelector(".hub-atlas-panel");
    click(panel, "Request access");
    await until(() => host.view().snapshot.accessState.pendingRequests.length === 1, "one access request");
    const requestId = host.view().snapshot.accessState.pendingRequests[0].id;
    await until(() => panel.textContent.includes("Confirm and open homepage"), "confirmation availability");
    assert.equal(host.view().snapshot.accessState.pendingRequests[0].id, requestId);
    assert.equal(host.view().snapshot.accessState.grants.length, 0);
    click(panel, "Confirm and open homepage");
    await until(() => host.view().contexts.some(context => !context.closed && context.phase === "DISPLAYED"), "fresh home allowed");
    assert.equal(leaf.view.url, `${baseUrl}/`);
    assert.equal(host.view().snapshot.accessState.grants[0].requestId, requestId);
    assert.equal(leaf.view.contentEl.classList.contains("hub-atlas-blocked"), false);
    // A revoked/expired page must conceal even a late extracted reader copy.
    const old = leaf.view.webview;
    await leaf.view.navigate(baseUrl.replace("unknown.test", "other.test") + "/typed").catch(() => {});
    await until(() => leaf.view.contentEl.classList.contains("hub-atlas-blocked"), "typed denial");
    assert.equal(old.isConnected, false);
    leaf.view.readerView.textContent = "Late extracted content";
    assert.equal(getComputedStyle(leaf.view.readerView).display, "none");
    // Vault UI proposals are frozen, reviewed, waited, then explicitly confirmed.
    const whitelist = overview.querySelector("textarea"); whitelist.value = "trusted.test";
    click(overview, "Propose policy in Vault");
    await until(() => host.view().snapshot.vaultState.pendingProposal, "Vault proposal");
    assert.equal(host.view().snapshot.policyRevision, 0);
    await delay(50); click(overview, "Review proposal");
    await until(() => overview.textContent.includes("Review: ready"), "Vault review ready");
    assert.equal(host.view().snapshot.policyRevision, 0);
    click(overview, "Confirm reviewed proposal");
    await until(() => host.view().snapshot.policyRevision === 1, "Vault committed policy");
    assert.deepEqual(Array.from(host.view().snapshot.policy.whitelist), ["trusted.test"]);
    // Native identity is shared by clients and retained across UI plugin reload.
    const version = host.view().storageVersion;
    bridge.destroy(); for (const callback of cleanup) callback();
    const again = window.electron.remote.require(path.join(directory, "atlas-native.cjs")).getAtlasHost({ directory, partition: "persist:vault-atlas-ui" });
    assert.equal(again.view().storageVersion, version); assert.equal(again.view().snapshot.policyRevision, 1);
    await again.open();
    document.body.replaceChildren();
    return "PASS renderer setup, one Greylist workflow, fresh home, typed recovery, reader fencing, Vault and shared ownership";
};
