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
HTMLElement.prototype.createDiv = function(options) { return create("div", { ...options, parent: this }); };
HTMLElement.prototype.createSpan = function(options) { return create("span", { ...options, parent: this }); };
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
        const [rendererSource, homeSource, projectSource, uiSource, layoutSource, colorSource, cardsSource] = await Promise.all([
            read("../../../heatmap-calendar/main.js"),
            read("../../../../../System/Dashboards/Home/view.js"),
            read("../../../../../System/Dashboards/Project/view.js"), read("../ui/dashboard-ui.js"), read("../ui/progress-heatmap.js"), read("../ui/progress-colors.js"), read("../ui/workspace-cards.js")
        ]);
        const layoutModule = { exports: {} };
        new Function("module", layoutSource)(layoutModule);
        const module = { exports: {} };
        const native = { Plugin: class { async loadData() { return {}; } addSettingTab() {} }, PluginSettingTab: class {} };
        new Function("module", "require", rendererSource)(module, () => native);
        const nativePlugin = new module.exports.default();
        await nativePlugin.onload();
        const colorModule = { exports: {} };
        new Function("module", colorSource)(colorModule);
        const colors = colorModule.exports.progressColors.green;
        const cardsModule = { exports: {} };
        new Function("module", "require", cardsSource)(cardsModule, () => ({ setIcon() {} }));
        const entries = Array.from({ length: 28 }, (_, day) => ({ date: `2026-09-${String(day + 1).padStart(2, "0")}`, intensity: day % 4 + 1 }));
        const host = document.getElementById("fixture"), viewport = host.closest(".markdown-preview-view");
        let dispose = () => {};
        const mount = (kind, selectedYear = 2026, weekStart = 1) => {
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
                const projects = grid.querySelector(".home-projects");
                projects.textContent = "";
                create("div", { cls: "home-panel-title", text: "Projects", parent: projects });
                const rail = create("div", { cls: "home-project-rail", parent: projects });
                const projectCards = create("div", { cls: "home-project-grid", parent: rail });
                const resources = create("div", { cls: "home-resource-section", parent: projects });
                create("div", { cls: "home-resource-heading", text: "Resources", parent: resources });
                const resourceCards = create("div", { cls: "home-resource-grid", parent: resources });
                const cards = cardsModule.exports.createWorkspaceCards({ root, component: { register() {} }, app: { vault: { getAbstractFileByPath() {} } }, categories: () => [{ id: "test", name: "Research" }] });
                for (const name of ["Pulsed Optomechanics", "Quantum Gravitational Phenomenology", "Obsidian Hub"]) cards.render(projectCards, { name, categoryId: "test", path: name }, () => { root.dataset.cardOpened = name; });
                for (const name of ["Knowledge", "Research", "Explorations", "Inspiration"]) cards.render(resourceCards, { name, resourceType: name, path: name }, () => { root.dataset.cardOpened = name; });
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
            nativePlugin.settings.weekStartDay = weekStart;
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
            const focusPlaceholder = create("div", { cls: "home-empty", text: "No focus set for today.", parent: scroller });
            // Use the production remaining-height calculations after layout.
            const heightSource = home ? homeSource : projectSource;
            const heightName = home ? "syncRecentActivityHeight" : "syncProjectActivityHeight";
            const heightSync = new Function("root", "recent", "recentBody", "progressPanel", "activitySection", sourceFunction(heightSource, heightName) + ";return " + heightName)(root, panel, body, panel, body);
            const boxes = calendar.querySelector(".heatmap-calendar-boxes"), months = calendar.querySelector(".heatmap-calendar-months");
            // Match the browser's allocated content box. At CSS zoom 1.5,
            // rect.width / zoom can differ from ResizeObserver by 1/64 CSS px,
            // which matters exactly at an integral square-size threshold.
            let contentWidth;
            const sizeObserver = new ResizeObserver(entries => { contentWidth = entries[0].contentRect.width; });
            sizeObserver.observe(calendar);
            const disposeLayout = dispose;
            dispose = () => { sizeObserver.disconnect(); disposeLayout(); };
            return { root, grid, panel, calendar, boxes, months, search, heading, history, body, scroller, undertext, focusPlaceholder, heightSync, selectedYear, weekStart, get contentWidth() { return contentWidth; } };
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
            const weekdays = graph.querySelector(".hub-progress-weekdays"), scrollViewport = f.calendar.querySelector(".hub-heatmap-viewport");
            near(rect(weekdays).left - rect(graph).left, rect(graph).right - rect(f.boxes).right, "Weekdays and calendar form one centered block");
            assert(!graph.querySelector(".hub-heatmap-year, .heatmap-calendar-year"), "No year label for any displayed year");
            near(rect(f.calendar).left, rect(f.scroller).left, "Calendar uses History's full left boundary");
            near(rect(f.calendar).right, rect(f.scroller).right, "Calendar includes History's scrollbar allocation");
            const samples = [...graph.querySelector(".hub-heatmap-measure").children];
            const starts = [...f.months.children].map(label => parseInt(label.style.gridColumn) - 1);
            const pixelScale = layoutModule.exports.heatmapPixelScale(f.calendar);
            const weekdayWidth = Math.ceil(Math.max(...samples.slice(24).map(label => rect(label).width / scale)) * pixelScale - 1e-9) / pixelScale;
            const labelGap = parseFloat(getComputedStyle(f.calendar).getPropertyValue("--hub-heatmap-label-gap"));
            const inset = parseFloat(getComputedStyle(f.calendar).getPropertyValue("--hub-heatmap-inline-inset"));
            const available = Math.max(0, f.contentWidth - 2 * inset - weekdayWidth - labelGap);
            const rows = [...weekdays.children].map(label => Number(label.style.gridRow)).sort((a, b) => a - b);
            const rowDistance = Math.min(...rows.slice(1).map((row, index) => row - rows[index]));
            const expectedGeometry = layoutModule.exports.heatmapGeometry(available, weeks,
                samples.slice(0, 12).map(label => label.offsetWidth), starts,
                samples.slice(12, 24).map(label => label.offsetWidth), pixelScale,
                parseFloat(getComputedStyle(weekdays).fontSize) / rowDistance - 1 / pixelScale);
            near(first.width * devicePixelRatio, expectedGeometry.cellPixels, `Largest whole-device-pixel squares fit the measured letter column (${f.root.className}, zoom ${scale}, width ${rect(f.calendar).width / scale}, available ${available})`);
            assert([...weekdays.children].map(label => label.textContent).sort().join() === "F,M,S,W", "Exactly S/M/W/F");
            for (const label of weekdays.children) {
                const weekday = { S: 0, M: 1, W: 3, F: 5 }[label.textContent];
                const row = (weekday - f.weekStart + 7) % 7;
                near(rect(label).bottom, first.top + row * (first.height + 1 / devicePixelRatio) + first.height, "Weekday bottom aligns exactly with native calendar row bottom");
                for (const property of ["fontSize", "fontWeight", "fontStyle", "color"]) assert(getComputedStyle(label)[property] === getComputedStyle(f.months.firstElementChild)[property], "Weekdays share month typography");
                assert(label.getAttribute("aria-label") === { S: "Sun", M: "Mon", W: "Wed", F: "Fri" }[label.textContent], "Weekday initials retain readable accessible names");
                assert(rect(label).right < rect(f.boxes).left, "Weekday label remains beside cells");
                assert(rect(label).left >= rect(weekdays).left - .04, "Measured weekday column never clips label text");
                assert(rect(label).right <= rect(weekdays).right + .04, "Weekday text stays within its dedicated column");
                near(rect(f.boxes).left - rect(label).right, rect(f.boxes).top - rect(f.months).bottom, "Weekday and month gaps are identical");
                for (const cell of cells) {
                    const a = rect(label), b = rect(cell);
                    assert(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom,
                        "Weekday bounds never intersect any real date or filler square");
                }
            }
            const weekdayRows = [...weekdays.children].sort((a, b) => parseInt(a.style.gridRow) - parseInt(b.style.gridRow));
            for (let i = 1; i < weekdayRows.length; i++) assert(rect(weekdayRows[i - 1]).bottom <= rect(weekdayRows[i]).top + .04, "Weekday text never overlaps, including narrow panels");
            near(rect(f.boxes).top, rect(f.calendar).top + (8 + 4) * scale + rect(f.months).height, "Grid top equals the previous layout's position");
            for (const label of f.months.children) {
                for (const property of ["fontSize", "fontWeight"]) assert(getComputedStyle(label)[property] === getComputedStyle(f.undertext)[property], "Month retains History workspace " + property);
                assert(getComputedStyle(label).color === getComputedStyle(f.focusPlaceholder).color, "Labels match the focus-placeholder color");
                assert(getComputedStyle(label).fontStyle === "normal", "Calendar labels remain upright");
                const day = f.boxes.querySelector(".month-" + label.getAttribute("aria-label").slice(0, 3).toLowerCase());
                near(rect(label).left, rect(day).left, label.textContent + " follows actual week");
            }
            const labels = [...f.months.children];
            for (let i = 1; i < labels.length; i++) assert(rect(labels[i - 1]).right < rect(labels[i]).left, "Readable separated labels");
            assert(rect(labels.at(-1)).right < rect(graph).right, "December fits");
            if (rect(graph).width <= rect(scrollViewport).width + .1) {
                near((rect(weekdays).left + rect(f.boxes).right) / 2, (rect(f.panel).left + rect(f.panel).right) / 2, "Entire weekday/month/grid assembly centers inside the panel");
                const assemblyLeft = Math.min(rect(weekdays).left, ...[...f.months.children].map(label => rect(label).left));
                const assemblyRight = Math.max(rect(f.boxes).right, ...[...f.months.children].map(label => rect(label).right));
                const leftInset = assemblyLeft - rect(f.calendar).left, rightInset = rect(f.calendar).right - assemblyRight;
                near(leftInset, rightInset, "Complete assembly centers within separator endpoints");
                assert(Math.min(leftInset, rightInset) >= inset * scale - .04, "All labels and squares fit inside separator with minimum inset");
                assert(leftInset + rightInset - 2 * inset * scale < weeks / devicePixelRatio + .04, "Residual width cannot fit the next whole-device-pixel square size");
                assert(scrollViewport.scrollWidth <= scrollViewport.clientWidth + 1, "No hidden measurement or navigation overflow");
                assert(rect(weekdays).left >= rect(scrollViewport).left - .04 && rect(f.boxes).right <= rect(scrollViewport).right + .04, "Combined calendar fits within panel viewport");
            }
            const days = cells.filter(cell => cell.className.includes("month-"));
            const count = (Date.UTC(f.selectedYear + 1, 0, 1) - Date.UTC(f.selectedYear, 0, 1)) / 86400000;
            assert(days.length === count, "All calendar dates including leap day");
            const offset = (new Date(f.selectedYear, 0, 1).getDay() - f.weekStart + 7) % 7;
            assert(cells.length === Math.ceil((offset + count) / 7) * 7, "Every displayed week contains seven visible squares");
            assert(cells.every(cell => getComputedStyle(cell).visibility === "visible"), "Real dates and inert fillers form a full rectangle");
            assert(cells[offset] === days[0] && cells[offset + count - 1] === days.at(-1), "Filler cells preserve January 1 and December 31 positions");
            for (const cell of cells.filter(cell => cell.classList.contains("isEmpty"))) {
                assert(getComputedStyle(cell).backgroundColor === getComputedStyle(document.body).backgroundColor, "Empty and filler squares match the outside-of-panel background");
            }
            for (const cell of cells.filter(cell => cell.classList.contains("hub-progress-padding"))) {
                assert(!cell.hasAttribute("data-date") && !cell.hasAttribute("tabindex") && cell.getAttribute("aria-hidden") === "true", "Padding has no date or keyboard interaction");
                assert(cell.inert && cell.textContent === "" && getComputedStyle(cell).pointerEvents === "none", "Filler positions are inert plain squares");
            }
            days.forEach((cell, i) => assert(cell.classList.contains("month-" + new Date(f.selectedYear, 0, i + 1).toLocaleString("en-US", { month: "short" }).toLowerCase()), "Correct date/month"));
            for (const cell of days.filter(cell => cell.classList.contains("hasData"))) {
                assert(getComputedStyle(cell).backgroundColor !== getComputedStyle(document.body).backgroundColor, "Recorded progress keeps its existing colors");
            }
            near(rect(f.boxes).top - rect(f.months).bottom, 4 * scale, "Compact month-to-square breathing room");
            near(rect(f.history).top, rect(f.calendar).bottom, "History follows the calendar without extra workspace spacing");
            // Integer scrollWidth/clientWidth can be equal even when a subpixel
            // overflow legitimately displays the narrow-panel scrollbar.
            if (rect(graph).width <= rect(scrollViewport).width + .04) {
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
            scrollViewport.scrollLeft = scrollViewport.scrollWidth;
            assert(rect(labels.at(-1)).right <= rect(scrollViewport).right + .1, "December reachable even in narrow panels");
            scrollViewport.scrollLeft = 0;
            const arrows = [...graph.querySelectorAll(".hub-heatmap-arrow")];
            for (const arrow of arrows) {
                assert(rect(arrow).top >= rect(f.boxes).bottom - .04 && rect(arrow).bottom <= rect(f.calendar).bottom + .04, "Navigation fits below clickable dates and above History");
                assert(rect(arrow).width >= 27 * scale, "Navigation retains usable width without side gutters");
            }
            checks++;
        };
        const panelWidths = f => {
            const home = f.root.classList.contains("home-dashboard"), zoom = parseFloat(document.body.style.zoom) || 1;
            const columns = getComputedStyle(f.grid).gridTemplateColumns.split(" ").length;
            const unit = (rect(f.grid).width - (columns - 1) * 12 * zoom) / columns;
            for (const panel of f.root.querySelectorAll(home ? ".home-calendar,.home-glance,.home-upcoming,.home-recent" : ".project-tasks,.project-progress")) near(rect(panel).width, unit, "Shared equal-width panel unit");
            near(parseFloat(getComputedStyle(f.grid).gap), 12, "Panel gutter remains 12px");
            if (!home) return;
            for (const [selector, count, minimum, gap] of [["project", 3, 220, 12], ["resource", 4, 205, 16]]) {
                const rail = f.root.querySelector(`.home-${selector}-grid`), style = getComputedStyle(rail);
                const cards = [...rail.children], padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
                near(parseFloat(style.gap), gap, "Existing card gaps preserved");
                assert(cards.length === count, "Three projects and four resources rendered using shared production cards");
                for (const card of cards) {
                    near(rect(card).width, rect(cards[0]).width, "Cards shrink uniformly with their parent");
                    near(rect(card).top, rect(cards[0]).top, "Cards remain on one row");
                }
                if (rect(rail).width / zoom >= count * minimum + (count - 1) * gap + padding) {
                    assert(rail.scrollWidth <= rail.clientWidth + 1, "All three/four cards fit without overflow");
                    assert(rect(cards.at(-1)).right <= rect(rail).right - parseFloat(style.paddingRight) * zoom + .1, "Final card stays inside rail padding");
                    for (const title of rail.querySelectorAll(".home-resource-title")) assert(title.scrollWidth <= title.clientWidth + 1, "Resource names fit without horizontal clipping");
                } else {
                    rail.scrollLeft = rail.scrollWidth;
                    assert(rect(cards.at(-1)).right <= rect(rail).right + .1, "Narrow-pane cards stay reachable by horizontal scrolling");
                    rail.scrollLeft = 0;
                }
                for (const card of cards) {
                    card.click();
                    assert(f.root.dataset.cardOpened === card.getAttribute("aria-label"), "Card click preserves navigation callback");
                    f.root.dataset.cardOpened = "";
                    card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
                    assert(f.root.dataset.cardOpened === card.getAttribute("aria-label"), "Card keyboard activation preserved");
                }
            }
        };
        const useWorkspaceHeight = f => {
            if (!f.root.classList.contains("project-dashboard")) return;
            // Workspaces receive this structural height from mountFullViewLayout
            // in Obsidian; otherwise synthetic History content sets their height.
            f.root.classList.add("hub-full-view");
            f.root.style.setProperty("--hub-full-view-height", "1000px");
        };
        window.panelWidthMeasurements = [];
        // Existing whole-dashboard canvas contract, before exercising panel resizes.
        for (const readable of [false, true]) {
            viewport.classList.toggle("is-readable-line-width", readable);
            for (const kind of ["Home", "Project", "Knowledge", "Research"]) {
                const f = mount(kind); useWorkspaceHeight(f); await settle();
                const bounds = rect(f.root), outer = rect(viewport), style = getComputedStyle(viewport);
                near(bounds.width, Math.min(1560, outer.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)), "Shared capped canvas");
                near(rect(f.grid).width, bounds.width, "Panels follow canvas");
                near(rect(f.search).width, bounds.width, "Search follows canvas");
                panelWidths(f);
                // Compare both canvas caps with equal tracks. The old rendered
                // assembly was measured separately before removing padding borrowing.
                if (!readable && bounds.width > 1000 && innerWidth > 1000) {
                    const measure = () => ({ span: rect(f.grid).width, right: rect(f.panel).width,
                        left: rect(f.root.querySelector(".home-projects,.project-left-column")).width,
                        top: rect(f.boxes).top, panelTop: rect(f.panel).top, panelBottom: rect(f.panel).bottom,
                        squarePixels: rect(f.boxes.firstElementChild).width * devicePixelRatio,
                        calendar: rect(f.boxes).width, separator: rect(f.calendar).width,
                        assembly: rect(f.boxes).right - rect(f.calendar.querySelector(".hub-progress-weekdays")).left,
                        leftInset: rect(f.calendar.querySelector(".hub-progress-weekdays")).left - rect(f.calendar).left,
                        rightInset: rect(f.calendar).right - rect(f.boxes).right,
                        cardWidths: [...f.root.querySelectorAll(".home-project-card:first-child,.home-resource-card:first-child")].map(card => rect(card).width),
                        controls: [...f.root.querySelectorAll("button")].map(button => [rect(button).width, rect(button).height, getComputedStyle(button).fontSize]) });
                    f.root.style.maxWidth = "1500px";
                    await settle(); const before = measure();
                    f.root.style.maxWidth = "";
                    await settle(); const after = measure();
                    assert(after.top === before.top, "Structural width redistribution preserves exact heatmap top");
                    assert(after.span - before.span <= 60.04, "Canvas expansion is at most 60px");
                    near(after.panelTop, before.panelTop, "Panel vertical position preserved");
                    near(after.panelBottom, before.panelBottom, "Panel bottom preserved");
                    assert(after.right >= before.right && after.left >= before.left, "All columns follow the shared canvas naturally");
                    assert(after.squarePixels >= before.squarePixels - .04, "Existing squares never shrink at desktop width");
                    assert(JSON.stringify(after.controls) === JSON.stringify(before.controls), "Control dimensions and font sizes unchanged");
                    if (Math.abs(after.span - 1560) < .04 && [1.5, 2].includes(devicePixelRatio)) {
                        const desktop = devicePixelRatio === 1.5;
                        near(after.right, 512, "Full-width equal panel size");
                        near(after.squarePixels, desktop ? 12 : 16, "Preserve the actual pre-change square size at both primary DPRs");
                        near(after.assembly, desktop ? 473 + 1 / 3 : 464.5, "Complete assembly retains its pre-change width");
                        near(after.leftInset, desktop ? 4 + 2 / 3 : 8.75, "Agreed separator inset including integer remainder");
                    }
                    window.panelWidthMeasurements.push({ kind, before, after });
                    check(f);
                }
            }
        }
        // Resize the canvas itself (as sidebars do), rather than only overriding
        // Progress width. Exercise the shared three/two/one-column breakpoints.
        for (const zoom of [.8, 1, 1.25, 1.5]) {
            document.body.style.zoom = zoom;
            for (const kind of ["Home", "Project", "Knowledge", "Research"]) {
                const f = mount(kind);
                useWorkspaceHeight(f);
                for (const width of [1560, 1500, 1400, 1100, 960, 680]) {
                    f.root.style.width = width + "px";
                    await settle(); panelWidths(f); check(f);
                }
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
        for (const kind of ["Home", "Project"]) for (let weekStart = 0; weekStart < 7; weekStart++) {
            const aligned = mount(kind, 2026, weekStart);
            aligned.panel.style.width = "470px";
            aligned.panel.style.height = "429px";
            await settle(); check(aligned);
        }
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
