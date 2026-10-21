"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createSearchFixture, summarize, enrichSearchFixture } = require("./context-search-fixture.cjs");
const baseline = require("./context-search-parity.json");
const extraBaseline = require("./context-search-extra-parity.json");
const { ContextSearchService } = require("../services/context-search");
const { createLegacyTaskService } = require("../services/task-service-host");
const flat = groups => groups.flatMap(group => group.items);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function setup(t, options) {
    const f = createSearchFixture();
    const service = new ContextSearchService(f.plugin, { onTaskDiagnostics: items => f.diagnostics.push(...items), ...options?.(f) });
    t.after(() => f.close()); return { ...f, service };
}
function delayedService(f, requests) {
    return { capabilities: () => f.plugin.taskService.capabilities(), subscribe: fn => f.plugin.taskService.subscribe(fn),
        resolveReveal: handle => f.plugin.taskService.resolveReveal(handle), queryDisplay: () => { const request = deferred(); requests.push(request); requests.onRequest?.(request); return request.promise; } };
}

test("all 18 actual pre-integration Search result sets retain exact ranking, order, scope and display", async t => {
    const f = setup(t), before = f.state();
    for (const entry of baseline.cases) {
        const owner = f.workspaces.find(item => item.projectId === entry.workspace) ?? null;
        assert.deepEqual(summarize(await f.service.search(entry.query, owner, f.dv)), entry.groups, `${entry.query} / ${entry.workspace}`);
    }
    assert.equal(f.counts.sources, 0, "Display enumeration never reads Markdown sources");
    assert.equal(f.counts.indexes, baseline.counts.indexes); assert.equal(f.counts.writes, 0); assert.equal(f.state(), before);
    const result = flat(await f.service.search("zephyr", f.projects[0], f.dv)).find(item => item.kind === "tasks");
    await f.service.open(result, null); assert.deepEqual(f.calls.at(-1), baseline.taskReveal);
    assert.equal(f.counts.sources, 1, "Reveal validates the actual source");
});

test("display projection separates canonical title, continuations, description and Steps", async t => {
    const f = setup(t), before = f.state(), query = await f.plugin.taskService.queryDisplay();
    const row = query.rows.find(row => row.view?.handle?.identity?.value === "experiment");
    assert.equal(row.view.title, "Read experiment");
    assert.equal(row.view.compatibility.displayText, "Read experiment\ncontinuation zephyr evidence");
    assert.equal(row.view.compatibility.searchText, row.view.compatibility.displayText);
    assert.equal(row.view.description, "description-only cobalt"); assert(!row.view.compatibility.searchText.includes("tungsten"));
    assert.deepEqual(JSON.parse(JSON.stringify(query)), query); assert.equal(row.view.capabilities.edit, false);
    assert.equal("block" in row.view, false); assert.equal("file" in row.view, false);
    assert.equal(f.state(), before); assert.equal(f.counts.sources + f.counts.writes, 0);
});

test("copied parent and Step identities remain displayable, diagnostic and blocked", async t => {
    const f = setup(t);
    f.addTask("Projects/App/Meta/Copied.md", "Copied evidence", "copied", { metadata: { description: "Unsafe alias metadata", dueDate: "2026-10-31" } });
    f.addTask("Projects/Itacan/Meta/Copied.md", "Copied evidence", "copied");
    const query = await f.plugin.taskService.queryDisplay(), copies = query.rows.filter(row => row.view?.handle?.identity?.value === "copied");
    assert.equal(copies.length, 2);
    for (const row of copies) { assert.equal(row.state, "ambiguous"); assert.equal(row.view.capabilities.attemptReveal, false);
        assert.equal(row.view.due, null); assert.equal(row.view.description, ""); }
    const results = flat(await f.service.search("evidence", null, f.dv)).filter(result => result.kind === "tasks");
    assert(results.some(result => result.taskHandle?.identity?.value === "experiment"), "Unrelated healthy row survives");
    for (const result of results.filter(result => result.taskHandle?.identity?.value === "copied")) {
        await assert.rejects(f.service.open(result, null), error => error.code === "AMBIGUOUS_REFERENCE" && !error.message.includes("hub-task"));
    }
    assert.equal(f.calls.length, 0);
    const handle = copies[0].view.handle;
    await assert.rejects(f.plugin.taskService.getTask(handle), error => error.code === "AMBIGUOUS_REFERENCE", "Strict queries retain their safeguards");
    f.addTask("Resources/Research/Meta/Copy.md", "Another parent", "another", { steps: [{ title: "Copied Step", id: "step" }] });
    const experiment = (await f.plugin.taskService.queryDisplay()).rows.find(row => row.view?.handle?.identity?.value === "experiment");
    assert.equal(experiment.state, "ambiguous"); assert.equal(f.counts.writes, 0);
});

