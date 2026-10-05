"use strict";
const { Notice, Menu, getIcon } = require("obsidian");
const { CaptureModal, CaptureConfirmation, action, attachments } = require("./capture-modal");
const { setHubIcon } = require("./icons");
const { disclosureIcons } = require("./disclosure");
const { bindMenuToggle } = require("./menu-toggle");
const { mountCaptureForm, mountCaptureTypeControl, noteTitle } = require("./capture-form");
const { mountInboxGuidance } = require("./inbox-guidance");
const { linkFromText, captureDraft, sortedCaptures, INBOX_SORTS, inboxCounts } = require("../domain/inbox");
const { mountTaskText } = require("./task-form");

const SORT_ICONS = {
    "most-complete": ["arrow-down-wide-narrow", "arrow-down-1-0"],
    "least-complete": ["arrow-up-wide-narrow", "arrow-up-0-1"],
    newest: ["calendar-arrow-down", "arrow-down-1-0"],
    oldest: ["calendar-arrow-up", "arrow-up-0-1"],
    type: ["shapes", "tags"]
};
function sortIcon(sort) {
    const [preferred, fallback] = SORT_ICONS[sort];
    return getIcon("lucide-" + preferred) || getIcon(preferred) ? preferred : fallback;
}

function timestamp(value) { return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
function preview(capture) { return String(capture.text ?? "").trim() || capture.attachments.map(ref => ref.name).join(", ") || "Untitled item"; }
function detailTitle(capture) {
    const line = preview(capture).split(/\r?\n/)[0];
    return line.length > 160 ? line.slice(0, 157) + "…" : line;
}
function contentIcon(capture) {
    const type = (capture.operation?.state !== "done" ? capture.operation?.kind : null) ?? capture.intent?.type;
    if (type === "task") return "square";
    if (type === "note" || type === "note-insertion") return "notebook-text";
    return capture.attachments.length ? capture.attachments[0].mime?.startsWith("image/") ? "image" : "file" : "file-question-mark";
}

function hasTypeSpecificDetails(draft) {
    if (draft.type === "task") return ["location", "necessity", "fromDate", "dueDate", "fromTime", "dueTime", "phaseId", "linkedProjectId"]
        .some(key => !!draft[key]) || draft.steps?.some(step => String(step.text ?? "").trim() || step.completed);
    return draft.type === "note" && (!!draft.folder || !!draft.noteLocation || draft.noteAction === "existing" ||
        !!String(draft.title ?? "").trim() && draft.title !== noteTitle(draft));
}

class InboxModal extends CaptureModal {
    onOpen() {
        this.modalEl.classList.add("hub-inbox-dialog");
        this.header("Inbox", "Saved items awaiting organisation");
        this.filter = "all"; this.sortOrder = this.service.sortPreference; this.selectedId = null;
        this.rows = new Map(); this.checkingPositions = new Set();
        const body = this.contentEl.createDiv({ cls: "hub-inbox-body" });
        const aside = body.createEl("aside", { cls: "hub-inbox-sidebar", attr: { "aria-label": "Inbox items" } });
        const toolbar = aside.createDiv({ cls: "hub-inbox-toolbar" });
        this.filters = toolbar.createDiv({ cls: "hub-inbox-filters hub-equal-selectors hub-option-group", attr: { role: "group", "aria-label": "Filter items" } });
        this.filterButtons = [["all", "All"], ["text", "Texts"], ["files", "Files"]].map(([key, label]) => {
            const button = action(this.filters, label, null, () => { void this.changeFilter(key); });
            return { key, label, button };
        });
        const sort = toolbar.createDiv({ cls: "hub-inbox-sort" });
        this.sort = action(sort, "", sortIcon(this.sortOrder), () => this.showSortMenu(), "hub-panel-action hub-inbox-sort-button");
        this.sortIcon = this.sort.querySelector(".hub-capture-icon");
        this.stopSortToggle = bindMenuToggle(this.sort, { isOpen: () => !!this.sortMenu, close: () => this.sortMenu?.hide() });
        const sortLabels = this.sort.querySelector("span:not(.hub-capture-icon)"); sortLabels.classList.add("hub-inbox-sort-label");
        this.sortLabel = sortLabels.createSpan({ text: "Most complete" });
        // Intrinsic measuring labels reserve the longest option in the current
        // theme/font, with no guessed character count or selection-dependent width.
        for (const [, label] of INBOX_SORTS) sortLabels.createSpan({ text: label, cls: "hub-inbox-sort-measure", attr: { "aria-hidden": "true" } });
        for (const [key, value] of Object.entries({ "aria-label": "Sort items", "aria-haspopup": "menu", "aria-expanded": "false" })) this.sort.setAttribute(key, value);
        disclosureIcons(this.sort);
        this.sort.addEventListener("keydown", event => {
            if (event.key === "ArrowDown") { event.preventDefault(); this.showSortMenu(); }
        });
        this.list = aside.createDiv({ cls: "hub-inbox-list", attr: { role: "group", "aria-label": "Inbox items" } });
        this.list.addEventListener("keydown", event => {
            const rows = [...this.list.querySelectorAll("button[data-capture-id]")];
            const index = rows.indexOf(event.target);
            if (index < 0) return;
            const next = event.key === "ArrowDown" ? Math.min(rows.length - 1, index + 1) : event.key === "ArrowUp" ? Math.max(0, index - 1) : event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : null;
            if (next === null) return;
            event.preventDefault(); rows[next].click();
            this.list.querySelector(`[data-capture-id="${rows[next].dataset.captureId}"]`)?.focus();
        });
        this.detail = body.createEl("section", { cls: "hub-inbox-detail", attr: { "aria-label": "Item details", tabindex: "-1" } });
        this.detail.addEventListener("focusout", () => queueMicrotask(() => {
            if (this.reorderPending && !this.editingText()) this.refresh();
        }));
        this.deleteKey = event => {
            if (event.key !== "Delete" || event.defaultPrevented || event.repeat || event.isComposing ||
                event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || this.busy || this.confirmation || this.sortMenu || this.itemMenu || !this.selectedId) return;
            const target = event.target;
            if (target.isContentEditable || target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],.cm-editor,.menu')) return;
            event.preventDefault(); event.stopPropagation(); void this.remove(this.selectedId);
        };
        this.modalEl.addEventListener("keydown", this.deleteKey);
        this.submitKey = event => {
            if (event.key !== "Enter" || event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
                this.busy || this.confirmation || this.sortMenu || this.itemMenu || !this.draft) return;
            const target = event.target;
            if (!this.detail.contains(target) || target.isContentEditable || target.closest('textarea,select,[contenteditable]:not([contenteditable="false"]),[role="combobox"],.menu')) return;
            // Buttons, pickers, date/time and Step editors keep their own Enter behavior.
            if (target !== this.taskInput && target.getAttribute("aria-label") !== "Note title" && target !== this.detail) return;
            event.preventDefault(); void this.commit();
        };
        this.modalEl.addEventListener("keydown", this.submitKey);
        const footer = this.contentEl.createDiv({ cls: "hub-capture-actions hub-inbox-footer" });
        action(footer, "Close", null, () => this.close());
        this.stop = this.service.onChange(() => this.refresh());
        this.refresh(); this.filterButtons[0].button.focus();
    }
    showSortMenu() {
        if (this.closed || this.busy || this.sort.disabled) return;
        this.itemMenu?.hide();
        if (this.sortMenu) { this.sortMenu.hide(); return; }
        const menu = this.sortMenu = new Menu();
        for (const [sort, label] of INBOX_SORTS) menu.addItem(item => item
            .setTitle(label).setIcon(sortIcon(sort)).setChecked(this.sortOrder === sort).onClick(() => { void this.changeSort(sort); }));
        menu.onHide(() => {
            if (this.sortMenu === menu) this.sortMenu = null;
            this.sort.setAttribute("aria-expanded", "false");
            const focused = this.sort.ownerDocument.activeElement;
            if (!this.closed && this.sort.isConnected && (focused === this.sort.ownerDocument.body || focused?.closest(".menu"))) this.sort.focus({ preventScroll: true });
        });
        this.sort.setAttribute("aria-expanded", "true");
        const rect = this.sort.getBoundingClientRect(); menu.showAtPosition({ x: rect.left, y: rect.bottom });
    }
    canChangeType(capture) {
        return !!capture && !capture.attachments.length && !capture.operation && [undefined, null, "task", "note"].includes(capture.intent?.type);
    }
    showItemMenu(id, position) {
        const capture = this.service.get(id);
        if (!capture || this.closed || this.busy || this.confirmation) return;
        const menu = new Menu();
        menu.addItem(item => item.setTitle("Open").setIcon("panel-right-open").onClick(() => {
            void this.openItem(id);
        }));
        menu.addItem(item => item.setTitle("Send to Itacan").setIcon("send")
            .setDisabled(!this.itemCompletion(capture).ready).onClick(async () => {
                if (await this.openItem(id) && this.itemCompletion(this.service.get(id)).ready) await this.commit();
            }));
        const type = this.selectedId === id ? this.mode : captureDraft(capture).type;
        if (this.canChangeType(capture)) menu.addItem(item => item.setTitle(["task", "note"].includes(type) ? "Change type" : "Choose type").setIcon("repeat-2")
            .onClick(() => this.showTypeMenu(id, position)));
        menu.addSeparator();
        menu.addItem(item => item.setTitle("Delete").setIcon("trash-2").setWarning(true)
            .onClick(() => { void this.remove(id); }));
        this.presentItemMenu(menu, id, position);
    }
    showTypeMenu(id, position) {
        const capture = this.service.get(id);
        if (!this.canChangeType(capture) || this.closed || this.busy || this.confirmation) return;
        const type = id === this.selectedId ? this.mode : capture.intent?.type;
        const menu = new Menu();
        for (const [value, label, icon] of [["task", "Task", "square"], ["note", "Note", "notebook-text"]])
            menu.addItem(item => item.setTitle(label).setIcon(icon).setChecked(type === value).onClick(async () => {
                if (await this.openItem(id) && this.canChangeType(this.service.get(id))) await this.classify(value);
            }));
        this.presentItemMenu(menu, id, position);
    }
    presentItemMenu(menu, id, position) {
        this.sortMenu?.hide(); this.itemMenu?.hide(); this.itemMenu = menu;
        menu.onHide(() => {
            if (this.itemMenu !== menu) return;
            this.itemMenu = null;
            const doc = this.modalEl.ownerDocument, focused = doc.activeElement;
            if (!this.closed && (focused === doc.body || focused?.closest(".menu"))) this.rows.get(id)?.button.focus({ preventScroll: true });
        });
        menu.showAtPosition(position);
    }
    async openItem(id) {
        if (this.closed || this.busy || this.confirmation || !this.service.get(id)) return false;
        await this.select(id);
        if (this.closed || this.selectedId !== id) return false;
        this.detail.focus({ preventScroll: true });
        return true;
    }
    async changeSort(sort) {
        if (this.closed || this.busy || !await this.flushEdits()) return;
        this.sortOrder = sort; this.refresh({ resetScroll: true });
        this.sortSave = this.service.setSortPreference(sort).catch(error => {
            new Notice(`The Inbox sort preference could not be saved. ${error.message}`);
        });
        await this.sortSave;
    }
    itemCompletion(capture) {
        const values = capture.id === this.selectedId && this.draft ? this.form?.value() ?? this.draft : undefined;
        return this.service.getInboxCompletion(capture, values);
    }
    visible() {
        return sortedCaptures(this.service.captures, { filter: this.filter, sort: this.sortOrder, completion: item => this.itemCompletion(item) });
    }
    editingText() {
        const focused = this.detail?.ownerDocument.activeElement;
        return this.detail?.contains(focused) && focused.matches('textarea,input:not([type="checkbox"]),[contenteditable="true"]');
    }
    loadNotePositions(captures) {
        for (const capture of captures) {
            const draft = captureDraft(capture), location = draft.noteLocation;
            if (draft.type !== "note" || draft.noteAction !== "existing" || !location || location.targetType === "note" ||
                this.service.noteCache.has(location.path) || this.checkingPositions.has(location.path)) continue;
            this.checkingPositions.add(location.path);
            // Reuse the picker/form's structural validation cache after reopening
            // Inbox, including notes that have not been selected in the list.
            this.service.readNotePositions(draft.workspaceId, location.path).then(() => this.refresh()).catch(() => {})
                .finally(() => this.checkingPositions.delete(location.path));
        }
    }
    async changeFilter(key) {
        if (this.busy || !await this.flushEdits()) return;
        this.filter = key; this.refresh({ resetScroll: true });
    }
    refresh({ resetScroll = false } = {}) {
        if (this.closed) return;
        if (this.busy) { this.needsRefresh = true; return; }
        this.needsRefresh = false;
        let rows = this.visible();
        const previous = this.list.ownerDocument.activeElement?.dataset?.captureId, scrollTop = this.list.scrollTop;
        const anchor = [...this.list.children].find(row => row.dataset.captureId && row.getBoundingClientRect().bottom > this.list.getBoundingClientRect().top);
        const anchorTop = anchor?.getBoundingClientRect().top;
        this.sortLabel.textContent = INBOX_SORTS.find(([key]) => key === this.sortOrder)[1];
        this.sort.dataset.value = this.sortOrder;
        const activeIcon = sortIcon(this.sortOrder);
        if (this.sortIconName !== activeIcon) { setHubIcon(this.sortIcon, activeIcon); this.sortIconName = activeIcon; }
        const counts = inboxCounts(this.service.captures);
        this.filterButtons.forEach(({ key, label, button }) => {
            button.querySelector("span").textContent = `${label} (${counts[key]})`;
            button.classList.toggle("is-selected", key === this.filter); button.setAttribute("aria-pressed", String(key === this.filter));
        });
        const currentOrder = [...this.list.children].map(row => row.dataset.captureId).filter(Boolean);
        this.reorderPending = !resetScroll && ["most-complete", "least-complete"].includes(this.sortOrder) && this.editingText() &&
            currentOrder.join("|") !== rows.map(item => item.id).join("|");
        if (this.reorderPending) {
            const remaining = new Map(rows.map(item => [item.id, item]));
            rows = currentOrder.filter(id => remaining.has(id)).map(id => { const item = remaining.get(id); remaining.delete(id); return item; }).concat([...remaining.values()]);
        }
        if (!rows.some(capture => capture.id === this.selectedId)) {
            this.resetAction(); this.selectedId = rows[0]?.id ?? null;
        }
        const visibleIds = new Set(rows.map(item => item.id));
        for (const [id, row] of this.rows) if (!visibleIds.has(id)) { row.button.remove(); this.rows.delete(id); }
        this.list.querySelector(".hub-capture-empty")?.remove();
        if (!rows.length) this.list.createDiv({ cls: "hub-capture-empty", text: this.service.count ? "No items match this filter." : "Your Inbox is empty. Use Quick Add to save something for later." });
        rows.forEach((capture, index) => {
            const row = this.updateRow(capture);
            const at = this.list.children[index];
            if (at !== row.button) this.list.insertBefore(row.button, at ?? null);
        });
        if (resetScroll) this.list.scrollTop = 0;
        else if (anchor?.isConnected) this.list.scrollTop = scrollTop + anchor.getBoundingClientRect().top - anchorTop;
        else this.list.scrollTop = scrollTop;
        this.loadNotePositions(this.service.captures);
        if (!this.mode) this.renderDetail();
        this.syncSubmit();
        this.guidance?.update();
        if (previous) (this.rows.get(previous)?.button ?? this.rows.get(this.selectedId)?.button)?.focus({ preventScroll: true });
    }
    updateRow(capture) {
        let row = this.rows.get(capture.id);
        if (!row) {
            const button = this.list.createEl("button", { cls: "hub-inbox-row", attr: { type: "button", "data-capture-id": capture.id,
                "aria-describedby": `${this.prefix}-completion-${capture.id}` } });
            const icon = button.createSpan({ cls: "hub-capture-icon", attr: { "aria-hidden": "true" } });
            const copy = button.createDiv({ cls: "hub-inbox-row-copy" }), heading = copy.createDiv({ cls: "hub-inbox-row-heading" });
            const title = heading.createDiv({ cls: "hub-inbox-row-title" });
            const status = heading.createSpan({ cls: "hub-inbox-completion-label", attr: { "aria-hidden": "true" } });
            const metadata = copy.createDiv({ cls: "hub-capture-muted" });
            const progress = copy.createEl("progress", { cls: "hub-inbox-completion-progress", attr: { id: `${this.prefix}-completion-${capture.id}` } });
            row = { button, icon, title, status, metadata, progress }; this.rows.set(capture.id, row);
            button.addEventListener("click", () => { void this.select(capture.id); });
            button.addEventListener("contextmenu", event => {
                event.preventDefault(); event.stopPropagation();
                this.showItemMenu(capture.id, { x: event.clientX, y: event.clientY });
            });
            button.addEventListener("keydown", event => {
                if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
                event.preventDefault(); event.stopPropagation();
                const bounds = button.getBoundingClientRect();
                this.showItemMenu(capture.id, { x: bounds.left + 12, y: bounds.top + 12 });
            });
        }
        row.button.classList.toggle("is-selected", capture.id === this.selectedId);
        row.button.setAttribute("aria-pressed", String(capture.id === this.selectedId));
        const icon = contentIcon(capture);
        if (row.iconName !== icon) { setHubIcon(row.icon, icon); row.iconName = icon; }
        row.icon.classList.toggle("hub-inbox-unsorted-icon", icon === "file-question-mark");
        const draft = capture.id === this.selectedId ? this.draft : null;
        row.title.textContent = preview(draft ? { ...capture, text: draft.text } : capture); row.title.title = row.title.textContent;
        row.metadata.textContent = timestamp(capture.createdAt);
        const completion = this.itemCompletion(capture), { ready, totalRequired, completedRequired } = completion;
        row.status.empty();
        if (ready) setHubIcon(row.status.createSpan({ cls: "hub-capture-icon" }), "check");
        const remaining = totalRequired - completedRequired;
        const status = ready ? "Ready" : totalRequired ? `${remaining} ${remaining === 1 ? "detail" : "details"} left` : "Choose type";
        row.status.createSpan({ text: status });
        const description = ready ? "All required details complete" : !totalRequired ? "Type not selected" :
            `${status}${completion.missing.length ? ". Missing: " + completion.missing.join(", ") : completion.error ? ". " + completion.error : ""}`;
        row.progress.max = totalRequired || 1; row.progress.value = completedRequired;
        row.progress.setAttribute("aria-label", description); row.progress.setAttribute("aria-valuetext", description);
        row.progress.textContent = description;
        return row;
    }
    async select(id) {
        if (this.busy || id === this.selectedId || !await this.flushEdits()) return;
        this.selectedId = id; this.resetAction();
        this.error.textContent = ""; this.refresh();
    }
    renderDetail() {
        this.resetAction(); this.detail.empty(); this.detail.classList.remove("is-action-form");
        const capture = this.service.get(this.selectedId);
        if (!capture) { this.detail.createDiv({ cls: "hub-capture-empty", text: "Select an item to review it." }); return; }
        const pendingKind = capture.operation?.state !== "done" ? capture.operation?.kind : null;
        const type = (pendingKind === "files" ? "file" : pendingKind === "note-insertion" ? "note" : pendingKind) ?? capture.intent?.type ??
            (!capture.text.trim() && capture.attachments.length ? "file" : null);
        if (type && (capture.operation?.state !== "done" || type !== "task")) { this.edit(type); return; }
        if (!capture.attachments.length && (!capture.operation || capture.operation.state === "done")) { this.renderUnsorted(capture); return; }
        this.detail.classList.add("is-action-form");
        const body = this.detail.createDiv({ cls: "hub-inbox-action-body" });
        const title = detailTitle(capture);
        body.createEl("h3", { cls: "hub-inbox-detail-title", text: title });
        body.createDiv({ cls: "hub-capture-muted", text: `${timestamp(capture.createdAt)} · ${capture.kind === "link" ? "Link" : capture.attachments.length ? "Files" : "Text"}` });
        const view = body.createDiv({ cls: "hub-inbox-preview" });
        if (capture.text && capture.text.trim() !== title) view.createDiv({ cls: "hub-inbox-text", text: capture.text });
        if (capture.source) {
            const source = view.createDiv({ cls: "hub-capture-source hub-capture-muted" });
            source.createDiv({ text: [capture.source.origin, capture.source.workspaceName, capture.source.title].filter(Boolean).join(" · ") });
            if (capture.source.url) source.createDiv({ text: capture.source.url });
            if (capture.source.path) source.createDiv({ text: capture.source.path });
        }
        const refs = view.createDiv({ cls: "hub-capture-attachments" });
        const url = this.service.captureUrl?.(capture) ?? linkFromText(capture.text) ?? capture.source?.url;
        const openAttachment = ref => { void this.run(async () => { if (await this.service.openAttachment(ref) !== false) this.finish(); }); };
        // One file is the Capture's Open action; multiple files keep individual
        // row actions, as do files accompanying a separately openable URL.
        attachments(refs, capture.attachments, this.service, { open: url || capture.attachments.length > 1 ? openAttachment : undefined });
        if (capture.operation) view.createEl("p", { cls: "hub-capture-muted", text: capture.operation.state === "done" ? "A task has been created. The remaining content and files are kept here." : "A previous save is pending. Retry the same action to finish safely." });
        const section = this.detail.createEl("section", { cls: "hub-inbox-actions-section hub-inbox-action-footer", attr: { "aria-labelledby": this.prefix + "-actions" } });
        section.createEl("h3", { cls: "hub-inbox-actions-heading", text: "Actions", attr: { id: this.prefix + "-actions" } });
        const actions = section.createDiv({ cls: "hub-inbox-detail-actions", attr: { role: "group", "aria-labelledby": this.prefix + "-actions" } });
        const pending = capture.operation && capture.operation.state !== "done";
        if (pending) {
            action(actions, "Retry save", null, () => { void this.run(async () => {
                const values = { ...capture, workspaceId: capture.operation.workspaceId, folder: capture.operation.folder };
                const result = capture.operation.kind === "task" ? await this.service.makeTask(values, capture.id) :
                    capture.operation.kind === "note" ? await this.service.createNote(values, capture.id) : await this.service.addFiles(values, capture.id);
                new Notice(result?.message ?? "Item saved."); this.refresh();
            }); });
            // A prepared file/note save may have rolled back before its folder
            // disappeared. Reopen its original action to choose a valid folder.
            if (capture.operation.state === "prepared") {
                if (capture.operation.kind === "note") action(actions, "Make note", "notebook-text", () => this.edit("note"));
                if (capture.operation.kind === "files") action(actions, "Move to…", "folder", () => this.edit("file"));
            }
        }
        else {
            if (capture.text && capture.operation?.state !== "done") action(actions, "Make task", "square", () => this.edit("task"));
            action(actions, "Make note", "notebook-text", () => this.edit("note"));
            if (capture.attachments.length) action(actions, "Move to…", "folder", () => this.edit("file"));
        }
        if (url) action(actions, "Open", "external-link", () => { void this.run(async () => { await this.options.openLink?.(url); this.finish(); }); });
        else if (capture.attachments.length === 1 && this.service.attachmentExists(capture.attachments[0]))
            action(actions, "Open", "external-link", () => openAttachment(capture.attachments[0]));
        this.deleteButton = action(actions, "Delete", "trash-2", () => { void this.remove(capture.id); }, "hub-capture-delete");
    }
    renderUnsorted(capture) {
        this.mode = "unsorted"; this.draft = captureDraft(capture);
        this.detail.classList.add("is-action-form");
        this.detail.createEl("h3", { text: "Text", cls: "hub-inbox-detail-title hub-inbox-action-heading" });
        const body = this.detail.createDiv({ cls: "hub-inbox-action-body" });
        const content = body.createDiv({ cls: "hub-field-group", attr: { "data-capture-field": "Content" } });
        const input = content.createEl("textarea", { cls: "hub-quick-add-input", attr: { rows: "3", "aria-label": "Text" } });
        input.value = this.draft.text;
        input.addEventListener("input", () => { this.draft.text = input.value; this.sync(); this.persistDraft(this.draft); });
        mountCaptureTypeControl({ host: body, disabledTypes: capture.operation?.state === "done" ? ["task"] : [], onSelect: type => { void this.classify(type); } });
        this.guidance = mountInboxGuidance({ body, completion: () => this.service.getInboxCompletion(capture, this.draft) });
        this.guidance.update();
        const footer = this.detail.createDiv({ cls: "hub-capture-actions hub-inbox-action-footer hub-inbox-unsorted-footer" });
        action(footer, "Delete", "trash-2", () => { void this.remove(capture.id); }, "hub-capture-delete");
    }
    async classify(type) {
        if (!["task", "note"].includes(type) || this.busy || this.confirmation || !await this.flushEdits()) return;
        const capture = this.service.get(this.selectedId); if (!capture) return;
        if (capture.attachments.length || this.mode === type || this.mode !== "unsorted" && capture.operation) return;
        if (type === "task" && capture.operation?.state === "done") return;
        const draft = this.form?.value() ?? this.draft;
        if (draft && hasTypeSpecificDetails(draft)) {
            const target = type === "task" ? "Task" : "Note", previous = draft.type === "task" ? "task" : "note";
            if (!await this.confirm({ title: `Switch to ${target}?`,
                message: `Changing this item to a ${target} will clear its ${previous} details. The text and Save to destination will be kept.`,
                confirmLabel: "Continue" }) || this.closed || this.selectedId !== capture.id) return;
        }
        const saved = await this.run(() => this.service.updateCapture(capture.id, { type, intent: { type, inputPath: "text" } }));
        if (saved && !this.closed) { this.resetAction(); this.refresh(); }
    }
    persistDraft(values) {
        // Snapshot the existing form value only for the atomic write. The live
        // editor has one content value; saves never replace it while typing.
        this.pendingEdit = { id: this.selectedId, values: JSON.parse(JSON.stringify(values)) };
        return this.flushEdits();
    }
    flushEdits() {
        if (this.editSave) return this.editSave;
        if (!this.pendingEdit) return Promise.resolve(true);
        this.editSave = (async () => {
            while (this.pendingEdit) {
                const edit = this.pendingEdit; this.pendingEdit = null;
                if (!this.service.get(edit.id)) continue;
                try { await this.service.updateCapture(edit.id, edit.values); }
                catch (error) {
                    if (!this.service.get(edit.id)) continue;
                    this.pendingEdit ??= edit;
                    this.editError = error.message || "Could not save. Please try again.";
                    if (!this.closed) this.error.textContent = this.editError;
                    return false;
                }
            }
            if (!this.closed && this.editError && this.error.textContent === this.editError) this.error.textContent = "";
            this.editError = null;
            return true;
        })().finally(() => { this.editSave = null; });
        return this.editSave;
    }
    async confirm(options) {
        if (this.closed || this.busy || this.confirmation) return false;
        const modal = this.confirmation = new CaptureConfirmation(this.app, null, {
            ...options, returnFocus: this.modalEl.ownerDocument.activeElement
        });
        const confirmed = await modal.ask();
        if (this.confirmation === modal) this.confirmation = null;
        return confirmed;
    }
    async remove(id) {
        if (this.busy || this.closed || !this.service.get(id) || !await this.confirm({
            title: "Delete this inbox item?", message: "This item will be removed from your Inbox.", confirmLabel: "Delete", destructive: true
        }) || this.closed || !await this.flushEdits()) return;
        return this.run(async () => {
            await this.service.delete(id); new Notice("Item deleted."); this.resetAction(); this.refresh();
        });
    }
    edit(type) {
        const capture = this.service.get(this.selectedId); if (!capture || this.busy) return;
        if (!["task", "note", "file"].includes(type)) return;
        const operation = capture.operation?.state === "prepared" && capture.operation.kind === (type === "file" ? "files" : type) ? capture.operation : null;
        this.resetAction(); this.mode = type; this.error.textContent = ""; this.detail.empty();
        this.detail.classList.add("is-action-form");
        this.detail.createEl("h3", { text: type === "file" ? "File" : type === "task" ? "Task" : "Note", cls: "hub-inbox-detail-title hub-inbox-action-heading" });
        const body = this.detail.createDiv({ cls: "hub-inbox-action-body" });
        this.draft = { ...captureDraft(capture), type, attachments: [...capture.attachments],
            ...(capture.intent || (capture.operation?.state !== "done" && capture.operation?.workspaceId) ? {} :
                { workspaceId: this.options.workspaceId ?? "" }),
            ...(operation ? { workspaceId: operation.workspaceId, folder: operation.folder, title: operation.title } : {}) };
        // Legacy mixed captures retain their additional source content. New
        // captures have one canonical task text or note content editor.
        const legacyTask = type === "task" && !capture.intent && (capture.attachments.length || /[\r\n]/.test(capture.text.trim()));
        if (legacyTask) {
            this.draft.taskTitle = capture.operation?.kind === "task" ? capture.operation.text : capture.text.trim().split(/\r?\n/)[0];
            this.draft.text = capture.text;
        }
        let content;
        if (type === "note" || legacyTask || (capture.text && type === "file")) {
            const field = body.createDiv({ cls: "hub-field-group", attr: type === "note" ? { "data-capture-field": "Content" } : {} });
            if (type !== "note") field.createEl("label", { cls: "hub-capture-label", text: "Captured content", attr: { for: this.prefix + "-content" } });
            content = field.createEl("textarea", { cls: "hub-quick-add-input", attr: { id: this.prefix + "-content", rows: "3", "aria-label": type === "note" ? "Note content" : "Captured content" } }); content.value = capture.text;
            content.readOnly = !!capture.operation && capture.operation.state !== "done";
        }
        if (type === "task") {
            const taskState = legacyTask ? { ...this.draft, text: this.draft.taskTitle ?? capture.text.trim().split(/\r?\n/)[0] } : this.draft;
            const field = body.createDiv({ cls: "hub-field-group", attr: { "data-capture-field": "Content" } });
            this.taskInput = mountTaskText(field, taskState, patch => {
                this.form?.update(legacyTask ? { taskTitle: patch.text } : patch); this.sync();
            }, { placeholder: "What needs doing?", multiline: !legacyTask && /[\r\n]/.test(this.draft.text) });
            if (legacyTask) this.draft.taskTitle = taskState.text;
        }
        const refs = body.createDiv({ cls: "hub-capture-attachments" });
        if (type === "file") refs.dataset.captureField = "File";
        attachments(refs, capture.attachments, this.service, { open: type === "file" ? ref => {
            void this.run(async () => { if (await this.service.openAttachment(ref) !== false) this.finish(); });
        } : undefined });
        const host = body.createDiv({ cls: "hub-inbox-form-host" });
        this.form = mountCaptureForm({ host, service: this.service, draft: this.draft, fixedType: type,
            captureId: () => this.selectedId,
            onChange: value => { this.draft = value; this.sync(); if (!this.busy && !this.closed) this.persistDraft(value); } });
        content?.addEventListener("input", () => { this.form.update({ text: content.value }); this.sync(); });
        const actions = this.detail.createDiv({ cls: "hub-capture-actions hub-inbox-action-footer" });
        action(actions, "Delete", "trash-2", () => { void this.remove(capture.id); }, "hub-capture-delete");
        this.save = action(actions, "Add to Itacan", null, () => { void this.commit(); }, "mod-cta hub-guided-submit");
        this.readyArrow = this.save.createSpan({ cls: "hub-inbox-submit-arrow hub-capture-icon", attr: { "aria-hidden": "true" } });
        setHubIcon(this.readyArrow, "arrow-right");
        this.guidance = mountInboxGuidance({ body, readyArrow: this.readyArrow,
            completion: () => this.service.getInboxCompletion(this.service.get(this.selectedId), this.form.value()) });
        this.form.focus?.();
        this.sync();
        if (!capture.operation && (!legacyTask || capture.intent)) this.persistDraft(this.form.value());
    }
    resetAction() {
        this.guidance?.destroy(); this.guidance = null;
        this.form?.destroy(); this.form = null; this.mode = null; this.draft = null; this.save = null; this.readyArrow = null;
    }
    syncSubmit() {
        if (!this.save?.isConnected) return;
        const blocked = this.busy || !this.form?.valid();
        this.save.disabled = this.busy;
        this.save.setAttribute("aria-disabled", String(blocked));
        this.readyArrow.hidden = blocked;
    }
    sync() {
        if (this.needsRefresh && !this.busy) this.refresh();
        const selected = this.service.get(this.selectedId);
        if (selected && this.rows.has(selected.id)) this.updateRow(selected);
        if (["most-complete", "least-complete"].includes(this.sortOrder) && this.editingText()) this.reorderPending = true;
        this.syncSubmit();
        this.guidance?.update();
        const operation = this.service.get(this.selectedId)?.operation;
        if (this.form && operation && operation.state !== "done" && (operation.kind === "task" || operation.kind === "note-insertion" || operation.state === "ready")) {
            this.detail.querySelectorAll(".hub-inbox-action-body button,.hub-inbox-action-body input,.hub-inbox-action-body textarea,.hub-inbox-action-body select").forEach(control => control.disabled = true);
        }
    }
    async commit() {
        if (this.busy || this.closed) return;
        if (!this.form) { this.guidance?.guide(); return; }
        if (!this.form.valid()) {
            if (!this.guidance?.guide()) this.error.textContent = this.itemCompletion(this.service.get(this.selectedId)).error ?? "Check the item details.";
            return;
        }
        if (!await this.flushEdits()) return;
        return this.run(async () => {
            const draft = this.form.value(), id = this.selectedId;
            if (draft.type !== this.mode) throw Error("Choose the item action again.");
            const result = draft.type === "task" ? await this.service.makeTask(draft, id) : draft.type === "note" ?
                await this.service.createNote(draft, id) : await this.service.addFiles(draft, id);
            new Notice(result?.message ?? (draft.type === "file" ? "Files moved." : `Added ${draft.type}.`));
            this.mode = null; this.form?.destroy(); this.form = null; this.refresh();
            (this.list.querySelector(`[data-capture-id="${this.selectedId}"]`) ?? this.filterButtons[0].button).focus();
        });
    }
    onProblem(error) { if (error.noteLocationInvalid) this.form?.update({ noteLocation: null }); }
    async close() {
        if (this.closed || this.busy || !await this.flushEdits()) return;
        await this.sortSave;
        if (!this.closed) super.close();
    }
    onClose() {
        this.modalEl.removeEventListener("keydown", this.deleteKey);
        this.modalEl.removeEventListener("keydown", this.submitKey); this.stopSortToggle?.();
        this.confirmation?.close(); this.confirmation = null;
        this.guidance?.destroy(); this.guidance = null;
        this.sortMenu?.hide(); this.sortMenu = null;
        this.itemMenu?.hide(); this.itemMenu = null; super.onClose();
    }
}
module.exports = { InboxModal };
