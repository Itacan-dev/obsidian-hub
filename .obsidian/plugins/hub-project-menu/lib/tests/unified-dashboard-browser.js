"use strict";
// Real heatmap, cards, explorer and Full-view controller; only the native host
// and sample vault are synthetic. No production data or installed app is used.
window.hubTestUnifiedDashboard = async ({ mount, settle, check, panelWidths }) => {
    let checks = 0;
    const assert = (ok, message) => { checks++; if (!ok) throw Error(message); };
    const near = (a, b, message) => assert(Math.abs(a - b) < .08, `${message}: ${a} / ${b}`);
    const box = element => element.getBoundingClientRect();
    const names = ["ui/full-view-layout", "domain/dates", "domain/files", "domain/workspace-explorer", "ui/file-icons", "ui/workspace-explorer",
        "ui/task-card", "ui/route-breadcrumb", "ui/icons"];
    const sources = Object.fromEntries(await Promise.all(names.map(async name => [name, await (await fetch("../" + name + ".js")).text()])));
    const cache = {};
    function load(name) {
        if (name === "obsidian") return { setIcon() {} };
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
    await mountCase("Home");
    console.log("Unified geometry:", JSON.stringify(window.hubUnifiedMeasurements));
    const cards = window.hubUnifiedMeasurements.cards;
    document.getElementById("result").textContent = `PASS: ${checks} unified-layout assertions; actual cards, heatmap, explorer and height controller; desktop alignment, content fit, responsive widths, short windows, zoom, mode transitions and Note-view release.\nComputed CSS px: canvas ${before.canvas}; banner ${before.banner}; dashboard ${before.grid}; rows 320/404; project cards ${cards.project.width.toFixed(3)} x ${cards.project.height}; resource cards ${cards.resource.width.toFixed(3)} x ${cards.resource.height}; Projects client/scroll ${cards.panelClient}/${cards.panelScroll}; bottom inset ${cards.remainingBottom.toFixed(3)}.`;
};
