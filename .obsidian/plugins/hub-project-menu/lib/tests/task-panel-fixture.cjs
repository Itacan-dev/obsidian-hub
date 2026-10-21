"use strict";
const fs = require("node:fs"), path = require("node:path");
const { createReadFixture, taskFacts } = require("./task-read-fixture.cjs");
const { taskGroups } = require("../domain/task-planning");
function createPanelFixture() {
    const f = createReadFixture();
    f.addTask("Resources/Knowledge/Mounted/Notes.md", "Mounted resource", "mounted");
    f.addTask("Projects/App/Nested/Deep/Notes.md", "**Linked** [note](Other.md)\nParagraph\n- ordinary list", "rich", {
        metadata: { description: "Description", necessity: "must", phaseId: "phase", dueDate: "2026-10-25", dueTime: "00:00" },
        steps: [{ title: "Parent **Step**", id: "parent" }, { title: "Nested [Step](Other.md)", id: "nested" }]
    });
    const task = f.pages.get("Projects/App/Nested/Deep/Notes.md").file.tasks[0];
    const nested = task.children.pop(), parent = task.children[0];
    parent.children.push(nested); nested.parent = parent.line;
    // Keep the source consistent with the indexed nesting for action validation.
    f.contents.set(task.path, f.contents.get(task.path).replace("    - [ ] Nested", "        - [ ] Nested"));
    return f;
}
function panelFacts(tasks, now) {
    const groups = taskGroups(tasks, now);
    return { tasks: tasks.map(task => ({ ...taskFacts(task),
        steps: taskFacts(task).steps.map((step, index) => ({ ...step, parent: task.steps[index].parent ?? null })),
        sourceLabel: require("../ui/task-card").taskSourceLabel(task.path), actionable: !task.identityConflict })),
        groups: Object.fromEntries(Object.entries(groups).map(([key, rows]) => [key, rows.map(task => [task.path, task.line])])) };
}
function panelSection(text) {
    const start = text.indexOf("// ---------- CURRENT TASKS ----------"), end = text.indexOf("// ---------- PROGRESS ----------", start);
    if (start < 0 || end < start) throw Error("Actual dashboard Tasks section not found");
    return text.slice(start, end);
}
function originalRead(f, owner, source) {
    const match = source.match(/function readProjectTasks\(\) \{[\s\S]*?\n\}/);
    if (!match) throw Error("Original reader missing");
    return new Function("window", "dv", "projectRoot", match[0] + ";return readProjectTasks();")({ hubTaskData: f.plugin.taskData }, f.dv, owner.root);
}
module.exports = { createPanelFixture, panelFacts, panelSection, originalRead };
if (require.main === module) {
    if (process.argv[2] !== "--record-original") throw Error("Explicit baseline recording required");
    const root = path.resolve(__dirname, "../../../../.."), source = fs.readFileSync(path.join(root, "System/Dashboards/Project/view.js"), "utf8");
    const target = path.join(__dirname, "task-panel-original.cjs"), data = path.join(__dirname, "task-panel-baseline.json");
    if (fs.existsSync(target) || fs.existsSync(data)) throw Error("Refusing to overwrite original evidence");
    const f = createPanelFixture(), before = f.state();
    const baseline = f.workspaces.map(owner => ({ owner: owner.projectId, root: owner.root, facts: panelFacts(originalRead(f, owner, source), f.now()) }));
    if (before !== f.state() || f.counts.writes) throw Error("Baseline read wrote data");
    fs.writeFileSync(target, panelSection(source)); fs.writeFileSync(data, JSON.stringify(baseline, null, 2) + "\n");
    console.log("Captured actual original panel reader and renderer for " + baseline.length + " workspaces (including mounted Project)");
    f.close().catch(error => { throw error; });
}