test("unassigned duplicate titles and broken locators never gain fabricated identities", async t => {
    const f = setup(t);
    f.addTask("Projects/App/Meta/Duplicates.md", "Same locator"); f.addTask("Projects/App/Meta/Duplicates.md", "Same locator");
    const rows = (await f.plugin.taskService.queryDisplay()).rows.filter(row => row.view?.title === "Same locator");
    assert.equal(rows.length, 2); assert(rows.every(row => row.state === "ambiguous" && row.view.handle.identity === null && !row.view.capabilities.attemptReveal));
    assert.equal(f.counts.writes, 0);
});

test("row conversion and missing source failures retain other rows with explicit diagnostics", async t => {
    const f = setup(t);
    const canonical = f.plugin.taskData.readPages(f.dv).flatMap(page => page.file.tasks);
    const healthy = canonical.find(task => task.hubTaskId === "experiment"), missing = { ...healthy, path: "Projects/App/Meta/Missing.md", hubTaskId: "missing", text: "Missing display evidence", steps: [] };
    const throws = { get path() { throw Error("Broken index value"); } };
    f.plugin.taskData.readPages = () => [{ file: { tasks: [healthy, missing, null, { ...healthy, line: "bad", hubTaskId: null, steps: [] }, throws] } }];
    const result = await f.plugin.taskService.queryDisplay();
    assert.equal(result.rows.length, 5); assert.equal(result.rows[0].state, "indexed");
    assert.equal(result.rows[1].state, "unresolved"); assert.equal(result.rows[1].view.compatibility.displayText, "Missing display evidence");
    assert.equal(result.rows[1].view.capabilities.attemptReveal, false);
    assert.equal(result.rows[2].view, null); assert.equal(result.rows[4].view, null);
    assert(result.diagnostics.some(item => item.code === "ROW_CONVERSION_FAILED"));
    assert(result.diagnostics.some(item => item.code === "INVALID_REFERENCE"));
    const matches = flat(await f.service.search("evidence", null, f.dv)).filter(item => item.kind === "tasks");
    assert(matches.some(item => item.task.title === "Read experiment")); assert(matches.some(item => item.title === "Missing display evidence"));
});

test("query-level index errors keep file/planning search and use friendly status plus diagnostics", async t => {
    const f = setup(t), statuses = [];
    f.plugin.taskData.readPages = () => { throw Error("Private technical stack detail"); };
    const results = flat(await f.service.search("Prototype", f.projects[0], f.dv, { onTaskStatus: message => statuses.push(message) }));
    assert(results.some(item => item.kind === "phases")); assert.equal(statuses[0], "Task search is temporarily unavailable.");
    assert.equal(f.diagnostics[0].level, "query"); assert.match(f.diagnostics[0].message, /Private technical/);
    f.dv.index.initialized = false;
    await f.service.search("roadmap", null, f.dv, { onTaskStatus: message => statuses.push(message) });
    assert.equal(statuses.at(-1), "Task search is not ready yet."); assert.equal(f.counts.writes, 0);
});

