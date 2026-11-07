"use strict";
// Genuine installed Obsidian, isolated profile/vault and a local test server.
// No user vault, cookies or policy is opened or modified.
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), cp = require("node:child_process"), http = require("node:http"), assert = require("node:assert/strict");
const workspace = path.resolve(__dirname, "../../../../../../..");
const { connect } = require(path.join(workspace, "ItacanTaskCore/vnext/tools/cdp-client.cjs"));
const root = fs.mkdtempSync(path.join(os.tmpdir(), "hub-popout-installed-")), profile = path.join(root, "profile"), vault = path.join(root, "vault");
const pluginSource = path.join(workspace, ".obsidian/plugins/hub-project-menu"), plugin = path.join(vault, ".obsidian/plugins/hub-project-menu");
const exe = path.join(process.env.LOCALAPPDATA, "Programs/Obsidian/Obsidian.exe");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const requests = [];
let child, client, verified = false;
const server = http.createServer((request, response) => {
    requests.push({ host: request.headers.host.split(":")[0], path: request.url });
    response.setHeader("Content-Type", "text/html");
    if (request.url === "/redirect") { response.writeHead(302, { Location: `http://blocked.test:${server.address().port}/forbidden-redirect` }); response.end(); return; }
    if (request.url === "/journey") { response.writeHead(302, { Location: `http://idp.test:${server.address().port}/sign-in` }); response.end(); return; }
    response.end("<!doctype html><title>Atlas pop-out fixture</title><h1>Allowed fixture</h1>");
});
(async () => {
    fs.mkdirSync(profile, { recursive: true });
    cp.execFileSync(process.execPath, [path.join(pluginSource, "build.js"), "--output-dir", plugin], { windowsHide: true, stdio: "pipe" });
    for (const name of ["manifest.json", "styles.css"]) fs.copyFileSync(path.join(pluginSource, name), path.join(plugin, name));
    fs.cpSync(path.join(pluginSource, "lib/atlas/managed/data"), path.join(plugin, "lib/atlas/managed/data"), { recursive: true });
    fs.cpSync(path.join(workspace, "System/Dashboards"), path.join(vault, "System/Dashboards"), { recursive: true });
    fs.writeFileSync(path.join(vault, "Home.md"), "# Pop-out test\n");
    fs.writeFileSync(path.join(vault, "Original.md"), "# Original note\n\nKeep this note intact.\n");
    const obsidian = path.join(vault, ".obsidian");
    fs.writeFileSync(path.join(obsidian, "app.json"), JSON.stringify({ safeMode: false }));
    fs.writeFileSync(path.join(obsidian, "core-plugins.json"), JSON.stringify({ "file-explorer": true, webviewer: true }));
    const helper = path.join(obsidian, "plugins/popout-acceptance"); fs.mkdirSync(helper, { recursive: true });
    fs.writeFileSync(path.join(helper, "manifest.json"), JSON.stringify({ id: "popout-acceptance", name: "Isolated pop-out acceptance", version: "1.0.0", minAppVersion: "1.0.0" }));
    fs.writeFileSync(path.join(helper, "main.js"), 'const api=require("obsidian");module.exports=class extends api.Plugin{onload(){window.__popoutApi=api;}}');
    fs.writeFileSync(path.join(obsidian, "community-plugins.json"), JSON.stringify(["popout-acceptance", "hub-project-menu"]));
    const sourceProfile = path.join(process.env.APPDATA, "obsidian"), archive = fs.readdirSync(sourceProfile).filter(n => /^obsidian-\d+\.\d+\.\d+\.asar$/.test(n)).sort((a,b) => b.localeCompare(a, undefined, { numeric: true }))[0];
    fs.copyFileSync(path.join(sourceProfile, archive), path.join(profile, archive));
    fs.writeFileSync(path.join(profile, "obsidian.json"), JSON.stringify({ vaults: { popoutfixture: { path: vault, ts: Date.now(), open: true } }, updateDisabled: true, cli: false }));
    fs.writeFileSync(path.join(profile, "popoutfixture.json"), "{}");
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = 19317;
    child = cp.spawn(exe, ["--user-data-dir=" + profile, "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=" + port, "--host-resolver-rules=MAP *.test 127.0.0.1", "--no-proxy-server", "--disable-gpu"], {
        windowsHide: true, stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, LOCALAPPDATA: path.join(root, "local") }
    });
    let stderr = ""; child.stderr.on("data", data => { stderr += data; fs.writeFileSync(path.join(root, "stderr.txt"), stderr); });
    for (let i = 0; i < 100; i++) { try { client = await connect(port); break; } catch {} await delay(200); }
    assert(client, "Installed Obsidian exposes the isolated renderer");
    for (let i = 0; i < 100; i++) { if (await client.evaluate("!!window.app?.plugins")) break; await delay(100); }
    const identity = await client.evaluate('({vault:app.vault.adapter.getBasePath(),profile:window.electron.remote.app.getPath("userData"),version:window.__popoutApi?.apiVersion,versions:process.versions})');
    assert.equal(path.resolve(identity.vault), vault); assert.equal(path.resolve(identity.profile), profile); verified = true;
    for (let i = 0; i < 120; i++) {
        if (await client.evaluate("!!app.plugins.plugins['hub-project-menu']?.atlas && !!window.__popoutApi")) break;
        await client.evaluate(`(()=>{const b=[...document.querySelectorAll('.modal-container button')].find(b=>/^(Trust author|Confiar en el autor)/i.test(b.textContent.trim()));if(b&&!b.disabled)b.click();})()`);
        await delay(150);
    }
    const result = await client.evaluate(`(${renderer.toString()})(${JSON.stringify(server.address().port)})`);
    assert.equal(requests.some(r => r.host === "blocked.test"), false, "denied requests never reach the server");
    assert(requests.some(r => r.host === "trusted.test"), "allowed navigation reaches the server");
    fs.writeFileSync(path.join(root, "result.json"), JSON.stringify({ pass: true, identity, ...result, requests }, null, 2));
    console.log(JSON.stringify({ root, pass: true, ...result }));
})().catch(error => { fs.writeFileSync(path.join(root, "error.txt"), error.stack); console.error(root, error); process.exitCode = 1; }).finally(async () => {
    if (verified) try { await client.evaluate('setTimeout(()=>window.electron.remote.app.quit(),0);true'); } catch {}
    client?.close(); server.close(); server.closeAllConnections();
    if (child) { await delay(1000); if (child.exitCode === null) child.kill(); }
});

