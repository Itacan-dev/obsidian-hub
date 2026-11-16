"use strict";
const { Modal, Component, Notice, setIcon } = require("obsidian");
const { ownModalColors } = require("./color-system");
const { createWindowTitle, layoutModal } = require("./window-title");
const { lockModalControls } = require("./modal-save");
const { setHubTooltip } = require("./tooltips");
const { renderReportWorkspaceHeader } = require("./report-workspace-header");
const { renderReportEvidence } = require("./daily-report");
const { createHubMarkdown } = require("./markdown");
const { progressRatingOptions } = require("../config");
const { localISODate } = require("../domain/dates");
const { normalizeFocusItems } = require("../domain/focus");
const { savedReportContext } = require("../domain/report-context");
const { saveProgress, stored, idOf, validScore } = require("../services/progress-report");

class ProgressEditor extends Modal {
    constructor(plugin, { date = localISODate(), scope = null, closeButton = null, FocusEditor } = {}) {
        super(plugin.app); Object.assign(this, { plugin, date, reportScope: scope, closeButton, FocusEditor });
        this.wizard = plugin.projectWizard; this.rows = new Map(); this.returnFocus = document.activeElement;
        this.represented = plugin.reportEligibility.cutoff(date, plugin.reportEligibility.pending(date, { currentSession: !!closeButton }));
    }
    workspaces() { return [...this.wizard.getProjectRecords(), ...this.wizard.getResourceTypes()]; }
    onOpen() {
        ownModalColors(this); this.component = new Component(); this.component.load();
        this.modalEl.classList.add("hub-progress-editor", "hub-project-advancement-modal");
        this.modalEl.tabIndex = -1;
        this.contentEl.classList.add("hub-button-scope");
        createWindowTitle(this.contentEl, "Progress Report", "clipboard-pen", { date: { value: this.date, label: this.date } });
        this.contentEl.createEl("p", { cls: "hub-oath-muted", text: "Evaluate the whole day so far. Recorded work supports your judgment." });
        this.body = this.contentEl.createDiv(); this.dateNotice = this.body.createDiv({ cls: "hub-oath-muted" });
        this.cards = this.body.createDiv();
        const reports = this.wizard.getProgressReports({ kind: "all" }).filter(r => r.date === this.date);
        const current = this.plugin.workspaceModes?.currentContext?.();
        const all = this.workspaces(), suggested = new Set(Object.keys(this.represented));
        if (!this.closeButton) {
            for (const report of reports) suggested.add(report.projectId);
            for (const w of all) {
                const c = savedReportContext(this.wizard, this.date, idOf(w), stored(this.wizard.data, this.date, idOf(w)).log?.context);
                if (c.tasks.length || c.activity.length || c.oaths?.length) suggested.add(idOf(w));
            }
        }
        if (!this.closeButton && this.date === localISODate() && current) suggested.add(idOf(current));
        const target = typeof this.reportScope === "string" ? this.reportScope : this.reportScope?.id ? (this.reportScope.kind === "resource" ? "resource:" + this.reportScope.id : this.reportScope.id) : null;
        if (target) suggested.add(target);
        const ordered = [...suggested].sort((a,b) => {
            const preferred = target ?? (!this.closeButton ? idOf(current) : null);
            return Number(b === preferred) - Number(a === preferred) || (this.plugin.reportEligibility.state[this.date]?.[b]?.lastObservedAt || 0) - (this.plugin.reportEligibility.state[this.date]?.[a]?.lastObservedAt || 0);
        });
        for (const id of ordered) {
            if (target && id !== target) continue;
            const w = all.find(w => idOf(w) === id) ?? reports.find(r => r.projectId === id);
            if (w) this.addRow(w, this.rows.size === 0);
        }
        this.button(this.body, "Add workspace", () => this.openPicker());
        if (this.plugin.globalPlan) {
            const details = this.body.createEl("details", {cls:"hub-progress-focus"});
            details.createEl("summary", {text:"Current plan - optional"});
            details.createEl("p", {cls:"hub-oath-muted",text:"Live planning state. Changes are saved independently of this report."});
            const preview = details.createDiv({cls:"hub-plan-report-preview"});
            let planComponent;
            const renderPlan=()=>{planComponent?.unload();planComponent=new (require('obsidian').Component)();planComponent.load();preview.empty();const p=this.plugin.globalPlan.selected(this.date);if(!p){preview.createDiv({text:'No plan for this date',cls:'hub-oath-muted'});return;}require('./plan-presentation').mountPlanPresentation({root:preview,component:planComponent,plan:this.plugin.globalPlan.bind(p.id),context:'report'});const b=preview.createEl('button',{text:p.status==='active'?'Edit plan':'View plan'});b.onclick=()=>require('./plan').openPlan(this.plugin,p.id);for(const earlier of this.plugin.globalPlan.listHistorical(this.date).filter(x=>x.id!==p.id)){const other=preview.createEl('button',{text:'Earlier plan - '+earlier.endedAt});other.onclick=()=>require('./plan').openPlan(this.plugin,earlier.id);}};
            this.plugin.globalPlan.subscribe(this.component,renderPlan);this.component.register(()=>planComponent?.unload());renderPlan();
        }
        this.error = this.body.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
        this.conflicts = this.body.createDiv();
        this.footer = this.contentEl.createDiv({ cls: "hub-project-advancement-actions" });
        this.button(this.footer, this.closeButton ? "Keep working" : "Cancel", () => this.close());
        if (this.closeButton) this.button(this.footer, "Close without reporting", () => {
            this.plugin.reportEligibility.dismiss(this.date, this.represented);
            this.close(); this.plugin.finishWindowClose(this.closeButton);
        });
        this.saveButton = this.button(this.footer, this.closeButton ? "Save and close" : "Save progress", () => this.save());
        layoutModal(this, { body: this.body, footer: this.footer, bodyClass: "hub-report-scroll" });
        const refresh = () => { for (const row of this.rows.values()) this.evidence(row); };
        document.addEventListener("hub-task-progress-evidence-changed", refresh);
        this.component.register(() => document.removeEventListener("hub-task-progress-evidence-changed", refresh));
        const timer = setInterval(() => { this.update(); refresh(); }, 1000); this.component.register(() => clearInterval(timer));
        this.update();
    }
    button(parent, text, action) {
        const b = parent.createEl("button", { text, attr: { type: "button" } });
        b.addEventListener("click", action); return b;
    }
    addRow(workspace, expanded = true) {
        const id = idOf(workspace) ?? workspace.projectId;
        if (this.rows.has(id)) { this.rows.get(id).card.open = true; return; }
        const initial = stored(this.wizard.data, this.date, id);
        const card = this.cards.createEl("details", { cls: "hub-progress-card" }); card.open = expanded;
        const heading = card.createEl("summary");
        renderReportWorkspaceHeader(heading, { ...workspace, projectId: id, projectName: workspace.name ?? workspace.label ?? workspace.projectName }, this.plugin);
        const status = heading.createSpan({ cls: "hub-oath-muted" });
        const row = { id, card, initial, rating: initial.rating, reviewed: false, status };
        this.rows.set(id, row);
        const ratings = card.createDiv({ cls: "hub-progress-ratings", attr: { role: "group", "aria-label": "Rating for " + (workspace.name ?? workspace.label ?? workspace.projectName) } });
        row.buttons = [];
        for (const option of progressRatingOptions(workspace)) {
            const b = this.button(ratings, String(option.score), () => { row.rating = option.score; row.reviewed = true; this.update(); });
            b.classList.add("hub-project-advancement-score"); b.dataset.score = String(option.score);
            setHubTooltip(b, option.title + " " + option.description, "top"); row.buttons.push(b);
        }
        this.button(ratings, "Clear rating", () => { row.rating = null; row.reviewed = true; this.update(); });
        const label = card.createEl("label", { cls: "hub-progress-reflection", text: "Reflection — optional" });
        row.input = label.createEl("textarea", { attr: { rows: "2", maxlength: "1000", "aria-label": "Reflection for " + (workspace.name ?? workspace.label ?? workspace.projectName) } });
        row.input.value = initial.log?.summary ?? "";
        row.input.addEventListener("input", () => this.update());
        const helpId = `hub-progress-no-work-${this.rows.size}`;
        row.noWorkHelp = card.createEl("p", { cls: "hub-progress-no-work-help", text: "No work selected. Your reflection is preserved. Choose 1–4 to edit it.", attr: { id: helpId } });
        row.input.setAttribute("aria-describedby", helpId);
        row.evidence = card.createDiv(); this.evidence(row); this.update();
    }
    evidence(row) {
        const context = savedReportContext(this.wizard, this.date, row.id, row.initial.log?.context);
        const signature = JSON.stringify(context);
        if (row.evidenceSignature === signature) return;
        row.evidenceSignature = signature;
        const expanded = row.evidence.querySelector("details")?.open;
        row.evidenceComponent?.unload(); row.evidenceComponent = new Component(); row.evidenceComponent.load();
        row.evidence.empty();
        renderReportEvidence(row.evidence, context,
            createHubMarkdown({ app: this.app, component: row.evidenceComponent }), row.evidenceComponent);
        if (expanded) row.evidence.querySelector("details").open = true;
    }
    changed(row) { return row.reviewed || row.input.value.trim() !== (row.initial.log?.summary ?? ""); }
    focusValue() { return this.focus?.getValue(); }
    update() {
        if (!this.saveButton) return;
        this.dateNotice.textContent = this.date !== localISODate() ? `Editing ${this.date}; today is ${localISODate()}. Next Focus edits apply to this report's archive only.` : "";
        let focusChanged = false;
        if (this.focusTouched) { try { focusChanged = JSON.stringify(this.focusValue()) !== this.initialFocus; } catch (_) { focusChanged = true; } }
        this.saveButton.disabled = !!this.saving || (![...this.rows.values()].some(r => this.changed(r)) && !focusChanged);
        for (const row of this.rows.values()) {
            row.status.textContent = validScore(row.rating) ? `${row.rating}/4` : "Not rated";
            row.input.disabled = !!this.saving || row.rating === 0;
            row.noWorkHelp.hidden = row.rating !== 0;
            for (const b of row.buttons) { const selected = Number(b.dataset.score) === row.rating; b.classList.toggle("is-selected", selected); b.setAttribute("aria-pressed", String(selected)); }
        }
    }
    openPicker() {
        if (this.picker) return;
        const editor = this;
        class Picker extends Modal {
            onOpen() {
                ownModalColors(this); this.modalEl.classList.add("hub-oath-dialog");
                createWindowTitle(this.contentEl, "Add workspace", "clipboard-pen");
                const search = this.contentEl.createEl("input", { type: "search", attr: { "aria-label": "Search Projects and Resources", placeholder: "Search Projects and Resources" } });
                const list = this.contentEl.createDiv();
                const render = () => {
                    list.empty();
                    for (const kind of ["project", "resource"]) {
                        list.createEl("h3", { text: kind === "project" ? "Projects" : "Resources" });
                        for (const w of editor.workspaces().filter(w => (w.contextKind === "resource" ? "resource" : "project") === kind && (w.name ?? w.label).toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()))) {
                            editor.button(list, (w.name ?? w.label) + (w.status ? ` · ${w.status}` : ""), () => {
                                const current = editor.workspaces().find(item => idOf(item) === idOf(w));
                                if (!current) return render(); editor.addRow(current); this.close();
                            });
                        }
                    }
                };
                search.addEventListener("input", render); editor.button(this.contentEl, "Cancel", () => this.close()); render(); search.focus();
            }
            onClose() { editor.picker = null; editor.modalEl.focus(); }
        }
        this.picker = new Picker(this.app); this.picker.open();
    }
    async save() {
        if (this.saving || this.saveButton.disabled) return;
        const entries = [...this.rows.values()].filter(r => this.changed(r)).map(r => ({ id: r.id, expected: r.initial, rating: r.rating, summary: r.input.value.trim() }));
        const cutoffs = this.plugin.reportEligibility.cutoff(this.date, entries.map(e => e.id));
        let focus;
        try { if (this.focusTouched && JSON.stringify(this.focusValue()) !== this.initialFocus) focus = this.focusValue(); }
        catch (error) { this.error.textContent = error.message; return; }
        this.saving = true; const unlock = lockModalControls(this); this.error.textContent = "";
        try {
            await saveProgress(this.wizard, { date: this.date, entries, cutoffs, dismiss: this.closeButton ? this.represented : {}, focus });
            this.plugin.notifyProgressChanged(this.date, entries.map(e => e.id));
            this.saving = false; unlock(); this.close();
            if (this.closeButton) this.plugin.finishWindowClose(this.closeButton);
        } catch (error) {
            this.error.textContent = error.message || "Could not save progress. Your draft is retained.";
            if (error.code === "REPORT_CONFLICT") {
                const row = this.rows.get(error.workspaceId); this.conflicts.empty();
                this.conflicts.createEl("p", { text: `Latest saved rating: ${error.latest.rating ?? "Unrated"}. Reflection: ${error.latest.log?.summary ?? ""}` });
                this.button(this.conflicts, "Load latest", () => { row.initial = error.latest; row.rating = error.latest.rating; row.input.value = error.latest.log?.summary ?? ""; row.reviewed = false; this.conflicts.empty(); this.update(); });
                this.button(this.conflicts, "Use my draft", () => { row.initial = error.latest; this.conflicts.empty(); this.error.textContent = "Review your draft and save again."; this.update(); });
            }
            this.saving = false; unlock(); this.update();
        }
    }
    close() { if (!this.saving) super.close(); }
    onClose() {
        // Release ownership even if cleanup of a partially initialized view fails.
        if (this.plugin.progressEditor === this) this.plugin.progressEditor = null;
        this.plugin.hubAdvancementPromptOpen = false;
        this.picker?.close(); this.focus?.destroy(); this.component?.unload();
        for (const row of this.rows.values()) row.evidenceComponent?.unload();
        this.contentEl.empty(); this.returnFocus?.focus?.();
    }
}
function activeProgress(plugin) {
    const modal = plugin.progressEditor;
    if (!modal) return null;
    if (modal.isOpen && modal.containerEl.isConnected && modal.modalEl.getClientRects().length) return modal;
    try { modal.close(); }
    catch (error) { console.error("Could not clean up stale Progress Report", error); }
    finally {
        modal.containerEl.remove();
        plugin.progressEditor = null;
        plugin.hubAdvancementPromptOpen = false;
    }
    return null;
}
function openProgress(plugin, options) {
    const active = activeProgress(plugin);
    if (active) { active.modalEl.focus(); return active; }
    if (document.querySelector(".modal-container")) { document.querySelector(".modal-container input, .modal-container button")?.focus(); return; }
    let modal;
    try {
        modal = new ProgressEditor(plugin, options);
        plugin.progressEditor = modal;
        modal.open();
        return modal;
    } catch (error) {
        try { modal?.close(); }
        catch (cleanupError) { console.error("Could not clean up failed Progress Report", cleanupError); }
        finally {
            modal?.containerEl.remove();
            plugin.progressEditor = null;
            plugin.hubAdvancementPromptOpen = false;
        }
        console.error("Could not open Progress Report", error);
        new Notice("Could not open Progress Report. Please try again; Itacan can still be closed.");
    }
}
function mountProgressControl(plugin, host, FocusEditor) {
    const button = host.createEl("button", { cls: "hub-oath-button hub-log-progress-button", attr: { type: "button", "aria-label": "Log progress", "aria-haspopup": "dialog" } });
    setIcon(button.createSpan({ cls: "hub-oath-icon", attr: { "aria-hidden": "true" } }), "clipboard-pen"); button.createSpan({ text: "Log progress" }); setHubTooltip(button, "Log progress", "top");
    const open = () => openProgress(plugin, { FocusEditor }); button.addEventListener("click", open);
    plugin.addCommand({ id: "log-progress", name: "Log progress", callback: open });
    const measure = () => {
        host.classList.remove("hub-shell-icons-only");
        const available = host.parentElement.clientWidth - 24 - [...host.parentElement.children].filter(e => e !== host && !e.classList.contains("hub-shell-shortcuts")).reduce((n,e) => n + e.getBoundingClientRect().width, 0);
        host.classList.toggle("hub-shell-icons-only", host.scrollWidth > available);
    };
    const resize = new ResizeObserver(measure); resize.observe(host.parentElement);
    const mutation = new MutationObserver(measure); mutation.observe(host, { childList: true });
    plugin.register(() => { resize.disconnect(); mutation.disconnect(); plugin.progressEditor?.close(); button.remove(); }); measure();
}
module.exports = { openProgress, activeProgress, mountProgressControl, ProgressEditor };
