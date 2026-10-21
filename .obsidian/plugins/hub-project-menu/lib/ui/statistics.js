"use strict";
const { createWindowTitle, layoutModal } = require("./window-title");

const { Modal, setIcon } = require("obsidian");
const { formatDateTime } = require("../domain/dates");
const { createImmediateHubTooltip } = require("./tooltips");
const { RANGES, aggregateStatistics, seriesFor, formatDuration } = require("../domain/statistics");
const { readStatistics } = require("../services/statistics");
const { renderBarChart, renderDonut, emptyChart, dateLabel, renderLegend } = require("./statistics-charts");

function workspaceLabel(row) {
    const state = row.deleted ? "Deleted" : row.status === "future" ? "Future" : row.status === "shelved" ? "Shelved" : null;
    return `${row.name}${state ? ` (${state})` : ""}`;
}

const consumers = new WeakMap();
function ownModal(modal) {
    const plugin = modal.plugin;
    if (!plugin?.register) return;
    let active = consumers.get(plugin);
    if (!active) {
        consumers.set(plugin, active = new Set());
        plugin.register(() => { for (const item of [...active]) item.close(); active.clear(); consumers.delete(plugin); });
    }
    active.add(modal);
}

class StatisticsModal extends Modal {
    constructor(app, plugin, { source, onClose, completionFeed } = {}) {
        super(app); this.plugin = plugin; this.source = source; this.closed = onClose;
        this.completionFeed = completionFeed; this.suppliedSource = completionFeed ? undefined : source; this.generation = 0; this.isOpen = false;
        this.range = "all"; this.workspace = "all";
        this.cache = new Map(); this.chartCleanups = [];
    }
    onOpen() {
        this.isOpen = true; this.generation++; this.contentEl.empty(); ownModal(this);
        this.source = this.suppliedSource;
        this.contentEl.classList.add("hub-project-advancement-modal", "hub-statistics-modal", "hub-button-scope");
        this.modalEl.classList.add("hub-statistics-window");
        this.helpTooltips = createImmediateHubTooltip(this.contentEl);
        const header = this.contentEl.createDiv({ cls: "hub-statistics-header" });
        createWindowTitle(header, "Statistics", "chart-no-axes-column");
        const controls = header.createDiv({ cls: "hub-statistics-controls" });
        this.workspaceSelect = controls.createEl("select", { cls: "hub-statistics-workspace",
            attr: { "aria-label": "Statistics workspace", "data-filter": "workspace" } });
        this.workspaceSelect.createEl("option", { text: "All workspaces", attr: { value: "all" } });
        this.workspaceSelect.value = this.workspace;
        this.workspaceSelect.addEventListener("change", () => {
            this.workspace = this.workspaceSelect.value; this.render();
        });
        const rangeScroll = controls.createDiv({ cls: "hub-statistics-ranges" });
        const ranges = rangeScroll.createDiv({ cls: "hub-panel-selectors hub-equal-selectors", attr: { role: "group", "aria-label": "Statistics time range" } });
        this.rangeButtons = RANGES.map(([key, label]) => {
            const button = ranges.createEl("button", { text: label, attr: { type: "button", "aria-pressed": String(key === this.range) } });
            button.classList.toggle("is-active", key === this.range);
            button.addEventListener("click", () => {
                this.range = key;
                this.rangeButtons.forEach(([value, item]) => { item.classList.toggle("is-active", value === key); item.setAttribute("aria-pressed", String(value === key)); });
                this.render();
            });
            return [key, button];
        });
        this.grid = this.contentEl.createDiv({ cls: "hub-statistics-grid" });
        layoutModal(this);
        this.stopCompletionFeed = this.completionFeed?.subscribe(() => {
            if (!this.isOpen) return;
            this.generation++; this.source = undefined; this.cache.clear(); this.chartCleanups.splice(0).forEach(cleanup => cleanup()); this.grid.empty(); void this.loadSource();
        });
        if (this.source) this.ready();
        else void this.loadSource();
    }
    ready() {
        this.status?.remove(); this.status = null;
        this.workspaceSelect.querySelectorAll("optgroup").forEach(group => group.remove());
        for (const [kind, label] of [["project", "Projects"], ["resource", "Resources"]]) {
            const group = this.workspaceSelect.createEl("optgroup", { attr: { label } });
            [...this.source.registry.values()].filter(row => row.kind === kind).sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key))
                .forEach(row => group.createEl("option", { text: workspaceLabel(row), attr: { value: row.key } }));
        }
        this.workspaceSelect.value = this.workspace;
        this.render();
    }
    async loadSource() {
        const ticket = ++this.generation;
        this.status?.remove();
        this.status = this.grid.createDiv({ attr: { role: "status" }, text: "Loading Statistics…" });
        try {
            const source = await readStatistics(this.plugin, Date.now(), this.completionFeed);
            if (!this.isOpen || ticket !== this.generation) return;
            this.source = source; this.ready();
        } catch (_) {
            if (!this.isOpen || ticket !== this.generation) return;
            this.source = undefined; this.cache.clear();
            this.chartCleanups.splice(0).forEach(cleanup => cleanup()); this.grid.empty();
            this.status = this.grid.createDiv({ attr: { role: "alert" }, text: "Statistics could not be loaded." });
            const retry = this.status.createEl("button", { text: "Retry", attr: { type: "button" } });
            retry.addEventListener("click", () => { void this.loadSource(); });
        }
    }
    card(id, title, { wide = false } = {}) {
        const card = this.grid.createEl("section", { cls: `hub-report-card hub-statistics-card${wide ? " hub-statistics-wide" : ""}`,
            attr: { "aria-label": title, "data-statistic": id } });
        card.createDiv({ cls: "hub-statistics-card-heading" }).createEl("h3", { text: title });
        return card;
    }
    hint(parent, text) {
        const heading = parent.querySelector(".hub-statistics-card-heading");
        const title = heading.querySelector("h3").textContent;
        const help = heading.createEl("button", { cls: "hub-panel-action hub-panel-action-icon hub-statistics-help",
            attr: { type: "button", "aria-label": "About " + title } });
        setIcon(help, "circle-help");
        this.helpTooltips.bind(help, { title, description: text });
    }
    chart(parent, values, label, empty, extra = {}) {
        const cleanup = renderBarChart(parent, { range: this.model.range, values, label, empty, ...extra });
        if (cleanup) this.chartCleanups.push(cleanup);
    }
    render() {
        if (!this.source || !this.isOpen) return;
        this.helpTooltips?.dispose();
        this.helpTooltips = createImmediateHubTooltip(this.contentEl);
        const cacheKey = `${this.range}/${this.workspace}`;
        if (!this.cache.has(cacheKey)) {
            this.cache.set(cacheKey, aggregateStatistics(this.source, this.range, this.workspace));
            // Bound cached selections while retaining the single read-only snapshot.
            if (this.cache.size > 10) this.cache.delete(this.cache.keys().next().value);
        }
        this.chartCleanups.splice(0).forEach(cleanup => cleanup());
        this.model = this.cache.get(cacheKey); this.grid.empty();
        this.workspaceSelect.title = this.workspaceSelect.selectedOptions[0]?.textContent ?? "All workspaces";
        this.renderDistribution();
        const model = this.model;
        const activity = this.card("activity", "Activity over time");
        const categories = [["project", "Projects"], ["resource", "Resources"]]
            .filter(([kind]) => this.workspace === "all" || this.source.registry.get(this.workspace)?.kind === kind)
            .map(([kind, label]) => ({ label, color: kind, values: seriesFor(model, "activity", this.workspace === "all" ? kind : this.workspace) }));
        if (categories.length > 1) renderLegend(activity, categories);
        this.chart(activity, null, "Work records", "No work activity in this period.", { series: categories, stacked: true });
        this.hint(activity, "Counts recorded note creations, note edits, and task or step completions in the selected period and workspace. Records are grouped into date bins; All workspaces stacks Projects and Resources within each bin.");
        const completed = this.card("completions", "Tasks & steps completed", { wide: true });
        const completionSeries = [["tasks", "Tasks", "green"], ["steps", "Steps", "blue"]]
            .map(([metric, label, color]) => ({ label, color, values: seriesFor(model, metric, this.workspace) }));
        renderLegend(completed, completionSeries);
        this.chart(completed, null, "Tasks & steps completed", "No completed tasks or steps in this period.", { series: completionSeries, compact: true });
        this.renderOaths(); this.renderNotes(); this.renderProjects();
        const comparison = this.card("comparison", "Projects vs Resources");
        renderDonut(comparison, model.comparison);
        this.hint(comparison, "Share of progress report points. Raw evaluations (0–4) summed across all Projects and Resources for the selected period, independent of the workspace filter.");
    }
    renderDistribution() {
        const card = this.card("distribution", "Work distribution");
        this.hint(card, "Progress report rating points (0–4 per workspace/report), summed by workspace for the selected period and workspace filter. Percentages show each workspace's share of those points, not hours worked or time spent.");
        const rows = this.model.rows.filter(row => (this.workspace === "all" || row.key === this.workspace) && row.progressPoints > 0)
            .sort((a, b) => b.progressPoints - a.progressPoints || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
        if (!rows.length) { emptyChart(card, "No progress report data in this period."); return; }
        const total = rows.reduce((sum, row) => sum + row.progressPoints, 0);
        const list = card.createDiv({ cls: "hub-statistics-ranking", attr: { tabindex: "0", role: "list", "aria-label": "Workspace progress report points" } });
        for (const workspace of rows) {
            const row = list.createDiv({ cls: "hub-statistics-rank-row hub-statistics-series-" + workspace.kind, attr: { role: "listitem", "data-workspace": workspace.key } });
            if (workspace.status === "unassigned") {
                row.classList.add("is-unassigned");
                row.setAttribute("title", "Historical work without workspace attribution");
                row.setAttribute("aria-description", "Historical work without workspace attribution");
            }
            const label = workspaceLabel(workspace), percent = workspace.progressPoints / total * 100;
            row.createSpan({ cls: "hub-statistics-name", text: label, attr: { title: label } });
            const track = row.createDiv({ cls: "hub-statistics-track", attr: { "aria-hidden": "true" } });
            track.createDiv({ cls: "hub-statistics-fill" }).style.width = `${workspace.progressPoints / rows[0].progressPoints * 100}%`;
            row.createSpan({ cls: "hub-statistics-number", text: percent < 1 ? "<1%" : `${Math.round(percent)}%` });
            row.createSpan({ cls: "hub-statistics-number", text: `${workspace.progressPoints.toLocaleString()} pts` });
        }
    }
    renderOaths() {
        const card = this.card("oaths", "Oathbound time", { wide: true }), oath = this.model.oath;
        const body = card.createDiv({ cls: "hub-statistics-split" });
        this.chart(body.createDiv(), oath.values, "Oathbound time", "No Oaths recorded in this period.", { duration: true, compact: true, summary: true });
        const metrics = body.createDiv({ cls: "hub-statistics-metrics" });
        for (const [label, value] of [["Total Oathbound time", formatDuration(oath.total)], ["Oaths taken", oath.taken.toLocaleString()],
            ["Oaths fulfilled", `${oath.fulfilled}${oath.taken ? ` (${Math.round(oath.fulfilled / oath.taken * 100)}%)` : ""}`]]) {
            const metric = metrics.createDiv(); metric.createSpan({ text: label }); metric.createEl("strong", { text: value });
        }
        this.hint(card, "Ended sessions across devices. Time falls on the dates worked; Oaths are counted by start date.");
    }
    renderNotes() {
        const card = this.card("notes", "Notes", { wide: true }), note = this.model.note;
        const body = card.createDiv({ cls: "hub-statistics-split" });
        this.chart(body.createDiv(), note.values, "Notes created", "No notes created in this period.", { color: "muted", compact: true, summary: true });
        const metrics = body.createDiv({ cls: "hub-statistics-metrics hub-statistics-note-metrics" });
        for (const [label, value] of [["Total notes", note.total], ["Notes edited", note.edited]]) {
            const metric = metrics.createDiv(); metric.createSpan({ text: label }); metric.createEl("strong", { text: value.toLocaleString() });
        }
        this.hint(card, "Total notes counts distinct surviving workspace Markdown notes created or recorded as edited during the selected period. Notes edited counts distinct surviving notes with recorded edits in that period. Both follow the workspace filter. The chart uses file creation dates; dashboards, metadata and deleted notes are excluded.");
    }

    renderProjects() {
        const card = this.card("projects", "Project activity"), projects = this.model.projects;
        this.hint(card, "Projects in all states, independent of the workspace filter. Last active is the latest recorded note creation, note edit, task or step completion, or ended Oath, across all dates. Oathbound time is time from fulfilled or broken Oaths overlapping the selected period.");
        if (!projects.length) { emptyChart(card, "No project activity recorded yet."); return; }
        const scroll = card.createDiv({ cls: "hub-statistics-project-list", attr: { tabindex: "0", "aria-label": "Project activity", role: "region" } });
        const table = scroll.createEl("table");
        const heading = table.createEl("thead").createEl("tr");
        for (const label of ["Project", "Last active", "Oathbound time"]) heading.createEl("th", { text: label, attr: { scope: "col" } });
        const body = table.createEl("tbody");
        for (const project of projects) {
            const row = body.createEl("tr"), name = workspaceLabel(project);
            row.createEl("th", { attr: { scope: "row" } }).createSpan({ cls: "hub-statistics-name", text: name, attr: { title: name } });
            row.createEl("td", { text: project.lastActive ? dateLabel(project.lastActive, new Date(project.lastActive).getFullYear() !== new Date(this.source.now).getFullYear()) : "No activity",
                attr: { title: project.lastActive ? formatDateTime(new Date(project.lastActive)) : "No recorded work activity" } });
            row.createEl("td", { text: formatDuration(project.time) });
        }
    }
    onClose() { this.isOpen = false; this.stopCompletionFeed?.(); this.stopCompletionFeed = null; this.generation++; consumers.get(this.plugin)?.delete(this); this.helpTooltips?.dispose(); this.chartCleanups.splice(0).forEach(cleanup => cleanup()); this.cache.clear(); this.contentEl.empty(); this.closed?.(); }
}

module.exports = { StatisticsModal };
