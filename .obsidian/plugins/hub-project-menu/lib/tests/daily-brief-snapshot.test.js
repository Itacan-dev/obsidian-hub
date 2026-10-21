"use strict";
const assert = require("assert"), Module = require("module");
const originalLoad = Module._load;
Module._load = function(name) { return name === "obsidian" ? { Modal: class {}, Component: class {}, Notice: class {}, setIcon() {} } : originalLoad.apply(this, arguments); };
let DailyBriefService;
try { ({ DailyBriefService } = require("../services/daily-brief")); } finally { Module._load = originalLoad; }
const { RulesRecommendationProvider } = require("../domain/brief-recommendations");
const { buildDailyBriefContext } = require("../domain/daily-brief");
const copy = value => JSON.parse(JSON.stringify(value));
const at = (day, hour = 10) => new Date(2026, 8, day, hour).getTime();

function fixture() {
    const state = { now: new Date(at(26)), saved: [], opened: [], navigated: [], providerCalls: 0 };
    const project = { projectId: "p", name: "Complex Analysis", status: "active", contextKind: "project", path: "P/Home.md", root: "P" };
    const task = { workspaceId: "p", path: "P/Assignment.md", line: 0, hubTaskId: "parent", text: "Assignment 5", completed: false,
        steps: [{ hubTaskId: "s1", text: "1a", completed: true }, { hubTaskId: "s2", text: "2b", completed: false }] };
    const history = [{ id: "e1", kind: "step", hubTaskId: "s1", parentTaskId: "parent", parentText: task.text, text: "1a", path: task.path,
        projectId: "p", projectName: project.name, timestamp: at(25) }];
    const reports = [{ date: "2026-09-25", projectId: "p", projectName: project.name, score: 3, summary: "Worked on 1a.", timestamp: at(25) },
        { date: "2026-09-23", projectId: "p", projectName: project.name, score: 1, summary: "Earlier work.", timestamp: at(23) }];
    const files = new Map([project.path, task.path].map(path => [path, { path, extension: "md" }]));
    const wizard = { data: { lastDailyBriefAutoShownDay: "2026-09-25", reportFocusByDate: { "2026-09-25": { items: [{ projectId: "p", text: "2b" }] } } },
        completedTaskHistory: history, activityLog: [], getProgressReports: scope => scope?.kind === "resource" ? [] : reports,
        getProjectRecords: () => [project], getResourceTypes: () => [], getProjectById: id => id === "p" ? project : null,
        getContextForPath: path => path?.startsWith("P/") ? project : null };
    const plugin = { projectWizard: wizard, app: { vault: { getAbstractFileByPath: path => files.get(path),
        read: async () => `- [${task.completed ? "x" : " "}] Assignment 5 <!-- hub-task:parent -->\n    - [x] 1a <!-- hub-task:s1 -->\n    - [${task.steps[1].completed ? "x" : " "}] 2b <!-- hub-task:s2 -->` }, metadataCache: {} },
        dataStore: { save: async data => state.saved.push(copy(data)) }, taskEditor: { metadata: () => task },
        taskData: { currentPath: path => path, readPages: () => [{ file: { tasks: [task] } }] },
        oath: { active: false, ready: () => true, api: () => ({}), tasks: () => [task], canOpen: () => true },
        workspaceModes: { openHome: async () => state.navigated.push("home"), openProjectNote: async path => state.navigated.push(path) } };
    const provider = { getRecommendation: context => { state.providerCalls++; return new RulesRecommendationProvider().getRecommendation(context); } };
    require("./task-read-test-host.cjs").attachLegacyFacade(plugin);
    const make = () => {
        const service = new DailyBriefService(plugin, { provider, now: () => state.now }); service.started = true;
        service.open = brief => { if (service.blocked()) return false; state.opened.push(copy(brief)); return true; };
        return service;
    };
    const complete = () => {
        task.completed = true; task.steps[1].completed = true;
        history.push({ ...history[0], id: "e2", hubTaskId: "s2", text: "2b", timestamp: at(26, 11) },
            { ...history[0], id: "e3", kind: "task", hubTaskId: "parent", text: task.text, timestamp: at(26, 11) });
    };
    return { state, task, history, reports, files, project, wizard, plugin, make, complete };
}

