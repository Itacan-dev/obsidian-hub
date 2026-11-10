"use strict";
const { randomUUID } = require("node:crypto");
const { attachmentReference, captureIntent, captureKind, sourceMetadata } = require("../domain/inbox");
const clone = value => JSON.parse(JSON.stringify(value));

// The draft is a private sibling of captures, never a visible Inbox entry.
module.exports = {
    newQuickDraft(source = {}) {
        return { version: 1, id: randomUUID(), revision: 0, createdAt: Date.now(), text: "", attachments: [], source: sourceMetadata(source), actionDrafts: {} };
    },
    get currentQuickDraft() { return this.draftSession ?? this.state.quickAddDraft ?? null; },
    quickDraft(source = {}) {
        if (this.currentQuickDraft && this.currentQuickDraft.version !== 1) throw Error("This Quick Add draft requires a newer version of Itacan.");
        this.draftSession ??= clone(this.state.quickAddDraft ?? this.newQuickDraft(source));
        if (Object.keys(source).length && this.draftSession.revision === 0 && !this.draftSession.text && !this.draftSession.attachments.length) this.draftSession.source = sourceMetadata(source);
        return clone(this.draftSession);
    },
    saveQuickDraft(values, id = this.quickDraft().id) {
        const previous = this.quickDraft();
        if (previous.id !== id) return Promise.reject(Error("This draft has already been submitted or cleared."));
        const next = { ...previous, ...clone(values), id, version: 1, revision: previous.revision + 1 };
        next.text = String(next.text ?? ""); next.attachments = (next.attachments ?? []).map(attachmentReference);
        next.source = sourceMetadata(next.source);
        if (next.text.trim() && next.attachments.length) return Promise.reject(Error("Write something or add a file. Clear the text or remove the file first."));
        if (previous.operation && previous.operation.state !== "done") {
            try { this.assertInput(previous, next); if (JSON.stringify(next.source) !== JSON.stringify(previous.source)) throw Error("Retry the original source before changing this draft."); } catch (error) { return Promise.reject(error); }
            next.operation = previous.operation;
        }
        // Keep the latest text immediately even when a disk checkpoint fails.
        this.draftSession = next;
        return this.enqueue(async () => {
            if (this.currentQuickDraft?.id !== id || this.currentQuickDraft.revision > next.revision) return;
            await this.save(this.captures, { quickAddDraft: next });
        });
    },
    flushQuickDraft(id = this.quickDraft().id) { return this.saveQuickDraft({}, id); },
    saveQuickAction(id, mode, values) {
        const draft = this.quickDraft(), keys = ["text", "taskTitle", "description", "steps", "pendingStep", "necessity", "fromDate", "fromTime", "dueDate", "dueTime", "completed", "completedAt", "phaseId", "nativeOwner", "nativeLocation", "nativeLocationType", "workspaceId", "folder", "title", "noteAction", "noteLocation", "recurrence", "recurrenceDraft"];
        const action = Object.fromEntries(keys.filter(key => values[key] !== undefined).map(key => [key, clone(values[key])]));
        action.type = mode === "text" ? "note" : mode;
        return this.saveQuickDraft({ actionDrafts: { ...draft.actionDrafts, [mode]: action }, lastAction: mode }, id);
    },
    async stageQuickFiles(files, id) {
        const before = this.quickDraft();
        if (before.id !== id || before.text.trim() || before.operation) throw Error("Clear the text before adding a file.");
        await this.stageFiles(files, async refs => {
            const current = this.quickDraft();
            if (current.id !== id) throw Error("This draft has changed.");
            const next = { ...current, revision: current.revision + 1, attachments: [...before.attachments, ...refs] };
            await this.save(this.captures, { quickAddDraft: next }); this.draftSession = next;
        });
        await this.flushQuickDraft(id);
    },
    removeQuickAttachment(id, attachmentId) { return this.enqueue(async () => {
        const previous = this.quickDraft();
        if (previous.id !== id || previous.operation) throw Error("Finish the saved action before removing its files.");
        const removed = previous.attachments.filter(ref => ref.id === attachmentId);
        const next = { ...previous, revision: previous.revision + 1, attachments: previous.attachments.filter(ref => ref.id !== attachmentId), actionDrafts: {} };
        await this.save(this.captures, { quickAddDraft: next }); this.draftSession = next;
        await this.releaseAttachments(removed);
    }); },
    clearQuickDraft(id) { return this.enqueue(async () => {
        const previous = this.quickDraft();
        if (previous.id !== id) return;
        if (previous.operation && previous.operation.state !== "done") throw Error("Finish or review the saved action before clearing this draft.");
        await this.save(this.captures, { quickAddDraft: null }); this.draftSession = this.newQuickDraft(previous.source);
        await this.releaseAttachments(previous.attachments);
    }); },
    sendQuickDraft(id) { return this.enqueue(async () => {
        const existing = this.captures.find(item => item.id === id);
        if (existing) return existing; // A lost acknowledgement must not create another item.
        const draft = this.quickDraft();
        if (draft.id !== id) throw Error("This draft has already been submitted or cleared.");
        if (!draft.text.trim() && !draft.attachments.length) throw Error("Add some text or a file first.");
        if (draft.text.trim() && draft.attachments.length) throw Error("Write something or add a file.");
        for (const ref of draft.attachments) if (!this.attachmentExists(ref)) throw Error('"' + ref.name + '" is no longer available.');
        const intent = captureIntent(draft.actionDrafts?.[draft.lastAction] ?? {}, draft.attachments);
        const { version, revision, ...capture } = clone(draft);
        capture.kind = captureKind(capture.text, capture.attachments);
        if (intent) capture.intent = intent;
        await this.save([...this.captures, capture], { quickAddDraft: null });
        this.draftSession = this.newQuickDraft(draft.source); return capture;
    }); }
};