test("unchanged queries share one projection; facade invalidation keeps file/note caches", async t => {
    const f = setup(t);
    await f.service.search("mercury", null, f.dv); const before = { ...f.counts };
    await f.service.search("roadmap", null, f.dv); await f.service.search("zephyr", null, f.dv);
    assert.equal(f.counts.indexes, before.indexes); assert.equal(f.counts.files, before.files); assert.equal(f.counts.notes, before.notes);
    f.plugin.taskData.invalidateAll(); f.flush(); await f.service.search("plan", null, f.dv);
    assert.equal(f.counts.indexes, before.indexes + 1); assert.equal(f.counts.files, before.files); assert.equal(f.counts.notes, before.notes);
    assert.equal(f.plugin.taskData.subscribers.size, 1); assert.equal(f.counts.sources, 0);
});

test("older asynchronous reads cannot overwrite a new query or a newer invalidation generation", async t => {
    const requests = []; const f = setup(t, fixture => ({ taskService: delayedService(fixture, requests) }));
    const original = await f.plugin.taskService.queryDisplay(); let generation = 1; const shown = [];
    const a = f.service.search("Read", f.projects[0], f.dv, { cancelled: () => generation !== 1, onNames: groups => shown.push(["A", summarize(groups)]) });
    await Promise.resolve(); assert.equal(requests.length, 1);
    generation = 2; f.plugin.taskData.invalidateAll(); f.flush();
    const b = f.service.search("plan", f.projects[0], f.dv, { cancelled: () => generation !== 2, onNames: groups => shown.push(["B", summarize(groups)]) });
    await Promise.resolve(); assert.equal(requests.length, 2);
    requests[1].resolve(original); const newest = await b;
    requests[0].resolve(original); assert.deepEqual(await a, []);
    assert(shown.every(([name]) => name === "B")); assert(flat(newest).some(item => item.title === "No identity plan"));
    const cached = await f.service.search("plan", f.projects[0], f.dv); assert.equal(requests.length, 2); assert.deepEqual(cached, newest);
});

test("scope changes and disposal during an outstanding query suppress callbacks and late cache publication", async t => {
    const requests = []; const f = setup(t, fixture => ({ taskService: delayedService(fixture, requests) }));
    const projection = await f.plugin.taskService.queryDisplay(), scope = { ...f.projects[0] }; let shown = 0;
    const pending = f.service.search("plan", scope, f.dv, { onNames: () => shown++ }); await Promise.resolve();
    scope.projectId = "other"; requests[0].resolve(projection); assert.deepEqual(await pending, []); assert.equal(shown, 0);
    f.plugin.taskData.invalidateAll(); f.flush();
    const closed = f.service.search("plan", null, f.dv, { onNames: () => shown++ }); await Promise.resolve();
    await f.close(); requests[1].resolve(projection); assert.deepEqual(await closed, []); assert.equal(shown, 0); assert.equal(f.service.tasks, null);
});

test("invalidation while reading note content prevents obsolete final results", async t => {
    const f = setup(t), wait = deferred(), entered = deferred();
    const cachedRead = f.vault.cachedRead;
    f.vault.cachedRead = async file => { entered.resolve(); await wait.promise; return cachedRead(file); };
    const pending = f.service.search("mercury", f.projects[0], f.dv); await entered.promise;
    f.plugin.taskData.invalidateAll(); f.flush(); wait.resolve(); assert.deepEqual(await pending, []);
    assert(flat(await f.service.search("mercury", f.projects[0], f.dv)).some(item => item.kind === "notes"));
});

