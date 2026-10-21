"use strict";
const S = require("./support.cjs"), lib = "../../../.obsidian/plugins/hub-project-menu/lib/";
const { createHomeFixture, homeOwnerResolver } = require(lib + "tests/home-read-fixture.cjs");
const { createHomeTaskRead } = require(lib + "services/home-task-read");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function consumerFixture(t, extra = {}) {
    const f = await S.fixture(t, { consumerUiV1: true, ...extra }), legacy = createHomeFixture(); t.after(() => legacy.close());
    const project = { projectId: f.owner.id, contextKind: "project", root: "Projects/Native", path: "Projects/Native/Dashboard.md", name: "Native", status: "active", deleted: false };
    legacy.projects.push(project); legacy.workspaces.push(project); legacy.add(project.path); legacy.addTask("Projects/Native/Tasks.md", "Excluded native-owner Markdown", "excluded");
    const c = f.component(), home = createHomeTaskRead({ plugin: legacy.plugin, component: c, nativeTasks: f.runtime.nativeTasks,
        resolveOwner: homeOwnerResolver(legacy), resolveNativeOwner: o => legacy.projects.find(p => p.projectId === o.id), editTask() {}, changed() {} });
    t.after(() => home.close());
    return { ...f, legacy, project, home, async read() { for (let i = 0; i < 10; i++) { const r = await home.read(); if (r?.availability === "current") return r; await delay(25); } return home.read(); },
        async create(values) { const intent = await f.intent(values), out = await f.runtime.mutate(intent); S.assert.equal(out.status, "committed"); await delay(40); return (await f.runtime.list()).tasks.at(-1); } };
}
module.exports = { ...S, lib, delay, consumerFixture };
