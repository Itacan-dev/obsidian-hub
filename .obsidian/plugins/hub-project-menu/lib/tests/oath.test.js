"use strict";
const assert = require("node:assert/strict");
const { HubOathService } = require("../services/oath");
const { createOathFullscreen } = require("../services/oath-fullscreen");
const { readTaskSnapshot, taskMetadata, toggleTaskStep } = require("../domain/task-planning");
const { taskLineDetails, taskIdentity, editTaskContent } = require("../domain/tasks");
const { oathTime, oathProgress, validateOath, fulfilmentLabel, oathDuration, normalizeOath } = require("../domain/oath");

function fixture(data = {}, deviceId = "this-device") {
    let now = 1_000_000, persisted = null, failSave = false, ready = true, frozen = null, queries = 0;
    const files = new Map([["Projects/A/Tasks.md", "- [ ] First\n    - [ ] A step\n- [ ] Second\n"], ["Personal/Tasks.md", "- [ ] Future <!-- hub-task:future -->\n"]]);
    const contexts = [{ projectId: "a", name: "A", root: "Projects/A", path: "Projects/A/A.md", status: "active", contextKind: "project" },
        { projectId: "b", name: "B", root: "Projects/B", path: "Projects/B/B.md", status: "active", contextKind: "project" }];
    const resources = require("../config").RESOURCE_TYPES.map(require("../config").publicResourceType);
    for (const context of [...contexts, ...resources]) files.set(context.path, "");
    const wizard = { data, getProjectRecords: () => contexts, getResourceTypes: () => resources,
        getProjectById: id => contexts.find(item => item.projectId === id),
        getResourceById: id => resources.find(item => item.id === id || item.projectId === id),
        getProjectForPath: path => contexts.find(item => String(path).startsWith(item.root + "/")),
        getResourceForPath: path => resources.find(item => String(path).startsWith(item.root + "/")) };
    const notices = [], cleanups = [], subscribers = new Set();
    const vault = {
        getAbstractFileByPath: path => files.has(path) ? { path, extension: "md" } : null,
        read: async file => { if (!file || !files.has(file.path)) throw Error("Missing file"); return files.get(file.path); },
        process: async (file, update) => { files.set(file.path, update(await vault.read(file))); }
    };
    const readTasks = () => [...files].flatMap(([path, content]) => content.split("\n").flatMap((raw, line) => {
        const details = taskLineDetails(raw);
        return details && !/^\s/.test(raw) ? [readTaskSnapshot(content, { path, line, text: details.text, hubTaskId: taskIdentity(raw) })] : [];
    }));
    const plugin = { app: { vault, plugins: { getPlugin: () => ({ api: { index: { get initialized() { return ready; } } } }) } },
        projectWizard: wizard, register: fn => cleanups.push(fn), enqueueTaskMutation: async fn => fn(),
        dataStore: { deviceId, save: async data => { if (failSave) throw Error("Disk unavailable"); persisted = structuredClone(data); } },
        taskData: { readPages: () => { queries++; const tasks = frozen ?? readTasks(); return [{ file: { tasks: tasks.map(task => ({ ...task, identityConflict: tasks.filter(item => item.hubTaskId && item.hubTaskId === task.hubTaskId).length > 1 })) } }]; },
            subscribe: (component, fn) => { subscribers.add(fn); component.register(() => subscribers.delete(fn)); } },
        taskEditor: { file: path => { const file = vault.getAbstractFileByPath(path); if (!file) throw Error("Missing file"); return file; }, metadata: id => taskMetadata(data.taskMetadata?.[id]) }
    };
    const full = { owned: false, full: false, entries: 0, exits: 0, available: true,
        isFull() { return this.full; }, restore(value) { this.owned = !!value && this.full; },
        onChange(fn) { this.change = fn; }, async enter() { if (this.full) return this.owned; this.entries++; if (!this.available) return false; this.full = this.owned = true; return true; },
        async exit() { if (this.owned) { this.full = false; this.exits++; } this.owned = false; this.change?.(false); }, destroy() {} };
    const service = new HubOathService(plugin, full, { now: () => now, notice: text => notices.push(text) });
    const draft = (extra = {}) => ({ start: "now", workspace: { type: "project", id: "a", name: "A" }, durationMs: 50 * 60000, tasks: readTasks().slice(0, 2), ...extra });
    const complete = index => {
        const task = readTasks()[index], result = editTaskContent(files.get(task.path), { ...task, completed: true }, line => line.replace("[ ]", "[x]"));
        files.set(task.path, result.content); service.changed(result.edit); return result.edit;
    };
    return { service, full, plugin, files, contexts, resources, notices, draft, complete, readTasks, advance: ms => now += ms,
        freeze: () => frozen = readTasks(), thaw: () => frozen = null, setReady: value => ready = value, fail: value => failSave = value,
        get saved() { return persisted; }, get queries() { return queries; },
        destroy() { service.destroy(); cleanups.forEach(fn => fn()); } };
}

