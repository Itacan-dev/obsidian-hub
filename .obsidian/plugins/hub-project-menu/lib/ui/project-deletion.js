"use strict";
const { Modal, setIcon } = require("obsidian");

class ProjectDeletionModal extends Modal {
    constructor(app, projectName, targetPath) {
        super(app);
        this.projectName = projectName;
        this.targetPath = targetPath;
        this.settled = false;
        this.unlocked = false;
        this.phase = "name";
    }

    waitForConfirmation() {
        return new Promise(resolve => { this.resolve = resolve; this.open(); });
    }

    canConfirm() {
        return !this.settled && this.phase === "confirm" && this.unlocked && performance.now() >= this.deadline &&
            this.input?.value === this.projectName;
    }

    beginCountdown() {
        if (this.settled || this.phase !== "name" || this.input.value !== this.projectName) return;
        this.phase = "countdown";
        this.deadline = performance.now() + 30000;
        const size = this.confirm.getBoundingClientRect();
        this.countdown.style.width = `${size.width}px`;
        this.countdown.style.height = `${size.height}px`;
        this.confirm.hidden = true;
        this.countdown.hidden = false;
        this.updateCountdown();
        this.timer = setInterval(() => this.updateCountdown(), 100);
        this.cancel.focus();
    }

    updateButton() {
        this.confirm.disabled = this.phase === "name"
            ? this.input.value !== this.projectName : !this.canConfirm();
    }

    finish(confirmed) {
        // Every activation, including keyboard/programmatic clicks, goes through
        // the real deadline and exact-name check, never just button.disabled.
        if (this.settled || (confirmed && !this.canConfirm())) return;
        this.settled = true;
        this.resolve?.(confirmed);
        this.resolve = null;
        this.close();
    }

    onOpen() {
        const content = this.contentEl;
        content.addClass("hub-button-scope", "hub-project-deletion");
        content.createEl("h2", { text: "Delete project?" });
        content.createEl("p", { text: `This will move “${this.projectName}” to the trash, including any files inside the selected folder.` });
        content.createDiv({ cls: "hub-project-deletion-path", text: this.targetPath });
        const label = content.createEl("label", { cls: "hub-project-deletion-label" });
        label.createSpan({ text: `Type the exact project name to confirm: ${this.projectName}` });
        this.input = label.createEl("input", { type: "text" });
        this.input.spellcheck = false;
        this.input.setAttribute("autocomplete", "off");
        this.input.setAttribute("autocapitalize", "off");
        this.input.addEventListener("input", () => this.updateButton());
        const actions = content.createDiv({ cls: "hub-project-wizard-actions" });
        const cancel = this.cancel = actions.createEl("button", { text: "Cancel" });
        this.confirm = actions.createEl("button", { text: "Delete", cls: "mod-warning" });
        this.countdown = actions.createEl("button", { cls: "mod-warning hub-project-deletion-status" });
        this.countdown.type = "button";
        this.countdown.disabled = true;
        this.countdown.hidden = true;
        const icon = this.countdown.createSpan();
        icon.setAttribute("aria-hidden", "true");
        setIcon(icon, "clock");
        this.status = this.countdown.createSpan();
        this.status.setAttribute("role", "status");
        this.status.setAttribute("aria-live", "polite");
        cancel.type = this.confirm.type = "button";
        this.confirm.disabled = true;
        cancel.addEventListener("click", () => this.finish(false));
        this.confirm.addEventListener("click", () => {
            if (this.phase === "name") this.beginCountdown();
            else this.finish(true);
        });
        this.onKeydown = event => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            event.stopPropagation();
            if (event.isComposing || event.repeat) return;
            if (event.target === cancel) this.finish(false);
            else if (event.target === this.confirm) this.confirm.click();
            else if (event.target === this.input && this.phase === "name") this.beginCountdown();
        };
        content.addEventListener("keydown", this.onKeydown, true);
        this.input.focus();
    }

    updateCountdown() {
        if (this.settled || this.phase !== "countdown") return;
        const seconds = Math.max(0, Math.ceil((this.deadline - performance.now()) / 1000));
        const text = `${seconds}s`;
        if (this.status.textContent !== text) this.status.textContent = text;
        if (!seconds && !this.unlocked) {
            clearInterval(this.timer);
            this.timer = null;
            this.unlocked = true;
            this.phase = "confirm";
            this.countdown.hidden = true;
            this.confirm.textContent = "Confirm";
            this.confirm.hidden = false;
        }
        this.updateButton();
    }

    onClose() {
        clearInterval(this.timer);
        this.timer = null;
        this.contentEl.removeEventListener("keydown", this.onKeydown, true);
        if (!this.settled) {
            this.settled = true;
            this.resolve?.(false);
            this.resolve = null;
        }
        this.contentEl.empty();
    }
}

module.exports = { ProjectDeletionModal };
