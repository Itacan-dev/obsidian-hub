"use strict";
const assert = require("assert/strict");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label, timeout = 7500) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        if (await predicate()) return;
        await delay(15);
    }
    throw Error("Moved authority timeout: " + label);
}
const origin = url => new URL(url).origin + "/";
const stateFor = (host, wantedOrigin) => host.view().contexts.find(context => context.origin === wantedOrigin &&
    ["BLOCKED", "ENFORCEMENT_FAILED"].includes(context.phase));
const noSurface = (surface, guest) => !surface.isConnected || surface.hidden || guest.parentElement !== surface ||
    getComputedStyle(surface).display === "none" || getComputedStyle(surface).visibility === "hidden";
module.exports = async function tabMovementAuthorityRenderer({ bridge, plugin, nativeLeaf, baseUrl, host, removeLeaf }) {
    assert.equal(typeof removeLeaf, "function", "Closed leaves must be removed from the fixture workspace");
    const workspace = plugin.app.workspace, previousActive = workspace.activeLeaf;
    const before = host.view().snapshot, policy = JSON.stringify(before.policy), configuration = JSON.stringify(before.configuration);
    const initialNextRequest = before.accessState.nextRequestId;
    const initialURL = baseUrl.replace(/\/$/, "").replace("unknown.test", "move-grant.test") + "/move-authority";
    const grantOrigin = origin(initialURL), hostname = new URL(initialURL).hostname;
    assert.ok(!before.policy.whitelist.includes(hostname) && !before.policy.blacklist.includes(hostname), "Fixture host starts Greylisted");
    const layout = document.createElement("div"); layout.className = "workspace-split mod-root";
    layout.style.cssText = "position:fixed;left:30px;top:60px;width:900px;height:540px;display:block";
    const group = (left, width) => {
        const node = document.createElement("div"); node.className = "workspace-tabs mod-top";
        node.style.cssText = "position:absolute;left:" + left + "px;top:0;width:" + width + "px;height:500px;display:block";
        layout.appendChild(node); return node;
    };
    const left = group(0, 420), right = group(470, 400); document.body.appendChild(layout);
    const leaves = [], close = leaf => {
        const index = leaves.indexOf(leaf);
        if (index < 0) return;
        leaves.splice(index, 1); removeLeaf(leaf);
    };
    const leaf = nativeLeaf(initialURL); leaves.push(leaf);
    const view = leaf.view;
    view.containerEl.style.cssText = "position:absolute;inset:0;display:block;overflow:visible";
    view.contentEl.style.cssText = "position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;overflow:hidden";
    left.appendChild(view.containerEl); workspace.activeLeaf = leaf;
    let guest = null, surface = null;
    try {
        await until(() => stateFor(host, grantOrigin)?.response?.decision?.outcome === "GREYLIST", "unlisted host is initially denied");
        const denied = stateFor(host, grantOrigin);
        assert.ok(denied.closed, "The initially ungranted guest closes");
        assert.ok(!host.view().snapshot.accessState.pendingRequests.some(request => request.hostname === hostname), "A navigation itself cannot request access");
        await delay(100); // Let native destruction finish and publish its final generation.
        await until(() => bridge.view().contexts.some(item => item.id === denied.id &&
            item.generation === host.view().contexts.find(native => native.id === denied.id)?.generation) && bridge.canActOnContext(denied),
            "renderer associates the newly attached leaf before a user action");
        let starts = 0, confirmations = 0;
        const action = async kind => {
            const current = bridge.view().contexts.find(context => context.id === denied.id);
            assert.ok(current, "Original denied context is retained");
            if (kind === "START_ACCESS") starts++;
            if (kind === "CONFIRM_ACCESS_AND_OPEN") confirmations++;
            return bridge.command({ kind, contextId: current.id, generation: current.generation });
        };
        const started = await action("START_ACCESS");
        assert.equal(started.type, "COMMITTED", "One explicit request is saved: " + JSON.stringify(started));
        const request = host.view().snapshot.accessState.pendingRequests.find(item => item.hostname === hostname);
        assert.ok(request);
        await until(() => Date.now() >= request.readyAt, "the original full wait elapses");
        await until(() => host.view().contexts.find(context => context.id === denied.id)?.response?.decision?.outcome === "REQUIRE_CONFIRMATION",
            "ordinary observation exposes confirmation");
        assert.equal((await action("CONFIRM_ACCESS_AND_OPEN")).type, "COMMITTED", "One explicit confirmation is saved");
        await until(() => {
            let id; try { id = view.webview.getWebContentsId(); } catch (_) { return false; }
            return host.view().contexts.some(context => context.nativeId === id && !context.closed &&
                context.phase === "DISPLAYED" && context.response?.decision?.reason === "ACTIVE_GRANT");
        }, "fresh home receives the confirmed grant");
        guest = view.webview;
        const nativeId = guest.getWebContentsId(), context = host.view().contexts.find(item => item.nativeId === nativeId);
        const grant = host.view().snapshot.accessState.grants.find(item => item.requestId === request.id);
        assert.ok(grant); assert.equal(context.response.decision.expiresAt, grant.expiresAt);
        assert.equal(grant.requestId, request.id); assert.equal(grant.expiresAt - grant.issuedAt, request.grantDurationMs);
        surface = guest.parentElement; assert.ok(surface?.isConnected && surface !== view.contentEl, "Grant guest uses the stable surface");
        let destroyed = 0, navigations = 0;
        guest.addEventListener("destroyed", () => { destroyed++; });
        guest.addEventListener("did-start-navigation", event => { if (event.isMainFrame) navigations++; });
        await guest.executeJavaScript("window.__movedGrantDocument='same-granted-document';void 0");
        for (let index = 0; index < 4; index++) {
            view.containerEl.remove(); (index % 2 ? left : right).appendChild(view.containerEl);
            await delay(40);
            assert.equal(guest.getWebContentsId(), nativeId, "Moved temporary page keeps native identity");
            const current = host.view().contexts.find(item => item.id === context.id);
            assert.ok(current && !current.closed && current.phase === "DISPLAYED", "A layout move alone does not end current grant authority");
            assert.equal(current.response.decision.reason, "ACTIVE_GRANT");
            assert.equal(current.response.decision.expiresAt, grant.expiresAt);
            assert.deepEqual(host.view().snapshot.accessState.grants.find(item => item.requestId === grant.requestId), grant);
        }
        assert.equal(await guest.executeJavaScript("window.__movedGrantDocument"), "same-granted-document");
        assert.equal(destroyed, 0); assert.equal(navigations, 0, "Moving a grant never replays its original request");
        assert.equal(starts, 1); assert.equal(confirmations, 1);
        assert.equal(host.view().snapshot.accessState.nextRequestId, initialNextRequest + 1, "Movement never renews/creates a request");

        // A newly attached guest cannot inherit the moved guest's independent
        // native identity or its exact-host temporary scope.
        const otherURL = baseUrl.replace(/\/$/, "").replace("unknown.test", "move-grant-other.test") + "/fresh-context";
        const other = nativeLeaf(otherURL); leaves.push(other);
        await until(() => stateFor(host, origin(otherURL))?.response?.decision?.outcome === "GREYLIST", "a new unrelated guest is still governed");
        const otherContext = stateFor(host, origin(otherURL));
        assert.notEqual(otherContext.id, context.id);
        assert.ok(otherContext.closed);
        assert.ok(!host.view().snapshot.accessState.grants.some(item => item.hostname === "move-grant-other.test"));
        assert.ok(!host.view().snapshot.accessState.pendingRequests.some(item => item.hostname === "move-grant-other.test"));
        close(other);

        // Leave the slot detached at expiry. The main-process lease timer must
        // still remove the actual guest; surface hiding is not authorization.
        view.containerEl.remove();
        await until(() => noSurface(surface, guest), "a detached granted slot cannot float over another tab");
        await until(() => host.view().contexts.find(item => item.id === context.id)?.closed === true,
            "original deadline closes the moved/disconnected grant", Math.max(2000, grant.expiresAt - Date.now() + 2500));
        await until(() => destroyed > 0 || noSurface(surface, guest), "expired native surface is unavailable");
        const expired = host.view().snapshot;
        assert.deepEqual(expired.accessState.grants.find(item => item.requestId === grant.requestId), grant, "Expiry never rewrites original grant terms");
        assert.equal(expired.accessState.nextRequestId, initialNextRequest + 1);
        assert.ok(!expired.accessState.pendingRequests.some(item => item.hostname === hostname), "Expiry does not start another cooldown or request");
        assert.equal(starts, 1); assert.equal(confirmations, 1);

        const afterExpiry = nativeLeaf(initialURL); leaves.push(afterExpiry);
        await until(() => host.view().contexts.some(item => item.id !== context.id && item.origin === grantOrigin &&
            ["BLOCKED", "ENFORCEMENT_FAILED"].includes(item.phase) && item.response?.decision?.outcome === "GREYLIST"),
            "a fresh guest cannot reuse the expired grant");
        assert.equal(host.view().snapshot.accessState.nextRequestId, initialNextRequest + 1);
        assert.equal(JSON.stringify(host.view().snapshot.policy), policy);
        assert.equal(JSON.stringify(host.view().snapshot.configuration), configuration);
        close(afterExpiry);
        return "PASS moved temporary pages retain native identity and original deadline; hidden/disconnected expiry closes authority, fresh guests cannot borrow it, and no request or confirmation is renewed";
    } finally {
        for (const item of [...leaves]) close(item);
        layout.remove(); workspace.activeLeaf = previousActive;
    }
};
