"use strict";
const { createSearchFixture, clone } = require("./context-search-fixture.cjs");
const { taskMetadata } = require("../domain/task-planning");
const { filterTasks, upcomingGroups, calendarRange } = require("../domain/task-views");
const { RulesRecommendationProvider } = require("../domain/brief-recommendations");
const fixedNow = () => new Date(2026, 9, 26, 10);
function createReadFixture() {
    const f = createSearchFixture(), { plugin } = f, wizard = plugin.projectWizard;
    for (const [path, page] of f.pages) { page.file.tasks = []; page.file.lists = []; f.contents.set(path, "# Synthetic\n"); }
    for (const key of Object.keys(wizard.data.taskMetadata)) delete wizard.data.taskMetadata[key];
    const add = (name, id, metadata = {}, extra = {}) => f.addTask("Projects/App/Tasks/" + name + ".md", name, id, { metadata, ...extra });
    add("Start only", "start", { fromDate: "2026-10-26" });
    add("Due only", "due", { dueDate: "2026-10-26", necessity: "must" });
    add("Midnight", "midnight", { dueDate: "2026-10-26", dueTime: "00:00", necessity: "should" });
    add("Timed", "timed", { fromDate: "2026-10-26", fromTime: "06:00", dueDate: "2026-10-26", dueTime: "17:30", phaseId: "phase" });
    add("Month range", "month", { fromDate: "2026-10-20", dueDate: "2026-11-04" });
    add("Year range", "year", { fromDate: "2026-12-30", dueDate: "2027-01-03" });
    add("Overdue", "overdue", { dueDate: "2026-10-24" });
    add("Future", "future", { fromDate: "2026-10-27" });
    add("Completed", "completed", { dueDate: "2026-10-25" }, { completed: true });
    add("Unscheduled", "unscheduled");
    add("ID-less", null);
    f.addTask("Projects/App/Tasks/Continuation.md", "Assignment\ncontinuation evidence", "assignment", { metadata: { description: "Metadata prose", dueDate: "2026-10-27" },
        steps: [{ title: "First", id: "first", completed: true }, { title: "Next", id: "next" }] });
    for (const directory of ["System", "Templates", ".hidden"]) f.addTask(`Projects/App/${directory}/Excluded.md`, "Excluded " + directory, "excluded-" + directory.replace(".", ""));
    for (const owner of [...f.projects.slice(1), ...f.resources]) f.addTask(owner.root + "/Tasks.md", owner.name + " work", "owner-" + owner.projectId.replace(":", "-"));
    const at = new Date(2026, 9, 25, 14).getTime();
    wizard.completedTaskHistory = [{ id: "history", kind: "step", projectId: "app", projectName: "App", hubTaskId: "first", parentTaskId: "assignment",
        parentText: "Assignment", text: "First", path: "Projects/App/Tasks/Continuation.md", timestamp: at }];
    wizard.activityLog = [];
    wizard.data.reportFocusByDate = { "2026-10-25": { timestamp: at, items: [{ projectId: "app", text: "Next", projectName: "App" }] } };
    wizard.getProgressReports = scope => scope?.kind === "resource" ? [] : [{ projectId: "app", projectName: "App", date: "2026-10-25", timestamp: at, score: 3, summary: "Worked on First" }];
    plugin.oath = { active: false, current: null, ready: () => true, api: () => f.dv, canOpen: () => true,
        tasks: () => plugin.taskData.readPages(f.dv).flatMap(page => page.file.tasks), onChange: () => () => {} };
    plugin.planning.phases = () => [{ id: "phase", name: "Prototype" }];
    plugin.planning.phaseFor = task => task.phaseId === "phase" ? { name: "Prototype" } : null;
    return { ...f, now: fixedNow, wizard };
}
function taskFacts(task) {
    return { path: task.path, line: task.line, text: task.text, hubTaskId: task.hubTaskId ?? null, completed: !!task.completed,
        ...taskMetadata(task), steps: (task.steps ?? []).map(step => ({ path: step.path ?? task.path, line: step.line, text: step.text,
            hubTaskId: step.hubTaskId ?? null, completed: !!step.completed })) };
}
function briefFacts(context) {
    const normalize = value => {
        if (!value || typeof value !== "object") return value;
        if (Array.isArray(value)) return value.map(normalize);
        if (typeof value.path === "string" && Number.isInteger(value.line) && typeof value.text === "string" && Array.isArray(value.steps)) {
            return { ...taskFacts(value), workspaceId: value.workspaceId, available: value.available, future: value.future };
        }
        if (typeof value.path === "string" && Number.isInteger(value.line) && typeof value.text === "string" && typeof value.completed === "boolean") {
            return { path: value.path, line: value.line, text: value.text, hubTaskId: value.hubTaskId ?? null, completed: value.completed };
        }
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
    };
    return clone({ context: normalize(context), recommendation: new RulesRecommendationProvider().getRecommendation(context) });
}
function scheduleFacts(tasks, now = fixedNow()) {
    const visible = filterTasks(tasks, { status: "open", search: "", location: "" }, now);
    const groups = upcomingGroups(visible, now);
    const calendars = {};
    for (const mode of ["month", "week"]) for (const date of ["2026-10-26", "2026-12-31", "2027-01-01"]) {
        const anchor = new Date(date + "T12:00:00");
        calendars[mode + "/" + date] = calendarRange(anchor, mode).map(day => {
            const key = require("../domain/dates").localISODate(day);
            return { day: key, tasks: visible.filter(task => (task.dueDate ?? task.fromDate) === key).map(taskFacts) };
        });
    }
    return { tasks: tasks.map(taskFacts), groups: Object.fromEntries(Object.entries(groups).map(([key, rows]) => [key, rows.map(taskFacts)])), calendars };
}
module.exports = { createReadFixture, taskFacts, briefFacts, scheduleFacts, fixedNow };
