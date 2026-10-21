"use strict";
const fs = require("node:fs"), path = require("node:path");
const { createPanelFixture, panelFacts } = require("./task-panel-fixture.cjs");
function section(source, start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a);
    if (a < 0 || b < a) throw Error("Missing actual Home section: " + start);
    return source.slice(a, b);
}
function createHomeFixture() {
    const f = createPanelFixture();
    for (const [projectId, name, status, deleted] of [["future", "Future", "future", false], ["deleted", "Deleted", "active", true]]) {
        const owner = { projectId, name, status, deleted, contextKind: "project", root: "Projects/" + name, path: `Projects/${name}/${name}.md` };
        f.projects.push(owner); f.workspaces.push(owner); f.add(owner.path);
        f.addTask(owner.root + "/Tasks.md", name + " task", projectId + "-task");
    }
    for (const owner of f.projects) owner.sourcePath = owner.path;
    for (const resource of f.resources) Object.assign(resource, { id: resource.resourceType, label: resource.name });
    for (const [file, reference, id] of [
        ["Outside/Attributed.md", { path: "Projects/App/App.md" }, "outside"],
        ["Projects/Other/Attributed.md", "[[App|Alias]]", "attributed"],
        ["Resources/Knowledge/Conflict.md", "App", "resource-first"],
        ["Projects/App/Inactive.md", "Other", "inactive-reference"],
        ["System/Templates/Attributed.md", "App", "global-template"],
        [".hidden/Attributed.md", "App", "global-hidden"]
    ]) { f.addTask(file, id, id); f.pages.get(file).project = reference; }
    f.addTask("Outside/Unowned.md", "Unowned", "unowned");
    return f;
}
function originalHome(f, source = fs.readFileSync(path.join(__dirname, "home-read-original.cjs"), "utf8")) {
    const owners = section(source, "function projectFromReference(", "// ---------- PROJECT TABS ----------");
    const loader = section(source, "function loadTaskData()", "function loadSecondaryData()");
    return new Function("window", "dv", "projects", "resourceTypes", `let projectTasks=[], resourceTasks=[]; ${owners}\n${loader}\nloadTaskData(); return {projectTasks,resourceTasks};`)(
        { hubTaskData: f.plugin.taskData }, f.dv, f.projects, f.resources);
}
function homeFacts(f, result) {
    const eligible = [...result.projectTasks.filter(item => item.owner.status === "active" && !item.owner.deleted), ...result.resourceTasks];
    return { ...panelFacts(eligible.map(item => item.task), f.now()), owners: eligible.map(({ task, owner }) => ({ id: task.hubTaskId, path: task.path,
        presentation: owner.contextKind === "resource" ? "resource:" + owner.resourceType : owner.projectId,
        physical: f.plugin.projectWizard.getContextForPath(task.path)?.projectId ?? null })) };
}
function homeOwnerResolver(f) {
    const source = fs.readFileSync(path.join(__dirname, "home-read-original.cjs"), "utf8");
    return new Function("projects", "resourceTypes", section(source, "function projectFromReference(", "// ---------- PROJECT TABS ----------") +
        ';return task=>{const page={file:{path:task.path},project:task.homeProjectReference};return resourceForPage(page)??projectForPage(page);};')(f.projects, f.resources);
}
module.exports = { createHomeFixture, originalHome, homeFacts, section, homeOwnerResolver };
if (require.main === module) {
    if (process.argv[2] !== "--record-original") throw Error("Explicit baseline capture required");
    const root = path.resolve(__dirname, "../../../../.."), target = path.join(__dirname, "home-read-original.cjs");
    if (fs.existsSync(target)) throw Error("Original already captured");
    fs.copyFileSync(path.join(root, "System/Dashboards/Home/view.js"), target);
    const f = createHomeFixture(), before = f.state(), facts = homeFacts(f, originalHome(f));
    if (f.state() !== before || f.counts.writes) throw Error("Original reader wrote data");
    fs.writeFileSync(path.join(__dirname, "home-read-baseline.json"), JSON.stringify(facts, null, 2) + "\n");
    fs.writeFileSync(path.join(__dirname, "home-read-input.json"), JSON.stringify({ workspaces: f.workspaces, projects: f.projects, resources: f.resources,
        files: [...f.files], contents: [...f.contents], pages: [...f.pages], metadata: f.plugin.projectWizard.data.taskMetadata }, null, 2) + "\n");
    console.log("Captured actual original Home: " + facts.tasks.length + " eligible tasks; " + facts.owners.length + " owner pairs");
    f.close().catch(error => { throw error; });
}
