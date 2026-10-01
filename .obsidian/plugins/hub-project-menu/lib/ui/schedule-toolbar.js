"use strict";
const { calendarRange, shiftDay } = require("../domain/task-views");
const { button, iconButton } = require("./task-view-primitives");

function renderScheduleToolbar(panel, context, state) {
    const toolbar = panel.createDiv({ cls: "hub-planning-toolbar hub-schedule-toolbar" });
    const navigation = toolbar.createDiv({ cls: "hub-planning-navigation" });
    const view = state.scheduleView;
    if (view !== "upcoming") {
        const move = direction => {
            state.anchor = view === "week" ? shiftDay(state.anchor, 7 * direction) : new Date(state.anchor.getFullYear(), state.anchor.getMonth() + direction, 1);
            context.render();
        };
        iconButton(navigation, "Previous " + view, "chevron-left", () => move(-1));
        iconButton(navigation, "Next " + view, "chevron-right", () => move(1));
        button(navigation, "Today", () => { state.anchor = new Date(); context.render(); }, "hub-panel-action");
        const days = calendarRange(state.anchor, view);
        const format = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        navigation.createEl("h3", { text: view === "month" ? state.anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : format(days[0]) + " \u2013 " + format(days.at(-1)) });
    }
    const actions = toolbar.createDiv({ cls: "hub-planning-actions" });
    const modes = actions.createDiv({ cls: "hub-panel-selectors hub-equal-selectors", attr: { role: "group", "aria-label": "Schedule view" } });
    for (const [value, label] of [["upcoming", "Upcoming"], ["month", "Month"], ["week", "Week"]]) {
        const choice = button(modes, label, () => { state.scheduleView = value; context.render(); }, view === value ? "is-active" : "");
        choice.setAttribute("aria-pressed", String(view === value));
    }
    button(actions, "Add task", () => context.create({}), "hub-full-add-task hub-panel-action", "plus");
}
module.exports = { renderScheduleToolbar };
