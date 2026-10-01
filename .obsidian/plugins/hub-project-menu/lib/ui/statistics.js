"use strict";

const { Modal, setIcon } = require("obsidian");
const { createImmediateHubTooltip } = require("./tooltips");
const { RANGES, aggregateStatistics, seriesFor, formatDuration } = require("../domain/statistics");
const { readStatistics } = require("../services/statistics");
const { renderBarChart, renderDonut, emptyChart, dateLabel } = require("./statistics-charts");

function workspaceLabel(row) {
    const state = row.deleted ? "Deleted" : row.status === "future" ? "Future" : row.status === "shelved" ? "Shelved" : null;
    return `${row.name}${state ? ` (${state})` : ""}`;
}

class StatisticsModal extends Modal {
    constructor(app, plugin, { source, onClose } = {}) {
        super(app); this.plugin = plugin; this.source = source; this.closed = onClose;
        this.range = "3m"; this.filters = { distribution: "project", activity: "project", tasks: "project", steps: "project" };
        this.cache = new Map(); this.chartCleanups = [];
    }
    onOpen() {
        this.contentEl.classList.add("hub-project-advancement-modal", "hub-statistics-modal", "hub-button-scope");
        this.modalEl.classList.add("hub-statistics-window");
        this.source ??= readStatistics(this.plugin);
        this.helpTooltips = createImmediateHubTooltip(this.contentEl);
        const header = this.contentEl.createDiv({ cls: "hub-statistics-header" });
        header.createEl("h2", { text: "Statistics" });
        const ranges = header.createDiv({ cls: "hub-panel-selectors hub-equal-selectors hub-statistics-ranges", attr: { role: "group", "aria-label": "Statistics time range" } });
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
        this.render();
    }
    card(id, title, { wide = false, options } = {}) {
        const card = this.grid.createEl("section", { cls: `hub-report-card hub-statistics-card${wide ? " hub-statistics-wide" : ""}`,
            attr: { "aria-label": title, "data-statistic": id } });
        const heading = card.createDiv({ cls: "hub-statistics-card-heading" });
        heading.createEl("h3", { text: title });
        if (options) {
            const select = heading.createEl("select", { attr: { "aria-label": `${title} workspace`, "data-filter": id } });
            options.forEach(([value, label]) => select.createEl("option", { text: label, attr: { value } }));
            select.value = this.filters[id];
            select.title = select.selectedOptions[0]?.textContent ?? "";
            select.style.width = Math.min(20, select.title.length + 5) + "ch";
            select.addEventListener("change", () => {
                this.filters[id] = select.value; const scrollTop = this.contentEl.scrollTop;
                this.render(); this.grid.querySelector(`[data-filter="${id}"]`)?.focus({ preventScroll: true }); this.contentEl.scrollTop = scrollTop;
            });
        }
        return card;
    }
    hint(parent, text) {
        const heading = parent.querySelector(".hub-statistics-card-heading");
        if (["oaths", "notes"].includes(parent.dataset.statistic)) {
            const help = heading.createEl("button", { cls: "hub-panel-action hub-panel-action-icon hub-statistics-help",
                attr: { type: "button", "aria-label": "About " + heading.textContent } });
            setIcon(help, "circle-help");
            this.helpTooltips.bind(help, { title: heading.querySelector("h3").textContent, description: text });
        } else {
            heading.setAttribute("title", text);
            heading.setAttribute("aria-description", text);
        }
    }
    chart(parent, values, label, empty, extra = {}) {
        const cleanup = renderBarChart(parent, { range: this.model.range, values, label, empty, ...extra });
        if (cleanup) this.chartCleanups.push(cleanup);
    }
    render() {
        this.helpTooltips?.dispose();
        this.helpTooltips = createImmediateHubTooltip(this.contentEl);
        if (!this.cache.has(this.range)) this.cache.set(this.range, aggregateStatistics(this.source, this.range));
        this.chartCleanups.splice(0).forEach(cleanup => cleanup());
        this.model = this.cache.get(this.range); this.grid.empty();
        const model = this.model, kinds = [["project", "Projects"], ["resource", "Resources"]];
        this.renderDistribution(kinds);
        const activity = this.card("activity", "Activity over time", { options: kinds });
        this.chart(activity, seriesFor(model, "activity", this.filters.activity), "Work records", "No work activity in this period.");
        this.hint(activity, "Note creations, recorded edits, and task or step completions.");
        const workspaceOptions = [["project", "All projects"], ["resource", "All resources"],
            ...model.rows.slice().sort((a, b) => a.name.localeCompare(b.name)).map(row => [row.key, workspaceLabel(row)])];
        for (const [id, title, color] of [["tasks", "Tasks completed", "green"], ["steps", "Steps completed", "blue"]]) {
            const card = this.card(id, title, { options: workspaceOptions });
            this.chart(card, seriesFor(model, id, this.filters[id]), title, `No completed ${id} in this period.`, { color, compact: true });
        }
        this.renderOaths(); this.renderNotes(); this.renderProjects();
        const comparison = this.card("comparison", "Resources vs Projects");
        comparison.createDiv({ cls: "hub-statistics-caption", text: "Share of progress report points" });
        renderDonut(comparison, model.comparison);
        this.hint(comparison, "Raw Progress Report evaluations (0?4), summed by workspace for the selected period.");
    }
    renderDistribution(options) {
        const card = this.card("distribution", "Work distribution", { options });
        const rows = this.model.rows.filter(row => row.kind === this.filters.distribution && row.progressPoints > 0)
            .sort((a, b) => b.progressPoints - a.progressPoints || a.name.localeCompare(b.name));
        if (!rows.length) { emptyChart(card, "No progress report data in this period."); return; }
        const total = rows.reduce((sum, row) => sum + row.progressPoints, 0);
        const list = card.createDiv({ cls: "hub-statistics-ranking", attr: { tabindex: "0", role: "list", "aria-label": "Workspace progress report points" } });
        for (const workspace of rows) {
            const row = list.createDiv({ cls: "hub-statistics-rank-row", attr: { role: "listitem" } });
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
        this.chart(body.createDiv(), note.values, "Notes created", "No note activity in this period.", { color: "muted", compact: true, summary: true });
        const metrics = body.createEl("dl", { cls: "hub-statistics-note-metrics" });
        for (const [label, value] of [["Total notes", note.total.toLocaleString()], ["Notes created (selected period)", note.created.toLocaleString()],
            ["Average per day", note.average.toFixed(1)], ["Largest day", `${note.largest} ${note.largest === 1 ? "note" : "notes"}${note.largestDate ? ` · ${dateLabel(new Date(note.largestDate + "T00:00:00"))}` : ""}`]]) {
            metrics.createEl("dt", { text: label }); metrics.createEl("dd", { text: value });
        }
        this.hint(card, "Current workspace Markdown notes, by file creation date. Deleted notes and workspace dashboards are excluded.");
    }
    renderProjects() {
        const card = this.card("projects", "Project activity"), projects = this.model.projects;
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
                attr: { title: project.lastActive ? new Date(project.lastActive).toLocaleString() : "No recorded work activity" } });
            row.createEl("td", { text: formatDuration(project.time) });
        }
        this.hint(card, "All project states. Last active is all-time; time follows the selected period.");
    }
    onClose() { this.helpTooltips?.dispose(); this.chartCleanups.splice(0).forEach(cleanup => cleanup()); this.cache.clear(); this.contentEl.empty(); this.closed?.(); }
}

module.exports = { StatisticsModal };
