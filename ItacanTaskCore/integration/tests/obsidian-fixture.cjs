"use strict";
module.exports = async function({ app, api }, root) {
 const fs = require("node:fs/promises"), path = require("node:path"), assert = require("node:assert/strict"), Module = require("node:module");
 const workspace = path.resolve(__dirname, "../../.."), lib = path.join(workspace, ".obsidian/plugins/hub-project-menu/lib"), original = Module._load;
 Module._load = function(name, parent) { if (name === "obsidian" && parent?.filename?.startsWith(workspace + path.sep)) return api; if (/services[\\/](?:oath-strict|inbox)(?:\.|$)/.test(name)) throw Error("Unapproved service denied"); return original.apply(this, arguments); };
 const S = require("./support.cjs"), { createTaskPanelRead } = require(lib + "/services/task-panel-read"), { createTaskUi, createTaskRow } = require(lib + "/ui/tasks");
 const checks = [], timings = {}, component = new api.Component(); component.load();
 const style = document.createElement("style"); style.textContent = await fs.readFile(path.join(lib, "../styles.css"), "utf8"); document.head.append(style);
 document.body.classList.add("theme-dark"); document.body.style.setProperty("--interactive-accent", "#9b79e8");
 class RehearsalView extends api.ItemView { getViewType() { return "itacan-m1a-project"; } getDisplayText() { return "Isolated Project Tasks"; } }
 window.__m1aBootstrap.registerView("itacan-m1a-project", leaf => new RehearsalView(leaf));
 const leaf = app.workspace.getLeaf(true); await leaf.setViewState({ type: "itacan-m1a-project", active: true }); const host = leaf.view.containerEl.createDiv({ cls: "hub-button-scope" }); host.id = "m1a-root"; host.style.padding = "24px";
 host.createEl("h2", { text: "Project Tasks - isolated actual Obsidian" }); host.createEl("p", { text: "Synthetic private Project. Home, Schedule and History/Statistics are unavailable." });
 const heading = host.createDiv(), body = host.createDiv(); body.id = "m1a-native";
 const cfg = S.configuration(path.join(root, "native")); let runtime = await S.openProjectRuntime(cfg.config, { ...cfg, creating: true }), controller, ui, timer;
 const plugin = { app, get taskService() { throw Error("Native controller entered legacy service"); }, register: fn => component.register(fn) };
 const update = () => { clearTimeout(timer); timer = setTimeout(() => { void render(); }, 50); };
 function bind() { controller = createTaskPanelRead({ plugin, component, workspace: cfg.owner, nativeTasks: runtime.nativeTasks, changed: update }); }
 bind();
 const onEdit = edit => { controller.reconcile([], edit); update(); };
 ui = createTaskUi({ app, component, body, mutate: request => controller.actions.mutate(request), onEdit, editTask: (task, saved) => controller.actions.editTask(task, saved), createTask: () => controller.create({ onCreated: update }) }); ui.addButton(heading);
 async function render() { const r = await controller.read(); if (!r) return; if (!ui.beginRender(render)) return; body.empty(); if (r.availability !== "current") { body.createDiv({ text: "Native Project unavailable" }); return; }
  const row = task => { const p = createTaskRow(body, task); p.row.dataset.taskId = task.id; ui.bind(p.row, p.textEl, task, () => "", { sourceLabel: "Private Project" });
   p.checkbox.onchange = async () => { p.checkbox.disabled = true; try { onEdit(await controller.toggle(task, p.checkbox.checked)); } catch (e) { new api.Notice(e.message); p.checkbox.checked = task.completed; p.checkbox.disabled = false; } }; };
  const groups = ui.groups(r.tasks); groups.active.forEach(row); ui.group("future", groups.future, row); ui.group("completed", groups.completed, row); controller.accept(r.tasks);
 }
 const delay = ms => new Promise(r => setTimeout(r, ms));
 async function wait(fn, label) { for (let n = 0; n < 160; n++) { if (await fn()) return; await delay(30); } throw Error("Timed out: " + label + " / " + document.querySelector(".hub-task-error")?.textContent + " / " + body.textContent + " / " + JSON.stringify(await runtime.list())); }
 const find = selector => { const e = document.querySelector(selector); assert(e, "Missing " + selector); return e; };
 const click = selector => find(selector).click();
 const fill = (selector, value) => { const e = find(selector); e.value = value; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); };
 await render(); let start = performance.now(); click("#m1a-root .hub-task-add"); await wait(() => document.querySelector('.modal[aria-label="Add task"]'), "Add modal"); timings.addWindowMs = performance.now() - start;
 fill('textarea[aria-label="Task"]', "Actual Obsidian task"); click('[data-task-property="necessity"]'); click('[role="menuitemradio"][data-value="must"]');
 click('[data-task-property="description"]'); fill('textarea[aria-label="Description"]', "Existing Description field"); click('.hub-task-description-editor .mod-cta');
 click('[data-task-property="due"]'); fill('input[aria-label="Due date"]', "2026-10-20"); click('.hub-task-date-endpoint .mod-cta');
 click('.modal .hub-task-steps-toggle'); fill('textarea[aria-label="New step"]', "Flat Step");
 for (const text of ["Top level", "Step notes", "Continuation", "Parent Step"]) assert(!find('.modal').textContent.includes(text)); checks.push("actual compact modal; no extra native controls");
 await require("electron").ipcRenderer.invoke("m1a-capture","add"); start = performance.now(); click('.hub-task-dialog-actions .mod-cta'); await wait(() => !document.querySelector('.modal[aria-label="Add task"] form, .modal[aria-label="Edit task"] form') && document.querySelector('[data-task-id]'), "created task"); timings.createToListMs = performance.now() - start;
 let task = (await runtime.list()).tasks[0]; const taskId = task.id, stepId = task.steps[0].id; assert.equal(task.description, "Existing Description field"); assert.equal(task.necessity, "must"); assert.equal(task.dueDate, "2026-10-20"); checks.push("actual creation, metadata and civil date");
 await require("electron").ipcRenderer.invoke("m1a-capture","list"); click('[data-task-id] .project-task-text'); await wait(() => document.querySelector('.modal[aria-label="Edit task"]'), "Edit modal"); fill('textarea[aria-label="Task"]', "Edited actual task"); await require("electron").ipcRenderer.invoke("m1a-capture","edit"); click('.hub-task-dialog-actions .mod-cta'); await wait(() => !document.querySelector('.modal[aria-label="Add task"] form, .modal[aria-label="Edit task"] form') && document.querySelector('[data-task-id]')?.textContent.includes("Edited actual task"), "saved edit"); checks.push("actual Edit Save");
 click('#m1a-native .hub-task-steps-toggle'); click('#m1a-native .hub-task-step-item input'); await wait(async () => (await runtime.list()).tasks[0].steps[0].completed, "Step complete"); assert.equal((await runtime.list()).tasks[0].completed, false); checks.push("independent Step completion");
 await delay(150); click('[data-task-id] .project-task-checkbox'); await wait(() => !document.querySelector('[data-task-id]') && document.querySelector('.hub-task-group-toggle'), "completed disclosure"); click('.hub-task-group-toggle'); await wait(() => document.querySelector('[data-task-id]'), "expanded completed"); click('[data-task-id] .project-task-checkbox'); await wait(async () => !(await runtime.list()).tasks[0].completed, "reopened parent"); checks.push("parent complete/reopen with existing disclosure");
 await delay(150); controller.close(); await runtime.close(); runtime = await S.openProjectRuntime(cfg.config, { ...cfg, creating: false }); bind(); await render(); task = (await runtime.list()).tasks[0]; assert.equal(task.id, taskId); assert.equal(task.steps[0].id, stepId); assert.equal(task.steps[0].completed, true); checks.push("host reconstruction retains UUIDs and independent state");
 const legacy = require(lib + "/tests/task-panel-fixture.cjs").createPanelFixture(); const before = legacy.state(); let panels = 0;
 for (const workspace of [{ type: "project", id: "app" }, { type: "resource", id: "study" }]) { const c = createTaskPanelRead({ plugin: legacy.plugin, component, workspace, changed() {}, editTask() {}, nativeTasks: runtime.nativeTasks }); const r = await c.read(); assert(r.tasks.length > 0); const box = host.createDiv(); box.createEl("h3", { text: workspace.type + " - legacy" }); for (const task of r.tasks.slice(0, 2)) createTaskRow(box, task); c.close(); panels++; }
 assert.equal(legacy.state(), before); await legacy.close(); checks.push("actual legacy Project/Resource controllers coexist without native duplication");
 click('[data-task-id] .project-task-text'); await wait(() => document.querySelector('.modal[aria-label="Edit task"]'), "Delete modal"); click('.hub-task-remove'); assert(find('.hub-task-error').textContent.includes("Steps")); click('.hub-task-remove'); await wait(async () => !document.querySelector('.modal[aria-label="Add task"] form, .modal[aria-label="Edit task"] form') && (await runtime.list()).tasks.length === 0, "deleted task"); checks.push("whole-tree deletion via actual confirmation");
 const retained = await runtime.retained(); assert(retained.length >= 6); for (const r of retained) assert.equal((await runtime.reconcile(r.operationId)).state, "committed"); checks.push("durable receipts reconcile after UI mutations");
 assert.equal(runtime.info().history, "unavailable"); assert.equal(runtime.info().statistics, "unavailable"); checks.push("no incomplete combined History/Statistics total");
 clearTimeout(timer); controller.close(); await runtime.close(); component.unload(); Module._load = original;
 return { checks, timings, taskId, stepId, legacyPanels: panels, installedBundleLoaded: false, normalItacanOnloadInvoked: false };
};
