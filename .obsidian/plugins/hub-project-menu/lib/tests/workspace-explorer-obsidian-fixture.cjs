"use strict";
module.exports = async function () {
    const fs = require("fs"), path = require("path");
    const scratch = process.env.HUB_EXPLORER_RUNTIME_ROOT;
    if (!scratch || path.resolve(app.vault.adapter.getBasePath()) !== path.resolve(scratch, "vault")) throw Error("Explorer fixture requires its disposable vault");
    const plugin = app.plugins.plugins["hub-project-menu"];
    const { Component, Modal } = plugin.constructor.__explorerRuntimeApi;
    const source = fs.readFileSync(path.resolve(__dirname, "../../../../../System/Dashboards/Project/view.js"), "utf8");
    const homeSource = fs.readFileSync(path.resolve(__dirname, "../../../../../System/Dashboards/Home/view.js"), "utf8");
    const css = fs.readFileSync(path.resolve(__dirname, "../../../../../System/Dashboards/Project/view.css"), "utf8");
    const fragment = source.slice(source.indexOf("// ---------- WORKSPACE FILES ----------"), source.indexOf("// ---------- CURRENT TASKS ----------"));
    const projectRoot = "Projects/Explorer fixture", child = projectRoot + "/Folder";
    await app.vault.createFolder(child);
    await app.vault.createFolder(child + "/Nested");
    await app.vault.create(projectRoot + "/Hub.md", "---\ntype: project\nprojectId: explorer-fixture\nstatus: active\n---\n# Synthetic dashboard");
    await app.vault.create(child + "/One.md", "Synthetic one");
    await app.vault.create(child + "/Two.md", "Synthetic two");
    await app.vault.create(projectRoot + "/Legacy.md", "Synthetic legacy root file");
    await plugin.nativeTaskHost.ready;
    for (let i=0;i<100&&!plugin.projectWizard.getProjectRecords().some(w=>w.projectId==='explorer-fixture');i++) await new Promise(r=>setTimeout(r,50));
    await plugin.nativeTaskHost.refreshInventory();
    const owner={type:'project',id:'explorer-fixture'},runtime=plugin.nativeTaskHost.runtime(owner);
    const L=require('../domain/native-task-location');
    const linked=await runtime.createTask({text:'Synthetic file task',nativeLocation:L.locationReference(owner,projectRoot,child+'/Two.md','note').id});
    const style = document.head.createEl("style", { text: css });
    const fixtureModal = new Modal(app); fixtureModal.open();
    const closeFixture = fixtureModal.close.bind(fixtureModal);
    fixtureModal.close = () => {}; // The outer test surface must survive Escape.
    fixtureModal.modalEl.style.cssText = "width:1100px;max-width:95vw;height:780px;max-height:92vh;padding:12px";
    fixtureModal.contentEl.style.cssText = "height:100%;overflow:hidden";
    const host = fixtureModal.contentEl.createDiv({ cls: "hub-button-scope" });
    host.style.cssText = "height:100%;background:var(--background-primary)";
    const root = host.createDiv({ cls: "project-dashboard hub-button-scope" });
    root.style.height = "100%";
    const grid = root.createDiv({ cls: "project-main-grid" });
    grid.style.cssText = "display:block;height:100%;min-height:0";
    const left = grid.createDiv({ cls: "project-left-column" }); left.style.height = "100%";
    const component = new Component(); component.load();
    const current = { file: { path: projectRoot + "/Hub.md" }, projectId: "explorer-fixture", folder_order: [] };
    const saved = {}, opens = [], menus = [], reveals = [];
    const previous = {};
    for (const name of ["hubGetFolderUiState", "hubSaveFolderUiState", "hubGetFolderPresetState", "hubGetProjectResourceFolders"]) previous[name] = window[name];
    window.hubGetFolderUiState = () => structuredClone(saved);
    window.hubSaveFolderUiState = (id, value) => { Object.assign(saved, structuredClone(value)); };
    window.hubGetFolderPresetState = () => null;
    window.hubGetProjectResourceFolders = () => [];
    const originalMenu = window.hubExplorerHost.showMenu;
    window.hubExplorerHost.showMenu = (event, entries, options) => { const menu = originalMenu(event, entries, options); menus.push({ menu, entries }); return menu; };
    const shell = require("electron").shell, originalReveal = shell.showItemInFolder;
    const appShell = window.electron?.shell, originalAppReveal = appShell?.showItemInFolder;
    shell.showItemInFolder = value => reveals.push(value);
    if (appShell) appShell.showItemInFolder = value => reveals.push(value);
    const fileDomain = window.hubCreateFileDomain({ getByPath: value => app.vault.getAbstractFileByPath(value) });
    const render = new Function("app", "dv", "left", "root", "current", "projectRoot", "contextId", "isResourceContext", "resourceTypes", "resourceType", "fileDomain", "el", "moment", "formatDateTime", "openProjectNote", `
        const { directFiles,directFolders,isFolder,projectChildPath,projectItemPath,selectedRootPaths,availableExternalFilePath } = fileDomain;
        ${fragment}
        return workspaceExplorer;
    `);
    const controller = render(app, { component }, left, root, current, projectRoot, "explorer-fixture", false, [], null, fileDomain,
        (parent, tag, cls, text) => parent.createEl(tag, { cls, text }), moment, value => String(value),
        (file, placement = "replace") => { opens.push({ path: file.path, placement }); });
    root.querySelector(".project-folder-stack").style.height = "100%";
    root.querySelector(".hub-workspace-explorer").style.height = "100%";
    const changed = app.vault.on("create", () => controller.refresh());
    const renamed = app.vault.on("rename", (file, oldPath) => controller.rename(oldPath, file.path));
    const removed = app.vault.on("delete", () => controller.refresh());
    const row = value => [...root.querySelectorAll(".hub-explorer-tree [data-path]")].find(e => e.dataset.path === value);
    const detail = value => [...root.querySelectorAll(".hub-explorer-contents [data-path]")].find(e => e.dataset.path === value);
    window.__explorerProbe = {
        root, host, controller, projectRoot, child, saved, opens, menus, reveals, row, detail,
        plugin,runtime,linkedId:linked.task.id,task:async()=> (await runtime.list()).tasks.find(t=>t.id===linked.task.id),
        reference:path=>L.locationReference(owner,projectRoot,path,'note').id,
        desktopInfo: { canReveal: window.hubExplorerHost.canReveal(), electronKeys: Object.keys(window.electron ?? {}), base: app.vault.adapter.getBasePath?.() },
        setMode(note) { host.classList.toggle("hub-project-rail", note); controller.syncMode(); },
        async testStartupSnapshotFocus() {
            const { keepStartupSnapshotUnfocusable } = require("../ui/startup-snapshot");
            if (document.getElementById("startup-snapshot")) throw Error("The native startup snapshot is still visible");
            const frame = document.createElement("iframe");
            frame.id = "startup-snapshot";
            frame.setAttribute("sandbox", "allow-same-origin");
            frame.srcdoc = "<!doctype html><body inert>Read-only startup preview</body>";
            const loaded = new Promise(resolve => frame.addEventListener("load", resolve, { once: true }));
            host.append(frame);
            await loaded;
            try {
                frame.focus();
                if (document.activeElement !== frame) throw Error("Failed to reproduce snapshot iframe focus");
                const before = new Modal(app);
                before.open();
                let oldError;
                try { before.close(); } catch (error) { oldError = error; }
                if (!/instanceOf is not a function/.test(oldError?.message)) {
                    throw Error("Expected native modal focus restoration to fail before the fix");
                }
                frame.focus();
                keepStartupSnapshotUnfocusable(document);
                if (document.activeElement === frame) throw Error("Existing snapshot focus was retained");
                frame.focus();
                if (document.activeElement === frame) throw Error("The snapshot accepted focus again");
                const after = new Modal(app);
                after.open();
                after.close();
                if (!frame.isConnected) throw Error("The startup preview was removed");
            } finally {
                frame.remove();
            }
        },
        async startPlanFixture() {
            const plan = plugin.globalPlan, relevance = plugin.planRelevance;
            const one = child + "/One.md", two = child + "/Two.md";
            await plan.references.audit();
            const [item] = await plan.references.tasks.read([{ authorityId: runtime.info().authority.authorityId, taskId: linked.task.id }]);
            const task = item.task, workspace = plugin.projectWizard.getProjectById(owner.id);
            const taskEntry = plan.references.taskEntry(task);
            const fileEntry = plan.references.fileEntry(app.vault.getAbstractFileByPath(one));
            await plan.createPlan([taskEntry, fileEntry]);
            await relevance.refresh();
            return { one, two, task, workspace };
        },
        async mountPlanTasks(right, component) {
            const taskSource = source.slice(source.indexOf("// ---------- CURRENT TASKS ----------"),
                source.indexOf("frame.defer(() => renderCurrentTasks());"));
            const createTasks = new Function("right", "root", "dv", "app", "current", "projectRoot", "isResourceContext", "el", `
                const taskWorkspace = null;
                let expandedTasks = null;
                ${taskSource}
                return { tasksPanel, tasksBody, renderCurrentTasks,
                    connectExpanded(signal, workspace) {
                        return expandedTasks = window.hubMountExpandedTasks({
                            panel: tasksPanel, compactBody: tasksBody, signal, stateOwner: tasksPanel, stateKey: "fixture",
                            workspace, readItems: () => currentProjectTasks.map(task => ({ task, owner: workspace })),
                            availability: () => taskPanelAvailability, reader: taskPanelRead, onEdit: applyPanelTaskEdit
                        });
                    } };
            `);
            const view = createTasks(right, right, { component }, app, current, projectRoot, false,
                (parent, tag, cls, text) => parent.createEl(tag, { cls, text }));
            await view.renderCurrentTasks();
            return view;
        },
        mountHomePlanTasks(parent, component, readItems, reader) {
            const start = homeSource.indexOf("function renderTasksToDo(");
            const taskRenderer = homeSource.slice(start, homeSource.indexOf("// ---------- CALENDAR ----------", start));
            return new Function("upcomingBody", "component", "readItems", "homeTaskRead", `
                const homeTaskDocument = upcomingBody.ownerDocument;
                const homeTaskCountComplete = true, homeTaskLoading = false;
                const el = (parent, tag, cls, text) => parent.createEl(tag, { cls, text });
                upcomingBody.hubTaskUi = window.hubCreateTaskUi(component, upcomingBody, renderTaskContext, homeTaskRead.actions);
                function renderTaskContext() { renderTasksToDo(readItems()); }
                ${taskRenderer}
                renderTaskContext();
                return renderTaskContext;
            `)(parent, component, readItems, reader);
        },
        mountProjectDrag() {
            const projectPanel = host.createDiv({ attr: { style: "position:absolute;inset:20px;z-index:20;background:var(--background-primary)" } });
            const projectGrid = projectPanel.createDiv({ attr: { style: "display:flex;gap:12px;padding:12px" } });
            const cleanup = new AbortController();
            const merge = homeSource.slice(homeSource.indexOf("function mergeVisibleProjectCardOrder("),
                homeSource.indexOf("function rememberProjectCardOrder("));
            const drag = homeSource.slice(homeSource.indexOf("const projectCardSwapAnimations ="),
                homeSource.indexOf('root.addEventListener("hub-project-status"'));
            const controller = new Function("projectGrid", "projectPanel", "frame", `
                const projectSort = "custom", currentProjectStatus = "active";
                const projectCardOrder = { active: ["ordinary", "direct-a", "indirect", "direct-b"] };
                const suppressedProjectCardClicks = new WeakSet(), projectReducedMotion = { matches: true };
                const ownColorRoot = null, isWorkspacesExpanded = () => true;
                const stopProjectEdgeScroll = () => {}, updateProjectEdgeScroll = () => {};
                let projectDragPointer, saves = 0;
                function rememberProjectCardOrder(status, ids) { projectCardOrder[status] = ids; saves++; }
                ${merge}
                ${drag}
                function render(tiers) {
                    cancelProjectCardDrag?.();
                    projectGrid.empty();
                    const ids = [...projectCardOrder.active].sort((a,b) => tiers[a] - tiers[b]);
                    for(const id of ids) projectGrid.createDiv({
                        cls: "home-project-card", text: id,
                        attr: { "data-project-id": id, "data-plan-tier": tiers[id], style: "width:190px;height:130px;flex:none" }
                    });
                }
                return { render, saved: () => projectCardOrder.active, saves: () => saves,
                    order: () => projectCardsInVisualOrder().map(card => card.dataset.projectId) };
            `)(projectGrid, projectPanel, { signal: cleanup.signal });
            controller.close = () => { cleanup.abort(); projectPanel.remove(); delete window.__projectDrag; };
            window.__projectDrag = controller;
        },
        cleanup() {
            app.vault.offref(changed); app.vault.offref(renamed); app.vault.offref(removed);
            component.unload(); closeFixture(); style.remove();
            Object.assign(window, previous); window.hubExplorerHost.showMenu = originalMenu; shell.showItemInFolder = originalReveal;
            if (appShell) appShell.showItemInFolder = originalAppReveal;
        }
    };
    return true;
};
