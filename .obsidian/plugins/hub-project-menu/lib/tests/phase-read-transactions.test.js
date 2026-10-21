"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const { fixture } = require("./task-service-fixture.cjs");
const { originalPlanning } = require("./phase-read-fixture.cjs");
const { ProjectPlanningService } = require("../services/project-planning");
const { PhaseTaskRead } = require("../services/phase-task-read");
const phase = { id: "phase-x", name: "Research", start: "2026-10-01", end: "2026-11-01", order: 0, description: "" };
function setup(Constructor) {
    const f = fixture({ metadata: { parent: { phaseId: phase.id } } });
    f.add("Projects/Private/Tasks.md", "- [ ] Parent <!-- hub-task:parent -->\r\n    - [ ] Step <!-- hub-task:child -->\r\n- [ ] Candidate <!-- hub-task:candidate -->\r\n- [ ] ID-less\r\n");
    f.wizard.data.projectPlanning = { private: { revision: 7, phases: [phase], milestones: [] } };
    f.plugin.taskService = f.service; f.plugin.register = () => {}; f.plugin.planning = new Constructor(f.plugin);
    return f;
}
function normalized(f) {
    const snapshot = { ...f.snapshot(), planning: f.wizard.data.projectPlanning };
    const ids = [...new Set([...Object.keys(snapshot.metadata), ...Object.values(snapshot.contents).flatMap(text => [...text.matchAll(/<!-- hub-task:([0-9a-f]{8}-[0-9a-f-]{27}) -->/gi)].map(match => match[1]))])]
        .filter(id => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id));
    let result = JSON.stringify(snapshot); ids.forEach((id, index) => { result = result.replaceAll(id, "generated-" + index); });
    return JSON.parse(result);
}
for (const operation of ["assign", "remove", "mixed", "noop", "idless", "metadata-failure", "source-failure", "rollback-failure"]) test("original/new Phase transaction parity: " + operation, async t => {
    const direct = setup(originalPlanning()), next = setup(ProjectPlanningService), draft = new PhaseTaskRead(next.plugin.planning, "private", phase.id);
    t.after(async () => { draft.close(); await direct.close(); await next.close(); });
    const dv = f => ({ pages: () => ({ array: () => [...f.pages.values()] }) });
    const oldTasks = direct.plugin.planning.tasks(dv(direct), "private"); await draft.refresh();
    const deltas = [];
    if (["remove", "mixed"].includes(operation)) { deltas.push({ task: oldTasks[0], included: false }); draft.remove("parent"); }
    if (["assign", "mixed"].includes(operation)) { deltas.push({ task: oldTasks[1], included: true }); assert(draft.add(draft.pickerItems().find(task => task.hubTaskId === "candidate"))); }
    if (["idless", "metadata-failure", "source-failure", "rollback-failure"].includes(operation)) {
        deltas.push({ task: oldTasks[2], included: true }); assert(draft.add(draft.pickerItems().find(task => !task.hubTaskId)));
    }
    for (const f of [direct, next]) {
        if (["metadata-failure", "rollback-failure"].includes(operation)) f.state.failMetadata = true;
        if (operation === "source-failure") f.state.failWrite = true;
        if (operation === "rollback-failure") f.state.failRollback = true;
    }
    const assignments = await draft.assignments(); draft.freeze();
    const oldResult = await direct.plugin.planning.savePhase("private", phase, deltas, 7).then(value => ({ value }), error => ({ error: error.message }));
    const result = await next.plugin.planning.savePhase("private", phase, assignments, 7).then(value => ({ value }), error => ({ error: error.message }));
    assert.deepEqual(result, oldResult); assert.deepEqual(normalized(next), normalized(direct));
    assert.deepEqual(next.state, direct.state); assert.equal(next.wizard.completedTaskHistory.length, 0); assert.equal(next.wizard.completedTaskChecks.length, 0);
    if (operation.endsWith("failure")) { assert(result.error); assert(draft.additions.size); }
});
test("two editor revisions cannot overwrite a successful newer assignment", async t => {
    const f = setup(ProjectPlanningService), a = new PhaseTaskRead(f.plugin.planning, "private", phase.id), b = new PhaseTaskRead(f.plugin.planning, "private", phase.id);
    t.after(async () => { a.close(); b.close(); await f.close(); }); await Promise.all([a.refresh(), b.refresh()]);
    b.add(b.pickerItems().find(task => task.hubTaskId === "candidate")); await f.plugin.planning.savePhase("private", phase, await b.assignments(), 7);
    const before = normalized(f); a.remove("parent");
    await assert.rejects(f.plugin.planning.savePhase("private", phase, await a.assignments(), 7), /changed in another editor/);
    assert.deepEqual(normalized(f), before); assert(a.removals.has("parent"));
});
test("membership/owner drift and copied task IDs reject before existing Phase transactions write", async t => {
    const f = setup(ProjectPlanningService), draft = new PhaseTaskRead(f.plugin.planning, "private", phase.id);
    t.after(async () => { draft.close(); await f.close(); }); await draft.refresh();
    const task = draft.pickerItems().find(task => task.hubTaskId === "candidate"); draft.add(task);
    f.wizard.data.taskMetadata.candidate = { phaseId: "external" }; await assert.rejects(draft.assignments(), /phase changed/);
    delete f.wizard.data.taskMetadata.candidate;
    f.move(f.files.get(task.path), "Resources/Knowledge/Moved.md"); f.flush(); await assert.rejects(draft.assignments(), /inside this Project/);
    f.add("Projects/Private/Copy.md", "- [ ] Candidate <!-- hub-task:candidate -->\n"); await assert.rejects(draft.assignments(), { code: "AMBIGUOUS_REFERENCE" });
    assert.equal(f.state.writes, 0);
});
