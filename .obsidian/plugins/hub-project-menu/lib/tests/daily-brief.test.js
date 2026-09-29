"use strict";
const assert = require("assert");
const { dailyBriefDay, buildDailyBriefContext } = require("../domain/daily-brief");
const { RulesRecommendationProvider } = require("../domain/brief-recommendations");
const { DailyBriefTrigger } = require("../services/daily-brief-trigger");
const now = new Date(2026, 8, 26, 10), day = "2026-09-23", at = new Date(2026, 8, 23, 14).getTime();
const provider = new RulesRecommendationProvider();
const workspaces = ["a", "b", "c", "d", "e", "resource:study"].map((workspaceId, index) => ({
    workspaceId, name: workspaceId, type: index === 5 ? "resource" : "project", path: `${workspaceId}/Home.md`, available: true
}));
const report = (id, summary = "", score = 0, date = day) => ({ projectId: id, projectName: id, summary, score, date,
    targetKind: id.startsWith("resource:") ? "resource" : "project", timestamp: at });
function source({ reports = [], history = [], focus = {}, activity = [], oaths = {} } = {}) {
    return { getProgressReports: scope => reports.filter(report => scope?.kind === "resource" ? report.targetKind === "resource" : report.targetKind !== "resource"),
        completedTaskHistory: history, activityLog: activity, data: { reportFocusByDate: focus, oathsByDevice: oaths }, dailyFocus: {} };
}
const build = (service, options = {}) => buildDailyBriefContext(service, { now, workspaces, resolvePath: path => path || null, ...options });
const event = (kind = "step", id = "a", timestamp = at) => ({ id: "event-" + timestamp, kind, projectId: id, projectName: id,
    hubTaskId: kind === "step" ? "s1" : "parent", parentTaskId: "parent", parentText: "Assignment 5", text: kind === "step" ? "1a" : "Assignment 5",
    path: id + "/Assignment.md", timestamp });
const task = { workspaceId: "a", path: "a/Assignment.md", line: 0, text: "Assignment 5", hubTaskId: "parent", completed: false,
    steps: [{ text: "1a", completed: true, hubTaskId: "s1" }, { text: "2b", completed: false, hubTaskId: "s2" }] };

