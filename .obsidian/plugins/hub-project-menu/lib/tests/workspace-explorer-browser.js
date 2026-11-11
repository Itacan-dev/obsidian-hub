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
const icons = { "folder-tree": "M3 3h6l2 2h10v6H3zM3 11v10h6m-6-5h6M9 14h8v5H9z", "notebook-text": "M4 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4zM8 3v18M2 7h4M2 12h4M2 17h4M12 8h4M12 12h4", "folder-symlink": "M3 7h6l2-3h9v16H3zM7 15h9m-3-3 3 3-3 3", folder: "M3 7h6l2-3h9v16H3z", "folder-open": "M3 7h6l2-3h9v5H5l-2 11V7m2 2h17l-3 11H3", "chevron-right": "m9 5 7 7-7 7", "chevron-down": "m5 9 7 7 7-7", "chevron-up": "m5 15 7-7 7 7", search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6", "file-text": "M5 3h9l5 5v13H5zM9 12h6M9 16h6", "file-type": "M5 3h9l5 5v13H5zM9 12h6m-3 0v5", "folder-plus": "M3 7h6l2-3h9v16H3zM8 13h8m-4-4v8" };
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
    const names = ["ui/color-system", "domain/dates", "domain/files", "domain/workspace-explorer", "ui/file-icons", "ui/icons", "ui/workspace-explorer", "ui/note-rail", "ui/tooltips"];
    const sources = Object.fromEntries(await Promise.all(names.map(async name => [name, await (await fetch("../" + name + ".js")).text()]))), cache = {};
    function load(name) {
        if (name === "obsidian") return { setIcon, getIcon, addIcon: name => { icons[name] = "M3 5h18"; } };
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
    let clipboard=null;
    window.hubFileOperations={
        move:(path,to)=>app.fileManager.renameFile(objects.get(path),to),rename:(path,to)=>app.fileManager.renameFile(objects.get(path),to),trash:path=>app.fileManager.trashFile(objects.get(path)),
        async batch(kind,paths,target){for(const path of paths)await(kind==='trash'?this.trash(path):this.move(path,target+'/'+objects.get(path).name));},
        setClipboard(paths,cut=false){clipboard={paths,cut};},
        async paste(target){if(!clipboard?.paths.length)throw Error('The Itacan clipboard is empty.');
            for(const path of clipboard.paths){const item=objects.get(path),to=target+'/'+item.name;if(objects.has(to))throw Error('Collision');
                if(clipboard.cut)await this.move(path,to);else for(const entry of [...objects.values()].filter(e=>e.path===path||e.path.startsWith(path+'/')))add(to+entry.path.slice(path.length),!entry.extension);
            }if(clipboard.cut)clipboard.paths=[];
        }
    };
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
        controller = new Function("app", "dv", "left", "root", "current", "projectRoot", "contextId", "isResourceContext", "resourceTypes", "resourceType", "fileDomain", "el", "moment", "formatDateTime", "openProjectNote", `
            const {directFiles,directFolders,isFolder,projectChildPath,projectItemPath,selectedRootPaths,availableExternalFilePath}=fileDomain;
            ${folderSource}
            return workspaceExplorer;
        `)(app, dv, left, root, current, projectRoot, contextId, isResourceContext, resourceTypes, resourceType, fileDomain, el,
            value => new Date(value), load("domain/dates").formatDateTime, (file, placement = "replace") => { opens.push({ file, placement }); });
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

    const fullMenus = [], reveals = [], copied = [];
    window.hubTaskOwner = path => ({ root: path.startsWith(resourcePath) ? resourcePath : projectPath });
    window.hubExplorerHost = {
        showMenu(event, entries) { fullMenus.push(entries); return { hide() {} }; },
        canReveal: () => true, reveal: (...args) => reveals.push(args), copyPaths: paths => copied.push(paths),
        renameFolder: async (name, run) => run(name + " renamed"), deleteFolder: async (name, run) => run(),
        renameFile() {}, duplicateFile() {}, deleteFile: path => app.fileManager.trashFile(objects.get(path)),
        openWindow: path => opens.push({ path, placement: "window" }), moveTo: run => run(assignments)
    };
    const detail = path => [...root.querySelectorAll('.hub-explorer-contents [data-path]')].find(e => e.dataset.path === path);
    const dbl = element => element.dispatchEvent(new MouseEvent('dblclick', {bubbles:true,cancelable:true}));
    const click = (element, options = {}) => element.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true,...options}));
    const titles = entries => entries.filter(Boolean).map(e => e.title);
    const fullMenu = (element, title) => { element.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})); const entries=fullMenus.at(-1); return title ? entries.find(e=>e?.title===title) : entries; };
    const input = () => root.querySelector('.project-create-input');
    const create = async (button, name) => { button.click(); input().value=name; key(input(),'Enter'); await settle(); };
    const current = path => row(path)?.classList.contains('is-current-folder');
    mount('resource'); await settle();
    assert(treeItem(resourcePath)?.getAttribute('aria-expanded')==='true','Explicit root is expanded initially');
    assert(!row(resourcePath+'/Knowledge.md'),'Dashboard excluded');
    assert(!root.querySelector('.hub-explorer-tree [data-path$=".md"]'),'Full tree contains folders only');
    assert(root.querySelector('.hub-explorer-create-note').disabled,'Root New note disabled');
    assert(getComputedStyle(root.querySelector('.hub-explorer-new-folder')).display==='none','Old bottom creation button absent in Full');
    assert(getComputedStyle(root.querySelector('.hub-explorer-search')).display==='none','Full keeps Files heading without Note search');
    const toolbar=root.querySelector('.hub-explorer-toolbar').getBoundingClientRect(), location=root.querySelector('.hub-explorer-location').getBoundingClientRect();
    assert(Math.abs(toolbar.top-location.top)<1&&Math.abs(toolbar.bottom-location.bottom)<1,'Toolbar and breadcrumbs share one row');
    assert(root.querySelectorAll('.hub-explorer-toolbar > button').length===3&&!root.querySelector('.hub-explorer-toolbar').textContent,'Three centered icon-only actions');
    const buttons=[...root.querySelectorAll('.hub-explorer-toolbar > button')].map(e=>e.getBoundingClientRect());
    assert(Math.abs(buttons[0].width-buttons[2].width)<1,'Toolbar actions evenly spaced');
    const width=root.querySelector('.hub-explorer-tree').getBoundingClientRect().width;
    const separator=root.querySelector('.hub-explorer-splitter'); separator.focus(); key(separator,'ArrowRight'); await settle();
    assert(root.querySelector('.hub-explorer-tree').getBoundingClientRect().width>width,'Keyboard separator resizes navigation');
    assert(stored['resource:study'][resourcePath].fullExplorer.treeWidth>width,'Separator width persists independently');
    row(math).click(); assert(current(math)&&treeItem(math).getAttribute('aria-expanded')==='false','Folder navigation does not toggle disclosure');
    toggle(math); assert(treeItem(math).getAttribute('aria-expanded')==='true'&&current(math),'Disclosure preserves navigation');
    row(course).click(); toggle(course); assert(current(course),'Nested folder navigation');
    assert(!row(course+'/Tasks.md')&&detail(course+'/Tasks.md'),'Files only appear in right contents');
    const opened=opens.length; detail(course+'/Tasks.md').click();
    assert(opens.length===opened&&detail(course+'/Tasks.md').classList.contains('is-selected'),'Single click selects without opening');
    click(detail(course+'/Tasks.md')); key(detail(course+'/Tasks.md'),'F2'); assert(input()?.getAttribute('aria-label')==='Rename item','F2 opens inline rename'); key(input(),'Escape');
    key(detail(course+'/Tasks.md'),'v',{ctrlKey:true}); await settle(); assert(root.querySelector('.hub-explorer-status').textContent.includes('clipboard'),'Empty clipboard error stays scoped to Files');
    dbl(detail(course+'/Tasks.md')); await settle(); assert(opens.length===opened+1,'Double click opens through existing route');
    const folder=detail(assignments); folder.click(); assert(current(course),'Single clicking contents folder does not navigate');
    dbl(folder); assert(current(assignments),'Double click navigates folder');
    root.querySelector('.hub-explorer-crumb').click(); assert(current(resourcePath),'Root breadcrumb navigates and synchronizes');
    row(math).click(); row(course).click();
    const paths=[...root.querySelectorAll('.hub-explorer-contents [data-path]')].map(e=>e.dataset.path);
    click(detail(paths[0])); click(detail(paths[2]),{shiftKey:true});
    assert(root.querySelectorAll('.hub-explorer-contents .is-selected').length===3,'Shift range includes its anchor');
    click(detail(paths[3]),{ctrlKey:true}); assert(root.querySelectorAll('.hub-explorer-contents .is-selected').length===4,'Ctrl adds selection');
    const multi=fullMenu(detail(paths[1])); assert(titles(multi).includes('Copy paths'),'Right click selected item retains batch');
    fullMenu(detail(paths[4])); assert(root.querySelectorAll('.hub-explorer-contents .is-selected').length===1,'Right click unselected item selects it alone');
    const firstDetail=detail(paths[0]); firstDetail.focus(); key(firstDetail,'a',{ctrlKey:true});
    assert(root.querySelectorAll('.hub-explorer-contents .is-selected').length===paths.length,'Ctrl+A scoped to contents');
    treeItem(course).focus(); assert(!root.querySelector('.hub-explorer-contents .is-selected'),'Switching pane clears operation selection');
    key(treeItem(course),'a',{ctrlKey:true}); assert(treeItem(resourcePath).getAttribute('aria-selected')==='false','Select all excludes protected root');
    key(treeItem(course),'Escape');
    row(course).click();
    fullMenu(root.querySelector('.hub-explorer-contents'));
    assert(titles(fullMenus.at(-1)).join('|')==='New note|New folder|Paste|Show current folder in system explorer','Background menu is contextual');
    const fileEntries=fullMenu(detail(course+'/Tasks.md'));
    assert(titles(fileEntries).includes('Open')&&titles(fileEntries).includes('Rename')&&titles(fileEntries).includes('Delete'),'File menu retains supported operations');
    assert(titles(fileEntries).includes('Cut')&&titles(fileEntries).includes('Copy')&&!titles(fileEntries).some(t=>/Obsidian|Bookmark|Make a copy/.test(t)),'Final native menus include functional clipboard actions');
    fullMenu(detail(course+'/Tasks.md'),'Copy path').run(); assert(copied.at(-1)[0]===course+'/Tasks.md','Copy path is vault-relative');
    const beforeOrder=[...root.querySelectorAll('.hub-explorer-tree [data-path]')].map(e=>e.dataset.path).join('|');
    root.querySelector('[data-sort-key=name]').click();
    assert(stored['resource:study'][resourcePath].fullExplorer.sort.sortDirection==='desc','Header writes shared sort state');
    assert([...root.querySelectorAll('.hub-explorer-tree [data-path]')].map(e=>e.dataset.path).join('|')!==beforeOrder,'Header reorders folder tree');
    root.querySelector('.hub-explorer-sort').click(); const sortOptions=fullMenus.at(-1);
    assert(sortOptions.find(e=>e?.title==='Name: Descending').checked,'Sort menu reads header state');
    sortOptions.find(e=>e?.title==='Modified: Oldest').run();
    assert(root.querySelector('[data-sort-key=modified] [data-icon=chevron-up]'),'Menu updates active column and direction');
    const children=[...treeItem(course).querySelectorAll(':scope > [role=group] > [role=treeitem]')].map(e=>e.getAttribute('aria-label'));
    assert(children.join('|')===[...children].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'})).join('|'),'Date sorting keeps sibling folders alphabetic');
    assert(root.hubCaptureFolders().order.length===0,'Sorting does not write manual ordering');
    key(treeItem(course),'Escape');
    click(row(course),{ctrlKey:true}); click(row(assignments),{ctrlKey:true});
    assert(titles(fullMenu(row(assignments))).includes('Copy paths'),'Ancestor/descendant selection keeps batch menu semantics after deduplication');
    row(assignments).click();
    const count=opens.length;
    root.querySelector('.hub-explorer-create-note').click(); assert(input().value==='Untitled'&&input().selectionStart===0,'New note default selected inline');
    input().value='Cancelled'; key(input(),'Escape'); await settle(); assert(!objects.has(assignments+'/Cancelled.md')&&!input(),'Escape leaves no file');
    await create(root.querySelector('.hub-explorer-create-note'),'Created here');
    assert(objects.has(assignments+'/Created here.md')&&current(assignments),'Toolbar targets current folder');
    assert(opens.length===count&&detail(assignments+'/Created here.md').classList.contains('is-selected'),'Created note remains selected and closed');
    await create(root.querySelector('.hub-explorer-create-folder'),'New child');
    assert(objects.has(assignments+'/New child')&&current(assignments)&&detail(assignments+'/New child').classList.contains('is-selected'),'Folder created selected without entering');
    assert(row(assignments+'/New child'),'New folder appears in navigation tree');
    root.querySelector('.hub-explorer-create-folder').click(); input().value='New child'; key(input(),'Enter'); await settle();
    assert(input()?.getAttribute('aria-invalid')==='true','Duplicate name retains inline error: '+input()?.outerHTML+' '+root.querySelector('.hub-explorer-create-error')?.textContent+' '+runtimeErrors.join(';')); key(input(),'Escape');
    root.querySelector('.hub-explorer-create-note').click(); input().value='Blur cancellation'; root.querySelector('.hub-explorer-sort').focus(); await settle();
    assert(!input()&&!objects.has(assignments+'/Blur cancellation.md'),'Unconfirmed blur cancels without file');
    fullMenu(row(course),'New folder').run(); assert(current(course),'Context creation navigates to target');
    input().value='Context child'; key(input(),'Enter'); await settle(); assert(objects.has(course+'/Context child'),'Context creation uses target folder');
    fullMenu(root.querySelector('.hub-explorer-tree'),'New folder').run(); assert(current(resourcePath),'Left empty space targets workspace root');
    input().value='Chemistry'; key(input(),'Enter'); await settle(); assert(objects.has(resourcePath+'/Chemistry'),'Left background creates top-level folder');
    assert(fullMenu(row(resourcePath),'New note').disabled,'Root menu New note disabled');
    const legacy=add(resourcePath+'/Legacy.md',false); controller.refresh();
    assert(detail(legacy.path)&&!row(legacy.path),'Legacy root files remain visible in right pane');
    const fileTransfer=new DataTransfer();
    row(math).click(); row(course).click();
    detail(course+'/Tasks.md').dispatchEvent(new DragEvent('dragstart',{dataTransfer:fileTransfer,bubbles:true}));
    row(resourcePath).dispatchEvent(new DragEvent('drop',{dataTransfer:fileTransfer,bubbles:true,cancelable:true})); await settle();
    assert(objects.has(course+'/Tasks.md')&&!objects.has(resourcePath+'/Tasks.md'),'Internal file drop at root is rejected');
    const externalRoot=new DataTransfer(); externalRoot.items.add(new File(['Synthetic root import'],'Rejected.md',{type:'text/markdown'}));
    row(resourcePath).dispatchEvent(new DragEvent('drop',{dataTransfer:externalRoot,bubbles:true,cancelable:true})); await settle();
    assert(!objects.has(resourcePath+'/Rejected.md')&&root.querySelector('.hub-explorer-status').textContent.includes('workspace folder'),'External root import rejected with visible feedback');
    // Movement, inline rename and deletion use the shared-operation adapter.
    row(assignments).click();
    const transfer=new DataTransfer(); detail(assignments+'/Created here.md').dispatchEvent(new DragEvent('dragstart',{dataTransfer:transfer,bubbles:true}));
    row(course).dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true})); await settle();
    assert(objects.has(course+'/Created here.md'),'Existing internal file movement retained');
    await fullMenu(row(assignments),'Rename').run(); input().value='Assignments renamed'; key(input(),'Enter'); await settle();
    const renamed=course+'/Assignments renamed'; assert(current(renamed)&&row(renamed),'Folder rename preserves selected navigation');
    // Full/Note renderer regression: mixed files, old menus, search, toggles, split opening.
    await setMode(true);
    assert(getComputedStyle(root.querySelector('.hub-explorer-toolbar')).display==='none','Note view hides Full toolbar');
    search('Homework'); assert(row(renamed+'/Homework.md')&&row(math)&&row(course),'Note search retains matching files and ancestors');
    assert(!row(resourcePath+'/Physics'),'Note search excludes unrelated branch'); search('');
    if(treeItem(renamed).getAttribute('aria-expanded')!=='true')toggle(renamed);
    controller.setActive(renamed+'/Homework.md'); assert(treeItem(renamed+'/Homework.md').getAttribute('aria-current')==='true','Note retains active-file indication');
    row(renamed).click(); assert(treeItem(renamed).getAttribute('aria-expanded')==='false','Note folder row retains collapse behavior');
    row(renamed).querySelector('.hub-explorer-name').click(); assert(treeItem(renamed).getAttribute('aria-expanded')==='true','Note folder name retains expansion behavior');
    const objectIcon = path => row(path).querySelector(':scope > .hub-explorer-icon');
    const folderIcon=objectIcon(renamed).getBoundingClientRect(), fileIcon=objectIcon(course+'/Course literature.pdf').getBoundingClientRect();
    assert(folderIcon.left===fileIcon.left,'Note sibling folder/file icons retain alignment');
    const disclosure=row(renamed).querySelector('.hub-explorer-disclosure').getBoundingClientRect();
    assert(disclosure.width===24&&disclosure.height===26,'Note disclosure hit target retained');
    assert(getComputedStyle(objectIcon(renamed)).color==='rgb(170, 170, 170)','Active/selected Note icons remain neutral');
    const noteGroup=treeItem(course).querySelector(':scope > [role=group]'), guide=getComputedStyle(noteGroup,'::before');
    assert(guide.pointerEvents==='none'&&guide.backgroundImage==='none'&&guide.opacity==='1','Note hierarchy guide remains uniform and noninteractive');
    assert(!row(course+'/Course literature.pdf').querySelector('button'),'Note files retain no disclosure control');
    const previousOpens=opens.length; row(renamed+'/Homework.md').click(); await settle(); assert(opens.length===previousOpens+1,'Note retains single-click opening');
    row(renamed+'/Homework.md').dispatchEvent(new MouseEvent('auxclick',{button:1,bubbles:true,cancelable:true})); await settle(); assert(opens.at(-1).placement==='split','Middle click retains split opening');
    for(const [listener,name] of listeners) if(name==='file-open') listener(objects.get(resourcePath+'/Knowledge.md'));
    assert(treeItem(renamed+'/Homework.md').getAttribute('aria-current')==='true','Focusing dashboard rail preserves Note active file');
    const oldMenu=menu(renamed); oldMenu.newNote(); input().value='Note sidebar creation'; key(input(),'Enter'); await settle();
    assert(objects.has(renamed+'/Note sidebar creation.md'),'Existing Note creation retained');
    const noteSnapshot=root.hubCaptureFolders(); await setMode(false);
    assert(current(renamed)&&!root.querySelector('.hub-explorer-tree [data-path$=".md"]'),'Return Full restores folder and removes file rows');
    root.hubRestoreFolders(noteSnapshot); assert(current(renamed),'Preset restoration retains Full folder');
    assert(root.querySelector('[data-sort-key=modified] [data-icon=chevron-up]'),'Full shared sorting survives mode/preset restoration');
    await setMode(true); search('Homework'); await setMode(false);
    assert(row(resourcePath+'/Physics'),'Full ignores retained Note search');
    await setMode(true); assert(root.querySelector('.hub-explorer-search-input').value==='Homework'&&!row(resourcePath+'/Physics'),'Returning Note restores its query'); search(''); await setMode(false);
    // Root disclosure persistence and all layouts/palettes stay bounded.
    toggle(resourcePath); const collapsed=root.hubCaptureFolders(); root.hubRestoreFolders(collapsed);
    assert(treeItem(resourcePath).getAttribute('aria-expanded')==='false','Explicit root collapse persists'); toggle(resourcePath);
    for(const theme of ['dark','light']) for(const size of [1000,660,450,330]) {
        host.style.width=size+'px'; document.body.style.setProperty('--background-primary',theme==='dark'?'#1e1e1e':'#fff'); await settle();
        assert(root.scrollWidth<=root.clientWidth+1,'Full layout bounded at '+theme+' '+size);
        assert(root.querySelector('.hub-explorer-tree').clientWidth>0&&root.querySelector('.hub-explorer-contents').clientWidth>0,'Both panes usable');
    }
    host.style.width='460px'; host.classList.add('hub-project-rail','hub-project-rail-pane'); await setMode(true);
    const rail=load('ui/note-rail').mountNoteRail(host,'full'); await settle();
    for(const size of [460,330,230]) { host.style.width=size+'px'; await settle(); assert(root.scrollWidth<=root.clientWidth+1,'Note layout bounded '+size); assert(getComputedStyle(root.querySelector('.hub-explorer-search')).display!=='none','Note search remains visible'); }
    rail.destroy(); host.classList.remove('hub-project-rail','hub-project-rail-pane'); host.style.width='1000px'; await setMode(false);
    add('Resources/Literature'); add('Resources/Literature/Knowledge.md',false); mount('empty'); await settle();
    assert(treeItem('Resources/Literature')&&root.textContent.includes('This folder is empty'),'Empty workspace has explicit root');
    await create(root.querySelector('.hub-explorer-create-folder'),'First folder'); assert(row('Resources/Literature/First folder'),'Empty root creates first folder');
    mount('project'); await settle(); assert(row(projectPath)&&row(projectPath+'/Meta')&&row(math),'Project root, local and shared hierarchies coexist');
    assert(row(math).textContent.includes('Shared resource'),'Shared origin retained');
    assert(!fullMenu(row(math)).some(e=>e?.title==='Delete')&&fullMenu(row(math),'Detach from project'),'Shared reference root protected');
    row(math).click(); toggle(math); row(course).click();
    fullMenu(row(course),'New note').run(); input().value='Shared edit'; key(input(),'Enter'); await settle();
    assert(creations.at(-1)===course+'/Shared edit.md','Shared creation uses original Resource location');
    await setMode(true); host.style.width='230px'; await settle();
    const origin=row(math).querySelector('.hub-explorer-origin');
    assert(origin.getBoundingClientRect().width>0&&origin.getBoundingClientRect().width<=row(math).getBoundingClientRect().width,'Shared Resource provenance stays bounded in narrow Note view');
    assert(objectIcon(math).dataset.icon==='folder-symlink','Shared Resource retains symlink semantics in Note view');
    host.style.width='1000px'; await setMode(false);
    await fullMenu(row(math),'Detach from project').run(); await settle(); assert(!row(math)&&objects.has(course+'/Shared edit.md'),'Detach preserves underlying Resource files');
    add(projectPath+'/Second'); controller.refresh(); await setMode(true);
    const reorder=new DataTransfer(); row(projectPath+'/Atlas').dispatchEvent(new DragEvent('dragstart',{dataTransfer:reorder,bubbles:true}));
    const targetRect=row(projectPath+'/Second').getBoundingClientRect();
    row(projectPath+'/Second').dispatchEvent(new DragEvent('drop',{dataTransfer:reorder,bubbles:true,cancelable:true,clientY:targetRect.bottom-1})); await settle();
    assert(root.hubCaptureFolders().order.join('|')==='Meta|Second|Atlas','Note manual folder reorder and fixed Meta are preserved');
    await setMode(false);
    const localNames=[...treeItem(projectPath).querySelectorAll(':scope > [role=group] > [role=treeitem]')].map(e=>e.getAttribute('aria-label'));
    assert(localNames.join('|')==='Atlas|Meta|Second','Full sibling sorting includes Meta independently of Note order');
    assert(root.hubCaptureFolders().order.join('|')==='Meta|Second|Atlas','Full sorting leaves manual ordering unchanged');
    // Scoped Last File and active-file fallback retain their pre-redesign semantics.
    stored['resource:study']={}; mount('resource'); await setMode(true);
    controller.setActive(renamed+'/Homework.md');
    assert(treeItem(renamed+'/Homework.md').getAttribute('aria-current')==='true','External Note file-open reveals its ancestors');
    await setMode(false); assert(current(renamed),'Without remembered Full navigation, active file parent is the fallback');
    lastFilePath=renamed+'/Homework.md'; mount('resource'); await settle();
    assert(current(renamed)&&!root.querySelector('.is-active-file'),'Remounted Full uses scoped Last File without file highlighting');
    toggle(course); const deliberatelyCollapsed=root.hubCaptureFolders(); mount('resource'); await setMode(true);
    assert(treeItem(course).getAttribute('aria-expanded')==='false','Last File seed preserves a deliberately collapsed branch');
    root.hubRestoreFolders(deliberatelyCollapsed); toggle(course);
    assert(treeItem(lastFilePath).getAttribute('aria-current')==='true','Remounted Note retains active file history');
    assert(window.hubGetLastNavigation().file.path===lastFilePath,'Explorer selection never rewrites Last File');
    assert(controller.selectFolderPath(renamed),'Existing Finder folder navigation resolves canonical folder');
    await setMode(false); assert(current(renamed),'Finder destination survives Full/Note transition');
    const nestedWorkspace=projectPath+'/Nested workspace'; add(nestedWorkspace);
    window.hubTaskOwner=path=>({root:path===nestedWorkspace||path.startsWith(nestedWorkspace+'/')?nestedWorkspace:path.startsWith(resourcePath)?resourcePath:projectPath});
    mount('project'); assert(!row(nestedWorkspace).draggable,'Nested physical workspace root is protected on the first Full render');
    assert(!fullMenu(row(nestedWorkspace)).some(e=>e?.title==='Rename'||e?.title==='Delete'),'Nested workspace root has no ordinary structural menu actions');
    assert(runtimeErrors.length===0,'No asynchronous runtime errors: '+runtimeErrors.join('; '));
    window.explorerPreview=async()=>{};
    document.getElementById('result').textContent='PASS: Full root/folder-only navigation; independent disclosure; single/double-click and split opening; pane selection; concise contextual menus; current-folder inline creation and cancellation; root policy; shared sorting/presets; keyboard splitter; local/shared resources; unchanged Note search/opening/creation; responsive themes and sidebar geometry. Synthetic vault only.';
} catch(error) { document.getElementById('result').textContent='FAIL: '+error.stack; } };
