"use strict";

const { workspaceTree, filterWorkspaceTree, sortExplorerChildren, rewriteExplorerPaths } = require("../domain/workspace-explorer");
const { fileIcon } = require("./file-icons");
const { formatDateTime } = require("../domain/dates");

function mountWorkspaceExplorer({ parent, workspacePath, dashboardPath, descriptors, getByPath,
    states, persist, setIcon, openFile, createItem, contextMenu, decorateRow = () => {},
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
    const tree = el(body, "div", "hub-explorer-tree");
    tree.setAttribute("role", "tree");
    tree.setAttribute("aria-label", "Workspace folders and files");
    tree.setAttribute("aria-multiselectable", "true");
    const details = el(body, "div", "hub-explorer-details");
    const location = el(details, "div", "hub-explorer-location");
    const breadcrumb = el(location, "nav", "hub-explorer-breadcrumb");
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
    let query = "", editing = null, disposed = false;
    // currentPath belongs to Full-view; activePath only describes the open Note file.
    let noteView = isNoteView(), rememberedFolder = false;
    const searchCollapsed = new Set();
    const activeQuery = () => isNoteView() ? query : "";
    const ui = path => states()[path] ?? {};
    function save(path, changes) {
        states()[path] = { ...ui(path), ...changes };
        persist();
    }
    function selectedFolder() { return model.byPath.get(currentPath); }
    function isExpanded(node) {
        return node.children.length > 0 && (activeQuery() ? !searchCollapsed.has(node.path) : ui(node.path).collapsed === false);
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
        if (currentPath !== node.path) contents.scrollTop = 0;
        currentPath = node.path;
        rememberedFolder = true;
        if (expandAncestors) reveal(node);
        save(workspacePath, { currentPath });
        render();
    }
    function activate(node, event, row) {
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
        if (!node.children.length) return;
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
        row.addEventListener("click", event => activate(node, event, row));
        row.addEventListener("contextmenu", event => {
            event.preventDefault(); event.stopPropagation();
            contextMenu(event, node, beginCreate);
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
            if (node.children.length) item.setAttribute("aria-expanded", String(isExpanded(node)));
            const row = el(item, "div", "hub-explorer-tree-row" + (node.parent ? " project-browser-row" : ""));
            row.style.setProperty("--hub-tree-depth", depth);
            if (node.children.length) {
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
                const children = node.children.filter(child => filtered.visible.has(child.path));
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
        const sort = { ...ui(node.descriptor.path), ...ui(node.path) };
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
                save(node.path, { sortKey: key, sortDirection: active ? (sort.sortDirection === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc" });
                renderDetails();
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
        contextualFolder(); render();
    }
    function syncSelection() {
        const inNoteView = isNoteView();
        for (const row of shell.querySelectorAll("[data-path]")) {
            const selected = selectedPaths.has(row.dataset.path);
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
        const hadFocus = tree.contains(doc.activeElement);
        filtered = filterWorkspaceTree(model.roots, activeQuery());
        renderTree(hadFocus); renderDetails();
        shell.classList.toggle("is-note-explorer", isNoteView());
        status.textContent = activeQuery() ? `${filtered.matches.size} matches` : "";
    }
    function refresh({ restore = false } = {}) {
        if (disposed) return;
        model = workspaceTree(descriptors(), getByPath, dashboardPath);
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
        render();
    }
    function showError(error) { status.textContent = error?.message ?? "Could not open this file."; }
    function beginCreate(kind, path = currentPath ?? workspacePath) {
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
        const item = event.target.closest("[role=treeitem]");
        if (!item) return;
        const node = model.byPath.get(item.dataset.treePath), row = item.firstElementChild;
        const items = [...tree.querySelectorAll("[role=treeitem]")], index = items.indexOf(item);
        let target = null;
        if (event.key === "ArrowDown") target = items[Math.min(items.length - 1, index + 1)];
        else if (event.key === "ArrowUp") target = items[Math.max(0, index - 1)];
        else if (event.key === "Home") target = items[0];
        else if (event.key === "End") target = items.at(-1);
        else if (event.key === "ArrowRight" && node.children.length) {
            if (!isExpanded(node)) toggle(node); else target = items[index + 1];
        } else if (event.key === "ArrowLeft") {
            if (isExpanded(node)) toggle(node); else if (node.parent) focusNode(node.parent.path);
        } else if (event.key === "Enter") activate(node, event, row);
        else if (event.key === " " && node.parent) {
            selectItem({ ctrlKey: true, preventDefault() {}, stopPropagation() {} }, row, node.path); syncSelection();
        } else if (event.key === "F10" && event.shiftKey) {
            const bounds = row.getBoundingClientRect();
            contextMenu(new doc.defaultView.MouseEvent("contextmenu", {
                clientX: bounds.left + 20, clientY: bounds.top + bounds.height / 2
            }), node, beginCreate);
        }
        else return;
        if (target) {
            if (event.shiftKey && model.byPath.get(target.dataset.treePath).parent) {
                if (!selectedPaths.size && node.parent) selectItem({ ctrlKey: true, preventDefault() {}, stopPropagation() {} }, row, node.path);
                selectItem(event, target.firstElementChild, target.dataset.treePath);
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
            contextMenu(event, selectedFolder(), beginCreate);
        });
    }
    refresh({ restore: true });
    return { refresh, beginCreate, syncSelection, syncMode,
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
        destroy() { disposed = true; shell.remove(); }
    };
}

module.exports = { mountWorkspaceExplorer };
