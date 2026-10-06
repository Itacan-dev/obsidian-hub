"use strict";
const { createWindowTitle } = require("./window-title");

const { Modal, Component, setIcon } = require("obsidian");
const { parseLocalISODate } = require("../domain/dates");
const { activitySummary } = require("../domain/report-context");
const { createHubMarkdown } = require("./markdown");
const { renderHistoryIcon } = require("./dashboard-ui");

function reportText(parent, text, markdown, cls = "hub-report-text", sourcePath = "Home.md") {
    const element = parent.createDiv({ cls, text });
    if (markdown && text) void markdown.render(element, text, sourcePath);
    return element;
}

function time(parent, timestamp) {
    const date = new Date(Number(timestamp));
    if (!(Number(timestamp) > 0) || !Number.isFinite(date.getTime())) return;
    parent.createEl("time", { cls: "hub-report-time", text: date.toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit"
    }), attr: { datetime: date.toISOString(), title: date.toLocaleString() } });
}

function sectionIcon(parent, name) {
    const icon = parent.createSpan({ cls: "hub-report-section-icon", attr: { "aria-hidden": "true" } });
    if (name === "rotate-ccw-clock") renderHistoryIcon(icon);
    else setIcon(icon, name);
}

function focusSection(parent, heading, items, empty, markdown) {
    const section = parent.createDiv({ cls: "hub-report-section hub-report-focus" });
    const label = section.createEl("h3", { cls: "hub-report-section-heading" });
    sectionIcon(label, heading.startsWith("Next focus") ? "circle-arrow-right" : "target");
    label.createSpan({ text: heading });
    if (!items.length) section.createDiv({ cls: "hub-report-empty", text: empty });
    for (const text of items) reportText(section, text, markdown);
}

function renderTaskProgress(parent, items, markdown, { heading = "Task progress", showTimes = true } = {}) {
    const tasks = parent.createDiv({ cls: "hub-report-section" });
    tasks.createEl("h3", { text: heading });
    if (!items.length) tasks.createDiv({ cls: "hub-report-empty", text: "No task progress recorded for this day." });
    // Visible, bounded context uses the modal's native scrollbars; no active task controls.
    const list = tasks.createDiv({ cls: "hub-report-task-list", attr: { role: "list", "aria-label": heading } });
    if (items.length > 5) list.setAttribute("tabindex", "0");
    for (const task of [...items].sort((a, b) => a.timestamp - b.timestamp)) {
        const row = list.createDiv({ cls: "hub-report-evidence-row", attr: { role: "listitem" } });
        const icon = row.createSpan({ cls: "hub-report-check", attr: { "aria-hidden": "true" } });
        if (task.kind === "step") icon.classList.add("is-step-progress");
        setIcon(icon, task.kind === "step" ? "circle-check" : "square-check");
        reportText(row, task.kind === "step" ? `${task.parentText} \u00b7 ${task.text}` : task.text, markdown, "hub-report-text", task.path || "Home.md");
        if (showTimes) time(row, task.timestamp);
    }

    return tasks;
}

function renderReportEvidence(parent, context, markdown) {
    const evidence = parent.createDiv({ cls: "hub-report-evidence" });
    renderTaskProgress(evidence, context.tasks, markdown);

    if (!context.activity.length) {
        evidence.createDiv({ cls: "hub-report-empty hub-report-no-activity", text: "No activity recorded for this day." });
        return evidence;
    }
    const disclosure = evidence.createEl("details", { cls: "hub-report-activity" });
    const summary = disclosure.createEl("summary");
    sectionIcon(summary, "rotate-ccw-clock");
    summary.createSpan({ cls: "hub-report-section-label", text: "Activity summary" });
    summary.createSpan({ cls: "hub-report-activity-count", text: activitySummary(context.activity) });
    const chevron = summary.createSpan({ cls: "hub-report-chevron", attr: { "aria-hidden": "true" } });
    setIcon(chevron, "chevron-right");
    const entries = disclosure.createDiv({ cls: "hub-report-activity-list" });
    const icons = { created: "file", edited: "file-pen-line", deleted: "trash-2", renamed: "pencil-line",
        "project-created": "folder-plus", "project-deleted": "trash-2", "project-renamed": "folder-pen" };
    for (const entry of context.activity) {
        const row = entries.createDiv({ cls: "hub-report-evidence-row" });
        const icon = row.createSpan({ cls: `hub-report-activity-icon is-${entry.action}`, attr: { "aria-hidden": "true" } });
        setIcon(icon, icons[entry.action] ?? "file");
        const action = String(entry.action ?? "Activity").replace("project-", "");
        const label = action.charAt(0).toUpperCase() + action.slice(1);
        row.createSpan({ cls: "hub-report-text", text: action === "renamed"
            ? `${label} “${entry.oldTitle ?? ""}” to “${entry.title ?? ""}”`
            : `${label}${entry.action?.startsWith("project-") ? " project" : ""} “${entry.title ?? ""}”` });
        time(row, entry.timestamp);
    }
    return evidence;
}

