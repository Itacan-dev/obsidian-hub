"use strict";
// Real heatmap, cards, explorer and Full-view controller; only the native host
// and sample vault are synthetic. No production data or installed app is used.
window.hubTestUnifiedDashboard = async ({ mount, settle, check, panelWidths }) => {
    let checks = 0;
    const assert = (ok, message) => { checks++; if (!ok) throw Error(message); };
    const near = (a, b, message) => assert(Math.abs(a - b) < .08, `${message}: ${a} / ${b}`);
    const box = element => element.getBoundingClientRect();
    const names = ["ui/full-view-layout", "domain/dates", "domain/files", "domain/workspace-explorer", "ui/file-icons", "ui/workspace-explorer",
        "ui/task-card", "ui/route-breadcrumb", "ui/icons", "ui/expanded-panels", "ui/tooltips", "ui/color-system", "ui/plan-marker"];
    const sources = Object.fromEntries(await Promise.all(names.map(async name => [name, await (await fetch("../" + name + ".js")).text()])));
    const cache = {};
    function setFixtureIcon(element, icon) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        element.replaceChildren(svg);
        element.dataset.fixtureIcon = icon;
    }
    function load(name) {
        if (name === "obsidian") return { getIcon() {}, setIcon: setFixtureIcon };
        if (cache[name]) return cache[name].exports;
        const module = cache[name] = { exports: {} };
        new Function("module", "require", sources[name])(module, request => {
            if (request === "obsidian") return load(request);
            const parts = (name.slice(0, name.lastIndexOf("/")) + "/" + request).split("/"), resolved = [];
            for (const part of parts) { if (part === "..") resolved.pop(); else if (part !== ".") resolved.push(part); }
            return load(resolved.join("/"));
        });
        return module.exports;
    }
    HTMLElement.prototype.empty = function() { this.replaceChildren(); };
    HTMLElement.prototype.addClass = function(...names) { this.classList.add(...names); };
    HTMLElement.prototype.removeClass = function(...names) { this.classList.remove(...names); };
    HTMLElement.prototype.toggleClass = function(name, enabled) { this.classList.toggle(name, enabled); };
    const resize = (width, height) => new Promise(resolve => {
        window.hubTestViewportDone = resolve;
        window.hubTestViewportRequest = { width, height };
    });
    const viewport = document.querySelector(".markdown-preview-view");
    const populateTasks = (parent, variant) => {
        const { createTaskRow, createTaskChecklist } = load("ui/task-card");
        let checklist;
        for (let index = 0; index < 30; index++) {
            const task = { text: "Review the measured dashboard proportions and document a long task title with several detailed acceptance requirements " + index };
            const card = createTaskRow(parent, task, false, { variant });
            if (index === 0) {
                checklist = createTaskChecklist(card.info, { setIcon() {} });
                for (let step = 0; step < 4; step++) {
                    const text = "Verify the expanded checklist step with a long description " + step;
                    checklist.createRow({ text }).text.textContent = text;
                }
                let expanded = true;
                checklist.update(expanded, 0, 4);
                checklist.toggle.addEventListener("click", () => {
                    expanded = !expanded;
                    checklist.update(expanded, 0, 4);
                });
            }
        }
        return checklist;
    };
    let release = () => {};
    const stored = {};
    const mountCase = async (kind, width = null) => {
        release(); viewport.scrollTop = 0;
        const f = mount(kind), cleanups = [];
        release = () => cleanups.splice(0).reverse().forEach(fn => fn());
        f.root.style.width = width ? width + "px" : "100%";
        const component = { register: fn => cleanups.push(fn) };
        if (kind !== "Home") {
            f.root.classList.add(kind === "Project" ? "has-project-modes" : "resource-dashboard");
            const nav = f.root.querySelector(".project-nav"), dock = f.root.createDiv({ cls: "project-nav-dock" });
            nav.before(dock); dock.append(nav);
            const parent = f.root.querySelector(".project-folder-stack");
            parent.className = "project-folder-stack hub-work-files"; parent.replaceChildren();
            const workspacePath = "Projects/Layout sample", objects = new Map();
            const add = (path, folder = true) => {
                const item = { path, name: path.split("/").pop(), ...(folder ? { children: [] } : { extension: "md", basename: path.split("/").pop().slice(0, -3), stat: { mtime: 1, ctime: 1 } }) };
                objects.set(path, item); objects.get(path.slice(0, path.lastIndexOf("/")))?.children.push(item); return item;
            };
            add(workspacePath); add(workspacePath + "/Meta"); add(workspacePath + "/Research");
            for (let i = 0; i < 70; i++) add(workspacePath + "/Research/Long research note " + i + " about dashboard proportions and workspace layout.md", false);
            const explorer = load("ui/workspace-explorer").mountWorkspaceExplorer({ parent, workspacePath,
                dashboardPath: workspacePath + "/Meta/Home.md", descriptors: () => [{ path: workspacePath, title: "Layout sample", isRoot: true }],
                getByPath: path => objects.get(path), states: () => stored, persist() {}, setIcon() {}, openFile() {}, createItem() {}, component });
            cleanups.push(() => explorer.destroy()); f.explorer = explorer;
            f.files = parent.querySelector(".hub-workspace-explorer");
            const tasks = f.root.querySelector(".project-tasks"); tasks.replaceChildren();
            tasks.createDiv({ cls: "project-panel-title project-tasks-title", text: "Tasks" });
            f.taskBody = tasks.createDiv({ cls: "project-tasks-body" });
            f.checklist = populateTasks(f.taskBody, "project");
            f.layout = load("ui/full-view-layout").mountFullViewLayout({ root: f.root, component });
        }
        await settle(); await settle(); f.heightSync(); await settle();
        return f;
    };
    const geometry = f => {
        const zoom = f.root.currentCSSZoom || 1, root = box(f.root), grid = box(f.grid);
        const sizes = [...f.grid.children].map(element => ({ cls: element.className, width: box(element).width / zoom, height: box(element).height / zoom,
            left: (box(element).left - root.left) / zoom, top: (box(element).top - grid.top) / zoom }));
        return { canvas: root.width / zoom, banner: box(f.root.firstElementChild).height / zoom, grid: grid.height / zoom,
            gridTop: (grid.top - root.top) / zoom, sizes };
    };
    const checkWorkspaceRows = f => {
        const tasks = box(f.root.querySelector(".project-tasks")), progress = box(f.panel), zoom = f.root.currentCSSZoom || 1;
        const available = (box(f.root.querySelector(".project-right-column")).height / zoom) - 12;
        const expectedProgress = Math.max(320, Math.min(available - 245, available * 404 / 724));
        near(progress.height / zoom, expectedProgress, "Progress follows the shared proportion within usable minimums");
        near(tasks.height / zoom, available - expectedProgress, "Tasks receives the remaining proportional row");
        near((tasks.height + progress.height) / zoom + 12, available + 12, "Rows and gap fill the sidebar");
        near((progress.top - tasks.bottom) / zoom, 12, "Workspace row gutter");
        assert(tasks.height / zoom >= 244.98 && progress.height / zoom >= 319.98, "Short windows preserve usable row minimums");
        near((box(f.files).top - box(f.grid).top) / zoom, 0, "Files starts at the grid top");
        if (getComputedStyle(f.grid).gridTemplateColumns.split(" ").length > 1) near((box(f.files).bottom - progress.bottom) / zoom, 0, "Files spans both rows");
        assert(f.taskBody.scrollHeight > f.taskBody.clientHeight, "Long task content overflows internally");
        f.taskBody.scrollTop = 100; assert(f.taskBody.scrollTop > 0, "Expanded task content scrolls");
        f.heightSync(); assert(f.scroller.clientHeight > 0, "History has visible space");
        f.scroller.scrollTop = 100; assert(f.scroller.scrollTop > 0, "History scrolls internally");
    };
    await resize(2048, 1500);
    const home = await mountCase("Home"), before = geometry(home);
    near(before.canvas, 1700, "Shared canvas maximum"); near(before.banner, 275, "Home banner"); near(before.grid, 736, "Home dashboard target");
    for (const item of before.sizes) {
        const lower = item.cls.includes("home-projects") || item.cls.includes("home-recent");
        near(item.height, lower ? 404 : 320, "Every Home panel follows its shared row target");
    }
    home.root.style.setProperty("--hub-full-view-top-row-height", "362px");
    home.root.style.setProperty("--hub-full-view-bottom-row-height", "362px");
    await settle();
    const symmetric = geometry(home);
    near(before.gridTop, symmetric.gridTop, "New proportions preserve the dashboard top");
    near(before.gridTop + before.grid, symmetric.gridTop + symmetric.grid, "New proportions preserve the dashboard bottom");
    near(before.sizes[3].top, symmetric.sizes[3].top - 42, "Lower row gains height at its upper edge");
    home.root.style.removeProperty("--hub-full-view-top-row-height");
    home.root.style.removeProperty("--hub-full-view-bottom-row-height");
    await settle(); home.heightSync();
    panelWidths(home); check(home);
    const projects = home.root.querySelector(".home-projects"), projectRail = projects.querySelector(".home-project-grid"), resourceRail = projects.querySelector(".home-resource-grid");
    assert(projects.scrollHeight <= projects.clientHeight + 1, "Projects and Resources fit vertically with the actual controls");
    for (const [rail, count, height] of [[projectRail, 3, 132], [resourceRail, 4, 104]]) {
        assert(rail.children.length === count, "Visible card count");
        for (const card of rail.children) near(box(card).height, height, "Refined card height");
        near(box(rail.lastElementChild).right, box(rail).right - parseFloat(getComputedStyle(rail).paddingRight), "Three/four cards fill the rail");
    }
    window.hubUnifiedMeasurements = { Home: before, cards: {
        project: { width: box(projectRail.firstElementChild).width, height: box(projectRail.firstElementChild).height, gap: getComputedStyle(projectRail).gap },
        resource: { width: box(resourceRail.firstElementChild).width, height: box(resourceRail.firstElementChild).height, gap: getComputedStyle(resourceRail).gap },
        projectRail: box(projectRail).height, resourceThumbnail: box(resourceRail.querySelector(".home-resource-thumbnail")).height,
        panelClient: projects.clientHeight, panelScroll: projects.scrollHeight,
        remainingBottom: box(projects).bottom - box(resourceRail).bottom
    } };
    for (const card of projectRail.children) {
        const title = card.querySelector(".home-project-title"), category = card.querySelector(".home-project-category");
        title.textContent = "A long research project title requiring three full lines";
        assert(box(category).bottom <= box(card).bottom, "Three title lines and subtitle fit without clipping");
    }
    const extra = projectRail.firstElementChild.cloneNode(true); projectRail.append(extra);
    assert(box(extra).left >= box(projectRail).right - 4, "A fourth project stays outside the visible three-card rail");
    projectRail.scrollLeft = projectRail.scrollWidth; assert(projectRail.scrollLeft > 0, "Additional projects retain horizontal scrolling"); extra.remove(); projectRail.scrollLeft = 0;
    const originalCards = [...projectRail.children];
    for (const count of [0, 1, 3, 6]) {
        projectRail.replaceChildren(...Array.from({ length: count }, (_, index) => originalCards[index % 3].cloneNode(true)));
        assert(projects.scrollHeight <= projects.clientHeight + 1, "Project count never creates vertical overflow at desktop");
        assert(count > 3 ? projectRail.scrollWidth > projectRail.clientWidth : projectRail.scrollWidth <= projectRail.clientWidth + 1, "Project count preserves the three-card horizontal capacity");
    }
    projectRail.replaceChildren(...originalCards);
    for (const fontSize of [16, 17, 21]) {
        document.documentElement.style.fontSize = fontSize + "px";
        for (const category of ["Research", "Development", "Independent work"]) {
            for (const card of originalCards) card.querySelector(".home-project-category").textContent = category;
            await settle();
            for (const card of originalCards) {
                assert(box(card.querySelector(".home-project-category")).bottom <= box(card).bottom, "Long project titles and category labels fit at font size " + fontSize);
            }
        }
        for (const card of resourceRail.children) {
            assert(box(card.querySelector(".home-resource-title")).bottom <= box(card).bottom, "Resource labels fit at font size " + fontSize);
        }
        if (projects.scrollHeight > projects.clientHeight + 1) {
            projects.scrollTop = 100;
            assert(projects.scrollTop > 0, "Enlarged text remains accessible through panel scrolling");
        }
        near(box(projects).height, 404, "Text scaling retains the shared lower row height");
    }
    document.documentElement.style.fontSize = "17px";
    projects.scrollTop = 0;
    await settle();
    const homeTasks = home.root.querySelector(".home-upcoming");
    homeTasks.replaceChildren();
    homeTasks.createDiv({ cls: "home-panel-title", text: "Tasks" });
    const homeTaskBody = homeTasks.createDiv({ cls: "home-tasks-body" });
    const homeChecklist = populateTasks(homeTaskBody, "home");
    for (const collapsed of [true, false]) {
        homeChecklist.toggle.click();
        assert(homeChecklist.list.hidden === collapsed, "Production checklist expands and collapses in Home");
        near(box(homeTasks).height, 320, "Expanded Home steps retain the upper row boundary");
    }
    homeTaskBody.scrollTop = 100;
    assert(homeTaskBody.scrollTop > 0, "Long Home tasks scroll inside their panel");
    for (const panel of home.root.querySelectorAll(".home-glance,.home-calendar")) {
        panel.textContent = ""; panel.createDiv({ cls: "home-panel-title", text: "Heading" });
        for (let i = 0; i < 40; i++) panel.createDiv({ cls: "home-focus-row", text: "Populated Focus or calendar content with a project label " + i });
        panel.scrollTop = 120; assert(panel.scrollTop > 0, "Long Focus/Calendar scrolls without growing its row"); near(box(panel).height, 320, "Populated row stays bounded");
        panel.replaceChildren(); panel.createDiv({ cls: "home-empty", text: "No focus set for today." }); near(box(panel).height, 320, "Empty state keeps its geometry");
    }
    for (const kind of ["Project", "Knowledge", "Research"]) {
        const f = await mountCase(kind), actual = geometry(f); window.hubUnifiedMeasurements[kind] = actual;
        near(actual.canvas, before.canvas, "Workspace shares Home width"); near(actual.banner, before.banner, "Workspace shares Home banner");
        near(actual.grid, 736, "Workspace target height"); near(actual.gridTop, before.gridTop, "Equivalent headers align the grid top");
        const tasks = box(f.root.querySelector(".project-tasks"));
        near(tasks.height, 320, "Workspace Tasks target"); near(box(f.panel).height, 404, "Workspace Progress target");
        near(box(f.files).height, 736, "Files spans the desktop dashboard height");
        near(tasks.left - box(f.root).left, before.sizes[2].left, "Home and Workspace right columns align");
        near(box(f.panel).top - box(f.grid).top, before.sizes[4].top, "Home and Workspace lower rows align");
        near(box(f.files).width, before.sizes[3].width, "Home Projects and Workspace Files share their column boundary");
        checkWorkspaceRows(f); check(f);
        const taskHeight = tasks.height;
        for (const collapsed of [true, false]) {
            f.checklist.toggle.click();
            assert(f.checklist.list.hidden === collapsed, "Production checklist expands and collapses in Workspace");
            near(box(f.root.querySelector(".project-tasks")).height, taskHeight, "Expanded Workspace steps retain the upper row boundary");
        }
        f.explorer.selectFolderPath("Projects/Layout sample/Research"); await settle();
        const contents = f.files.querySelector(".hub-explorer-contents"); contents.scrollTop = 300; assert(contents.scrollTop > 0, "Files list scrolls inside its fixed panel");
        const splitter = f.files.querySelector(".hub-explorer-splitter"); splitter.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
        const saved = stored["Projects/Layout sample"].fullExplorer.treeWidth; assert(Number.isFinite(saved), "Explorer splitter saves its width");
        f.root.style.width = "1300px"; await settle(); assert(stored["Projects/Layout sample"].fullExplorer.treeWidth === saved, "Resizing preserves the preferred splitter width");
    }
    for (const width of [1700, 1001, 1000, 701, 700, 540]) for (const kind of ["Home", "Project"]) {
        const f = await mountCase(kind, width), columns = getComputedStyle(f.grid).gridTemplateColumns.split(" ").length;
        assert(columns === (width > 1000 ? 3 : width > 700 ? 2 : 1), "Existing container breakpoints");
        assert(f.root.scrollWidth <= f.root.clientWidth + 1, "No dashboard horizontal overflow at " + width);
        if (kind === "Home") panelWidths(f); else checkWorkspaceRows(f);
    }
    for (const zoom of [.8, 1, 1.25, 1.5]) {
        await resize(2800, 2200); document.body.style.zoom = zoom;
        for (const kind of ["Home", "Project"]) {
            const f = await mountCase(kind), actual = geometry(f);
            near(actual.grid, 736, "Desktop target remains in CSS pixels under zoom " + zoom);
            if (kind !== "Home") {
                checkWorkspaceRows(f);
                const height = getComputedStyle(f.root).height; viewport.scrollTop = 100; f.layout.update(); await settle(); near(parseFloat(getComputedStyle(f.root).height), parseFloat(height), "Scrolling does not resize the shell under zoom");
            }
        }
    }
    document.body.style.zoom = 1;
    for (const height of [1151, 1000, 800, 620]) {
        await resize(2048, height); const f = await mountCase("Project"); checkWorkspaceRows(f);
        const actual = geometry(f); assert(actual.grid >= 576.98 && actual.grid <= 736.02, "Viewport-constrained dashboard height range");
        if (height <= 1000) assert(viewport.scrollHeight > viewport.clientHeight, "Short windows use outer scrolling");
    }
    for (const zoom of [.8, 1.25, 1.5]) {
        document.body.style.zoom = zoom; await resize(2048, 620);
        const f = await mountCase("Project"), height = parseFloat(getComputedStyle(f.root).height);
        viewport.scrollTop = 120; assert(viewport.scrollTop > 0, "Short zoomed windows really scroll");
        f.layout.update(); await settle(); near(parseFloat(getComputedStyle(f.root).height), height, "Scrolling a constrained zoomed shell does not change its height");
        checkWorkspaceRows(f);
    }
    document.body.style.zoom = 1;
    await resize(2048, 1500);
    for (const fontSize of [16, 21]) {
        document.documentElement.style.fontSize = fontSize + "px";
        const scaled = await mountCase("Project");
        checkWorkspaceRows(scaled); check(scaled);
        near(box(scaled.root.querySelector(".project-tasks")).height, 320, "Scaled Workspace text retains the upper target");
        near(box(scaled.panel).height, 404, "Scaled Workspace text retains the lower target");
    }
    document.documentElement.style.fontSize = "17px";
    const f = await mountCase("Project"), notes = document.createElement("div");
    const modes = [f.root.createDiv({ cls: "hub-task-workspace" }), f.root.createDiv({ cls: "hub-roadmap-host" })];
    for (const mode of modes) { mode.hidden = true; mode.createDiv({ cls: "hub-task-view-content", text: "Mode content" }); }
    for (const mode of modes) {
        f.grid.hidden = true; mode.hidden = false; await settle(); f.layout.update(); await settle();
        near(box(mode).height, 736, "Schedule/Roadmap share the target without changing their internals"); mode.hidden = true;
    }
    f.grid.hidden = false; await settle(); checkWorkspaceRows(f);
    const parent = f.root.parentElement; notes.className = "hub-project-rail"; parent.before(notes); notes.append(parent); await settle();
    assert(!f.root.classList.contains("hub-full-view") && !f.root.style.getPropertyValue("--hub-full-view-height")
        && !f.root.style.getPropertyValue("--hub-full-view-top-row-track") && !f.root.style.getPropertyValue("--hub-full-view-bottom-row-track"), "Note view releases Full-view sizing and proportions");
    notes.before(parent); notes.remove(); await settle(); checkWorkspaceRows(f);
    const { mountExpansionHost } = load("ui/expanded-panels");
    const waitForMotion = async host => {
        await Promise.all(host.getAnimations({ subtree: true }).map(effect => effect.finished.catch(() => {})));
        await settle();
    };
    const dispatchKey = (node, key) => node.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    const movePointer = (x, y) => new Promise(resolve => {
        window.hubTestPointerDone = resolve;
        window.hubTestPointerRequest = { x, y, action: "move" };
    });
    async function inspectIconAction(control, icon, label) {
        assert(control.querySelector(".hub-expansion-icon").dataset.fixtureIcon === icon, label + " uses exact Lucide " + icon);
        control.scrollIntoView({ block: "nearest" });
        await movePointer(2, 2);
        await waitForMotion(control);
        const before = box(control);
        const resting = getComputedStyle(control).color;
        assert(getComputedStyle(control, "::before").backgroundColor === "rgba(0, 0, 0, 0)", label + " is transparent at rest");
        await movePointer(before.left + before.width / 2, before.top + before.height / 2);
        await waitForMotion(control);
        const hover = getComputedStyle(control, "::before");
        const foreground = getComputedStyle(control).color;
        assert(hover.backgroundColor !== "rgba(0, 0, 0, 0)" && foreground !== resting,
            label + " brightens on hover " + JSON.stringify({ hover: control.matches(":hover"), surface: hover.backgroundColor,
                resting, foreground, box: before.toJSON(), hit: document.elementFromPoint(before.left + before.width / 2, before.top + before.height / 2)?.className }));
        near(parseFloat(hover.width), parseFloat(hover.height), label + " hover surface is square");
        if (control.classList.contains("hub-expansion-toggle")) {
            const panel = box(control.closest(".hub-dashboard-panel"));
            const zoom = control.currentCSSZoom || 1;
            const halfSurface = parseFloat(hover.width) * zoom / 2;
            near(parseFloat(hover.width), 20, label + " hover surface size");
            near((before.top + before.height / 2 - halfSurface - panel.top) / zoom, 13, label + " hover surface top inset");
            near((panel.right - before.left - before.width / 2) / zoom, 15 + box(control.querySelector(".hub-expansion-visual-slot")).width / zoom / 2, label + " hover surface centered on the trailing slot");
            near(before.width / zoom, 38, label + " hit width");
            near(before.height / zoom, 23, label + " hit height");
        }
        for (const key of ["width", "height", "x", "y"]) near(box(control)[key], before[key], label + " stable " + key);
        await movePointer(2, 2);
        await waitForMotion(control);
    }
    function wrapWorkspaceBody(element) {
        const [rail, resources] = [element.querySelector(".home-project-rail"), element.querySelector(".home-resource-section")];
        const body = element.createDiv({ cls: "home-workspaces-body" });
        body.append(rail, resources);
        return body;
    }
    function expansionPanel(element, title, icon, kind) {
        const home = kind === "Home";
        let header = element.querySelector(".home-panel-title, .home-project-tabs, .project-progress-header, .hub-explorer-heading, .project-tasks-title");
        if (!header) {
            for (const node of [...element.childNodes]) if (node.nodeType === Node.TEXT_NODE) node.remove();
            element.prepend(header = document.createElement("div"));
            header.className = "home-panel-title";
        }
        const heading = title === "Workspaces" || (!home && title === "Progress") ? header.firstElementChild : header;
        if (home && title === "Progress") header.firstElementChild.remove();
        const headingLabel = heading.querySelector(".hub-panel-heading-label") ?? heading.createEl("h2", { cls: "hub-panel-heading-label", text: title });
        const iconClass = home ? "home-heading-icon" : { Files: "hub-explorer-icon", Tasks: "project-tasks-title-icon", Progress: "project-progress-title-icon" }[title];
        const headingIcon = heading.querySelector("." + iconClass) ?? heading.createSpan({ cls: iconClass });
        for (const node of [...heading.childNodes]) if (node.nodeType === Node.TEXT_NODE) node.remove();
        headingLabel.before(headingIcon);
        if (!home && title === "Progress") heading.classList.add("project-panel-title");
        setFixtureIcon(headingIcon, icon);
        const compactHeading = heading === header ? [headingIcon, headingLabel] : [heading];
        let actions, center, onExpandedChange;
        if (title === "Workspaces") {
            const group = header.querySelector(".home-project-tab-buttons");
            const sort = group.createEl("select", { cls: "home-project-sort" });
            sort.createEl("option", { text: "Recently accessed workspaces" });
            actions = [group];
            wrapWorkspaceBody(element);
        } else if (title === "Plan") {
            center = header.createDiv({ cls: "hub-panel-selectors hub-plan-browser-modes" });
            for (const mode of ["Plans", "Days"]) center.createEl("button", { text: mode });
            const group = header.createDiv({ cls: "hub-plan-header-controls" });
            group.createEl("button", { cls: "home-focus-edit hub-panel-action", text: "Planner" });
            actions = [group];
        } else {
            const action = header.querySelector(".hub-progress-header-actions") ?? header.createEl("button", {
                cls: "hub-panel-action", text: { Calendar: "Today", Tasks: "Task", Progress: "Statistics", Files: "Preview" }[title]
            });
            actions = [action];
            if (title === "Files") {
                action.hidden = true;
                onExpandedChange = active => { action.hidden = !active; };
            }
        }
        return { element, header, title, icon, compactHeading, headingLabel, headingIcon, actions, center, onExpandedChange };
    }
    function corner(panel, button) {
        const { top, right } = box(panel.element.querySelector(".hub-workspace-explorer") ?? panel.element);
        const { width, height, top: buttonTop, right: buttonRight } = box(button);
        const zoom = panel.element.currentCSSZoom || 1;
        return [width, height, buttonTop - top, right - buttonRight].map(value => value / zoom);
    }
    function checkPanelInsets(panel, button) {
        const surface = panel.element.querySelector(".hub-workspace-explorer") ?? panel.element;
        const frame = box(surface), glyph = box(button.querySelector("svg")), zoom = surface.currentCSSZoom || 1;
        const inset = 14 + parseFloat(getComputedStyle(surface).borderTopWidth);
        const header = box(panel.header);
        const expanded = panel.header.classList.contains("hub-expanded-header");
        const nav = expanded && panel.header.querySelector(".hub-expansion-navigation");
        const leadingSlot = expanded ? nav.querySelector("button .hub-expansion-icon") :
            (panel.headingIcon.matches(".hub-panel-heading-slot") ? panel.headingIcon :
                panel.headingIcon.querySelector(".hub-panel-heading-slot"));
        const trailingSlot = box(button.querySelector(".hub-expansion-visual-slot"));
        const label = expanded ? nav.querySelector('[aria-selected="true"] .hub-expansion-label') : panel.headingLabel;
        const scrollLeft = nav ? nav.scrollLeft : 0;
        if (nav) nav.scrollLeft = 0;
        const leading = box(leadingSlot);
        const lineHeight = parseFloat(getComputedStyle(label).lineHeight);
        assert(Math.abs((leading.left - frame.left) / zoom - 15) < .5, panel.title + " leading slot inset");
        if (nav) nav.scrollLeft = scrollLeft;
        assert(Math.abs((frame.right - trailingSlot.right) / zoom - 15) < .5, panel.title + " trailing slot inset");
        for (const slot of [leading, trailingSlot]) {
            near(slot.width / zoom, lineHeight, panel.title + " slot width follows title line height");
            near(slot.height / zoom, lineHeight, panel.title + " slot height follows title line height");
        }
        near((trailingSlot.right + trailingSlot.left - glyph.right - glyph.left) / zoom, 0, panel.title + " glyph centered inside slot");
        assert(box(button).width > trailingSlot.width, panel.title + " retains its larger hit area");
        near((glyph.top + glyph.height / 2 - header.top - header.height / 2) / zoom, 0, panel.title + " centered toggle glyph");
        const band = box(panel.header.parentElement);
        const home = surface.classList.contains("home-panel");
        near((band.bottom - frame.top) / zoom, inset + (home ? 33 : 40), panel.title + " header band positions the body");
        for (const lane of panel.header.querySelectorAll(":scope > .hub-expansion-lane")) {
            assert(box(lane).bottom <= band.bottom + .08, panel.title + " header scrollbar fits before the body");
        }
        const row = expanded
            ? [...panel.header.querySelectorAll(".hub-expansion-track, .hub-expansion-tab svg")]
            : [panel.headingIcon.querySelector("svg"), panel.header.querySelector(".hub-expansion-actions > .hub-expansion-track")];
        row.push(label, ...panel.header.querySelectorAll(".hub-expansion-actions :is(button, select), .hub-expansion-center button"));
        for (const item of row.filter(item => box(item).height)) {
            const bounds = box(item);
            assert(Math.abs((bounds.top + bounds.height / 2 - glyph.top - glyph.height / 2) / zoom) <= .6,
                panel.title + " header shares the glyph centerline " + JSON.stringify([item.className, bounds.top, bounds.height, glyph.top, glyph.height, header.top, header.height, item.parentElement.className, box(item.parentElement).top, getComputedStyle(item).marginTop]));
        }
        const body = surface.querySelector(":scope > :is(.home-calendar-scroll, .home-workspaces-body, .project-tasks-body, .hub-explorer-body)");
        if (body) {
            const bounds = box(body);
            near((bounds.left - frame.left) / zoom, inset, panel.title + " body left inset");
            near((frame.right - bounds.right) / zoom, inset, panel.title + " body right inset");
            near((frame.bottom - bounds.bottom) / zoom, inset, panel.title + " body bottom inset");
            near((bounds.top - band.bottom) / zoom, 0, panel.title + " body starts after the header band");
        }
    }
    for (const kind of ["Home", "Project", "Resource"]) {
        const f = await mountCase(kind);
        const isWorkspace = kind !== "Home";
        const selectors = kind === "Home"
            ? [[".home-calendar", "Calendar", "calendar-days"], [".home-glance", "Plan", "goal"], [".home-upcoming", "Tasks", "list-todo"],
                [".home-projects", "Workspaces", "folder-kanban"], [".home-recent", "Progress", "rocket"]]
            : [[".project-folder-stack", "Files", "folder-tree"], [".project-tasks", "Tasks", "list-todo"], [".project-progress", "Progress", "rocket"]];
        const panels = selectors.map(([selector, title, icon]) => expansionPanel(f.grid.querySelector(selector), title, icon, kind));
        const [first] = panels;
        const last = panels.at(-1);
        const sizing = new AbortController();
        const search = f.grid.previousElementSibling;
        const baseline = box(first.element);
        const chromeTop = box(search).top;
        const body = isWorkspace ? f.files : first.element.createDiv({ cls: "home-calendar-scroll" });
        const tree = body.querySelector(".hub-explorer-tree"), fileList = body.querySelector(".hub-explorer-contents");
        const compactTreeWidth = tree && box(tree).width;
        const compactFileListWidth = fileList && box(fileList).width;
        if (isWorkspace) {
            f.explorer.selectFolderPath("Projects/Layout sample/Research");
            first.scrollOwners = [tree, fileList];
        } else {
            body.createDiv({ text: "Live panel content" }).style.height = "900px";
            first.scrollOwners = [body];
        }
        const stateOwner = {};
        const shell = mountExpansionHost({ host: f.grid, panels, signal: sizing.signal, stateOwner, stateKey: kind });
        const compact = panels.map(panel => {
            const heading = getComputedStyle(panel.headingLabel);
            return { glyph: box(panel.headingIcon.querySelector("svg")).width / (panel.element.currentCSSZoom || 1),
                font: [heading.fontFamily, heading.fontSize, heading.fontWeight, heading.lineHeight],
                headerHeight: box(panel.header).height,
                corner: corner(panel, panel.header.querySelector(".hub-expansion-trigger")) };
        });
        compact.forEach(({ corner: position }, index) => {
            const panel = panels[index];
            const expand = panel.header.querySelector(".hub-expansion-trigger");
            checkPanelInsets(panel, expand);
            position.forEach((value, axis) => near(value, compact[0].corner[axis], kind + " compact corner " + panel.title + " " + axis));
        });
        const trigger = first.header.querySelector(".hub-expansion-trigger");
        await inspectIconAction(trigger, "expand", kind + " Expand");
        const collapse = () => f.grid.querySelector(".hub-expansion-collapse").click();
        trigger.click();
        await waitForMotion(f.grid);
        await inspectIconAction(f.grid.querySelector(".hub-expansion-collapse"), "minimize", kind + " Minimize");
        let selected = f.grid.querySelector('[role="tab"][aria-selected="true"]');
        assert(selected.getAttribute("aria-label") === first.title && document.activeElement === selected, kind + " expanded focus");
        assert(first.element.contains(body) && last.element.inert, kind + " content remains mounted and neighboring panels are inert");
        near(box(first.element).width, box(f.grid).width, kind + " expanded panel fills the grid");
        near(box(first.element).left, box(f.grid).left, kind + " expanded panel starts at the grid edge");
        near(box(search).top, chromeTop, kind + " expansion keeps chrome stable");
        if (isWorkspace) {
            near(box(body).height, box(f.grid).height, kind + " Files fills the expanded content height");
            assert(box(tree).width >= compactTreeWidth && box(fileList).width > compactFileListWidth, kind + " most of the extra width goes to the file list");
            assert(fileList.querySelectorAll("[data-path]").length === 70, kind + " Files keeps the selected folder");
            fileList.scrollTop = 128;
        }
        const tabs = [...f.grid.querySelectorAll('[role="tab"]')];
        assert(tabs.map(tab => tab.getAttribute("aria-label")).join() === panels.map(panel => panel.title).join(), kind + " fixed panel order");
        async function checkExpandedHeaders(narrow = false) {
            let headerBounds;
            for (const [index, panel] of panels.entries()) {
                const tab = tabs[index];
                tab.click();
                await waitForMotion(f.grid);
                const header = box(panel.header), panelTop = box(panel.element).top;
                const relativeHeader = [header.height, header.bottom - panelTop];
                headerBounds ??= relativeHeader;
                assert(panel.header.classList.contains("hub-expanded-header"), kind + " switches to " + panel.title);
                relativeHeader.forEach((value, axis) => near(value, headerBounds[axis], kind + " expanded header " + panel.title + " " + axis
                    + " " + JSON.stringify({ header: panel.header.className, parent: panel.header.parentElement.className,
                        display: getComputedStyle(panel.header).display, height: getComputedStyle(panel.header).height,
                        minHeight: getComputedStyle(panel.header).minHeight, box: header.toJSON() })));
                const minimize = panel.header.querySelector(".hub-expansion-collapse");
                checkPanelInsets(panel, minimize);
                corner(panel, minimize).forEach((value, axis) => {
                    const expected = compact[index].corner[axis];
                    assert(Math.abs(value - expected) < (narrow && axis >= 2 ? .81 : .08),
                        `${kind} expanded corner ${panel.title} ${axis}: ${value} / ${expected}`);
                });
                const label = tab.querySelector(".hub-expansion-label"), computed = getComputedStyle(label), tabCss = getComputedStyle(tab);
                const font = [computed.fontFamily, computed.fontSize, computed.fontWeight, computed.lineHeight];
                assert(font.every((value, axis) => value === compact[index].font[axis]), kind + " selected heading typography " + panel.title
                    + " " + JSON.stringify([font, compact[index].font]));
                assert(tabCss.backgroundColor === "rgba(0, 0, 0, 0)" && tabCss.borderWidth === "0px" && tabCss.boxShadow === "none",
                    kind + " selected tab has clear button chrome");
                for (const [peer, candidate] of tabs.entries()) {
                    near(box(candidate.querySelector("svg")).width / (candidate.currentCSSZoom || 1), compact[peer].glyph,
                        kind + " nav glyph matches " + panels[peer].title);
                    assert(candidate.querySelector(".hub-expansion-label").checkVisibility() === (index === peer), kind + " only selected title is shown");
                }
                const lanes = [...panel.header.querySelectorAll(":scope > .hub-expansion-lane")];
                assert(lanes.every(lane => box(lane).right <= box(minimize).left + .08
                    && box(lane).bottom <= header.bottom + 10 * (panel.header.currentCSSZoom || 1) + .08),
                    kind + " lanes fit the header and scrollbar gap and clear Minimize " + panel.title);
                assert(lanes.every((lane, i) => !i || box(lane).left >= box(lanes[i - 1]).right - .08), kind + " header lanes do not overlap");
                if (panel.center) near((box(panel.center).left + box(panel.center).right) / 2, (header.left + header.right) / 2, "Plan modes stay centered");
                if (panel.title === "Workspaces" && narrow) {
                    label.textContent = "Workspaces with an unusually long dashboard panel title that exceeds the available width";
                    assert(label.scrollWidth > label.clientWidth && computed.textOverflow === "ellipsis", "A long title ellipsizes at narrow widths");
                    near(box(panel.header).height, header.height, "A long title keeps the header height");
                    label.textContent = panel.title;
                    const lane = panel.header.querySelector(".hub-expansion-actions"), sort = lane.querySelector("select");
                    assert(lane.scrollWidth > lane.clientWidth, "Overflowing workspace actions scroll inside their lane");
                    const scroll = viewport.scrollTop;
                    sort.focus({ preventScroll: true });
                    assert(lane.scrollLeft > 0 && box(sort).right <= box(lane).right + 1, "Keyboard focus reveals the trailing workspace action");
                    near(viewport.scrollTop, scroll, "Focus in the header does not scroll the leaf vertically");
                }
                const [action] = panel.actions;
                action.hidden = true;
                near(box(panel.header).bottom, header.bottom, kind + " hiding actions leaves the body boundary stable");
                action.hidden = false;
            }
            tabs[0].click();
            await waitForMotion(f.grid);
        }
        const inactiveIndex = isWorkspace ? 1 : 2;
        await inspectIconAction(tabs[inactiveIndex], panels[inactiveIndex].icon, kind + " inactive navigation");
        await checkExpandedHeaders();
        dispatchKey(selected, "End");
        assert(document.activeElement === tabs.at(-1) && selected.getAttribute("aria-selected") === "true", kind + " keyboard navigation focuses a muted tab");
        tabs.at(-1).click();
        await waitForMotion(f.grid);
        assert(last.element.contains(selected) && first.element.inert && !last.element.inert, kind + " switches with the same header");
        assert(f.grid.querySelectorAll(".hub-panel-muted").length === panels.length - 1,
            kind + " only the inactive panels carry muted state after switching");
        near(box(last.element).width, box(f.grid).width, kind + " nested or spanning panel fills the grid");
        if (isWorkspace) {
            const field = search.createEl("input");
            field.focus();
            shell.reveal("Files");
            assert(document.activeElement === field && first.element.classList.contains("hub-panel-expanded"), kind + " search reveal opens Files without taking focus");
            near(fileList.scrollTop, 128, kind + " Files keeps its scroll position after a switch");
            field.remove();
            tabs[0].focus();
        } else tabs[0].click();
        collapse();
        tabs[0].click();
        await waitForMotion(f.grid);
        assert(first.element.classList.contains("hub-panel-expanded"), kind + " reverses an in-flight collapse");
        f.root.style.width = "540px";
        document.body.classList.replace("theme-dark", "theme-light");
        document.body.style.setProperty("--text-normal", "#222222");
        document.body.style.setProperty("--text-muted", "#6a6a6a");
        document.body.style.setProperty("--background-modifier-hover", "#00000015");
        document.body.style.zoom = 1.25;
        await resize(900, 680);
        await settle();
        await checkExpandedHeaders(true);
        tabs[inactiveIndex].scrollIntoView({ block: "center", inline: "nearest" });
        await inspectIconAction(tabs[inactiveIndex], panels[inactiveIndex].icon, kind + " light palette navigation");
        collapse();
        await waitForMotion(f.grid);
        for (const [index, panel] of panels.entries()) {
            checkPanelInsets(panel, panel.header.querySelector(".hub-expansion-trigger"));
            near(box(panel.header).height / (panel.header.currentCSSZoom || 1), compact[index].headerHeight,
                kind + " narrow compact keeps the shared header height " + panel.title);
            if (panel.title === "Workspaces") {
                const lane = panel.header.querySelector(".hub-expansion-actions");
                const sort = lane.querySelector("select");
                if (lane.scrollWidth > lane.clientWidth) {
                    sort.focus({ preventScroll: true });
                    assert(box(sort).right <= box(lane).right + 1, "Compact keyboard focus reveals the trailing workspace action");
                }
            }
        }
        trigger.click();
        await waitForMotion(f.grid);
        document.body.style.zoom = 1;
        document.body.classList.replace("theme-light", "theme-dark");
        for (const variable of ["--text-normal", "--text-muted", "--background-modifier-hover"]) document.body.style.removeProperty(variable);
        f.root.style.width = "100%";
        await resize(2048, 1500);
        await settle();
        if (kind === "Home") {
            body.scrollTop = 72;
            tabs.at(-1).click();
            tabs[0].click();
            await waitForMotion(f.grid);
            near(body.scrollTop, 72, "Switching preserves the mounted Calendar scroll position");
            f.root.style.width = "600px";
            await resize(900, 620);
            await settle();
            near(box(first.element).width, box(f.grid).width, "An expanded Calendar follows a narrow leaf");
            assert(box(f.grid).height >= 320 && box(f.grid).height < 736, "Short windows bound the expansion surface");
            assert(f.grid.scrollWidth <= f.grid.clientWidth + 1, "The compact grid cannot cause page-width overflow while expanded");
            f.root.style.width = "100%";
            await resize(2048, 1500);
            await settle();
        } else if (kind === "Project") {
            f.root.style.width = "600px";
            await resize(900, 620);
            await settle();
            near(box(first.element).height, box(f.grid).height, "Expanded Files follows the short workspace allocation");
            assert(box(f.grid).height < 736 && box(tree).width > 0 && box(fileList).width > 0,
                "A short, narrow workspace fits a bounded two-pane explorer (" +
                [box(f.grid).height, box(tree).width, box(fileList).width].join(", ") + ")");
            f.root.style.width = "100%";
            await resize(2048, 1500);
            await settle();
        }
        document.activeElement.blur();
        collapse();
        await waitForMotion(f.grid);
        assert(document.activeElement === trigger && !trigger.closest(".hub-panel-expanded"), kind + " restores compact focus from the document body");
        near(box(first.element).width, baseline.width, kind + " restores compact geometry");
        assert(panels.every(panel => !panel.element.inert), kind + " restores compact interactions");
        trigger.click();
        sizing.abort();
        assert(!f.grid.querySelector(".hub-expansion-tabs, .hub-expansion-slot, .hub-expansion-trigger") && !first.element.inert,
            kind + " frame abort cleans up an active shell");
        const replacement = new AbortController();
        mountExpansionHost({ host: f.grid, panels, signal: replacement.signal, stateOwner, stateKey: kind });
        assert(first.element.classList.contains("hub-panel-expanded") && !f.grid.contains(document.activeElement),
            kind + " frame replacement restores the selected panel without stealing focus");
        replacement.abort();
        if (isWorkspace) {
            const other = new AbortController();
            mountExpansionHost({ host: f.grid, panels, signal: other.signal, stateOwner, stateKey: "another workspace" });
            assert(!f.grid.querySelector(".hub-panel-expanded"), kind + " remembered expansion is scoped to workspace identity");
            other.abort();
        }
    }
    const gallery = await mountCase("Home");
    const galleryPanel = gallery.grid.querySelector(".home-projects");
    const projectCards = galleryPanel.querySelector(".home-project-grid");
    const resourceCards = galleryPanel.querySelector(".home-resource-grid");
    const resourceSection = galleryPanel.querySelector(".home-resource-section");
    const galleryEntry = expansionPanel(galleryPanel, "Workspaces", "folder-kanban", "Home");
    const originalProject = box(projectCards.firstElementChild), originalResource = box(resourceCards.firstElementChild);
    for (let i = projectCards.children.length; i < 36; i++) projectCards.append(projectCards.firstElementChild.cloneNode(true));
    const card = index => box(projectCards.children[index]);
    const toggleResources = collapsed => {
        galleryPanel.classList.toggle("is-resources-collapsed", collapsed);
        resourceCards.hidden = collapsed;
    };
    toggleResources(true);
    near(card(0).left, card(1).left, "Compact two-row projects fill down first");
    near(card(0).top, card(2).top, "Compact odd-numbered project cards share the first row");
    near(card(1).top - card(0).bottom, 12, "Compact row gap equals the horizontal card gap");
    near(card(0).width, originalProject.width, "Compact two-row project width stays fixed");
    assert(projectCards.scrollWidth > projectCards.clientWidth, "Compact two-row Projects scrolls horizontally");
    const galleryState = new AbortController();
    mountExpansionHost({ host: gallery.grid, signal: galleryState.signal,
        panels: [galleryEntry] });
    function checkRailClearance(rail) {
        if (rail.hidden) return;
        const zoom = rail.currentCSSZoom || 1;
        const before = rail.scrollLeft;
        rail.scrollLeft = 0;
        const first = box(rail.firstElementChild), viewport = box(rail);
        near((first.left - viewport.left) / zoom, 3, "First card has 3px rail clearance");
        near((first.top - viewport.top) / zoom, 3, "First card has 3px top clearance");
        rail.scrollLeft = rail.scrollWidth;
        assert(Math.abs((viewport.right - box(rail.lastElementChild).right) / zoom - 3) <= 1,
            "Last card reaches the 3px trailing clearance");
        rail.scrollLeft = before;
    }
    function checkCompactGallery() {
        const stack = galleryPanel.querySelector(".home-workspaces-body");
        const rail = projectCards.parentElement;
        const zoom = galleryPanel.currentCSSZoom || 1;
        for (const node of [galleryPanel, stack, rail, projectCards, resourceCards]) {
            assert(node.scrollHeight <= node.clientHeight + 1, "Compact Projects has no vertical overflow " +
                JSON.stringify([node.className, node.clientHeight, node.scrollHeight, galleryEntry.header.offsetHeight, resourceSection.offsetHeight]));
        }
        assert(box(resourceSection).top >= box(projectCards).bottom && box(resourceSection).bottom <= box(galleryPanel).bottom,
            "Compact Resources fit below Projects");
        near((box(galleryPanel).bottom - box(resourceSection).bottom) / zoom,
            14 + parseFloat(getComputedStyle(galleryPanel).borderBottomWidth), "Compact Resources stay anchored to the bottom inset");
        assert(Math.abs(box(galleryPanel).height / zoom - 404) < 1, "Compact gallery keeps its panel height");
        near(card(0).height / zoom, 138, "Compact Project cards have a fixed height");
        if (resourceCards.hidden) {
            near(card(1).height / zoom, 138, "Second Project row has the same fixed height");
            near((card(1).top - card(0).bottom) / zoom, 12, "Compact Projects retains the two-row gap");
        }
        const lastRow = resourceCards.hidden ? card(1) : card(0);
        const separatorGap = (box(resourceSection).top - lastRow.bottom) / zoom;
        if (resourceCards.hidden) assert(separatorGap >= 13.95 && separatorGap <= 26, "Collapsed Resources leaves clearance " + separatorGap);
        else assert(separatorGap >= 14, "Compact Projects leave clearance above the Resources separator");
        near((card(0).top - box(galleryPanel).top) / zoom, 50 + parseFloat(getComputedStyle(galleryPanel).borderTopWidth), "Compact card top stays at the body start plus rail clearance");
        checkRailClearance(projectCards);
        checkRailClearance(resourceCards);
        assert(projectCards.scrollWidth > projectCards.clientWidth, "Compact Projects scroll horizontally");
    }
    for (const width of ["100%", "540px", "390px"]) {
        gallery.root.style.width = width;
        for (const zoom of [1, 1.25]) {
            document.body.style.zoom = zoom;
            for (const collapsed of [false, true]) {
                toggleResources(collapsed);
                await settle();
                checkCompactGallery();
            }
        }
    }
    gallery.root.style.width = "100%";
    document.body.style.zoom = 1;
    await settle();
    near(box(galleryPanel).height, 404, "Compact gallery keeps the desktop row height with Resources collapsed");
    near(card(0).height, 138, "Collapsed Resources uses 138px cards");
    near(card(1).height, 138, "The two compact rows have equal height");
    const twoRowHeight = card(0).height;
    toggleResources(false);
    await settle();
    assert(Math.abs(box(galleryPanel).height - 404) < 1, "Compact gallery retains the desktop row height");
    near(card(0).height, 138, "Open Resources uses 138px cards");
    const oneRowHeight = card(0).height;
    near(card(0).width, originalProject.width, "Compact cards keep the original width");
    const compactResource = box(resourceCards.firstElementChild);
    near(compactResource.width, originalResource.width, "Resource cards keep their width across occupancy changes");

    function checkResourceArtwork() {
        const face = resourceCards.querySelector(".home-resource-face");
        const image = box(face.querySelector(".home-resource-thumbnail"));
        const title = box(face.querySelector(".home-resource-title"));
        const bounds = box(face);
        near(image.width, 90, "Resource artwork width");
        near(image.height, 90, "Resource artwork height");
        near(image.right, title.left - parseFloat(getComputedStyle(face).columnGap), "Artwork stays at the original artwork-column edge");
        near(image.top + image.height / 2, bounds.top + bounds.height / 2, "Resource artwork is vertically centered");
    }
    checkResourceArtwork();
    const title = projectCards.firstElementChild.querySelector(".home-project-title");
    title.textContent = "A long research project title requiring three full lines";
    assert(box(projectCards.firstElementChild.querySelector(".home-project-category")).bottom <= card(0).bottom,
        "The compact card fits a long title and category");
    const savedCards = [...projectCards.children];
    projectCards.replaceChildren(document.createElement("div"));
    projectCards.firstElementChild.className = "home-empty";
    await settle();
    near(box(projectCards).height, 138, "Empty Projects uses its original rail size");
    near(box(resourceCards.firstElementChild).height, compactResource.height, "Compact Resource height is independent of Project occupancy");
    projectCards.replaceChildren(...savedCards);
    toggleResources(true);
    galleryPanel.querySelector(".hub-expansion-trigger").click();
    await waitForMotion(gallery.grid);
    const fourRowHeight = projectCards.clientHeight;
    near(card(3).top, card(0).top, "Expanded projects fill across the first four columns");
    near(card(4).left, card(0).left, "The fifth expanded project starts the next row");
    near(card(0).width, originalProject.width, "Expanded project width matches compact");
    near(card(0).height, 138, "Expanded Project cards use the same fixed height");
    const expandedProjectHeight = card(0).height;
    assert(fourRowHeight <= 594 && projectCards.scrollHeight > fourRowHeight, "Hidden Resources allows a four-row Projects window");
    toggleResources(false);
    await settle();
    const resourcesOpenBounds = box(resourceSection);
    near(box(resourceCards.firstElementChild).width, originalResource.width, "Expanded resource width matches compact");
    near(box(resourceCards.firstElementChild).height, compactResource.height, "Expanded resource height matches compact");
    checkResourceArtwork();
    assert(projectCards.clientHeight <= 444 && projectCards.clientHeight < fourRowHeight, "Open Resources caps Projects at three rows");
    projectCards.scrollTop = 200;
    assert(projectCards.scrollTop > 0, "Expanded Projects scroll vertically with Resources visible");
    near(box(resourceSection).bottom, resourcesOpenBounds.bottom, "Resources stay anchored when Projects scrolls");
    near(box(galleryPanel).bottom - box(resourceSection).bottom, 15, "Resources sit at the bottom of the expanded panel");
    projectCards.replaceChildren(document.createElement("div"));
    projectCards.firstElementChild.className = "home-empty";
    await settle();
    near(box(resourceCards.firstElementChild).height, compactResource.height, "Expanded Resource height is independent of Project occupancy");
    galleryState.abort();
    await mountCase("Home");
    console.log("Unified geometry:", JSON.stringify(window.hubUnifiedMeasurements));
    const cards = window.hubUnifiedMeasurements.cards;
    document.getElementById("result").textContent = `PASS: ${checks} unified-layout assertions; desktop alignment, responsive widths, zoom, Note-view release, panel expansion, keyboard focus and reversible switching.\nComputed CSS px: canvas ${before.canvas}; banner ${before.banner}; dashboard ${before.grid}; rows 320/404; project cards ${cards.project.width.toFixed(3)} x ${cards.project.height}; resource cards ${cards.resource.width.toFixed(3)} x ${cards.resource.height}; Projects client/scroll ${cards.panelClient}/${cards.panelScroll}; bottom inset ${cards.remainingBottom.toFixed(3)}.`;
    document.getElementById("result").textContent += `\nMounted Home Project card heights: ${oneRowHeight}px in one row, ${twoRowHeight}px in two rows, and ${expandedProjectHeight}px expanded.`;
};
