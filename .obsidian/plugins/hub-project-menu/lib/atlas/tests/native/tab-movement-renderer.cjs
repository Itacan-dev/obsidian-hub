"use strict";
const assert = require("assert/strict");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label, timeout = 7000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        if (await predicate()) return;
        await delay(20);
    }
    throw Error("Tab movement timeout: " + label);
}
const rect = node => {
    const value = node.getBoundingClientRect();
    return { left: value.left, top: value.top, width: value.width, height: value.height };
};
const hidden = node => {
    const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
    return node.hidden || style.display === "none" || style.visibility === "hidden" || bounds.width < 1 || bounds.height < 1;
};
module.exports = async function tabMovementRenderer({ bridge, plugin, nativeLeaf, baseUrl, host, root, note, removeLeaf }) {
    assert.equal(typeof removeLeaf, "function", "The fixture must unregister a truly closed leaf");
    const workspace = plugin.app.workspace, previousActive = workspace.activeLeaf, snapshot = host.view().snapshot;
    const policy = JSON.stringify(snapshot.policy), configuration = JSON.stringify(snapshot.configuration);
    const layout = document.createElement("div"); layout.className = "workspace-split mod-root";
    layout.style.cssText = "position:fixed;left:24px;top:50px;width:920px;height:560px;display:block;pointer-events:auto";
    const group = (left, width) => {
        const node = document.createElement("div"); node.className = "workspace-tabs mod-top";
        node.style.cssText = "position:absolute;top:0;left:" + left + "px;width:" + width + "px;height:520px;display:block;overflow:visible";
        layout.appendChild(node); return node;
    };
    const left = group(0, 420), right = group(470, 420);
    (root ?? document.body).appendChild(layout);
    const url = baseUrl.replace(/\/$/, "").replace("unknown.test", "chatgpt.com") + "/move-state?view=retained#draft";
    const leaf = nativeLeaf(url), view = leaf.view, content = view.contentEl;
    view.containerEl.style.cssText = "position:absolute;inset:0;display:block;overflow:visible";
    content.style.cssText = "position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;overflow:hidden";
    let closed = false, overlay = null, surface = null, guest = null;
    const closeLeaf = async () => {
        if (closed) return; closed = true; removeLeaf(leaf);
        await delay(30);
    };
    try {
        // The guest is created once before any movement. Reparent only the view
        // container; the portal must keep its actual native guest connected.
        left.appendChild(view.containerEl); workspace.activeLeaf = leaf;
        await until(() => {
            let id; try { id = view.webview.getWebContentsId(); } catch (_) { return false; }
            return host.view().contexts.some(c => c.nativeId === id && !c.closed && c.phase === "DISPLAYED");
        }, "initial deep page displayed");
        guest = view.webview;
        await until(() => !guest.isLoading(), "initial page finishes loading");
        const nativeId = guest.getWebContentsId(), context = host.view().contexts.find(c => c.nativeId === nativeId);
        surface = guest.parentElement;
        assert.notEqual(surface, content, "The native guest must live outside the movable pane");
        assert.ok(surface?.isConnected, "The native guest surface stays in the owner document");
        assert.equal(context.response.decision.reason, "WHITELISTED");
        let destroyed = 0, navigations = 0;
        guest.addEventListener("destroyed", () => { destroyed++; });
        guest.addEventListener("did-start-navigation", event => { if (event.isMainFrame) navigations++; });
        await guest.executeJavaScript(`(() => {
            document.body.innerHTML = '<textarea id="atlas-unsent"></textarea><div style="height:3000px"></div>';
            document.body.style.cssText = 'margin:0;min-height:3000px';
            const input = document.getElementById('atlas-unsent');
            input.style.cssText = 'position:fixed;top:18px;left:18px;width:250px;height:80px';
            input.value = 'Unsent conversation retained during movement';
            input.focus({preventScroll:true}); input.setSelectionRange(7,19);
            window.__atlasMoveMarker = 'existing-browser-document';
            window.scrollTo(0,350);
            return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        })()`);
        const expected = await guest.executeJavaScript("({url:location.href,value:document.getElementById('atlas-unsent').value,start:document.getElementById('atlas-unsent').selectionStart,end:document.getElementById('atlas-unsent').selectionEnd,scroll:scrollY,marker:window.__atlasMoveMarker})");
        assert.equal(expected.url, url); assert.equal(expected.scroll, 350);
        const retained = async label => {
            await delay(80);
            assert.equal(view.webview, guest, label + ": same DOM guest");
            assert.equal(guest.getWebContentsId(), nativeId, label + ": same native browser");
            assert.equal(destroyed, 0, label + ": native guest not destroyed");
            assert.equal(navigations, 0, label + ": no replacement navigation");
            const current = host.view().contexts.find(c => c.nativeId === nativeId);
            assert.ok(current && !current.closed && current.phase === "DISPLAYED", label + ": original authority binding stays displayed");
            assert.equal(current.id, context.id, label + ": context identity preserved");
            assert.equal(current.generation, context.generation, label + ": no new navigation generation");
            const actual = await guest.executeJavaScript("({url:location.href,value:document.getElementById('atlas-unsent')?.value,start:document.getElementById('atlas-unsent')?.selectionStart,end:document.getElementById('atlas-unsent')?.selectionEnd,scroll:scrollY,marker:window.__atlasMoveMarker})");
            assert.deepEqual(actual, expected, label + ": exact URL, draft, selection, scroll and JS state");
            assert.equal(content.classList.contains("hub-atlas-blocked"), false, label + ": no access-available interstitial");
            const panel = content.querySelector(".hub-atlas-panel");
            assert.ok(!panel || panel.hidden, label + ": no visible access panel");
        };
        const aligned = async label => {
            await until(() => {
                if (hidden(surface)) return false;
                const a = rect(surface), b = rect(content);
                return ["left", "top", "width"].every(key => Math.abs(a[key] - b[key]) <= 2) && a.height > 100 && a.height <= b.height + 2;
            }, label + ": native surface tracks pane geometry");
            const bounds = rect(content), hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
            assert.ok(hit === guest || surface.contains(hit), label + ": browser remains the pane hit target");
        };
        await aligned("initial");
        for (let i = 0; i < 6; i++) {
            const destination = i % 2 ? left : right;
            view.containerEl.remove(); destination.appendChild(view.containerEl);
            await retained("move " + i); await aligned("move " + i);
        }
        // A drag can temporarily remove the whole tab group for longer than the
        // renderer scan interval. It is still an open workspace leaf.
        view.containerEl.remove();
        await delay(750);
        assert.equal(guest.getWebContentsId(), nativeId, "Transient disconnect does not destroy the browser");
        assert.equal(destroyed, 0);
        await until(() => hidden(surface), "detached tab cannot float over unrelated content");
        left.insertBefore(view.containerEl, left.firstChild);
        await retained("long transient disconnect"); await aligned("long transient disconnect");
        right.appendChild(view.containerEl);
        right.style.display = "none";
        await until(() => hidden(surface), "inactive tab group hides its surface");
        assert.equal(guest.getWebContentsId(), nativeId, "Inactive tab retains its browser");
        right.style.display = "block";
        await retained("inactive tab restored"); await aligned("inactive tab restored");
        // Surface z-order must respect host modals rather than floating over
        // Settings just because the browser is outside the pane DOM.
        overlay = document.createElement("div"); overlay.className = "modal-container";
        overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.2);pointer-events:auto";
        document.body.appendChild(overlay); await delay(50);
        const bounds = rect(content), hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
        assert.ok(overlay === hit || overlay.contains(hit), "Host modal receives hits above the native surface");
        overlay.remove(); overlay = null;
        await retained("modal dismissed"); await aligned("modal dismissed");
        assert.equal(JSON.stringify(host.view().snapshot.policy), policy, "Movement cannot change saved policy");
        assert.equal(JSON.stringify(host.view().snapshot.configuration), configuration, "Movement cannot change protected terms");
        await closeLeaf();
        await until(() => host.view().contexts.every(c => c.nativeId !== nativeId || c.closed), "true close retires native context");
        await until(() => destroyed === 1 || !surface.isConnected, "true close disposes native surface");
        return "PASS tab movement retains native ID, deep URL, unsent input, selection, scroll and JS state without reload; disconnect/inactive/modal geometry and true close remain safe";
    } finally {
        overlay?.remove();
        await closeLeaf();
        layout.remove();
        workspace.activeLeaf = previousActive ?? note;
    }
};
