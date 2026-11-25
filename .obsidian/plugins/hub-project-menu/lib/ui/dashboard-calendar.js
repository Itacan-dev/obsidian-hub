"use strict";

const { Component } = require("obsidian");
const { createTaskUi } = require("./tasks");
const { renderTaskSchedule } = require("./task-view-calendar");
const { createCalendarEventReader } = require("./calendar-events");
const { locationBreadcrumb } = require("../domain/native-task-location");
const { taskKey } = require("../domain/oath-workspace");

function mountDashboardCalendar({ plugin, panel, compact, signal, readItems, reader, availability, onEdit, openTasks }) {
    const component = new Component();
    component.load();
    const host = panel.createDiv({ cls: "hub-dashboard-calendar", attr: { hidden: "" } });
    const doc = host.ownerDocument;
    const state = { scheduleView: "upcoming", anchor: new Date() };
    const pending = new Set();
    const events = createCalendarEventReader(plugin.app, doc.defaultView, render);
    const ui = createTaskUi({ app: plugin.app, component, body: host, onEdit, oath: plugin.oath, plan: plugin.globalPlan,
        planRelevance: plugin.planRelevance, inlineOath: true,
        mutate: reader?.actions?.mutate, editTask: reader?.actions?.editTask });
    let active = false;

    function render() {
        if (!active || !ui.beginRender(render)) return;
        const focused = doc.activeElement;
        const control = host.contains(focused) ? focused.dataset.scheduleControl : null;
        const row = host.contains(focused) ? focused.closest("[data-task-key]") : null;
        const focusIndex = row ? [...row.querySelectorAll("input, button")].indexOf(focused) : -1;
        const scrollTop = host.querySelector(".hub-task-local-scroll")?.scrollTop ?? 0;
        const scrollLeft = host.querySelector(".hub-task-local-scroll")?.scrollLeft ?? 0;
        const items = readItems();
        const owners = new Map(items.map(item => [taskKey(item.task), item.owner.name ?? item.owner.label]));
        const status = availability();
        host.empty();
        if (status !== "current") host.createDiv({ cls: "hub-task-view-note", attr: { role: "status" },
            text: status === "loading" ? "Loading tasks…" : "Some tasks are unavailable." });
        renderTaskSchedule(host, items.map(item => item.task).filter(task => !task.completed), {
            ui, pending, locationScope: null, now: new Date(), embeddedSchedule: true, events, openTasks,
            create: options => plugin.openTaskCreator({ ...options, locationWorkspace: null }),
            render, apply: onEdit, toggleTask: (task, done) => reader.toggle(task, done),
            focusOrder: ui.focusOrder,
            locationLabel: task => locationBreadcrumb(task, null)?.label ?? owners.get(taskKey(task)) ?? "",
            phaseLabel: task => plugin.planning?.phaseFor(task)?.name
        }, state);
        host.querySelector(".hub-task-local-scroll")?.scrollTo(scrollLeft, scrollTop);
        if (control) host.querySelector('[data-schedule-control="' + control + '"]')?.focus({ preventScroll: true });
        if (row) {
            const replacement = [...host.querySelectorAll("[data-task-key]")].find(item => item.dataset.taskKey === row.dataset.taskKey);
            replacement?.querySelectorAll("input, button")[focusIndex]?.focus({ preventScroll: true });
        }
    }

    signal.addEventListener("abort", () => {
        active = false;
        events.dispose();
        host.remove();
        compact.hidden = false;
        component.unload();
    }, { once: true });
    return { render, setExpanded(value) {
        if (active === value) return;
        active = value;
        host.hidden = !active;
        compact.hidden = active;
        if (active) { events.reset(); render(); }
    }, today() {
        state.anchor = new Date();
        render();
    } };
}

module.exports = { mountDashboardCalendar };
