"use strict";
const { localISODate, parseLocalISODate } = require("./dates");
const { taskGroups, taskIsFuture } = require("./task-planning");

const PROJECT_VIEWS = ["upcoming", "calendar", "timeline", "all"];
const RESOURCE_VIEWS = ["location", "upcoming", "all"];
const VIEW_LABELS = { upcoming: "Upcoming", calendar: "Calendar", timeline: "Timeline", all: "All tasks", location: "By location" };
const BUCKETS = [["past", "Past due"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["later", "Later"], ["unscheduled", "Unscheduled"]];
const within = (path, root) => path === root || path.startsWith(root + "/");
const shiftDay = (date, days) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
// Calendar-day ordinals avoid 23/25-hour DST days distorting timeline geometry.
const dayNumber = value => { const date = parseLocalISODate(value); return date ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000 : null; };

function locationLabel(path, workspace, includeWorkspace = false) {
    const relative = within(path, workspace.root) ? path.slice(workspace.root.length).replace(/^\//, "") : "";
    const parts = relative.replace(/\.md$/i, "").split("/").filter(Boolean);
    if (parts.at(-1) === "Tasks") parts.pop();
    if (includeWorkspace || !parts.length) parts.unshift(workspace.name ?? workspace.label ?? workspace.root.split("/").at(-1));
    return parts.join(" › ");
}

function validLocation(path, workspace) {
    if (!workspace?.root || !within(path, workspace.root)) return false;
    return !path.slice(workspace.root.length).split("/").some(part => part.startsWith(".") || /^(System|Templates)$/i.test(part) || part === ".." || part === ".");
}

function upcomingBucket(task, now = new Date()) {
    if (!task.dueDate && !task.fromDate) return "unscheduled";
    const today = localISODate(now), tomorrow = localISODate(shiftDay(now, 1));
    if (task.dueDate && task.dueDate < today) return "past";
    const date = task.dueDate ?? task.fromDate;
    return date <= today ? "today" : date === tomorrow ? "tomorrow" : "later";
}

function upcomingGroups(tasks, now = new Date()) {
    const groups = Object.fromEntries(BUCKETS.map(([id]) => [id, []]));
    const ordered = taskGroups(tasks, now);
    for (const task of [...ordered.active, ...ordered.future]) groups[upcomingBucket(task, now)].push(task);
    const rank = task => task.necessity === "must" ? 0 : task.necessity === "should" ? 1 : 2;
    for (const group of Object.values(groups)) group.sort((a, b) => rank(a) - rank(b));
    return groups;
}

function filterTasks(tasks, state, now = new Date(), describe = task => task.path) {
    const query = (state.search ?? "").trim().toLocaleLowerCase();
    return tasks.filter(task => {
        if (state.location && !within(task.path, state.location)) return false;
        if (query && !(task.text + " " + describe(task)).toLocaleLowerCase().includes(query)) return false;
        if (state.status === "open" && task.completed) return false;
        if (state.status === "completed" && !task.completed) return false;
        if (state.status === "active" && (task.completed || taskIsFuture(task, now))) return false;
        if (state.status === "future" && !taskIsFuture(task, now)) return false;
        if (state.necessity && (task.necessity ?? "neutral") !== state.necessity) return false;
        if (state.date && upcomingBucket(task, now) !== state.date) return false;
        return true;
    });
}

function sortTasks(tasks, key = "due", direction = 1, describe = task => task.path) {
    const value = task => ({ task: task.text, location: describe(task),
        necessity: { must: 0, should: 1 }[task.necessity] ?? null,
        start: task.fromDate ? task.fromDate + (task.fromTime ?? "00:00") : null,
        due: task.dueDate ? task.dueDate + (task.dueTime ?? "24:00") : null,
        steps: task.steps?.length ? task.steps.filter(step => step.completed).length / task.steps.length : null })[key];
    return tasks.map((task, index) => ({ task, index })).sort((a, b) => {
        const av = value(a.task), bv = value(b.task);
        if (av == null || bv == null) return av == null && bv == null ? a.index - b.index : av == null ? 1 : -1;
        const result = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
        return direction * result || a.index - b.index;
    }).map(item => item.task);
}

function calendarRange(anchor, mode) {
    const first = mode === "week" ? new Date(anchor) : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    first.setHours(0, 0, 0, 0); first.setDate(first.getDate() - (first.getDay() + 6) % 7);
    const last = mode === "week" ? shiftDay(first, 6) : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    last.setDate(last.getDate() + (7 - last.getDay()) % 7);
    return Array.from({ length: dayNumber(localISODate(last)) - dayNumber(localISODate(first)) + 1 }, (_, i) => shiftDay(first, i));
}

function timelinePlacement(task, start, end) {
    const from = dayNumber(task.fromDate), due = dayNumber(task.dueDate);
    if (from == null && due == null) return null;
    const first = from ?? due, last = due ?? from, min = dayNumber(start), max = dayNumber(end);
    if (last < min || first >= max) return null;
    const length = max - min;
    return { kind: from != null && due != null ? "range" : due != null ? "due" : "start",
        left: Math.max(0, first - min) / length * 100,
        width: Math.max(1, Math.min(max, last + 1) - Math.max(min, first)) / length * 100,
        clippedStart: first < min, clippedEnd: last >= max };
}

function locationTree(tasks, workspace, folders = []) {
    const root = { path: workspace.root, name: workspace.name ?? workspace.label, tasks: [], children: new Map(), count: 0 };
    const ensure = path => {
        let node = root;
        for (const part of path.slice(workspace.root.length).split("/").filter(Boolean)) {
            if (!node.children.has(part)) node.children.set(part, { path: node.path + "/" + part, name: part, tasks: [], children: new Map(), count: 0 });
            node = node.children.get(part);
        }
        return node;
    };
    for (const folder of folders) if (validLocation(folder.path, workspace)) ensure(folder.path);
    for (const task of tasks) if (validLocation(task.path, workspace)) ensure(task.path.slice(0, task.path.lastIndexOf("/"))).tasks.push(task);
    const count = node => { node.count = node.tasks.length + [...node.children.values()].reduce((sum, child) => sum + count(child), 0); return node.count; };
    count(root); return root;
}

module.exports = { PROJECT_VIEWS, RESOURCE_VIEWS, VIEW_LABELS, BUCKETS, within, shiftDay, dayNumber,
    locationLabel, validLocation, upcomingBucket, upcomingGroups, filterTasks, sortTasks, calendarRange, timelinePlacement, locationTree };