async function run() {
    assert.equal(dailyBriefDay(new Date(2026, 8, 26, 5, 59, 59)), "2026-09-25");
    assert.equal(dailyBriefDay(new Date(2026, 8, 26, 6)), "2026-09-26");
    assert.equal(dailyBriefDay(new Date(2027, 0, 1, 2)), "2026-12-31");
    assert.equal(dailyBriefDay(new Date(2026, 2, 29, 5, 59)), "2026-03-28", "Local calendar arithmetic works across DST");
    assert.equal(build(source()).lastWorkDate, null);
    assert.equal(build(source({ activity: [{ projectId: "a", action: "edited", path: "a/Notes.md", timestamp: at }] })).lastWorkDate, null);
    for (const kind of ["task", "step"]) assert.equal(build(source({ history: [event(kind)] })).lastWorkDate, day);
    assert.equal(build(source({ reports: [report("a", "Real summary")] })).lastWorkDate, day);
    assert.equal(build(source({ reports: [report("a", "  ", 0)] })).lastWorkDate, null);
    assert.equal(build(source({ reports: [report("a", "", 2)] })).lastWorkDate, day);
    const focus = { [day]: { items: [{ projectId: "a", projectName: "A", text: "Exercise 2b" }] } };
    assert.equal(build(source({ focus })).lastWorkDate, day);
    assert.equal(build(source({ reports: [report("a", "Older", 2, "2026-09-19"), report("b", "Latest", 1)] })).lastWorkDate, day);
    assert.equal(build(source({ reports: [report("a", "Today", 2, "2026-09-26")] })).lastWorkDate, null);
    const oath = { id: "oath", workspace: { type: "project", id: "a", name: "A" }, state: "fulfilled", fulfilledAt: at };
    assert.equal(build(source({ oaths: { device: { history: [oath] } } })).lastWorkDate, day);
    assert.equal(build(source({ oaths: { device: { history: [{ ...oath, state: "broken", fulfilledAt: null }] } } })).lastWorkDate, null);

    const ranked = build(source({ reports: [report("a", "", 1), report("b", "", 3), report("c", "", 1), report("d", "", 1), report("e", "", 1)],
        history: [event("step", "c")], focus: { [day]: { items: [{ projectId: "d", text: "Recorded" }] } } }),
        { tasks: [{ ...task, workspaceId: "c", path: "c/Assignment.md" }] });
    assert.equal(ranked.workspaces.length, 5);
    assert.deepEqual(ranked.workspaces.slice(0, 3).map(workspace => workspace.workspaceId), ["b", "d", "c"], "Significance, explicit focus, then resumable progress");

    const continuation = build(source({ history: [event()] }), { tasks: [task] });
    const next = provider.getRecommendation(continuation);
    assert.equal(next.reason, "unfinished-progress");
    assert.ok(next.explanation.includes("2b is the next remaining step"));
    assert.equal(next.target.stepId, "s2");
    assert.equal(next.target.path, task.path);
    const explicit = build(source({ history: [event()], focus: { [day]: { items: [{ projectId: "a", text: "2b" }] } } }), { tasks: [task] });
    assert.equal(provider.getRecommendation(explicit).reason, "recorded-focus");
    assert.equal(provider.getRecommendation(explicit).target.stepId, "s2");
    const mixed = build(source({ history: [event(), { ...event("task", "b"), hubTaskId: "other-task", text: "Review notes" }], focus: { [day]: { items: [{ projectId: "a", text: "2b" }] } } }), { tasks: [task] });
    assert.equal(provider.getRecommendation(mixed).actionLabel, "Continue 2b", "Unrelated completions cannot turn a continuation into new work");
    const finished = build(source({ history: [event("task")], focus: { [day]: { items: [{ projectId: "b", text: "Exercise Sheet 3" }] } } }), { tasks: [{ ...task, completed: true }] });
    assert.equal(provider.getRecommendation(finished).actionLabel, "Start Exercise Sheet 3");
    assert.ok(provider.getRecommendation(finished).explanation.includes("You completed Assignment 5"));
    assert.equal(provider.getRecommendation(build(source({ history: [event("task")] }), { tasks: [{ ...task, completed: true }] })).reason, "no-clear-action");
    assert.equal(provider.getRecommendation(build(source({ reports: [report("a", "Worked on ideas")] }))).actionLabel, "View today's tasks");
    assert.equal(provider.getRecommendation(build(source())), null);

    for (const unavailable of [{ ...task, fromDate: "2026-09-27" }, { ...task, completed: true }, { ...task, identityConflict: true }]) {
        const context = build(source({ history: [event()], focus: { [day]: { items: [{ projectId: "a", text: "2b" }] } } }), { tasks: [unavailable] });
        assert.equal(provider.getRecommendation(context).reason, "no-clear-action");
    }
    const shelved = build(source({ history: [event()], focus }), { tasks: [task], workspaces: workspaces.map(workspace => ({ ...workspace, available: false })) });
    assert.equal(shelved.workspaces.length, 1, "Shelved work remains historical");
    assert.equal(provider.getRecommendation(shelved).reason, "no-clear-action");
    const missing = build(source({ history: [event()] }), { tasks: [task], resolvePath: () => null });
    assert.equal(missing.workspaces[0].lastRelevantFile, null);
    assert.equal(provider.getRecommendation(missing).reason, "no-clear-action");
    const missingLink = build(source({ focus: { [day]: { items: [{ projectId: "a", text: "Read [[Deleted]]" }] } } }));
    assert.equal(provider.getRecommendation(missingLink).reason, "no-clear-action");
    const restricted = build(source({ history: [event()], focus }), { tasks: [task], canOpen: path => path.startsWith("b/"), oathState: { active: true, workspaceId: "b" } });
    assert.equal(provider.getRecommendation(restricted).target.workspaceId, "b");
    assert.equal(provider.getRecommendation(restricted).actionLabel, "View Oath tasks");

    // Recorded report evidence is reused and merged with later events, never rewritten.
    const stored = source({ reports: [{ ...report("a", "Saved summary", 3), context: { version: 1, tasks: [event()], activity: [], focus: [] } }], history: [event()] });
    const before = JSON.stringify(stored);
    assert.equal(build(stored).workspaces[0].taskProgress.length, 1);
    assert.equal(JSON.stringify(stored), before);
    assert.equal(build(source({ reports: [report("resource:study", "Read a paper", 2)] })).workspaces[0].workspaceType, "resource");

    let date = new Date(2026, 8, 26, 5, 59), shown = null, ready = false, blocked = false, opened = 0, persisted = 0, useful = true;
    const options = { now: () => date, ready: () => ready, blocked: () => blocked, shownDay: () => shown,
        load: async () => useful ? { context: continuation } : null,
        open: async () => { opened++; return true; }, persist: async day => { shown = day; persisted++; } };
    const trigger = new DailyBriefTrigger(options);
    await trigger.activate(); assert.equal(opened, 0, "Wait for hydration");
    ready = true; await trigger.resume(); assert.equal(opened, 1); assert.equal(shown, "2026-09-25");
    date = new Date(2026, 8, 26, 6); await trigger.resume(); await trigger.activate();
    assert.equal(opened, 1, "Crossing 06:00 while working cannot interrupt");
    trigger.background(); await trigger.activate(); assert.equal(opened, 2); assert.equal(shown, "2026-09-26");
    trigger.background(); await trigger.activate(); assert.equal(opened, 2, "Close and foreground cannot reopen that day");
    const restarted = new DailyBriefTrigger(options); await restarted.activate(); assert.equal(opened, 2, "Persisted day survives restart");
    date = new Date(2026, 8, 27, 6); blocked = true; trigger.background(); await trigger.activate(); assert.equal(opened, 2);
    blocked = false; trigger.background(); await trigger.activate(); assert.equal(opened, 3);
    date = new Date(2026, 8, 28, 7); useful = false; trigger.background(); await trigger.activate();
    assert.equal(opened, 3); assert.equal(persisted, 3, "No-history startup stays quiet and records nothing");
    useful = true; const failures = [];
    const failedSave = new DailyBriefTrigger({ ...options, persist: async () => { throw Error("disk"); }, report: (...args) => failures.push(args) });
    await failedSave.activate(); failedSave.background(); await failedSave.activate();
    assert.equal(opened, 4, "Failed persistence does not reopen repeatedly in this session");
    assert.equal(failures.length, 1);
    let release;
    const delayed = new DailyBriefTrigger({ ...options, load: () => new Promise(resolve => { release = resolve; }) });
    const pending = delayed.activate(); delayed.background(); release({ context: continuation }); await pending;
    assert.equal(opened, 4, "Never open after the user backgrounds the app during loading");
    delayed.destroy(); trigger.destroy(); restarted.destroy(); failedSave.destroy();
    console.log("PASS: Daily Brief 06:00/DST boundary, meaningful signals, report snapshots, skipped days, ranking, focus/continuation/fallback, Future/Shelved/missing/Oath targets, once/day, hydration, backgrounding and persistence failures.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
