"use strict";
const { setHubIcon: setIcon } = require("./icons");
const { taskDateLabel } = require("../domain/dates");
let sequence = 0;
const labels = { projects: "Projects", resources: "Resources", folders: "Folders", files: "Files", tasks: "Tasks", notes: "Note matches", phases: "Phases", milestones: "Milestones" };

function mountContextSearch({ service, component, dv, root, toolbar, scope = null }) {
    const doc = root.ownerDocument;
    toolbar.classList.add("hub-context-bar");
    const region = toolbar.createDiv({ cls: "hub-context-search" });
    const icon = region.createSpan({ cls: "hub-context-search-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, "search");
    const placeholder = !scope ? "Search Itacan…" : scope.contextKind === "resource" ? `Search ${scope.name}…` : "Search this project…";
    const id = `hub-context-results-${++sequence}`;
    const input = region.createEl("input", { type: "search", cls: "hub-context-search-input", attr: {
        placeholder, "aria-label": placeholder.replace(/…$/, ""), role: "combobox", "aria-autocomplete": "list",
        "aria-controls": id, "aria-expanded": "false", autocomplete: "off", spellcheck: "false"
    } });
    const popup = region.createDiv({ cls: "hub-context-results", attr: { id, role: "listbox", "aria-label": "Search results" } });
    popup.hidden = true;
    const status = region.createDiv({ cls: "hub-context-status", attr: { role: "status", "aria-live": "polite" } });
    let timer, generation = 0, disposed = false, rows = [], active = -1, opening = false;
    function close() {
        generation++; clearTimeout(timer); popup.hidden = true;
        input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant");
        popup.removeAttribute("aria-busy");
    }
    function highlight(index) {
        active = index;
        rows.forEach(({ element }, i) => { element.classList.toggle("is-active", i === active); element.setAttribute("aria-selected", String(i === active)); });
        if (rows[active]) {
            input.setAttribute("aria-activedescendant", rows[active].element.id);
            rows[active].element.scrollIntoView({ block: "nearest" });
        } else input.removeAttribute("aria-activedescendant");
    }
    async function open(result) {
        if (opening) return;
        opening = true; close();
        try { await service.open(result, root); }
        catch (error) { status.textContent = error.message ?? "Could not open this result."; }
        finally { opening = false; }
    }
    function render(groups, busy) {
        const selected = rows[active]?.result;
        popup.replaceChildren(); rows = []; active = -1;
        for (const group of groups) {
            const headingId = `${id}-${group.kind}`;
            const section = popup.createDiv({ cls: "hub-context-result-group", attr: { role: "group", "aria-labelledby": headingId } });
            section.createDiv({ cls: "hub-context-result-heading", text: labels[group.kind], attr: { id: headingId, role: "presentation" } });
            for (const result of group.items) {
                const element = section.createDiv({ cls: "hub-context-result", attr: { role: "option", id: `${id}-${rows.length}`, "aria-selected": "false" } });
                element.createDiv({ cls: "hub-context-result-title", text: result.title });
                element.createDiv({ cls: "hub-context-result-path", text: result.context });
                if (result.kind === "tasks") {
                    const date = result.task.dueDate ? taskDateLabel(result.task.dueDate, result.task.dueTime, true) : "";
                    if (date || result.task.completed) element.createSpan({ cls: "hub-context-result-date", text: [result.task.completed ? "Completed" : "", date].filter(Boolean).join(" · ") });
                }
                if (result.snippet) element.createDiv({ cls: "hub-context-result-snippet", text: result.snippet });
                const index = rows.length;
                element.addEventListener("pointerdown", event => event.preventDefault());
                element.addEventListener("pointermove", () => highlight(index));
                element.addEventListener("click", () => void open(result));
                rows.push({ element, result });
            }
        }
        if (!rows.length) popup.createDiv({ cls: "hub-context-empty", text: busy ? "Searching…" : "No matches in this scope." });
        const selectedIndex = rows.findIndex(row => selected && row.result.kind === selected.kind && row.result.path === selected.path && row.result.id === selected.id && row.result.task?.line === selected.task?.line);
        highlight(selectedIndex);
        popup.hidden = false; input.setAttribute("aria-expanded", "true"); popup.setAttribute("aria-busy", String(busy));
        status.textContent = busy ? "Searching" : `${rows.length} results`;
    }
    async function search(token) {
        const cancelled = () => disposed || generation !== token || root.closest(".hub-project-rail") || doc.activeElement !== input;
        try {
            const groups = await service.search(input.value, scope, dv, {
                cancelled, onNames: groups => { if (!cancelled()) render(groups, true); }
            });
            if (!cancelled()) render(groups, false);
        } catch (error) {
            if (!cancelled()) { render([], false); popup.firstElementChild.textContent = "Search is temporarily unavailable."; status.textContent = error.message; }
        }
    }
    function schedule() {
        clearTimeout(timer);
        const token = ++generation;
        if (!input.value.trim()) { close(); status.textContent = ""; return; }
        timer = setTimeout(() => void search(token), 100);
    }
    input.addEventListener("input", schedule);
    input.addEventListener("focus", schedule);
    input.addEventListener("keydown", event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
        else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            if (popup.hidden) { schedule(); return; }
            if (rows.length) highlight(active < 0 ? event.key === "ArrowDown" ? 0 : rows.length - 1 : (active + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length);
        } else if (event.key === "Enter" && !popup.hidden && rows[active < 0 ? 0 : active]) { event.preventDefault(); void open(rows[active < 0 ? 0 : active].result); }
        else if (event.key === "Tab") close();
    });
    const outside = event => { if (!region.contains(event.target)) close(); };
    doc.addEventListener("pointerdown", outside);
    input.addEventListener("blur", close);
    service.subscribe(component, () => { if (!popup.hidden) schedule(); });
    component.register(() => { disposed = true; close(); doc.removeEventListener("pointerdown", outside); });
    return { input, close };
}
module.exports = { mountContextSearch };
