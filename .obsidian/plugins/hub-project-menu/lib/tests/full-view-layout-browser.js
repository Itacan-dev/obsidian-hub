"use strict";
window.hubTestFullView = async f => {
    const { assert, settle, plugin, load, project, resource, container } = f;
    const rect = el => el.getBoundingClientRect();
    const near = (a, b, label) => assert(Math.abs(a - b) <= 2, label + ` (${a} vs ${b})`);
    const viewport = document.body.createDiv({ cls: "markdown-preview-view dashboard" });
    viewport.style.cssText = "position:fixed;inset:20px 20px 40px;overflow:auto";
    const sizer = viewport.createDiv({ cls: "markdown-preview-sizer" });
    sizer.append(container); container.style.width = "100%";
    // Real Home panel classes provide an independent geometry reference.
    // Their unchanged fixed heights, rather than a copied pixel delta, define it.
    const home = document.body.createDiv({ cls: "home-dashboard" });
    home.style.cssText = "position:absolute;left:-10000px;width:1040px";
    const homeGrid = home.createDiv({ cls: "home-main-grid" });
    for (const cls of ["home-calendar", "home-glance", "home-upcoming", "home-projects", "home-recent"]) homeGrid.createDiv({ cls: "home-panel " + cls });
    const originalData = structuredClone(plugin.projectWizard.data.projectPlanning);
    let layout;
    const mount = async owner => {
        f.mount(owner); viewport.scrollTop = 0;
        layout = load("ui/full-view-layout").mountFullViewLayout({ root: f.root, component: f.component, app: plugin.app });
        await settle(); await settle();
    };
    const active = () => [...f.root.children].find(el => el.matches(".project-main-grid,.hub-task-workspace,.hub-roadmap-host") && !el.hidden);
    const checkBoundary = label => {
        const surface = active(), gutter = parseFloat(getComputedStyle(f.root).getPropertyValue("--hub-full-view-gutter"));
        const minimum = parseFloat(getComputedStyle(surface).minHeight);
        const available = rect(viewport).bottom - gutter - rect(surface).top;
        const homeBottom = rect(surface).top + rect(homeGrid).height;
        if (available >= minimum - 2) {
            near(rect(surface).bottom, Math.min(homeBottom, rect(viewport).bottom - gutter), label + " matches Home or short-window boundary");
            if (available >= rect(homeGrid).height) near(rect(surface).bottom, homeBottom, label + " aligns exactly with Home");
        }
        else { assert(rect(surface).height >= minimum - 1, label + " retains usable short-window minimum"); assert(viewport.scrollHeight > viewport.clientHeight, label + " uses outer scroll only when required"); }
        assert(surface.scrollHeight <= surface.clientHeight + 2, label + " content stays inside structural height");
        return rect(surface).bottom;
    };
    near(rect(home.querySelector(".home-calendar")).height, 245, "Home top panels unchanged");
    near(rect(home.querySelector(".home-projects")).height, 429, "Home bottom panels unchanged");
    for (const owner of [project, resource, ...["Research", "Explorations", "Inspiration"].map(name => ({ ...resource, name, root: "Resources/" + name, projectId: "resource:" + name.toLowerCase() }))]) {
        await mount(owner); f.controller.showFiles(); await settle();
        const explorer = f.root.querySelector(".hub-workspace-explorer"), right = f.root.querySelector(".project-right-column");
        checkBoundary(owner.name + " Work"); near(rect(explorer).bottom, rect(right).bottom, "Files and sidebar bottom aligned");
        near(rect(explorer).top, rect(right).top, "Files and Tasks top aligned");
        const tree = explorer.querySelector(".hub-explorer-tree");
        const before = rect(explorer).height;
        for (let i = 0; i < 150; i++) tree.createDiv({ text: "File " + i }).style.height = "32px";
        const tasks = f.root.querySelector(".project-tasks"); tasks.textContent = "";
        tasks.createDiv({ cls: "project-tasks-title", text: "Tasks" });
        const taskBody = tasks.createDiv({ cls: "project-tasks-body" });
        for (let i = 0; i < 100; i++) taskBody.createDiv({ text: "Task " + i }).style.height = "40px";
        const progress = f.root.querySelector(".project-progress"); progress.textContent = "";
        progress.createDiv({ cls: "project-progress-header", text: "Progress / History" }).style.height = "140px";
        const history = progress.createDiv({ cls: "project-progress-activity" }).createDiv({ cls: "project-progress-activity-body" });
        for (let i = 0; i < 100; i++) history.createDiv({ text: "Report " + i }).style.height = "36px";
        await settle();
        near(rect(explorer).height, before, "Long tree does not resize Files");
        for (const body of [tree, taskBody, history]) { assert(body.scrollHeight > body.clientHeight, "Long panel body overflows internally"); body.scrollTop = 100; assert(body.scrollTop > 0, "Panel body scrolls"); }
        checkBoundary(owner.name + " long content");
    }
    await mount(project);
    const bar = f.root.querySelector(".hub-context-bar"), search = bar.querySelector(".hub-context-search"), input = search.querySelector("input");
    const border = getComputedStyle(bar).borderColor, barBox = rect(bar), searchBox = rect(search);
    const modes = [...bar.querySelectorAll(".hub-task-mode")];
    assert(modes.map(button => button.textContent).join("|") === "Work|Schedule|Roadmap", "Mode tab order unchanged");
    for (const button of modes) {
        button.focus(); button.click(); await settle();
        assert(button.classList.contains("is-active"), "Clicked mode keeps its active treatment");
        assert(getComputedStyle(bar).borderColor === border, "Button focus never accents whole toolbar");
        assert(getComputedStyle(search).outlineStyle === "none", "Button focus never accents search");
        assert(getComputedStyle(button).outlineStyle !== "none", "Keyboard-focused mode has a visible local outline");
        near(rect(bar).height, barBox.height, "Focus does not resize toolbar");
    }
    input.focus(); await settle();
    assert(getComputedStyle(bar).borderColor === border, "Search focus leaves composite toolbar neutral");
    assert(getComputedStyle(search).outlineColor === getComputedStyle(f.root).getPropertyValue("--interactive-accent").trim() || getComputedStyle(search).outlineColor === "rgb(139, 92, 246)", "Search owns purple focus outline");
    assert(getComputedStyle(search).outlineStyle === "solid", "Focused search has visible outline");
    near(rect(search).width, searchBox.width, "Focus preserves search width");
    near(rect(bar).height, barBox.height, "Search focus preserves toolbar height");
    input.blur();
    f.click("Schedule"); f.click("Upcoming"); await settle();
    const upcomingBottom = checkBoundary("Upcoming");
    const columns = [...f.root.querySelectorAll(".hub-task-column")];
    assert(columns.length === 5, "Five Upcoming columns");
    columns.forEach(column => near(rect(column).bottom, upcomingBottom - 11, "Columns fill the panel body"));
    const body = columns[0].querySelector(".hub-task-column-body"), heading = columns[0].querySelector(".hub-task-column-heading");
    const headingTop = rect(heading).top;
    for (let i = 0; i < 100; i++) body.createDiv({ text: "More work " + i }).style.height = "45px";
    await settle(); body.scrollTop = 200;
    assert(body.scrollTop > 0, "Upcoming task region scrolls"); near(rect(heading).top, headingTop, "Upcoming header stays in place");
    for (const view of ["Month", "Week"]) {
        f.click(view); await settle(); near(checkBoundary(view), upcomingBottom, "Schedule bottom is stable across views");
        const days = [...f.root.querySelectorAll(".hub-task-calendar-day")];
        near(rect(days[0]).height, rect(days.at(-1)).height, "Calendar distributes week rows evenly");
        const cell = days[0], cellBody = cell.querySelector(".hub-task-calendar-day-body"), height = rect(cell).height;
        for (let i = 0; i < 80; i++) cellBody.createDiv({ text: "Event " + i }).style.height = "30px";
        await settle(); near(rect(cell).height, height, "Busy day keeps its cell height");
        cellBody.scrollTop = 100; assert(cellBody.scrollTop > 0, "Day content scrolls internally");
    }
    plugin.projectWizard.data.projectPlanning[project.projectId] = { phases: [], milestones: [] };
    f.click("Roadmap"); await settle(); const roadmapBottom = checkBoundary("Empty Roadmap");
    near(roadmapBottom, upcomingBottom, "Empty Roadmap keeps planning boundary");
    const empty = f.root.querySelector(".hub-task-view-empty"), panel = f.root.querySelector(".hub-roadmap-panel");
    assert(rect(empty).top - rect(panel).top < 90, "Empty text stays near the top");
    assert(f.root.querySelector(".project-main-grid").hidden, "Roadmap remains full-width without sidebar");
    plugin.projectWizard.data.projectPlanning[project.projectId] = { phases: Array.from({ length: 45 }, (_, i) => ({ id: "layout-phase-" + i, name: "Phase " + i, start: "2026-09-01", end: "2026-12-01", order: i })), milestones: [] };
    f.click("Roadmap"); await settle(); checkBoundary("Long Roadmap");
    const roadmapScroll = f.root.querySelector(".hub-roadmap-scroll");
    const axis = f.root.querySelector(".hub-roadmap-axis"), axisTop = rect(axis).top;
    roadmapScroll.scrollTop = 350; await settle(); assert(roadmapScroll.scrollTop > 0, "Roadmap rows scroll internally"); near(rect(axis).top, axisTop, "Roadmap axis stays visible");
    const range = f.root.querySelector('select[aria-label="Roadmap range"]'); range.value = "12"; range.dispatchEvent(new Event("change")); await settle();
    const horizontal = f.root.querySelector(".hub-roadmap-scroll"); horizontal.scrollLeft = 250;
    assert(horizontal.scrollLeft > 0 || horizontal.scrollWidth === horizontal.clientWidth, "Wide roadmap remains horizontally scrollable when needed");
    container.classList.add("hub-project-rail"); document.body.classList.add("hub-project-note-mode"); await settle();
    assert(!f.root.classList.contains("hub-full-view") && !f.root.style.getPropertyValue("--hub-full-view-height"), "Note mode releases Full-view sizing");
    container.classList.remove("hub-project-rail"); document.body.classList.remove("hub-project-note-mode"); await settle();
    assert(f.root.classList.contains("hub-full-view"), "Full-view sizing restored after Note mode");
    plugin.projectWizard.data.projectPlanning = originalData;
    f.click("Work"); await settle(); layout.update(); checkBoundary("Return to Work");
    const rootHeight = rect(f.root).height;
    viewport.scrollTop = 100; layout.update(); await settle();
    near(rect(f.root).height, rootHeight, "Outer scrolling does not change structural height");
    viewport.scrollTop = 0; viewport.style.bottom = "100px"; await settle(); await settle();
    checkBoundary("Resized viewport");
    viewport.style.bottom = "40px"; await settle(); await settle(); checkBoundary("Restored viewport");
    window.layoutPreview = async view => {
        plugin.projectWizard.data.projectPlanning = structuredClone(originalData);
        await mount(view === "Knowledge" ? resource : view === "Research" ? { ...resource, name: "Research", root: "Resources/Research", projectId: "resource:research" } : project);
        if (view === "Home") {
            const preview = f.root.cloneNode(true);
            preview.classList.remove("project-dashboard", "hub-full-view", "has-project-modes");
            preview.classList.add("home-dashboard"); preview.removeAttribute("style");
            for (const child of [...preview.children]) if (child.matches(".project-main-grid,.hub-task-workspace,.hub-roadmap-host")) child.remove();
            preview.querySelector(".hub-task-primary-modes")?.remove();
            preview.querySelector("input").placeholder = "Search Itacan...";
            preview.querySelector(".project-title").textContent = "Good evening";
            const grid = homeGrid.cloneNode(true);
            [...grid.children].forEach((panel, index) => panel.textContent = ["Calendar", "Today's Focus", "Tasks", "Projects / Resources", "Progress / History"][index]);
            preview.append(grid); container.replaceChildren(preview); await settle(); return;
        }
        if (view === "Empty Roadmap") plugin.projectWizard.data.projectPlanning[project.projectId] = { phases: [], milestones: [] };
        if (view.includes("Roadmap")) f.click("Roadmap");
        else if (["Upcoming", "Month", "Week"].includes(view)) { f.click("Schedule"); f.click(view); }
        else f.click("Work");
        await settle(); layout.update(); await settle();
    };
    home.remove();
    console.log("Full-view Home alignment and local focus passed", innerWidth, innerHeight);
};
