"use strict";
// Actual frame lifecycle, production view initializer/render functions, native
// calendar, geometry and CSS. Hold background activation to expose late layouts.
function create(tag, o = {}) {
    const el = document.createElement(tag); el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls || "";
    if (o.text != null) el.textContent = o.text;
    for (const [key, value] of Object.entries(o.attr || {})) el.setAttribute(key, value);
    o.parent?.append(el); return el;
}
window.createEl = create; window.createDiv = o => create("div", o); window.createSpan = o => create("span", o);
HTMLElement.prototype.createDiv = function(o) { return create("div", { ...o, parent: this }); };
HTMLElement.prototype.createEl = function(tag, o) { return create(tag, { ...o, parent: this }); };
HTMLElement.prototype.empty = function() { this.replaceChildren(); };
HTMLElement.prototype.setText = function(value) { this.textContent = value; };
const assert = (value, message) => { if (!value) throw Error(message); };
const read = async path => (await fetch(path)).text();
const paint = () => new Promise(resolve => requestAnimationFrame(resolve));
const rect = el => el.getBoundingClientRect();
function sourceFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert(start >= 0, "Production function: " + name);
    let end = source.indexOf("{", start), depth = 1;
    while (depth && ++end < source.length) {
        if (source[end] === "{") depth++; if (source[end] === "}") depth--;
    }
    return source.slice(start, end + 1);
}
const screenshot = label => new Promise(resolve => { window.hubTestScreenshotDone = resolve; window.hubTestScreenshotRequest = label || true; });
async function panelPixels(base64, box) {
    const img = new Image(); img.src = "data:image/png;base64," + base64; await img.decode();
    const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0);
    return ctx.getImageData(Math.ceil(box.left * devicePixelRatio), Math.ceil(box.top * devicePixelRatio),
        Math.floor(box.width * devicePixelRatio) - 1, Math.floor(box.height * devicePixelRatio) - 1).data;
}
window.onload = async () => {
    try {
        const [frameSource, layoutSource, nativeSource, colorSource, uiSource, homeSource, projectSource, fullViewSource] = await Promise.all([
            read("../ui/dashboard-frame.js"), read("../ui/progress-heatmap.js"), read("../../../heatmap-calendar/main.js"),
            read("../ui/progress-colors.js"), read("../ui/dashboard-ui.js"),
            read("../../../../../System/Dashboards/Home/view.js"), read("../../../../../System/Dashboards/Project/view.js"), read("../ui/full-view-layout.js")
        ]);
        const load = (source, require = () => ({})) => { const m = { exports: {} }; new Function("module", "require", source)(m, require); return m.exports; };
        const frames = load(frameSource, () => ({ refreshHeaderImages() {} })), geometry = load(layoutSource), colors = load(colorSource), fullView = load(fullViewSource);
        const Native = load(nativeSource, () => ({ Plugin: class { async loadData() { return {}; } addSettingTab() {} }, PluginSettingTab: class {} })).default;
        const native = new Native(); await native.onload();
        const navigation = new Function("heatmapRevealGraphs", "setHubTooltip", sourceFunction(uiSource, "placeHeatmapNavigation") + ";return placeHeatmapNavigation")(new WeakSet(), () => {});
        let owner, checks = 0, capturedFrames = 0;
        const mount = (kind, width, zoom, year, prepared = false) => {
            owner?.unload(); document.body.style.zoom = zoom;
            owner = { cleanups: [], hubDeferFrameActivation: true, register(fn) { this.cleanups.push(fn); }, unload() { this.cleanups.splice(0).forEach(fn => fn()); } };
            const home = kind === "Home", prefix = home ? "home" : "project", source = home ? homeSource : projectSource;
            const container = prepared ? document.createElement("div") : fixture;
            const frame = frames.createDashboardFrame(container, owner, prefix + "-dashboard hub-button-scope");
            const root = frame.root; root.style.width = width + "px";
            const grid = root.createDiv({ cls: prefix + "-main-grid" });
            let panel;
            if (home) {
                for (const name of ["calendar", "glance", "upcoming", "projects"]) grid.createDiv({ cls: "home-panel home-" + name });
                panel = grid.createDiv({ cls: "home-panel home-recent" });
            } else {
                grid.createDiv({ cls: "project-left-column" }).createDiv({ cls: "project-panel project-folder-stack" });
                const right = grid.createDiv({ cls: "project-right-column" });
                right.createDiv({ cls: "project-panel project-tasks" });
                panel = right.createDiv({ cls: "project-panel project-progress" }); panel.style.height = "429px";
            }
            panel.createDiv({ cls: home ? "home-panel-title" : "project-progress-header", text: "Progress" });
            const section = home ? panel.createDiv({ cls: "home-progress-section" }) : panel;
            const calendar = section.createDiv({ cls: prefix + "-progress-calendar" });
            let layout = geometry.createProgressHeatmap(calendar, owner);
            const toolbar = document.createElement("div"), previous = toolbar.createEl("button"), yearLabel = toolbar.createDiv(), next = toolbar.createEl("button");
            const history = panel.createDiv({ cls: prefix + "-progress-tabs", text: "History" });
            const body = panel.createDiv({ cls: home ? "home-progress-activity-body" : "project-progress-activity" });
            const scroller = home ? body : body.createDiv({ cls: "project-progress-activity-body" });
            for (let i = 0; i < 30; i++) scroller.createDiv({ text: "Recorded progress " + (i + 1) });
            const entries = { [`${year}-01-05`]: 1, [`${year}-01-06`]: 2, [`${year}-01-07`]: 3, [`${year}-01-08`]: 4 };
            const renderName = home ? "renderProgressYear" : "renderProjectProgressYear";
            const heightName = home ? "syncRecentActivityHeight" : "syncProjectActivityHeight";
            const globals = { progressCalendar: calendar, progressYearLabel: yearLabel, previousYear: previous, nextYear: next,
                progressYear: year, progressYears: [year], MIN_PROGRESS_YEAR: 1900, currentProgressYear: year - 1,
                workRatings: entries, projectRatings: entries, workContributors: {}, projectLevelLabels: new Map(),
                progressColors: colors.progressColors, progressColor: colors.progressColor, progressToolbar: toolbar,
                placeHeatmapNavigation: navigation, layoutProgressHeatmap: () => layout(), progressScope: "projects", isResourceContext: kind === "Resource", current: { resourceType: "knowledge", projectId: "sample" },
                root, recent: panel, recentBody: body, progressPanel: panel, activitySection: body };
            const names = Object.keys(globals), values = Object.values(globals);
            const render = new Function(...names, sourceFunction(source, renderName) + ";return " + renderName)(...values);
            const sync = new Function(...names, sourceFunction(source, heightName) + ";return " + heightName)(...values);
            const initialization = source.match(home
                ? /frame\.(?:defer|beforePaint)\(\(\) => \{ refreshWorkProgress\(\); refreshProgressYears\(\); renderProgressYear\(\);[^\n]*?\}\);/
                : /frame\.(?:defer|beforePaint)\(\(\) => \{ refreshProjectProgress\(\); loadInitialProgressYears\(\); renderProjectProgressYear\(\);[^\n]*?\}\);/);
            assert(initialization, "Actual production heatmap initialization found");
            let rendered = 0, secondary = 0;
            new Function("frame", "refreshWorkProgress", "refreshProgressYears", "renderProgressYear", "refreshProjectProgress", "loadInitialProgressYears", "renderProjectProgressYear", "syncRecentActivityHeight", "syncProjectActivityHeight", initialization[0])(
                frame, () => {}, () => {}, () => { rendered++; render(); }, () => {}, () => {}, () => { rendered++; render(); }, sync, sync);
            frame.defer(() => { secondary++; });
            frame.commit();
            if (!home) fullView.mountFullViewLayout({ root, component: owner });
            if (prepared) { assert(!rendered, "Detached preparation waits for measurable attachment"); fixture.replaceChildren(container); frame.activate(); }
            const reference = () => { layout = geometry.createProgressHeatmap(calendar, owner); render(); sync(); };
            return { frame, panel, calendar, history, scroller, render, sync, reference, get rendered() { return rendered; }, get secondary() { return secondary; } };
        };
        const bounds = f => {
            const grid = f.calendar.querySelector(".hub-progress-grid");
            assert(grid && rect(grid).height > 0, "Heatmap occupies its final space immediately after attachment");
            const cell = parseFloat(grid.parentElement.style.getPropertyValue("--hub-heatmap-cell"));
            const gap = parseFloat(grid.parentElement.style.getPropertyValue("--hub-heatmap-gap"));
            const zoom = parseFloat(document.body.style.zoom) || 1;
            assert(Number.isFinite(cell) && cell > 0 && Math.abs(gap * devicePixelRatio * zoom - 1) < 1e-7, "Integer-pixel geometry exists before the first paint");
            assert(Math.abs(rect(grid).height - (7 * cell + 6 * gap) * zoom) < .04, "Seven correctly sized rows reserve the initial calendar height");
            for (const square of grid.children) assert(Math.abs(rect(square).width - cell * zoom) < .04 && Math.abs(rect(square).height - cell * zoom) < .04, "All initial squares use the authoritative geometry");
            assert(rect(f.history).top >= rect(f.calendar).bottom - .04, "History never occupies the calendar area " + JSON.stringify({ root: f.frame.root.className, zoom: document.body.style.zoom, width: f.frame.root.style.width, graph: grid.parentElement.getAttribute("style"), calendar: rect(f.calendar).toJSON(), history: rect(f.history).toJSON() }));
            assert(f.calendar.style.height === "" && f.panel.style.opacity === "", "No placeholder height or visibility trick");
            return { panel: rect(f.panel).toJSON(), calendar: rect(f.calendar).toJSON(), grid: rect(grid).toJSON(), history: rect(f.history).toJSON(), scroller: rect(f.scroller).toJSON() };
        };
        // Cold mount, same-view reload, Home/workspace navigation and Project/
        // Resource switches. Each incoming root is built while the old remains.
        for (const zoom of [1, 1.25]) for (const width of [1560, 1080]) for (const year of [2026, 2012]) {
            for (const kind of ["Home", "Home", "Project", "Resource", "Home"]) {
                const f = mount(kind, width, zoom, year);
                const atAttach = bounds(f);
                assert(f.rendered === 1 && f.secondary === 0, "Geometry is ready while background activation is held");
                for (let i = 0; i < 4; i++) { await paint(); bounds(f); capturedFrames++; }
                const first = bounds(f), initialPixels = await panelPixels(await screenshot(checks === 0 ? `progress-first-frame-${devicePixelRatio}-initial` : null), first.panel);
                // A fresh controller receives the native content-box observation,
                // matching the old settled initialization (rather than the rounded
                // computed width of a repeated refresh on an existing controller).
                f.reference(); await paint(); await paint();
                const final = bounds(f), settledPixels = await panelPixels(await screenshot(checks === 0 ? `progress-first-frame-${devicePixelRatio}-reference` : null), final.panel);
                assert(JSON.stringify(first) === JSON.stringify(final), "First visible and final settled bounds are identical " + JSON.stringify({ kind, width, zoom, year, first, final }));
                assert(atAttach.history.top === final.history.top && atAttach.grid.top === final.grid.top, "Grid and History keep their initial top coordinates");
                assert(initialPixels.length === settledPixels.length && initialPixels.every((v, i) => v === settledPixels[i]), "First panel paint is pixel-identical to the established final layout");
                assert(f.scroller.scrollHeight > f.scroller.clientHeight, "History retains internal scrolling");
                checks++;
            }
        }
        for (const kind of ["Home", "Project", "Resource"]) {
            const f = mount(kind, 1560, 1, 2026, true);
            bounds(f); assert(f.rendered === 1, "Prepared view reserves geometry before first paint");
            f.frame.activate(); assert(f.rendered === 1, "Repeated activation does not duplicate initialization");
            await paint(); bounds(f); checks++;
        }
        result.textContent = `PASS: ${checks} cold/reload/navigation/prepared first-render cases, ${capturedFrames} successive frames, exact first/final bounds and pixel-identical Progress/History; actual view initializers and renderer, DPR ${devicePixelRatio}.`;
    } catch (error) { result.textContent = "FAIL: " + error.stack; }
};
