"use strict";
// Disposable preview adapters for the current native task contract.
const fs = require("node:fs"), path = require("node:path");
const owner = { type: "project", id: "a" };
const contexts = [{ projectId: "a", name: "Strict Oath preview", root: "Projects/A", path: "Projects/A/A.md", status: "active", contextKind: "project" }];
const tasks = ["Test application switching", "Inspect the Oath dock"].map((text, index) => ({
    id: "preview-" + index, text, completed: false, steps: [],
    nativeReference: { authorityId: "preview", taskId: "preview-" + index, taskRevision: 1, owner }
}));
function initialize(ctx) {
    const folder = path.join(ctx.fixture.vault, "Projects/A");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "A.md"), "# Disposable Strict Oath preview\n");
}
async function attach(win) {
    await win.webContents.executeJavaScript(`(() => {
        const plugin=app.plugins.plugins['hub-project-menu'];
        const contexts=${JSON.stringify(contexts)}, tasks=${JSON.stringify(tasks)}, owner=${JSON.stringify(owner)};
        window.phase5={plugin,service:plugin.oath};
        plugin.projectWizard.getProjectRecords=()=>contexts;
        plugin.projectWizard.getProjectById=id=>contexts.find(item=>item.projectId===id);
        plugin.workspaceModes.currentContext=()=>contexts[0];
        plugin.workspaceModes.openProjectFull=async()=>{};
        const runtime={list:async()=>({tasks}),info:()=>({authority:{authorityId:'preview'}})};
        plugin.nativeTaskHost={matches:ref=>ref.type===owner.type&&ref.id===owner.id,runtime:()=>runtime,
            nativeTasks:{owners:[owner],availability:()=> 'current',availabilityFor:()=> 'current',
                createPanelRead:()=>({snapshot:()=>({availability:'current',tasks}),read:async()=>({availability:'current',tasks,diagnostics:[]}),close(){}})}};
        plugin.oath.closeCommittedRead(); plugin.oath.readClosed=false;
        plugin.oath.now=()=>Date.now(); plugin.oath.nextStrictAttempt=0;
    })()`);
}
module.exports = { initialize, attach, dispose() {} };
