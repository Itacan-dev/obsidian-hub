"use strict";
const assert = require("assert/strict"), path = require("path"), Module = require("module");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label, timeout = 5000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (predicate()) return; await delay(10); }
    throw new Error(`Renderer timeout: ${label}`);
}
module.exports = async function runRendererFixture({ directory, pluginDirectory, baseUrl }) {
    baseUrl = baseUrl.replace(/\/$/, "");
    // Exercise the installed native theme, including real hover/focus selectors
    // and the webview's is-loading pseudo-element. Fixture state stays isolated.
    const fs = require("fs"), os = require("os"), nativeStyle = document.createElement("style");
    nativeStyle.textContent = fs.readFileSync(path.join(os.homedir(), "AppData/Roaming/obsidian/obsidian-1.14.4.asar/app.css"), "utf8");
    document.head.appendChild(nativeStyle); document.body.classList.add("theme-dark");
    const style = document.createElement("style");
    style.textContent = require("fs").readFileSync(path.join(pluginDirectory, "styles.css"), "utf8"); document.head.appendChild(style);
    class Modal {
        constructor() {
            this.containerEl = document.createElement("div"); this.containerEl.className = "modal-container";
            const bg = document.createElement("div"); bg.className = "modal-bg"; this.containerEl.appendChild(bg);
            this.modalEl = document.createElement("div"); this.modalEl.className = "modal"; this.containerEl.appendChild(this.modalEl);
            this.contentEl = document.createElement("div"); this.contentEl.className = "modal-content"; this.modalEl.appendChild(this.contentEl);
            window.__atlasTestModal = this;
        }
        open() { document.body.appendChild(this.containerEl); this.onOpen(); }
        close() { this.onClose(); this.containerEl.remove(); }
    }
    const shownMenus = [];
    class Menu {
        constructor() { this.items = []; }
        addItem(fn) { const item = { setTitle(title) { this.title = title; return this; }, setIcon() { return this; }, onClick(fn) { this.click = fn; return this; } }; fn(item); this.items.push(item); }
        showAtMouseEvent() { shownMenus.push(this); }
    }
    class Notice { constructor(message) { console.log(message); } }
    const originalLoad = Module._load;
    Module._load = function (name) { return name === "obsidian" ? { Modal, Notice, Menu } : originalLoad.apply(this, arguments); };
    let install;
    try { install = require(path.join(pluginDirectory, "lib/atlas/obsidian/integration.js")).installAtlasIntegration; }
    finally { Module._load = originalLoad; }
    window.electron = { remote: require("@electron/remote") };
    const nativeHost = window.electron.remote.require(path.join(directory, "atlas-native.cjs"))
        .getAtlasHost({ directory, partition: "persist:vault-atlas-ui" });
    const host = { view: () => JSON.parse(nativeHost.viewJSON()) };
    assert.equal(JSON.parse(await nativeHost.commandJSON("{broken")).reason, "INVALID_OPERATION");
    const configuration = { accessTiming: { waitMs: 30, confirmationWindowMs: 5000, grantDurationMs: 3000 },
        vaultTiming: { waitMs: 300, confirmationWindowMs: 5000 }, journeyLimits: { lifetimeMs: 3000, maxHops: 4 } };
    const scratch = document.createElement("div");
    const readExact = require(path.join(pluginDirectory, "lib/atlas/obsidian/ui.js")).configurationInput(scratch,
        { ...configuration, accessTiming: { ...configuration.accessTiming, grantDurationMs: Number.MAX_SAFE_INTEGER } });
    assert.equal(readExact().accessTiming.grantDurationMs, Number.MAX_SAFE_INTEGER);
    await until(() => host.view().status === "UNINITIALIZED", "fresh host");
    const events = new Map(), leaves = [];
    const workspace = { getLeavesOfType: () => leaves.filter(l => l.view?.getViewType?.() === "webviewer"), iterateAllLeaves: callback => leaves.forEach(callback),
        on: (name, fn) => { events.set(name, fn); return {}; }, onLayoutReady: callback => callback(),
        revealLeaf: async item => { workspace.activeLeaf = item; } };
    const app = { workspace, vault: { adapter: { getBasePath: () => directory } }, getWebviewPartition: () => "persist:vault-atlas-ui" };
    class NativeView {
        constructor(url = `${baseUrl}/login?private=must-not-replay`) {
            this.containerEl = document.createElement("div"); this.contentEl = document.createElement("div"); this.contentEl.className = "webviewer-content";
            this.contentEl.style.cssText = "width:600px;height:400px;position:relative"; this.containerEl.appendChild(this.contentEl);
            document.body.appendChild(this.containerEl); this.url = url;
            this.readerView = document.createElement("div"); this.contentEl.appendChild(this.readerView);
            this.instantiateWebView();
        }
        instantiateWebView() {
            this.webview?.remove(); this.webview = document.createElement("webview");
            this.webview.partition = app.getWebviewPartition(); this.webview.src = this.url;
            this.contentEl.appendChild(this.webview);
            this.webview.addEventListener("did-start-navigation", () => this.showLoadingIndicator(true));
            this.webview.addEventListener("did-stop-loading", () => this.showLoadingIndicator(false));
        }
        navigate(url) {
            // Map synthetic test destinations to the local HTTP server only.
            if (/^https:\/\/[^/]+\.test\/$/.test(url)) url = baseUrl.replace("unknown.test", new URL(url).hostname) + "/";
            this.url = url; return this.webview.loadURL(url);
        }
        getViewType() { return "webviewer"; }
        getState() { return { url: this.url }; }
        async setState(state) { this.url = state.url; this.instantiateWebView(); }
        displayWebView() {}
        showLoadingIndicator(value) { this.contentEl.classList.toggle("is-loading", value); }
    }
    const nativeLeaf = (url) => { const item = { view: new NativeView(url), getViewState() { return { type: "webviewer", state: this.view.getState() }; },
        async setViewState(state) { await this.view.setState(state.state); workspace.activeLeaf = this; } }; leaves.push(item); return item; };
    const leaf = nativeLeaf(), cleanup = [], commands = [], ribbons = [];
    const note = { getViewState: () => ({ type: "markdown", state: { file: "P/Note.md" } }) }, rail = { getViewState: () => ({ type: "hub-prepared-note-rail" }) }; leaves.push(note, rail); workspace.activeLeaf = note;
    const root = document.createElement("div"); root.className = "workspace-split mod-root"; document.body.appendChild(root);
    const tabs = document.createElement("div"); tabs.className = "workspace-tabs mod-top"; root.appendChild(tabs); document.body.classList.add("is-hidden-frameless");
    const strip = document.createElement("div"); strip.className = "workspace-tab-header-container"; tabs.appendChild(strip);
    const noteContainer = document.createElement("div"); tabs.appendChild(noteContainer); note.view = { containerEl: noteContainer };
    const modes = { mode: { ownerDocument: document, projectLeaf: rail, project: { projectId: "p" } }, state: { currentMode: "note" },
        isMainLeaf: item => leaves.includes(item), leafDocument: () => document, leafPath: item => item.getViewState().state?.file ?? null,
        contentLeaves: () => leaves.filter(item => item !== rail), pickContentLeaf: () => note,
        contextContainsFile: (_context, path) => path?.startsWith("P/"),
        createTabLeaf: () => nativeLeaf("about:blank"), captureNoteLayout() {} };
    const plugin = { app, workspaceModes: modes, manifest: { dir: "." }, register: callback => cleanup.push(callback), registerEvent() {},
        addCommand: command => commands.push(command), addRibbonIcon: (...args) => ribbons.push(args) };
    const bridge = install(plugin);
    const reviews = [], originalCommand = bridge.command;
    bridge.command = async input => { const result = await originalCommand(input); if (input.kind === "REVIEW_POLICY") reviews.push({ time: Date.now(), type: result.type, phase: result.review?.phase, reason: result.reason }); return result; };
    plugin.atlas = bridge;
    assert.equal(commands.length, 0); assert.equal(ribbons.length, 0);
    const click = (parent, label) => {
        const button = [...parent.querySelectorAll("button")].find(button => button.textContent === label);
        assert.ok(button, `Button ${label}`); assert.equal(button.disabled, false); button.click();
    };
    bridge.open();
    await until(() => document.querySelector(".hub-atlas-overview textarea"), "setup UI");
    // Exercise explicit first setup via the actual UI, not a repository shortcut.
    const overview = document.querySelector(".hub-atlas-overview");
    await until(() => host.view().contexts.some(context => context.closed), "setup prevents initial browser");
    const inputs = [...overview.querySelectorAll('input[type="number"]')];
    [0.03, 5, 3, 0.3, 5, 3, 4].forEach((value, index) => { inputs[index].value = String(value); });
    click(overview, "Initialize Atlas");
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
    assert.equal(host.view().snapshot.policy.whitelist.length, 58);
    for (const hostname of ["chatgpt.com", "www.chatgpt.com"]) {
        const curatedLeaf = nativeLeaf(baseUrl.replace("unknown.test", hostname));
        await until(() => host.view().contexts.some(c => !c.closed && c.phase === "DISPLAYED" && c.response?.decision?.target.hostname === hostname), `fresh preset allows actual native ${hostname}`);
        assert.equal(curatedLeaf.view.contentEl.classList.contains("hub-atlas-blocked"), false);
        assert.equal(curatedLeaf.view.contentEl.classList.contains("is-loading"), false);
    }
    assert.equal(leaf.view.contentEl.classList.contains("is-loading"), false, "closed guest clears the actual native loading class");
    assert.equal(host.view().managed.active, true); assert.equal(host.view().managed.count, 163850);
    // Actual bridge command registration is scoped to Hub mode and rejects old
    // callbacks while Settings or global mode is active.
    const menuItems = () => { const items = []; events.get("leaf-menu")({ addItem(fn) { const item = { setTitle() { return this; }, setIcon() { return this; }, setSection() { return this; }, onClick(fn) { this.click = fn; return this; } }; fn(item); items.push(item); } }, note); return items; };
    assert.equal(menuItems().length, 0, "Settings excludes launch");
    // Close through the actual adapter's Modal lifecycle, never by DOM removal.
    window.__atlasTestModal.close();
    await until(() => tabs.classList.contains("hub-atlas-note-tabs"), "live content strip becomes a DOM menu surface");
    assert.equal(getComputedStyle(strip).webkitAppRegion, "no-drag", "native drag region no longer swallows right-click");
    const menuLoad = Module._load;
    Module._load = function (name) { return name === "obsidian" ? { Menu } : menuLoad.apply(this, arguments); };
    try {
        modes.state.currentMode = "home"; strip.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })); assert.equal(shownMenus.length, 0);
        modes.state.currentMode = "note"; strip.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        assert.equal(shownMenus.length, 1); assert.equal(shownMenus[0].items[0].title, "Open Atlas");
        const tab = document.createElement("div"); tab.className = "workspace-tab-header"; strip.appendChild(tab);
        tab.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })); assert.equal(shownMenus.length, 1, "native tab menus are preserved");
    } finally { Module._load = menuLoad; }
    workspace.activeLeaf = note; modes.state.currentMode = "home"; assert.equal(menuItems().length, 0);
    modes.state.currentMode = "note"; const [openItem] = menuItems(); assert.ok(openItem); modes.state.currentMode = "home";
    const before = leaves.length; await openItem.click(); assert.equal(leaves.length, before);
    modes.state.currentMode = "note"; strip.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })); await shownMenus.at(-1).items[0].click();
    await until(() => document.querySelector(".hub-atlas-home h1")?.textContent === "Atlas", "native Atlas Home without a URL note");
    const homeLeaf = leaves.find(item => item !== leaf && item.getViewState?.()?.state?.atlasHome === true), home = homeLeaf.view.contentEl.querySelector(".hub-atlas-home");
    assert.equal(homeLeaf.getViewState().state.atlasHome, true); assert.equal(homeLeaf.view.url, "about:blank");
    assert.ok(home.textContent.includes("ChatGPT") && home.textContent.includes("Scholar / Research"));
    workspace.activeLeaf = note; await menuItems()[0].click(); assert.equal(leaves.length, before + 1, "existing internal Home reused");
    bridge.open(); const settings = document.querySelector(".hub-atlas-overview");
    const bounds = element => { const rect = element.getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height]; };
    const viewGeometry = bounds(leaf.view.contentEl), retainedUrl = leaf.view.url, retainedGuest = leaf.view.webview;
    const modal = window.__atlasTestModal, modalGeometry = bounds(modal.modalEl), shell = settings.querySelector(".hub-atlas-settings-shell");
    const sidebar = shell.querySelector("nav");
    for (let pass = 0; pass < 3; pass++) for (const title of ["Sites & Access", "Temporary Access", "Timings / Behaviour", "Vault", "Managed Lists", "Diagnostics / Recovery"]) {
        click(sidebar, title); await delay(1); assert.deepEqual(bounds(modal.modalEl), modalGeometry, `${title} retains modal geometry`);
        assert.equal(settings.querySelector(".hub-atlas-settings-shell"), shell); assert.deepEqual(bounds(leaf.view.contentEl), viewGeometry);
    }
    click(sidebar, "Sites & Access");
    assert.equal(leaf.view.webview, retainedGuest); assert.equal(leaf.view.url, retainedUrl);
    // Structured drafts produce frozen Core proposals, then commit policy and
    // display metadata together. Home sees only the committed destination.
    click(settings, "Add a destination");
    const draft = settings.querySelector(".hub-atlas-draft");
    draft.querySelector('[aria-label="Name"]').value = "Trusted Research";
    draft.querySelector('[aria-label="Primary hostname"]').value = "other.test";
    draft.querySelector('[aria-label="Category"]').value = "Laboratory";
    draft.querySelector('[aria-label="Primary hostname"]').dispatchEvent(new Event("input"));
    draft.querySelectorAll('input[type="checkbox"]')[1].checked = true;
    assert.equal(settings.querySelector('[data-atlas-page="sites"]').scrollTop, 0, "editor opens at the top");
    const parentContents = window.electron.remote.getCurrentWindow().webContents;
    parentContents.debugger.attach("1.3");
    await parentContents.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true });
    for (const node of draft.querySelectorAll("input, textarea, select, button")) {
        node.focus(); const rect = node.getBoundingClientRect();
        await parentContents.debugger.sendCommand("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
        const computed = getComputedStyle(node);
        assert.equal(computed.colorScheme, "light"); assert.notEqual(computed.color, "rgb(255, 255, 255)");
        if (node.type !== "checkbox" && node.tagName !== "BUTTON") {
            assert.equal(computed.backgroundColor, "rgb(252, 250, 245)", `${node.getAttribute("aria-label")} hover + focus background`);
            assert.equal(computed.color, "rgb(44, 51, 45)");
            node.blur(); assert.equal(getComputedStyle(node).backgroundColor, "rgb(252, 250, 245)", "hover without focus stays light");
        }
    }
    parentContents.debugger.detach();
    click(draft, "Review change in Vault");
    await until(() => host.view().snapshot.vaultState.pendingProposal, "Vault proposal");
    assert.equal(host.view().snapshot.policyRevision, 0);
    assert.equal(home.textContent.includes("Trusted Research"), false);
    await until(() => !settings.querySelector('[data-atlas-page="vault"]').hidden && settings.textContent.includes("other.test: greylist → whitelist"), "proposal details immediately visible in selected Vault");
    assert.ok(settings.textContent.includes("Waiting"));
    const confirmControl = [...settings.querySelectorAll("button")].find(node => node.textContent === "Confirm change");
    assert.equal(confirmControl.disabled, true); const vaultDetails = settings.querySelector(".hub-atlas-vault-details");
    assert.equal([...settings.querySelectorAll("button")].some(node => node.textContent === "Review proposal"), false);
    await until(() => settings.textContent.includes("Ready to confirm") && ![...settings.querySelectorAll("button")].find(node => node.textContent === "Confirm change")?.disabled, "Vault becomes ready without a second click").catch(error => {
        error.message += `; status=${host.view().status}; reviews=${JSON.stringify(reviews)}; pending=${JSON.stringify(host.view().snapshot?.vaultState.pendingProposal)}; UI=${settings.querySelector('[data-atlas-page="vault"]').textContent}; button=${JSON.stringify(confirmControl.dataset)}`;
        throw error;
    });
    assert.equal(settings.querySelector(".hub-atlas-vault-details"), vaultDetails); assert.equal(confirmControl.isConnected, true);
    assert.deepEqual(bounds(modal.modalEl), modalGeometry);
    const confirmBounds = confirmControl.getBoundingClientRect(); assert.ok(confirmBounds.height > 0 && confirmBounds.bottom <= modal.modalEl.getBoundingClientRect().bottom, "confirm stays visible without scrolling");
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const vaultImage = await window.electron.remote.getCurrentWindow().capturePage();
    fs.writeFileSync(path.join(os.tmpdir(), "hub-atlas-vault-ready-verified.png"), vaultImage.toPNG());
    assert.equal(host.view().snapshot.policyRevision, 0);
    click(settings, "Confirm change");
    await until(() => host.view().snapshot.policyRevision === 1, "Vault committed policy");
    assert.equal(host.view().snapshot.policy.whitelist.length, 59); assert.ok(host.view().snapshot.policy.whitelist.includes("other.test"));
    await until(() => leaf.view.contentEl.querySelector(".hub-atlas-panel")?.textContent.includes("Access is available"), "existing blocked tab receives committed policy immediately");
    assert.equal(leaf.view.url, retainedUrl, "confirmation does not replay the denied path");
    assert.equal(leaf.view.webview, retainedGuest, "opening and reviewing Settings does not replace the guest");
    await until(() => home.textContent.includes("Trusted Research") && home.textContent.includes("Laboratory"), "Home live committed metadata");
    click(settings, "Sites & Access"); const row = [...settings.querySelectorAll(".hub-atlas-site-row")].find(row => row.textContent.includes("Trusted Research"));
    click(row, "Unpin"); await until(() => host.view().destinations.find(d => d.hostname === "other.test").pinned === false, "pin display commit");
    await until(() => !home.children[4].textContent.includes("Trusted Research"), "Home pin event applied");
    assert.equal(host.view().snapshot.policyRevision, 1);
    const edited = [...settings.querySelectorAll(".hub-atlas-site-row")].find(row => row.textContent.includes("Trusted Research")); click(edited, "Edit");
    const focused = settings.querySelector('.hub-atlas-draft [aria-label="Name"]'); focused.value = "Unsaved draft"; focused.focus();
    const card = [...home.querySelectorAll(".hub-atlas-card")].find(card => card.textContent.includes("Trusted Research"));
    await delay(15_100); assert.equal(focused.isConnected, true); assert.equal(focused.value, "Unsaved draft"); assert.equal(document.activeElement, focused); assert.equal(card.isConnected, true);
    assert.equal(settings.querySelector(".hub-atlas-settings-shell"), shell); assert.deepEqual(bounds(modal.modalEl), modalGeometry);
    assert.deepEqual(bounds(leaf.view.contentEl), viewGeometry); assert.equal(leaf.view.contentEl.classList.contains("is-loading"), false);
    click(home, "Trusted Research"); await until(() => host.view().contexts.some(c => !c.closed && c.phase === "DISPLAYED" && c.response?.decision?.target.hostname === "other.test"), "Home destination uses native Core gate");
    assert.equal(homeLeaf.view.url, baseUrl.replace("unknown.test", "other.test") + "/");
    click(settings, "Sites & Access");
    const sourceRow = [...settings.querySelectorAll(".hub-atlas-site-row")].find(row => row.textContent.includes("GitHub")); click(sourceRow, "Edit");
    settings.querySelector('.hub-atlas-draft [aria-label="Name"]').value = "Source code";
    click(settings.querySelector(".hub-atlas-draft"), "Save display details");
    await until(() => bridge.view().destinations.some(d => d.hostname === "github.com" && d.label === "Source code"), "display-only editor saved and published");
    assert.equal(host.view().snapshot.policyRevision, 1); assert.deepEqual(host.view().destinations.find(d => d.hostname === "github.com").aliases, ["www.github.com"]);
    click(settings, "Add a destination"); const expiringDraft = settings.querySelector(".hub-atlas-draft");
    expiringDraft.querySelector('[aria-label="Name"]').value = "Expired draft";
    expiringDraft.querySelector('[aria-label="Primary hostname"]').value = "expired.test";
    click(expiringDraft, "Review change in Vault");
    await until(() => bridge.view().snapshot.vaultState.pendingProposal, "expiry proposal created").catch(error => { error.message += "; " + settings.querySelector(".hub-atlas-message").textContent; throw error; });
    const expiredId = host.view().snapshot.vaultState.pendingProposal.id;
    await until(() => settings.querySelector(".hub-atlas-vault-status")?.textContent.includes("Expired"), "proposal expiry displayed automatically", 7500);
    assert.equal([...settings.querySelectorAll("button")].find(node => node.textContent === "Confirm change").disabled, true);
    assert.equal(host.view().snapshot.policy.whitelist.includes("expired.test"), false);
    click(settings, "Recreate proposal");
    await until(() => bridge.view().snapshot.vaultState.pendingProposal && bridge.view().snapshot.vaultState.pendingProposal.id !== expiredId, "fresh proposal ID");
    assert.equal(host.view().snapshot.policy.whitelist.includes("expired.test"), false);
    assert.ok(settings.textContent.includes("Expired draft"));
    click(settings, "Cancel proposal"); await until(() => !bridge.view().snapshot.vaultState.pendingProposal, "cancel without applying");
    assert.equal(host.view().snapshot.policyRevision, 1);
    modal.close(); assert.deepEqual(bounds(leaf.view.contentEl), viewGeometry); assert.equal(leaf.view.url, retainedUrl);
    click(leaf.view.contentEl.querySelector(".hub-atlas-panel"), "Open homepage");
    await until(() => {
        let id; try { id = leaf.view.webview.getWebContentsId(); } catch (_) { return false; }
        return bridge.view().contexts.some(c => !c.closed && c.nativeId === id && c.phase === "DISPLAYED");
    }, "same tab opens fresh homepage with newly committed policy");
    assert.equal(leaf.view.url, baseUrl.replace("unknown.test", "other.test") + "/");
    // Native identity is shared by clients and retained across UI plugin reload.
    const version = host.view().storageVersion;
    bridge.destroy(); for (const callback of cleanup) callback();
    const again = window.electron.remote.require(path.join(directory, "atlas-native.cjs")).getAtlasHost({ directory, partition: "persist:vault-atlas-ui" });
    assert.equal(again.view().storageVersion, version); assert.equal(again.view().snapshot.policyRevision, 1);
    await again.open();
    const originalElectron = window.electron; let legacySuspended = false;
    window.electron = { remote: { require: () => ({ getAtlasHost: () => ({ apiVersion: 1, unsubscribe() { legacySuspended = true; } }) }) } };
    const oldAdapter = install(plugin);
    assert.equal(oldAdapter.view().status, "UNAVAILABLE"); assert.equal(oldAdapter.view().reason, "NATIVE_ADAPTER_UPGRADE_REQUIRED"); assert.equal(legacySuspended, true);
    assert.equal(await oldAdapter.openFromNote(note), false); oldAdapter.destroy(); window.electron = originalElectron;
    document.body.replaceChildren();
    return "PASS renderer setup, one Greylist workflow, fresh home, typed recovery, reader fencing, Vault and shared ownership";
};
