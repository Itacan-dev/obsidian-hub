"use strict";
const { calendarRange, shiftDay } = require("../domain/task-views");
const { formatDate } = require("../domain/dates");
const { setHubIcon } = require("./icons");
const { button, iconButton } = require("./task-view-primitives");

function renderScheduleToolbar(panel, context, state) {
    const toolbar = panel.createDiv({ cls: "hub-planning-toolbar hub-schedule-toolbar" });
    const contextHeader = toolbar.createDiv({ cls: "hub-schedule-context" });
    const title = contextHeader.createDiv({ cls: "project-panel-title project-tasks-title hub-schedule-title", attr: { role: "heading", "aria-level": "2" } });
    setHubIcon(title.createSpan({ cls: "project-tasks-title-icon", attr: { "aria-hidden": "true" } }), "clipboard-list");
    title.createSpan({ text: "Schedule" });
    const navigation = contextHeader.createDiv({ cls: "hub-planning-navigation" });
    const view = state.scheduleView;
    if (view !== "upcoming") {
        const move = (direction, event) => {
            state.anchor = view === "week" ? shiftDay(state.anchor, 7 * direction) : new Date(state.anchor.getFullYear(), state.anchor.getMonth() + direction, 1);
            context.render(event);
        };
        iconButton(navigation, "Previous " + view, "chevron-left", event => move(-1, event)).dataset.scheduleControl = "previous";
        iconButton(navigation, "Next " + view, "chevron-right", event => move(1, event)).dataset.scheduleControl = "next";
        button(navigation, "Today", event => { state.anchor = new Date(); context.render(event); }, "hub-panel-action").dataset.scheduleControl = "today";
        const days = calendarRange(state.anchor, view);
        const format = date => formatDate(date);
        navigation.createEl("h3", { text: view === "month" ? formatDate(state.anchor, "month") : format(days[0]) + " \u2013 " + format(days.at(-1)) });
    }
    const actions = toolbar.createDiv({ cls: "hub-planning-actions" });
    const modes = actions.createDiv({ cls: "hub-panel-selectors hub-equal-selectors", attr: { role: "group", "aria-label": "Schedule view" } });
    for (const [value, label] of [["upcoming", "Overview"], ["week", "Week"], ["month", "Month"]]) {
        const choice = button(modes, label, event => { state.scheduleView = value; context.render(event); }, view === value ? "is-active" : "");
        choice.dataset.scheduleControl = "view-" + value;
        choice.setAttribute("aria-pressed", String(view === value));
    }
    button(actions, "Task", () => context.create({}), "hub-full-add-task hub-panel-action", "plus");
}
module.exports = { renderScheduleToolbar };