async function renderer(port) {
    const assert = require("node:assert/strict"), p = app.plugins.plugins["hub-project-menu"];
    assert(p?.atlas, "Hub loaded");
    const bridge = p.atlas, checks = [], delay = ms => new Promise(r => setTimeout(r, ms));
    const contextFor = leaf => { try { return bridge.view().contexts.find(c => c.nativeId === leaf.view.webview.getWebContentsId()); } catch { return null; } };
    const until = async (fn, label) => { for (let i = 0; i < 200; i++) { if (await fn()) return; await delay(50); } throw Error("Timed out: " + label); };
    await until(() => bridge.view().status !== "UNAVAILABLE", "Atlas startup");
    const initialized = await bridge.command({ kind: "INITIALIZE", policy: { whitelist: ["www.overleaf.com", "overleaf.com", "chatgpt.com", "trusted.test"], blacklist: ["blocked.test"] }, configuration: {
        accessTiming: { waitMs: 100, confirmationWindowMs: 10000, grantDurationMs: 60000 }, vaultTiming: { waitMs: 100, confirmationWindowMs: 10000 }, journeyLimits: { lifetimeMs: 60000, maxHops: 4 }
    } });
    assert.equal(bridge.view().status, "READY", JSON.stringify({ initialized, reason: bridge.view().reason }));
    const original = app.workspace.getLeaf("tab"); await original.openFile(app.vault.getAbstractFileByPath("Original.md"));
    const originalState = original.getViewState(), before = JSON.stringify(bridge.view().snapshot.policy);
    const native = window.electron.remote.require(require("node:path").join(app.vault.adapter.getBasePath(), p.manifest.dir, "atlas-native.cjs"));
    const host = native.getAtlasHost({ directory: require("node:path").join(app.vault.adapter.getBasePath(), p.manifest.dir), partition: app.getWebviewPartition() });
    const listenerCount = window.electron.remote.app.listenerCount("web-contents-created");
    const leaves = [];
    await until(() => document.querySelector('.hub-shell-shortcut[aria-label="Overleaf"]'), "Hub footer mounted");
    for (const [id, url, title] of [["overleaf", "https://www.overleaf.com", "Overleaf"], ["chatgpt", "https://chatgpt.com/", "ChatGPT"], ["google", "about:blank", "Atlas"]]) {
        const button = [...document.querySelectorAll(".hub-shell-shortcut")].find(b => b.getAttribute("aria-label") === title);
        assert(button, title + " footer button exists"); button.click();
        const [leaf, duplicate] = await Promise.all([p.openAppShortcut(id), p.openAppShortcut(id)]);
        assert.equal(leaf, duplicate); leaves.push(leaf);
        const count = app.workspace.getLeavesOfType("webviewer").length;
        button.dispatchEvent(new MouseEvent("click", { detail: 2 })); await delay(20);
        assert.equal(app.workspace.getLeavesOfType("webviewer").length, count, "double-click cannot create an extra window");
        assert.equal(leaf.getViewState().type, "webviewer");
        assert.notEqual(leaf.getContainer(), app.workspace.rootSplit);
        assert.equal(leaf.view.contentEl.ownerDocument, leaf.getContainer().win.document);
        if (url !== "about:blank") await until(() => leaf.view.url?.startsWith(url) || bridge.view().contexts.some(c => c.origin === new URL(url).origin + "/"), title + " native destination");
        if (id === "google") { await until(() => !!leaf.view.contentEl.querySelector(".hub-atlas-home input[type=search]"), "existing Atlas Home"); }
        checks.push(title + " opens in a real Obsidian pop-out; simultaneous requests share one window");
    }
    assert.deepEqual(original.getViewState(), originalState); checks.push("Original note remains intact");
    assert(document.querySelector('.hub-shell-shortcut[aria-label="Zotero"]')); assert(!document.querySelector('.hub-shell-shortcut[aria-label="Google"]'));
    assert.equal(p.atlas, bridge); assert.equal(window.electron.remote.app.listenerCount("web-contents-created"), listenerCount);
    const leaf = leaves[2];
    await until(() => contextFor(leaf), "Atlas Home native guest attached");
    await leaf.view.navigate("http://trusted.test:" + port + "/allowed");
    await until(() => contextFor(leaf)?.phase === "DISPLAYED", "authorized document");
    let context = contextFor(leaf);
    assert(bridge.canActOnContext(context)); checks.push("Allowed document passes native Atlas enforcement and pop-out controls are eligible");
    const guest = window.electron.remote.webContents.fromId(context.nativeId), beforeWindows = window.electron.remote.BrowserWindow.getAllWindows().length;
    await guest.executeJavaScript('window.open("http://blocked.test:' + port + '/popup")'); await delay(150);
    assert.equal(window.electron.remote.BrowserWindow.getAllWindows().length, beforeWindows); checks.push("Website popup cannot create an unprotected window");
    await Promise.resolve(leaf.view.navigate("http://trusted.test:" + port + "/redirect")).catch(() => {});
    await until(() => bridge.view().contexts.some(c => c.nativeId === context.nativeId && c.phase === "BLOCKED"), "blocked redirect");
    checks.push("Redirect to Blacklist is blocked before network delivery");
    await Promise.resolve(leaf.view.navigate("http://trusted.test:" + port + "/journey")).catch(() => {});
    await until(() => contextFor(leaf)?.phase === "DISPLAYED" && contextFor(leaf)?.response?.decision?.reason === "ACTIVE_JOURNEY", "correlated Journey redirect");
    assert.equal(contextFor(leaf).journey.currentHostname, "idp.test");
    checks.push("Correlated sign-in redirect uses the existing bounded Journey");
    await Promise.resolve(leaf.view.navigate("http://unknown.test:" + port + "/access")).catch(() => {});
    await until(() => bridge.view().contexts.some(c => c.origin === "http://unknown.test:" + port + "/" && c.phase === "BLOCKED"), "Greylist blocked");
    context = bridge.view().contexts.find(c => c.origin === "http://unknown.test:" + port + "/" && c.phase === "BLOCKED");
    assert(bridge.canActOnContext(context)); checks.push("Greylist is blocked and remains eligible for existing Access workflow");
    const panel = leaf.view.contentEl.querySelector(".hub-atlas-panel");
    const control = title => [...panel.querySelectorAll("button")].find(b => b.textContent === title && !b.disabled);
    await until(() => control("Request access"), "pop-out Request access control"); control("Request access").click();
    await until(() => control("Confirm and open homepage"), "pop-out confirmation control");
    assert.equal(bridge.view().snapshot.accessState.grants.length, 0);
    control("Confirm and open homepage").click();
    await until(() => contextFor(leaf)?.phase === "DISPLAYED", "confirmed access loads fresh homepage");
    assert.equal(leaf.view.url, "http://unknown.test:" + port + "/");
    assert.equal(bridge.view().snapshot.accessState.grants.length, 1);
    checks.push("Pop-out Access buttons require waiting and explicit confirmation before granting and opening a fresh homepage");
    assert.equal(JSON.stringify(bridge.view().snapshot.policy), before);
    for (const item of leaves) item.detach();
    await delay(650);
    assert.equal(p.atlas, bridge); assert.equal(JSON.stringify(bridge.view().snapshot.policy), before);
    assert.equal(window.electron.remote.app.listenerCount("web-contents-created"), listenerCount);
    assert.equal(JSON.parse(host.viewJSON()).status, "READY");
    checks.push("Closing all pop-outs preserves shared native controller, policy and global listener count");
    return { checks, initialization: initialized.type, authentication: "unverified" };
}
