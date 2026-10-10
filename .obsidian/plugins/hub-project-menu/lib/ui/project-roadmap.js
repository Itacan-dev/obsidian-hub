"use strict";
const { Notice, Menu, setIcon } = require("obsidian");
const { localISODate, parseLocalISODate, formatDate } = require("../domain/dates");
const { roadmapViewport, roadmapZoom, panRoadmap, roadmapToday, phasePlacement } = require("../domain/project-planning");
const { button, iconButton } = require("./task-view-primitives");
const { openPlanningEditor } = require("./planning-editor");
const { bindListReorder } = require("./list-reorder");
const { setHubIcon } = require("./icons");
const { setHubTooltip, bindHubFocusTooltip } = require("./tooltips");
const { disclosureIcons } = require("./disclosure");
const { milestoneDiamond, placeMilestoneCards, milestoneLeaders } = require("../domain/roadmap-milestones");

function mountProjectRoadmap({ plugin, component, dv, host, workspace, state }) {
    const service = plugin.planning;
    // Retain the existing warm-view state, including an earlier chosen fixed zoom.
    if (state.roadmapZoom == null) {
        state.roadmapZoom = state.roadmapMonths ? String(state.roadmapMonths) : "all";
        state.roadmapViewport = state.roadmapAnchor ? localISODate(state.roadmapAnchor) : null;
    }
    const panel = host.createDiv({ cls: "project-panel hub-roadmap-panel" });
    const dismissDateTooltip = bindHubFocusTooltip(panel, component, ".hub-roadmap-milestone, .hub-roadmap-milestone-caption");
    let disposed = false, cancelReorder = () => {}, cancelMilestoneLayout = () => {}, activeMenu = null;
    const edit = (kind, value, defaults) => openPlanningEditor(service, workspace.projectId, kind, value, dv, defaults);
    const closeMenu = () => { activeMenu?.hide(); activeMenu = null; };
    const month = date => formatDate(date, "month-short");
    const dateLabel = iso => formatDate(new Date(iso + "T12:00:00"));
    function render() {
        if (disposed) return;
        const previous = panel.querySelector(".hub-roadmap-scroll"), scroll = { left: previous?.scrollLeft ?? 0, top: previous?.scrollTop ?? 0 };
        cancelReorder(); cancelMilestoneLayout(); closeMenu(); dismissDateTooltip(); panel.replaceChildren();
        const data = service.read(workspace.projectId), range = roadmapViewport(data, state);
        panel.dataset.viewportStart = localISODate(range.start); panel.dataset.viewportEnd = localISODate(range.end);
        const changeViewport = patch => { Object.assign(state, patch); const current = panel.querySelector(".hub-roadmap-scroll"); if (current) current.scrollLeft = 0; render(); };
        const toolbar = panel.createDiv({ cls: "hub-planning-toolbar" });
        const title = toolbar.createDiv({ cls: "project-panel-title project-tasks-title hub-roadmap-title", attr: { role: "heading", "aria-level": "2" } });
        setHubIcon(title.createSpan({ cls: "project-tasks-title-icon", attr: { "aria-hidden": "true" } }), "route");
        title.createSpan({ text: "Roadmap" });
        const actions = toolbar.createDiv({ cls: "hub-planning-actions hub-roadmap-controls" });
        const choices = [["all", "Entire project"], ["3", "3 months"], ["6", "6 months"], ["12", "1 year"]];
        const dropdown = button(actions, choices.find(([value]) => value === state.roadmapZoom)?.[1] ?? "Entire project", () => showRanges(), "hub-panel-action hub-roadmap-range-select");
        const rangeLabel = dropdown.querySelector("span"), currentLabel = rangeLabel.textContent;
        rangeLabel.textContent = ""; rangeLabel.classList.add("hub-roadmap-range-label");
        rangeLabel.createSpan({ cls: "hub-roadmap-range-current", text: currentLabel });
        dropdown.dataset.value = state.roadmapZoom;
        for (const [key, value] of Object.entries({ "aria-label": "Roadmap range", "aria-haspopup": "menu", "aria-expanded": "false" })) dropdown.setAttribute(key, value);
        disclosureIcons(dropdown);
        function showRanges() {
            if (activeMenu) { closeMenu(); return; }
            const menu = activeMenu = new Menu();
            for (const [value, label] of choices) menu.addItem(item => item.setTitle(label).setChecked(value === state.roadmapZoom)
                .onClick(() => changeViewport(roadmapZoom(data, state, value))));
            menu.onHide(() => { if (activeMenu === menu) activeMenu = null; dropdown.setAttribute("aria-expanded", "false");
                const focused = dropdown.ownerDocument.activeElement;
                if (dropdown.isConnected && (focused === dropdown.ownerDocument.body || focused?.closest(".menu"))) dropdown.focus({ preventScroll: true });
            });
            dropdown.setAttribute("aria-expanded", "true");
            const rect = dropdown.getBoundingClientRect(); menu.showAtPosition({ x: rect.left, y: rect.bottom });
        }
        dropdown.addEventListener("keydown", event => { if (event.key === "ArrowDown") { event.preventDefault(); showRanges(); } });
        const creation = actions.createDiv({ cls: "hub-roadmap-creation hub-equal-selectors", attr: { role: "group", "aria-label": "Create planning item" } });
        button(creation, "Phase", () => edit("phases"), "hub-panel-action hub-roadmap-add-phase", "plus");
        button(creation, "Milestone", () => edit("milestones"), "hub-panel-action hub-roadmap-add-milestone", "plus");
        const contextualCreation = (surface, track) => surface.addEventListener("contextmenu", event => {
            if (event.target.closest("button,input,select,textarea,a,[role=button],.hub-roadmap-label")) return;
            event.preventDefault(); closeMenu();
            const bounds = track?.getBoundingClientRect();
            let date = localISODate();
            if (bounds && event.clientX >= bounds.left && event.clientX <= bounds.right) {
                const day = Math.min(range.total - 1, Math.max(0, Math.floor((event.clientX - bounds.left) / bounds.width * range.total)));
                const inferred = new Date(range.start); inferred.setDate(inferred.getDate() + day); date = localISODate(inferred);
            }
            const menu = activeMenu = new Menu();
            menu.addItem(item => item.setTitle("Add phase").onClick(() => edit("phases", null, { start: date })));
            menu.addItem(item => item.setTitle("Add milestone").onClick(() => edit("milestones", null, { date })));
            menu.onHide(() => { if (activeMenu === menu) activeMenu = null; });
            menu.showAtPosition({ x: event.clientX, y: event.clientY });
        });
        const scroller = panel.createDiv({ cls: "hub-roadmap-scroll" });
        const timeline = scroller.createDiv({ cls: "hub-roadmap-timeline" });
        const scaleWidth = state.roadmapZoom === "all" ? 0 : Math.max(530, Number(state.roadmapZoom) * 85);
        timeline.style.setProperty("--hub-roadmap-scale-width", scaleWidth + "px");
        const makeRow = (cls, parent = timeline) => {
            const row = parent.createDiv({ cls: "hub-roadmap-row " + cls });
            const label = row.createDiv({ cls: "hub-roadmap-label" }), track = row.createDiv({ cls: "hub-roadmap-track" });
            return { row, label, track };
        };
        const axis = makeRow("hub-roadmap-axis");
        const navigation = axis.label.createDiv({ cls: "hub-planning-navigation hub-roadmap-axis-navigation", attr: { role: "group", "aria-label": "Roadmap time navigation" } });
        const move = amount => changeViewport(panRoadmap(data, state, amount));
        iconButton(navigation, "Previous range", "chevron-left", () => move(-1));
        iconButton(navigation, "Next range", "chevron-right", () => move(1));
        button(navigation, "Today", () => changeViewport(roadmapToday(data, state)), "hub-panel-action");
        for (let start = new Date(range.start.getFullYear(), range.start.getMonth(), 1); start < range.end;
            start = new Date(start.getFullYear(), start.getMonth() + 1, 1)) {
            const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
            const left = Math.max(0, range.position(localISODate(start))), right = Math.min(100, range.position(localISODate(end)));
            const heading = axis.track.createSpan({ cls: "hub-roadmap-month", attr: { title: month(start) } });
            heading.style.left = left + "%"; heading.style.width = right - left + "%";
            const text = heading.createSpan({ text: month(start) });
            // Measure the actual theme typography; retain the month cell/grid even
            // when the visible fragment cannot fit the complete label.
            const style = getComputedStyle(heading);
            const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
            if (text.getBoundingClientRect().width + padding > heading.clientWidth) text.remove();
        }
        const monday = new Date(range.start); monday.setDate(monday.getDate() + (8 - monday.getDay()) % 7);
        const weeks = [];
        for (let date = monday; date < range.end; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)) {
            const left = range.position(localISODate(date)); weeks.push(left);
            const marker = axis.track.createSpan({ cls: "hub-roadmap-week", text: String(date.getDate()) }); marker.style.left = left + "%";
        }
        if (!data.phases.length && !data.milestones.length) {
            timeline.classList.add("is-empty");
            const empty = timeline.createDiv({ cls: "hub-task-view-empty", text: "No phases or milestones yet." });
            contextualCreation(empty); return;
        }
        const milestones = makeRow("hub-roadmap-milestones"); milestones.label.createSpan({ text: "Milestones" });
        const visibleMilestones = data.milestones.filter(item => range.position(item.date) >= 0 && range.position(item.date) < 100).sort((a, b) => a.date.localeCompare(b.date));
        const svgElement = (parent, tag, attributes = {}) => {
            const element = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", tag);
            for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
            parent.append(element); return element;
        };
        const svg = svgElement(milestones.track, "svg", { class: "hub-roadmap-leaders", "aria-hidden": "true", preserveAspectRatio: "none" });
        const leaders = svgElement(svg, "g"), diamonds = svgElement(svg, "g"); // Glyphs paint above their leaders.
        const polygonPoints = vertices => [vertices.top, vertices.right, vertices.bottom, vertices.left].map(point => point.join(",")).join(" ");
        const labels = [];
        for (const item of visibleMilestones) {
            const marker = button(milestones.track, "", () => edit("milestones", item), "hub-button-plain hub-roadmap-milestone" + (item.achieved ? " is-achieved" : ""));
            marker.dataset.planningId = item.id;
            const exactDate = formatDate(parseLocalISODate(item.date));
            const tooltip = item.name + " — " + exactDate + (item.achieved ? ", achieved" : "");
            setHubTooltip(marker, tooltip); marker.dataset.hubFocusTooltip = exactDate;
            // The native button remains the editing/focus target; its glyph and
            // connector are both rendered in the one authoritative SVG space.
            const diamond = svgElement(diamonds, "g", { class: "hub-roadmap-diamond", "data-milestone-id": item.id });
            const outline = svgElement(diamond, "polygon");
            const interior = item.achieved ? null : svgElement(diamond, "polygon", { class: "hub-roadmap-diamond-interior" });
            const label = button(milestones.track, "", () => edit("milestones", item), "hub-button-plain hub-roadmap-milestone-caption");
            label.dataset.milestoneId = item.id;
            setHubTooltip(label, tooltip); label.dataset.hubFocusTooltip = exactDate;
            label.createSpan({ cls: "hub-roadmap-milestone-title", text: item.name });
            labels.push({ item, marker, diamond, outline, interior, label });
        }
        let moreButton;
        function layoutMilestones() {
            // CSS layout pixels, never viewport bounding-box distances. The
            // SVG viewBox uses these same units even under ancestor zoom/scale.
            const trackWidth = parseFloat(getComputedStyle(milestones.track).width);
            if (!trackWidth) return;
            const left = scroller.scrollLeft, labelWidth = parseFloat(getComputedStyle(milestones.label).width);
            const right = Math.min(trackWidth, left + scroller.clientWidth - labelWidth);
            const visible = labels.filter(({ item }) => { const x = range.position(item.date) / 100 * trackWidth; return x >= left && x <= right; });
            const updateViewBox = () => svg.setAttribute("viewBox", `0 0 ${trackWidth} ${parseFloat(getComputedStyle(milestones.track).height)}`);
            updateViewBox();
            // Only HTML card bounds need conversion. Inverse CTM accounts for
            // SVG origin/viewBox, ancestor transforms/zoom and both scroll axes.
            const localBounds = element => {
                const bounds = element.getBoundingClientRect(), inverse = svg.getScreenCTM().inverse();
                const a = new DOMPoint(bounds.left, bounds.top).matrixTransform(inverse);
                const b = new DOMPoint(bounds.right, bounds.bottom).matrixTransform(inverse);
                return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
            };
            for (const entry of labels) {
                const geometry = entry.geometry = milestoneDiamond(range.position(entry.item.date) / 100 * trackWidth);
                entry.outline.setAttribute("points", polygonPoints(geometry.anchors));
                entry.interior?.setAttribute("points", polygonPoints(geometry.interior));
                // A transparent native hit area follows the explicit glyph bounds.
                entry.marker.style.left = geometry.anchors.left[0] + "px";
                entry.marker.style.top = geometry.anchors.top[1] + "px";
                entry.marker.style.width = entry.marker.style.height = 2 * geometry.radius + "px";
            }
            labels.forEach(({ label }) => { label.hidden = true; }); moreButton?.remove(); leaders.replaceChildren();
            const gap = parseFloat(getComputedStyle(panel).getPropertyValue("--hub-panel-gap")) || 12;
            const width = Math.min(145, Math.max(1, right - left - gap));
            const items = visible.map(({ item, label, geometry }) => {
                label.hidden = false; label.style.width = width + "px";
                return { id: item.id, x: geometry.x, tip: geometry.anchors.bottom, height: localBounds(label).height };
            });
            const bottom = milestoneDiamond(0).anchors.bottom[1];
            const layout = placeMilestoneCards(items, { left, right, width, gap, top: bottom + gap });
            visible.forEach(({ label }) => { label.hidden = true; });
            for (const card of layout.cards) {
                const label = labels.find(entry => entry.item.id === card.id).label;
                label.hidden = false; label.style.left = card.left + "px"; label.style.top = card.top + "px";
            }
            if (layout.more) {
                moreButton = button(milestones.track, layout.overflow.length + " more milestones", () => {
                    closeMenu(); const menu = activeMenu = new Menu();
                    for (const entry of layout.overflow) {
                        const item = data.milestones.find(item => item.id === entry.id);
                        menu.addItem(choice => choice.setTitle(item.name + " - " + dateLabel(item.date)).onClick(() => edit("milestones", item)));
                    }
                    menu.onHide(() => { if (activeMenu === menu) activeMenu = null; });
                    const rect = moreButton.getBoundingClientRect(); menu.showAtPosition({ x: rect.left, y: rect.bottom });
                }, "hub-panel-action hub-roadmap-more");
                moreButton.style.left = layout.more.left + "px"; moreButton.style.top = layout.more.top + "px"; moreButton.style.width = layout.more.width + "px";
            }
            milestones.row.style.height = Math.max(113, bottom + gap + layout.lanes * layout.pitch) + "px";
            milestones.row.dataset.lanes = String(layout.lanes);
            updateViewBox();
            // Card endpoints use the same SVG-local units as explicit vertices.
            const cards = layout.cards.map(card => ({ ...card, ...localBounds(labels.find(entry => entry.item.id === card.id).label) }));
            const more = layout.more ? { ...layout.more, ...localBounds(moreButton) } : null;
            const today = range.position(localISODate()) / 100 * trackWidth;
            for (const route of milestoneLeaders(cards, { bottom, left, right, today, more })) {
                const path = document.createElementNS(svg.namespaceURI, "path");
                path.dataset.milestoneId = route.id;
                path.setAttribute("d", route.points.map(([x, y], index) => (index ? "L" : "M") + x + " " + y).join(" "));
                leaders.append(path);
            }
        }
        const heading = makeRow("hub-roadmap-phase-heading"); heading.label.createSpan({ text: "Phases" });
        const phaseList = timeline.createDiv({ cls: "hub-roadmap-phase-list" });
        const rows = [], handles = [];
        const status = panel.createDiv({ cls: "hub-roadmap-status", attr: { role: "status", "aria-live": "polite" } });
        data.phases.forEach((phase, index) => {
            const { row, label, track } = makeRow("hub-roadmap-phase", phaseList);
            row.dataset.reorderId = phase.id; rows.push(row);
            const strength = data.phases.length < 2 ? 100 : 100 - index / (data.phases.length - 1) * 100;
            row.style.setProperty("--hub-phase-color", index === 0 ? "var(--hub-phase-0)" :
                `color-mix(in oklab, var(--hub-phase-0) ${strength}%, var(--hub-phase-end))`);
            const handle = label.createEl("button", { cls: "hub-button-plain hub-roadmap-drag-handle",
                attr: { type: "button", "aria-label": "Reorder phase " + phase.name, title: "Drag to reorder " + phase.name } });
            setIcon(handle, "grip-vertical"); handles.push(handle);
            const title = button(label, phase.name, () => edit("phases", phase), "hub-button-plain hub-roadmap-phase-name"); title.title = phase.name;
            title.dataset.planningId = phase.id;
            const position = phasePlacement(phase, range);
            if (position) {
                const bar = button(track, "", () => edit("phases", phase), "hub-roadmap-phase-bar");
                bar.dataset.planningId = phase.id; bar.style.left = position.left + "%"; bar.style.width = position.width + "%";
                bar.setAttribute("aria-label", `${phase.name}, ${dateLabel(phase.start)} to ${dateLabel(phase.end)}`); bar.title = bar.getAttribute("aria-label");
            }
        });
        cancelReorder = bindListReorder({ rows, handles, status, list: phaseList, scroller, commit: async (ids, phaseId) => {
            try {
                await service.reorder(workspace.projectId, ids, data.revision);
                if (disposed) return;
                const handle = [...panel.querySelectorAll(".hub-roadmap-phase")].find(row => row.dataset.reorderId === phaseId)?.querySelector(".hub-roadmap-drag-handle");
                handle?.focus({ preventScroll: true });
                const message = panel.querySelector(".hub-roadmap-status");
                if (message) message.textContent = "Phase order saved.";
            } catch (error) { new Notice(error.message); if (!disposed) render(); }
        } });
        const grid = timeline.createDiv({ cls: "hub-roadmap-grid", attr: { "aria-hidden": "true" } });
        for (const position of weeks) { const line = grid.createSpan(); line.style.left = position + "%"; }
        const today = range.position(localISODate());
        if (today >= 0 && today < 100) { const line = grid.createDiv({ cls: "hub-roadmap-today" }); line.style.left = today + "%"; line.setAttribute("aria-label", "Today"); }
        contextualCreation(scroller, axis.track);
        scroller.scrollLeft = scroll.left; scroller.scrollTop = scroll.top;
        layoutMilestones();
        let layoutFrame = 0, active = true;
        const requestLayout = () => {
            if (!active || disposed || layoutFrame) return;
            layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; if (active && !disposed) layoutMilestones(); });
        };
        const geometryObserver = new ResizeObserver(requestLayout);
        geometryObserver.observe(milestones.track);
        for (const { label } of labels) geometryObserver.observe(label);
        const fonts = milestones.track.ownerDocument.fonts;
        fonts?.addEventListener("loadingdone", requestLayout);
        fonts?.ready.then(requestLayout);
        cancelMilestoneLayout = () => {
            active = false; cancelAnimationFrame(layoutFrame); geometryObserver.disconnect();
            fonts?.removeEventListener("loadingdone", requestLayout);
        };
        let lastLeft = scroller.scrollLeft;
        scroller.addEventListener("scroll", () => {
            if (lastLeft === scroller.scrollLeft) return;
            lastLeft = scroller.scrollLeft; layoutMilestones();
        });
    }
    service.subscribe(component, id => { if (id === workspace.projectId) render(); });
    let panelWidth = 0;
    const observer = new ResizeObserver(() => {
        const width = panel.getBoundingClientRect().width;
        if (width && width !== panelWidth) { panelWidth = width; render(); }
    });
    observer.observe(panel);
    component.register(() => { disposed = true; cancelReorder(); cancelMilestoneLayout(); closeMenu(); observer.disconnect(); }); render();
    return { render, focus(kind, id) {
        const data = service.read(workspace.projectId), item = data[kind]?.find(item => item.id === id);
        if (!item) return false;
        const date = item.start ?? item.date, range = roadmapViewport(data, state);
        if (range.position(date) < 0 || range.position(date) >= 100) {
            if (state.roadmapZoom === "all") Object.assign(state, { roadmapViewport: null });
            else Object.assign(state, roadmapToday(data, state, parseLocalISODate(date)));
        }
        render();
        const target = [...panel.querySelectorAll("[data-planning-id]")].find(element => element.dataset.planningId === id);
        target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: "nearest", inline: "nearest" }); return !!target;
    } };
}
module.exports = { mountProjectRoadmap };
