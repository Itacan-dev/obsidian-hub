"use strict";
// Actual heatmap renderer and actual dashboard month-positioning functions;
// isolated sample data, shared production styles and the enabled vault snippets.
const assert = (value, message) => { if (!value) throw Error(message); };
const near = (a, b, message) => assert(Math.abs(a - b) <= .04, `${message}: ${a} / ${b}`);
const rect = element => element.getBoundingClientRect();
const read = async path => (await fetch(path)).text();
function create(tag, options = {}) {
    const element = document.createElement(tag);
    element.className = Array.isArray(options.cls) ? options.cls.join(" ") : options.cls || "";
    if (options.text != null) element.textContent = options.text;
    for (const [key, value] of Object.entries(options.attr || {})) element.setAttribute(key, value);
    options.parent?.append(element);
    return element;
}
window.createDiv = options => create("div", options);
window.createEl = create;
window.createSpan = options => create("span", options);
function sourceFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert(start >= 0, "Production function found: " + name);
    let end = source.indexOf("{", start), depth = 1;
    while (depth && ++end < source.length) {
        if (source[end] === "{") depth++;
        if (source[end] === "}") depth--;
    }
    return source.slice(start, end + 1);
}
window.onload = async () => {
    try {
        const [rendererSource, homeSource, projectSource, uiSource] = await Promise.all([
            read("../../../heatmap-calendar/main.js"),
            read("../../../../../System/Dashboards/Home/view.js"),
            read("../../../../../System/Dashboards/Project/view.js"), read("../ui/dashboard-ui.js")
        ]);
        const module = { exports: {} };
        const native = { Plugin: class { async loadData() { return {}; } addSettingTab() {} }, PluginSettingTab: class {} };
        new Function("module", "require", rendererSource)(module, () => native);
        await new module.exports.default().onload();
        const colors = ["#0e4429", "#006d32", "#26a641", "#39d353"];
        const entries = Array.from({ length: 28 }, (_, day) => ({ date: `2026-09-${String(day + 1).padStart(2, "0")}`, intensity: day % 4 + 1 }));
        const host = document.getElementById("fixture"), viewport = host.closest(".markdown-preview-view");
        const roots = {};
        const mount = kind => {
            host.replaceChildren();
            const home = kind === "Home", prefix = home ? "home" : "project";
            const root = create("div", { cls: prefix + "-dashboard hub-button-scope", parent: host });
            create("div", { cls: prefix + "-cover", parent: root });
            const nav = create("div", { cls: prefix + "-nav", parent: root });
            for (const label of ["Home", "Workspace", "Last File", "Presets"]) create("button", { text: label, parent: nav });
            create("div", { cls: prefix + "-header", text: home ? "Good afternoon" : kind, parent: root });
            const search = create("div", { cls: "hub-context-bar", parent: root });
            create("span", { text: "Search Itacan…", parent: search });
            const grid = create("div", { cls: prefix + "-main-grid", parent: root });
            let panel;
            if (home) {
                for (const [name, cls] of [["Calendar", "calendar"], ["Today's Focus", "glance"], ["Tasks", "upcoming"], ["Projects / Resources", "projects"]]) create("div", { cls: "home-panel home-" + cls, text: name, parent: grid });
                panel = create("div", { cls: "home-panel home-recent", parent: grid });
            } else {
                const left = create("div", { cls: "project-left-column", parent: grid });
                create("div", { cls: "project-panel project-folder-stack", text: "Files", parent: left });
                const right = create("div", { cls: "project-right-column", parent: grid });
                create("div", { cls: "project-panel project-tasks", text: "Tasks", parent: right });
                panel = create("div", { cls: "project-panel project-progress", parent: right });
            }
            create("div", { cls: home ? "home-panel-title" : "project-progress-title", text: "Progress", parent: panel });
            const section = home ? create("div", { cls: "home-progress-section", parent: panel }) : panel;
            const calendar = create("div", { cls: prefix + "-progress-calendar", parent: section });
            window.renderHeatmapCalendar(calendar, { year: 2026, colors: { default: colors }, entries, showCurrentDayBorder: false });
            const name = home ? "alignProgressMonths" : "alignProjectProgressMonths";
            new Function("progressCalendar", sourceFunction(home ? homeSource : projectSource, name) + `;${name}();`)(calendar);
            const year = create("span", { text: "2026" }), toolbar = create("div");
            new Function("heatmapRevealGraphs", "setHubTooltip", sourceFunction(uiSource, "placeHeatmapNavigation") + ";return placeHeatmapNavigation;")(new WeakSet(), () => {})(calendar, toolbar, create("button", { text: "‹" }), year, create("button", { text: "›" }));
            create("div", { cls: home ? "home-history-title" : "project-progress-subtitle", text: "History", parent: panel });
            const boxes = calendar.querySelector(".heatmap-calendar-boxes"), months = calendar.querySelector(".heatmap-calendar-months");
            return { root, grid, panel, calendar, boxes, months, search };
        };
        const check = f => {
            const bounds = rect(f.root), outer = rect(viewport), style = getComputedStyle(viewport);
            const available = outer.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            near(bounds.width, Math.min(1500, available), "Shared capped canvas");
            near(bounds.left + bounds.width / 2, outer.left + outer.width / 2, "Centered canvas");
            near(rect(f.search).width, bounds.width, "Search follows canvas");
            near(rect(f.grid).width, bounds.width, "Panels follow canvas");
            const cells = [...f.boxes.children], first = rect(cells[0]);
            assert(getComputedStyle(f.boxes).gridTemplateRows.split(" ").length === 7, "Exactly seven rows");
            assert(getComputedStyle(f.boxes).gridTemplateColumns.split(" ").length === 53, "Existing 53 weeks");
            for (let i = 0; i < cells.length; i++) {
                const box = rect(cells[i]);
                near(box.width, box.height, "Square cell " + i);
                near(box.width, first.width, "Equal cell " + i);
                if (i % 7) near(box.top - rect(cells[i - 1]).bottom, 1, "Vertical gap " + i);
                if (i >= 7) near(box.left - rect(cells[i - 7]).right, 1, "Horizontal gap " + i);
            }
            near(rect(f.boxes).left, rect(f.months).left, "Months and cells share the year gutter");
            const year = f.calendar.querySelector(".hub-heatmap-year");
            near(rect(year).left, rect(f.calendar).left, "Year at normal left content boundary");
            assert(rect(year).right < rect(f.months.firstElementChild).left, "Year never overlaps January");
            near(rect(f.boxes).right, rect(f.calendar).right, "Grid reaches right content boundary");
            const panelStyle = getComputedStyle(f.panel), panelBounds = rect(f.panel);
            near(rect(f.boxes).right, panelBounds.right - parseFloat(panelStyle.borderRightWidth) - parseFloat(panelStyle.paddingRight), "No unused scrollbar strip outside heatmap");
            near(rect(f.calendar).left, panelBounds.left + parseFloat(panelStyle.borderLeftWidth) + parseFloat(panelStyle.paddingLeft), "Standard left padding retained");
            const december = f.months.lastElementChild;
            assert(rect(december).right <= rect(f.calendar).right && december.scrollWidth <= december.clientWidth + 1, "December text is not clipped");
            // Compare with the old reserved gutter without changing panel size.
            const height = rect(f.calendar).height, width = rect(f.boxes).width;
            f.panel.style.scrollbarGutter = "stable";
            const oldHeight = rect(f.calendar).height, oldWidth = rect(f.boxes).width;
            near(rect(f.panel).height, panelBounds.height, "Outer panel height unchanged");
            f.panel.style.removeProperty("scrollbar-gutter");
            assert(width >= oldWidth && width - oldWidth <= 16, "Only unused scrollbar space is reclaimed");
            assert(height >= oldHeight && height - oldHeight < 2.2, "Square-cell widening adds less than 2.2px of height");
            near(rect(cells[364]).right, rect(f.calendar).right, "Final week reaches right boundary");
            for (const label of f.months.children) {
                const day = f.boxes.querySelector(".month-" + label.textContent.toLowerCase());
                near(rect(label).left, rect(day).left, label.textContent + " follows actual week");
            }
            const labels = [...f.months.children];
            for (let i = 1; i < labels.length; i++) assert(rect(labels[i - 1]).right <= rect(labels[i]).left, "Month labels never overlap");
            assert(f.grid.scrollWidth <= f.grid.clientWidth + 1, "No horizontal grid overflow");
            assert(document.documentElement.scrollWidth <= innerWidth, "No horizontal page overflow");
            assert(rect(f.calendar).height < 100, "Compact heatmap height");
            const empty = f.calendar.cloneNode(false);
            f.calendar.after(empty);
            // Seven independently rounded grid rows can accumulate a few
            // layout subpixels relative to the continuous placeholder formula.
            assert(Math.abs(rect(empty).height - rect(f.calendar).height) <= .125, "Loading placeholder matches rendered height");
            empty.remove();
            roots[f.root.className] = bounds.width;
        };
        for (const readable of [false, true]) {
            viewport.classList.toggle("is-readable-line-width", readable);
            for (const kind of ["Home", "Project", "Knowledge", "Research"]) check(mount(kind));
        }
        near(roots["home-dashboard hub-button-scope"], roots["project-dashboard hub-button-scope"], "Home/Workspace width parity");
        window.previewDesktopProgress = kind => mount(kind);
        mount("Home");
        document.getElementById("result").textContent = `PASS: ${innerWidth}px / DPR ${devicePixelRatio}; Home/Project/Resources, readable width on/off, cap and centering, 7 rows, square equal cells, 1px gaps, full content width, actual month-week alignment and no overflow.`;
    } catch (error) { document.getElementById("result").textContent = "FAIL: " + error.stack; }
};
