"use strict";
window.hubTestRoadmap = async f => {
    const { plugin, load, assert, settle, container } = f;
    const { localISODate } = load("domain/dates");
    const planning = load("domain/project-planning");
    const rect = el => el.getBoundingClientRect();
    const near = (a, b, message) => assert(Math.abs(a - b) < 1, message + ` (${a}, ${b})`);
    const shift = amount => { const date = new Date(); date.setDate(date.getDate() + amount); return localISODate(date); };
    const project = { ...f.project, projectId: "roadmap-refinement" };
    const originalGet = plugin.projectWizard.getProjectById;
    plugin.projectWizard.getProjectById = id => id === project.projectId ? project : originalGet(id);
    const names = ["Prototype Foundation and Application Architecture", "Prototype Refinement and Core Workflows", "Theme System and Visual Language", "Build-Ready Specification and Validation", "Standalone Application Development", "Stabilization and Closed Beta Preparation"];
    const phases = [];
    for (const [index, name] of names.entries()) phases.push(await plugin.planning.savePhase(project.projectId,
        { name, start: shift(-45 + index * 30), end: shift(-10 + index * 30) }));
    const milestones = [];
    for (const [index, day] of [-55, -15, -15, -14, 60, 160].entries()) milestones.push(await plugin.planning.saveMilestone(project.projectId,
        { name: index ? "Complete build-ready prototype specifications and validation" : "Initial architecture and project foundation approved", date: shift(day) }));
    const viewport = document.body.createDiv({ cls: "markdown-preview-view dashboard" });
    viewport.style.cssText = "position:fixed;inset:20px 20px 40px;overflow:auto";
    viewport.append(container); container.style.width = "1040px";
    const mount = async () => {
        f.mount(project); f.root.querySelector(".project-cover").style.display = "none"; f.click("Roadmap");
        load("ui/full-view-layout").mountFullViewLayout({ root: f.root, component: f.component, app: plugin.app });
        await settle(); await settle();
    };
    await mount();
    const panel = () => f.root.querySelector(".hub-roadmap-panel");
    const rangeSelect = () => panel().querySelector('button[aria-label="Roadmap range"]');
    const range = () => planning.roadmapViewport(plugin.planning.read(project.projectId), f.controller.state);
    const choose = async value => { rangeSelect().click(); const label = { all:"Entire project",3:"3 months",6:"6 months",12:"1 year" }[value]; [...document.querySelectorAll(".hub-fixture-menu button")].find(button => button.textContent === label).click(); await settle(); };
    const navigation = label => panel().querySelector(`[aria-label="${label}"]`);
    const today = () => [...panel().querySelectorAll("button")].find(button => button.textContent === "Today").click();
    const rows = () => [...panel().querySelectorAll(".hub-roadmap-phase")];
    const handle = row => row.querySelector(".hub-roadmap-drag-handle");
    const keyboard = (element, keys) => keys.forEach(key => element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
    assert(rangeSelect().dataset.value === "all", "New Roadmaps default to Entire project");
    const chevron = panel().querySelector(".hub-presets-chevron.is-closed");
    assert(chevron.dataset.icon === "chevron-right" && chevron.getAttribute("aria-hidden") === "true", "Presets closed disclosure affordance reused");
    const checkMonthLabels = () => panel().querySelectorAll(".hub-roadmap-month").forEach(cell => {
        assert(getComputedStyle(cell).textOverflow !== "ellipsis", "Month header never uses ellipsis");
        const text = cell.querySelector("span");
        if (text) assert(rect(text).width + 14 <= cell.clientWidth, "Visible month labels fit in full");
    });
    checkMonthLabels();
    rangeSelect().click(); await settle(); assert([...document.querySelectorAll(".hub-fixture-menu button")].map(option => option.textContent).join("|") === "Entire project|3 months|6 months|1 year", "Four conventional zoom options"); document.dispatchEvent(new KeyboardEvent("keydown", { key:"Escape" }));
    assert(panel().querySelectorAll(".hub-roadmap-phase-bar").length === phases.length, "Fit shows every dated phase");
    assert(panel().querySelectorAll(".hub-roadmap-milestone").length === milestones.length, "Fit shows every dated milestone");
    assert(range().position(shift(-55)) > 0 && range().position(shift(160)) < 100, "Intrinsic bounds include milestone extremes with padding");
    const guide = panel().querySelector(".hub-roadmap-today");
    near(parseFloat(guide.style.left), range().position(localISODate()), "Today guide is at its actual date");
    assert(parseFloat(guide.style.left) > 10 && parseFloat(guide.style.left) < 50, "Roadmap begins before Today");
    assert(rect(rows()[0].querySelector(".hub-roadmap-label")).width >= 220, "Comfortable shared phase column");
    for (const row of rows()) {
        near(rect(row).height, 54, "Uniform two-line row height");
        const text = row.querySelector(".hub-roadmap-phase-name span"), bar = row.querySelector(".hub-roadmap-phase-bar");
        assert(getComputedStyle(text).webkitLineClamp === "2" && getComputedStyle(text).whiteSpace === "normal", "Two-line phase clamping");
        assert(rect(text).height <= parseFloat(getComputedStyle(text).lineHeight) * 2 + 1, "No arbitrary title expansion");
        near(rect(bar).top + rect(bar).height / 2, rect(row).top + rect(row).height / 2, "Bar remains centered in its phase row");
        assert(handle(row).dataset.icon === "grip-vertical" && !handle(row).draggable, "Lucide pointer drag handle");
        assert(getComputedStyle(handle(row)).backgroundColor === "rgba(0, 0, 0, 0)", "Handle has no action fill");
    }
    assert(!panel().querySelector(".hub-roadmap-reorder,[aria-label^='Move ']") , "Old move buttons removed");
    const labels = [...panel().querySelectorAll(".hub-roadmap-milestone-caption")];
    const firstGlyph=panel().querySelector(".hub-roadmap-diamond polygon");
    near((firstGlyph.points.getItem(0).y+firstGlyph.points.getItem(2).y)/2,31,"Milestone content retains its established center baseline");
    labels.forEach(label => {
        assert(getComputedStyle(label.querySelector(".hub-roadmap-milestone-title")).webkitLineClamp === "2", "Two-line milestone clamp");
        assert(!label.querySelector(".hub-roadmap-milestone-date"), "Milestone date is available through native tooltip only");
    });
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
        const a = rect(labels[i]), b = rect(labels[j]);
        assert(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, "Milestone captions never overlap");
    }
    for (const milestone of milestones) {
        const marker = [...panel().querySelectorAll(".hub-roadmap-milestone")].find(marker => marker.dataset.planningId === milestone.id);
        const glyph=[...panel().querySelectorAll(".hub-roadmap-diamond")].find(el=>el.dataset.milestoneId===milestone.id).querySelector("polygon");
        near(glyph.points.getItem(0).x/glyph.ownerSVGElement.viewBox.baseVal.width*100, range().position(milestone.date), "Collision handling never moves a date marker");
    }
    const colorSequence = () => rows().map(row => getComputedStyle(row.querySelector(".hub-roadmap-phase-bar")).backgroundColor);
    const colors = colorSequence();
    assert(colors[0] === "rgb(163, 122, 222)", "First phase keeps the established purple");
    assert(new Set(colors).size === phases.length, "Smooth sequence does not repeat a four-color cycle");
    const before = plugin.planning.read(project.projectId), dates = before.phases.map(phase => [phase.id, phase.start, phase.end]);
    const phaseScroller = panel().querySelector(".hub-roadmap-scroll");
    phaseScroller.scrollTop = phaseScroller.scrollHeight;
    const source = rows()[0], destination = rows().at(-1), sourceRect = rect(handle(source));
    const x = sourceRect.left + sourceRect.width / 2, y = sourceRect.top + sourceRect.height / 2;
    const pointer = (target, type, positionY) => target.dispatchEvent(new PointerEvent(type,
        { pointerId: 7, isPrimary: true, button: 0, clientX: x, clientY: positionY, bubbles: true, cancelable: true }));
    pointer(handle(source), "pointerdown", y);
    pointer(document, "pointermove", rect(destination).top + rect(destination).height / 2);
    const placeholder = panel().querySelector(".hub-roadmap-placeholder");
    assert(placeholder && source.classList.contains("is-pointer-dragging"), "Presets floating row and insertion placeholder");
    assert(getComputedStyle(source).position === "absolute" && getComputedStyle(source).opacity === "1", "Presets elevated surface retains opacity");
    assert(getComputedStyle(source).zIndex === "3", "Floating phase sits above neighboring sticky labels");
    assert(getComputedStyle(source).boxShadow !== "none", "Presets floating-row elevation reused");
    await new Promise(resolve => setTimeout(resolve, 160));
    assert(rect(rows().find(row => row !== source)).top < y, "Surrounding phases move into the vacated slot");
    pointer(document, "pointerup", rect(placeholder).top + rect(placeholder).height / 2);
    await new Promise(resolve => setTimeout(resolve, 180)); await settle();
    assert(plugin.planning.read(project.projectId).phases.at(-1).id === before.phases[0].id, "Pointer drop persists the phase at its destination");
    assert(JSON.stringify(dates.slice().sort()) === JSON.stringify(plugin.planning.read(project.projectId).phases.map(phase => [phase.id, phase.start, phase.end]).sort()), "Drag preserves all dates and identities");
    assert(JSON.stringify(colorSequence()) === JSON.stringify(colors), "Color progression follows displayed order");
    const movedHandle = handle(rows().at(-1));
    keyboard(movedHandle, [" ", "Home", "Escape"]); await settle();
    assert(plugin.planning.read(project.projectId).phases.at(-1).id === before.phases[0].id, "Keyboard cancel leaves persisted order intact");
    keyboard(movedHandle, [" ", "Home", " "]); await settle();
    assert(plugin.planning.read(project.projectId).phases[0].id === before.phases[0].id, "Keyboard pickup/move/drop persists order");
    assert(document.activeElement === handle(rows()[0]), "Reordering restores handle focus");
    const panelHeight = rect(panel()).height, toolbarPositions = () => [...f.root.querySelectorAll(".hub-task-mode,.hub-task-primary-modes,.hub-context-search")].map(el => [rect(el).left, rect(el).width]);
    const topPositions = toolbarPositions();
    for (const zoom of ["3", "6", "12"]) {
        await choose(zoom); checkMonthLabels(); const start = panel().dataset.viewportStart;
        navigation("Next range").click(); await settle();
        assert(rangeSelect().dataset.value === zoom && panel().dataset.viewportStart !== start, "Next pans at the selected zoom");
        navigation("Previous range").click(); await settle(); assert(panel().dataset.viewportStart === start, "Previous reverses the pan");
        today(); await settle(); assert(rangeSelect().dataset.value === zoom, "Today keeps zoom");
        assert(range().position(localISODate()) > 15 && range().position(localISODate()) < 70, "Today repositions to the middle of the viewport");
        near(rect(panel()).height, panelHeight, "Zoom does not expand Full-view height");
        assert(JSON.stringify(toolbarPositions()) === JSON.stringify(topPositions), "Project mode and search geometry unchanged");
        assert(!panel().querySelector(".hub-planning-navigation h3"), "Month axis replaces the redundant range label");
    }
    await choose("6"); navigation("Next range").click(); await settle();
    const savedStart = panel().dataset.viewportStart; await mount();
    assert(rangeSelect().dataset.value === "6" && panel().dataset.viewportStart === savedStart, "Existing warm-state architecture retains zoom and viewport");
    await choose("all"); navigation("Next range").click(); await settle();
    const span = range().total; today(); await settle(); assert(range().total === span && rangeSelect().dataset.value === "all", "Today restores full plan without changing scale");
    const added = await plugin.planning.saveMilestone(project.projectId, { name:"Later delivery", date:shift(200) }); await settle();
    assert(range().position(added.date) < 100, "Fit updates when project bounds change");
    await plugin.planning.remove(project.projectId, "milestones", added.id);
    for (const width of [1040, 1440, 900]) {
        container.style.width = width + "px"; await settle();
        checkMonthLabels();
        const row = rows()[0], track = row.querySelector(".hub-roadmap-track"), grid = panel().querySelector(".hub-roadmap-grid");
        near(rect(track).left, rect(grid).left, "Label/timeline/grid share a boundary at " + width);
        assert(panel().querySelector(".hub-roadmap-scroll").scrollHeight > panel().querySelector(".hub-roadmap-scroll").clientHeight, "Dense Roadmap scrolls inside standardized panel");
    }
    // A plan whose fit padding exposes narrow month fragments at both edges.
    const edgeProject = { ...project, projectId: "roadmap-polish-edges" };
    const currentGet = plugin.projectWizard.getProjectById;
    plugin.projectWizard.getProjectById = id => id === edgeProject.projectId ? edgeProject : currentGet(id);
    const year = new Date().getFullYear();
    await plugin.planning.savePhase(edgeProject.projectId, { name: "Edge-month label verification",
        start: `${year}-09-05`, end: `${year + 1}-02-25` });
    f.mount(edgeProject); f.root.querySelector(".project-cover").style.display = "none"; f.click("Roadmap");
    load("ui/full-view-layout").mountFullViewLayout({ root: f.root, component: f.component, app: plugin.app });
    await settle(); await settle();
    const edgeCells = [...panel().querySelectorAll(".hub-roadmap-month")];
    assert(!edgeCells[0].textContent && !edgeCells.at(-1).textContent, "Both narrow edge-month labels are suppressed completely");
    assert(edgeCells.slice(1, -1).every(cell => cell.textContent), "Interior month labels remain complete");
    assert(panel().dataset.viewportStart.startsWith(`${year}-08`) && panel().dataset.viewportEnd.startsWith(`${year + 1}-03`), "Internal viewport retains the actual padded span");
    assert(panel().querySelectorAll(".hub-roadmap-week").length > 20 && panel().querySelector(".hub-roadmap-phase-bar"), "Edge-label suppression preserves timeline content");
    checkMonthLabels();
    window.roadmapPreview = async zoom => { container.style.width = "1400px"; await mount(); await choose(zoom); viewport.scrollTop = 0; };
    window.roadmapPreviewEmpty = async () => { f.mount({ ...project, projectId:"roadmap-empty" }); f.root.querySelector(".project-cover").style.display="none"; f.click("Roadmap"); await settle(); };
    await window.roadmapPreview("all");
};
