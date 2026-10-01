"use strict";
const { Notice } = require("obsidian");
const { localISODate } = require("../domain/dates");
const { roadmapRange, phasePlacement } = require("../domain/project-planning");
const { button, iconButton } = require("./task-view-primitives");
const { openPlanningEditor } = require("./planning-editor");

function mountProjectRoadmap({ plugin, component, dv, host, workspace, state }) {
    const service = plugin.planning;
    state.roadmapAnchor ??= new Date(); state.roadmapMonths ??= 6;
    const panel = host.createDiv({ cls: "project-panel hub-roadmap-panel" });
    let disposed = false;
    const edit = (kind, value) => openPlanningEditor(service, workspace.projectId, kind, value, dv);
    const month = date => date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const dateLabel = iso => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    function render() {
        if (disposed) return;
        const previous = panel.querySelector(".hub-roadmap-scroll"), scroll = { left: previous?.scrollLeft ?? 0, top: previous?.scrollTop ?? 0 };
        panel.replaceChildren();
        const data = service.read(workspace.projectId), range = roadmapRange(state.roadmapAnchor, state.roadmapMonths);
        const toolbar = panel.createDiv({ cls: "hub-planning-toolbar" });
        const navigation = toolbar.createDiv({ cls: "hub-planning-navigation" });
        const move = amount => { state.roadmapAnchor = new Date(range.start.getFullYear(), range.start.getMonth() + amount * state.roadmapMonths, 1); render(); };
        iconButton(navigation, "Previous range", "chevron-left", () => move(-1));
        iconButton(navigation, "Next range", "chevron-right", () => move(1));
        button(navigation, "Today", () => { state.roadmapAnchor = new Date(); render(); }, "hub-panel-action");
        navigation.createEl("h3", { text: month(range.start) + " – " + month(new Date(range.end.getFullYear(), range.end.getMonth(), 0)) });
        const actions = toolbar.createDiv({ cls: "hub-planning-actions" });
        const select = actions.createEl("select", { attr: { "aria-label": "Roadmap range" } });
        for (const [value, label] of [[3, "3 months"], [6, "6 months"], [12, "1 year"]]) select.createEl("option", { text: label, attr: { value: String(value) } });
        select.value = String(state.roadmapMonths); select.addEventListener("change", () => { state.roadmapMonths = Number(select.value); render(); });
        const additions = actions.createDiv({ cls: "hub-planning-additions" });
        button(additions, "Phase", () => edit("phases"), "hub-panel-action", "plus");
        button(additions, "Milestone", () => edit("milestones"), "hub-panel-action", "plus");
        if (!data.phases.length && !data.milestones.length) { panel.createDiv({ cls: "hub-task-view-empty", text: "No phases or milestones yet." }); return; }
        const scroller = panel.createDiv({ cls: "hub-roadmap-scroll" });
        const timeline = scroller.createDiv({ cls: "hub-roadmap-timeline" });
        const scaleWidth = Math.max(530, state.roadmapMonths * 85);
        timeline.style.setProperty("--hub-roadmap-scale-width", scaleWidth + "px");
        const makeRow = cls => {
            const row = timeline.createDiv({ cls: "hub-roadmap-row " + cls });
            const label = row.createDiv({ cls: "hub-roadmap-label" }), track = row.createDiv({ cls: "hub-roadmap-track" });
            return { row, label, track };
        };
        const axis = makeRow("hub-roadmap-axis");
        for (let i = 0; i < state.roadmapMonths; i++) {
            const start = new Date(range.start.getFullYear(), range.start.getMonth() + i, 1), end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
            const heading = axis.track.createSpan({ cls: "hub-roadmap-month", text: month(start) });
            heading.style.left = range.position(localISODate(start)) + "%";
            heading.style.width = range.position(localISODate(end)) - range.position(localISODate(start)) + "%";
        }
        const monday = new Date(range.start); monday.setDate(monday.getDate() + (8 - monday.getDay()) % 7);
        const weeks = [];
        for (let date = monday; date < range.end; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)) {
            const left = range.position(localISODate(date)); weeks.push(left);
            const marker = axis.track.createSpan({ cls: "hub-roadmap-week", text: String(date.getDate()) }); marker.style.left = left + "%";
        }
        const milestones = makeRow("hub-roadmap-milestones"); milestones.label.createSpan({ text: "Milestones" });
        const visibleMilestones = data.milestones.filter(item => range.position(item.date) >= 0 && range.position(item.date) < 100).sort((a, b) => a.date.localeCompare(b.date));
        for (const [index, item] of visibleMilestones.entries()) {
            const position = range.position(item.date);
            const marker = button(milestones.track, "", () => edit("milestones", item), "hub-button-plain hub-roadmap-milestone" + (item.achieved ? " is-achieved" : ""));
            marker.dataset.planningId = item.id; marker.style.left = position + "%";
            marker.setAttribute("aria-label", item.name + ", " + dateLabel(item.date) + (item.achieved ? ", achieved" : "")); marker.title = marker.getAttribute("aria-label");
            marker.createSpan({ cls: "hub-roadmap-diamond", attr: { "aria-hidden": "true" } });
            const label = marker.createSpan({ cls: "hub-roadmap-milestone-caption" });
            label.createSpan({ text: item.name }); label.createSpan({ cls: "hub-roadmap-milestone-date", text: dateLabel(item.date) });
            // Give captions the space halfway to adjacent markers; never move a diamond.
            const trackWidth = milestones.track.getBoundingClientRect().width || scaleWidth;
            const previous = index ? range.position(visibleMilestones[index - 1].date) : -position;
            const next = index + 1 < visibleMilestones.length ? range.position(visibleMilestones[index + 1].date) : 200 - position;
            const left = Math.max(0, (previous + position) / 2), right = Math.min(100, (next + position) / 2);
            const width = Math.max(0, Math.min(145, (right - left) / 100 * trackWidth - 8));
            const offset = Math.max((left - position) / 100 * trackWidth + 4, Math.min(-width / 2, (right - position) / 100 * trackWidth - width - 4));
            label.style.width = width + "px"; label.style.left = offset + "px";
            label.style.textAlign = offset < -width * .75 ? "right" : offset > -width * .25 ? "left" : "center";

        }
        const heading = makeRow("hub-roadmap-phase-heading"); heading.label.createSpan({ text: "Phases" });
        data.phases.forEach((phase, index) => {
            const { row, label, track } = makeRow("hub-roadmap-phase");
            row.style.setProperty("--hub-phase-color", `var(--hub-phase-${index % 4})`);
            const title = button(label, phase.name, () => edit("phases", phase), "hub-button-plain hub-roadmap-phase-name"); title.title = phase.name;
            title.dataset.planningId = phase.id;
            const reorder = label.createDiv({ cls: "hub-roadmap-reorder" });
            for (const direction of [-1, 1]) {
                const control = iconButton(reorder, `Move ${phase.name} ${direction < 0 ? "up" : "down"}`, direction < 0 ? "chevron-up" : "chevron-down", async () => {
                    control.disabled = true;
                    try { await service.reorder(workspace.projectId, phase.id, direction, data.revision); }
                    catch (error) { new Notice(error.message); control.disabled = false; }
                });
                control.disabled = direction < 0 ? index === 0 : index === data.phases.length - 1;
            }
            const position = phasePlacement(phase, range);
            if (position) {
                const bar = button(track, "", () => edit("phases", phase), "hub-roadmap-phase-bar");
                bar.dataset.planningId = phase.id; bar.style.left = position.left + "%"; bar.style.width = position.width + "%";
                bar.setAttribute("aria-label", `${phase.name}, ${dateLabel(phase.start)} to ${dateLabel(phase.end)}`); bar.title = bar.getAttribute("aria-label");
            }
        });
        const grid = timeline.createDiv({ cls: "hub-roadmap-grid", attr: { "aria-hidden": "true" } });
        for (const position of weeks) { const line = grid.createSpan(); line.style.left = position + "%"; }
        const today = range.position(localISODate());
        if (today >= 0 && today < 100) { const line = grid.createDiv({ cls: "hub-roadmap-today" }); line.style.left = today + "%"; line.setAttribute("aria-label", "Today"); }
        scroller.scrollLeft = scroll.left; scroller.scrollTop = scroll.top;
    }
    service.subscribe(component, id => { if (id === workspace.projectId) render(); });
    let panelWidth = 0;
    const observer = new ResizeObserver(() => {
        const width = panel.getBoundingClientRect().width;
        if (width && width !== panelWidth) { panelWidth = width; render(); }
    });
    observer.observe(panel);
    component.register(() => { disposed = true; observer.disconnect(); }); render();
    return { render, focus(kind, id) {
        const data = service.read(workspace.projectId), item = data[kind]?.find(item => item.id === id);
        if (!item) return false;
        state.roadmapAnchor = new Date((item.start ?? item.date) + "T12:00:00"); render();
        const target = [...panel.querySelectorAll("[data-planning-id]")].find(element => element.dataset.planningId === id);
        target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: "nearest", inline: "nearest" }); return !!target;
    } };
}
module.exports = { mountProjectRoadmap };
