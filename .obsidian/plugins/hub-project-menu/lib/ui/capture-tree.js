"use strict";
const { setHubIcon } = require("./icons");
const { fileIcon } = require("./file-icons");

// Shared location hierarchy, search and keyboard routing. The task/folder
// picker still commits a clicked row; the note-position picker keeps notes
// selected while folders only expand/collapse for navigation.
function mountCaptureLocationTree({ tree, search, getItems, selectedPath = () => null, onSelect,
    onMissing = () => {}, foldersOnly = false, showKind = true, collapsible = false }) {
    let focusPath = selectedPath();
    const collapsed = new Set();
    const rows = () => [...tree.querySelectorAll("button[role=treeitem]")];
    function focus(path) {
        focusPath = path;
        for (const button of rows()) button.tabIndex = button.dataset.capturePath === path ? 0 : -1;
        const target = rows().find(button => button.dataset.capturePath === path);
        target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: "nearest" });
    }
    function render() {
        const active = tree.contains(tree.ownerDocument.activeElement), scroll = tree.scrollTop;
        tree.empty();
        const entries = getItems().map(item => foldersOnly ? { ...item, folder: true } : item);
        const nodes = new Map(entries.map(item => [item.path, { item, children: [] }])), roots = [];
        for (const node of nodes.values()) {
            const parent = nodes.get(node.item.path.slice(0, node.item.path.lastIndexOf("/")));
            if (parent) parent.children.push(node); else roots.push(node);
        }
        const sort = nodes => nodes.sort((a, b) => Number(!!b.item.folder) - Number(!!a.item.folder) || a.item.path.localeCompare(b.item.path, undefined, { numeric: true }));
        const query = search.value.trim().toLocaleLowerCase(), visible = new Set();
        for (const item of entries) if (!query || [item.path, item.label, item.name].filter(Boolean).join(" ").toLocaleLowerCase().includes(query)) {
            for (let path = item.path; nodes.has(path); path = path.slice(0, path.lastIndexOf("/"))) visible.add(path);
        }
        const branch = (parent, node, depth, index, count) => {
            const item = node.item, folder = !!item.folder;
            const wrapper = parent.createDiv({ cls: "hub-capture-location-item" });
            const selected = item.path === selectedPath() && (!collapsible || !folder);
            const row = wrapper.createEl("button", { cls: "hub-button-plain hub-explorer-tree-row hub-capture-location-row" + (selected ? " is-selected" : ""), attr: {
                type: "button", role: "treeitem", "aria-level": String(depth + 1), "aria-posinset": String(index + 1), "aria-setsize": String(count),
                "aria-selected": String(selected), "aria-label": (item.label ?? item.path) + (folder ? ", Folder" : ", Markdown note")
            } });
            row.dataset.capturePath = item.path; row.dataset.captureDepth = String(depth); row.style.setProperty("--hub-tree-depth", depth);
            row.title = item.path;
            const children = sort(node.children.filter(child => visible.has(child.item.path)));
            const expanded = !collapsible || !!query || !collapsed.has(item.path);
            if (collapsible) {
                const chevron = row.createSpan({ cls: "hub-capture-tree-chevron", attr: { "aria-hidden": "true" } });
                if (folder) setHubIcon(chevron, expanded ? "chevron-down" : "chevron-right");
            }
            setHubIcon(row.createSpan({ cls: "hub-explorer-icon", attr: { "aria-hidden": "true" } }), folder ? "folder" : fileIcon(item.file ?? item.path));
            row.createSpan({ cls: "hub-explorer-name", text: item.name ?? item.file?.name?.replace(/\.md$/i, "") ?? item.path.split("/").pop().replace(/\.md$/i, "") });
            if (showKind) row.createSpan({ cls: "hub-capture-location-kind", text: folder ? "Folder" : "Markdown note" });
            row.addEventListener("click", () => {
                const current = getItems().find(candidate => candidate.path === item.path);
                if (!current) { onMissing(); render(); return; }
                focusPath = item.path;
                if (collapsible && folder) { toggle(item.path); return; }
                onSelect(current);
            });
            if (folder && (children.length || collapsible)) row.setAttribute("aria-expanded", String(expanded));
            if (children.length && expanded) {
                const group = wrapper.createDiv({ cls: "hub-explorer-group hub-capture-location-group", attr: { role: "group" } });
                group.style.setProperty("--hub-tree-depth", depth);
                children.forEach((child, i) => branch(group, child, depth + 1, i, children.length));
            }
        };
        const shownRoots = sort(roots.filter(node => visible.has(node.item.path)));
        shownRoots.forEach((node, i) => branch(tree, node, 0, i, shownRoots.length));
        const buttons = rows();
        if (!buttons.length) tree.createDiv({ cls: "hub-explorer-empty", text: query ? "No matching locations." : "No available workspace folders." });
        if (!buttons.some(row => row.dataset.capturePath === focusPath)) focusPath = buttons[0]?.dataset.capturePath;
        buttons.forEach(row => { row.tabIndex = row.dataset.capturePath === focusPath ? 0 : -1; });
        tree.scrollTop = scroll; if (active && focusPath) focus(focusPath);
    }
    function toggle(path) {
        if (collapsed.has(path)) collapsed.delete(path); else collapsed.add(path);
        render(); focus(path);
    }
    const key = event => {
        const buttons = rows(), index = buttons.indexOf(event.target);
        if (index < 0) return;
        const path = event.target.dataset.capturePath, expanded = event.target.getAttribute("aria-expanded");
        if (collapsible && !search.value.trim() && (event.key === "ArrowLeft" && expanded === "true" || event.key === "ArrowRight" && expanded === "false")) {
            event.preventDefault(); toggle(path); return;
        }
        let next = event.key === "ArrowDown" ? buttons[Math.min(buttons.length - 1, index + 1)] : event.key === "ArrowUp" ? buttons[Math.max(0, index - 1)] : event.key === "Home" ? buttons[0] : event.key === "End" ? buttons.at(-1) : null;
        if (event.key === "ArrowLeft") next = buttons.find(row => row.dataset.capturePath === path.slice(0, path.lastIndexOf("/")));
        if (event.key === "ArrowRight" && Number(buttons[index + 1]?.dataset.captureDepth) > Number(event.target.dataset.captureDepth)) next = buttons[index + 1];
        if (next) { event.preventDefault(); focus(next.dataset.capturePath); }
    };
    tree.addEventListener("keydown", key); search.addEventListener("input", render); render();
    return { render, focus, destroy() { tree.removeEventListener("keydown", key); search.removeEventListener("input", render); } };
}
module.exports = { mountCaptureLocationTree };
