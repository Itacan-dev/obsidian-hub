"use strict";

// One measured boundary for every Workspace mode. Header sizes and panel
// allocation remain CSS-owned; no banner/status-bar heights are duplicated here.
function mountFullViewLayout({ root, component, app }) {
    const doc = root.ownerDocument, win = doc.defaultView;
    let frame = null, disposed = false;
    const layoutTop = element => {
        let top = 0;
        for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
        return top;
    };
    function update() {
        frame = null;
        if (disposed || !root.isConnected) return;
        const full = !root.closest(".hub-project-rail");
        root.classList.toggle("hub-full-view", full);
        if (!full) { root.style.removeProperty("--hub-full-view-height"); return; }
        const content = [...root.children].find(el => el.matches(".project-main-grid, .hub-task-workspace, .hub-roadmap-host") && !el.hidden);
        if (!content) return;
        const viewport = root.closest(".markdown-preview-view") ?? root.closest(".view-content");
        const status = doc.querySelector(".status-bar");
        let bottom = Math.min(win.innerHeight, viewport?.getBoundingClientRect().bottom ?? win.innerHeight);
        if (status?.getClientRects().length) bottom = Math.min(bottom, status.getBoundingClientRect().top);
        const style = win.getComputedStyle(root);
        const gutter = parseFloat(style.getPropertyValue("--hub-full-view-gutter")) || 0;
        const origin = root.getBoundingClientRect().top + (viewport?.scrollTop ?? win.scrollY);
        const headerHeight = layoutTop(content) - layoutTop(root);
        const minimum = headerHeight + (parseFloat(win.getComputedStyle(content).minHeight) || 0);
        // Home's rows have natural fixed sizes, not a viewport-fill rule. Cap
        // the shared Workspace surface at that same extent while preserving
        // the existing viewport/minimum fallback on shorter windows.
        const homeContentHeight = parseFloat(style.getPropertyValue("--hub-full-view-top-row-height"))
            + parseFloat(style.getPropertyValue("--hub-panel-gap"))
            + parseFloat(style.getPropertyValue("--hub-full-view-bottom-row-height"));
        const homeBoundary = Number.isFinite(homeContentHeight) ? headerHeight + homeContentHeight : Infinity;
        const height = Math.ceil(Math.max(minimum, Math.min(homeBoundary, bottom - origin - gutter)));
        const value = height + "px";
        if (root.style.getPropertyValue("--hub-full-view-height") !== value) root.style.setProperty("--hub-full-view-height", value);
    }
    function schedule() { if (!disposed && frame == null) frame = win.requestAnimationFrame(update); }
    const resize = new win.ResizeObserver(schedule);
    resize.observe(root);
    for (const child of root.children) resize.observe(child);
    const viewport = root.closest(".markdown-preview-view") ?? root.closest(".view-content");
    if (viewport) resize.observe(viewport);
    const status = doc.querySelector(".status-bar");
    if (status) resize.observe(status);
    const mutation = new win.MutationObserver(records => {
        if (records.some(record => record.target === root || record.target.parentElement === root || record.target.contains(root))) schedule();
    });
    mutation.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
    for (let parent = root.parentElement; parent; parent = parent.parentElement) mutation.observe(parent, { attributes: true, attributeFilter: ["class"] });
    win.addEventListener("resize", schedule);
    if (app?.workspace?.on) component.registerEvent(app.workspace.on("layout-change", schedule));
    component.register(() => {
        disposed = true; if (frame != null) win.cancelAnimationFrame(frame);
        resize.disconnect(); mutation.disconnect(); win.removeEventListener("resize", schedule);
        root.classList.remove("hub-full-view"); root.style.removeProperty("--hub-full-view-height");
    });
    update();
    return { update };
}
module.exports = { mountFullViewLayout };
