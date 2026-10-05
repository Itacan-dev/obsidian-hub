"use strict";
window.hubTestRoadmapAnchors = async f => {
    const { plugin, load, settle, assert, container } = f;
    const { localISODate } = load("domain/dates"), { roadmapViewport } = load("domain/project-planning");
    const project = { ...f.project, projectId: "anchor-regression" };
    const lookup = plugin.projectWizard.getProjectById;
    plugin.projectWizard.getProjectById = id => id === project.projectId ? project : lookup(id);
    await plugin.planning.savePhase(project.projectId, { name: "Geometry reference", start: "2026-09-01", end: "2027-03-01" });
    const examples = [
        ["Core functionality of Obsidian prototype", "2026-09-30", true],
        ["33", "2026-10-07", false],
        ["Integrate Atlas into Obsidian prototype", "2026-10-18", false],
        ["Visual Product Baseline Complete", "2026-10-31", false]
    ];
    for (const [name, date, achieved] of examples) await plugin.planning.saveMilestone(project.projectId, { name, date, achieved });
    container.style.width = "1200px"; f.mount(project); f.click("Roadmap"); await settle();
    const panel = () => f.root.querySelector(".hub-roadmap-panel");
    const byId = (elements, id, key = "milestoneId") => [...elements].find(el => el.dataset[key] === id);
    const metrics = { checks: 0, routes: 0, maxTipError: 0, maxCardError: 0 };
    const settleGeometry = async () => { await settle(); await settle(); }; // ResizeObserver + scheduled layout.
    const check = label => {
        const svg = panel().querySelector(".hub-roadmap-leaders"), range = roadmapViewport(plugin.planning.read(project.projectId), f.controller.state);
        const cards = [...panel().querySelectorAll(".hub-roadmap-milestone-caption")].filter(el => !el.hidden);
        metrics.checks++;
        for (const group of svg.querySelectorAll(".hub-roadmap-diamond")) {
            const polygon = group.querySelector("polygon"), points = polygon.points, centerX = points.getItem(0).x;
            const item = plugin.planning.read(project.projectId).milestones.find(item => item.id === group.dataset.milestoneId);
            assert(Math.abs(centerX / svg.viewBox.baseVal.width * 100 - range.position(item.date)) < .0001, label + ": diamond stays at exact date");
            const marker = byId(panel().querySelectorAll(".hub-roadmap-milestone"), item.id, "planningId");
            const screen = new DOMPoint(centerX, (points.getItem(0).y + points.getItem(2).y) / 2).matrixTransform(polygon.getScreenCTM());
            const hit = marker.getBoundingClientRect();
            assert(Math.abs((hit.left + hit.right) / 2 - screen.x) < .05 && Math.abs((hit.top + hit.bottom) / 2 - screen.y) < .05, label + ": native editing hit area follows glyph");
            assert(marker.tagName === "BUTTON" && marker.tabIndex === 0 && marker.getAttribute("aria-label"), "Native keyboard and accessible name preserved");
        }
        for (const path of svg.querySelectorAll("path")) {
            const glyph = byId(svg.querySelectorAll(".hub-roadmap-diamond"), path.dataset.milestoneId).querySelector("polygon");
            assert(glyph.ownerSVGElement === path.ownerSVGElement, "Diamond and connector share their actual SVG coordinate space");
            const values = path.getAttribute("d").match(/-?\d+(?:\.\d+)?/g).map(Number);
            const outer = glyph.getAttribute("points").split(/[ ,]/).map(Number);
            assert(values[0] === outer[4] && values[1] === outer[5], "Path M literally equals the rendered bottom vertex");
            const tip = glyph.points.getItem(2).matrixTransform(glyph.getScreenCTM());
            const start = path.getPointAtLength(0).matrixTransform(path.getScreenCTM());
            const tipError = Math.hypot(start.x - tip.x, start.y - tip.y);
            metrics.maxTipError = Math.max(metrics.maxTipError, tipError); metrics.routes++;
            assert(tipError < .01, label + ": visible SVG start meets vertex, error=" + tipError);
            const bounds = glyph.getBoundingClientRect();
            assert(Math.hypot(start.x - (bounds.left + bounds.right) / 2, start.y - bounds.bottom) < .01, label + ": independent rendered-bounds check");
            const card = byId(cards, path.dataset.milestoneId), box = card.getBoundingClientRect();
            const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM());
            const cardError = Math.abs(end.y - box.top); metrics.maxCardError = Math.max(metrics.maxCardError, cardError);
            assert(cardError < .01 && end.x >= box.left && end.x <= box.right, label + ": connector meets actual card boundary");
            for (let i = 2; i < values.length; i += 2) assert(values[i] === values[i - 2] || values[i + 1] === values[i - 1], "Routes stay orthogonal");
        }
        for (const [i, card] of cards.entries()) {
            assert(getComputedStyle(card).backgroundColor === "rgba(0, 0, 0, 0)", "Transparent annotations preserved");
            const a = card.getBoundingClientRect();
            for (const other of cards.slice(i + 1)) { const b = other.getBoundingClientRect(); assert(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, label + ": collision lanes stay disjoint"); }
        }
    };
    const choose = async zoom => {
        panel().querySelector('[aria-label="Roadmap range"]').click();
        const text = { all: "Entire project", 3: "3 months", 6: "6 months", 12: "1 year" }[zoom];
        [...document.querySelectorAll(".hub-fixture-menu button")].find(el => el.textContent === text).click(); await settleGeometry();
    };
    check("screenshot examples");
    // Regression: the previous renderer detached by 5.26px at this scale.
    // Check projected screen coordinates, not a local value plus a parent rect.
    for (const scale of [1.02, .8, 1.25]) {
        f.root.style.transformOrigin = "top left"; f.root.style.transform = `scale(${scale})`;
        await settleGeometry(); check("ancestor transform without redraw " + scale);
        f.click("Roadmap"); await settleGeometry(); check("ancestor transform " + scale);
    }
    f.root.style.transform = "";
    for (const zoom of [.8, 1.25]) { f.root.style.zoom = zoom; f.click("Roadmap"); await settleGeometry(); check("CSS zoom " + zoom); }
    f.root.style.zoom = ""; f.click("Roadmap"); await settleGeometry();
    for (const width of [760, 900, 1040, 1440]) {
        container.style.width = width + "px"; await settleGeometry();
        for (const zoom of ["all", "3", "6", "12"]) {
            await choose(zoom); check(width + "/" + zoom);
            for (const action of ["Next range", "Previous range", "Today"]) {
                const control = action === "Today" ? [...panel().querySelectorAll(".hub-planning-navigation button")].find(el => el.textContent === action) : panel().querySelector(`[aria-label="${action}"]`);
                control.click(); await settleGeometry(); check(action);
            }
            const scroll = panel().querySelector(".hub-roadmap-scroll");
            scroll.scrollLeft = scroll.scrollWidth; await settleGeometry(); check("horizontal scroll end");
            scroll.scrollLeft = 0; scroll.scrollTop = scroll.scrollHeight; await settleGeometry(); check("vertical scroll"); scroll.scrollTop = 0;
        }
    }
    await choose("3");
    const fixed = roadmapViewport(plugin.planning.read(project.projectId), f.controller.state);
    const day = offset => { const date = new Date(fixed.start); date.setDate(date.getDate() + offset); return localISODate(date); };
    const count = fixed.total;
    for (const [label, offsets] of [["left edge", [0, 1, 2, 3, 4, 5]], ["middle cluster", [40, 41, 42, 43, 44, 45]], ["right edge", [count - 6, count - 5, count - 4, count - 3, count - 2, count - 1]]]) {
        const snapshot = plugin.projectWizard.data.projectPlanning[project.projectId];
        snapshot.milestones = offsets.map((offset, i) => ({ id: label + i, name: "A dense cluster milestone with a multi-line title " + i, date: day(offset), achieved: i === 0 }));
        f.click("Roadmap"); await settleGeometry(); check(label);
        assert(panel().querySelectorAll(".hub-roadmap-leaders path").length, label + ": displaced labels have visible leaders");
    }
    // Font/reflow changes must refresh paths without a temporal/data render.
    const before = plugin.planning.read(project.projectId).revision;
    const firstCard = panel().querySelector(".hub-roadmap-milestone-caption:not([hidden])");
    const oldHeight = firstCard.getBoundingClientRect().height;
    firstCard.querySelector(".hub-roadmap-milestone-title").style.lineHeight = "2.2";
    await settleGeometry(); assert(firstCard.getBoundingClientRect().height > oldHeight, "Label reflow really occurred"); check("label reflow");
    assert(plugin.planning.read(project.projectId).revision === before, "Geometry refresh never writes planning data");
    const snapshot = plugin.projectWizard.data.projectPlanning[project.projectId];
    snapshot.milestones = [{ id: "isolated", name: "Isolated milestone", date: day(40), achieved: false }];
    f.click("Roadmap"); await settleGeometry(); check("isolated");
    assert(!panel().querySelector(".hub-roadmap-leaders path"), "Centered isolated labels keep the existing needed-only connector rule");
    const marker = panel().querySelector(".hub-roadmap-milestone"), hit = marker.getBoundingClientRect();
    assert(document.elementFromPoint((hit.left + hit.right) / 2, (hit.top + hit.bottom) / 2)?.closest("button") === marker, "Visible diamond center hits the same native editing button");
    marker.focus(); assert(document.activeElement === marker, "Native keyboard focus remains on the milestone"); marker.click(); await settle();
    assert(window.lastModal.contentEl.querySelector("h2").textContent === "Edit milestone", "Diamond click reaches existing editor"); window.lastModal.close();
    // Addition/edit/deletion and the service subscription all refresh geometry.
    const added = await plugin.planning.saveMilestone(project.projectId, { name: "Added event", date: day(41) }); await settleGeometry(); check("addition");
    await plugin.planning.saveMilestone(project.projectId, { ...added, name: "Edited event with a taller title", date: day(42) }); await settleGeometry(); check("editing");
    await plugin.planning.remove(project.projectId, "milestones", added.id); await settleGeometry(); check("deletion");
    window.roadmapAnchorMetrics = metrics;
    window.roadmapAnchorCheck = async () => { await settleGeometry(); check("external window resize"); return metrics; };
    window.roadmapAnchorPreview = async (scale = 1) => {
        plugin.projectWizard.data.projectPlanning[project.projectId].milestones = examples.map(([name, date, achieved], i) => ({ id: "example-" + i, name, date, achieved }));
        container.style.width = "1200px"; f.root.style.transformOrigin = "top left"; f.root.style.transform = `scale(${scale})`; f.click("Roadmap"); await choose("all");
        panel().scrollIntoView({ block: "start" }); await settleGeometry(); check("visual preview");
        assert(panel().querySelectorAll(".hub-roadmap-diamond").length===4&&panel().querySelectorAll(".hub-roadmap-leaders path").length>0,"Visual preview really contains the screenshot cluster and routed leaders");
    };
    await window.roadmapAnchorPreview();
    console.log("Roadmap anchors: " + JSON.stringify(metrics));
};
