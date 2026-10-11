"use strict";
// Actual heatmap renderer, shared geometry and dashboard History sizing;
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
        const [rendererSource, homeSource, projectSource, uiSource, layoutSource] = await Promise.all([
            read("../../../heatmap-calendar/main.js"),
            read("../../../../../System/Dashboards/Home/view.js"),
            read("../../../../../System/Dashboards/Project/view.js"), read("../ui/dashboard-ui.js"), read("../ui/progress-heatmap.js")
        ]);
        const layoutModule = { exports: {} };
        new Function("module", layoutSource)(layoutModule);
        const module = { exports: {} };
        const native = { Plugin: class { async loadData() { return {}; } addSettingTab() {} }, PluginSettingTab: class {} };
        new Function("module", "require", rendererSource)(module, () => native);
        await new module.exports.default().onload();
        const colors = ["#0e4429", "#006d32", "#26a641", "#39d353"];
        const entries = Array.from({ length: 28 }, (_, day) => ({ date: `2026-09-${String(day + 1).padStart(2, "0")}`, intensity: day % 4 + 1 }));
        const host = document.getElementById("fixture"), viewport = host.closest(".markdown-preview-view");
        let dispose = () => {};
        const mount = (kind, selectedYear = 2026) => {
            dispose();
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
            const heading = create("div", { cls: home ? "home-panel-title" : "project-progress-header", parent: panel });
            create("div", { cls: home ? "" : "project-progress-title", text: "Progress", parent: heading });
            const section = home ? create("div", { cls: "home-progress-section", parent: panel }) : panel;
            const calendar = create("div", { cls: prefix + "-progress-calendar", parent: section });
            window.renderHeatmapCalendar(calendar, { year: selectedYear, colors: { default: colors }, entries, showCurrentDayBorder: false });
            const year = create("span", { text: String(selectedYear) }), toolbar = create("div");
            new Function("heatmapRevealGraphs", "setHubTooltip", sourceFunction(uiSource, "placeHeatmapNavigation") + ";return placeHeatmapNavigation;")(new WeakSet(), () => {})(calendar, toolbar, create("button", { text: "‹" }), year, create("button", { text: "›" }));
            const refresh = layoutModule.exports.createProgressHeatmap(calendar, { register(fn) { dispose = fn; } });
            refresh();
            const history = create("div", { cls: home ? "home-progress-tabs" : "project-progress-tabs", text: "History", parent: panel });
            const body = create("div", { cls: home ? "home-progress-activity-body" : "project-progress-activity", parent: panel });
            const scroller = home ? body : create("div", { cls: "project-progress-activity-body", parent: body });
            for (let i = 0; i < 25; i++) create("div", { text: "Sample progress report " + (i + 1), parent: scroller });
            const task = create("div", { cls: "home-completed-task-row", parent: scroller });
            const undertext = create("div", { cls: "home-recent-type", text: "Obsidian Hub", parent: task });
            // Use the production remaining-height calculations after layout.
            const heightSource = home ? homeSource : projectSource;
            const heightName = home ? "syncRecentActivityHeight" : "syncProjectActivityHeight";
            const heightSync = new Function("root", "recent", "recentBody", "progressPanel", "activitySection", sourceFunction(heightSource, heightName) + ";return " + heightName)(root, panel, body, panel, body);
            const boxes = calendar.querySelector(".heatmap-calendar-boxes"), months = calendar.querySelector(".heatmap-calendar-months");
            return { root, grid, panel, calendar, boxes, months, search, heading, history, body, scroller, undertext, heightSync, selectedYear };
        };
        const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        let checks = 0;
        const check = f => {
            const cells = [...f.boxes.children], first = rect(cells[0]);
            const weeks = Math.ceil(cells.length / 7), graph = f.months.parentElement;
            const scale = parseFloat(document.body.style.zoom) || 1;
            assert(getComputedStyle(f.boxes).gridTemplateRows.split(" ").length === 7, "Exactly seven rows");
            assert(getComputedStyle(f.boxes).gridTemplateColumns.split(" ").length === weeks, "Actual calendar week count");
            for (let i = 0; i < cells.length; i++) {
                const box = rect(cells[i]);
                near(box.width, box.height, "Square cell " + i);
                near(box.width, first.width, "Equal cell " + i);
                near(box.width * devicePixelRatio, Math.round(box.width * devicePixelRatio), "Integral device-pixel square " + i);
                if (i % 7) near(box.top - rect(cells[i - 1]).bottom, 1 / devicePixelRatio, "Vertical gap " + i);
                if (i >= 7) near(box.left - rect(cells[i - 7]).right, 1 / devicePixelRatio, "Horizontal gap " + i);
            }
            near(rect(f.boxes).left, rect(f.months).left, "Common calendar area");
            near(rect(f.boxes).left - rect(graph).left, rect(graph).right - rect(f.boxes).right, "Symmetric margins");
            assert(!graph.querySelector(".hub-heatmap-year, .heatmap-calendar-year"), "No year label for any displayed year");
            near(rect(f.calendar).left, rect(f.scroller).left, "Calendar uses History's full left boundary");
            near(rect(f.calendar).right, rect(f.scroller).right, "Calendar includes History's scrollbar allocation");
            assert((first.width + 1 / devicePixelRatio) * weeks + (weeks - 1) / devicePixelRatio > rect(graph).width - .04, "No larger device-pixel square fits; no reserved year gutter");
            for (const label of f.months.children) {
                for (const property of ["fontSize", "fontWeight", "color"]) assert(getComputedStyle(label)[property] === getComputedStyle(f.undertext)[property], "Month matches History workspace " + property);
                const day = f.boxes.querySelector(".month-" + label.getAttribute("aria-label").slice(0, 3).toLowerCase());
                near(rect(label).left, rect(day).left, label.textContent + " follows actual week");
            }
            const labels = [...f.months.children];
            for (let i = 1; i < labels.length; i++) assert(rect(labels[i - 1]).right < rect(labels[i]).left, "Readable separated labels");
            assert(rect(labels.at(-1)).right < rect(graph).right, "December fits");
            if (rect(graph).width <= rect(f.calendar).width + .1) {
                assert(f.calendar.scrollWidth <= f.calendar.clientWidth + 1, "No hidden measurement or navigation overflow");
            }
            const days = cells.filter(cell => cell.className.includes("month-"));
            const count = (Date.UTC(f.selectedYear + 1, 0, 1) - Date.UTC(f.selectedYear, 0, 1)) / 86400000;
            assert(days.length === count, "All calendar dates including leap day");
            assert(cells.length === weeks * 7, "Complete seven-day columns including both year boundaries");
            for (const cell of cells.filter(cell => cell.classList.contains("hub-progress-padding"))) {
                assert(!cell.hasAttribute("data-date") && !cell.hasAttribute("tabindex") && cell.getAttribute("aria-hidden") === "true", "Padding has no date or keyboard interaction");
                assert(getComputedStyle(cell).backgroundColor === "rgb(19, 24, 32)", "Neutral padding matches empty days");
            }
            days.forEach((cell, i) => assert(cell.classList.contains("month-" + new Date(f.selectedYear, 0, i + 1).toLocaleString("en-US", { month: "short" }).toLowerCase()), "Correct date/month"));
            near(rect(f.boxes).top - rect(f.months).bottom, 4 * scale, "Compact month-to-square breathing room");
            near(rect(f.history).top, rect(f.calendar).bottom, "History follows the calendar without extra workspace spacing");
            // Integer scrollWidth/clientWidth can be equal even when a subpixel
            // overflow legitimately displays the narrow-panel scrollbar.
            if (rect(graph).width <= rect(f.calendar).width + .04) {
                near(rect(f.calendar).bottom - rect(f.boxes).bottom,
                    (18 + parseFloat(getComputedStyle(f.calendar).borderBottomWidth)) * scale,
                    `Squares-to-History breathing room (${f.root.className}, ${f.selectedYear}, zoom ${scale}, panel ${f.panel.style.width}, calendar ${rect(f.calendar).width}, graph ${rect(graph).width}, scroll/client ${f.calendar.scrollWidth}/${f.calendar.clientWidth})`);
            }
            const panelBottom = rect(f.panel).bottom;
            f.heightSync();
            near(rect(f.panel).bottom, panelBottom, "Panel bottom preserved");
            assert(f.scroller.scrollHeight > f.scroller.clientHeight, "History retains scrolling");
            const panelStyle = getComputedStyle(f.panel);
            const bottom = rect(f.panel).bottom - (parseFloat(panelStyle.paddingBottom) + parseFloat(panelStyle.borderBottomWidth)) * scale;
            assert(rect(f.scroller).bottom <= bottom + .1 && rect(f.scroller).bottom >= bottom - 2 * scale, "History ends at panel bottom padding under zoom");
            // Scroll fallback is local to the calendar; the final month remains reachable.
            f.calendar.scrollLeft = f.calendar.scrollWidth;
            assert(rect(labels.at(-1)).right <= rect(f.calendar).right + .1, "December reachable even in narrow panels");
            f.calendar.scrollLeft = 0;
            const arrows = [...graph.querySelectorAll(".hub-heatmap-arrow")];
            for (const arrow of arrows) {
                assert(rect(arrow).top >= rect(f.boxes).bottom - .04 && rect(arrow).bottom <= rect(f.calendar).bottom + .04, "Navigation fits below clickable dates and above History");
                assert(rect(arrow).width >= 27 * scale, "Navigation retains usable width without side gutters");
            }
            checks++;
        };
        // Existing whole-dashboard canvas contract, before exercising panel resizes.
        for (const readable of [false, true]) {
            viewport.classList.toggle("is-readable-line-width", readable);
            for (const kind of ["Home", "Project", "Knowledge", "Research"]) {
                const f = mount(kind); await settle();
                const bounds = rect(f.root), outer = rect(viewport), style = getComputedStyle(viewport);
                near(bounds.width, Math.min(1500, outer.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)), "Shared capped canvas");
                near(rect(f.grid).width, bounds.width, "Panels follow canvas");
                near(rect(f.search).width, bounds.width, "Search follows canvas");
            }
        }
        const spacing = {};
        for (const zoom of [.8, 1, 1.25, 1.5]) {
            document.body.style.zoom = zoom;
            for (const kind of ["Home", "Project", "Knowledge", "Research"]) {
                for (const selectedYear of [1900, 2000, 2024, 2026, 2028, 2012]) {
                    const f = mount(kind, selectedYear);
                    let gridTop;
                    for (const width of [640, 470, 360, 280, 180, 470]) {
                        f.panel.style.width = width + "px";
                        f.panel.style.height = "429px";
                        await settle(); check(f);
                        gridTop ??= rect(f.boxes).top;
                        assert(rect(f.boxes).top === gridTop, "Width resizing preserves the exact grid top coordinate");
                    }
                    spacing[kind] = (rect(f.months).top - rect(f.heading.firstElementChild).top) / zoom;
                }
            }
            for (const kind of ["Project", "Knowledge", "Research"]) near(spacing.Home, spacing[kind], "Home/workspace heading spacing parity");
        }
        // Text scaling and hide/reveal invalidate measurements as well as width.
        document.body.style.zoom = 1;
        const f = mount("Home");
        f.panel.style.width = "470px";
        document.documentElement.style.fontSize = "21px";
        await settle(); check(f);
        f.panel.style.display = "none"; await settle();
        f.panel.style.display = ""; await settle(); check(f);
        document.documentElement.style.fontSize = "17px";
        for (const kind of ["Home", "Project", "Knowledge"]) {
            const full = mount(kind);
            full.root.classList.add("hub-full-view");
            full.root.style.setProperty("--hub-full-view-height", "1000px");
            full.root.style.setProperty("--hub-full-view-bottom-row-height", "429px");
            await settle(); check(full);
        }
        window.previewDesktopProgress = kind => mount(kind);
        const preview = mount(new URLSearchParams(location.search).get("preview") || "Home");
        await settle(); preview.heightSync(); preview.panel.scrollIntoView({ block: "center" });
        document.getElementById("result").textContent = "PASS: " + checks + " rendered geometries; Home/Project/Resources, dynamic widths 180?640px, zoom 80?150%, leap/century/54-week years, equal squares/gaps, actual month positions, symmetric margins, heading parity, scrolling History, text scaling and hide/reveal.";
    } catch (error) { document.getElementById("result").textContent = "FAIL: " + error.stack; }
};
