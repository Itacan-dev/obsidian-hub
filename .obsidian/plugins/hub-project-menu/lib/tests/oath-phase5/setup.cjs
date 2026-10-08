"use strict";
const fs = require("node:fs"), path = require("node:path");
const { fixture } = require("../oath.test");
let data, root;
function initialize(ctx) {
    root = ctx.fixture.vault; data = fixture();
    data.files.set("Projects/A/A.md", "---\ntype: project\nprojectId: a\nstatus: active\n---\n# Strict Oath test project\n");
    data.files.set("Projects/A/Tasks.md", "# Disposable Strict Oath tasks\n\n- [ ] Test application switching <!-- hub-task:first -->\n- [ ] Inspect the Oath dock <!-- hub-task:second -->\n");
    for (const [relative, content] of data.files) {
        const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true });
        if (!fs.existsSync(file)) fs.writeFileSync(file, content);
    }
}
function tasks() {
    for (const relative of data.files.keys()) data.files.set(relative, fs.readFileSync(path.join(root, relative), "utf8"));
    return data.readTasks();
}
async function attach(win) {
    let ready = false;
    for (let i=0; i<300; i++) {
        ready = await win.webContents.executeJavaScript("!!window.app?.plugins?.plugins?.['hub-project-menu']?.oath").catch(() => false);
        if (ready) break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!ready) throw Error("Reloaded Itacan lifecycle service did not become ready");
    await win.webContents.executeJavaScript(`(() => {
        const helper=window.electron.remote.require(${JSON.stringify(__filename)});
        const plugin=app.plugins.plugins['hub-project-menu'], contexts=helper.contexts().map(c=>({...c}));
        window.phase5={plugin,service:plugin.oath};
        plugin.projectWizard.getProjectRecords=()=>contexts;
        plugin.projectWizard.getProjectById=id=>contexts.find(c=>c.projectId===id);
        plugin.workspaceModes.currentContext=()=>contexts[0];
        plugin.workspaceModes.openProjectFull=async()=>{const file=app.vault.getAbstractFileByPath('Projects/A/Tasks.md');if(file)await app.workspace.getLeaf(false).openFile(file);};
        plugin.oath.ready=()=>true; plugin.oath.api=()=>({index:{initialized:true}});
        plugin.oath.now=()=>Date.now(); plugin.oath.nextStrictAttempt=0;
        plugin.taskData.readPages=()=>[{file:{tasks:helper.tasks().map(t=>({...t}))}}];
    })()`);
}
module.exports = { initialize, attach, tasks, contexts: () => data.contexts, dispose: () => data?.destroy() };
