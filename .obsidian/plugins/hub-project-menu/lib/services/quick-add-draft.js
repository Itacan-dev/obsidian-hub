"use strict";
const { randomUUID, createHash } = require("node:crypto");
const { attachmentReference, captureIntent, captureKind, sourceMetadata } = require("../domain/inbox");
const clone = value => JSON.parse(JSON.stringify(value));
function fileCaptureId(draftId, attachmentId) {
    const hash = createHash("sha256").update(JSON.stringify(["quick-add-file", draftId, attachmentId])).digest("hex");
    return [hash.slice(0, 8), hash.slice(8, 12), "5" + hash.slice(13, 16),
        ((parseInt(hash[16], 16) & 3) | 8).toString(16) + hash.slice(17, 20), hash.slice(20, 32)].join("-");
}
const promotionResult = captures => captures.length === 1 ? captures[0] : { captures };

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
        }, async (source, { name, sourcePath, existing }) => {
            const identity = value => {
                const path = String(value ?? "").replace(/\\/g, "/");
                return /^[a-z]:/i.test(path) ? path.toLowerCase() : path;
            };
            const candidates = this.quickDraft().attachments.filter(ref => {
                if (!this.attachmentExists(ref)) return false;
                if (existing) return identity(this.attachmentPath(ref)) === identity(existing.path);
                if (sourcePath && ref.originalPath) return identity(sourcePath) === identity(ref.originalPath);
                return ref.name === name;
            });
            if (!candidates.length) return false;
            if (existing) return true; // The vault reference already follows the same file.
            const hash = bytes => createHash("sha256").update(typeof bytes === "string" ? bytes : Buffer.from(bytes)).digest("hex");
            const bytes = /\.md$/i.test(name) && typeof source.text === "function" ? await source.text() : await source.arrayBuffer();
            const incoming = hash(bytes);
            for (const ref of candidates) {
                const file = this.app.vault.getAbstractFileByPath(this.attachmentPath(ref));
                if (hash(await this.app.vault.readBinary(file)) === incoming) return true;
            }
            return false;
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
        const existing = this.captures.filter(item => item.id === id || item.quickAddDraftId === id);
        if (existing.length) {
            // A lost acknowledgement must not recreate entries or clear a newer draft.
            const stale = this.currentQuickDraft;
            if (stale?.id === id) {
                const expected = stale.attachments.length ? stale.attachments.map(ref => fileCaptureId(id, ref.id)) : [id];
                if (!existing.some(item => item.id === id) && !expected.every(key => existing.some(item => item.id === key))) {
                    throw Error("This submission needs review before its remaining draft can be cleared.");
                }
                await this.save(this.captures, { quickAddDraft: null });
                this.draftSession = this.newQuickDraft(stale.source);
            }
            return promotionResult(existing);
        }
        const draft = this.quickDraft();
        if (draft.id !== id) throw Error("This draft has already been submitted or cleared.");
        if (!draft.text.trim() && !draft.attachments.length) throw Error("Add some text or a file first.");
        if (draft.text.trim() && draft.attachments.length) throw Error("Write something or add a file.");
        if (draft.attachments.length > 1 && draft.operation && draft.operation.state !== "done") {
            throw Error("Retry the saved file placement before sending these files separately to Inbox.");
        }
        for (const ref of draft.attachments) if (!this.attachmentExists(ref)) throw Error('"' + ref.name + '" is no longer available.');
        const { version, revision, ...base } = clone(draft);
        const values = draft.actionDrafts?.[draft.lastAction] ?? {};
        const captures = draft.attachments.length ? draft.attachments.map((ref, index) => ({
            ...clone(base), id: fileCaptureId(id, ref.id), quickAddDraftId: id,
            createdAt: base.createdAt + index, attachments: [clone(ref)]
        })) : [base];
        for (const capture of captures) {
            capture.kind = captureKind(capture.text, capture.attachments);
            const intent = captureIntent(values, capture.attachments);
            if (intent) capture.intent = intent;
        }
        // Every file and the submitted draft change together in the existing atomic store.
        await this.save([...this.captures, ...captures], { quickAddDraft: null });
        this.draftSession = this.newQuickDraft(draft.source); return promotionResult(captures);
    }); }
};
