"use strict";
const { ownModalColors } = require("./color-system");

const { createWindowTitle, setWindowUndertext, layoutModal } = require("./window-title");

const { renderReportWorkspaceHeader } = require("./report-workspace-header");

const { Modal, Component, setIcon } = require("obsidian");
const { parseLocalISODate, formatDate, formatTime, formatDateTime } = require("../domain/dates");
const { renderDetailsChevron } = require("./disclosure");
const { createHubMarkdown } = require("./markdown");

function reportText(parent, text, markdown, cls = "hub-report-text", sourcePath = "Home.md") {
    const element = parent.createDiv({ cls, text });
    if (markdown && text) void markdown.render(element, text, sourcePath);
    return element;
}

function time(parent, timestamp) {
    const date = new Date(Number(timestamp));
    if (!(Number(timestamp) > 0) || !Number.isFinite(date.getTime())) return;
    parent.createEl("time", { cls: "hub-report-time", text: formatTime(date), attr: { datetime: date.toISOString(), title: formatDateTime(date) } });
}

function renderTaskProgress(parent, items, markdown, { heading = "Task progress", showTimes = true, hideEmptyHeading = false, component, availability = "current" } = {}) {
    const tasks = parent.createDiv({ cls: "hub-report-section" });
    if (items.length || !hideEmptyHeading) tasks.createEl("h3", { text: heading });
    if (availability !== "current") { tasks.createDiv({ cls: "hub-report-empty", text: "Task progress unavailable. Completion evidence could not be confirmed." }); return tasks; }
    if (!items.length) tasks.createDiv({ cls: "hub-report-empty", text: "No task progress recorded for this day." });
    // Visible, bounded context uses the modal's native scrollbars; no active task controls.
    const list = tasks.createDiv({ cls: "hub-report-task-list", attr: { role: "list", "aria-label": heading } });
    for (const task of [...items].sort((a, b) => a.timestamp - b.timestamp)) {
        const row = list.createDiv({ cls: "hub-report-evidence-row", attr: { role: "listitem" } });
        const icon = row.createSpan({ cls: "hub-report-check", attr: { "aria-hidden": "true" } });
        if (task.kind === "step") icon.classList.add("is-step-progress");
        setIcon(icon, task.kind === "step" ? "circle-check" : "square-check");
        reportText(row, task.kind === "step" ? `${task.parentText} \u00b7 ${task.text}` : task.text, markdown, "hub-report-text", task.path || "Home.md");
        if (showTimes) time(row, task.timestamp);
    }

    if (component) {
        const update = () => {
            if (list.scrollHeight > list.clientHeight && list.clientHeight > 0) list.setAttribute("tabindex", "0");
            else list.removeAttribute("tabindex");
        };
        // Bounded lists can overflow with only a few wrapped items. Observe the
        // rows as well as the list so async Markdown and width changes update it.
        const observer = new list.ownerDocument.defaultView.ResizeObserver(update);
        observer.observe(list);
        for (const row of list.children) observer.observe(row);
        component.register(() => observer.disconnect());
        update();
    } else if (items.length > 5) list.setAttribute("tabindex", "0");

    return tasks;
}

function renderReportEvidence(parent, context, markdown, component) {
    const disclosure = parent.createEl("details", { cls: "hub-report-recorded-work" });
    const summary = disclosure.createEl("summary");
    renderDetailsChevron(summary);
    summary.createSpan({ text: "View work done" });
    const body = disclosure.createDiv();
    renderReportEvidenceDetails(body, context, markdown, component);
    for (const oath of context.oaths ?? []) body.createDiv({ cls: "hub-report-evidence-row", text: "Oath fulfilled \u00b7 " + formatTime(new Date(oath.fulfilledAt)) });
    return disclosure;
}
function renderReportEvidenceDetails(parent, context, markdown, component) {
    const evidence = parent.createDiv({ cls: "hub-report-evidence" });
    renderTaskProgress(evidence, context.tasks, markdown, { hideEmptyHeading: true, component, availability: context.tasksAvailability ?? "current" });

    if (!context.activity.length) {
        evidence.createDiv({ cls: "hub-report-empty hub-report-no-activity", text: "No activity recorded for this day." });
        return evidence;
    }
    evidence.createEl("h3", { text: "File and workspace activity" });
    const entries = evidence.createDiv({ cls: "hub-report-activity-list" });
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
function renderDailyReport(parent, day, markdown, plugin, component) {
    for (const report of day.reports) {
        const card = parent.createEl("section", { cls: "hub-report-card" });
        const heading = renderReportWorkspaceHeader(card, report, plugin);
        heading.createSpan({ cls: "hub-report-rating", text: report.score === null ? "Unrated" : `${report.score}/4` });
        const resource = report.contextKind === "resource" || !!report.resourceType || report.projectId?.startsWith("resource:");
        const workspace = resource
            ? plugin?.projectWizard?.getResourceById?.(report.resourceType || report.projectId?.slice(9))
            : plugin?.projectWizard?.getProjectById?.(report.projectId);
        reportText(card, report.summary || "No summary recorded.", markdown,
            report.summary ? "hub-report-text hub-report-summary hub-report-reflection" : "hub-report-empty",
            workspace?.path || workspace?.hubPath || report.path || report.hubPath || "Home.md");
        renderReportEvidence(card, report.context, markdown, component);
    }
}

function reportTitle(date, editing = false) {
    return editing ? "Edit progress report" : "Progress report";
}

class DailyReportModal extends Modal {
    constructor(app, { day, onEdit, plugin }) { super(app); this.day = day; this.onEdit = onEdit; this.plugin = plugin; }
    onOpen() { ownModalColors(this);
        this.contentEl.addClass("hub-project-advancement-modal", "hub-daily-report-modal", "hub-button-scope");
        const heading = createWindowTitle(this.contentEl, reportTitle(this.day.date), "clipboard-check", {
            date: { value: this.day.date, label: formatDate(parseLocalISODate(this.day.date), "full") }
        });
        setWindowUndertext(heading, this.contentEl.createEl("p", { cls: "hub-progress-rating-guidance hub-oath-muted",
            text: "A summary of your work and progress for the day" }));
        this.renderComponent = new Component();
        this.renderComponent.load();
        const markdown = createHubMarkdown({ app: this.app, component: this.renderComponent });
        renderDailyReport(this.contentEl, this.day, markdown, this.plugin, this.renderComponent);
        const actions = this.contentEl.createDiv({ cls: "hub-project-advancement-actions" });
        layoutModal(this, { footer: actions, bodyClass: "hub-report-scroll" });
        if (this.onEdit) actions.createEl("button", { text: "Edit progress" }).addEventListener("click", () => {
            this.close(); this.onEdit();
        });
        actions.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
    }
    onClose() { this.renderComponent?.unload(); this.contentEl.empty(); }
}

module.exports = { reportTitle, DailyReportModal, renderDailyReport, renderReportEvidence, renderTaskProgress };
