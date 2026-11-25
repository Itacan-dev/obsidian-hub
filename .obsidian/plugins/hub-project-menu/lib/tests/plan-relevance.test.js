"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { derivePlanRelevance, sameOrInside } = require("../domain/plan-relevance");
const { PlanRelevance } = require("../services/plan-relevance");

const project = id => ({ type: "project", id });
const owner = project("one"), other = project("two"), resource = { type: "resource", id: "knowledge" };
const nativeTask = (id, path, completed = false, authorityId = "test") => ({
    id, completed, location: path, nativeReference: { authorityId, taskId: id, owner }
});
const taskEntry = task => ({ kind: "task", reference: task.nativeReference });
const fileEntry = (path, intendedContext) => ({ kind: "file", reference: { path }, intendedContext });
const workspaceEntry = reference => ({ kind: "workspace", reference });
const plan = (...entries) => ({ id: "current", content: { entries } });
const current = (entry, data) => ({ entry, availability: "current", ...data });

test("relevance follows actual paths and keeps a single direct state", () => {
    const explicit = fileEntry("Resources/K/Shared/Long.md", owner);
    const selected = nativeTask("planned", explicit.reference.path);
    const direct = workspaceEntry(resource), standalone = workspaceEntry(other);
    const view = derivePlanRelevance(plan(explicit, taskEntry(selected), direct, standalone), [
        current(explicit, { file: { path: explicit.reference.path } }), current(taskEntry(selected), { task: selected }),
        current(direct), current(standalone)
    ], null, {
        fileOwner: () => resource,
        intendedProject: (ref, path) => sameOrInside(path, "Resources/K/Shared") ? ref : null,
        taskLocation: task => ({ path: task.location })
    });
    assert.equal(view.workspace(resource).level, "direct");
    assert.equal(view.workspace(owner).description, "Leads to 1 unfinished planned task and 1 planned file in an attached folder");
    assert.equal(view.workspace(other).level, "direct");
    assert.equal(view.workspaceRank(project("unrelated")), 2);
    assert.equal(view.path(explicit.reference.path).level, "direct");
    assert.equal(view.path("Resources/K/Shared").level, "indirect");
    assert.equal(view.path("Resources/K/Shared/Sibling.md"), null);
    assert.deepEqual(view.locations, [explicit.reference.path], "One path represents both the file and its planned task");
    assert(Object.isFrozen(view.locations));
    assert.equal(sameOrInside("Resources/K/Shared2/Other.md", "Resources/K/Shared"), false);
});

test("completion clears task-derived routes and reopening restores Plan position", () => {
    const original = nativeTask("one", "Projects/One/Folder/Task.md");
    const sworn = nativeTask("two", "Projects/One");
    const third = nativeTask("three", "Projects/One/Moved");
    const foreign = nativeTask("one", null, false, "other-authority");
    const active = plan(taskEntry(original), taskEntry(third), taskEntry(sworn));
    const build = first => derivePlanRelevance(active, [first, third, sworn].map(task =>
        current(taskEntry(task), { task })), { tasks: [sworn.nativeReference] }, {
        taskLocation: task => ({ path: task.location })
    });
    const completed = { ...original, completed: true };
    const before = build(completed);
    assert.equal(before.path(original.location), null);
    assert.deepEqual(before.locations, [third.location, sworn.location]);
    assert.equal(before.path("Projects/One/Moved").level, "indirect");
    assert.deepEqual(before.partition([third, foreign, sworn, completed]), {
        prioritized: [sworn, third], ordinary: [foreign, completed]
    });
    const after = build(original);
    assert.deepEqual(after.order([foreign, third, sworn, original]), [sworn, original, third, foreign]);
    const wrapped = [foreign, third, sworn, original].map(task => ({ task, owner }));
    assert.deepEqual(after.partition(wrapped), { prioritized: [wrapped[2], wrapped[3], wrapped[1]], ordinary: [wrapped[0]] });
    assert.equal(after.path(original.location).level, "indirect");
    assert.deepEqual(after.locations, [original.location, third.location, sworn.location]);
});

test("a delayed reference read cannot republish an outgoing Plan after a handoff", async () => {
    const entry = workspaceEntry(owner);
    let active = plan(entry), resolveRead;
    const service = Object.assign(Object.create(PlanRelevance.prototype), {
        generation: 0, listeners: new Set(), snapshot: derivePlanRelevance(active, [], null),
        plugin: { app: { vault: { getAbstractFileByPath: () => ({}) } } },
        plan: { active: () => active, references: { resolve: () => new Promise(resolve => { resolveRead = resolve; }) } }
    });
    const pending = service.refresh();
    active = { ...plan(), id: "replacement" };
    service.invalidate();
    resolveRead([current(entry, { context: { path: "Projects/One/One.md" } })]);
    await pending;
    assert.equal(service.snapshot.planId, "replacement");
    assert.equal(service.snapshot.workspace(owner), null);
});

