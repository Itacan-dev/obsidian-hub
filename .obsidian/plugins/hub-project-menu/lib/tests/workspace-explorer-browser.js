"use strict";
HTMLElement.prototype.createEl = function(tag, options = {}) {
    const element = document.createElement(tag); element.className = options.cls ?? "";
    if (options.text) element.textContent = options.text;
    for (const [key, value] of Object.entries(options.attr ?? {})) element.setAttribute(key, value);
    this.append(element); return element;
};
for (const [method, tag] of [["createDiv", "div"], ["createSpan", "span"]]) HTMLElement.prototype[method] = function(options) { return this.createEl(tag, options); };
HTMLElement.prototype.empty = function() { this.replaceChildren(); };
HTMLElement.prototype.addClass = function(...names) { this.classList.add(...names); };
HTMLElement.prototype.removeClass = function(...names) { this.classList.remove(...names); };
HTMLElement.prototype.toggleClass = function(name, value) { this.classList.toggle(name, value); };
const assert = (value, message) => { if (!value) throw Error(message); };
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); };
const icons = { "folder-symlink": "M3 7h6l2-3h9v16H3zM7 15h9m-3-3 3 3-3 3", folder: "M3 7h6l2-3h9v16H3z", "folder-open": "M3 7h6l2-3h9v5H5l-2 11V7m2 2h17l-3 11H3", "chevron-right": "m9 5 7 7-7 7", "chevron-down": "m5 9 7 7 7-7", "chevron-up": "m5 15 7-7 7 7", search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6", "file-text": "M5 3h9l5 5v13H5zM9 12h6M9 16h6", "file-type": "M5 3h9l5 5v13H5zM9 12h6m-3 0v5", "folder-plus": "M3 7h6l2-3h9v16H3zM8 13h8m-4-4v8" };
function getIcon(name) {
    const canonical = name.replace(/^lucide-/, "");
    return icons[canonical] ? { name: canonical } : null;
}
function setIcon(element, name) {
    // Match Obsidian's legacy collision: only a prefixed folder is canonical.
    name = name === "folder" ? "folder-open" : name.replace(/^lucide-/, "");
    element.replaceChildren(); element.dataset.icon = name;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round" })) svg.setAttribute(key, value);
    const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", icons[name] ?? icons.folder); svg.append(path); element.append(svg);
}
const runtimeErrors = [];
window.onerror = (message, source, line, column, error) => runtimeErrors.push(error?.stack ?? message);
window.addEventListener("unhandledrejection", event => runtimeErrors.push(String(event.reason?.stack ?? event.reason)));
window.onload = async () => { try {
    const names = ["domain/files", "domain/workspace-explorer", "ui/file-icons", "ui/icons", "ui/workspace-explorer", "ui/note-rail", "ui/tooltips"];
    const sources = Object.fromEntries(await Promise.all(names.map(async name => [name, await (await fetch("../" + name + ".js")).text()]))), cache = {};
    function load(name) {
        if (name === "obsidian") return { setIcon, getIcon };
        if (cache[name]) return cache[name].exports;
        const module = cache[name] = { exports: {} };
        new Function("module", "require", sources[name])(module, request => {
            if (request === "obsidian") return load(request);
            const parts = (name.slice(0, name.lastIndexOf("/")) + "/" + request).split("/"), result = [];
            for (const part of parts) { if (part === "..") result.pop(); else if (part !== ".") result.push(part); }
            return load(result.join("/"));
        });
        return module.exports;
    }
    const view = await (await fetch("../../../../../System/Dashboards/Project/view.js")).text();
    const folderSource = view.slice(view.indexOf("// ---------- WORKSPACE FILES ----------"), view.indexOf("// ---------- CURRENT TASKS ----------"));
    const objects = new Map(), stored = {}, opens = [], creations = [], menus = [], listeners = new Map();
    function add(path, folder = true) {
        const name = path.split("/").pop(), parent = objects.get(path.slice(0, path.lastIndexOf("/")));
        const item = { path, name, parent, ...(folder ? { children: [] } : { extension: name.split(".").pop(), basename: name.replace(/\.[^.]+$/, ""), stat: { mtime: 1789695300000, ctime: 1788336000000 } }) };
        objects.set(path, item); parent?.children.push(item); return item;
    }
    const resourcePath = "Resources/Knowledge", projectPath = "Projects/Itacan";
    for (const path of [resourcePath, projectPath, projectPath + "/Meta", projectPath + "/Atlas", resourcePath + "/Mathematics",
        resourcePath + "/Mathematics/MM7052 HT26, Topology", resourcePath + "/Mathematics/MM7052 HT26, Topology/Assignments",
        resourcePath + "/Mathematics/MM7052 HT26, Topology/Course Information", resourcePath + "/Physics", resourcePath + "/Concepts"]) add(path);
    const math = resourcePath + "/Mathematics", course = math + "/MM7052 HT26, Topology", assignments = course + "/Assignments";
    for (const path of [projectPath + "/Itacan.md", resourcePath + "/Knowledge.md", projectPath + "/Meta/Design.md", projectPath + "/Atlas/Tasks.md",
        assignments + "/Homework.md", course + "/Course literature.pdf", course + "/Encyclopedia of definitions & theorems.md", course + "/Lecture plan.md", course + "/Tasks.md"]) add(path, false);
    let deep = course;
    for (let i = 0; i < 7; i++) { deep += "/Nested " + i; add(deep); }
    add(deep + "/A very long filename that should truncate instead of widening the sidebar.md", false);
    const shared = { path: math, name: "Mathematics", id: "math-id", resourceType: "study" };
    const app = { vault: { getAbstractFileByPath: path => objects.get(path),
        createFolder: async path => { creations.push(path); return add(path); }, create: async path => { creations.push(path); return add(path, false); } },
        workspace: { getActiveFile: () => null, on(name, fn) { listeners.set(fn, name); return fn; } },
        fileManager: { processFrontMatter: async (file, fn) => fn({}), trashFile: async item => {
            objects.delete(item.path); item.parent.children = item.parent.children.filter(child => child !== item);
            root.dispatchEvent(new CustomEvent("hub-project-files-changed", { detail: { path: item.path } }));
        }, renameFile: async (item, destination) => {
            const oldPath = item.path, parent = objects.get(destination.slice(0, destination.lastIndexOf("/")));
            if (item.parent !== parent) { item.parent.children = item.parent.children.filter(child => child !== item); parent.children.push(item); item.parent = parent; }
            for (const [path, entry] of [...objects]) if (path === oldPath || path.startsWith(oldPath + "/")) {
                objects.delete(path); entry.path = destination + path.slice(oldPath.length);
                entry.name = entry.path.split("/").pop(); if (entry.extension) entry.basename = entry.name.replace(/\.[^.]+$/, "");
                objects.set(entry.path, entry);
            }
            root.dispatchEvent(new CustomEvent("hub-project-files-changed", { detail: { path: destination, oldPath } }));
        } } };
    const cleanup = [];
    const component = { register: fn => cleanup.push(fn), registerEvent: ref => cleanup.push(() => listeners.delete(ref)),
        registerDomEvent: (element, name, fn, options) => { element.addEventListener(name, fn, options); cleanup.push(() => element.removeEventListener(name, fn, options)); } };
    const fileDomain = load("domain/files").createFileDomain({ getByPath: app.vault.getAbstractFileByPath });
    window.hubSetIcon = load("ui/icons").setHubIcon; window.hubMountWorkspaceExplorer = load("ui/workspace-explorer").mountWorkspaceExplorer;
    window.hubGetFolderUiState = id => structuredClone(stored[id] ?? {});
    window.hubSaveFolderUiState = (id, value) => stored[id] = structuredClone(value);
    window.hubGetProjectResourceFolders = () => [shared];
    window.hubShowProjectFolderMenu = (event, actions) => menus.push(actions);
    window.hubShowProjectFileMenu = (event, path, actions) => menus.push({ path, ...actions });
    window.hubShowProjectSelectionMenu = (event, actions) => menus.push(actions);
    window.hubDetachResourceFolder = async () => { window.hubGetProjectResourceFolders = () => []; };
    const host = document.getElementById("fixture");
    let root, controller, tasks, lastFilePath = null;
    window.hubGetLastNavigation = () => ({ file: lastFilePath ? { path: lastFilePath } : null });
    function mount(kind) {
        cleanup.splice(0).forEach(fn => fn()); host.replaceChildren();
        const isResourceContext = kind !== "project", projectRoot = kind === "empty" ? "Resources/Literature" : isResourceContext ? resourcePath : projectPath;
        const contextId = isResourceContext ? "resource:study" : "itacan";
        const current = { file: { path: projectRoot + (isResourceContext ? "/Knowledge.md" : "/Itacan.md") }, projectId: contextId, folder_order: [] };
        root = host.createDiv({ cls: "project-dashboard hub-button-scope" });
        const nav = root.createDiv({ cls: "project-nav-dock" });
        nav.createDiv({ cls: "project-nav-identity", text: isResourceContext ? "Knowledge" : "Itacan" });
        const controls = nav.createDiv({ cls: "project-nav" });
        for (const text of ["Home", "Workspace", "Last File", "Presets"]) controls.createEl("button", { cls: "project-nav-button", text });
        const grid = root.createDiv({ cls: "project-main-grid" }), left = grid.createDiv({ cls: "project-left-column" });
        const dv = { component }, resourceTypes = [{ id: "study", label: "Knowledge" }], resourceType = resourceTypes[0];
        const el = (parent, tag, cls, text) => parent.createEl(tag, { cls, text });
        controller = new Function("app", "dv", "left", "root", "current", "projectRoot", "contextId", "isResourceContext", "resourceTypes", "resourceType", "fileDomain", "el", "moment", "openProjectNote", `
            const {directFiles,directFolders,isFolder,projectChildPath,projectItemPath,selectedRootPaths,availableExternalFilePath}=fileDomain;
            ${folderSource}
            return workspaceExplorer;
        `)(app, dv, left, root, current, projectRoot, contextId, isResourceContext, resourceTypes, resourceType, fileDomain, el,
            value => ({ format: () => new Date(value).toLocaleDateString("en-GB") }), (file, placement = "replace") => { opens.push({ file, placement }); });
        const right = grid.createDiv({ cls: "project-right-column" });
        tasks = right.createDiv({ cls: "project-panel project-tasks" });
        tasks.createDiv({ cls: "project-panel-title", text: "Tasks" });
        tasks.createDiv({ text: "Solve problems 6.1–6.4" });
        right.createDiv({ cls: "project-panel project-progress", text: "Progress · History" });
    }
    const setMode = async note => {
        host.classList.toggle("hub-project-rail", note);
        for (const [listener, name] of listeners) if (name === "layout-change") listener();
        await settle();
    };
    const treeItem = path => [...root.querySelectorAll("[role=treeitem]")].find(element => element.dataset.treePath === path);
    const row = path => treeItem(path)?.firstElementChild;
    const toggle = path => row(path).querySelector(".hub-explorer-disclosure").click();
    const search = query => { const input = root.querySelector("input[type=search]"); input.value = query; input.dispatchEvent(new Event("input")); };
    const key = (element, value, options = {}) => element.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options }));
    const menu = path => { row(path).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })); return menus.at(-1); };
    stored["resource:study"] = { [math]: { sortKey: "name", sortDirection: "desc" } };
    mount("resource"); await settle();
    assert(root.querySelectorAll("input[type=search]").length === 1, "One workspace search; no per-folder panels");
    assert(!root.querySelector(".project-folder-panel"), "Independent panels replaced");
    assert(row(math).querySelector('[data-icon="chevron-right"]'), "Collapsed root uses chevron-right");
    const objectIcon = path => row(path).querySelector(":scope > .hub-explorer-icon");
    assert(objectIcon(math).dataset.icon === "folder", "Ordinary workspace roots use the closed folder icon");
    toggle(math); assert(treeItem(math).getAttribute("aria-expanded") === "true", "Disclosure expands");
    assert(objectIcon(math).dataset.icon === "folder-open", "Expanded workspace root uses folder-open");
    assert(objectIcon(course).dataset.icon === "folder", "Collapsed nested folder uses folder");
    toggle(course); assert(row(course).querySelector('[data-icon="chevron-down"]'), "Expanded folder uses chevron-down");
    assert(objectIcon(course).dataset.icon === "folder-open", "Expanded nested folder uses folder-open");
    function checkTreeSpacing() {
        const folderIcon = objectIcon(assignments).getBoundingClientRect();
        const fileIcon = objectIcon(course + "/Course literature.pdf").getBoundingClientRect();
        const emptyIcon = objectIcon(course + "/Course Information").getBoundingClientRect();
        assert(folderIcon.left === fileIcon.left && fileIcon.left === emptyIcon.left, "Sibling file, empty-folder and expandable-folder icons align");
        const disclosure = row(assignments).querySelector(".hub-explorer-disclosure").getBoundingClientRect();
        const slot = row(course + "/Course literature.pdf").querySelector(".hub-explorer-disclosure-space").getBoundingClientRect();
        assert(disclosure.width === 24 && disclosure.height === 26 && slot.width === disclosure.width, "Full disclosure hit target and equal leaf slot retained");
        assert(folderIcon.left - disclosure.right === 2, "Chevron-to-icon gap is tighter without overlapping the click target");
        const step = folderIcon.left - objectIcon(course).getBoundingClientRect().left;
        assert(step >= 14 && step <= 20, "Children retain clear responsive nesting");
        const group = treeItem(course).querySelector(":scope > [role=group]");
        const groupStyle = getComputedStyle(group), guideStyle = getComputedStyle(group, "::before");
        assert(groupStyle.backgroundColor === "rgba(0, 0, 0, 0)" && groupStyle.backgroundImage === "none" && groupStyle.boxShadow === "none", "Branch containers paint no dark background or shadow");
        assert(guideStyle.backgroundImage === "none" && guideStyle.boxShadow === "none" && guideStyle.opacity === "1", "Guides have no fading or shadow around their border");
        const guide = group.getBoundingClientRect().left + parseFloat(guideStyle.left);
        const parentDisclosure = row(course).querySelector(".hub-explorer-disclosure").getBoundingClientRect();
        assert(Math.abs(guide - (parentDisclosure.left + parentDisclosure.width / 2)) < 1, "Guide stays on its parent disclosure column");
    }
    checkTreeSpacing();
    assert(!row(course + "/Course literature.pdf").querySelector("button"), "Files have no disclosure");
    assert(!row(course + "/Course Information").querySelector("button"), "Empty folders have no disclosure");
    row(course).click(); assert(root.querySelector(".hub-explorer-breadcrumb").textContent.includes("Topology"), "Selection updates contents breadcrumb");
    assert(root.querySelectorAll(".hub-explorer-column").length === 3, "Name, Modified and Created retained");
    assert(treeItem(course).getAttribute("aria-expanded") === "false", "Folder blank-row click collapses exactly once and selects contents");
    row(course).querySelector(":scope > .hub-explorer-icon").click();
    assert(treeItem(course).getAttribute("aria-expanded") === "true", "Folder icon click expands exactly once");
    row(course).querySelector(".hub-explorer-name").click();
    assert(treeItem(course).getAttribute("aria-expanded") === "false", "Folder name click collapses exactly once");
    toggle(course);
    assert(treeItem(course).getAttribute("aria-expanded") === "true", "Chevron expands exactly once without bubbling to row");
    assert(getComputedStyle(objectIcon(course)).color === "rgb(170, 170, 170)", "Selected folder icon stays neutral");
    assert(getComputedStyle(row(course)).backgroundColor !== "rgba(0, 0, 0, 0)" && getComputedStyle(row(course), "::after").content === "none", "Selected folder keeps purple row tint without a left indicator");
    assert(getComputedStyle(objectIcon(math)).color === "rgb(170, 170, 170)" && getComputedStyle(objectIcon(assignments)).color === "rgb(170, 170, 170)", "Unselected roots, ancestors and descendants stay neutral");
    assert(getComputedStyle(row(course).querySelector(".hub-explorer-disclosure .hub-explorer-icon")).color === "rgb(119, 119, 119)", "Chevrons remain subdued even on selected rows");
    assert([...root.querySelectorAll(".hub-explorer-detail-name > .hub-explorer-icon")].every(icon => getComputedStyle(icon).color === "rgb(170, 170, 170)"), "Unselected contents icons are neutral");
    const details = root.querySelector(".hub-explorer-contents");
    assert([...details.querySelectorAll("[data-path]")].some(item => item.dataset.path === assignments), "Selected folder contents shown");
    const nameSort = root.querySelector(".hub-explorer-column");
    assert(nameSort.querySelector('[data-icon="chevron-down"]'), "Legacy root-panel sort applies to its selected descendant");
    nameSort.click();
    assert(stored["resource:study"][course].sortKey === "name", "Existing sort state persisted by folder path");
    const savedExpansion = stored["resource:study"][math].collapsed;
    search("Homework"); assert(row(assignments + "/Homework.md") && row(math) && row(course), "Search finds deep files and keeps ancestors");
    assert(!row(resourcePath + "/Physics"), "Search omits unrelated branches");
    search("missing query"); assert(root.textContent.includes("No matching files or folders"), "No matches state");
    search(""); assert(stored["resource:study"][math].collapsed === savedExpansion && !row(assignments + "/Homework.md"), "Clearing search restores saved expansion");
    const before = opens.length; toggle(assignments); assert(opens.length === before, "Disclosure does not open a file");
    row(assignments + "/Homework.md").click(); await settle();
    assert(opens.at(-1).file === objects.get(assignments + "/Homework.md"), "Open passes canonical vault file through existing handler");
    assert(!treeItem(assignments + "/Homework.md").hasAttribute("aria-current"), "Opening a file cannot give Full-view an active-file highlight");
    assert(stored["resource:study"][resourcePath].currentPath === course, "File opening preserves Full-view's remembered folder");
    await setMode(true);
    assert(treeItem(assignments + "/Homework.md").getAttribute("aria-current") === "true", "Note-view highlights the active file");
    assert(!root.querySelector(".is-current-folder"), "Note-view does not highlight the Full-view folder");
    assert(getComputedStyle(objectIcon(assignments + "/Homework.md")).color === "rgb(170, 170, 170)", "Active file icon stays neutral");
    row(assignments).click();
    assert(treeItem(assignments).getAttribute("aria-expanded") === "false", "Note-view row collapses once");
    row(assignments).querySelector(".hub-explorer-name").click();
    assert(treeItem(assignments).getAttribute("aria-expanded") === "true", "Note-view folder name expands once");
    assert(stored["resource:study"][resourcePath].currentPath === course, "Note-view folder clicks do not replace Full-view selection");
    for (const [listener, name] of listeners) if (name === "file-open") listener(objects.get(resourcePath + "/Knowledge.md"));
    assert(treeItem(assignments + "/Homework.md").getAttribute("aria-current") === "true", "Focusing the dashboard rail preserves the visible active file");
    row(assignments + "/Homework.md").dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true })); await settle();
    assert(opens.at(-1).placement === "split", "Middle click retains split opening");
    const openCount = opens.length;
    const noteSnapshot = root.hubCaptureFolders();
    await setMode(false);
    assert(!root.querySelector(".is-active-file") && !treeItem(assignments + "/Homework.md").hasAttribute("aria-current"), "Returning Full clears only the active-file visual state");
    assert(row(course).classList.contains("is-current-folder") && root.querySelector(".hub-explorer-breadcrumb").textContent.includes("Topology"), "Full restores its own folder and contents");
    root.hubRestoreFolders(noteSnapshot);
    assert(row(course).classList.contains("is-current-folder") && !root.querySelector(".is-active-file"), "Preset restores Full folder without leaking active Note file");
    await setMode(true);
    assert(treeItem(assignments + "/Homework.md").getAttribute("aria-current") === "true" && opens.length === openCount, "Returning Note retains active file without reopening or changing tabs");
    await setMode(false);
    treeItem(course).focus(); key(treeItem(course), "ArrowLeft"); assert(treeItem(course).getAttribute("aria-expanded") === "false", "Keyboard collapses");
    key(treeItem(course), "ArrowRight"); key(treeItem(course), "ArrowRight"); assert(document.activeElement.dataset.treePath === assignments, "Keyboard expands then enters children");
    key(treeItem(assignments), "ArrowDown", { shiftKey: true });
    assert(treeItem(assignments).getAttribute("aria-selected") === "true" && document.activeElement.getAttribute("aria-selected") === "true", "Shift arrow includes its starting row and destination");
    key(document.activeElement, "Escape");
    const group = treeItem(course).querySelector(":scope > [role=group]");
    assert(getComputedStyle(group, "::before").pointerEvents === "none", "Guide is noninteractive");
    assert(group.getBoundingClientRect().bottom <= treeItem(resourcePath + "/Physics").getBoundingClientRect().top, "Branch guide ends before unrelated siblings");
    const snapshot = root.hubCaptureFolders(); toggle(course); root.hubRestoreFolders(snapshot);
    assert(treeItem(course).getAttribute("aria-expanded") === "true", "Preset restores expansion using existing snapshot interface");
    toggle(math); const collapsedSnapshot = root.hubCaptureFolders(); root.hubRestoreFolders(collapsedSnapshot);
    assert(treeItem(math).getAttribute("aria-expanded") === "false", "Preset retains intentionally collapsed ancestor of selected folder");
    toggle(math);
    row(math).click();
    const courseDetail = [...root.querySelectorAll(".hub-explorer-detail-row")].find(element => element.dataset.path === course);
    courseDetail.click(); assert(document.activeElement === treeItem(course), "Contents navigation preserves keyboard focus in tree"); assert(row(course) && row(course).classList.contains("is-current-folder"), "Details navigation reveals selected location without expanding it");
    // Keyboard multi-selection only visits the focused pane; roots stay protected.
    treeItem(course).focus(); key(treeItem(course), "a", { ctrlKey: true });
    assert(treeItem(math).getAttribute("aria-selected") === "false", "Select all cannot select shared/workspace root for bulk deletion");
    key(treeItem(course), "Escape");
    const creation = menu(assignments); creation.newNote();
    let input = root.querySelector(".project-create-input"); input.value = "New study note"; key(input, "Enter"); await settle();
    assert(objects.has(assignments + "/New study note.md"), "Existing creation handler creates nested Resource note");
    assert(!opens.some(open => open.file.path.endsWith("New study note.md")), "Creation retains existing closed-file behavior");
    row(assignments).click();
    if (treeItem(assignments).getAttribute("aria-expanded") !== "true") toggle(assignments);
    await menu(assignments).rename("Exercises"); await settle();
    const exercises = course + "/Exercises";
    assert(row(exercises)?.classList.contains("is-current-folder") && row(exercises + "/New study note.md"), "Rename preserves selection and expanded descendants");
    await menu(exercises).rename("Assignments"); await settle();
    const transfer = new DataTransfer();
    row(assignments + "/New study note.md").dispatchEvent(new DragEvent("dragstart", { dataTransfer: transfer, bubbles: true }));
    row(course + "/Course Information").dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true })); await settle();
    assert(objects.has(course + "/Course Information/New study note.md"), "Existing internal drop moves the canonical file");
    toggle(course + "/Course Information");
    await menu(course + "/Course Information/New study note.md").moveTo(assignments); await settle();
    const importTransfer = new DataTransfer(); importTransfer.items.add(new File(["Imported note"], "Imported.md", { type: "text/markdown" }));
    row(assignments).dispatchEvent(new DragEvent("drop", { dataTransfer: importTransfer, bubbles: true, cancelable: true })); await settle();
    assert(objects.has(assignments + "/Imported.md"), "Existing external import uses selected Resource folder");
    row(assignments + "/Imported.md").dispatchEvent(new MouseEvent("click", { ctrlKey: true, bubbles: true }));
    key(treeItem(assignments + "/Imported.md"), "Delete"); await settle();
    assert(!objects.has(assignments + "/Imported.md"), "Tree selection retains existing native-trash Delete behavior");
    root.querySelector(".hub-explorer-new-folder").click(); input = root.querySelector(".project-create-input"); input.value = "Chemistry"; key(input, "Enter"); await settle();
    assert(row(resourcePath + "/Chemistry"), "Workspace folder creation retained");
    // Restore and refresh are independent of the rail's existing width state.
    host.classList.add("hub-project-rail", "hub-project-rail-pane"); host.style.width = "460px";
    const visibleSearch = root.querySelector(".hub-explorer-search-input");
    const rail = load("ui/note-rail").mountNoteRail(host, "full"); await settle();
    const bounds = () => [root.querySelector(".hub-workspace-explorer").getBoundingClientRect(), tasks.getBoundingClientRect()];
    for (const width of [460, 600, 330]) {
        host.style.width = width + "px"; await settle();
        const [a, b] = bounds(); assert(Math.abs(a.left - b.left) < 1 && Math.abs(a.right - b.right) < 1, "Explorer/Tasks alignment at full width " + width);
        assert(getComputedStyle(root.querySelector(".hub-explorer-search")).display !== "none", "Full sidebar has search");
        assert(getComputedStyle(root.querySelector(".hub-explorer-details")).display === "none", "Note-view has no details table");
        checkTreeSpacing();
    }
    host.querySelector(".hub-rail-toggle").click(); host.style.width = "230px"; await settle();
    assert(host.dataset.hubRailState === "half", "Existing half state");
    assert(getComputedStyle(root.querySelector(".hub-explorer-search")).display !== "none", "Half state retains the same search field");
    assert(root.querySelector(".hub-explorer-search-input") === visibleSearch, "Resizing keeps the same search input and query state");
    assert(visibleSearch.getBoundingClientRect().width > 0 && visibleSearch.closest(".hub-explorer-search").scrollWidth <= visibleSearch.closest(".hub-explorer-search").clientWidth, "Half-width search fits without horizontal overflow");
    const [a, b] = bounds(); assert(a.left === b.left && a.right === b.right, "Half sidebar Tasks alignment");
    checkTreeSpacing();
    assert(root.scrollWidth <= root.clientWidth + 1, "No sidebar horizontal overflow");
    const expansion = treeItem(math).getAttribute("aria-expanded");
    host.querySelector(".hub-rail-toggle").click(); await settle(); assert(host.dataset.hubRailState === "closed", "Existing hidden state");
    host.querySelector(".hub-rail-toggle").click(); await settle(); assert(treeItem(math).getAttribute("aria-expanded") === expansion, "Expansion survives half/hidden/restored state");
    rail.destroy(); host.classList.remove("hub-project-rail", "hub-project-rail-pane"); host.style.width = "1000px";
    add("Resources/Literature"); add("Resources/Literature/Knowledge.md", false);
    mount("empty"); await settle();
    assert(!root.querySelector("[role=treeitem]") && root.textContent.includes("No workspace folders yet"), "Empty workspace has clean geometry and creation action");
    root.querySelector(".hub-explorer-new-folder").click(); input = root.querySelector(".project-create-input"); input.value = "First folder"; key(input, "Enter"); await settle();
    assert(row("Resources/Literature/First folder") && !row("Resources/Literature/First folder").querySelector("button"), "Empty workspace creates a nonexpandable empty folder");
    mount("project"); toggle(math); toggle(course); await settle();
    assert(row(projectPath + "/Meta") && row(math), "Project local and shared roots coexist");
    add(projectPath + "/Second"); controller.refresh();
    const reorderTransfer = new DataTransfer();
    row(projectPath + "/Atlas").dispatchEvent(new DragEvent("dragstart", { dataTransfer: reorderTransfer, bubbles: true }));
    const targetRect = row(projectPath + "/Second").getBoundingClientRect();
    row(projectPath + "/Second").dispatchEvent(new DragEvent("drop", { dataTransfer: reorderTransfer, bubbles: true, cancelable: true, clientY: targetRect.bottom - 1 })); await settle();
    assert(root.hubCaptureFolders().order.join("|") === "Meta|Second|Atlas", "Workspace root drag retains folder ordering and fixed Meta position");
    assert(row(math).textContent.includes("Shared resource · Knowledge"), "Shared Resource origin explicitly visible");
    row(math).click();
    assert(treeItem(math).getAttribute("aria-expanded") === "false" && objectIcon(math).dataset.icon === "folder-symlink", "Shared row collapses once and retains symlink semantics");
    assert(getComputedStyle(objectIcon(math)).color === "rgb(170, 170, 170)", "Selected shared reference icon stays neutral");
    row(math).querySelector(":scope > .hub-explorer-icon").click();
    assert(treeItem(math).getAttribute("aria-expanded") === "true" && objectIcon(math).dataset.icon === "folder-symlink", "Shared icon click expands once and retains symlink semantics");
    assert(!menu(math).delete && !!menus.at(-1).detach, "Shared root offers detach, never deletion of underlying Resource");
    menu(projectPath + "/Meta").newFolder(); input = root.querySelector(".project-create-input"); input.value = "Local folder"; key(input, "Enter"); await settle();
    assert(creations.at(-1) === projectPath + "/Meta/Local folder", "Project-local creation remains local");
    menu(course).newNote(); input = root.querySelector(".project-create-input"); input.value = "Shared edit"; key(input, "Enter"); await settle();
    assert(creations.at(-1) === course + "/Shared edit.md", "Project creation in shared branch targets original Resource path");
    row(course + "/Shared edit.md").click(); await settle(); assert(opens.at(-1).file === objects.get(course + "/Shared edit.md"), "Project opens the same shared Resource file");
    host.classList.add("hub-project-rail", "hub-project-rail-pane"); host.dataset.hubRailState = "half"; host.style.width = "230px"; await settle();
    assert(getComputedStyle(row(math).querySelector(".hub-explorer-origin")).display !== "none", "Resource origin remains visible in half sidebar");
    assert(objectIcon(math).dataset.icon === "folder-symlink", "Half sidebar keeps shared-reference icon");
    assert(row(math).querySelector(".hub-explorer-origin").getBoundingClientRect().width <= row(math).getBoundingClientRect().width, "Origin wraps within sidebar");
    search("very long filename"); await settle();
    assert(root.scrollWidth <= root.clientWidth + 1, "Deep nesting does not widen sidebar");
    search(""); host.classList.remove("hub-project-rail", "hub-project-rail-pane"); delete host.dataset.hubRailState; host.style.width = "1000px";
    await menu(math).detach(); await settle(); assert(!row(math) && objects.has(course + "/Shared edit.md"), "Detach removes reference while preserving Resource files");
    // A workspace without remembered Full selection uses the active file's parent.
    const savedResource = structuredClone(stored["resource:study"]);
    stored["resource:study"] = {};
    mount("resource"); await setMode(true);
    controller.setActive(assignments + "/Homework.md");
    assert(treeItem(assignments + "/Homework.md").getAttribute("aria-current") === "true", "External file-open reveals the Note file");
    const fallbackSnapshot = root.hubCaptureFolders();
    await setMode(false);
    assert(row(assignments).classList.contains("is-current-folder") && !root.querySelector(".is-active-file"), "No remembered Full folder falls back to active file parent");
    root.hubRestoreFolders(fallbackSnapshot);
    assert(row(assignments).classList.contains("is-current-folder"), "Fallback survives restoration without inventing persisted selection");
    lastFilePath = assignments + "/Homework.md";
    mount("resource"); await settle();
    assert(row(assignments).classList.contains("is-current-folder") && !root.querySelector(".is-active-file"), "Remounted Full view uses scoped Last File parent without file highlight");
    toggle(course);
    const collapsedLastFile = root.hubCaptureFolders();
    mount("resource"); await setMode(true);
    assert(treeItem(course).getAttribute("aria-expanded") === "false", "Last File seeding does not reopen a deliberately collapsed branch");
    root.hubRestoreFolders(collapsedLastFile);
    toggle(course);
    assert(treeItem(lastFilePath).getAttribute("aria-current") === "true", "Remounted Note view remembers its active file from existing history");
    assert(window.hubGetLastNavigation().file.path === lastFilePath, "View selection never rewrites Last File");
    lastFilePath = null; await setMode(false);
    stored["resource:study"] = savedResource;
    window.hubGetProjectResourceFolders = () => [shared]; mount("resource"); row(course).click(); await settle();
    window.explorerPreview = async (kind, mode, width) => {
        host.classList.toggle("hub-project-rail", mode !== "workspace"); host.classList.toggle("hub-project-rail-pane", mode !== "workspace");
        host.dataset.hubRailState = mode === "half" ? "half" : "full"; host.style.width = width + "px";
        mount(kind); search("Topology"); search("");
        if (treeItem(math)?.getAttribute("aria-expanded") !== "true") toggle(math);
        if (treeItem(course)?.getAttribute("aria-expanded") !== "true") toggle(course);
        row(course).click();
        if (treeItem(course)?.getAttribute("aria-expanded") !== "true") toggle(course);
        await settle();
        root.querySelector(".hub-explorer-tree").scrollTop = 0;
        document.activeElement?.blur();
    };
    assert(runtimeErrors.length === 0, "No asynchronous runtime errors: " + runtimeErrors.join("; "));
    document.getElementById("result").textContent = "PASS: canonical Lucide resolution; neutral selected icons; single row/disclosure toggles; separate Full/Note selection and contextual fallback; live dashboard integration; Resource/local/shared trees; canonical shared edits and detach; search/ancestor filtering; disclosure, empty-folder and file semantics; metadata sorting; keyboard and split opening; creation; preset restoration; hierarchy guides; full/half/hidden rail; Tasks alignment and narrow/deep layouts.";
} catch (error) { document.getElementById("result").textContent = "FAIL: " + error.stack; } };
