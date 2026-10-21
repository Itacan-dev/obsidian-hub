"use strict";
// Loads the staged actual plugin through Obsidian's plugin manager. No task
// dependency graph is reproduced here; consumers use the plugin's window hooks.
module.exports = async function ({ app, api }, root) {
    const fs = require("node:fs/promises"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
    const staged = process.env.ITACAN_M1D_BUILD; if (!staged) throw Error("Explicit staged build required");
    const checks = [], vault = path.join(root, "vault"), directory = path.join(vault, ".obsidian/plugins/hub-project-menu");
    await fs.mkdir(directory, { recursive: true });
    for (const name of ["main.js", "atlas-native.cjs", "strict-oath-assets.json", "lib/services/oath-strict-host.js", "lib/services/oath-strict.js", "lib/services/oath-process-observer.js", "lib/services/oath-dock.js", "lib/domain/oath-strict.js", "lib/ui/oath-dock/preload.cjs", "lib/ui/oath-dock/index.html", "lib/ui/oath-dock/dock.js", "lib/ui/oath-dock/dock.css"]) {
        const target = path.join(directory, name === "main.js" ? "itacan-staged.cjs" : name); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(path.join(staged, name), target);
    }
    await fs.copyFile(path.resolve(__dirname, "../../../.obsidian/plugins/hub-project-menu/styles.css"), path.join(directory, "styles.css"));
    await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify({ id: "hub-project-menu", name: "Itacan synthetic startup", version: "1.0.0", minAppVersion: "1.0.0", author: "Fixture", isDesktopOnly: true }));
    await fs.writeFile(path.join(directory, "data.json"), JSON.stringify({ completedTaskHistory: [{ id: 17, kind: "task", projectId: "other", projectName: "Historical Other", text: "Legacy recorded history", timestamp: Date.now() - 1000, path: "Projects/Other/Work/Tasks.md" }] }));
    const configuration = path.join(root, "configuration.json");
    await fs.writeFile(path.join(directory, "main.js"), `const fs=require('fs');const m={exports:{}};new Function('require','module','exports',fs.readFileSync(${JSON.stringify(path.join(directory, "itacan-staged.cjs"))},'utf8'))(require,m,m.exports);const Actual=m.exports;module.exports=class extends Actual{async onload(){window.__m1dPlugin=this;try{if(fs.existsSync(${JSON.stringify(configuration)}))await Actual.authorizeNativeTaskRehearsal(this,JSON.parse(fs.readFileSync(${JSON.stringify(configuration)},'utf8')));await super.onload();window.__m1dReady=true;}catch(e){window.__m1dError=e.stack;throw e;}}};`);
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    async function wait(predicate, label) { for (let n = 0; n < 500; n++) { if (await predicate()) return; if (window.__m1dError) throw Error(window.__m1dError); await delay(25); } throw Error("Timed out: " + label); }
    const create = async (name, text) => { for (let d = path.posix.dirname(name); d !== "."; d = path.posix.dirname(d)) { if (!app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d).catch(() => {}); } if (!app.vault.getAbstractFileByPath(name)) await app.vault.create(name, text); };
    await create("Projects/Native/Dashboard.md", "---\ntype: project\nprojectId: synthetic-native\nstatus: active\n---\n# Synthetic native\n");
    await create("Projects/Other/Dashboard.md", "---\ntype: project\nprojectId: other\nstatus: active\n---\n# Other\n");
    await create("Projects/Other/Work/Tasks.md", "# Tasks\n\n- [ ] Legacy task <!-- hub-task:legacy-task -->\n");
    await wait(() => app.metadataCache.getFileCache(app.vault.getAbstractFileByPath("Projects/Native/Dashboard.md"))?.frontmatter?.projectId, "Project metadata");
    const pages = [{ file: { path: "Projects/Other/Work/Tasks.md", tasks: [{ path: "Projects/Other/Work/Tasks.md", line: 2, lineCount: 1, text: "Legacy task <!-- hub-task:legacy-task -->", status: " ", completed: false, checked: false, children: [], parent: null }] } }];
    app.plugins.plugins.dataview = { api: { pages: () => ({ array: () => pages }), index: { initialized: true } } };
    async function start() {
        window.__m1dReady = false; window.__m1dError = null; await app.plugins.loadManifests(); await app.plugins.enablePlugin("hub-project-menu"); await wait(() => window.__m1dReady, "actual onload"); return window.__m1dPlugin;
    }
    async function stop(plugin) { await app.plugins.disablePlugin("hub-project-menu"); await plugin.nativeTaskStopping; }
    let plugin = await start();
    assert.equal(plugin.nativeTaskHost, null); assert.equal(plugin.taskService.capabilities().backend, "legacy-markdown"); assert.deepEqual(await fs.readdir(path.join(root, "native")), []);
    checks.push("actual ordinary onload: Legacy service, no native directory writes or host");
    const component = new api.Component(); component.load();
    let panel = window.hubCreateTaskPanelRead({ component, workspace: { type: "project", id: "other" }, changed() {} });
    let result = await panel.read(); assert(result?.tasks.some(t => t.text.includes("Legacy task"))); panel.close();
    checks.push("ordinary startup exposes actual legacy Project controller");
    const defaultHome = window.hubCreateHomeTaskRead({ component, changed() {}, resolveOwner: task => plugin.projectWizard.getContextForPath(task.path) });
    assert((await defaultHome.read()).items.some(i => i.task.hubTaskId === "legacy-task"));
    const legacyModal = plugin.openTaskCreator({ location: "Projects/Other/Work/Tasks.md" }); await legacyModal.ready; assert(legacyModal.contentEl.querySelector("form")); legacyModal.close();
    checks.push("ordinary startup retains legacy Home reads and existing Add form");
    const legacyScheduleRoot = document.body.createDiv({ cls: "project-dashboard" }), legacyToolbar = legacyScheduleRoot.createDiv(), legacyGrid = legacyScheduleRoot.createDiv();
    window.hubMountTaskWorkspace({ component, dv: { container: legacyScheduleRoot }, root: legacyScheduleRoot, toolbar: legacyToolbar, filesGrid: legacyGrid, filesPanel: legacyGrid.createDiv(), workspace: plugin.projectWizard.getProjectById("other"), onFiles() {}, openSource() {} });
    legacyToolbar.querySelector('[data-workspace-mode="schedule"]').click(); await wait(() => legacyScheduleRoot.querySelector(".hub-task-board .project-task-row"), "ordinary legacy Schedule");
    assert(!legacyToolbar.querySelector('[data-workspace-mode="roadmap"]').disabled); legacyScheduleRoot.remove(); checks.push("ordinary startup Schedule remains on Legacy and keeps established controls");
    component.unload(); await stop(plugin); assert.equal(window.hubCreateTaskPanelRead, undefined); checks.push("ordinary onunload removes actual consumer hooks");
    const config = { version: 1, root, syntheticOnly: true, owner: { type: "project", id: "synthetic-native" }, projectRoot: "Projects/Native", dashboard: "Projects/Native/Dashboard.md", partitionId: "private", rehearsalId: crypto.randomUUID(), creating: true,
        config: { version: 1, scope: "inactive-disposable", storageFormat: "private-v4", authorityId: crypto.randomUUID(), directory: path.join(root, "native"), applicationContextId: "startup-" + crypto.randomUUID(), registryId: "startup-registry" } };
    await fs.writeFile(configuration, JSON.stringify(config)); plugin = await start();
    assert.equal(plugin.nativeTaskHost.status().state, "ready"); const runtime = plugin.nativeTaskHost.runtime();
    assert.equal(plugin.taskService.capabilities().backend, "legacy-markdown"); assert((await fs.readdir(config.config.directory)).includes("WRITER.lock")); checks.push("actual authorized onload owns one native lease alongside Legacy service");
    const c = new api.Component(); c.load(); panel = window.hubCreateTaskPanelRead({ component: c, workspace: config.owner, changed() {} });
    const modal = panel.create({ dueDate: "2026-10-21", dueTime: "00:00" }); await modal.ready;
    const input = modal.contentEl.querySelector("textarea,input[type=text]"); assert(input); input.value = "Startup native task"; input.dispatchEvent(new Event("input", { bubbles: true }));
    modal.taskFields.checklist.toggle.click(); const stepInput = modal.contentEl.querySelector('[aria-label="New step"]'); assert(stepInput); stepInput.value = "Flat startup Step"; stepInput.dispatchEvent(new Event("input", { bubbles: true }));
    modal.contentEl.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await wait(async () => (await runtime.list()).tasks.length === 1, "actual Add mutation"); await wait(() => !modal.modalEl.isConnected, "Add close");
    let task = (await runtime.list()).tasks[0], id = task.id; assert.equal(task.dueDate, "2026-10-21"); assert.equal(task.dueTime, "00:00"); checks.push("actual startup Project Add modal commits native UUID and civil midnight");
    const edited = panel.actions.editTask(task, () => {}); await edited.ready; const title = edited.contentEl.querySelector("textarea,input[type=text]"); title.value = "Edited startup task"; title.dispatchEvent(new Event("input", { bubbles: true })); edited.contentEl.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await wait(async () => (await runtime.list()).tasks[0].text === "Edited startup task", "actual Edit Save"); await wait(() => !edited.modalEl.isConnected, "Edit close"); checks.push("actual startup Edit modal uses atomic native Save");
    task = (await runtime.list()).tasks[0]; assert.equal(task.steps.length, 1); const originalStepId = task.steps[0].id;
    await panel.actions.mutate({ ...task, operation: "step", step: task.steps[0], stepCompleted: true }); task = (await runtime.list()).tasks[0]; assert(task.steps[0].completed && !task.completed);
    await panel.toggle(task, true); task = (await runtime.list()).tasks[0]; assert(task.completed && task.steps[0].completed);
    await panel.toggle(task, false); task = (await runtime.list()).tasks[0]; assert(!task.completed && task.steps[0].completed && task.steps[0].id === originalStepId);
    await panel.toggle(task, true); checks.push("actual startup flat Step creation and independent Step/parent completion, reopening and recompletion preserve UUIDs");
    const history = window.hubCreateTaskHistoryRead({ component: c }); const h = await history.read(); assert(h.records.some(r => r.nativeHistory?.taskId === id)); assert.equal(h.records.filter(r => r.id === 17).length, 1);
    window.hubOpenStatistics(); await wait(() => plugin.statisticsModal?.source, "actual Statistics modal"); assert(plugin.statisticsModal.source.completions.some(r => r.text === "Edited startup task")); plugin.statisticsModal.close(); checks.push("actual startup History and Statistics consume native completion evidence");
    const home = window.hubCreateHomeTaskRead({ component: c, changed() {}, resolveOwner: task => plugin.projectWizard.getContextForPath(task.path), resolveNativeOwner: ref => plugin.projectWizard.getProjectById(ref.id) });
    const mixed = await home.read(); assert(mixed.countComplete); assert.equal(mixed.items.filter(i => i.task.nativeReference).length, 1); assert(mixed.items.some(i => i.task.hubTaskId === "legacy-task")); checks.push("actual startup Home factory composes native and legacy owners once");
    // This is the real window hook installed by onload, with no injected ports.
    const scheduleRoot = document.body.createDiv({ cls: "project-dashboard" }), toolbar = scheduleRoot.createDiv(), filesGrid = scheduleRoot.createDiv(), filesPanel = filesGrid.createDiv();
    const schedule = window.hubMountTaskWorkspace({ component: c, dv: { container: scheduleRoot }, root: scheduleRoot, toolbar, filesGrid, filesPanel, workspace: plugin.projectWizard.getProjectById(config.owner.id), onFiles() {}, openSource() { throw Error("Native source fallback"); } });
    toolbar.querySelector('[data-workspace-mode="schedule"]').click(); await wait(() => scheduleRoot.querySelector(".hub-task-board"), "startup Schedule Overview");
    scheduleRoot.querySelector('[data-schedule-control="view-week"]').click(); assert.equal(scheduleRoot.querySelectorAll(".hub-task-calendar-day").length, 7);
    scheduleRoot.querySelector('[data-schedule-control="view-month"]').click(); assert(scheduleRoot.querySelectorAll(".hub-task-calendar-day").length >= 28); assert(toolbar.querySelector('[data-workspace-mode="roadmap"]').disabled);
    const add = scheduleRoot.querySelector('[aria-label^="Add task on "]'); add.click(); await wait(() => document.querySelector('.modal[aria-label="Add task"] form'), "startup calendar Add");
    const calendarTitle = document.querySelector('.modal[aria-label="Add task"] textarea[aria-label="Task"]'); calendarTitle.value = "Calendar startup task"; calendarTitle.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('.modal[aria-label="Add task"] form').dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await wait(async () => (await runtime.list()).tasks.length === 2, "calendar commit"); await wait(() => !document.querySelector('.modal[aria-label="Add task"] form'), "calendar close");
    const calendarTask = (await runtime.list()).tasks.find(t => t.text === "Calendar startup task"); assert(calendarTask.dueDate); assert.equal(calendarTask.dueTime, null);
    checks.push("actual startup Schedule Overview/Week/Month and calendar Add use native UUID/date-only Due");
    assert.throws(() => plugin.taskEditor.create("Projects/Native/Tasks.md", "forbidden"), /unavailable/);
    assert.throws(() => plugin.mutateTask({ path: config.dashboard, line: 0 }), /unavailable/);
    assert.throws(() => plugin.planning.project(config.owner.id), /unavailable/);
    assert.throws(() => plugin.inbox.makeTask({ workspaceId: config.owner.id, location: config.dashboard }), /unavailable/);
    assert.throws(() => plugin.oath.take({ workspace: config.owner }), /unavailable/); checks.push("unsupported source, Phase, Inbox and Oath entry points reject before side effects");
    const command = Object.values(app.commands.commands).find(v => v.id === "hub-project-menu:native-task-recovery"); assert(command); command.callback();
    await wait(() => plugin.nativeTaskRecoveryModal?.body?.querySelector("button"), "integrated recovery"); const recovery = plugin.nativeTaskRecoveryModal;
    [...recovery.body.querySelectorAll("button")].find(b => b.textContent === "Inspect").click(); await wait(() => recovery.body.textContent.includes("confirmed-committed"), "receipt inspection");
    assert(!recovery.body.textContent.includes("Private description")); recovery.close(); checks.push("actual operator command opens bounded receipt inspection and explicit replay controls");
    const retained = await runtime.retained(); assert(retained.length >= 4); c.unload(); scheduleRoot.remove(); await stop(plugin); assert(!(await fs.readdir(config.config.directory)).includes("WRITER.lock")); checks.push("actual unload drains native host and releases writer ownership");
    config.creating = false; await fs.writeFile(configuration, JSON.stringify(config)); plugin = await start(); assert.equal(plugin.nativeTaskHost.status().state, "ready");
    const reopened = plugin.nativeTaskHost.runtime(), restored = await reopened.list(); assert(restored.tasks.some(t => t.id === id && t.completed)); checks.push("actual clean startup reconstructs same UUID and committed completion");
    const context = await reopened.creationContext(); await stop(plugin);
    // Seed a genuinely retained but undispatched original operation through the
    // existing writer, then recover it solely through actual startup/UI wiring.
    const W = require("../../writer"), P = require("../../writer/policy"), H = require("../../host/registry"), B = require("../../product-ui/bridge.cjs");
    const body = { version: 1, registryId: config.config.registryId, applicationContextId: config.config.applicationContextId, revision: JSON.stringify([config.owner.id, config.projectRoot, config.dashboard, "active", false]), owners: [{ owner: config.owner, partitionId: "private", root: config.projectRoot, dashboard: config.dashboard, status: "active", available: true, shared: false, shareApproval: null, locations: [], mounts: [] }] };
    const writerPolicy = P.policy({ version: 1, owners: [{ owner: config.owner, partitionId: "private" }], commands: ["task.createRich", "task.save", "task.complete", "step.complete", "task.delete"], inventory: { version: 1, revision: "synthetic-empty", ids: [] }, phases: { version: 1, revision: "no-phases", values: [] } });
    const session = W.createNativeWriterSession(config.config, { registry: { read: async () => ({ ...body, digest: H.registryDigest(body) }), subscribe: () => () => {} }, writerPolicy, requestRetention: { version: 1, rehearsalId: config.rehearsalId } });
    await session.host.open({ version: 1, expectedAuthorityId: config.config.authorityId, syntheticOnly: true });
    const intent = B.create(context, { text: "Explicit startup recovery", completed: true, steps: [{ text: "Preserved recovery Step", completed: true }] }); intent.action.draft.id = crypto.randomUUID();
    const cap = await session.authorize({ version: 1, owners: writerPolicy.owners, commands: writerPolicy.commands }); await session.requests.prepare(cap, intent); session.revoke(cap); await session.dispose();
    plugin = await start(); const recovered = plugin.nativeTaskHost.runtime(); const recoveryCommand = Object.values(app.commands.commands).find(v => v.id === "hub-project-menu:native-task-recovery"); recoveryCommand.callback();
    await wait(() => plugin.nativeTaskRecoveryModal?.body?.textContent.includes(intent.operationId), "pending recovery UI");
    const recoveryUi = plugin.nativeTaskRecoveryModal, pendingRow = [...recoveryUi.body.children].find(el => el.textContent.includes(intent.operationId));
    [...pendingRow.querySelectorAll("button")].find(b => b.textContent === "Inspect").click(); await wait(() => pendingRow.textContent.includes("execution-uncertain"), "missing receipt inspection");
    const replayButton = [...pendingRow.querySelectorAll("button")].find(b => b.textContent === "Review identical replay"); assert(!replayButton.disabled); replayButton.click(); assert.equal(replayButton.textContent, "Confirm exact original replay"); assert.equal((await recovered.list()).tasks.length, 2);
    replayButton.click(); await wait(() => pendingRow.textContent.includes("confirmed-committed"), "confirmed operator replay"); const afterRecovery = await recovered.list(); assert.equal(afterRecovery.tasks.length, 3); assert(afterRecovery.tasks.some(t => t.id === intent.action.draft.id && t.steps[0].id === intent.action.draft.steps[0].id)); recoveryUi.close();
    checks.push("actual recovery command: missing receipt, explicit two-step confirmation, identical replay and preserved task/Step UUIDs");
    await stop(plugin); config.creating = true; await fs.writeFile(configuration, JSON.stringify(config)); plugin = await start(); assert.equal(plugin.nativeTaskHost.status().state, "unavailable");
    const failedComponent = new api.Component(); failedComponent.load(); const failedPanel = window.hubCreateTaskPanelRead({ component: failedComponent, workspace: config.owner, changed() {} }); assert.equal((await failedPanel.read()).availability, "unavailable"); assert.throws(() => failedPanel.create());
    const failedHome = window.hubCreateHomeTaskRead({ component: failedComponent, changed() {}, resolveOwner: t => plugin.projectWizard.getContextForPath(t.path), resolveNativeOwner: ref => plugin.projectWizard.getProjectById(ref.id) }); assert.equal((await failedHome.read()).countComplete, false);
    assert.throws(() => plugin.mutateTask({ path: config.dashboard })); failedComponent.unload(); await stop(plugin); checks.push("actual native startup failure reserves owner, rejects Markdown fallback and withholds complete Home count");
    await fs.unlink(configuration); plugin = await start(); assert.equal(plugin.nativeTaskHost, null); await stop(plugin); checks.push("later default startup remains Legacy and acquires no native host");
    return { checks, actualPluginOnload: true, actualPluginOnunload: true, everydayInstalledBundleLoaded: false, taskDependencyGraphReproduced: false };
};
