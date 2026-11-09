"use strict";
const { ownModalColors } = require("./color-system");

const { createWindowTitle, setWindowUndertext, layoutModal } = require("./window-title");
const { Modal, Component, setIcon } = require("obsidian");
const { parseLocalISODate, formatDate, formatWeekday } = require("../domain/dates");
const { createHubMarkdown } = require("./markdown");
const { renderTaskProgress } = require("./daily-report");

function briefDateLabel(date, includeYear = false) {
    const value = parseLocalISODate(date);
    return value ? formatWeekday(value) + ", " + formatDate(value, "full", includeYear || value.getFullYear() !== new Date().getFullYear()) : "";
}

// Presentation accepts provider results, never the concrete recommendation rules.
class DailyBriefModal extends Modal {
    constructor(app, { context, recommendation, onAction, onReport, onClose }) {
        super(app); Object.assign(this, { context, recommendation, onAction, onReport, closed: onClose });
        this.selectedDate = context.lastWorkDate; this.expanded = false;
    }
    onOpen() { ownModalColors(this);
        this.contentEl.classList.add("hub-project-advancement-modal", "hub-daily-brief-modal", "hub-button-scope");
        this.component = new Component(); this.component.load();
        this.markdown = createHubMarkdown({ app: this.app, component: this.component });
        this.render();
    }
    action(parent, label, callback, cls = "") {
        const button = parent.createEl("button", { cls, text: label, attr: { type: "button" } });
        button.addEventListener("click", async () => {
            if (button.disabled) return;
            button.disabled = true;
            try { await callback(); }
            catch (error) {
                console.error("Daily Brief action failed", error);
                this.error.textContent = "That destination could not be opened. Close the brief to return to your workspace.";
            } finally { button.disabled = false; }
        });
        return button;
    }
    showDate(date) {
        this.selectedDate = date; this.expanded = false; this.render(); this.contentEl.scrollTop = 0;
        this.contentEl.querySelector("h2")?.focus();
    }
    render() {
        this.markdown.clear(); this.contentEl.empty();
        const root = this.contentEl, historical = this.selectedDate !== this.context.lastWorkDate;
        const headingTitle = createWindowTitle(root, "Daily brief", "newspaper", { attr: { tabindex: "-1" } });
        setWindowUndertext(headingTitle, root.createDiv({ cls: "hub-brief-date", text: briefDateLabel(this.context.briefDate, true) }));
        if (historical) this.action(root, "Back to today's brief", () => this.showDate(this.context.lastWorkDate), "hub-brief-back");
        const day = this.context.days.find(day => day.date === this.selectedDate);
        if (!day) { layoutModal(this); return; }
        const heading = root.createDiv({ cls: "hub-brief-section-heading" });
        heading.createEl("h3", { text: `${historical ? "Work" : "Last work"} \u00b7 ${briefDateLabel(day.date)}` });
        if (day.hasReport) this.action(heading, "View full report", () => this.onReport(day.date));
        const workspaces = root.createDiv({ cls: "hub-brief-workspaces" });
        for (const workspace of day.workspaces.slice(0, this.expanded ? undefined : 3)) this.renderWorkspace(workspaces, workspace);
        if (!this.expanded && day.workspaces.length > 3) {
            this.action(root, `${day.workspaces.length - 3} more workspaces`, () => { this.expanded = true; this.render(); }, "hub-brief-more");
        }
        if (!historical && this.recommendation) {
            const next = root.createEl("section", { cls: "hub-brief-next" });
            next.createEl("h3", { text: "Next up" });
            next.createDiv({ cls: "hub-report-text", text: this.recommendation.explanation });
            const button = this.action(next, "", () => this.onAction(this.recommendation.target), "mod-cta hub-brief-primary");
            button.createSpan({ cls: "hub-brief-action-label" }).createSpan({ text: this.recommendation.actionLabel });
            if (this.recommendation.secondaryLabel) button.createSpan({ cls: "hub-brief-action-context", text: this.recommendation.secondaryLabel });
        }
        const earlier = this.context.days.slice(1, 4);
        if (earlier.length) {
            const section = root.createEl("section", { cls: "hub-brief-earlier" });
            section.createEl("h3", { text: "Earlier days" });
            for (const day of earlier) {
                const button = this.action(section, "", () => this.showDate(day.date), "hub-button-plain hub-brief-day");
                button.createSpan({ text: briefDateLabel(day.date) });
                const icon = button.createSpan({ attr: { "aria-hidden": "true" } }); setIcon(icon, "chevron-right");
                if (day.date === this.selectedDate) button.setAttribute("aria-current", "date");
            }
        }
        this.error = root.createDiv({ cls: "hub-report-empty", attr: { role: "status" } });
        layoutModal(this);
    }
    renderWorkspace(parent, workspace) {
        const card = parent.createEl("section", { cls: "hub-report-card" });
        card.createEl("h3", { cls: "hub-project-advancement-name", text: workspace.workspaceName });
        if (workspace.progressSummary) card.createDiv({ cls: "hub-report-text hub-report-summary", text: workspace.progressSummary });
        else if (workspace.fulfilledOaths.length && !workspace.taskProgress.length) card.createDiv({ cls: "hub-report-text", text: "Fulfilled an Oath." });
        if (workspace.taskProgress.length || workspace.nextFocus.length) {
            const details = card.createDiv({ cls: "hub-brief-details" });
            if (workspace.taskProgress.length) renderTaskProgress(details, workspace.taskProgress, this.markdown, { heading: "Progress on tasks", showTimes: false });
            if (workspace.nextFocus.length) {
                const focus = details.createDiv({ cls: "hub-report-section" });
                focus.createEl("h3", { text: "Next focus" });
                for (const item of workspace.nextFocus) focus.createDiv({ cls: "hub-report-text", text: item.text });
            }
        }
        if (workspace.lastRelevantFile) {
            const file = workspace.lastRelevantFile;
            const button = this.action(card, "", () => this.onAction(file), "hub-button-plain hub-brief-file");
            const icon = button.createSpan({ attr: { "aria-hidden": "true" } }); setIcon(icon, "file-text");
            button.createSpan({ text: file.path.split("/").pop() });
            button.setAttribute("title", file.path);
        }
    }
    onClose() { this.component?.unload(); this.contentEl.empty(); this.closed?.(); }
}
module.exports = { DailyBriefModal, briefDateLabel };