test("final reveal rejects source changes and duplicate IDs even if display enumeration was healthy", async t => {
    const f = setup(t);
    let result = flat(await f.service.search("zephyr", f.projects[0], f.dv)).find(item => item.kind === "tasks");
    const path = result.path, before = f.contents.get(path);
    f.contents.set(path, before + "- [ ] Read experiment <!-- hub-task:experiment -->\n");
    await assert.rejects(f.service.open(result, null), error => error.code === "AMBIGUOUS_REFERENCE"); assert.equal(f.calls.length, 0);
    f.contents.set(path, before); result = flat(await f.service.search("No identity plan", f.projects[0], f.dv)).find(item => item.kind === "tasks");
    f.contents.set(path, "Added heading\n" + before);
    await assert.rejects(f.service.open(result, null), error => error.code === "STALE_REFERENCE"); assert.equal(f.calls.length, 0);
    assert.equal(f.counts.writes, 0);
});

test("reveal follows an indexed moved task and continues to respect denied workspace navigation", async t => {
    const f = setup(t), result = flat(await f.service.search("zephyr", null, f.dv)).find(item => item.kind === "tasks");
    const old = result.path, next = "Resources/Knowledge/Mounted/Moved.md", file = f.files.get(old), page = f.pages.get(old), text = f.contents.get(old);
    f.files.delete(old); f.contents.delete(old); f.pages.delete(old); file.path = next; page.file.path = next;
    f.files.set(next, file); f.contents.set(next, text); f.pages.set(next, page); f.vault.emit("rename", file, old);
    await f.service.open(result, null); assert.equal(f.calls.at(-1)[1], next);
    f.plugin.workspaceModes.openProjectNote = async () => false;
    assert.equal(await f.service.open(result, null), false);
    f.files.delete(next); await assert.rejects(f.service.open(result, null), error => error.code === "SOURCE_MISSING");
});

test("unsupported native reveal and close during reveal fail safely without a synthetic path", async t => {
    const wait = deferred(); let native = true;
    const f = setup(t, fixture => ({ taskService: { capabilities: () => fixture.plugin.taskService.capabilities(), subscribe: fn => fixture.plugin.taskService.subscribe(fn),
        queryDisplay: () => fixture.plugin.taskService.queryDisplay(), resolveReveal: async () => native ? { kind: "native-task", id: "future" } : wait.promise } }));
    const result = flat(await f.service.search("zephyr", null, f.dv)).find(item => item.kind === "tasks");
    await assert.rejects(f.service.open(result, null), error => error.code === "UNSUPPORTED" && !error.message.includes("native"));
    assert.equal(f.calls.length, 0); native = false; let closed = false;
    const pending = f.service.open(result, null, { cancelled: () => closed }); closed = true;
    wait.resolve({ kind: "legacy-source", path: result.path }); assert.equal(await pending, false); assert.equal(f.calls.length, 0);
});

test("host selects one lazy legacy backend and releases only its owned watcher", async t => {
    const f = createSearchFixture(); t.after(() => f.close()); await f.plugin.taskService.close();
    f.plugin.app.plugins = { plugins: {} };
    f.plugin.taskService = createLegacyTaskService(f.plugin);
    await assert.rejects(f.plugin.taskService.queryDisplay(), error => error.code === "INDEX_UNAVAILABLE");
    f.plugin.app.plugins.plugins.dataview = { api: f.dv };
    const search = new ContextSearchService(f.plugin); assert.equal(search.taskService, f.plugin.taskService);
    await search.search("plan", null, f.dv); assert.equal(f.plugin.taskData.subscribers.size, 1);
    const off = f.plugin.taskData.subscribe({ register() {} }, () => {});
    await f.plugin.taskService.close(); assert.equal(f.plugin.taskData.subscribers.size, 1); off();
    assert.equal(f.plugin.taskData.events.length, 0); assert.equal(f.counts.writes, 0);
});