async function run() {
    const minute = 60000;
    for (const [minutes, label] of [[1, "1 minute"], [25, "25 minutes"], [50, "50 minutes"], [90, "90 minutes"], [150, "2 hours 30 minutes"]]) {
        assert.equal(oathDuration(minutes * minute), label);
        assert.equal(fulfilmentLabel({ durationMs: minutes * minute }), `After ${label}`);
    }
    for (const durationMs of [null, undefined, 0, -1, Infinity, NaN, 30000, 90000]) {
        assert.throws(() => validateOath({ start: "now", durationMs, tasks: [] }), /duration/);
    }
    for (const tasks of [[], undefined, null]) {
        assert.throws(() => validateOath({ start: "now", durationMs: minute, tasks }), /Select at least one task/);
    }
    validateOath({ start: "now", workspace: { type: "project", id: "a" }, durationMs: minute, tasks: [{ text: "Selected task" }] });
    const empty = fixture();
    for (const start of ["now", "scheduled"]) {
        await assert.rejects(empty.service.take(empty.draft({ start, scheduledAt: 1_100_000, tasks: [] })), /Select at least one task/);
    }
    assert.equal(empty.saved, null); assert.equal(empty.full.entries, 0);
    assert.equal(empty.service.committed, false); empty.destroy();
    assert.throws(() => validateOath({ start: "scheduled", scheduledAt: 0, durationMs: minute }, 1), /future/);

    // 1, 4, 10, 11, 12, 13: exact boundary, continued enforcement/time,
    // time before unfinished tasks, and an exit request with stale intent.
    for (const taskCount of [1, 2]) {
        const f = fixture(); await f.service.start();
        await f.service.take(f.draft({ tasks: f.readTasks().slice(0, taskCount) }));
        const start = f.service.current.startedAt;
        assert.equal(f.service.current.fulfilment, undefined);
        f.advance(50 * minute - 1000); await f.service.refresh(false);
        assert.equal(f.service.fulfilled, false);
        assert.equal(await f.service.end(f.service.current.id), "confirmation-required");
        assert.equal(f.full.full, true); assert.equal(f.service.bucket.history.length, 0);
        f.advance(1000); await f.service.refresh(false);
        assert.equal(f.service.current.fulfilledAt, start + 50 * minute);
        assert.equal(f.service.active, true); assert.equal(f.full.full, true); assert.equal(f.full.exits, 0);
        assert.equal(f.service.current.completedAt, null); assert.equal(f.notices.length, 0);
        f.advance(20 * minute); await f.service.refresh(false);
        assert.equal(oathTime(f.service.current, start + 70 * minute).elapsedMs, 70 * minute);
        await f.service.end(f.service.current.id, "broken");
        assert.equal(f.service.current.state, "fulfilled", "A stale Break click cannot break a fulfilled Oath");
        assert.equal(f.service.current.elapsedMs, 70 * minute); assert.equal(f.full.exits, 1);
        await f.service.end(f.service.current.id, "broken"); assert.equal(f.service.bucket.history.length, 1);
        f.destroy();
    }

    // 2, 3: actual source edits, only parent completion, final task latches.
    const f = fixture(); f.freeze(); await f.service.start(); await f.service.take(f.draft());
    await f.service.refresh(); assert.equal(oathProgress(f.service.work).missing, 0, "New IDs survive index lag");
    const before = f.queries; f.advance(5000); await f.service.refresh(false); assert.equal(f.queries, before);
    await assert.rejects(f.service.take(f.draft()), /already/);
    f.thaw(); const parent = f.readTasks()[0];
    const step = toggleTaskStep(f.files.get(parent.path), { ...parent, step: parent.steps[0], stepCompleted: true });
    f.files.set(parent.path, step.content); f.service.changed(step.edit); await f.service.refresh();
    assert.equal(oathProgress(f.service.work).completed, 0);
    f.complete(0); await f.service.refresh(); assert.equal(f.service.fulfilled, false);
    f.advance(32 * minute); f.complete(1); await f.service.refresh();
    const fulfilledAt = f.service.current.fulfilledAt;
    assert.equal(f.service.active, true); assert.equal(f.full.full, true); assert.equal(f.notices.length, 0);
    f.files.set(parent.path, f.files.get(parent.path).replaceAll("[x]", "[ ]")); await f.service.refresh();
    assert.equal(f.service.current.fulfilledAt, fulfilledAt, "Task changes cannot undo fulfillment");
    f.advance(5 * minute); await f.service.end(f.service.current.id);
    assert.equal(f.service.current.state, "fulfilled"); assert.equal(f.service.current.elapsedMs, 37 * minute + 5000); f.destroy();

    // 9: all exit calls require explicit destructive intent before fulfillment.
    const broken = fixture(); await broken.service.take(broken.draft());
    for (const intent of [undefined, "cancel", "fulfilled"]) {
        assert.equal(await broken.service.end(broken.service.current.id, intent), "confirmation-required");
        assert.equal(broken.full.full, true); assert.equal(broken.service.active, true);
    }
    await broken.service.end(broken.service.current.id, "broken");
    assert.equal(broken.service.current.state, "broken"); assert.equal(broken.full.full, false); broken.destroy();

    // 14: schedules never fulfill before activation; clock starts at actual entry.
    for (const tasksFirst of [false, true]) {
        const scheduled = fixture(); await scheduled.service.take(scheduled.draft({ start: "scheduled", scheduledAt: 1_100_000 }));
        if (tasksFirst) { scheduled.complete(0); scheduled.complete(1); await scheduled.service.refresh(); }
        assert.equal(scheduled.service.current.state, "scheduled"); assert.equal(scheduled.service.fulfilled, false);
        assert.equal(scheduled.full.entries, 0);
        scheduled.advance(100000); await scheduled.service.refresh();
        assert.equal(scheduled.service.active, true); assert.equal(scheduled.full.full, true);
        if (!tasksFirst) {
            assert.equal(await scheduled.service.end(scheduled.service.current.id), "confirmation-required");
            scheduled.advance(50 * minute); await scheduled.service.refresh(false);
        }
        assert.equal(scheduled.service.fulfilled, true); assert.equal(scheduled.full.full, true);
        await scheduled.service.end(scheduled.service.current.id); assert.equal(scheduled.service.current.state, "fulfilled"); scheduled.destroy();
    }
    const cancel = fixture(); await cancel.service.take(cancel.draft({ start: "scheduled", scheduledAt: 1_100_000 }));
    await cancel.service.end(cancel.service.current.id, "cancel"); assert.equal(cancel.service.current, null); assert.equal(cancel.service.bucket.history.length, 0); cancel.destroy();

    // 15: normalize only committed legacy records; history is unchanged.
    for (const mode of ["open", "tasks", "timed", "unknown"]) {
        const history = [{ id: "old", state: "fulfilled", fulfilment: mode, elapsedMs: 123 }];
        const legacy = fixture({ oathsByDevice: { "this-device": { current: { id: "legacy", workspace: { type: "project", id: "a" }, state: "active", startedAt: 1_000_000,
            durationMs: null, fulfilment: mode, autoExit: true, scope: "all", tasks: [] }, history } } });
        await legacy.service.start(); assert.equal(legacy.service.current.durationMs, 50 * minute);
        assert.equal(legacy.service.current.fulfilment, undefined); assert.equal(legacy.full.full, true);
        assert.deepEqual(legacy.service.bucket.history, history);
        legacy.advance(50 * minute); await legacy.service.refresh(false); assert.equal(legacy.service.active, true);
        const saved = structuredClone(legacy.saved); legacy.destroy();
        const restored = fixture(saved); restored.advance(70 * minute); await restored.service.start();
        assert.equal(restored.service.active, true); assert.equal(restored.service.fulfilled, true); assert.equal(restored.full.full, true);
        await restored.service.end("legacy"); assert.equal(restored.service.current.elapsedMs, 70 * minute); restored.destroy();
    }
    assert.equal(normalizeOath({ state: "active", durationMs: 25 * minute }).durationMs, 25 * minute);
    const reloadFailure = fixture({ oathsByDevice: { "this-device": { current: {
        id: "save-failure", workspace: { type: "project", id: "a" }, state: "active", startedAt: 1_000_000, fulfilment: "open", durationMs: null, tasks: [] }, history: [] } } });
    reloadFailure.fail(true); const startupLog = console.error; console.error = () => {};
    try { await reloadFailure.service.start(); } finally { console.error = startupLog; }
    assert.equal(reloadFailure.full.full, true, "Migration/save failure cannot bypass fullscreen restoration");
    assert.ok(reloadFailure.service.timer); reloadFailure.destroy();
    const noIndex = fixture(); noIndex.setReady(false);
    await assert.rejects(noIndex.service.take(noIndex.draft()), /index/);
    assert.equal(noIndex.service.active, false); noIndex.destroy();

    const missing = fixture(); await missing.service.take(missing.draft());
    const original = missing.files.get("Projects/A/Tasks.md"); missing.files.delete("Projects/A/Tasks.md"); await missing.service.refresh();
    assert.equal(oathProgress(missing.service.work).missing, 2);
    missing.contexts[0].root = "Projects/Renamed";
    missing.files.set("Projects/Renamed/Tasks.md", original.replace("First", "Edited title")); await missing.service.refresh();
    assert.equal(missing.service.work[0].task.path, "Projects/Renamed/Tasks.md");
    missing.files.set("Copy.md", original); await missing.service.refresh(); assert.equal(oathProgress(missing.service.work).missing, 2);
    missing.advance(50 * minute); await missing.service.refresh(false); assert.equal(missing.service.fulfilled, true); missing.destroy();

    const failed = fixture(); failed.fail(true); await assert.rejects(failed.service.take(failed.draft()), /Disk/);
    assert.equal(failed.service.committed, false); assert.equal(failed.full.entries, 0);
    failed.fail(false); await failed.service.take(failed.draft()); failed.fail(true);
    await assert.rejects(failed.service.end(failed.service.current.id, "broken"), /Disk/);
    assert.equal(failed.service.active, true); assert.equal(failed.full.full, true);
    const log = console.error; console.error = () => {};
    try { failed.complete(0); failed.complete(1); await failed.service.refresh(); } finally { console.error = log; }
    assert.equal(failed.service.fulfilled, true);
    failed.files.set("Projects/A/Tasks.md", failed.files.get("Projects/A/Tasks.md").replaceAll("[x]", "[ ]"));
    failed.fail(false); await failed.service.refresh(); assert.ok(failed.service.current.fulfilledAt);
    await failed.service.end(failed.service.current.id, "broken"); assert.equal(failed.service.current.state, "fulfilled"); failed.destroy();

    // Native adapter: Escape cannot release fullscreen, even with an alternate
    // command, pending native entry, or a plugin reload. UI dismissal is tested
    // separately through actual modal controls in oath.html.
    const { EventEmitter } = require("node:events");
    let full = false, kiosk = false, requests = 0;
    const calls = [], win = new EventTarget(), native = new EventEmitter();
    win.document = new EventTarget(); win.electronWindow = native; native.webContents = new EventEmitter();
    native.isFullScreen = () => full; native.isKiosk = () => kiosk;
    native.setFullScreen = value => { calls.push(value); full = value; };
    native.setKiosk = value => { kiosk = value; };
    let api = createOathFullscreen(win); api.onExitRequest(() => requests++);
    await api.enter(); assert.equal(kiosk, true); assert.equal(full, true);
    for (const key of ["Escape", "F11"]) {
        const event = new Event("keydown", { cancelable: true }); event.key = key; win.dispatchEvent(event);
        assert.equal(event.defaultPrevented, true); assert.equal(full, true);
    }
    assert.equal(requests, 2);
    let prevented = false;
    native.webContents.emit("before-input-event", { preventDefault() { prevented = true; } }, { key: "Escape", type: "keyDown" });
    assert.equal(prevented, true); assert.equal(requests, 3); assert.equal(full, true);
    native.setFullScreen(false); native.setKiosk(false); assert.equal(requests, 5); assert.equal(full, true); assert.equal(kiosk, true);
    native.emit("close", { preventDefault() {} }); assert.equal(requests, 6); assert.equal(full, true);
    full = false; native.emit("leave-full-screen"); assert.equal(full, true, "Unexpected native exit is restored");
    api.destroy(); api = createOathFullscreen(win); api.restore(true); await api.enter(); await api.exit();
    assert.equal(full, false); assert.equal(kiosk, false); api.destroy();
    full = true; api = createOathFullscreen(win); assert.equal(await api.enter(), false); assert.equal(kiosk, true);
    await api.exit(); assert.equal(full, true, "Preexisting ordinary fullscreen is restored"); assert.equal(kiosk, false); api.destroy();
    const ordinary = new Event("keydown", { cancelable: true }); ordinary.key = "Escape"; win.dispatchEvent(ordinary);
    assert.equal(ordinary.defaultPrevented, false); assert.equal(native.listenerCount("close"), 0);
    full = false; delete native.__hubOathFullscreenGuard; const pending = []; native.setFullScreen = value => pending.push(value);
    api = createOathFullscreen(win); await api.enter(); await api.exit(); assert.deepEqual(pending, [true, false]); api.destroy();
    delete native.__hubOathFullscreenGuard;
    let remotePath = null;
    win.electron = { remote: { require(path) { remotePath = path; return require("../services/oath-fullscreen"); } } };
    api = createOathFullscreen(win, "/plugin/lib/services/oath-fullscreen.js");
    assert.equal(remotePath, "/plugin/lib/services/oath-fullscreen.js", "Desktop installs the main-process guard through remote.require");
    await api.enter(); await api.exit(); api.destroy();
    const browser = new EventTarget(); browser.document = { documentElement: { requestFullscreen: () => { throw Error("Unsafe fallback used"); } } };
    api = createOathFullscreen(browser); assert.equal(await api.enter(), false); api.destroy();
    console.log("PASS: duration validation, timer/tasks/monotonic fulfillment, continued time, centralized exits, schedules, legacy/reload, persistence failures, native fullscreen enforcement. Warning interactions are covered by oath.html.");
}
module.exports = { fixture };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
