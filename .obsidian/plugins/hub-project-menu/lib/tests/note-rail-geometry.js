"use strict";
const check = (ok, message) => { if (!ok) throw Error(message); };
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const rect = element => element.getBoundingClientRect();
HTMLElement.prototype.createEl = function(tag, options = {}) {
    const element = document.createElement(tag); element.className = options.cls ?? "";
    element.textContent = options.text ?? ""; this.append(element); return element;
};
HTMLElement.prototype.createDiv = function(options) { return this.createEl("div", options); };

async function runCases() {
    class Component {
        constructor() { this.cleanup = []; this.children = []; }
        load() {}
        register(fn) { this.cleanup.push(fn); }
        addChild(child) { this.children.push(child); }
        removeChild(child) { child.unload(); this.children = this.children.filter(value => value !== child); }
        unload() { this.children.splice(0).forEach(child => child.unload()); this.cleanup.splice(0).forEach(fn => fn()); }
    }
    class ItemView extends Component {
        constructor(leaf) {
            super(); this.leaf = leaf;
            this.containerEl = document.createElement("div"); this.containerEl.className = "workspace-leaf-content";
            this.containerEl.dataset.type = "hub-prepared-note-rail";
            this.containerEl.createDiv({ cls: "view-header" });
            this.contentEl = this.containerEl.createDiv({ cls: "view-content" });
        }
        async setState() {}
    }
    const modules = ["ui/color-system", "ui/note-rail", "ui/tooltips", "ui/prepared-note-rail", "ui/workspace-explorer", "ui/file-icons", "domain/workspace-explorer", "domain/files"];
    const sources = Object.fromEntries(await Promise.all(modules.map(async name => [name, await (await fetch("../" + name + ".js")).text()])));
    const cache = {};
    function load(name) {
        if (name === "obsidian") return { Component, ItemView, setIcon: (element, icon) => { element.dataset.icon = icon; element.textContent = icon.startsWith("chevron") ? ">" : "\u25a1"; } };
        if (cache[name]) return cache[name].exports;
        const module = cache[name] = { exports: {} };
        new Function("module", "require", sources[name])(module, relative => {
            if (relative === "obsidian") return load(relative);
            const parts = (name.slice(0, name.lastIndexOf("/")) + "/" + relative).split("/"), result = [];
            for (const part of parts) { if (part === "..") result.pop(); else if (part !== ".") result.push(part); }
            return load(result.join("/"));
        });
        return module.exports;
    }
    const { mountNoteRail } = load("ui/note-rail");
    const { mountWorkspaceExplorer } = load("ui/workspace-explorer");
    const source = await (await fetch("../../plugin.js")).text();
    const method = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
    const Service = new Function("mountNoteRail", "return class {" +
        method("    applyModeClasses() {", "    syncProjectNavigation(") +
        method("    prepareRestoredNoteMode(context, snapshot) {", "    async applyNoteLayout(") + "}")(mountNoteRail);
    let factory;
    const shell = document.querySelector(".workspace");
    const objects = new Map(), states = {};
    const add = (path, folder = true) => {
        const name = path.split("/").pop(), parent = objects.get(path.slice(0, path.lastIndexOf("/")));
        const item = { path, name, ...(folder ? { children: [] } : { basename: name.replace(/\.md$/, ""), extension: "md", stat: {} }) };
        objects.set(path, item); parent?.children.push(item); return item;
    };
    const math = "Resources/Knowledge/Mathematics", course = math + "/Topology";
    add(math); add(course); add(course + "/Assignments"); add(course + "/Assignments/Problems.md", false);
    for (let index = 0; index < 40; index++) add(course + "/Lecture " + index + ".md", false);
    add("Resources/Knowledge/Physics"); states[math] = states[course] = { collapsed: false };
    function renderDashboard(dv, app) {
        const root = dv.container.createDiv({ cls: "project-dashboard hub-button-scope" });
        const dock = root.createDiv({ cls: "project-nav-dock" });
        const identity = dock.createDiv({ cls: "project-nav-identity" });
        identity.createDiv({ cls: "project-nav-title", text: dv.name });
        identity.createDiv({ cls: "project-nav-category", text: "Workspace subtitle" });
        const nav = dock.createDiv({ cls: "project-nav" });
        for (const name of ["Home", "Workspace", "Last File", "Presets"]) nav.createEl("button", { cls: "project-nav-button", text: name });
        const grid = root.createDiv({ cls: "project-main-grid" });
        const left = grid.createDiv({ cls: "project-left-column" });
        const folderStack = left.createDiv({ cls: "project-folder-stack" });
        const explorer = mountWorkspaceExplorer({ parent: folderStack, workspacePath: "Resources/Knowledge", dashboardPath: dv.path,
            isNoteView: () => true,
            descriptors: () => [math, "Resources/Knowledge/Physics"].map(path => ({ path, name: path.split("/").pop() })),
            getByPath: path => objects.get(path), states: () => states, persist() {},
            setIcon: load("obsidian").setIcon, openFile() {}, createItem() {}, contextMenu() {} });
        dv.component.register(() => explorer.destroy());
        const right = grid.createDiv({ cls: "project-right-column" });
        const tasks = right.createDiv({ cls: "project-panel project-tasks" });
        tasks.createDiv({ cls: "project-panel-title project-tasks-title", text: "Tasks" });
        const body = tasks.createDiv({ cls: "project-tasks-body" });
        for (let index = 0; index < 30; index++) {
            const row = body.createDiv({ cls: "project-task-row" });
            row.createEl("input").type = "checkbox";
            row.createDiv({ cls: "project-task-info", text: "Review lecture " + index + " and work through the exercises" });
        }
        right.createDiv({ cls: "project-panel project-progress", text: "Hidden in Note-view" });
        root.hubCaptureFolders = () => ({});
        const frame = { root, activate() {} }; dv.component.hubOnFrameCommit?.(frame);
        return root;
    }
    const plugin = { registerEvent() {}, registerView(type, create) { if (type === "hub-prepared-note-rail") factory = create; },
        workspaceModes: { contextFor: path => ({ path, name: "Knowledge" }) }, app: {
            renderDashboard, vault: { on() {}, getConfig: () => true, getAbstractFileByPath: path => ({ path }), adapter: {
                read: async path => path.endsWith(".js") ? "app.renderDashboard(dv,app);" : ""
            } }, plugins: { getPlugin: () => ({ localApi: (path, component, container) => ({ path, component, container, name: "Knowledge" }) }) }
        } };
    const preparedRails = load("ui/prepared-note-rail").createPreparedNoteRails(plugin);
    const measurements = {};
    for (const route of ["Workspace file", "Last File", "Preset", "Application restore"]) {
        for (const state of ["half", "closed", "full"]) {
            shell.replaceChildren();
            const split = shell.createDiv({ cls: "workspace-split mod-root mod-vertical" });
            const pane = split.createDiv({ cls: "workspace-tabs" });
            // Incidental native deserialization sizes must not control the rail.
            pane.style.cssText = `width:${route === "Preset" ? 777 : 321}px;flex:1 1 83%;min-width:111px;max-width:900px`;
            const tabs = pane.createDiv({ cls: "workspace-tab-container" });
            const leafElement = tabs.createDiv({ cls: "workspace-leaf" });
            const documentPane = split.createDiv({ cls: "document-pane", text: "Main document" });
            const leaf = { id: "rail", containerEl: leafElement };
            const service = new Service();
            Object.assign(service, { state: {}, mode: null, noteRailState: state,
                leafElement: target => target?.containerEl, leafDocument: () => document,
                railTopology: () => ({ tabs: pane, pane, root: split }), activeMainLeaf: () => leaf,
                mainLeaves: () => [leaf], setPinned() {}, syncProjectNavigation() {} });
            const context = { path: "Resources/Knowledge/Knowledge.md", name: "Knowledge" };
            const snapshot = { main: { type: "split", children: [{ type: "leaf", id: "rail", state: { type: "markdown", state: { file: context.path } } }] } };
            let component, prepared, restore;
            if (route === "Workspace file") {
                component = new Component();
                const content = leafElement.createDiv({ cls: "workspace-leaf-content" }); content.dataset.type = "markdown";
                content.createDiv({ cls: "view-header" });
                const reading = content.createDiv({ cls: "view-content" }).createDiv({ cls: "markdown-reading-view" });
                const host = reading.createDiv({ cls: "markdown-preview-view markdown-rendered dashboard is-readable-line-width" });
                const container = host.createDiv({ cls: "markdown-preview-sizer markdown-preview-section" }).createDiv({ cls: "block-language-dataviewjs" });
                renderDashboard({ component, container, path: context.path, name: context.name }, plugin.app);
                service.mode = { project: context, projectLeaf: leaf, ownerDocument: document }; service.applyModeClasses();
            } else {
                restore = service.prepareRestoredNoteMode(context, snapshot);
                plugin.workspaceModes.pendingNoteRestore = restore;
                if (route !== "Application restore") prepared = await preparedRails.prepare(context, snapshot, document);
                const view = leaf.view = factory(leaf); component = view;
                leafElement.append(view.containerEl);
                // Native startup restores the view without a transient preparation token.
                await view.setState(prepared?.snapshot.main.children[0].state.state ?? { file: context.path }, {});
                restore.adopt();
            }
            await frame(); await frame();
            const root = pane.querySelector(".project-dashboard"), explorer = root.querySelector(".hub-workspace-explorer"), tasks = root.querySelector(".project-tasks");
            const p = rect(pane), e = rect(explorer), t = rect(tasks), grid = rect(root.querySelector(".project-main-grid"));
            const key = state, geometry = [p.width, e.left - p.left, e.width, e.top - p.top, e.height, t.top - p.top, t.height];
            if (route === "Workspace file") measurements[key] = geometry;
            else geometry.forEach((value, index) => check(Math.abs(value - measurements[key][index]) < 1, `${route} ${state}: geometry differs from Workspace file at index ${index} (${value} vs ${measurements[key][index]})`));
            if (state === "closed") {
                check(p.width === 0 && t.height === 0, route + ": hidden state fully collapses (pane " + p.width + ", tasks " + t.height + ")");
            } else {
                const gap = parseFloat(getComputedStyle(root.querySelector(".project-main-grid")).rowGap);
                check(Math.abs(e.height / (grid.height - gap) - .7) < .01 && Math.abs(t.height / (grid.height - gap) - .3) < .01, route + ": 70/30 panel allocation");
                check(Math.abs(e.left - t.left) < 1 && Math.abs(e.right - t.right) < 1, route + ": panel edges align");
                check(getComputedStyle(explorer).borderRadius === getComputedStyle(tasks).borderRadius, route + ": matching panel radii");
                check(Math.abs((p.bottom - t.bottom) - (e.left - p.left)) < 1, route + ": bottom inset matches horizontal inset");
                check(t.bottom <= rect(document.querySelector(".status-bar")).top, route + ": panels do not overlap global bar");
                const tree = root.querySelector(".hub-explorer-tree"), taskBody = root.querySelector(".project-tasks-body");
                tree.scrollTop = 60; check(tree.scrollTop > 0 && taskBody.scrollTop === 0, route + ": tree scrolls independently");
                taskBody.scrollTop = 60; check(taskBody.scrollTop > 0 && tree.scrollTop === 60, route + ": Tasks scroll independently");
                check(root.scrollHeight <= root.clientHeight + 1 && root.scrollWidth <= root.clientWidth + 1, route + ": no outer overflow");
                check(getComputedStyle(root.querySelector(".hub-explorer-search")).display !== "none", route + ": search stays visible in both open rail states");
                const search = root.querySelector(".hub-explorer-search"), input = search.querySelector("input");
                check(rect(input).width > 0 && search.scrollWidth <= search.clientWidth, route + ": search fits the panel at this rail width");
                const group = tree.querySelector(".hub-explorer-group"), guide = getComputedStyle(group, "::before");
                check(guide.backgroundImage === "none" && guide.boxShadow === "none" && guide.opacity === "1" && guide.borderLeftWidth === "1px", "Guide is one uniform border without fading or shadow");
                check(rect(group).bottom <= rect(tree.querySelector('[data-path="Resources/Knowledge/Physics"]')).top, "Branch guide ends before unrelated sibling");
                check(rect(documentPane).width > 0, route + ": main document keeps available space");
                if (route === "Application restore" && state === "full") {
                    const initialWidth = innerWidth, initialHeight = innerHeight;
                    for (const [width, height] of [[initialWidth - 120, initialHeight - 120], [initialWidth, initialHeight]]) {
                        window.frameElement.width = width; window.frameElement.height = height;
                        await new Promise(resolve => setTimeout(resolve, 220));
                        const resizedPane = rect(pane), resizedTree = rect(explorer), resizedTasks = rect(tasks);
                        const available = rect(root.querySelector(".project-main-grid")).height - gap;
                        check(Math.abs(resizedTree.height / available - .7) < .01 && Math.abs(resizedTasks.height / available - .3) < .01, "Live window resize preserves 70/30 allocation");
                        check(Math.abs((resizedPane.bottom - resizedTasks.bottom) - (resizedTree.left - resizedPane.left)) < 1, "Live resize keeps equal outer insets");
                        check(Math.abs(resizedTree.width - resizedTasks.width) < 1 && rect(documentPane).width > 0, "Live resize retains aligned panels and document space");
                    }
                }
            }
            if (state === "full") {
                service.noteRailControls.destroy();
                const narrow = mountNoteRail(pane, "half", () => {}, { width: 170 });
                check(Math.abs(rect(pane).width - 170) < 1, route + ": custom minimum width");
                const search = root.querySelector(".hub-explorer-search");
                check(search.scrollWidth <= search.clientWidth + 1, route + ": search fits 170px rail");
                check(root.scrollWidth <= root.clientWidth + 1, route + ": minimum-width content stays contained");
                narrow.destroy();
                service.noteRailControls = mountNoteRail(pane, "full");
            }
            restore?.cancel(); prepared?.dispose();
            // Leave the last full rail visible for the fixture screenshot.
            if (route !== "Application restore" || state !== "full") {
                component.unload(); service.noteRailControls?.destroy(); service.destroyed = true;
                document.body.classList.remove("hub-project-note-mode");
            }
        }
    }
    check(Math.abs(measurements.half[0] - measurements.full[0] / 2) < 1, "Existing half-width relationship preserved");
    const priorFull = innerWidth <= 1100 ? Math.max(420, Math.min(innerWidth * .46, 506)) : Math.max(460, Math.min(innerWidth * .4, 600));
    check(measurements.full[0] === priorFull - 12, "Full width tightens by one standard spacing unit");
    preparedRails.destroy();
    return `PASS ${innerWidth}x${innerHeight}: Workspace file, Last File, Preset and startup match in full/half/closed; padding, 70/30 allocation, independent scrolling and uniform guides.`;
}

(async () => {
    try {
        if (location.search) {
            document.getElementById("result").textContent = await runCases();
        } else {
            document.querySelector(".workspace").remove(); document.querySelector(".status-bar").remove();
            const results = [];
            for (const [width, height] of [[900, 600], [1100, 850], [1600, 1000]]) {
                const iframe = document.createElement("iframe"); iframe.width = width; iframe.height = height;
                iframe.src = "note-rail-geometry.html?case"; document.body.prepend(iframe);
                await new Promise(resolve => iframe.onload = resolve);
                let result = "";
                for (let attempt = 0; attempt < 250; attempt++) {
                    await new Promise(resolve => setTimeout(resolve, 20));
                    result = iframe.contentDocument.getElementById("result").textContent;
                    if (/^(PASS|FAIL)/.test(result)) break;
                }
                check(result.startsWith("PASS"), result); results.push(result); if (width !== 1600) iframe.remove();
            }
            document.getElementById("result").textContent = "PASS: " + results.join("\n");
        }
    } catch (error) { document.getElementById("result").textContent = "FAIL: " + error.stack; }
})();