test("raw malformed Dataview rows and children do not suppress healthy rows; strict reads stay strict", async t => {
    const f = setup(t), page = f.pages.get("Projects/App/Meta/Tasks.md");
    page.file.tasks.push(null, { line: 80, text: 42, children: [], task: true });
    page.file.tasks[0].children.push(null);
    const cyclic = { line: 90, text: "Cyclic", task: true, children: [] }; cyclic.children.push(cyclic); page.file.tasks.push(cyclic);
    const query = await f.plugin.taskService.queryDisplay();
    assert(query.rows.some(row => row.view?.handle?.identity?.value === "experiment"));
    assert(query.rows.some(row => row.view?.handle?.identity?.value === "roadmap"));
    assert(query.diagnostics.some(item => item.code === "ROW_INDEX_FAILED"));
    assert(query.rows.some(row => row.state === "invalid" && row.view === null));
    const matches = flat(await f.service.search("zephyr", f.projects[0], f.dv));
    assert(matches.some(item => item.kind === "tasks" && item.task.title === "Read experiment"));
    assert.throws(() => f.plugin.taskData.readPages(f.dv), "Existing strict read still rejects malformed source index data");
    assert.equal(f.counts.writes + f.counts.sources, 0);
});

test("one unavailable effective metadata record preserves its display and other healthy tasks", async t => {
    const f = setup(t), metadata = f.plugin.taskData.metadata;
    f.plugin.taskData.metadata = id => { if (id === "experiment") throw Error("Synthetic metadata unavailable"); return metadata(id); };
    const query = await f.plugin.taskService.queryDisplay(), row = query.rows.find(row => row.view?.handle?.identity?.value === "experiment");
    assert.equal(row.state, "unresolved"); assert.equal(row.view.capabilities.attemptReveal, false);
    assert.equal(row.view.compatibility.displayText, "Read experiment\ncontinuation zephyr evidence");
    assert(row.diagnostics.some(item => item.code === "METADATA_UNAVAILABLE"));
    assert(query.rows.some(row => row.view?.handle?.identity?.value === "roadmap" && row.state === "indexed"));
    assert.throws(() => f.plugin.taskData.readPages(f.dv), /Synthetic metadata/);
});

test("facade closure keeps non-task Search results and reports a typed query diagnostic", async t => {
    const f = setup(t), statuses = [];
    await f.plugin.taskService.close();
    const results = flat(await f.service.search("roadmap", null, f.dv, { onTaskStatus: message => statuses.push(message) }));
    assert(results.some(item => item.kind === "files")); assert(!results.some(item => item.kind === "tasks"));
    assert(f.diagnostics.some(item => item.code === "CLOSED")); assert.equal(statuses[0], "Task search is temporarily unavailable.");
});

test("multiple Search surfaces share the service; subscriber failures and repeated disposal do not leak", async t => {
    const f = setup(t); let healthy = 0;
    const component = () => { const cleanup = []; return { register: fn => cleanup.push(fn), unload: () => cleanup.splice(0).forEach(fn => fn()) }; };
    const bad = component(), good = component();
    f.service.subscribe(bad, () => { throw Error("UI subscriber failure"); });
    f.service.subscribe(good, () => healthy++);
    f.plugin.taskData.invalidateAll(); f.flush(); assert.equal(healthy, 1);
    assert.equal(f.plugin.taskData.subscribers.size, 1);
    for (let i = 0; i < 20; i++) { const surface = component(); f.service.subscribe(surface, () => {}); surface.unload(); }
    assert.equal(f.service.listeners.size, 2); bad.unload(); good.unload(); assert.equal(f.service.listeners.size, 0);
    assert.equal(f.plugin.taskData.subscribers.size, 1, "The shared service owns its single lifetime subscription");
});

