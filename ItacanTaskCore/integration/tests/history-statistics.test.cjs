"use strict";
const test = require("node:test"), S = require("./history-support.cjs"), { assert } = S;
const { recordedHistoryQuery } = require(S.lib + "services/task-history-legacy-read"), { queryHistory } = require(S.lib + "domain/history"), { statisticsCompletions } = require(S.lib + "services/statistics");
function models(records, workspaces, now) { const prepared = S.stats.prepareStatistics({ completions: records, workspaces }, now); return { prepared, ranges: S.stats.RANGES.map(([key]) => { const model = S.stats.aggregateStatistics(prepared, key); return { model, tasks: S.stats.seriesFor(model, "tasks", "all"), steps: S.stats.seriesFor(model, "steps", "all") }; }) }; }
test("legacy-only accounted inputs preserve typed IDs, truthy dedup before invalid time/date filtering and all five complete models", async t => {
 const now = Date.now(), rows = [
 { id: 1, timestamp: null, text: "Invalid first", path: "Projects/P/T.md", projectId: "p" },
 { id: 1, timestamp: now - 1000, text: "Shadowed", path: "Projects/P/T.md", projectId: "p" },
 { id: "1", timestamp: now - 1000, text: "Typed distinct", path: "Projects/P/T.md", projectId: "p" },
 { id: 0, timestamp: now - 1000, text: "Falsy A", path: "Projects/P/T.md" },
 { id: 0, timestamp: now - 1000, text: "Falsy B", path: "Projects/P/T.md" },
 { id: "old", timestamp: now - 400 * 86400000, text: "Old", path: "Projects/P/T.md" },
 { id: "old", timestamp: now - 1000, text: "Old shadows new", path: "Projects/P/T.md" },
 { id: false, timestamp: "invalid", text: "Invalid", path: "Projects/P/T.md" } ];
 const f = await S.fixture(t, { records: rows }), actual = await f.read(), expected = statisticsCompletions(recordedHistoryQuery(queryHistory(rows)));
 assert.deepEqual(actual.completions, expected); const input = [{ projectId: "p", name: "P" }]; assert.deepEqual(models(actual.completions, input, now), models(expected, input, now));
 assert(!models(actual.completions, input, now).prepared.completions.some(r => r.id === 1)); assert(models(actual.completions, input, now).prepared.completions.some(r => r.id === "1"));
});
test("fresh native task/Step and null-time activity feed the unchanged complete Statistics calculations", async t => {
 const f = await S.fixture(t), task = await f.create(); await f.complete(task.id, true, task.steps[0].id); await f.complete(task.id, true, null, null);
 const r = await f.read(), source = S.stats.prepareStatistics({ completions: r.completions }, Date.now() + 60000); assert.equal(r.records.length, 2); assert.equal(source.completions.length, 1); assert.equal(source.completions[0].kind, "step");
 for (const [range] of S.stats.RANGES) { const m = S.stats.aggregateStatistics(source, range); assert.equal(S.stats.seriesFor(m, "steps", "all").reduce((a,b)=>a+b,0), 1); assert.equal(S.stats.seriesFor(m, "tasks", "all").reduce((a,b)=>a+b,0), 0); }
});
test("import suppression, native publication and all seven owners retain complete E1/E2 models", async t => {
 const f = await S.imported(t), r = await f.feed.read(), expected = require("../../history/durable-projection").projectDurableHistoryCompatibility(await f.state(), { version: 1, projection: "statistics" }).records;
 const workspaces = S.E.owners.map(o => ({ projectId: o.owner.type === "resource" ? "resource:" + o.owner.id : o.owner.id, contextKind: o.owner.type, name: o.label }));
 assert.deepEqual(models(r.completions, workspaces, S.E.NOW + 2000), models(expected, workspaces, S.E.NOW + 2000));
});
test("native outage makes actual readStatistics fail rather than return a legacy-only total", async t => {
 const f = await S.fixture(t), task = await f.create({ completed: true }); const plugin = { app: { vault: { getMarkdownFiles: () => [] }, metadataCache: { getFileCache: () => null } }, projectWizard: { data: {}, activityLog: [], getProjectRecords: () => [], getResourceTypes: () => [], getProgressReports: () => [] }, taskService: { queryHistory() { throw Error("Must not fall back"); } } };
 const model = await S.readStatistics(plugin, Date.now() + 60000, f.feed); assert.equal(model.completions.length, 1); f.registry.change(r => r.owners[0].available = false);
 await assert.rejects(S.readStatistics(plugin, Date.now() + 60000, f.feed)); assert(task.id);
});
