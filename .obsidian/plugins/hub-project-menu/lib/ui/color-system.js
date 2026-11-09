"use strict";

// Explicit DOM ownership only. No preferences, palette selector, or global theme
// overrides. Keep this list in sync with the scoped native bridge in styles.css.
const NATIVE_COLOR_PROPERTIES = Object.freeze([
    "--background-primary",
    "--background-primary-alt",
    "--background-secondary",
    "--background-secondary-alt",
    "--background-modifier-form-field",
    "--background-modifier-form-field-hover",
    "--background-modifier-hover",
    "--background-modifier-active-hover",
    "--background-modifier-border",
    "--background-modifier-border-hover",
    "--background-modifier-border-focus",
    "--background-modifier-message",
    "--background-modifier-cover",
    "--text-normal",
    "--text-muted",
    "--text-faint",
    "--text-on-accent",
    "--text-error",
    "--text-warning",
    "--text-accent",
    "--text-accent-hover",
    "--text-selection",
    "--interactive-normal",
    "--interactive-hover",
    "--dropdown-background",
    "--dropdown-background-hover",
    "--interactive-accent",
    "--interactive-accent-hover",
    "--modal-background",
    "--modal-sidebar-background",
    "--modal-border-color",
    "--checkbox-color",
    "--checkbox-color-hover",
    "--checkbox-marker-color",
    "--checkbox-border-color",
    "--checkbox-border-color-hover",
    "--input-placeholder-color",
    "--input-date-separator",
    "--caret-color",
    "--icon-color",
    "--icon-color-hover",
    "--icon-color-active",
    "--icon-color-focused",
    "--divider-color",
    "--divider-color-hover",
    "--tooltip-background",
    "--tooltip-color",
    "--notice-background",
    "--notice-color",
    "--status-bar-text-color",
    "--menu-background",
    "--menu-border-color",
    "--prompt-background",
    "--prompt-border-color",
    "--suggestion-background",
    "--scrollbar-thumb-bg",
    "--scrollbar-active-thumb-bg",
    "--slider-track-background",
    "--slider-fill-background",
    "--slider-thumb-border-color",
    "--slider-thumb-background",
    "--slider-thumb-background-hover",
    "--toggle-thumb-color",
    "--link-color",
    "--link-color-hover",
    "--link-external-color",
    "--link-external-color-hover",
    "--link-unresolved-color",
    "--list-marker-color",
    "--list-marker-color-hover",
    "--list-marker-color-collapsed",
    "--code-background",
    "--code-normal",
    "--code-border-color",
    "--hr-color",
    "--blockquote-border-color",
    "--search-icon-color",
    "--search-clear-button-color",
    "--table-border-color",
    "--table-header-border-color",
    "--table-header-color",
    "--table-drag-handle-color",
    "--table-selection-border-color",
    "--background-modifier-error",
    "--background-modifier-error-hover",
    "--background-modifier-warning",
    "--background-modifier-warning-hover",
    "--background-modifier-success",
    "--color-accent",
    "--color-accent-1",
    "--color-accent-2",
    "--input-shadow",
    "--input-shadow-hover",
    "--shadow-s",
    "--shadow-l",
    "--modal-shadow",
    "--slider-thumb-shadow",
    "--slider-thumb-shadow-hover",
    "--slider-thumb-shadow-active",
    "--slider-thumb-shadow-focus",
    "--tooltip-shadow",
    "--menu-shadow",
    "--color-base-70",
    "--color-purple",
    "--color-base-25",
    "--color-pink",
    "--color-base-05",
    "--color-blue-rgb",
    "--color-base-100",
    "--color-base-40",
    "--color-pink-rgb",
    "--color-base-00",
    "--color-yellow-rgb",
    "--color-base-50",
    "--color-orange",
    "--color-base-60",
    "--color-base-35",
    "--color-orange-rgb",
    "--color-base-30",
    "--color-base-10",
    "--color-green",
    "--color-purple-rgb",
    "--color-red-rgb",
    "--color-green-rgb",
    "--color-base-20",
    "--color-cyan-rgb",
    "--color-cyan",
    "--color-red",
    "--color-blue",
    "--color-yellow",
    "--accent-h",
    "--accent-s",
    "--accent-l",
    "--color-accent-hsl",
    "--interactive-accent-hsl",
    "--mono-0",
    "--mono-100",
    "--mono-rgb-0",
    "--mono-rgb-100",
    "--link-unresolved-decoration-color",
    "--background-modifier-error-rgb",
    "--background-modifier-success-rgb",
    "--background-modifier-box-shadow",
    "--table-background",
    "--table-header-background",
    "--table-column-alt-background",
    "--table-row-alt-background",
    "--code-comment",
    "--code-function",
    "--code-important",
    "--code-keyword",
    "--code-operator",
    "--code-property",
    "--code-punctuation",
    "--code-string",
    "--code-tag",
    "--code-value",
    "--text-success"
]);
const SCOPE = "hub-color-scope", ISLAND = "hub-color-host-island";
const roots = new WeakMap(), documents = new WeakMap(), modals = new WeakMap(), activeDocuments = new Set();
const ownedPrefix = name => /^--hub-(?:palette-|color-|oath-(?:active|focus|selection|action|pledge|pinned|workspace-badge)|progress-(?:rgb|today-border)|roadmap-phase-|effect-)/.test(name);
function hasColorOwner(element) {
    if (element?.closest?.("." + ISLAND)) return false;
    const boundary = element?.closest?.("." + SCOPE + ", ." + ISLAND);
    return !!boundary?.classList.contains(SCOPE);
}
function documentState(doc) {
    if (documents.has(doc)) return documents.get(doc);
    const state = { roots: new Set(), islands: new Set(), queued: false, hostDirty: false };
    const refresh = () => {
        state.queued = false;
        for (const item of [...state.roots]) {
            if (item.root.isConnected) item.attached = true;
            else if (item.attached) item.dispose();
        }
        if (state.hostDirty) { state.hostDirty = false; for (const island of state.islands) island.refresh(); }
        if (!state.roots.size && !state.islands.size) {
            state.removals.disconnect(); state.host.disconnect(); doc.defaultView.removeEventListener("pagehide", state.release);
            if (documents.get(doc) === state) { documents.delete(doc); activeDocuments.delete(doc); }
        }
    };
    const queue = (hostDirty = false) => { if (hostDirty) state.hostDirty = true; if (!state.queued) { state.queued = true; queueMicrotask(refresh); } };
    state.removals = new doc.defaultView.MutationObserver(records => {
        if (records.some(record => record.removedNodes.length || record.addedNodes.length)) queue();
    });
    state.removals.observe(doc.body, { childList: true, subtree: true });
    state.host = new doc.defaultView.MutationObserver(() => queue(true));
    state.host.observe(doc.body, { attributes: true, attributeFilter: ["class", "style"] });
    state.release = () => {
        for (const island of [...state.islands]) island.dispose();
        for (const item of [...state.roots]) item.dispose();
        state.removals.disconnect(); state.host.disconnect(); doc.defaultView.removeEventListener("pagehide", state.release);
        if (documents.get(doc) === state) { documents.delete(doc); activeDocuments.delete(doc); }
    };
    doc.defaultView.addEventListener("pagehide", state.release);
    state.refresh = queue; state.refreshHost = () => queue(true); documents.set(doc, state); activeDocuments.add(doc); return state;
}
function ownColorRoot(root) {
    if (!root?.classList || !root.ownerDocument?.defaultView || root.closest("." + ISLAND)) return () => {};
    if (roots.has(root)) return roots.get(root).dispose;
    const added = !root.classList.contains(SCOPE), origins = new Map();
    root.classList.add(SCOPE);
    const doc = root.ownerDocument, state = documentState(doc);
    let disposed = false;
    const prepare = node => {
        if (node.nodeType !== 1 || node.closest?.("." + ISLAND)) return;
        if (node.hasAttribute("aria-label") && hasColorOwner(node)) {
            const classes = (node.getAttribute("data-tooltip-classes") || "").split(/\s+/).filter(Boolean);
            if (!classes.includes(SCOPE)) {
                origins.set(node, true); classes.push(SCOPE);
                node.setAttribute("data-tooltip-classes", classes.join(" "));
            }
        }
        node.querySelectorAll?.("[aria-label]").forEach(child => {
            if (!child.closest("." + ISLAND)) prepareOrigin(child);
        });
    };
    const prepareOrigin = node => {
        if (!hasColorOwner(node)) return;
        const classes = (node.getAttribute("data-tooltip-classes") || "").split(/\s+/).filter(Boolean);
        if (!classes.includes(SCOPE)) { origins.set(node, true); classes.push(SCOPE); node.setAttribute("data-tooltip-classes", classes.join(" ")); }
    };
    const observer = new doc.defaultView.MutationObserver(records => {
        for (const record of records) {
            if (record.type === "childList") for (const node of record.addedNodes) prepare(node);
            else if (!record.target.closest?.("." + ISLAND)) prepareOrigin(record.target);
        }
        for (const node of origins.keys()) if (!root.contains(node) && node !== root) {
            const values = (node.getAttribute("data-tooltip-classes") || "").split(/\s+/).filter(x => x && x !== SCOPE);
            if (values.length) node.setAttribute("data-tooltip-classes", values.join(" ")); else node.removeAttribute("data-tooltip-classes");
            origins.delete(node);
        }
    });
    const item = { root, attached: root.isConnected, dispose() {
        if (disposed) return; disposed = true; observer.disconnect();
        for (const node of origins.keys()) {
            const classes = (node.getAttribute("data-tooltip-classes") || "").split(/\s+/).filter(x => x && x !== SCOPE);
            if (classes.length) node.setAttribute("data-tooltip-classes", classes.join(" ")); else node.removeAttribute("data-tooltip-classes");
        }
        origins.clear(); if (added) root.classList.remove(SCOPE);
        roots.delete(root); state.roots.delete(item); state.refresh();
    } };
    roots.set(root, item); state.roots.add(item); prepare(root);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "data-tooltip-classes"] });
    return item.dispose;
}
function ownModalColors(modal) {
    if (modals.has(modal)) return modals.get(modal);
    const dispose = ownColorRoot(modal.containerEl || modal.modalEl);
    const original = modal.onClose, descriptor = Object.getOwnPropertyDescriptor(modal, "onClose");
    const release = () => { dispose(); modals.delete(modal); if (modal.onClose === wrapped) { if (descriptor) Object.defineProperty(modal, "onClose", descriptor); else delete modal.onClose; } };
    function wrapped(...args) {
        try { const result = original?.apply(this, args); if (result?.finally) return result.finally(release); release(); return result; }
        catch (error) { release(); throw error; }
    }
    modal.onClose = wrapped; modals.set(modal, release); return release;
}
function ownMenuColors(menu) {
    const dispose = ownColorRoot(menu?.dom);
    menu?.onHide?.(() => { if (!menu.dom?.isConnected) dispose(); }); return menu;
}
function ownNoticeColors(notice) {
    // noticeEl is the message; containerEl owns the native notification paint.
    ownColorRoot(notice?.containerEl || notice?.noticeEl?.parentElement); return notice;
}
function inheritColorOwner(element, origin) {
    return hasColorOwner(origin) ? ownColorRoot(element) : () => {};
}
function hostColorIsland(root) {
    const doc = root.ownerDocument, state = documentState(doc), saved = new Map();
    const hadIsland = root.classList.contains(ISLAND); root.classList.add(ISLAND);
    const set = (name, value) => {
        if (!saved.has(name)) saved.set(name, [root.style.getPropertyValue(name), root.style.getPropertyPriority(name)]);
        root.style.setProperty(name, value);
    };
    const island = { refresh() {
        const host = doc.defaultView.getComputedStyle(doc.body);
        for (const name of NATIVE_COLOR_PROPERTIES) set(name, host.getPropertyValue(name).trim() || "initial");
        const inherited = doc.defaultView.getComputedStyle(root);
        for (const name of inherited) if (ownedPrefix(name)) set(name, "initial");
        set("color", host.color); set("background-color", host.getPropertyValue("--modal-background").trim() || host.backgroundColor);
        for (const element of [root, ...root.querySelectorAll("[data-tooltip-classes]")]) {
            const classes = (element.getAttribute("data-tooltip-classes") || "").split(/\s+/).filter(x => x && x !== SCOPE);
            if (classes.length) element.setAttribute("data-tooltip-classes", classes.join(" ")); else element.removeAttribute("data-tooltip-classes");
        }
    } };
    state.islands.add(island); island.refresh();
    let disposed = false;
    const dispose = () => {
        if (disposed) return; disposed = true;
        state.islands.delete(island);
        for (const [name, [value, priority]] of saved) { if (value) root.style.setProperty(name, value, priority); else root.style.removeProperty(name); }
        if (!hadIsland) root.classList.remove(ISLAND); state.refresh();
    };
    island.dispose = dispose; return dispose;
}
function refreshHostColorReferences(doc) { documents.get(doc)?.refreshHost(); }
function disposeColorSystem() {
    for (const doc of [...activeDocuments]) documents.get(doc)?.release();
}
module.exports = { disposeColorSystem, ownColorRoot, ownModalColors, ownMenuColors, ownNoticeColors, inheritColorOwner, hasColorOwner, hostColorIsland, refreshHostColorReferences, NATIVE_COLOR_PROPERTIES };