for (const operation of ["rename", "delete"]) test(`${operation} during an outstanding read invalidates the old projection before publication`, async t => {
    const requests = []; const f = setup(t, fixture => ({ taskService: delayedService(fixture, requests) }));
    const restarted = deferred(); requests.onRequest = request => { if (requests.length === 2) restarted.resolve(request); };
    const old = await f.plugin.taskService.queryDisplay();
    const pending = f.service.search("roadmap", null, f.dv); await Promise.resolve();
    const original = "Projects/App/Meta/ROADMAP.md", file = f.files.get(original); f.files.delete(original);
    if (operation === "rename") {
        const next = "Projects/App/Meta/Renamed Roadmap.md", page = f.pages.get(original), text = f.contents.get(original);
        file.path = next; page.file.path = next; f.files.set(next, file); f.pages.delete(original); f.pages.set(next, page);
        f.contents.delete(original); f.contents.set(next, text); f.vault.emit("rename", file, original);
    } else f.vault.emit("delete", file);
    requests[0].resolve(old);
    // The request repeats against the new generation instead of publishing old data.
    const next = await restarted.promise; next.resolve(await f.plugin.taskService.queryDisplay());
    const results = flat(await pending); assert(!results.some(item => item.path === original));
    if (operation === "rename") assert(results.some(item => item.kind === "tasks" && item.path === file.path));
    assert.equal(f.counts.writes, 0);
});

test("supplemental baseline preserves mixed categories, importance/Phase tasks, copied IDs and moved sources", async t => {
    const f = enrichSearchFixture(createSearchFixture()), service = new ContextSearchService(f.plugin, { onTaskDiagnostics: items => f.diagnostics.push(...items) });
    t.after(() => f.close()); const before = f.state();
    for (const entry of extraBaseline.cases) assert.deepEqual(summarize(await service.search(entry.query,
        f.workspaces.find(item => item.projectId === entry.workspace) ?? null, f.dv)), entry.groups, `${entry.query}/${entry.workspace}`);
    const mixed = flat(await service.search("Prototype", f.projects[0], f.dv));
    for (const kind of ["files", "folders", "tasks", "phases", "milestones"]) assert(mixed.some(item => item.kind === kind));
    assert.equal(f.counts.sources + f.counts.writes, 0); assert.equal(f.state(), before);
    const phaseTask = mixed.find(item => item.kind === "tasks").taskHandle;
    const dto = await f.plugin.taskService.getTask(phaseTask);
    assert.equal(dto.importance, "should"); assert.deepEqual(dto.phase, { projectId: "app", phaseId: "phase" });
    assert.deepEqual(dto.due, { date: "2026-10-31", time: null }); assert.equal(f.state(), before);
});

test("nested Step text stays separate from parent display/search text", async t => {
    const f = setup(t), path = "Projects/App/Meta/Nested.md";
    const parent = f.addTask(path, "Parent literal", "nested-parent", { steps: [{ title: "Child literal", id: "nested-child" }] });
    const child = parent.children[0], line = f.contents.get(path).split("\n").length - 1;
    const nested = { path, line, text: "nested-exclusive quartz <!-- hub-task:nested-step -->", completed: false, task: true, parent: child.line, children: [] };
    child.children.push(nested); f.pages.get(path).file.tasks.push(nested); f.pages.get(path).file.lists.push(nested);
    f.contents.set(path, f.contents.get(path) + `        - [ ] ${nested.text}\n`);
    const projection = (await f.plugin.taskService.queryDisplay()).rows.filter(row => row.view?.source?.path === path);
    assert.equal(projection.length, 1); assert.equal(projection[0].view.compatibility.searchText, "Parent literal");
    const results = flat(await f.service.search("nested-exclusive", f.projects[0], f.dv));
    assert(!results.some(item => item.kind === "tasks")); assert(results.some(item => item.kind === "notes")); assert.equal(f.counts.writes, 0);
});

test("concurrent Project and Resource Search surfaces share one read without cancelling each other", async t => {
    const f = setup(t);
    const [project, resource] = await Promise.all([f.service.search("plan", f.projects[0], f.dv), f.service.search("plan", f.resources[0], f.dv)]);
    assert(flat(project).some(item => item.title === "No identity plan"));
    assert(flat(resource).some(item => item.title === "Mounted resource plan"));
    assert(flat(project).every(item => item.path.startsWith("Projects/App/")));
    assert(flat(resource).every(item => item.path.startsWith("Resources/Knowledge/")));
    assert.equal(f.counts.indexes, 1); assert.equal(f.plugin.taskData.subscribers.size, 1); assert.equal(f.counts.writes, 0);
});
