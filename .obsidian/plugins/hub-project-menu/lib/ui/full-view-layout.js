"use strict";

// One measured boundary for every Workspace mode. Header sizes and panel
// allocation remain CSS-owned; no banner/status-bar heights are duplicated here.
function mountFullViewLayout({ root, component, app }) {
    const doc = root.ownerDocument, win = doc.defaultView;
    const sizingProperties = [
        "--hub-full-view-height",
        "--hub-full-view-top-row-track",
        "--hub-full-view-bottom-row-track"
    ];
    let frame = null, disposed = false;
    function update() {
        frame = null;
        if (disposed || !root.isConnected) return;
        const full = !root.closest(".hub-project-rail");
        root.classList.toggle("hub-full-view", full);
        if (!full) {
            for (const property of sizingProperties) root.style.removeProperty(property);
            return;
        }
        const content = [...root.children].find(el => el.matches(".project-main-grid, .hub-task-workspace, .hub-roadmap-host") && !el.hidden);
        if (!content) return;
        const viewport = root.closest(".markdown-preview-view") ?? root.closest(".view-content");
        const status = doc.querySelector(".status-bar");
        let bottom = Math.min(win.innerHeight, viewport?.getBoundingClientRect().bottom ?? win.innerHeight);
        if (status?.getClientRects().length) bottom = Math.min(bottom, status.getBoundingClientRect().top);
        const style = win.getComputedStyle(root);
        const gutter = parseFloat(style.getPropertyValue("--hub-full-view-gutter")) || 0;
        // Rectangles include CSS zoom; CSS height tokens do not. Keep the
        // fractional header height so rounding cannot shift shared row edges.
        const bounds = root.getBoundingClientRect();
        const scale = root.currentCSSZoom || bounds.width / parseFloat(style.width) || 1;
        const scrollScale = viewport?.currentCSSZoom || 1;
        const origin = bounds.top + (viewport?.scrollTop ?? win.scrollY) * scrollScale;
        const headerHeight = (content.getBoundingClientRect().top - bounds.top) / scale;
        const minimum = headerHeight + (parseFloat(win.getComputedStyle(content).minHeight) || 0);
        // Home's fixed rows define the shared desktop target. Workspace Work
        // divides its measured content height in the same target proportions.
        // CSS track minimums provide outer scrolling on short/narrow windows.
        // Schedule and Roadmap retain their own content minimums and layouts.
        const topRowHeight = parseFloat(style.getPropertyValue("--hub-full-view-top-row-height"));
        const bottomRowHeight = parseFloat(style.getPropertyValue("--hub-full-view-bottom-row-height"));
        const dashboardHeight = topRowHeight
            + parseFloat(style.getPropertyValue("--hub-panel-gap"))
            + bottomRowHeight;
        if (Number.isFinite(dashboardHeight)) {
            // Convert the CSS pixel targets to proportional grid tracks without
            // duplicating their values in CSS weights or viewport calculations.
            const rowTracks = [
                ["--hub-full-view-top-row-track", topRowHeight],
                ["--hub-full-view-bottom-row-track", bottomRowHeight]
            ];
            for (const [property, rowHeight] of rowTracks) {
                const track = rowHeight + "fr";
                if (root.style.getPropertyValue(property) !== track) root.style.setProperty(property, track);
            }
        }
        const target = Number.isFinite(dashboardHeight) ? headerHeight + dashboardHeight : Infinity;
        const available = (bottom - origin) / scale - gutter;
        // Chromium lays out in 1/64px units. Match that precision to avoid
        // ResizeObserver churn from tiny floating-point differences under zoom.
        const height = Math.round(Math.max(minimum, Math.min(target, available)) * 64) / 64;
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
        root.classList.remove("hub-full-view");
        for (const property of sizingProperties) root.style.removeProperty(property);
    });
    update();
    return { update };
}
module.exports = { mountFullViewLayout };