test("startup note indexing does not rescan Projects and still recognizes workspace metadata changes", () => {
    const events = new Map(), cleanup = [];
    const track = (prefix, names) => ({
        on(event, callback) { events.set(prefix + event, callback); },
        offref() {},
        ...names
    });
    const dashboard = { path: "Projects/One/One.md", type: "project" };
    let scans = 0;
    const service = new PlanRelevance({
        globalPlan: { active: () => null, subscribe() {} },
        app: {
            vault: track("vault:", {
                getMarkdownFiles: () => [dashboard],
                getAbstractFileByPath: path => path === dashboard.path ? dashboard : null
            }),
            metadataCache: track("metadata:", { getFileCache: file => ({ frontmatter: { type: file.type } }) })
        },
        projectWizard: {
            getProjectRecords() { scans++; return [{ path: dashboard.path }]; },
            getResourceTypes: () => [],
            getContextForPath() { scans++; return null; }
        },
        registerEvent() {},
        register(callback) { cleanup.push(callback); }
    });
    try {
        const changed = events.get("metadata:changed");
        const initialScans = scans, initialGeneration = service.generation;
        for (let i = 0; i < 1500; i++) changed({ path: "Notes/" + i + ".md" });
        assert.equal(scans, initialScans, "ordinary note events must not request Project inventory");
        assert.equal(service.generation, initialGeneration);
        changed(dashboard);
        dashboard.type = undefined;
        changed(dashboard);
        assert.equal(service.generation, initialGeneration + 2, "dashboard edits and removal of its type invalidate relevance");
        changed(dashboard);
        assert.equal(service.generation, initialGeneration + 2, "a former dashboard now follows ordinary note behavior");
    } finally {
        for (const dispose of cleanup) dispose();
    }
});

test("Home sorts by Plan tier within each status, preserving the selected sort within tiers", () => {
    const source = readFileSync(path.resolve(__dirname, "../../../../../System/Dashboards/Home/view.js"), "utf8");
    const start = source.indexOf("    const visibleProjects =", source.indexOf("function renderProjects(status)"));
    const end = source.indexOf("    if (visibleProjects.length === 0)", start);
    const sort = new Function("projects", "status", "mode", "projectCardOrder", "planTier",
        "projectCardKey", "rememberProjectCardOrder", "window", "projectSortCollator",
        "displayProjectName", "projectCategory", source.slice(start, end) + "\nreturn visibleProjects;");
    const projects = [
        { projectId: "one", name: "Beta", categoryId: "B" },
        { projectId: "two", name: "Charlie", categoryId: "A" },
        { projectId: "three", name: "Alpha", categoryId: "C" },
        { projectId: "four", name: "Aardvark" },
        { projectId: "future", name: "Aardvark", status: "future" },
        { projectId: "shelved", name: "Aardvark", status: "shelved" }
    ].map(p => ({ status: "active", ...p }));
    const direct = workspaceEntry(owner), directThree = workspaceEntry(project("three"));
    const indirectFile = fileEntry("Projects/Two/One.md");
    const snapshot = derivePlanRelevance(plan(direct, directThree, indirectFile), [
        current(direct), current(directThree), current(indirectFile, { file: { path: indirectFile.reference.path } })
    ], null, { fileOwner: () => other, intendedProject: () => null });
    const custom = { active: ["four", "one", "two", "three"], future: ["future"], shelved: ["shelved"] };
    const original = structuredClone(custom);
    let writes = 0;
    const order = (mode, status = "active", relevance = snapshot) => sort(projects, status, mode, custom,
        item => relevance.workspaceRank(project(item.projectId)), item => item.projectId, () => writes++,
        { hubGetRecentWorkspaceIds: () => ["two", "three", "four"] }, new Intl.Collator(), name => name, name => ({ name })
    ).map(item => item.projectId);
    assert.deepEqual(order("custom"), ["one", "three", "two", "four"]);
    assert.deepEqual(order("name"), ["three", "one", "two", "four"]);
    assert.deepEqual(order("recent"), ["three", "one", "two", "four"]);
    assert.deepEqual(order("category"), ["one", "three", "two", "four"]);
    assert.deepEqual(order("custom", "future"), ["future"]);
    assert.deepEqual(order("custom", "shelved"), ["shelved"]);
    assert.deepEqual(order("custom", "active", derivePlanRelevance(null, [], null)), original.active);
    assert.deepEqual(order("name", "active", derivePlanRelevance(null, [], null)), ["four", "three", "one", "two"]);
    assert.equal(writes, 0);
    assert.deepEqual(custom, original);
});
