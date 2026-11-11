"use strict";

const { workspaceTree, filterWorkspaceTree, sortExplorerChildren, rewriteExplorerPaths } = require("../domain/workspace-explorer");
const { fileIcon } = require("./file-icons");
const { formatDateTime } = require("../domain/dates");

function mountWorkspaceExplorer({ parent, workspacePath, dashboardPath, descriptors, getByPath,
    states, persist, setIcon, openFile, createItem, renameItem = null, clipboard = null, contextMenu, showMenu = () => {}, canSelect = () => true, canCreateNote = path => path !== workspacePath, decorateRow = () => {},
    selectItem = () => false, clearSelection = () => {}, selectedPaths = new Set(),
    decorateFolder = () => {}, isNoteView = () => !!parent.closest(".hub-project-rail"), formatTime = value => formatDateTime(new Date(value)) }) {
    const doc = parent.ownerDocument;
    function el(parent, tag, cls, text) {
        const element = doc.createElement(tag);
        element.className = cls;
        if (text) element.textContent = text;
        parent.append(element);
        return element;
    }
    function icon(parent, name, cls = "hub-explorer-icon") {
        const span = el(parent, "span", cls);
        span.setAttribute("aria-hidden", "true");
        setIcon(span, name);
        return span;
    }
    function button(parent, cls, label, name) {
        const result = el(parent, "button", "hub-button-plain " + cls);
        result.type = "button";
        result.setAttribute("aria-label", label);
        result.title = label;
        if (name) icon(result, name);
        return result;
    }
    const shell = el(parent, "section", "project-panel hub-workspace-explorer");
    shell.setAttribute("aria-label", "Workspace files");
    const heading = el(shell, "div", "project-panel-title hub-explorer-heading");
    icon(heading, "folder-tree");
    el(heading, "span", "", "Files");
    const searchBox = el(shell, "div", "hub-explorer-search");
    icon(searchBox, "search");
    const search = el(searchBox, "input", "hub-explorer-search-input");
    search.type = "search";
    search.placeholder = "Search files...";
    search.setAttribute("aria-label", "Search files in this workspace");
    const body = el(shell, "div", "hub-explorer-body");
    const toolbar = el(body, "div", "hub-explorer-toolbar");
    const createNote = button(toolbar, "hub-explorer-create-note", "New note", "file-plus-2");
    const createFolder = button(toolbar, "hub-explorer-create-folder", "New folder", "folder-plus");
    const sortButton = button(toolbar, "hub-explorer-sort", "Sort by", "list-sort-descending");
    sortButton.setAttribute("aria-haspopup", "menu"); sortButton.setAttribute("aria-expanded", "false");
    const tree = el(body, "div", "hub-explorer-tree");
    tree.setAttribute("role", "tree");
    tree.setAttribute("aria-label", "Workspace folders and files");
    tree.setAttribute("aria-multiselectable", "true");
    const details = el(body, "div", "hub-explorer-details");
    const location = el(details, "div", "hub-explorer-location");
    const breadcrumb = el(location, "nav", "hub-explorer-breadcrumb");
    body.insertBefore(location, tree);
    const splitter = el(body, "div", "hub-explorer-splitter");
    splitter.tabIndex = 0;
    splitter.setAttribute("role", "separator");
    splitter.setAttribute("aria-orientation", "vertical");
    splitter.setAttribute("aria-label", "Folder navigation width");
    breadcrumb.setAttribute("aria-label", "Selected folder");
    const columns = el(details, "div", "hub-explorer-columns");
    const contents = el(details, "div", "hub-explorer-contents");
    contents.setAttribute("role", "listbox");
    contents.setAttribute("aria-multiselectable", "true");
    const footer = el(shell, "div", "hub-explorer-footer");
    const newFolder = button(footer, "hub-explorer-new-folder", "New workspace folder", "folder-plus");
    el(newFolder, "span", "", "New folder");
    const status = el(footer, "span", "hub-explorer-status");
    status.setAttribute("role", "status");
    const editor = el(shell, "div", "hub-explorer-editor");
    editor.hidden = true;
    let model, filtered, currentPath = null, activePath = null, focusPath = null;
    let query = "", editing = null, disposed = false, repainting = false;
    let selectionPane = null, selectionAnchor = null, detailFocusPath = null;
    const events = new doc.defaultView.AbortController();
    // currentPath belongs to Full-view; activePath only describes the open Note file.
    let noteView = isNoteView(), rememberedFolder = false;
    const searchCollapsed = new Set();
    const activeQuery = () => isNoteView() ? query : "";
    const ui = path => states()[path] ?? {};
    const fullState = () => ui(workspacePath).fullExplorer ?? {};
    function saveFull(changes) { save(workspacePath, { fullExplorer: { ...fullState(), ...changes } }); }
    const sortState = () => fullState().sort ?? { sortKey: "name", sortDirection: "asc" };
    const treeChildren = node => {
        const children = node.children.filter(child => filtered.visible.has(child.path) && (isNoteView() || child.folder));
        return isNoteView() ? children : sortExplorerChildren(children, sortState());
    };
    const selectable = node => !!node?.parent && canSelect(node.path);
    function paneRows(pane) { return [...pane.querySelectorAll("[data-path]")].filter(row => selectable(model.byPath.get(row.dataset.path))); }
    function clearFullSelection() { selectedPaths.clear(); selectionAnchor = null; syncSelection(); }
    function selectFull(node, event = {}, pane = contents) {
        if (selectionPane !== pane) { selectedPaths.clear(); selectionAnchor = null; selectionPane = pane; }
        if (!selectable(node)) { clearFullSelection(); return; }
        const modifier = event.ctrlKey || event.metaKey;
        if (event.shiftKey && selectionAnchor) {
            const paths = paneRows(pane).map(row => row.dataset.path), a = paths.indexOf(selectionAnchor), b = paths.indexOf(node.path);
            if (!modifier) selectedPaths.clear();
            if (a >= 0 && b >= 0) paths.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(path => selectedPaths.add(path));
            else selectedPaths.add(node.path);
        } else {
            if (!modifier) selectedPaths.clear();
            if (modifier && selectedPaths.has(node.path)) selectedPaths.delete(node.path); else selectedPaths.add(node.path);
            selectionAnchor = node.path;
        }
        syncSelection();
    }
    function focusDetail(path) {
        detailFocusPath = path;
        const row = [...contents.querySelectorAll("[data-path]")].find(row => row.dataset.path === path);
        row?.focus({ preventScroll: true }); row?.scrollIntoView({ block: "nearest" });
    }
    function setSort(next) {
        if (editing?.committing) return;
        cancelDraft(); saveFull({ sort: next }); render();
    }
    function save(path, changes) {
        states()[path] = { ...ui(path), ...changes };
        persist();
    }
    function selectedFolder() { return model.byPath.get(currentPath); }
    function isExpanded(node) {
        return treeChildren(node).length > 0 && (activeQuery() ? !searchCollapsed.has(node.path) :
            ui(node.path).collapsed === false || (!isNoteView() && node.path === workspacePath && ui(node.path).collapsed === undefined));
    }
    function lineage(node) {
        const result = [];
        for (let cursor = node; cursor; cursor = cursor.parent) result.unshift(cursor);
        return result;
    }
    function reveal(node) {
        for (const ancestor of lineage(node).slice(0, -1)) {
            states()[ancestor.path] = { ...ui(ancestor.path), collapsed: false };
        }
    }
    function selectFolder(node, expandAncestors = false) {
        if (editing?.committing) return;
        cancelDraft();
        if (currentPath !== node.path) contents.scrollTop = 0;
        if (!isNoteView() && currentPath !== node.path) { clearFullSelection(); detailFocusPath = null; }
        currentPath = node.path;
        rememberedFolder = true;
        if (expandAncestors) reveal(node);
        save(workspacePath, { currentPath });
        render();
    }
    function activate(node, event, row) {
        if (!isNoteView()) {
            if (node.folder) { selectFolder(node, true); if (row.closest(".hub-explorer-tree")) focusNode(node.path); else contents.focus({ preventScroll: true }); }
            else { const file = getByPath(node.path); if (file) Promise.resolve(openFile(file)).catch(showError); }
            return;
        }
        if (node.parent && selectItem(event, row, node.path)) { syncSelection(); return; }
        clearSelection();
        if (node.folder) {
            const fromContents = row.closest(".hub-explorer-contents");
            if (!fromContents) toggle(node, false);
            if (!isNoteView()) selectFolder(node, true);
            else renderTree(true);
            if (fromContents) focusNode(node.path);
        } else {
            activePath = node.path;
            reveal(node); persist();
            contextualFolder(); render();
            const file = getByPath(node.path);
            if (file) Promise.resolve(openFile(file)).catch(showError);
        }
    }
    function toggle(node, repaint = true) {
        if (!treeChildren(node).length) return;
        if (activeQuery()) {
            if (searchCollapsed.has(node.path)) searchCollapsed.delete(node.path);
            else searchCollapsed.add(node.path);
        } else save(node.path, { collapsed: isExpanded(node) });
        focusPath = node.path;
        if (repaint) renderTree(true);
    }
    function nameContent(row, node, treeRow = false) {
        const folderIcon = !node.parent && node.descriptor.sharedResource ? "folder-symlink"
            : treeRow && isExpanded(node) ? "folder-open" : "folder";
        icon(row, node.folder ? folderIcon : fileIcon(node.item));
        const text = el(row, "span", "hub-explorer-label");
        const name = el(text, "span", "hub-explorer-name", node.name);
        name.title = node.name;
        if (!node.parent && node.descriptor.sharedResource) {
            const origin = `Shared resource · ${node.descriptor.resourceLabel}`;
            el(text, "span", "hub-explorer-origin", origin);
            row.title = `${node.name}\n${origin}`;
        } else row.title = node.path;
    }
    function bindRow(row, node, kind) {
        row.dataset.path = node.path;
        decorateRow(row, node, kind);
        row.addEventListener("pointerdown", event => {
            const pane = kind === "tree" ? tree : contents;
            if (!isNoteView() && event.button === 0 && selectionPane !== pane) { clearFullSelection(); selectionPane = pane; }
        });
        row.addEventListener("click", event => {
            if (isNoteView()) { activate(node, event, row); return; }
            const pane = kind === "tree" ? tree : contents;
            if (kind === "tree" && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                selectFolder(node, true); selectFull(model.byPath.get(node.path), event, tree); focusNode(node.path);
            } else {
                selectFull(node, event, pane);
                if (kind === "details") focusDetail(node.path);
            }
        });
        row.addEventListener("dblclick", event => {
            if (!isNoteView() && kind === "details" && !event.ctrlKey && !event.metaKey && !event.shiftKey) activate(node, event, row);
        });
        row.addEventListener("contextmenu", event => {
            event.preventDefault(); event.stopPropagation();
            if (!isNoteView()) {
                const pane = kind === "tree" ? tree : contents;
                if (selectionPane !== pane || !selectedPaths.has(node.path)) selectFull(node, {}, pane);
            }
            contextMenu(event, node, beginCreate, { kind: "item" });
        });
    }
    function focusNode(path) {
        focusPath = path;
        for (const item of tree.querySelectorAll("[role=treeitem]")) {
            item.tabIndex = item.dataset.treePath === path ? 0 : -1;
            if (item.tabIndex === 0) item.focus({ preventScroll: true });
        }
        const focused = doc.activeElement;
        if (tree.contains(focused)) focused.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    function renderTree(restoreFocus = false) {
        const scrollTop = tree.scrollTop;
        tree.replaceChildren();
        const visiblePaths = [];
        function branch(parent, node, depth, index, count) {
            if (!filtered.visible.has(node.path)) return;
            visiblePaths.push(node.path);
            const item = el(parent, "div", "hub-explorer-item");
            item.dataset.treePath = node.path;
            item.setAttribute("role", "treeitem");
            item.setAttribute("aria-label", node.name + (!node.parent && node.descriptor.sharedResource
                ? `, Shared resource · ${node.descriptor.resourceLabel}` : ""));
            item.setAttribute("aria-level", String(depth + 1));
            item.setAttribute("aria-posinset", String(index + 1));
            item.setAttribute("aria-setsize", String(count));
            if (treeChildren(node).length) item.setAttribute("aria-expanded", String(isExpanded(node)));
            const row = el(item, "div", "hub-explorer-tree-row" + (node.parent ? " project-browser-row" : ""));
            row.style.setProperty("--hub-tree-depth", depth);
            if (treeChildren(node).length) {
                const disclosure = button(row, "hub-explorer-disclosure", `${isExpanded(node) ? "Collapse" : "Expand"} ${node.name}`,
                    isExpanded(node) ? "chevron-down" : "chevron-right");
                disclosure.tabIndex = -1;
                disclosure.setAttribute("aria-expanded", String(isExpanded(node)));
                disclosure.addEventListener("click", event => {
                    event.stopPropagation(); toggle(node);
                });
            } else el(row, "span", "hub-explorer-disclosure-space").setAttribute("aria-hidden", "true");
            nameContent(row, node, true);
            bindRow(row, node, "tree");
            row.removeAttribute("tabindex");
            row.setAttribute("role", "presentation");
            row.addEventListener("click", () => focusNode(node.path));
            if (isExpanded(node)) {
                const group = el(item, "div", "hub-explorer-group");
                group.setAttribute("role", "group");
                group.style.setProperty("--hub-tree-depth", depth);
                const children = treeChildren(node);
                children.forEach((child, i) => branch(group, child, depth + 1, i, children.length));
            }
        }
        const roots = model.roots.filter(node => filtered.visible.has(node.path));
        roots.forEach((node, index) => branch(tree, node, 0, index, roots.length));
        if (!roots.length) el(tree, "div", "hub-explorer-empty", activeQuery() ? "No matching files or folders." : "No workspace folders yet.");
        if (!visiblePaths.includes(focusPath)) focusPath = visiblePaths.includes(currentPath) ? currentPath : visiblePaths[0];
        for (const item of tree.querySelectorAll("[role=treeitem]")) item.tabIndex = item.dataset.treePath === focusPath ? 0 : -1;
        syncSelection();
        tree.scrollTop = scrollTop;
        if (restoreFocus && focusPath) focusNode(focusPath);
    }
    function renderDetails() {
        const scrollTop = contents.scrollTop;
        breadcrumb.replaceChildren(); columns.replaceChildren(); contents.replaceChildren();
        const node = selectedFolder();
        if (!node) { el(contents, "div", "hub-explorer-empty", "Create a folder to get started."); return; }
        icon(breadcrumb, !node.parent && node.descriptor.sharedResource ? "folder-symlink" : "folder-open");
        for (const [index, ancestor] of lineage(node).entries()) {
            if (index) icon(breadcrumb, "chevron-right", "hub-explorer-crumb-separator");
            const crumb = button(breadcrumb, "hub-explorer-crumb", ancestor.name);
            crumb.textContent = ancestor.name;
            if (ancestor === node) crumb.setAttribute("aria-current", "location");
            crumb.addEventListener("click", () => selectFolder(ancestor, true));
        }
        contents.setAttribute("aria-label", `Contents of ${node.name}`);
        const sort = isNoteView() ? { ...ui(node.descriptor.path), ...ui(node.path) } : sortState();
        for (const [key, label] of [["name", "Name"], ["modified", "Modified"], ["created", "Created"]]) {
            const heading = button(columns, "hub-explorer-column", `Sort by ${label.toLowerCase()}`);
            heading.dataset.sortKey = key;
            el(heading, "span", "", label);
            const active = (sort.sortKey ?? "modified") === key;
            if (active) {
                const ascending = sort.sortDirection === "asc";
                heading.setAttribute("aria-label", `Sort by ${label.toLowerCase()}, currently ${ascending ? "ascending" : "descending"}`);
                icon(heading, ascending ? "chevron-up" : "chevron-down");
            }
            heading.addEventListener("click", () => {
                const next = { sortKey: key, sortDirection: active ? (sort.sortDirection === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc" };
                if (isNoteView()) { save(node.path, next); renderDetails(); } else setSort(next);
                columns.querySelector(`[data-sort-key="${key}"]`)?.focus();
            });
        }
        const children = sortExplorerChildren(node.children.filter(child => filtered.visible.has(child.path)), sort);
        for (const child of children) {
            const row = el(contents, "div", "project-browser-row hub-explorer-detail-row");
            const info = el(row, "div", "hub-explorer-detail-name");
            nameContent(info, child);
            for (const field of ["mtime", "ctime"]) {
                const value = child.folder ? null : child.item.stat?.[field];
                const cell = el(row, "span", "hub-explorer-time", value ? formatTime(value) : "—");
                cell.title = value ? formatDateTime(new Date(value)) : "Folder timestamps are not available";
            }
            bindRow(row, child, "details");
            row.setAttribute("role", "option");
            row.tabIndex = 0;
        }
        if (!children.length) el(contents, "div", "hub-explorer-empty", activeQuery() ? "No matching items in this folder." : "This folder is empty.");
        syncSelection(); contents.scrollTop = scrollTop;
    }
    function contextualFolder() {
        const active = model.byPath.get(activePath);
        if (!rememberedFolder && active && !active.folder) currentPath = active.parent.path;
    }
    function syncMode() {
        if (disposed || noteView === isNoteView()) return;
        noteView = isNoteView();
        cancelDraft(); clearFullSelection(); selectionPane = null; refresh({ restore: !noteView });
    }
    function syncSelection() {
        const inNoteView = isNoteView();
        for (const row of shell.querySelectorAll("[data-path]")) {
            const selected = selectedPaths.has(row.dataset.path) && (inNoteView || row.closest(".hub-explorer-tree,.hub-explorer-contents") === selectionPane);
            row.classList.toggle("is-selected", selected);
            const currentFolder = !inNoteView && row.dataset.path === currentPath;
            const activeFile = inNoteView && row.dataset.path === activePath;
            row.classList.toggle("is-current-folder", currentFolder);
            row.classList.toggle("is-active-file", activeFile);
            const semantic = row.closest("[role=treeitem]") ?? row;
            semantic.setAttribute("aria-selected", String(selected || currentFolder || activeFile));
            if (activeFile) semantic.setAttribute("aria-current", "true");
            else semantic.removeAttribute("aria-current");
        }
    }
    function render() {
        const draftFocused = !!editing?.inline && !!doc.activeElement?.closest(".hub-explorer-draft");
        const draftSelection = draftFocused ? [doc.activeElement.selectionStart, doc.activeElement.selectionEnd] : null;
        repainting = true;
        const hadFocus = tree.contains(doc.activeElement);
        const detailFocused = contents.contains(doc.activeElement) ? doc.activeElement.closest("[data-path]")?.dataset.path : null;
        filtered = filterWorkspaceTree(model.roots, activeQuery());
        renderTree(hadFocus); renderDetails();
        shell.classList.toggle("is-note-explorer", isNoteView());
        tree.setAttribute("aria-label", isNoteView() ? "Workspace folders and files" : "Workspace folders");
        syncToolbar();
        applyWidth();
        if (detailFocused) focusDetail(detailFocused);
        if (editing?.inline) renderDraft();
        status.textContent = activeQuery() ? `${filtered.matches.size} matches` : "";
        repainting = false;
        if (draftFocused) {
            const field = contents.querySelector(".project-create-input");
            if (field && !field.disabled) { field.focus(); field.setSelectionRange(...draftSelection); }
        }
    }
    function refresh({ restore = false } = {}) {
        if (disposed) return;
        if (restore) preferredWidth = null;
        model = workspaceTree(descriptors(), getByPath, dashboardPath, { workspacePath, fullView: !isNoteView() });
        if (restore || currentPath === null) {
            query = ui(workspacePath).search ?? "";
            search.value = query;
            currentPath = ui(workspacePath).currentPath;
            // Read legacy panel locations without a persistence migration.
            if (!model.byPath.has(currentPath)) {
                currentPath = model.roots.map(node => ui(node.path).currentPath).find(path => model.byPath.has(path));
                if (model.byPath.has(currentPath)) reveal(model.byPath.get(currentPath));
            }
            rememberedFolder = !!model.byPath.get(currentPath)?.folder;
        }
        while (currentPath && !model.byPath.get(currentPath)?.folder) currentPath = currentPath.includes("/") ? currentPath.slice(0, currentPath.lastIndexOf("/")) : null;
        contextualFolder();
        currentPath ??= model.roots[0]?.path ?? null;
        for (const path of selectedPaths) if (!model.byPath.has(path)) selectedPaths.delete(path);
        if (!isNoteView() && !fullState().sort) {
            const legacy = [ui(currentPath), ui(model.byPath.get(currentPath)?.descriptor.path), ui(workspacePath)]
                .find(state => ["name", "modified", "created"].includes(state.sortKey));
            if (legacy) saveFull({ sort: { sortKey: legacy.sortKey, sortDirection: legacy.sortDirection === "asc" ? "asc" : "desc" } });
        }
        render();
    }
    function showError(error) { status.textContent = error?.message ?? "Could not open this file."; }
    function syncToolbar() {
        const busy = !!editing?.committing, allowed = canCreateNote(currentPath ?? workspacePath);
        createNote.disabled = busy || !allowed; createFolder.disabled = busy; sortButton.disabled = busy;
        createNote.title = allowed ? "New note" : "Create notes inside a workspace folder";
        shell.setAttribute("aria-busy", String(busy));
    }
    function beginCreate(kind, path = currentPath ?? workspacePath) {
        if (editing?.committing) return;
        if (!isNoteView()) {
            if (kind === "note" && !canCreateNote(path)) return;
            const target = model.byPath.get(path);
            if (!target?.folder) return;
            selectFolder(target, true);
            editing = { inline: true, kind, path, value: kind === "folder" ? "New folder" : "Untitled", committing: false, error: "" };
            clearFullSelection(); selectionPane = contents; renderDraft();
            const input = contents.querySelector(".project-create-input"); input.focus(); input.select();
            return;
        }
        editing = { kind, path };
        editor.replaceChildren(); editor.hidden = false;
        const label = el(editor, "label", "hub-explorer-create-label", `${kind === "folder" ? "New folder" : "New note"} in ${model.byPath.get(path)?.name ?? "workspace"}`);
        const input = el(label, "input", "project-create-input");
        input.placeholder = kind === "folder" ? "Folder name..." : "Note name...";
        input.spellcheck = false;
        const cancel = button(editor, "project-create-cancel", "Cancel creation", "x");
        const errorText = el(editor, "span", "hub-explorer-create-error");
        errorText.setAttribute("role", "alert");
        let committing = false;
        function close() { editing = null; editor.hidden = true; editor.replaceChildren(); }
        async function commit() {
            if (!editing || committing) return;
            if (!input.value.trim()) { close(); return; }
            committing = true;
            try {
                const createdPath = await createItem(path, kind, input.value);
                states()[path] = { ...ui(path), collapsed: false };
                close(); refresh();
                const node = model.byPath.get(createdPath);
                if (node) {
                    reveal(node);
                    if (!isNoteView()) { currentPath = node.folder ? node.path : node.parent.path; rememberedFolder = true; }
                }
                save(workspacePath, { ...(!isNoteView() ? { currentPath } : {}), search: "" });
                query = ""; search.value = ""; render();
                if (node) focusNode(node.path);
            } catch (error) {
                errorText.textContent = error.message ?? "Could not create item.";
                input.setAttribute("aria-invalid", "true"); input.focus();
            } finally { committing = false; }
        }
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") { event.preventDefault(); void commit(); }
            if (event.key === "Escape") { event.preventDefault(); close(); newFolder.focus(); }
        });
        input.addEventListener("blur", () => { if (input.isConnected) void commit(); });
        cancel.addEventListener("pointerdown", event => event.preventDefault());
        cancel.addEventListener("click", close);
        input.focus();
    }
    function beginRename(path = [...selectedPaths][0]) {
        if (isNoteView() || editing?.committing || !renameItem || selectedPaths.size > 1) return;
        const node = model.byPath.get(path);
        if (!node?.parent || !canSelect(path)) return;
        const returnPath = currentPath, originPane = selectionPane;
        selectFolder(node.parent, true);
        editing = { returnPath, originPane, inline: true, renamePath: path, kind: node.folder ? "folder" : "note", path: node.parent.path, value: node.name, committing: false, error: "" };
        selectionPane = contents; selectedPaths.clear(); selectedPaths.add(path);
        renderDraft(); const input = contents.querySelector(".project-create-input"); input.focus(); input.select();
    }
    function cancelDraft() {
        if (editing?.committing) return;
        const renaming = !!editing?.renamePath;
        if (renaming && model.byPath.has(editing.returnPath)) currentPath = editing.returnPath;
        editing = null;
        editor.hidden = true; editor.replaceChildren();
        if (renaming) { save(workspacePath, { currentPath }); render(); } else contents.querySelector(".hub-explorer-draft")?.remove();
    }
    function renderDraft() {
        if (!editing?.inline) return;
        const previousRepaint = repainting; repainting = true;
        contents.querySelector(".hub-explorer-draft")?.remove();
        const draft = editing;
        const original = draft.renamePath && [...contents.querySelectorAll("[data-path]")].find(row => row.dataset.path === draft.renamePath);
        const row = original ?? el(contents, "div", "hub-explorer-detail-row");
        row.replaceChildren(); row.classList.add("hub-explorer-draft");
        const name = el(row, "div", "hub-explorer-detail-name");
        icon(name, draft.kind === "folder" ? "folder" : "file-text");
        const input = el(name, "input", "project-create-input");
        input.value = draft.value; input.spellcheck = false; input.disabled = draft.committing;
        input.setAttribute("aria-label", draft.renamePath ? "Rename item" : draft.kind === "folder" ? "New folder name" : "New note name");
        const errorText = el(row, "span", "hub-explorer-create-error", draft.error);
        errorText.setAttribute("role", "alert");
        if (draft.error) input.setAttribute("aria-invalid", "true");
        if (!original) contents.prepend(row);
        input.addEventListener("input", () => { draft.value = input.value; });
        input.addEventListener("blur", () => {
            if (!repainting && editing === draft && !draft.committing && input.isConnected) cancelDraft();
        });
        input.addEventListener("keydown", event => {
            event.stopPropagation();
            if (event.key === "Escape" && !draft.committing) { event.preventDefault(); cancelDraft(); contents.focus(); }
            if (event.key !== "Enter" || event.isComposing || draft.committing) return;
            event.preventDefault(); draft.value = input.value;
            if (!draft.value.trim() || [".", ".."].includes(draft.value.trim())) {
                draft.error = "Enter a valid name."; errorText.textContent = draft.error; input.setAttribute("aria-invalid", "true"); return;
            }
            draft.committing = true; input.disabled = true;
            syncToolbar();
            status.textContent = "Creating…";
            void (async () => {
                try {
                    const path = draft.renamePath ? await renameItem(draft.renamePath, draft.value) : await createItem(draft.path, draft.kind, draft.value);
                    if (disposed) return;
                    editing = null; refresh();
                    if (draft.renamePath && draft.returnPath) {
                        const restored = draft.returnPath === draft.renamePath || draft.returnPath.startsWith(draft.renamePath + "/") ? path + draft.returnPath.slice(draft.renamePath.length) : draft.returnPath;
                        if (model.byPath.get(restored)?.folder) currentPath = restored;
                    }
                    const node = model.byPath.get(path);
                    if (node) { reveal(node); persist(); }
                    selectionPane = draft.originPane ?? contents; selectionAnchor = path; selectedPaths.clear(); selectedPaths.add(path);
                    save(workspacePath, { currentPath }); render();
                    if (draft.originPane === tree) focusNode(path); else focusDetail(path);
                } catch (error) {
                    if (disposed) return;
                    draft.committing = false; draft.error = error.message ?? "Could not create item.";
                    status.textContent = ""; syncToolbar();
                    renderDraft(); const field = contents.querySelector(".project-create-input"); field?.focus();
                }
            })();
        });
        repainting = previousRepaint;
    }
    let preferredWidth = null, dragWidth = null;
    function applyWidth() {
        if (isNoteView()) return;
        const available = body.clientWidth || 600;
        const minimum = Math.min(160, available * .4), maximum = Math.max(minimum, available - 165);
        const stored = fullState().treeWidth;
        const value = Math.min(maximum, Math.max(minimum, preferredWidth ?? (Number.isFinite(stored) ? stored : available / 3)));
        body.style.setProperty("--hub-explorer-tree-width", value + "px");
        splitter.setAttribute("aria-valuemin", String(Math.round(minimum)));
        splitter.setAttribute("aria-valuemax", String(Math.round(maximum)));
        splitter.setAttribute("aria-valuenow", String(Math.round(value)));
    }
    function commitWidth() { if (preferredWidth !== null) saveFull({ treeWidth: preferredWidth }); }
    splitter.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        event.preventDefault(); cancelDraft();
        dragWidth = { id: event.pointerId, x: event.clientX, width: tree.getBoundingClientRect().width };
        splitter.setPointerCapture(event.pointerId); shell.classList.add("is-resizing");
    });
    splitter.addEventListener("pointermove", event => {
        if (!dragWidth || dragWidth.id !== event.pointerId) return;
        preferredWidth = dragWidth.width + event.clientX - dragWidth.x; applyWidth();
    });
    function endResize(event) {
        if (!dragWidth || dragWidth.id !== event.pointerId) return;
        const id = dragWidth.id; dragWidth = null; shell.classList.remove("is-resizing");
        preferredWidth = Number(splitter.getAttribute("aria-valuenow"));
        if (splitter.hasPointerCapture(id)) splitter.releasePointerCapture(id);
        commitWidth();
    }
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) splitter.addEventListener(type, endResize);
    splitter.addEventListener("keydown", event => {
        const current = Number(splitter.getAttribute("aria-valuenow"));
        const value = event.key === "ArrowLeft" ? current - 16 : event.key === "ArrowRight" ? current + 16 :
            event.key === "Home" ? Number(splitter.getAttribute("aria-valuemin")) : event.key === "End" ? Number(splitter.getAttribute("aria-valuemax")) : null;
        if (value === null) return;
        event.preventDefault(); event.stopPropagation(); preferredWidth = value; applyWidth();
        preferredWidth = Number(splitter.getAttribute("aria-valuenow")); commitWidth();
    });
    const resize = new doc.defaultView.ResizeObserver(applyWidth); resize.observe(body);
    createNote.addEventListener("click", () => beginCreate("note"));
    createFolder.addEventListener("click", () => beginCreate("folder"));
    sortButton.addEventListener("click", event => {
        const current = sortState(), entries = [];
        for (const [sortKey, label] of [["name", "Name"], ["modified", "Modified"], ["created", "Created"]]) {
            for (const sortDirection of ["asc", "desc"]) entries.push({
                title: `${label}: ${sortKey === "name" ? (sortDirection === "asc" ? "Ascending" : "Descending") : (sortDirection === "asc" ? "Oldest" : "Newest")}`,
                checked: current.sortKey === sortKey && current.sortDirection === sortDirection,
                run: () => setSort({ sortKey, sortDirection })
            });
        }
        entries.push(null, { title: "Folders use Name ascending for date sorts", disabled: true });
        showMenu(event, entries);
    });
    contents.tabIndex = 0;
    shell.addEventListener("focusin", event => {
        if (isNoteView()) return;
        const pane = event.target.closest(".hub-explorer-tree,.hub-explorer-contents");
        if (pane && selectionPane && selectionPane !== pane) { clearFullSelection(); selectionPane = pane; }
    });
    contents.addEventListener("click", event => {
        if (!isNoteView() && !event.target.closest("[data-path],input")) clearFullSelection();
    });
    shell.addEventListener("keydown", event => {
        if (isNoteView() || event.isComposing || event.target.closest("input,textarea,select,[contenteditable=true]")) return;
        const mod = event.ctrlKey || event.metaKey;
        if (event.key === "F2" || mod && !event.altKey && !event.shiftKey && ["c", "x", "v"].includes(event.key.toLowerCase())) {
            event.preventDefault(); event.stopPropagation();
            if (event.key === "F2") beginRename();
            else if (clipboard) {
                const key = event.key.toLowerCase();
                void Promise.resolve(key === "v" ? clipboard.paste(currentPath ?? workspacePath) : clipboard.set([...selectedPaths], key === "x")).then(() => { refresh(); }).catch(showError);
            }
            return;
        }
        if (mod && event.shiftKey && event.key.toLowerCase() === "n") {
            event.preventDefault(); event.stopPropagation(); beginCreate("folder"); return;
        }
        if (event.key === "Escape") { clearFullSelection(); event.preventDefault(); event.stopPropagation(); return; }
        const pane = event.target.closest(".hub-explorer-tree,.hub-explorer-contents");
        if (!pane) return;
        if (mod && event.key.toLowerCase() === "a") {
            selectedPaths.clear(); selectionPane = pane;
            paneRows(pane).forEach(row => selectedPaths.add(row.dataset.path)); syncSelection();
        } else if (pane === contents) {
            const rows = [...contents.querySelectorAll("[data-path]")];
            const row = event.target.closest("[data-path]");
            const node = row && model.byPath.get(row.dataset.path);
            if (event.key === "Enter" && node) activate(node, event, row);
            else if ((event.key === "ContextMenu" || event.key === "F10" && event.shiftKey) && node) {
                const r = row.getBoundingClientRect();
                row.dispatchEvent(new doc.defaultView.MouseEvent("contextmenu", { bubbles: true, clientX: r.left + 20, clientY: r.top + r.height / 2 }));
            } else if (event.key === " " && node) selectFull(node, { ctrlKey: true }, contents);
            else if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key) && rows.length) {
                const index = rows.indexOf(row), target = event.key === "Home" ? rows[0] : event.key === "End" ? rows.at(-1) :
                    rows[Math.max(0, Math.min(rows.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))];
                if (!mod || event.shiftKey) selectFull(model.byPath.get(target.dataset.path), event, contents);
                focusDetail(target.dataset.path);
            } else return;
        } else return;
        event.preventDefault(); event.stopPropagation();
    });
    doc.addEventListener("click", event => {
        if (!isNoteView() && !shell.contains(event.target) && !event.target.closest(".menu")) clearFullSelection();
    }, { signal: events.signal });
    tree.addEventListener("contextmenu", event => {
        if (isNoteView() || event.target.closest("[data-path]")) return;
        event.preventDefault(); event.stopPropagation(); clearFullSelection();
        const node = model.byPath.get(workspacePath);
        if (node) contextMenu(event, node, beginCreate, { kind: "left-background" });
    });
    search.addEventListener("input", () => {
        query = search.value; searchCollapsed.clear();
        save(workspacePath, { search: query }); render();
    });
    search.addEventListener("keydown", event => {
        if (event.key === "Escape") { search.value = ""; search.dispatchEvent(new Event("input")); }
        if (event.key === "ArrowDown" && focusPath) { event.preventDefault(); focusNode(focusPath); }
    });
    newFolder.addEventListener("click", () => beginCreate("folder", workspacePath));
    tree.addEventListener("keydown", event => {
        if (event.isComposing || event.target.closest("input,textarea,[contenteditable=true]")) return;
        const item = event.target.closest("[role=treeitem]");
        if (!item) return;
        const node = model.byPath.get(item.dataset.treePath), row = item.firstElementChild;
        const items = [...tree.querySelectorAll("[role=treeitem]")], index = items.indexOf(item);
        let target = null;
        if (event.key === "ArrowDown") target = items[Math.min(items.length - 1, index + 1)];
        else if (event.key === "ArrowUp") target = items[Math.max(0, index - 1)];
        else if (event.key === "Home") target = items[0];
        else if (event.key === "End") target = items.at(-1);
        else if (event.key === "ArrowRight" && treeChildren(node).length) {
            if (!isExpanded(node)) toggle(node); else target = items[index + 1];
        } else if (event.key === "ArrowLeft") {
            if (isExpanded(node)) toggle(node); else if (node.parent) focusNode(node.parent.path);
        } else if (event.key === "Enter") activate(node, event, row);
        else if (event.key === " " && node.parent) {
            if (isNoteView()) selectItem({ ctrlKey: true, preventDefault() {}, stopPropagation() {} }, row, node.path);
            else selectFull(node, { ctrlKey: true }, tree);
            syncSelection();
        } else if (event.key === "ContextMenu" || event.key === "F10" && event.shiftKey) {
            const bounds = row.getBoundingClientRect();
            const context = new doc.defaultView.MouseEvent("contextmenu", {
                bubbles: true, clientX: bounds.left + 20, clientY: bounds.top + bounds.height / 2
            });
            if (isNoteView()) contextMenu(context, node, beginCreate); else row.dispatchEvent(context);
        }
        else return;
        if (target) {
            if (event.shiftKey && model.byPath.get(target.dataset.treePath).parent) {
                if (isNoteView()) {
                    if (!selectedPaths.size && node.parent) selectItem({ ctrlKey: true, preventDefault() {}, stopPropagation() {} }, row, node.path);
                    selectItem(event, target.firstElementChild, target.dataset.treePath);
                } else {
                    if (!selectionAnchor && node.parent) selectionAnchor = node.path;
                    selectFull(model.byPath.get(target.dataset.treePath), event, tree);
                }
            }
            focusNode(target.dataset.treePath); syncSelection();
        }
        event.preventDefault(); event.stopPropagation();
    });
    for (const element of [location, contents]) {
        decorateFolder(element, () => currentPath ?? workspacePath);
        element.addEventListener("contextmenu", event => {
            if (event.target.closest("[data-path], button") || !selectedFolder()) return;
            event.preventDefault(); event.stopPropagation();
            if (!isNoteView()) clearFullSelection();
            contextMenu(event, selectedFolder(), beginCreate, { kind: "background" });
        });
    }
    refresh({ restore: true });
    return { refresh, beginCreate, beginRename, syncSelection, syncMode,
        selectFolderPath(path) {
            const node = model.byPath.get(path);
            if (!node?.folder) return false;
            clearSelection(); selectFolder(node, true); focusNode(path);
            return true;
        },
        rename(oldPath, newPath) {
            rewriteExplorerPaths(states(), oldPath, newPath);
            const rewrite = path => path && (path === oldPath || path.startsWith(oldPath + "/")) ? newPath + path.slice(oldPath.length) : path;
            activePath = rewrite(activePath); focusPath = rewrite(focusPath);
            selectionAnchor = rewrite(selectionAnchor); detailFocusPath = rewrite(detailFocusPath);
            currentPath = rewrite(currentPath);
            for (const path of [...selectedPaths]) {
                selectedPaths.delete(path); selectedPaths.add(rewrite(path));
            }
            persist(); refresh();
        },
        setActive(path, { revealFile = true } = {}) {
            if (path === dashboardPath || path === activePath) return;
            activePath = model.byPath.has(path) ? path : null;
            const node = model.byPath.get(activePath);
            if (node && !node.folder) {
                if (revealFile) { reveal(node); persist(); }
                contextualFolder(); render();
            }
            else syncSelection();
        },
        isFullView: () => !isNoteView(),
        reportError: showError,
        destroy() { disposed = true; events.abort(); resize.disconnect(); shell.remove(); }
    };
}

module.exports = { mountWorkspaceExplorer };
