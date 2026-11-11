"use strict";
const { randomUUID, createHash } = require("node:crypto");
const N = require("./native-inbox-task");
const { bulkKind, remainingMembers, allocateBulkTitles, appendCapturedTexts, bulkMessage } = require("../domain/inbox-bulk");
const clone = value => JSON.parse(JSON.stringify(value));
const hash = text => createHash("sha256").update(text).digest("hex");

module.exports = {
    get bulk() { return this.state.bulk ?? null; },
    get activeBulk() { return this.bulk && this.bulk.state !== "done" ? this.bulk : null; },
    bulkMember(id) { return remainingMembers(this.activeBulk).find(member => member.id === id); },
    assertBulkAccess(id, batchId) {
        if (this.bulkMember(id) && this.activeBulk.id !== batchId) throw Error("Resume this item's retained batch before editing, deleting, or organizing it separately.");
    },
    bulkValues(batch, member) {
        const values = { ...batch.destination, text: member.input.text, attachments: clone(member.input.attachments), bulkBatchId: batch.id };
        if (batch.action === "task") {
            const mapped = N.draft(this, { text: member.input.text }, member.input);
            Object.assign(values, { type: "task", taskTitle: mapped.taskTitle, description: mapped.description,
                necessity: null, fromDate: null, fromTime: null, dueDate: null, dueTime: null, phaseId: null, steps: [], completed: false });
        } else Object.assign(values, { type: batch.action === "file" ? "file" : "note", title: member.title, noteAction: "new", filesOnly: true });
        return values;
    },
    prepareBulk(action, ids, destination, id = randomUUID()) { return this.enqueue(async () => {
        if (this.bulkExecution) throw Error("A batch is already saving.");
        if (this.bulk?.id === id) {
            if (action !== this.bulk.action || JSON.stringify(ids) !== JSON.stringify(this.bulk.members.map(m => m.id)) || JSON.stringify(destination) !== JSON.stringify(this.bulk.destination)) throw Error("Retry the batch's original items, order, and destination.");
            return clone(this.bulk);
        }
        if (this.activeBulk) throw Error("Resume the retained batch before starting another batch.");
        if (!["task", "note", "text", "file"].includes(action) || ids.length < 2 || new Set(ids).size !== ids.length) throw Error("Select at least two eligible items.");
        const captures = ids.map(key => { const capture = this.captures.find(c => c.id === key); if (!capture) throw Error("A selected item is no longer in Inbox."); return capture; }), kind = action === "file" ? "files" : "text";
        for (const c of captures) {
            if (bulkKind(c) !== kind || c.operation) throw Error("Select matching items without retained operations.");
            for (const ref of c.attachments) if (!this.attachmentExists(ref)) throw Error('"' + ref.name + '" is no longer available.');
        }
        if (action === "text") this.noteDestination({ ...destination, noteAction: "existing" }, false);
        else if (action !== "task") this.destination(destination);
        const createdAt = Date.now(), titles = action === "note" ? allocateBulkTitles(captures, destination.folder, path => this.app.vault.getAbstractFileByPath(path), new Date(createdAt)) : [];
        const batch = { version: 1, id, action, kind, state: "pending", createdAt, destination: clone(destination),
            members: captures.map((c, index) => ({ id: c.id, state: "pending", input: { text: c.text, attachments: clone(c.attachments), source: clone(c.source) }, ...(titles[index] ? { title: titles[index] } : {}) })) };
        if (action === "task") for (const member of batch.members) {
            const values = this.bulkValues(batch, member); N.payload(this, values, this.required(member.id));
            if (values.taskTitle.length > 10000 || values.description.length > 200000) throw Error("A selected capture exceeds the native task text limit. Organize it individually without truncation.");
        }
        await this.save(this.captures, { bulk: batch }); return clone(batch);
    }); },
    assertBulkInput(member) {
        const c = this.required(member.id);
        if (c.text !== member.input.text || JSON.stringify(c.attachments) !== JSON.stringify(member.input.attachments) || JSON.stringify(c.source) !== JSON.stringify(member.input.source)) throw Error("A selected item changed. Its batch has been retained for review.");
        return c;
    },
    bulkFinishPatch(capture, remap) {
        const batch = this.activeBulk;
        if (!this.bulkMember(capture.id)) return batch ? { bulk: { ...batch, members: batch.members.map(m => ({ ...m, input: remap(m.input) })) } } : {};
        const members = batch.members.map(member => member.id === capture.id ? { ...member, state: "done", receipt: clone(capture.operation ?? {}) } : { ...member, input: remap(member.input) });
        return { bulk: { ...batch, members, state: members.every(m => m.state === "done") ? "done" : "running", error: null } };
    },
    async runBulk(id, onProgress = () => {}) {
        if (this.bulkExecution) throw Error("A batch is already saving.");
        const notify = () => { try { onProgress(clone(this.bulk)); } catch (_) {} };
        const work = async () => {
            if (this.bulk?.id !== id) throw Error("This batch is no longer available.");
            if (this.bulk.state === "done") return { batch: clone(this.bulk), message: bulkMessage(this.bulk) };
            try {
                if (this.bulk.action === "text") { await this.enqueue(() => this.runBulkAppend(id)); notify(); }
                else for (const planned of remainingMembers(clone(this.bulk))) {
                    const member = this.bulk.members.find(m => m.id === planned.id);
                    await this.enqueue(() => { if (this.bulk?.id !== id) throw Error("Batch changed."); this.assertBulkInput(member); });
                    const batch = this.bulk, values = this.bulkValues(batch, member);
                    if (batch.action === "task") await this.makeTask(values, member.id);
                    else if (batch.action === "note") await this.createNote(values, member.id);
                    else await this.addFiles(values, member.id);
                    notify();
                }
                return { batch: clone(this.bulk), message: bulkMessage(this.bulk) };
            } catch (error) {
                try { await this.enqueue(async () => { if (this.bulk?.id === id) await this.save(this.captures, { bulk: { ...this.bulk, error: error.message, state: this.bulk.state === "done" ? "done" : "failed" } }); }); }
                catch (checkpoint) { error.message += " Progress checkpoint failed: " + checkpoint.message; }
                notify(); error.message = bulkMessage(this.bulk) + " " + error.message; error.batchId = id; throw error;
            }
        };
        this.bulkExecution = work();
        try { return await this.bulkExecution; } finally { this.bulkExecution = null; }
    },
    async runBulkAppend(id) {
        let batch = this.bulk;
        if (batch?.id !== id || batch.action !== "text") throw Error("Invalid append batch.");
        for (const member of remainingMembers(batch)) this.assertBulkInput(member);
        const file = this.noteDestination({ ...batch.destination, noteAction: "existing" }, false).file;
        for (let attempt = 0; attempt < 3; attempt++) {
            let fresh = false, transformed = false;
            if (!batch.append) {
                const before = await this.app.vault.read(file), after = appendCapturedTexts(before, batch.members.map(m => m.input.text));
                batch = { ...batch, append: { state: "prepared", beforeHash: hash(before), afterHash: hash(after) } };
                await this.save(this.captures, { bulk: batch }); fresh = true;
            }
            try {
                if (batch.append.state !== "ready") await this.app.vault.process(file, current => {
                    if (hash(current) === batch.append.afterHash) return current;
                    if (hash(current) !== batch.append.beforeHash) { const error = Error("The destination changed; review the retained append before retrying."); error.conflict = true; throw error; }
                    const next = appendCapturedTexts(current, batch.members.map(m => m.input.text));
                    if (hash(next) !== batch.append.afterHash) throw Error("The retained append content differs.");
                    transformed = true; return next;
                });
            } catch (error) {
                if (fresh && error.conflict && !transformed && attempt < 2) { const { append, ...next } = batch; batch = next; await this.save(this.captures, { bulk: batch }); continue; }
                throw error;
            }
            if (hash(await this.app.vault.read(file)) !== batch.append.afterHash) throw Error("The appended note changed; the source items have been retained for review.");
            if (batch.append.state !== "ready") { batch = { ...batch, append: { ...batch.append, state: "ready" } }; await this.save(this.captures, { bulk: batch }); }
            const ids = new Set(batch.members.map(m => m.id));
            await this.save(this.captures.filter(c => !ids.has(c.id)), { bulk: { ...batch, state: "done", error: null, members: batch.members.map(m => ({ ...m, state: "done" })) } });
            this.plugin.markProjectChangedByPath?.(file.path); this.plugin.scheduleEditedActivity?.(file); this.plugin.notifyProjectFilesChanged?.(file.path);
            return;
        }
    }
};
