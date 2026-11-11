"use strict";

const { randomUUID, createHash } = require("crypto");
const nodePath = require("path");
const { createFileDomain, projectItemPath, isFolderLike } = require("../domain/files");
const { validLocation, locationLabel } = require("../domain/task-views");
const { taskWorkspaces, taskLocations } = require("./task-locations");
const { NoteLocationError, noteLocation, parseNotePositions, resolveNoteLocation, insertNoteText } = require("../domain/note-insertion");
const { INBOX_VERSION, INBOX_ATTACHMENT_ROOT, captureKind, sourceMetadata, attachmentReference,
    isInboxOwned, sortedCaptures, taskTitle, captureIntent, captureDraft, captureNoteTitle, inboxSort } = require("../domain/inbox");

const clone = value => JSON.parse(JSON.stringify(value));
const digest = bytes => createHash("sha256").update(typeof bytes === "string" ? bytes : Buffer.from(bytes)).digest("hex");

class HubInboxService {
    constructor(plugin) {
        this.plugin = plugin; this.app = plugin.app; this.listeners = new Set(); this.queue = Promise.resolve();
        const version = Number(plugin.projectWizard.data.inbox?.version) || INBOX_VERSION;
        if (version > INBOX_VERSION) throw Error("This Inbox was saved by a newer version of Itacan.");
        if (plugin.projectWizard.data.inbox?.bulk && plugin.projectWizard.data.inbox.bulk.version !== 1) throw Error("This Inbox batch requires a newer version of Itacan.");
        this.files = createFileDomain({ getByPath: path => this.app.vault.getAbstractFileByPath(path) });
        this.noteCache = new Map(); this.noteRevisions = new Map(); this.noteEvents = [];
        if (this.app.vault.on && this.app.vault.offref) for (const event of ["modify", "delete", "rename"]) {
            this.noteEvents.push(this.app.vault.on(event, (file, oldPath) => {
                let changed = false;
                for (const path of [file.path, oldPath].filter(Boolean)) {
                    if (this.noteRevisions.has(path)) {
                        this.noteCache.delete(path); this.noteRevisions.set(path, this.noteRevisions.get(path) + 1);
                        changed = true;
                    }
                }
                if (changed) this.emit();
            }));
        }
    }
    refreshNativeInventory(owner) { const root=this.plugin.nativeTaskHost,host=owner&&root?.ownerHosts?root.ownerHosts().find(h=>h.matches(owner)):root; if(owner&&!host)throw Error("Native task authority is unavailable.");return host?.refreshInventory?.() ?? Promise.resolve(); }
    scheduleNativeRefresh() { this.nativeRefresh = Promise.resolve().then(()=>this.refreshNativeInventory()).catch(error=>{ console.error("Native capture inventory refresh requires review",error); }); return this.nativeRefresh; }
    get state() { return this.plugin.projectWizard.data.inbox ?? { version: 1, captures: [] }; }
    get captures() { return (Array.isArray(this.state.captures) ? this.state.captures : []).filter(item => item && typeof item.id === "string"); }
    get count() { return this.captures.length; }
    list(options) { return sortedCaptures(this.captures, { completion: item => this.getInboxCompletion(item), ...options }); }
    get sortPreference() { return inboxSort(this.plugin.projectWizard.data.inboxSort); }
    setSortPreference(sort) { return this.enqueue(async () => {
        sort = inboxSort(sort);
        await this.plugin.dataStore.writeQueue?.catch(() => {});
        const data = this.plugin.projectWizard.data, previous = data.inboxSort;
        if (previous === sort) return;
        data.inboxSort = sort;
        try { await this.plugin.dataStore.save(data); this.plugin.projectWizard.data.inboxSort = sort; }
        catch (error) {
            if (data.inboxSort === sort) { if (previous === undefined) delete data.inboxSort; else data.inboxSort = previous; }
            throw error;
        }
    }); }
    get(id) { return this.captures.find(capture => capture.id === id) ?? (id && this.currentQuickDraft?.id === id ? this.currentQuickDraft : null); }
    onChange(callback) { this.listeners.add(callback); return () => this.listeners.delete(callback); }
    destroy() { this.destroyed = true; this.captureAction?.close(); this.listeners.clear(); this.noteEvents.forEach(ref => this.app.vault.offref(ref)); this.noteCache.clear(); this.noteRevisions.clear(); }
    emit() { for (const callback of this.listeners) { try { callback(); } catch (error) { console.error("Could not refresh Inbox", error); } } }
    enqueue(work) { const result = this.queue.catch(() => {}).then(work); this.queue = result; return result; }
    async save(captures, patch = {}) {
        await this.plugin.dataStore.writeQueue?.catch(() => {});
        const data = this.plugin.projectWizard.data, previous = data.inbox;
        const next = { ...this.state, ...patch, version: patch.bulk || this.state.bulk ? INBOX_VERSION : this.state.version, captures };
        data.inbox = next;
        try { await this.plugin.dataStore.save(data); this.plugin.projectWizard.data.inbox = next; }
        catch (error) {
            if (data.inbox === next) { if (previous === undefined) delete data.inbox; else data.inbox = previous; }
            throw error;
        }
        this.emit();
    }
    async replace(capture) {
        if (capture.id === this.currentQuickDraft?.id) {
            await this.save(this.captures, { quickAddDraft: capture }); this.draftSession = clone(capture);
        } else await this.save(this.captures.map(item => item.id === capture.id ? capture : item));
        return capture;
    }
    capture(values) { return this.enqueue(() => this.createCapture(values)); }
    async createCapture(values = {}) {
        const text = String(values.text ?? values.taskTitle ?? ""), attachments = values.attachments ?? [], source = values.source ?? {};
        const refs = attachments.map(attachmentReference);
        if (!String(text).trim() && !refs.length) throw Error("Add some text or a file first.");
        if (String(text).trim() && refs.length) throw Error("Write something or add a file. Clear the text or remove the file first.");
        for (const attachment of refs) if (!this.attachmentExists(attachment)) throw Error(`\"${attachment.name}\" is no longer available.`);
        const intent = captureIntent(values, refs);
        const capture = { id: randomUUID(), createdAt: Date.now(), text: String(text), attachments: refs,
            kind: captureKind(text, refs), source: sourceMetadata(source), ...(intent ? { intent } : {}) };
        await this.save([...this.captures, capture]); return capture;
    }
    updateCapture(id, values) { return this.enqueue(async () => {
        this.assertBulkAccess(id);
        const previous = this.required(id);
        const text = String(values.text ?? previous.text), attachments = (values.attachments ?? previous.attachments).map(attachmentReference);
        if (previous.operation && previous.operation.state !== "done") {
            if (text !== previous.text || JSON.stringify(attachments) !== JSON.stringify(previous.attachments) ||
                JSON.stringify(sourceMetadata(values.source ?? previous.source)) !== JSON.stringify(previous.source)) {
                throw Error("Retry this item's saved operation before editing its content or attachments.");
            }
            if (previous.operation.kind === "native-task") { require("./native-inbox-task").sameValues(previous.operation,values); }
            else if (previous.operation.kind === "note-insertion") {
                this.assertNoteInsertionValues(previous.operation, values);
            } else if (previous.operation.state === "ready" && this.changedFileDestination(previous.operation, values)) {
                throw Error("This item was already saved to its selected destination. Retry to finish removing it from Inbox.");
            }
        }
        // Existing items may be cleared while being organised. Creation still
        // requires content, and direct completion uses the ordinary validation.
        if (String(text).trim() && attachments.length && !(String(previous.text).trim() && previous.attachments.length)) {
            throw Error("Write something or add a file. Clear the text or remove the file first.");
        }
        const intent = captureIntent({ ...previous.intent, ...values }, attachments);
        const actionDrafts = {...previous.actionDrafts};
        if(previous.intent?.type && previous.intent.type !== intent?.type) actionDrafts[previous.intent.type] = clone(previous.intent);
        if(Object.keys(actionDrafts).length && intent?.type) actionDrafts[intent.type] = clone(intent);
        if (["task", "note", "text", "file"].includes(values.actionMode)) actionDrafts[values.actionMode] = clone(intent ?? {});
        const result = { ...previous, ...(Object.keys(actionDrafts).length?{actionDrafts}:{}), text, attachments, kind: captureKind(text, attachments), source: sourceMetadata(values.source ?? previous.source) };
        if (intent) result.intent = intent; else delete result.intent;
        if (JSON.stringify(result) === JSON.stringify(previous)) return previous;
        await this.replace(result); return result;
    }); }
    required(id) { const capture = this.get(id); if (!capture) throw Error("This item is no longer in Inbox."); return capture; }
    input(capture, values) {
        return { text: String(values.text ?? capture.text), attachments: (values.attachments ?? capture.attachments)
            .map(ref => ({ id: ref.id, path: ref.path })) };
    }
    assertInput(capture, values) {
        const previous = capture.operation?.input ?? this.input(capture, {});
        if (JSON.stringify(this.input(capture, values)) !== JSON.stringify(previous)) {
            throw Error("This item has a saved action to retry. Retry its original content and files; keep any new content in a separate item.");
        }
    }
    assertNoteInsertionValues(operation, values) {
        if ((values.workspaceId !== undefined && values.workspaceId !== operation.workspaceId) ||
            (values.noteAction !== undefined && values.noteAction !== "existing") ||
            (values.noteLocation !== undefined && JSON.stringify(noteLocation(values.noteLocation)) !== JSON.stringify(noteLocation(operation.noteLocation)))) {
            throw Error("Retry the original note and position before changing this item's destination.");
        }
    }
    changedFileDestination(operation, values) {
        return (values.workspaceId !== undefined && values.workspaceId !== operation.workspaceId) ||
            (values.folder !== undefined && values.folder && values.folder !== operation.folder) ||
            (values.title !== undefined && String(values.title) !== operation.title);
    }
    async prepareCapture(capture, values) {
        const text = String(values.text ?? capture.text), refs = (values.attachments ?? capture.attachments).map(attachmentReference);
        if (capture.attachments.some(ref => !refs.some(item => item.id === ref.id && item.path === ref.path))) {
            throw Error("Include all of this item's files so none are lost when it is resolved.");
        }
        if (text.trim() && refs.length && !(capture.text.trim() && capture.attachments.length)) {
            throw Error("Write something or add a file. Clear the text or remove the file first.");
        }
        const intent = captureIntent({ ...capture.intent, ...values }, refs);
        if (text !== capture.text || JSON.stringify(refs) !== JSON.stringify(capture.attachments) ||
            JSON.stringify(intent) !== JSON.stringify(capture.intent ?? null)) {
            for (const ref of refs) if (!this.attachmentExists(ref)) throw Error(`\"${ref.name}\" is no longer available.`);
            const next = { ...capture, text, attachments: refs, kind: captureKind(text, refs) };
            if (intent) next.intent = intent; else delete next.intent;
            capture = await this.replace(next);
        }
        return capture;
    }
    completion(values = {}, captureId) {
        if(values.type === "task") { try { require("./native-inbox-task").payload(this,values,this.get(captureId)??{}); return {complete:true,ready:true,error:null,ratio:1,missing:[],completedRequired:1,totalRequired:1}; } catch(error) { return {complete:false,ready:false,error:error.message,ratio:0,missing:[],completedRequired:0,totalRequired:1}; } }
        const type = values.type, requirements = [];
        const requireValue = (valid, message) => { if (!valid) throw Error(message); };
        const check = (label, validate, progress = true) => {
            try { validate(); requirements.push({ label, complete: true, progress }); }
            catch (error) { requirements.push({ label, complete: false, progress, error: error.message }); }
        };
        let validationError = null;
        if (!["note", "file"].includes(type)) validationError = "Choose Task or Note.";
        else {
            // Payload validity still gates creation and guides corrections, but
            // its mere existence never earns an organisational progress step.
            if (type === "note") check("Content", () => requireValue(String(values.text ?? "").trim(), "Write the note content."), false);
            else check("File", () => {
                requireValue(values.attachments?.length, "Add a file first.");
                requireValue(values.attachments.every(ref => this.attachmentExists(ref)), "A file is no longer available.");
            }, false);
            // Type selects this schema; it is not an organisational detail.
            if (type === "note") check("Action", () => {}); // New note is the existing default route.
            check("Workspace", () => {
                requireValue(values.workspaceId, "Choose a Project or Resource.");
                const workspace = this.workspace(values.workspaceId);
                requireValue(workspace, "This Project or Resource is no longer available. Choose a destination.");
                requireValue(this.plugin.oath?.canOpen(workspace) !== false, "This destination is locked during your Oath.");
            });
            if (type === "note" && values.noteAction === "existing") check("Location", () => {
                const operation = this.get(captureId)?.operation;
                const retry = operation?.kind === "note-insertion" && operation.state !== "done";
                if (retry) this.assertNoteInsertionValues(operation, values);
                this.noteDestination(values, !retry);
            });
            else {
                check("Folder", () => { requireValue(values.folder, "Choose a folder."); this.destination(values); });
                if (type === "note") check("Title", () => captureNoteTitle(values.title));
            }
            // Optional details never add progress steps. Their existing validity
            // checks still block submission (for example, an unfinished Step).
            try {
                if (type === "note" && values.noteAction === "existing" && values.attachments?.length) {
                    throw Error("Use New note to keep this item's files.");
                }
            } catch (error) { validationError = error.message; }
        }
        const missing = requirements.filter(item => !item.complete).map(item => item.label);
        const details = requirements.filter(item => item.progress);
        const completedRequired = details.filter(item => item.complete).length, totalRequired = details.length;
        // Classification is the only known blocker before type-specific
        // requirements exist. Keep its untyped progress at zero.
        if (!totalRequired) missing.push("Type");
        const complete = totalRequired > 0 && !missing.length && !validationError;
        return { complete, ready: complete, error: requirements.find(item => !item.complete)?.error ?? validationError,
            completedRequired, totalRequired, ratio: totalRequired ? completedRequired / totalRequired : 0, missing };
    }
    getInboxCompletion(capture, values) { return this.completion(values ?? captureDraft(capture), capture?.id); }
    destinations() {
        return taskWorkspaces(this.plugin).filter(workspace => workspace.contextKind === "resource" || workspace.status === "active")
            .filter(workspace => isFolderLike(this.app.vault.getAbstractFileByPath(workspace.root)))
            .map(workspace => ({ ...workspace, id: workspace.projectId || `resource:${workspace.resourceType || workspace.id}`,
                name: workspace.name || workspace.label }));
    }
    workspace(id) { return this.destinations().find(workspace => workspace.id === id || workspace.root === id) ?? null; }
    workspacePath(path, workspace) {
        if (typeof path !== "string" || !path || !validLocation(path, workspace)) return false;
        if(path === workspace.root) return true;
        if (workspace.contextKind === "resource" || path.slice(0,path.lastIndexOf("/")) === workspace.root) return true;
        // Files renders direct child folders as real Project workspaces. The
        // synthetic root group exists only to display older loose root files.
        const relative = path.slice(workspace.root.length + 1), name = relative.split("/")[0];
        return !!name && isFolderLike(this.app.vault.getAbstractFileByPath(workspace.root + "/" + name));
    }
    noteLocations(id) { const workspace=this.workspace(id);return workspace?taskLocations(this.plugin, workspace.root).filter(location=>this.workspacePath(location.path,workspace)):[]; }
    noteDestination(values, structural = true) {
        const workspace = this.workspace(values.workspaceId), location = noteLocation(values.noteLocation);
        if (!workspace || this.plugin.oath?.canOpen(workspace) === false) throw Error("Choose an available note workspace.");
        const file = location && this.app.vault.getAbstractFileByPath(location.path);
        if (!file || isFolderLike(file) || file.extension?.toLowerCase() !== "md" || !this.workspacePath(file.path, workspace)) throw new NoteLocationError();
        const parsed = this.noteCache.get(file.path)?.parsed;
        if (structural && (location.targetType !== "note" || parsed) && !resolveNoteLocation(parsed, location)) throw new NoteLocationError();
        return { workspace, file, location };
    }
    async readNotePositions(workspaceId, path) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const { file } = this.noteDestination({ workspaceId, noteLocation: { path, targetType: "note", position: "end" } }, false);
            if (!this.noteRevisions.has(path)) this.noteRevisions.set(path, 0);
            const revision = this.noteRevisions.get(path), text = await this.app.vault.read(file);
            if (revision !== this.noteRevisions.get(path) || file.path !== path) continue;
            const parsed = parseNotePositions(text);
            this.noteCache.set(path, { file, parsed }); return parsed;
        }
        throw Error("The note is changing. Choose its position again when editing has finished.");
    }
    folders(id) {
        const workspace = this.workspace(id); if (!workspace) return [];
        return (this.app.vault.getAllLoadedFiles?.() ?? []).filter(file => isFolderLike(file) && this.workspacePath(file.path, workspace))
            .map(file => ({ path: file.path, name: file.name || file.path.split("/").at(-1), label: locationLabel(file.path, workspace) }))
            .sort((a, b) => a.path === workspace.root ? -1 : b.path === workspace.root ? 1 : a.label.localeCompare(b.label, undefined, { numeric: true }));
    }
    destination(values) {
        const workspace = this.workspace(values.workspaceId), folder = values.folder || workspace?.root;
        if (!workspace) throw Error("This Project or Resource is no longer available. Choose a destination.");

        if (!this.workspacePath(folder, workspace) || !isFolderLike(this.app.vault.getAbstractFileByPath(folder))) {
            throw Error("This destination folder is no longer available. Choose another folder.");
        }
        if (this.plugin.oath?.canOpen(workspace) === false) throw Error("This destination is locked during your Oath.");
        return { workspace, folder };
    }
    fileOperationStructure(operation) {
        const workspace = taskWorkspaces(this.plugin).find(item => item.projectId === operation.workspaceId);
        if (!workspace) throw Error("This Project or Resource is no longer available. Choose a destination.");
        const folder = operation.folder;

        const paths = [...(operation.moves ?? []).map(move => move.to), ...(operation.note ? [operation.note.path] : [])];
        if (typeof folder !== "string" || !validLocation(folder, workspace) || paths.some(path => typeof path !== "string" ||
            path.slice(0, path.lastIndexOf("/")) !== folder || !validLocation(path, workspace))) {
            throw Error("This saved action has an invalid workspace destination. The item has been kept in Inbox.");
        }
        return { workspace, folder };
    }
    fileOperationDestination(operation) {
        this.fileOperationStructure(operation);
        return this.destination(operation);
    }
    attachmentPath(ref) {
        if (this.app.vault.getAbstractFileByPath(ref?.path)) return ref.path;
        for (const capture of [...this.captures, this.currentQuickDraft].filter(Boolean)) {
            const move = capture.operation?.moves?.find(item => item.from === ref?.path);
            if (move && this.app.vault.getAbstractFileByPath(move.to)) return move.to;
        }
        return ref?.path;
    }
    attachmentExists(ref) { const file = this.app.vault.getAbstractFileByPath(this.attachmentPath(ref)); return !!file && !isFolderLike(file); }
    async openAttachment(ref) {
        const path = this.attachmentPath(ref), file = this.app.vault.getAbstractFileByPath(path);
        if (!file || isFolderLike(file)) throw Error(`\"${ref.name}\" is no longer available.`);
        if (this.plugin.oath?.canOpen(path) === false) return false;
        if (isInboxOwned(ref)) { await this.app.workspace.getLeaf(true).openFile(file); return true; }
        return this.plugin.workspaceModes?.openFile ? this.plugin.workspaceModes.openFile(path) :
            (await this.app.workspace.getLeaf(true).openFile(file), true);
    }
    async ensureFolder(path) {
        if (this.plugin.projectWizard.ensureFolder) return this.plugin.projectWizard.ensureFolder(path);
        let current = "";
        for (const part of path.split("/")) {
            current = current ? current + "/" + part : part;
            const entry = this.app.vault.getAbstractFileByPath(current);
            if (entry && !isFolderLike(entry)) throw Error("The Inbox attachment folder is occupied by a file.");
            if (!entry) await this.app.vault.createFolder(current);
        }
    }
    sourcePath(source) {
        if (typeof source.path === "string" && source.path) return source.path;
        try { return require("electron").webUtils?.getPathForFile(source) || null; } catch (_) { return null; }
    }
    vaultSource(source, sourcePath = this.sourcePath(source)) {
        const base = this.app.vault.adapter?.getBasePath?.();
        if (!base || typeof sourcePath !== "string" || !nodePath.isAbsolute(sourcePath)) return null;
        const relative = nodePath.relative(base, sourcePath);
        if (!relative || relative.startsWith("..") || nodePath.isAbsolute(relative)) return null;
        const path = relative.replace(/\\/g, "/"), file = this.app.vault.getAbstractFileByPath(path);
        return file && !isFolderLike(file) ? file : null;
    }
    stageFiles(sources, checkpoint, skip) { return this.enqueue(async () => {
        const refs = [], imported = [], folder = INBOX_ATTACHMENT_ROOT + "/" + randomUUID();
        try {
            for (const source of Array.from(sources ?? [])) {
                if (!source || typeof source.arrayBuffer !== "function") throw Error("Drop files or images, rather than a folder.");
                const name = String(source.name ?? "").trim();
                if (!name || /[\\/:*?"<>|\u0000-\u001f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) || name === "." || name === "..") throw Error("An attachment has an invalid filename. Rename it before importing.");
                const sourcePath = this.sourcePath(source), existing = this.vaultSource(source, sourcePath);
                if (skip && await skip(source, { name, sourcePath, existing })) continue;
                if (existing) {
                    refs.push({ id: randomUUID(), path: existing.path, name: existing.name || name, ownership: "reference", size: Number(source.size) || existing.stat?.size || 0, mime: source.type || "", originalPath: existing.path });
                    if (checkpoint) await checkpoint([...refs]);
                    continue;
                }
                await this.ensureFolder(folder);
                const path = this.files.availableExternalFilePath(folder, name);
                const ref = { id: randomUUID(), path, name, ownership: "inbox", size: Number(source.size) || 0,
                    mime: source.type || "", ...(sourcePath ? { originalPath: sourcePath } : {}) };
                // Journal the planned vault path before copying bytes. A crash can
                // leave a missing-file reference, never an undiscoverable draft copy.
                if (checkpoint) await checkpoint([...refs, ref]);
                // Keep Markdown text and other bytes on the same native import paths as Files.
                const file = /\.md$/i.test(name) && typeof source.text === "function" ?
                    await this.app.vault.create(path, await source.text()) : await this.app.vault.createBinary(path, await source.arrayBuffer());
                imported.push(file);
                refs.push(ref);
            }
            return refs;
        } catch (error) {
            if (!checkpoint) for (const file of imported) { try { await this.plugin.fileOperations.trash(file.path); } catch (_) { /* Preserve a failed-cleanup copy rather than its original. */ } }
            throw error;
        }
    }); }
    async releaseAttachments(refs) {
        for (const ref of refs ?? []) {
            if (!isInboxOwned(ref) || [...this.captures, this.currentQuickDraft, ...(this.activeBulk?.members.filter(m => m.state !== "done").map(m => m.input) ?? [])].filter(Boolean).some(capture => capture.attachments?.some(item => item.path === ref.path) || capture.operation?.moves?.some(move => move.from === ref.path || move.to === ref.path))) continue;
            const file = this.app.vault.getAbstractFileByPath(ref.path);
            if (file && !isFolderLike(file)) { try { await this.plugin.fileOperations.trash(file.path); } catch (error) { console.warn("Could not remove unused Inbox copy", error); } }
        }
    }
    delete(id) { return this.enqueue(async () => {
        this.assertBulkAccess(id);
        if(this.required(id).operation?.kind === "native-task") throw Error("Resolve the retained native task operation before deleting its source item.");
        const capture = this.required(id);
        if (["note", "files"].includes(capture.operation?.kind) && capture.operation.state === "prepared") {
            let valid = false;
            try { this.fileOperationStructure(capture.operation); valid = true; } catch (_) { /* Keep pre-existing output data of invalid legacy receipts. */ }
            if (valid) await this.rollback(capture.operation);
        }
        await this.finish(capture); return true;
    }); }
    markdownLink(path, notePath, embed = false) {
        const name = path.split("/").at(-1);
        const file = this.app.vault.getAbstractFileByPath(path) || { path, name, basename: name.replace(/\.[^.]+$/, ""), extension: name.split(".").at(-1) };
        const link = this.app.fileManager.generateMarkdownLink?.(file, notePath) || `[${file.basename}](<${path}>)`;
        return embed && !link.startsWith("!") ? "!" + link : link;
    }
    noteText(capture, moves, path) {
        const pieces = [capture.text.trimEnd()].filter(Boolean), source = capture.source ?? {};
        const url = source.pageUrl || source.url;
        if (url && /^https?:\/\//i.test(url)) {
            const title = String(source.pageTitle || source.title || url).replace(/[\[\]\\]/g, "\\$&");
            pieces.push(`Source: [${title}](<${url.replace(/[<>\r\n]/g, "")}>)`);
        } else if (source.path && this.app.vault.getAbstractFileByPath(source.path)) pieces.push("Source: " + this.markdownLink(source.path, path));
        else if (source.workspaceName) pieces.push("Source: " + source.workspaceName);
        if (moves.length) pieces.push(moves.map(move => this.markdownLink(move.to, path,
            /^image\//i.test(move.mime) || /\.(png|jpe?g|gif|webp|avif|bmp|svg|ico)$/i.test(move.name))).join("\n"));
        return pieces.join("\n\n") + "\n";
    }
    async prepareFiles(capture, kind, values) {
        const { workspace, folder } = this.destination(values), reserved = new Set();
        const paths = createFileDomain({ getByPath: path => reserved.has(path) || this.app.vault.getAbstractFileByPath(path) });
        if (kind === "files" && !capture.attachments.length) throw Error("Attach at least one file or image.");
        if (kind === "note") {
            if (!capture.attachments.length && !capture.text.trim()) throw Error("Write the note content.");
            captureNoteTitle(values.title);
        }
        const moves = [];
        for (const ref of capture.attachments) {
            const duplicate = moves.find(move => move.from === ref.path);
            if (duplicate) { moves.push({ ...duplicate, attachmentId: ref.id }); continue; }
            const file = this.app.vault.getAbstractFileByPath(ref.path);
            if (!file || isFolderLike(file)) throw Error(`\"${ref.name}\" is no longer available.`);
            // Explicit Move to moves a vault reference; deleting a item never does.
            const to = file.parent?.path === folder || ref.path.slice(0, ref.path.lastIndexOf("/")) === folder ? ref.path : paths.availableExternalFilePath(folder, ref.name);
            reserved.add(to);
            moves.push({ attachmentId: ref.id, from: ref.path, to, ownership: ref.ownership, name: ref.name,
                mime: ref.mime, hash: digest(await this.app.vault.readBinary(file)) });
        }
        const source = capture.source ?? {}, operationId = randomUUID();
        const needsNote = kind === "note" || !!capture.text.trim() || (!values.filesOnly && !!(source.url || source.pageUrl || source.path || source.workspaceName));
        let note = null;
        if (needsNote) {
            const bulkNote = kind === "note" && this.bulkMember(capture.id) && this.activeBulk.action === "note";
            const proposed = projectItemPath(folder, "note", values.title || (kind === "files" ? "Captured files" : "Untitled"));
            if (bulkNote && this.app.vault.getAbstractFileByPath(proposed)) throw Error("The allocated bulk note filename was taken. Its source is retained; review the collision before retrying.");
            const path = paths.availableExternalFilePath(folder, proposed.slice(folder.length + 1));
            // Native attachment links are generated after the files have moved,
            // when the actual TFiles can resolve names with the user's preferences.
            note = { path, ...(kind === "note" && (this.currentQuickDraft?.id === capture.id || bulkNote) && !capture.attachments.length ? { verbatim: true } : {}) };
        }
        return { id: operationId, kind, state: "prepared", workspaceId: workspace.id, folder, title: String(values.title ?? ""), moves, note, input: this.input(capture, values) };
    }
    async checkMove(move, path) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file || isFolderLike(file) || digest(await this.app.vault.readBinary(file)) !== move.hash) {
            throw Error(`\"${move.name}\" changed or is missing. The item has been kept in Inbox.`);
        }
        return file;
    }
    async executeFiles(operation, capture) {
        this.fileOperationDestination(operation);
        for (const move of operation.moves) {
            const from = this.app.vault.getAbstractFileByPath(move.from), to = this.app.vault.getAbstractFileByPath(move.to);
            if (move.from === move.to) { await this.checkMove(move, move.to); continue; }
            if (!from && to) { await this.checkMove(move, move.to); await this.plugin.fileOperations.captureMove(operation.id, move); continue; }
            if (to) throw Error(`\"${move.name}\" already exists at the destination.`);
            await this.checkMove(move, move.from);
            await this.plugin.fileOperations.captureMove(operation.id, move);
            await this.checkMove(move, move.to);
        }
        if (operation.note) {
            if (operation.note.text === undefined) {
                // Quick Add keeps its exact text and receipt hash in metadata.
                // Other note flows retain their existing attribution and marker.
                const text = operation.note.verbatim ? operation.input.text : this.noteText({ ...capture, text: operation.input.text }, operation.moves, operation.note.path) +
                    `\n<!-- itacan-capture:${operation.id} -->\n`;
                operation = { ...operation, note: { ...operation.note, text, hash: digest(text) } };
                await this.replace({ ...capture, operation });
            }
            const existing = this.app.vault.getAbstractFileByPath(operation.note.path);
            if (!existing) await this.app.vault.create(operation.note.path, operation.note.text);
            const file = this.app.vault.getAbstractFileByPath(operation.note.path);
            if (!file || digest(await this.app.vault.read(file)) !== operation.note.hash) throw Error("The new note changed. The item has been kept in Inbox.");
        }
        return operation;
    }
    async rollback(operation) {
        const failures = [];
        if (operation.note) {
            const file = this.app.vault.getAbstractFileByPath(operation.note.path);
            if (file) {
                try {
                    const content = isFolderLike(file) ? "" : await this.app.vault.read(file);
                    // No inline identity marker exists in a verbatim note. Keep
                    // the file and source for a hash-checked original retry.
                    if (operation.note.verbatim) throw Error("The destination note has been retained. Retry the original destination; review it first if its content changed.");
                    if (!content.includes(`<!-- itacan-capture:${operation.id} -->`)) {
                        // A competing file is not ours, even when its name matches.
                    } else if (digest(content) !== operation.note.hash) throw Error("The destination note changed. Check it before retrying this item.");
                    else await this.plugin.fileOperations.trash(file.path);
                } catch (error) { failures.push(error); }
            }
        }
        for (const move of [...operation.moves].reverse()) {
            if (move.from === move.to || !this.app.vault.getAbstractFileByPath(move.to)) continue;
            try {
                if (this.app.vault.getAbstractFileByPath(move.from)) { await this.checkMove(move, move.from); continue; }
                const parent = move.from.slice(0, move.from.lastIndexOf("/"));
                if (!isFolderLike(this.app.vault.getAbstractFileByPath(parent))) throw Error("The original file folder was removed. The item has been kept in Inbox.");
                await this.checkMove(move, move.to);
                await this.plugin.fileOperations.captureMove(operation.id, move, true);
            } catch (error) { failures.push(error); }
        }
        if (failures.length) throw failures[0];
    }
    async finish(capture) {
        const moves = capture.operation?.state === "ready" ? capture.operation.moves ?? [] : [];
        const quick = this.currentQuickDraft, isQuick = quick?.id === capture.id;
        const remap = other => {
            const attachments = other.attachments.map(ref => {
                const move = moves.find(item => item.from === ref.path);
                return move ? { ...ref, path: move.to, ownership: "reference" } : ref;
            });
            return { ...other, attachments };
        };
        await this.save(this.captures.filter(item => item.id !== capture.id).map(remap),
            { ...(isQuick ? { quickAddDraft: null } : quick ? { quickAddDraft: remap(quick) } : {}), ...this.bulkFinishPatch(capture, remap) });
        if (isQuick) this.draftSession = this.newQuickDraft(capture.source);
        else if (quick) this.draftSession = remap(quick);
        await this.releaseAttachments(capture.attachments);
    }
    createNote(values, captureId) { return this.enqueue(() => {
        this.assertBulkAccess(captureId, values.bulkBatchId);
        const saved = this.get(captureId);
        return (values.noteAction ?? saved?.intent?.noteAction) === "existing" || saved?.operation?.kind === "note-insertion" ?
            this.resolveNoteInsertion(values, captureId) : this.resolveFiles("note", values, captureId);
    }); }
    async resolveNoteInsertion(values, captureId) {
        let capture = captureId ? this.required(captureId) : await this.createCapture({ ...values, type: "note", noteAction: "existing" });
        values = { ...capture.intent, ...values, type: "note" };
        let operation = capture.operation?.state !== "done" ? capture.operation : null, preparedHere = false, inserted = false;
        try {
            if (capture.attachments.length) throw Error("Use New note to keep this item's files.");
            if (!String(values.text ?? capture.text).trim()) throw Error("Write the note content.");
            if (operation && operation.kind !== "note-insertion") throw Error("Retry the saved action before choosing another action for this item.");
            if (operation) { this.assertInput(capture, values); this.assertNoteInsertionValues(operation, values); }
            if (values.noteAction !== "existing") throw Error("Retry the original Note action.");
            let file;
            for (let attempt = 0; attempt < 3; attempt++) {
                if (!operation) {
                    capture = await this.prepareCapture(capture, values);
                    const destination = this.noteDestination(values, false);
                    file = destination.file;
                    const current = await this.app.vault.read(file);
                    const next = insertNoteText(current, destination.location, capture.text);
                    operation = { id: randomUUID(), kind: "note-insertion", state: "prepared", workspaceId: destination.workspace.id,
                        noteLocation: destination.location, beforeHash: digest(current), afterHash: digest(next), input: this.input(capture, values) };
                    capture = await this.replace({ ...capture, operation }); preparedHere = true;
                }
                file = this.noteDestination({ ...operation, noteAction: "existing" }, false).file;
                if (operation.state !== "ready") {
                    try {
                        await this.app.vault.process(file, current => {
                            const currentHash = digest(current);
                            if (currentHash === operation.afterHash) return current;
                            if (currentHash !== operation.beforeHash) {
                                const error = Error(preparedHere ? "The note changed while saving. Try Add to Itacan again." :
                                    "A previous insertion may already be saved in this note. Check the note before retrying this item.");
                                error.code = "NOTE_INSERTION_CONFLICT"; throw error;
                            }
                            const next = insertNoteText(current, operation.noteLocation, operation.input.text);
                            if (digest(next) !== operation.afterHash) throw new NoteLocationError();
                            inserted = true; return next;
                        });
                    } catch (error) {
                        if (preparedHere && error.code === "NOTE_INSERTION_CONFLICT" && !inserted) {
                            // The synchronous transform refused the write. Re-read
                            // and revalidate before preparing another atomic attempt.
                            const { operation: previous, ...unprocessed } = capture;
                            capture = await this.replace(unprocessed); operation = null; preparedHere = false;
                            if (attempt < 2) continue;
                        }
                        throw error;
                    }
                }
                if (digest(await this.app.vault.read(file)) !== operation.afterHash) {
                    throw Error("The destination note changed after insertion. The item has been kept in Inbox for a safe retry.");
                }
                if (inserted) {
                    this.plugin.markProjectChangedByPath?.(file.path);
                    this.plugin.scheduleEditedActivity?.(file);
                    this.plugin.notifyProjectFilesChanged?.(file.path);
                }
                if (operation.state !== "ready") capture = await this.replace({ ...this.required(capture.id), operation: { ...operation, state: "ready" } });
                await this.finish(capture);
                return { file, message: "Text added to note." };
            }
        } catch (error) {
            if (error.code === "NOTE_LOCATION_INVALID" && !operation) {
                // No note write has happened. Persist the incomplete state so
                // Inbox cannot offer the stale location after a restart.
                const current = this.required(capture.id);
                try { await this.replace({ ...current, intent: { ...current.intent, noteAction: "existing", noteLocation: null } }); }
                catch (_) { /* Retain the original item if invalidation cannot be saved. */ }
                error.noteLocationInvalid = true;
            }
            error.captureId = capture.id; throw error;
        }
    }
    addFiles(values, captureId) { return this.enqueue(() => { this.assertBulkAccess(captureId, values.bulkBatchId); return this.resolveFiles("files", values, captureId); }); }
    async resolveFiles(kind, values, captureId) {
        let capture = captureId ? this.required(captureId) : await this.createCapture({ ...values, type: kind === "files" ? "file" : "note" });
        values = { ...capture.intent, ...values, type: kind === "files" ? "file" : "note" };
        try {
            if (capture.intent && !(capture.text.trim() && capture.attachments.length) && !values.folder) throw Error("Choose a folder.");
            let operation = capture.operation;
            if (operation?.state === "done") operation = null;
            if (operation && operation.kind !== kind) throw Error("Retry the saved action before choosing another action for this item.");
            if (operation) this.assertInput(capture, values);
            if (operation && this.changedFileDestination(operation, values)) {
                this.fileOperationStructure(operation);
                if (operation.state === "ready") throw Error("This item was already saved to its selected destination. Retry to finish removing it from Inbox.");
                this.destination(values);
                // A fully rolled-back file/note attempt can safely choose a new
                // destination after its old folder is removed while the form is open.
                await this.rollback(operation);
                for (const move of operation.moves) await this.checkMove(move, move.from);
                const { operation: previous, ...unprocessed } = capture;
                capture = await this.replace(unprocessed); operation = null;
            }
            if (!operation) {
                capture = await this.prepareCapture(capture, values);
                operation = await this.prepareFiles(capture, kind, values); capture = await this.replace({ ...capture, operation });
            }
            // Reject old or forged root receipts before running rollback or
            // writing anything, preserving already-existing user files.
            this.fileOperationDestination(operation);
            if (operation.state !== "ready") {
                try {
                    operation = await this.executeFiles(operation, capture);
                    capture = this.required(capture.id);
                    capture = await this.replace({ ...capture, operation: { ...operation, state: "ready" } });
                } catch (error) {
                    try { await this.rollback(this.get(capture.id)?.operation ?? operation); }
                    catch (rollbackError) { error.message += " " + rollbackError.message; }
                    throw error;
                }
            } else {
                this.fileOperationDestination(operation);
                for (const move of operation.moves) await this.checkMove(move, move.to);
                if (operation.note) {
                    const note = this.app.vault.getAbstractFileByPath(operation.note.path);
                    if (!note || isFolderLike(note) || digest(await this.app.vault.read(note)) !== operation.note.hash) {
                        throw Error("The destination note changed or was removed. The item has been kept in Inbox.");
                    }
                }
            }
            const file = operation.note ? this.app.vault.getAbstractFileByPath(operation.note.path) : null;
            const files = operation.moves.map(move => this.app.vault.getAbstractFileByPath(move.to));
            await this.finish(capture);
            return kind === "note" ? { file, attachments: files } : { files, note: file };
        } catch (error) { error.captureId = capture.id; throw error; }
    }
    makeTask(values, captureId, attempt) { return this.enqueue(()=>{ this.assertBulkAccess(captureId, values.bulkBatchId); return require("./native-inbox-task").submit(this,values,captureId,attempt); }); }
}

Object.defineProperties(HubInboxService.prototype, Object.getOwnPropertyDescriptors(require("./quick-add-draft")));
Object.defineProperties(HubInboxService.prototype, Object.getOwnPropertyDescriptors(require("./inbox-bulk")));
module.exports = { HubInboxService };