// Reusable renderer: it knows nothing about the heatmap or the modal hosting it.
function renderDailyReport(parent, day, markdown) {
    for (const report of day.reports) {
        const card = parent.createEl("section", { cls: "hub-report-card" });
        const heading = card.createDiv({ cls: "hub-report-heading" });
        heading.createEl("h3", { cls: "hub-project-advancement-name", text: report.projectName });
        heading.createSpan({ cls: "hub-report-rating", text: report.score === null ? "Unrated" : `${report.score}/4` });
        // Short reflections are plain text: no Markdown paragraph margins or
        // extra DOM newlines on top of pre-wrap. Normalize display only.
        const summary = String(report.summary || "").replace(/\r\n?/g, "\n")
            .replace(/\n(?:[ \t]*\n){2,}/g, "\n\n");
        reportText(card, summary || "No summary recorded.", null,
            report.summary ? "hub-report-text hub-report-summary" : "hub-report-empty");
        renderReportEvidence(card, report.context, markdown);
        focusSection(card, "Focus for this day", report.context.focus, "No focus set for this day.", markdown);
        focusSection(card, "Next focus", day.nextFocus.filter(item => item.projectId === report.projectId)
            .map(item => item.text), "No next focus recorded.", markdown);
    }
    // The shared editor can target a workspace with no report (or the other scope).
    // Retain those intentions once, with their recorded workspace labels.
    const ids = new Set(day.reports.map(report => report.projectId));
    const otherFocus = day.nextFocus.filter(item => !ids.has(item.projectId));
    if (otherFocus.length) focusSection(parent, "Next focus · other workspaces", otherFocus.map(item =>
        item.projectName ? `${item.projectName}: ${item.text}` : item.text), "", markdown);
    if (day.sharedFocus?.length) focusSection(parent, "Focus for this day · shared",
        day.sharedFocus.map(item => item.text), "", markdown);
}

function reportTitle(date, editing = false) {
    const label = parseLocalISODate(date).toLocaleDateString([], {
        day: "numeric", month: "long", year: "numeric"
    });
    return `${editing ? "Edit progress report" : "Progress report"} — ${label}`;
}

class DailyReportModal extends Modal {
    constructor(app, { day, onEdit }) { super(app); this.day = day; this.onEdit = onEdit; }
    onOpen() {
        this.contentEl.addClass("hub-project-advancement-modal", "hub-daily-report-modal", "hub-button-scope");
        createWindowTitle(this.contentEl, reportTitle(this.day.date), "clipboard-check");
        this.renderComponent = new Component();
        this.renderComponent.load();
        const markdown = createHubMarkdown({ app: this.app, component: this.renderComponent });
        renderDailyReport(this.contentEl, this.day, markdown);
        const actions = this.contentEl.createDiv({ cls: "hub-project-advancement-actions" });
        if (this.onEdit) actions.createEl("button", { text: "Edit progress" }).addEventListener("click", () => {
            this.close(); this.onEdit();
        });
        actions.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
    }
    onClose() { this.renderComponent?.unload(); this.contentEl.empty(); }
}

module.exports = { reportTitle, DailyReportModal, renderDailyReport, renderReportEvidence, renderTaskProgress, focusSection };