async function run() {
    const previousDocument = global.document; global.document = { querySelector: () => null };
    try {
        const f = fixture(), { state, wizard, task, project } = f, service = f.make();
        await service.refreshAvailability();
        assert.equal(service.availability().available, true);
        assert.equal(state.providerCalls, 0, "Availability does not create the day's artifact");
        await service.trigger.activate();
        const morning = copy(state.opened[0]), stored = copy(wizard.data.dailyBriefSnapshot);
        assert.equal(state.providerCalls, 1); assert.equal(wizard.data.lastDailyBriefAutoShownDay, "2026-09-26");
        assert.equal(morning.recommendation.actionLabel, "Continue 2b");
        assert.equal(morning.context.lastWorkDate, "2026-09-25");
        assert.equal(stored.days.length, 2);
        assert.ok(!("relevantTasks" in stored) && !JSON.stringify(stored).includes("continuations"), "Store only bounded display facts and the resolved action");

        f.complete(); state.now = new Date(at(26, 15));
        wizard.pendingFocus = { sourceDate: "2026-09-26", items: [{ projectId: "p", text: "Different focus" }] };
        wizard.data.reportFocusByDate["2026-09-25"].items = [{ projectId: "p", text: "Edited old focus" }];
        f.reports[0].summary = "Edited historical report";
        f.reports.push({ ...f.reports[0], date: "2026-09-26", summary: "Today's work", timestamp: at(26, 14) });
        f.plugin.taskData.readPages = () => [{ file: { tasks: [task, { ...task, hubTaskId: "new", text: "New Must-do", necessity: "must", completed: false }] } }];
        project.status = "shelved";
        await service.openManual(); assert.deepEqual(state.opened.at(-1), morning);
        project.status = "active"; task.fromDate = "2026-09-27";
        await service.openManual(); assert.deepEqual(state.opened.at(-1), morning);
        assert.equal(state.providerCalls, 1, "Completed work, focus edits, new tasks and project state cannot rewrite a briefing");
        assert.equal(wizard.data.lastDailyBriefAutoShownDay, "2026-09-26");
        assert.deepEqual(wizard.data.dailyBriefSnapshot, stored);
        assert.equal(state.saved.length, 2, "Manual reopens do not persist auto-show state or a new artifact");
        service.trigger.background(); await service.trigger.activate(); assert.equal(state.opened.length, 3);
        const restored = f.make(); wizard.data = copy(wizard.data);
        assert.deepEqual(await restored.load(), morning, "Snapshot survives a plugin restart");
        assert.equal(state.providerCalls, 1);

        f.files.delete(task.path); await service.navigate(morning.recommendation.target);
        assert.deepEqual(state.navigated, ["home"]); assert.deepEqual(wizard.data.dailyBriefSnapshot, stored);
        f.plugin.oath.active = true; assert.equal(await service.openManual(), false);
        assert.equal(service.availability().available, false); assert.deepEqual(wizard.data.dailyBriefSnapshot, stored);
        f.plugin.oath.active = false;
        state.now = new Date(2026, 8, 27, 5, 59); await service.openManual(); assert.deepEqual(state.opened.at(-1), morning);
        state.now = new Date(2026, 8, 27, 6); const openedBefore = state.opened.length;
        await service.trigger.resume(); await service.trigger.activate(); assert.equal(state.opened.length, openedBefore, "No clock-boundary interruption");
        service.trigger.background(); await service.trigger.activate();
        assert.equal(state.opened.length, openedBefore + 1); assert.equal(state.providerCalls, 2);
        assert.equal(state.opened.at(-1).context.lastWorkDate, "2026-09-26");
        assert.equal(wizard.data.lastDailyBriefAutoShownDay, "2026-09-27");
        service.destroy(); restored.destroy();

        const late = fixture(); late.complete(); late.state.now = new Date(at(26, 15));
        late.wizard.pendingFocus = { sourceDate: "2026-09-26", items: [{ projectId: "p", text: "A new plan" }] };
        const lateService = late.make(); const beforeAuto = late.wizard.data.lastDailyBriefAutoShownDay;
        await lateService.openManual(); const lateBrief = late.state.opened[0];
        assert.equal(lateBrief.recommendation.actionLabel, "Continue 2b", "A late first opening reconstructs the pre-day completion state");
        assert.deepEqual(lateBrief.context.workspaces[0].taskProgress.map(event => event.text), ["1a"]);
        assert.equal(late.wizard.data.lastDailyBriefAutoShownDay, beforeAuto, "Manual-first generation does not mark auto-show");
        lateService.destroy();

        const concurrent = fixture(), concurrentService = concurrent.make();
        const [one, two] = await Promise.all([concurrentService.load(), concurrentService.load()]);
        assert.deepEqual(one, two); assert.equal(concurrent.state.providerCalls, 1); assert.equal(concurrent.state.saved.length, 1);
        one.recommendation.actionLabel = "Mutated view";
        assert.notEqual((await concurrentService.load()).recommendation.actionLabel, one.recommendation.actionLabel, "Returned views cannot mutate persistence");
        concurrentService.destroy();

        const pending = fixture(), pendingService = pending.make();
        let releaseSave, saveStarted;
        const saving = new Promise(resolve => { saveStarted = resolve; });
        pending.plugin.dataStore.save = async () => { saveStarted(); await new Promise(resolve => { releaseSave = resolve; }); };
        const first = pendingService.load(); await saving;
        let secondResolved = false;
        const second = pendingService.load().then(value => { secondResolved = true; return value; });
        await Promise.resolve(); assert.equal(secondResolved, false, "Concurrent readers wait for the durable artifact");
        pending.wizard.data = { lastDailyBriefAutoShownDay: "2026-09-25" };
        releaseSave();
        assert.deepEqual(await first, await second);
        assert.equal(pending.state.providerCalls, 1, "An ordinary writer replacing the in-memory object cannot cause regeneration");
        assert.ok(pending.wizard.data.dailyBriefSnapshot); pendingService.destroy();

        const queued = fixture(), queuedService = queued.make();
        const { HubDataStore } = require("../services/data-store");
        let releaseWriter, disk;
        queued.plugin.dataStore = new HubDataStore({ saveData: async data => {
            if (!disk) await new Promise(resolve => { releaseWriter = resolve; });
            disk = copy(data);
        } });
        const nextData = { ...queued.wizard.data, otherSetting: "User edit" };
        const writer = queued.plugin.dataStore.save(nextData).then(() => { queued.wizard.data = nextData; });
        while (!releaseWriter) await Promise.resolve();
        const generation = queuedService.load(); await Promise.resolve();
        releaseWriter(); await writer; await generation;
        assert.equal(disk.otherSetting, "User edit", "Saving a brief preserves an already-queued wizard edit");
        assert.ok(disk.dailyBriefSnapshot); queuedService.destroy();

        const backdated = fixture(); backdated.history.length = 0; backdated.reports.length = 1;
        backdated.reports[0].timestamp = at(26, 11); backdated.state.now = new Date(at(26, 15));
        backdated.wizard.data.reportFocusByDate["2026-09-25"].timestamp = at(26, 11);
        const backdatedService = backdated.make();
        assert.equal(await backdatedService.load(), null, "A report or focus first recorded after 06:00 is excluded even if dated yesterday");
        backdatedService.destroy();

        const future = fixture(); future.task.fromDate = "2026-09-26"; future.task.fromTime = "12:00"; future.state.now = new Date(at(26, 15));
        const futureService = future.make(); assert.equal((await futureService.load()).recommendation.reason, "no-clear-action", "Eligibility is evaluated at 06:00 even if first opened later"); futureService.destroy();

        const empty = fixture(); empty.history.length = 0; empty.reports.length = 0; empty.wizard.data.reportFocusByDate = {};
        const emptyService = empty.make(); await emptyService.refreshAvailability();
        assert.equal(emptyService.availability().available, false); assert.equal(await emptyService.openManual(), false);
        assert.equal(empty.state.providerCalls, 0); assert.ok(!empty.wizard.data.dailyBriefSnapshot); emptyService.destroy();

        const failed = fixture(), failedService = failed.make(); failed.plugin.dataStore.save = async () => { throw Error("disk"); };
        await assert.rejects(failedService.load(), /disk/); assert.ok(!failed.wizard.data.dailyBriefSnapshot); failedService.destroy();

        const early = fixture(); early.history[0].timestamp = new Date(2026, 8, 26, 5, 59).getTime();
        early.history.push({ ...early.history[0], id: "after", hubTaskId: "s2", text: "2b", timestamp: new Date(2026, 8, 26, 6).getTime() });
        const boundary = buildDailyBriefContext(early.wizard, { now: early.state.now });
        assert.equal(boundary.lastWorkDate, "2026-09-26", "Pre-06:00 work retains its actual report calendar date");
        assert.deepEqual(boundary.workspaces[0].taskProgress.map(event => event.text), ["1a"]);
        console.log("PASS: complete daily artifact, manual/auto independence, restart persistence, one concurrent generation, late/pre-06 history, boundary eligibility, mutations, Oath, safe navigation, no history and next-day rollover.");
    } finally { global.document = previousDocument; }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
