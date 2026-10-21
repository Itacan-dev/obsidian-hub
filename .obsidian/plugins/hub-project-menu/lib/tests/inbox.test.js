"use strict";

const assert = require("assert/strict");
const nodePath = require("path");
const { randomUUID, createHash } = require("crypto");
const { HubInboxService } = require("../services/inbox");
const { HubTaskEditor } = require("../services/task-editor");
const { captureKind, linkFromText, sortedCaptures, isInboxOwned, captureIntent, captureDraft, captureNoteTitle,
    inboxCounts, INBOX_SORTS } = require("../domain/inbox");
const { parseNotePositions } = require("../domain/note-insertion");

function fixture(saved = {}) {
    const entries = new Map(), content = new Map(), calls = { creates: [], moves: [], deletes: [], tasks: [], edits: [], activity: [], refresh: [], saves: 0 };
    const p = { projectId: "p1", name: "Project", root: "Projects/Project", path: "Projects/Project/Project.md", contextKind: "project", status: "active" };
    const r = { projectId: "resource:study", id: "study", name: "Knowledge", root: "Resources/Knowledge", path: "Resources/Knowledge/Knowledge.md", contextKind: "resource" };
    let disk = JSON.parse(JSON.stringify(saved)), failure = {};
    const folder = path => { const file = { path, name: path.split("/").at(-1), children: [], parent: entries.get(path.slice(0, path.lastIndexOf("/"))) }; entries.set(path, file); return file; };
    const add = (path, bytes) => {
        if (entries.has(path)) throw Error("File exists");
        const name = path.split("/").at(-1), file = { path, name, basename: name.replace(/\.[^.]+$/, ""), extension: name.includes(".") ? name.split(".").at(-1) : "",
            parent: entries.get(path.slice(0, path.lastIndexOf("/"))), stat: { size: Buffer.byteLength(bytes) } };
        entries.set(path, file); content.set(path, typeof bytes === "string" ? bytes : Buffer.from(bytes)); return file;
    };
    for (const path of ["Projects", p.root, p.root + "/Design", p.root + "/Design/Subfolder", p.root + "/Meta", p.root + "/Atlas", "Resources", r.root, r.root + "/Math"]) folder(path);
    add(p.path, "# Project\n"); add(r.path, "# Knowledge\n");
    const vault = { adapter: { getBasePath: () => nodePath.resolve("inbox-test-vault") },
        getAbstractFileByPath: path => entries.get(path), getAllLoadedFiles: () => [...entries.values()],
        getMarkdownFiles: () => [...entries.values()].filter(file => file.extension === "md"),
        createFolder: async path => folder(path),
        create: async (path, text) => { if (failure.note) throw Error("Note failure"); calls.creates.push(path); return add(path, text); },
        createBinary: async (path, bytes) => { if (failure.stage && calls.creates.length === failure.stage) throw Error("Import failure"); calls.creates.push(path); return add(path, Buffer.from(bytes)); },
        read: async file => String(content.get(file.path)), readBinary: async file => Buffer.from(content.get(file.path)),
        process: async (file, transform) => {
            if (failure.beforeProcess) { const action = failure.beforeProcess; failure.beforeProcess = null; action(file); }
            if (failure.process) throw Error("Process failure");
            const before = String(content.get(file.path)), next = transform(before); content.set(file.path, next);
            if (next !== before) calls.edits.push(file.path);
            if (failure.afterProcess) { failure.afterProcess = false; throw Error("Process response failure"); }
            return next;
        },
        delete: async file => { calls.deletes.push(file.path); entries.delete(file.path); content.delete(file.path); } };
    const wizard = { data: JSON.parse(JSON.stringify(saved)), getProjectRecords: () => [p], getResourceTypes: () => [r],
        getContextForPath: path => [p, r].find(workspace => path === workspace.root || path.startsWith(workspace.root + "/")),
        recordTaskMutation: async edit => { calls.tasks.push(edit); return true; } };
    const plugin = { app: { vault, workspace: { getLeaf: () => ({ openFile: async () => {} }) }, fileManager: {
        generateMarkdownLink: file => `[[${file.path}]]`,
        renameFile: async (file, path) => {
            if (failure.move && calls.moves.length + 1 === failure.move) { failure.move = 0; throw Error("Move failure"); }
            if (entries.has(path)) throw Error("Destination exists");
            const bytes = content.get(file.path); entries.delete(file.path); content.delete(file.path);
            calls.moves.push({ from: file.path, to: path }); file.path = path; file.name = path.split("/").at(-1);
            file.parent = entries.get(path.slice(0, path.lastIndexOf("/"))); entries.set(path, file); content.set(path, bytes);
        } } }, projectWizard: wizard, enqueueTaskMutation: work => work(), markProjectChangedByPath() {},
        notifyCompletedTasksChanged() {}, taskData: { invalidate() {}, currentPath: path => path },
        dataStore: { save: async data => { calls.saves++; if (failure.save && failure.save(data, calls.saves)) throw Error("Save failure"); disk = JSON.parse(JSON.stringify(data)); } } };
    plugin.taskEditor = new HubTaskEditor(plugin);
    plugin.scheduleEditedActivity = file => calls.activity.push(file.path);
    plugin.notifyProjectFilesChanged = path => calls.refresh.push(path);
    const service = new HubInboxService(plugin);
    return { plugin, service, p, r, entries, content, calls, add, folder, failure, disk: () => disk,
        reload: () => { wizard.data = JSON.parse(JSON.stringify(disk)); return new HubInboxService(plugin); } };
}
function source(name, text = "binary", type = "application/octet-stream", path) {
    return { name, type, size: Buffer.byteLength(text), ...(path ? { path } : {}),
        arrayBuffer: async () => Buffer.from(text), text: async () => text };
}

// Persist the shape written by earlier versions directly. New captures now
// enforce separate text/file paths, while these legacy entries stay usable.
async function legacyCapture(service, values) {
    const capture = { id: randomUUID(), createdAt: Date.now(), text: values.text ?? "", attachments: values.attachments ?? [],
        kind: captureKind(values.text, values.attachments), source: values.source ?? {} };
    await service.save([...service.captures, capture]); return capture;
}

async function projectDestinationSafety() {
    const f = fixture(), workspace = f.service.workspace("p1");
    const loose = f.add(f.p.root + "/Loose.md", "# Existing root note\n");
    const existing = f.add(f.p.root + "/Meta/Tasks.md", "# Existing Tasks\n");
    assert.ok(!f.service.folders("p1").some(folder => folder.path === f.p.root), "Project root is not a folder destination");
    assert.ok(f.service.folders("p1").some(folder => folder.path === f.p.root + "/Design/Subfolder"), "Real workspace descendants remain selectable");
    assert.ok(f.service.folders("resource:study").some(folder => folder.path === f.r.root), "Resource root retains existing semantics");
    assert.ok(f.plugin.taskEditor.locations(f.p.root).some(location => location.path === f.p.root), "Normal task editor semantics are untouched");
    assert.ok(!f.service.taskLocations("p1").some(location => location.path === f.p.root || location.path === loose.path || location.path === f.p.path), "Capture tasks cannot target Project root or loose root notes");
    assert.ok(f.service.taskLocations("p1").some(location => location.path === existing.path), "Existing Tasks notes inside workspace folders remain selectable");
    assert.ok(f.service.taskLocations("resource:study").some(location => location.path === f.r.root));
    assert.equal(f.service.workspacePath(f.p.root, workspace), false);
    assert.equal(f.service.workspacePath(f.p.root + "/Meta", workspace), true);
    const refs = await f.service.stageFiles([source("Paper.pdf", "pdf bytes")]);
    const capture = await legacyCapture(f.service, { text: "Preserved capture", attachments: refs });
    const creates = f.calls.creates.length, moves = f.calls.moves.length;
    for (const folder of [undefined, "", "/", f.p.root, f.p.root + "/", f.p.root + "/Design/..", f.p.root + "/Design/Subfolder/../.."]) {
        await assert.rejects(() => f.service.createNote({ workspaceId: "p1", folder, title: "Invalid" }, capture.id), /workspace folder|folder is no longer/);
        await assert.rejects(() => f.service.addFiles({ workspaceId: "p1", folder }, capture.id), /workspace folder|folder is no longer/);
        assert.equal(f.service.get(capture.id).text, "Preserved capture"); assert.ok(f.service.attachmentExists(refs[0]));
    }
    for (const location of [f.p.root, f.p.path, loose.path, f.p.root + "/Design/../Loose.md"]) {
        await assert.rejects(() => f.service.makeTask({ workspaceId: "p1", location, taskTitle: "Root task" }, capture.id), /workspace folder|task workspace/);
    }
    assert.equal(f.calls.creates.length, creates); assert.equal(f.calls.moves.length, moves, "Invalid roots cannot create or move file-backed content programmatically");
    assert.equal(String(f.content.get(loose.path)), "# Existing root note\n");
    await f.service.createNote({ workspaceId: "p1", folder: f.p.root + "/Design/Subfolder", title: "Valid" }, capture.id);
    assert.ok(f.entries.has(f.p.root + "/Design/Subfolder/Valid.md")); assert.ok(f.entries.has(f.p.root + "/Design/Subfolder/Paper.pdf"));
    const taskCapture = await f.service.capture({ text: "Task in Meta" });
    await f.service.makeTask({ workspaceId: "p1", location: existing.path, taskTitle: "Task in Meta" }, taskCapture.id);
    assert.ok(String(f.content.get(existing.path)).includes("Task in Meta")); assert.equal(f.calls.tasks.length, 1);
    const resourceCapture = await f.service.capture({ text: "Resource root note" });
    await f.service.createNote({ workspaceId: "resource:study", title: "Resource root note" }, resourceCapture.id);
    assert.ok(f.entries.has(f.r.root + "/Resource root note.md"));
    const resourceTask = await f.service.capture({ text: "Resource root task" });
    await f.service.makeTask({ workspaceId: "resource:study", location: f.r.root, taskTitle: "Resource root task" }, resourceTask.id);
    assert.ok(String(f.content.get(f.r.root + "/Tasks.md")).includes("Resource root task"));
    const removed = await f.service.capture({ text: "Keep after folder removal" });
    f.entries.delete(f.p.root + "/Design");
    assert.ok(!f.service.folders("p1").some(folder => folder.path.startsWith(f.p.root + "/Design/")), "Stale descendants of a removed workspace folder disappear from destinations");
    await assert.rejects(() => f.service.createNote({ workspaceId: "p1", folder: f.p.root + "/Design/Subfolder", title: "Gone" }, removed.id), /folder is no longer/);
    await assert.rejects(() => f.service.makeTask({ workspaceId: "p1", location: f.p.root + "/Design/Subfolder", taskTitle: "Gone" }, removed.id), /workspace folder/);
    assert.ok(f.service.get(removed.id));

    const legacy = fixture(), legacyCap = await legacy.service.capture({ text: "Legacy root capture" }), receiptId = randomUUID();
    const legacyText = `Legacy root capture\n\n<!-- itacan-capture:${receiptId} -->\n`;
    const legacyNote = legacy.add(legacy.p.root + "/Legacy.md", legacyText);
    for (const state of ["prepared", "ready"]) {
        const operation = { id: receiptId, kind: "note", state, workspaceId: "p1", folder: legacy.p.root, title: "Legacy", moves: [],
            note: { path: legacyNote.path, text: legacyText, hash: createHash("sha256").update(legacyText).digest("hex") }, input: legacy.service.input(legacyCap, {}) };
        await legacy.service.replace({ ...legacyCap, operation });
        const deleted = legacy.calls.deletes.length;
        await assert.rejects(() => legacy.service.createNote({ workspaceId: "p1", folder: legacy.p.root, title: "Legacy" }, legacyCap.id), /Project root is not a destination/);
        await assert.rejects(() => legacy.service.createNote({ workspaceId: "p1", folder: legacy.p.root + "/Meta", title: "Legacy" }, legacyCap.id), /Project root is not a destination/);
        assert.equal(legacy.calls.deletes.length, deleted); assert.equal(String(legacy.content.get(legacyNote.path)), legacyText, "Invalid legacy receipts do not delete existing user data");
        assert.ok(legacy.service.get(legacyCap.id));
    }
    const forged = { ...legacy.service.get(legacyCap.id).operation, folder: legacy.p.root + "/Meta" };
    await legacy.service.replace({ ...legacyCap, operation: forged });
    await assert.rejects(() => legacy.service.createNote({ workspaceId: "p1", folder: legacy.p.root + "/Meta", title: "Legacy" }, legacyCap.id), /invalid workspace destination/);
    assert.ok(legacy.entries.has(legacyNote.path));
    await legacy.service.replace({ ...legacyCap, operation: { ...forged, state: "prepared", folder: legacy.p.root } });
    const beforeDelete = legacy.calls.deletes.length;
    await legacy.service.delete(legacyCap.id);
    assert.equal(legacy.calls.deletes.length, beforeDelete); assert.equal(String(legacy.content.get(legacyNote.path)), legacyText, "Deleting an invalid legacy Capture leaves its existing output user note untouched");
    const legacyTask = await legacy.service.capture({ text: "Legacy task" });
    await legacy.service.replace({ ...legacyTask, operation: { id: randomUUID(), kind: "task", state: "ready", workspaceId: "p1", location: legacy.p.root,
        text: "Legacy task", taskId: randomUUID(), values: {}, input: legacy.service.input(legacyTask, {}) } });
    await assert.rejects(() => legacy.service.makeTask({ location: legacy.p.root, taskTitle: "Legacy task" }, legacyTask.id), /Project root is not a destination/);
    assert.ok(!legacy.entries.has(legacy.p.root + "/Tasks.md")); assert.ok(legacy.service.get(legacyTask.id));

    const drift = fixture(), driftCapture = await drift.service.capture({ text: "Moved during retry" });
    drift.failure.save = data => !data.inbox.captures.some(item => item.id === driftCapture.id);
    await assert.rejects(() => drift.service.makeTask({ workspaceId: "p1", location: drift.p.root + "/Meta", taskTitle: "Moved during retry" }, driftCapture.id), /Save failure/);
    drift.failure.save = null;
    const taskFile = drift.entries.get(drift.p.root + "/Meta/Tasks.md");
    await drift.plugin.app.fileManager.renameFile(taskFile, drift.p.root + "/MovedTask.md");
    await assert.rejects(() => drift.service.makeTask({ location: drift.p.root + "/Meta", taskTitle: "Moved during retry" }, driftCapture.id), /Project root is not a destination/);
    assert.ok(drift.service.get(driftCapture.id)); assert.ok(String(drift.content.get(taskFile.path)).includes("Moved during retry"));

    const reroute = fixture(), rerouteRefs = await reroute.service.stageFiles([source("Rerouted.pdf", "pdf")]);
    const rerouteCap = await legacyCapture(reroute.service, { text: "Preserved reroute", attachments: rerouteRefs });
    reroute.failure.note = true;
    await assert.rejects(() => reroute.service.createNote({ workspaceId: "p1", folder: reroute.p.root + "/Atlas", title: "Rerouted" }, rerouteCap.id), /Note failure/);
    reroute.failure.note = false; reroute.entries.delete(reroute.p.root + "/Atlas");
    assert.ok(reroute.service.attachmentExists(rerouteRefs[0]), "The failed operation already restored its source copy");
    await reroute.service.createNote({ workspaceId: "p1", folder: reroute.p.root + "/Meta", title: "Rerouted" }, rerouteCap.id);
    assert.equal(reroute.service.count, 0); assert.ok(reroute.entries.has(reroute.p.root + "/Meta/Rerouted.md"));
    assert.ok(reroute.entries.has(reroute.p.root + "/Meta/Rerouted.pdf"), "A removed old workspace folder does not block a verified fully rolled-back operation from selecting a new folder");
}

async function structuredContinuation() {
    const f = fixture();
    const untyped = await f.service.capture({ text: "An undecided thought" });
    assert.equal(untyped.intent, undefined);
    assert.equal(captureDraft(f.reload().get(untyped.id)).type, undefined, "Old-style plain text is still neutral");
    assert.equal(captureDraft({ taskTitle: "Legacy title" }).text, "Legacy title");
    assert.equal(captureIntent({ type: "task", text: "No duplicate", arbitrary: "ignored", milestoneId: "not a task model" }).text, undefined);
    assert.equal(captureIntent({ type: "task", milestoneId: "unsupported" }).milestoneId, undefined);

    const partialTask = await f.service.capture({ text: "Read the paper", type: "task", workspaceId: "p1", location: "", necessity: "must",
        fromDate: "2026-10-03", fromTime: "09:15", dueDate: "2026-10-04", dueTime: "17:30",
        steps: [{ text: "Check the derivation", completed: false }], phaseId: "phase-1", binary: "ignored" });
    assert.equal(partialTask.intent.inputPath, "text"); assert.equal(partialTask.intent.type, "task");
    assert.equal(partialTask.intent.text, undefined); assert.equal(partialTask.intent.binary, undefined);
    assert.equal(captureDraft(f.reload().get(partialTask.id)).phaseId, "phase-1", "An existing phase decision survives reload");
    assert.deepEqual(captureDraft(f.reload().get(partialTask.id)).steps, [{ text: "Check the derivation", completed: false }]);
    assert.equal(f.service.completion(captureDraft(partialTask)).complete, false);
    await f.service.updateCapture(partialTask.id, { phaseId: "", location: f.p.root + "/Design" });
    const taskDraft = captureDraft(f.reload().get(partialTask.id));
    assert.equal(taskDraft.workspaceId, "p1"); assert.equal(taskDraft.necessity, "must"); assert.equal(taskDraft.dueTime, "17:30");
    assert.equal(f.service.completion(taskDraft).complete, true, "Optional enrichments are not required for a routed Task");
    assert.equal(f.service.completion({ ...taskDraft, workspaceId: "" }).complete, false);
    assert.equal(f.service.completion({ ...taskDraft, location: f.p.root }).complete, false);
    assert.equal(f.service.completion({ ...taskDraft, text: "" }).complete, false);
    assert.equal(f.service.completion({ ...taskDraft, necessity: null, fromDate: null, fromTime: null, dueDate: null, dueTime: null, steps: [] }).complete, true);
    f.failure.save = data => !data.inbox.captures.some(capture => capture.id === partialTask.id);
    await assert.rejects(() => f.service.makeTask(taskDraft, partialTask.id), /Save failure/);
    assert.equal(f.service.get(partialTask.id).intent.dueTime, "17:30", "Failure retains partial intent");
    const taskText = f.content.get(f.p.root + "/Design/Tasks.md"), mutations = f.calls.tasks.length;
    f.failure.save = null;
    const taskReload = f.reload();
    await taskReload.makeTask(captureDraft(taskReload.get(partialTask.id)), partialTask.id);
    assert.equal(taskReload.get(partialTask.id), null); assert.equal(f.content.get(f.p.root + "/Design/Tasks.md"), taskText);
    assert.equal(f.calls.tasks.length, mutations, "Reloaded continuation retries one canonical Task");
    const taskMetadata = Object.values(f.plugin.projectWizard.data.taskMetadata).find(value => value.necessity === "must");
    assert.equal(taskMetadata.fromTime, "09:15"); assert.equal(taskMetadata.dueTime, "17:30");
    assert.ok(String(taskText).includes("Check the derivation"));
    const linked = await taskReload.capture({ text: "Compare the result", type: "task", workspaceId: "resource:study", linkedProjectId: "p1" });
    assert.equal(captureDraft(f.reload().get(linked.id)).linkedProjectId, undefined);
    await taskReload.makeTask({ location: f.r.root }, linked.id);
    assert.equal(taskReload.get(linked.id), null);
    assert.ok(Object.values(f.plugin.projectWizard.data.taskMetadata).every(value => value.linkedProjectId === undefined), "Retired Resource association never enters canonical task metadata");

    const note = await taskReload.capture({ text: "The captured note body", type: "note", workspaceId: "p1", title: "Paper notes" });
    const noteDraft = captureDraft(f.reload().get(note.id));
    assert.equal(noteDraft.type, "note"); assert.equal(noteDraft.title, "Paper notes"); assert.equal(noteDraft.text, "The captured note body");
    assert.equal(taskReload.completion(noteDraft).complete, false);
    await taskReload.updateCapture(note.id, { folder: f.p.root + "/Design", title: "Edited title" });
    const completedNote = captureDraft(f.reload().get(note.id));
    assert.equal(taskReload.completion(completedNote).complete, true);
    assert.equal(taskReload.completion({ ...completedNote, title: "" }).complete, false);
    assert.equal(taskReload.completion({ ...completedNote, text: "" }).complete, false);
    assert.equal(taskReload.completion({ ...completedNote, folder: f.p.root }).complete, false);
    const beforeInvalidNotes = f.calls.creates.length;
    for (const title of [".", "..", ".md", "..md", "...md", " ..MD ", "Bad\nTitle", "Bad\rTitle", "Bad\u0000Title", "Bad\u001fTitle", "Bad\tTitle", " ", "folder/title", "Bad:Title"]) {
        assert.throws(() => captureNoteTitle(title));
        assert.equal(taskReload.completion({ ...completedNote, title }).complete, false, "Invalid note titles do not enable direct creation");
        await assert.rejects(() => taskReload.createNote({ ...completedNote, title }, note.id));
        assert.ok(taskReload.get(note.id), "Rejected titles leave the Capture in Inbox");
    }
    assert.equal(f.calls.creates.length, beforeInvalidNotes, "Invalid note titles cannot create files programmatically");
    assert.equal(captureNoteTitle("  Paper notes.md  "), "Paper notes.md");
    f.failure.note = true;
    await assert.rejects(() => taskReload.createNote(completedNote, note.id), /Note failure/);
    assert.equal(taskReload.get(note.id).intent.title, "Edited title"); assert.equal(taskReload.get(note.id).text, note.text);
    f.failure.note = false;
    await taskReload.createNote(completedNote, note.id);
    assert.equal(taskReload.get(note.id), null); assert.ok(f.entries.has(f.p.root + "/Design/Edited title.md"));

    const attachments = await taskReload.stageFiles([source("One.pdf", "one"), source("Two.pdf", "two")]);
    const file = await taskReload.capture({ attachments, workspaceId: "p1" });
    assert.equal(file.intent.type, "file"); assert.equal(file.intent.inputPath, "file");
    assert.equal(captureDraft(f.reload().get(file.id)).attachments.length, 2);
    assert.equal(taskReload.completion(captureDraft(file)).complete, false);
    await taskReload.updateCapture(file.id, { folder: f.p.root + "/Design" });
    const fileDraft = captureDraft(f.reload().get(file.id));
    assert.equal(taskReload.completion(fileDraft).complete, true, "A File requires no title or text");
    assert.equal(taskReload.completion({ ...fileDraft, attachments: [] }).complete, false);
    assert.equal(taskReload.completion({ ...fileDraft, folder: f.p.root }).complete, false);
    assert.equal(taskReload.completion({ ...fileDraft, workspaceId: "resource:study", folder: "" }).complete, false);
    const count = taskReload.count;
    await assert.rejects(() => taskReload.capture({ text: "Do not lose this", attachments }), /Write something or add a file/);
    await assert.rejects(() => taskReload.updateCapture(untyped.id, { attachments }), /Write something or add a file/);
    assert.equal(taskReload.get(untyped.id).text, untyped.text); assert.equal(taskReload.count, count);
    await taskReload.addFiles(fileDraft, file.id);
    assert.equal(taskReload.get(file.id), null); assert.ok(f.entries.has(f.p.root + "/Design/One.pdf"));
    assert.ok(f.entries.has(f.p.root + "/Design/Two.pdf"));
    assert.equal(taskReload.count, 1, "Only the undecided text remains in Inbox");
}

async function taskWhitespaceRetries() {
    for (const reload of [false, true]) {
        const f = fixture();
        const draft = { text: "  Read the paper  ", type: "task", workspaceId: "p1", location: f.p.root + "/Design",
            necessity: "should", dueDate: "2026-10-04", dueTime: "10:30", steps: [{ text: "  Check the result  ", completed: false }] };
        const capture = await f.service.capture(draft);
        f.failure.save = data => !data.inbox.captures.some(item => item.id === capture.id);
        await assert.rejects(() => f.service.makeTask(draft, capture.id), /Save failure/);
        const saved = f.service.get(capture.id), taskFile = f.p.root + "/Design/Tasks.md", content = f.content.get(taskFile), mutations = f.calls.tasks.length;
        assert.equal(saved.text, draft.text, "Task canonicalization does not change the Capture's original input");
        assert.equal(saved.operation.text, "Read the paper");
        assert.equal(saved.operation.input.text, draft.text, "Retry receipt fingerprints the visible original input");
        assert.equal(captureDraft(saved).text, draft.text, "Continuation restores the original input, including surrounding whitespace");
        f.failure.save = null;
        const service = reload ? f.reload() : f.service;
        await service.makeTask(reload ? captureDraft(service.get(capture.id)) : draft, capture.id);
        assert.equal(service.get(capture.id), null);
        assert.equal(f.content.get(taskFile), content); assert.equal(f.calls.tasks.length, mutations,
            (reload ? "Reloaded" : "Same form") + " whitespace retry cannot duplicate a canonical task");
    }
}

async function persistentCaptureEdits() {
    const f = fixture();
    const sourceMeta = { origin: "Quick Add", path: "Home.md", pageUrl: "https://example.org/source" };
    const capture = await f.service.capture({ text: "First line\nSecond line", source: sourceMeta });
    await Promise.all([f.service.updateCapture(capture.id, { text: "First edit" }), f.service.updateCapture(capture.id, { text: "Final edit\nBoth lines remain" })]);
    assert.equal(f.reload().get(capture.id).text, "Final edit\nBoth lines remain", "Serialized edits persist the latest canonical content");
    await f.service.updateCapture(capture.id, { type: "task", intent: { type: "task", inputPath: "text" } });
    assert.equal(f.reload().get(capture.id).intent.type, "task", "Classifying multiline unsorted text persists Task intent immediately");
    assert.deepEqual(f.service.get(capture.id).source, sourceMeta, "Editing/classifying keeps source metadata internally");
    await f.service.updateCapture(capture.id, { text: "", necessity: "must", steps: [{ text: "", completed: false }] });
    const empty = captureDraft(f.reload().get(capture.id));
    assert.equal(empty.text, "", "Clearing an existing item persists without deleting it");
    assert.equal(empty.necessity, "must"); assert.equal(empty.steps[0].text, "");
    assert.equal(f.service.completion(empty).complete, false, "Incomplete optional edits never enable creation");
    f.failure.save = () => true;
    await assert.rejects(() => f.service.updateCapture(capture.id, { text: "Keep this edit" }), /Save failure/);
    assert.equal(f.service.get(capture.id).text, "", "Failed autosave retains the last persisted Capture");
    f.failure.save = null;
    await f.service.updateCapture(capture.id, { text: "Keep this edit", workspaceId: "p1", location: f.p.root + "/Design" });
    assert.equal(f.reload().get(capture.id).text, "Keep this edit", "A failed edit can be retried without losing the Capture");

    const refs = await f.service.stageFiles([source("Reroute.pdf")]);
    const file = await f.service.capture({ attachments: refs, workspaceId: "p1", folder: f.p.root + "/Design" });
    f.failure.move = f.calls.moves.length + 1;
    await assert.rejects(() => f.service.addFiles(captureDraft(file), file.id), /Move failure/);
    await f.service.updateCapture(file.id, { workspaceId: "resource:study", folder: f.r.root + "/Math" });
    const restored = f.reload(), fileDraft = captureDraft(restored.get(file.id));
    assert.equal(fileDraft.workspaceId, "resource:study"); assert.equal(fileDraft.folder, f.r.root + "/Math", "Prepared File routing edits survive reload");
    await restored.addFiles(fileDraft, file.id);
    assert.ok(f.entries.has(f.r.root + "/Math/Reroute.pdf")); assert.equal(restored.get(file.id), null);
}

async function run() {
    await inboxOrganisation();
    await persistentCaptureEdits();
    await taskWhitespaceRetries();
    await structuredContinuation();
    await projectDestinationSafety();
    assert.equal(captureKind("hello"), "text"); assert.equal(captureKind("https://example.com/article"), "link");
    assert.equal(captureKind("url https://example.com"), "text"); assert.equal(linkFromText("javascript:alert(1)"), null);
    assert.equal(captureKind("", [{ name: "Image.png" }]), "image"); assert.equal(captureKind("", [{ name: "Paper.pdf" }]), "file");
    assert.equal(isInboxOwned({ path: "Projects/Paper.pdf", ownership: "inbox" }), false);
    const f = fixture({ oldSetting: true });
    assert.equal(f.service.count, 0); assert.equal(f.calls.saves, 0, "Old data needs no migration write");
    await assert.rejects(() => f.service.capture({ text: " " }), /some text/);
    let notifications = 0; f.service.onChange(() => notifications++);
    const text = await f.service.capture({ text: "Thought\nSecond line", source: { origin: "Quick Add", pageTitle: "Paper", pageUrl: "https://example.com/paper", binary: "not persisted" } });
    assert.equal(f.service.count, 1); assert.equal(notifications, 1);
    assert.equal(f.disk().oldSetting, true); assert.ok(!f.disk().inbox.captures[0].source.binary);
    assert.equal(f.reload().get(text.id).text, "Thought\nSecond line", "Capture survives reload");
    f.failure.save = () => true;
    await assert.rejects(() => f.service.delete(text.id), /Save failure/); assert.equal(f.service.count, 1);
    f.failure.save = null; await f.service.delete(text.id); assert.equal(f.service.count, 0);
    const refs = await f.service.stageFiles([source("figure.png", "image bytes", "image/png", "C:/original/figure.png"), source("figure.png", "second image", "image/png"), source("Note.md", "# Imported Markdown\n", "text/markdown")]);
    assert.equal(refs.length, 3); assert.ok(refs.every(isInboxOwned)); assert.ok(refs[1].path.endsWith("figure 2.png"));
    assert.equal(String(f.content.get(refs[2].path)), "# Imported Markdown\n");
    const files = await legacyCapture(f.service, { text: "Attached content", attachments: refs });
    assert.ok(!JSON.stringify(f.disk()).includes("image bytes"), "Binary data is never embedded in settings JSON");
    f.failure.save = () => true; await assert.rejects(() => f.service.delete(files.id), /Save failure/);
    assert.ok(f.entries.has(refs[0].path)); f.failure.save = null;
    await f.service.releaseAttachments(refs); assert.ok(f.entries.has(refs[0].path), "Draft cleanup retains saved attachment copies");
    await f.service.delete(files.id); assert.ok(!f.entries.has(refs[0].path));
    assert.ok(!f.calls.deletes.includes("C:/original/figure.png"), "Deleting a Capture never deletes original external files");
    const original = f.add(f.r.root + "/Original.pdf", "original bytes");
    const reference = (await f.service.stageFiles([source("Original.pdf", "original bytes", "application/pdf", nodePath.join(f.plugin.app.vault.adapter.getBasePath(), ...original.path.split("/")))]))[0];
    assert.equal(reference.ownership, "reference");
    const refCapture = await f.service.capture({ attachments: [reference] }); await f.service.delete(refCapture.id);
    assert.ok(f.entries.has(original.path), "Deleting a vault reference preserves its source");
    await assert.rejects(() => f.service.capture({ attachments: [{ ...reference, ownership: "inbox" }] }), /staging path/);
    const importFailure = fixture(); importFailure.failure.stage = 1;
    await assert.rejects(() => importFailure.service.stageFiles([source("One.pdf"), source("Two.pdf")]), /Import failure/);
    assert.equal(importFailure.calls.deletes.length, 1, "A failed batch removes only its own newly imported copy");
    assert.ok(![...importFailure.entries.keys()].some(path => path.endsWith(".pdf")), "A failed multi-file import cannot silently keep only the first attachment");
    const many = Array.from({ length: 50000 }, (_, i) => ({ id: "c" + i, createdAt: i, text: "Long text ".repeat(10), attachments: i % 2 ? [reference] : [] }));
    assert.equal(sortedCaptures(many)[0].createdAt, 49999); assert.equal(sortedCaptures(many, { filter: "files" }).length, 25000);
    assert.equal(sortedCaptures(many, { filter: "text", sort: "oldest" })[0].createdAt, 0);

    const n = fixture();
    assert.equal(n.service.destinations().length, 2); assert.ok(n.service.folders("p1").some(folder => folder.path.endsWith("Design")));
    n.add(n.p.root + "/Design/Idea.md", "Existing note");
    const noteCapture = await n.service.capture({ text: "Original thought", source: { pageTitle: "Research paper", pageUrl: "https://example.com/paper" } });
    const note = await n.service.createNote({ workspaceId: "p1", folder: n.p.root + "/Design", title: "Idea", text: "Edited thought" }, noteCapture.id);
    assert.ok(note.file.path.endsWith("Idea 2.md")); assert.equal(n.service.count, 0); assert.ok(String(n.content.get(note.file.path)).includes("Edited thought"));
    assert.ok(String(n.content.get(note.file.path)).includes("Research paper"));
    assert.equal(String(n.content.get(n.p.root + "/Design/Idea.md")), "Existing note");
    const imageRefs = await n.service.stageFiles([source("Image.png", "pixels", "image/png"), source("Paper.pdf", "pdf bytes", "application/pdf")]);
    const imageCapture = await legacyCapture(n.service, { text: "Text and files", attachments: imageRefs });
    n.failure.move = n.calls.moves.length + 2;
    await assert.rejects(() => n.service.createNote({ workspaceId: "resource:study", folder: n.r.root + "/Math", title: "Research" }, imageCapture.id), /Move failure/);
    assert.equal(n.service.count, 1); assert.ok(imageRefs.every(ref => n.entries.has(ref.path)), "Partial file moves roll back without resolving the Capture");
    const imageNote = await n.service.createNote({ workspaceId: "resource:study", folder: n.r.root + "/Math", title: "Research" }, imageCapture.id);
    assert.equal(imageNote.attachments.length, 2); assert.equal(n.service.count, 0);
    assert.ok(imageRefs.every(ref => !n.entries.has(ref.path)), "Owned attachments transfer via move, with no duplicate staging file");
    assert.ok(String(n.content.get(imageNote.file.path)).includes("![[Resources/Knowledge/Math/Image.png]]"));
    assert.ok(String(n.content.get(imageNote.file.path)).includes("[[Resources/Knowledge/Math/Paper.pdf]]"));
    const failed = await n.service.capture({ text: "A new note" });
    n.failure.note = true; await assert.rejects(() => n.service.createNote({ workspaceId: "p1", folder: n.p.root + "/Meta", title: "Fail" }, failed.id), /Note failure/);
    n.failure.note = false; assert.equal(n.service.get(failed.id).text, "A new note");
    await n.service.delete(failed.id);
    const removed = await n.service.capture({ text: "Missing destination" });
    n.entries.delete(n.p.root + "/Design");
    await assert.rejects(() => n.service.createNote({ workspaceId: "p1", folder: n.p.root + "/Design", title: "Lost" }, removed.id), /folder is no longer/);
    assert.ok(n.service.get(removed.id));
    await n.service.delete(removed.id);
    const reroute = await n.service.capture({ text: "Reroutable note" });
    n.failure.note = true;
    await assert.rejects(() => n.service.createNote({ workspaceId: "p1", folder: n.p.root + "/Meta", title: "Reroute" }, reroute.id), /Note failure/);
    n.failure.note = false;
    await n.service.createNote({ workspaceId: "resource:study", folder: n.r.root + "/Math", title: "Rerouted" }, reroute.id);
    assert.ok(n.entries.has(n.r.root + "/Math/Rerouted.md"), "A rolled-back note can select a new available destination");
    const contested = await legacyCapture(n.service, { text: "Our note", attachments: await n.service.stageFiles([source("Contest.pdf", "pdf")]) });
    n.failure.note = true;
    await assert.rejects(() => n.service.createNote({ workspaceId: "p1", folder: n.p.root + "/Meta", title: "Contested" }, contested.id), /Note failure/);
    n.failure.note = false;
    const competingPath = n.service.get(contested.id).operation.note.path;
    n.add(competingPath, "A user's independently created note");
    await assert.rejects(() => n.service.createNote({ workspaceId: "p1", folder: n.p.root + "/Meta", title: "Contested" }, contested.id), /note changed/);
    assert.equal(String(n.content.get(competingPath)), "A user's independently created note", "Rollback cannot delete a competing user note");
    assert.ok(n.service.attachmentExists(contested.attachments[0]));
    await n.service.delete(contested.id);

    const retry = fixture();
    const staged = await retry.service.stageFiles([source("Paper.pdf", "pdf", "application/pdf")]);
    const capture = await retry.service.capture({ attachments: staged });
    retry.failure.save = data => data.inbox.captures.length === 0;
    await assert.rejects(() => retry.service.addFiles({ workspaceId: "p1", folder: retry.p.root + "/Design" }, capture.id), /Save failure/);
    assert.equal(retry.service.get(capture.id).operation.state, "ready"); assert.ok(retry.entries.has(retry.p.root + "/Design/Paper.pdf"));
    await assert.rejects(() => retry.service.addFiles({ workspaceId: "p1", text: "New content after failure", attachments: staged }, capture.id), /saved action to retry/);
    assert.equal(retry.service.get(capture.id).text, "", "A retry never silently discards a changed draft");
    const moveCount = retry.calls.moves.length, createCount = retry.calls.creates.length;
    retry.failure.save = null;
    const reloaded = retry.reload(); await reloaded.addFiles({ workspaceId: "p1", folder: retry.p.root + "/Design" }, capture.id);
    assert.equal(reloaded.count, 0); assert.equal(retry.calls.moves.length, moveCount); assert.equal(retry.calls.creates.length, createCount, "Retrying final removal never duplicates a destination file");
    const originalRef = { id: "reference-1", path: retry.p.root + "/Design/Paper.pdf", name: "Paper.pdf", ownership: "reference", size: 3, mime: "application/pdf" };
    const first = await reloaded.capture({ attachments: [originalRef] }), second = await reloaded.capture({ attachments: [{ ...originalRef, id: "reference-2" }] });
    await reloaded.addFiles({ workspaceId: "resource:study", folder: retry.r.root + "/Math" }, first.id);
    assert.equal(reloaded.get(second.id).attachments[0].path, retry.r.root + "/Math/Paper.pdf", "Other unresolved references follow a successful vault move");
    await reloaded.delete(second.id); assert.ok(retry.entries.has(retry.r.root + "/Math/Paper.pdf"));
    const sharedRefs = await reloaded.stageFiles([source("Shared.png", "image", "image/png")]);
    const sharedFirst = await reloaded.capture({ attachments: sharedRefs }), sharedSecond = await reloaded.capture({ attachments: sharedRefs });
    await reloaded.delete(sharedFirst.id);
    assert.ok(reloaded.attachmentExists(sharedRefs[0]), "Deleting a shared staged reference keeps the other Capture's owned copy");
    await reloaded.delete(sharedSecond.id); assert.ok(!retry.entries.has(sharedRefs[0].path));
    const readyNote = await legacyCapture(reloaded, { text: "Original ready note", attachments: await reloaded.stageFiles([source("Ready.pdf", "pdf")]) });
    retry.failure.save = data => !data.inbox.captures.some(item => item.id === readyNote.id);
    await assert.rejects(() => reloaded.createNote({ workspaceId: "p1", folder: retry.p.root + "/Design", title: "Ready" }, readyNote.id), /Save failure/);
    retry.failure.save = null;
    const readyOperation = reloaded.get(readyNote.id).operation, readyText = retry.content.get(readyOperation.note.path);
    retry.content.set(readyOperation.note.path, "Changed by the user");
    await assert.rejects(() => reloaded.createNote({ workspaceId: "p1", folder: retry.p.root + "/Design", title: "Ready" }, readyNote.id), /note changed or was removed/);
    assert.ok(reloaded.get(readyNote.id)); retry.content.set(readyOperation.note.path, readyText);
    const rootEntry = retry.entries.get(retry.p.root); retry.entries.delete(retry.p.root);
    await assert.rejects(() => reloaded.createNote({ workspaceId: "p1", title: "Ready" }, readyNote.id), /Project or Resource is no longer/);
    assert.ok(reloaded.get(readyNote.id)); retry.entries.set(retry.p.root, rootEntry);
    await reloaded.delete(readyNote.id);
    assert.ok(retry.entries.has(readyOperation.note.path) && retry.entries.has(readyOperation.moves[0].to), "Deleting a ready receipt preserves its successful destination note and files");

    const t = fixture();
    const taskCapture = await t.service.capture({ text: "Read the paper" });
    t.failure.save = data => data.inbox.captures.length === 0;
    await assert.rejects(() => t.service.makeTask({ location: t.p.root + "/Design", taskTitle: "Read the paper", necessity: "must", dueDate: "2026-10-03" }, taskCapture.id), /Save failure/);
    assert.equal(t.service.count, 1); const taskText = String(t.content.get(t.p.root + "/Design/Tasks.md")), taskEvents = t.calls.tasks.length;
    t.failure.save = null; const tasksReloaded = t.reload();
    await tasksReloaded.makeTask({ location: t.p.root + "/Design" }, taskCapture.id);
    assert.equal(tasksReloaded.count, 0); assert.equal(String(t.content.get(t.p.root + "/Design/Tasks.md")), taskText); assert.equal(t.calls.tasks.length, taskEvents, "Task retry creates no duplicate task or History event");
    const sourced = await tasksReloaded.capture({ text: "Follow the source", source: { origin: "Quick Add", path: t.p.path, workspaceName: "Project", pageTitle: "Paper", pageUrl: "https://example.com/paper" } });
    const sourcedTask = await tasksReloaded.makeTask({ location: t.p.root + "/Design", taskTitle: "Follow the source" }, sourced.id);
    assert.equal(sourcedTask.retained, false, "Source metadata alone does not keep a resolved plain-text Capture in Inbox");
    const sourceRecord = Object.values(t.plugin.projectWizard.data.taskMetadata).find(value => value.captureSource?.path === t.p.path);
    assert.ok(sourceRecord?.captureSource, "Canonical task metadata preserves Capture source metadata");
    const remainder = await legacyCapture(tasksReloaded, { text: "Read the paper\nRemember its derivation", attachments: await tasksReloaded.stageFiles([source("figure.png", "pixels", "image/png")]) });
    const partial = await tasksReloaded.makeTask({ location: t.r.root, taskTitle: "Read the paper" }, remainder.id);
    assert.equal(partial.retained, true); assert.equal(tasksReloaded.count, 1); assert.ok(tasksReloaded.attachmentExists(remainder.attachments[0]));
    assert.equal(tasksReloaded.get(remainder.id).text, remainder.text); assert.equal(tasksReloaded.get(remainder.id).operation.state, "done");
    await tasksReloaded.createNote({ workspaceId: "resource:study", folder: t.r.root, title: "Paper notes" }, remainder.id);
    assert.equal(tasksReloaded.count, 0);
    const directRefs = await tasksReloaded.stageFiles([source("missing.pdf", "pdf")]);
    const directLegacy = await legacyCapture(tasksReloaded, { text: "Direct thought", attachments: directRefs });
    t.failure.note = true;
    let error; try { await tasksReloaded.createNote({ workspaceId: "p1", folder: t.p.root + "/Design", title: "Direct", text: "Direct thought", attachments: directRefs }, directLegacy.id); } catch (caught) { error = caught; }
    assert.ok(error.captureId); assert.equal(tasksReloaded.get(error.captureId).text, "Direct thought"); assert.ok(tasksReloaded.attachmentExists(directRefs[0]));
    await tasksReloaded.releaseAttachments(directRefs); assert.ok(tasksReloaded.attachmentExists(directRefs[0]), "Closing a failed direct form cannot delete saved Capture data");
    t.failure.note = false;
    await tasksReloaded.updateCapture(error.captureId, { text: "Direct thought", attachments: directRefs });
    await tasksReloaded.delete(error.captureId); assert.equal(tasksReloaded.count, 0);
    console.log("Inbox persistence, staging, destination, rollback and retry tests passed.");
}

async function inboxOrganisation() {
    const f = fixture({ otherPreference: "keep" });
    assert.equal(f.service.sortPreference, "most-complete");
    assert.equal(f.calls.saves, 0, "The default Inbox sort needs no preference/migration write");
    assert.deepEqual(INBOX_SORTS.map(item => item[1]), ["Most complete", "Least complete", "Newest first", "Oldest first", "Item type"]);
    assert.deepEqual(inboxCounts(f.service.captures), { all: 0, text: 0, files: 0 });
    const inspect = (values, completed, total, ready = false) => {
        const state = f.service.completion(values);
        assert.equal(state.completedRequired, completed); assert.equal(state.totalRequired, total);
        assert.equal(state.ratio, total ? completed / total : 0);
        assert.equal(state.ready, ready); assert.equal(state.complete, ready, "Progress readiness is the existing submission validation result");
        assert.ok(state.missing.length >= (total ? total - completed : 1));
        if (!total) assert.deepEqual(state.missing, ["Type"]);
        return state;
    };
    const untyped = await f.service.capture({ text: "Classify me" });
    inspect(captureDraft(untyped), 0, 0);
    const task = { text: "Organise a Task", type: "task" };
    assert.deepEqual(inspect(task, 0, 2).missing, ["Workspace", "Location"], "Type selects the Task schema without earning a segment");
    const routedTask = { ...task, workspaceId: "p1", location: f.p.root + "/Design" };
    inspect({ ...routedTask, location: "" }, 1, 2);
    assert.deepEqual(inspect({ ...routedTask, location: "" }, 1, 2).missing, ["Location"]);
    inspect(routedTask, 2, 2, true);
    inspect({ ...routedTask, text: "" }, 2, 2);
    inspect({ ...routedTask, location: f.p.root }, 1, 2);
    for (const optional of [{ necessity: "must" }, { fromDate: "2026-10-03", fromTime: "00:00" },
        { dueDate: "2026-10-04", dueTime: "17:30" }, { steps: [{ text: "Optional action" }] }]) {
        inspect({ ...routedTask, ...optional }, 2, 2, true);
        inspect({ ...routedTask, location: "", ...optional }, 1, 2);
    }
    for (const invalidOptional of [{ steps: [{ text: "" }] }, { fromDate: "invalid" },
        { fromDate: "2026-10-04", dueDate: "2026-10-03" }]) {
        const state = inspect({ ...routedTask, ...invalidOptional }, 2, 2);
        assert.ok(state.error, "Invalid optional edits still block creation without adding progress requirements");
    }
    const note = { text: "Note content", type: "note", noteAction: "new" };
    assert.deepEqual(inspect(note, 1, 4).missing, ["Workspace", "Folder", "Title"], "New note counts Action plus its three required destination/title details");
    const newNote = { ...note, workspaceId: "p1", folder: f.p.root + "/Design", title: "New note" };
    inspect(newNote, 4, 4, true);
    inspect({ ...newNote, title: "" }, 3, 4);
    inspect({ ...newNote, folder: f.p.root }, 3, 4);
    inspect({ ...newNote, text: "" }, 4, 4);
    const path = f.p.root + "/Design/Existing.md";
    f.add(path, "# Heading\n\n- Item\n");
    const existingNote = { ...note, noteAction: "existing", workspaceId: "p1", title: "", folder: "" };
    inspect(existingNote, 2, 3);
    inspect({ ...existingNote, noteLocation: { path, targetType: "note", position: "end" } }, 3, 3, true);
    inspect({ ...existingNote, noteLocation: { path, targetType: "note" } }, 2, 3);
    const positions = await f.service.readNotePositions("p1", path);
    const heading = { path, targetType: "heading", anchor: positions.headings[0].anchor, position: "end" };
    inspect({ ...existingNote, noteLocation: heading }, 3, 3, true);
    inspect({ ...existingNote, noteLocation: { ...heading, anchor: "stale" } }, 2, 3);
    const refs = await f.service.stageFiles([source("Counts.pdf")]);
    const untypedFile = await f.service.capture({ attachments: await f.service.stageFiles([source("Unsorted.pdf")]) });
    inspect(captureDraft(untypedFile), 0, 0);
    assert.equal(untypedFile.intent, undefined, "Raw attachments do not silently establish an organisational type");
    await f.service.delete(untypedFile.id);
    const file = { type: "file", attachments: refs };
    inspect(file, 0, 2);
    inspect({ ...file, workspaceId: "p1" }, 1, 2);
    const routedFile = { ...file, workspaceId: "p1", folder: f.p.root + "/Design" };
    inspect(routedFile, 2, 2, true);
    inspect({ ...routedFile, attachments: [] }, 2, 2);
    inspect({ ...routedFile, attachments: [{ path: "Missing.pdf" }] }, 2, 2);
    f.plugin.oath = { canOpen: () => false };
    for (const values of [routedTask, newNote, routedFile]) assert.equal(f.service.completion(values).ready, false);
    delete f.plugin.oath;

    const captures = [untyped, await f.service.capture({ ...routedTask, location: "" }),
        await f.service.capture({ ...file, workspaceId: "p1" }), await f.service.capture(routedTask),
        await f.service.capture(newNote), await f.service.capture(routedFile)];
    const times = [10, 40, 30, 20, 60, 50];
    await f.service.save(captures.map((item, index) => ({ ...item, createdAt: times[index] })));
    const ids = options => f.service.list(options).map(item => item.id);
    assert.deepEqual(ids({ sort: "most-complete" }), [captures[3], captures[5], captures[4], captures[2], captures[1], captures[0]].map(item => item.id),
        "Task 1/2 and File 1/2 tie by oldest first, as do Ready items");
    assert.deepEqual(ids({ sort: "least-complete" }), [captures[0], captures[2], captures[1], captures[3], captures[5], captures[4]].map(item => item.id));
    assert.deepEqual(ids({ sort: "newest" }), [captures[4], captures[5], captures[1], captures[2], captures[3], captures[0]].map(item => item.id));
    assert.deepEqual(ids({ sort: "oldest" }), [captures[0], captures[3], captures[2], captures[1], captures[5], captures[4]].map(item => item.id));
    assert.deepEqual(ids({ sort: "type" }), [captures[0], captures[3], captures[1], captures[4], captures[2], captures[5]].map(item => item.id));
    assert.deepEqual(ids({ sort: "most-complete", filter: "text" }), [captures[3], captures[4], captures[1], captures[0]].map(item => item.id));
    assert.deepEqual(ids({ sort: "oldest", filter: "files" }), [captures[2], captures[5]].map(item => item.id));
    assert.deepEqual(inboxCounts(f.service.captures), { all: 6, text: 4, files: 2 });
    assert.equal(f.service.getInboxCompletion(f.service.get(captures[3].id)).ready, true);
    const changedExtension = f.service.captures.map(item => ({ ...item, attachments: item.attachments.map(ref => ({ ...ref, name: "Z.png" })) }));
    assert.deepEqual(sortedCaptures(changedExtension, { sort: "type" }).map(item => item.id), ids({ sort: "type" }), "File extensions never form extra Type groups");
    const tied = [40, 40].map((time, index) => ({ ...f.service.get(captures[1].id), id: "tie" + index, createdAt: time }));
    const untypedTies = [2, 1].map(time => ({ ...untyped, id: "untyped" + time, createdAt: time }));
    for (const sort of ["most-complete", "least-complete"]) {
        assert.deepEqual(sortedCaptures([...tied].reverse(), { sort, completion: item => f.service.getInboxCompletion(item) }).map(item => item.id), ["tie0", "tie1"]);
        assert.deepEqual(sortedCaptures(untypedTies, { sort, completion: item => f.service.getInboxCompletion(item) }).map(item => item.createdAt), [1, 2]);
    }
    await Promise.all([f.service.setSortPreference("newest"), f.service.updateCapture(untyped.id, { text: "Latest edit" })]);
    assert.equal(f.disk().inboxSort, "newest"); assert.equal(f.disk().otherPreference, "keep");
    assert.equal(f.reload().sortPreference, "newest"); assert.equal(f.service.get(untyped.id).text, "Latest edit");
    const saves = f.calls.saves;
    await f.service.setSortPreference("newest"); assert.equal(f.calls.saves, saves, "Unchanged preferences avoid extra writes");
    f.failure.save = () => true;
    await assert.rejects(() => f.service.setSortPreference("type"), /Save failure/);
    assert.equal(f.service.sortPreference, "newest", "A failed preference save restores the last persisted preference");
    f.failure.save = null;
    await f.service.delete(untyped.id);
    assert.deepEqual(inboxCounts(f.service.captures), { all: 5, text: 3, files: 2 });
    await f.service.addFiles(routedFile, captures[5].id);
    assert.deepEqual(inboxCounts(f.service.captures), { all: 4, text: 3, files: 1 });
    assert.equal(f.service.sortPreference, "newest", "Deletion and creation preserve the saved sort");
    console.log("Inbox required-details completion, counts, five sorts and preference persistence tests passed.");
}

async function existingNoteFlow() {
    const f = fixture(), path = f.p.root + "/Design/Functionality.md";
    const original = "---\r\ntitle: Functionality\r\n---\r\n\r\n# Quick Add\r\nExisting\r\n\r\n## Open questions\r\n* First\r\n* Second\r\n\r\n# Next\r\nUntouched\r\n";
    f.add(path, original);
    const values = { type: "note", noteAction: "existing", workspaceId: "p1", text: "One\nTwo" };
    assert.equal(f.service.completion(values).complete, false);
    const partial = await f.service.capture({ ...values, folder: f.p.root + "/Meta", title: "Preserved New note title" });
    assert.equal(captureDraft(f.reload().get(partial.id)).noteAction, "existing");
    assert.equal(f.service.get(partial.id).intent.title, "Preserved New note title");
    const parsed = await f.service.readNotePositions("p1", path), target = parsed.headings[0];
    const location = { path, targetType: "heading", anchor: target.anchor, label: target.label, position: "end" };
    await f.service.updateCapture(partial.id, { noteLocation: { path, targetType: "heading", anchor: target.anchor } });
    assert.equal(f.service.get(partial.id).intent.noteLocation, undefined, "Uncommitted/incomplete locations are never valid persisted locations");
    await f.service.updateCapture(partial.id, { noteLocation: location });
    const restored = f.reload(), draft = captureDraft(restored.get(partial.id));
    assert.deepEqual(draft.noteLocation, location);
    assert.equal(restored.completion(draft).complete, false, "Structural selections are revalidated after reload");
    await restored.readNotePositions("p1", path);
    assert.equal(restored.completion(draft).complete, true, "Existing-note completion needs no Folder or Title");
    const creates = f.calls.creates.length;
    await restored.createNote(draft, partial.id);
    assert.equal(restored.count, 0);
    assert.equal(f.calls.creates.length, creates, "Existing-note action never creates a note");
    assert.equal(f.content.get(path), original.replace("# Next", "One\r\nTwo\r\n\r\n# Next"));
    assert.deepEqual(f.calls.activity, [path]); assert.deepEqual(f.calls.refresh, [path]);

    const forbidden = [f.p.path, f.p.root + "/Loose.md", f.p.root + "/Design/File.pdf", f.p.root + "/Design"];
    f.add(forbidden[1], "Loose"); f.add(forbidden[2], "pdf");
    const guarded = await restored.capture(values);
    for (const bad of forbidden) {
        await assert.rejects(() => restored.createNote({ ...values, noteLocation: { path: bad, targetType: "note", position: "end" } }, guarded.id), /Choose note and position again/);
        assert.ok(restored.get(guarded.id));
    }
    await restored.delete(guarded.id);

    const stale = await restored.capture({ ...values, noteLocation: location });
    f.content.set(path, original.replace("Quick Add", "Removed"));
    await assert.rejects(() => restored.createNote(captureDraft(restored.get(stale.id)), stale.id), /Choose note and position again/);
    assert.equal(restored.get(stale.id).intent.noteLocation, null, "Missing structural target becomes persisted incomplete intent");
    assert.equal(f.content.get(path), original.replace("Quick Add", "Removed"));
    await restored.delete(stale.id);

    f.content.set(path, original);
    const race = await restored.capture({ ...values, noteLocation: location });
    f.failure.beforeProcess = () => f.content.set(path, original.replace("Existing", "Concurrent unrelated edit"));
    await restored.createNote(captureDraft(restored.get(race.id)), race.id);
    assert.ok(f.content.get(path).includes("Concurrent unrelated edit") && f.content.get(path).includes("One\r\nTwo"), "Vault.process revalidates fresh content instead of overwriting concurrent edits");

    for (const failure of ["process", "afterProcess", "ready", "finish", "prepared"]) {
        const r = fixture(), notePath = r.r.root + "/Math/Existing.md";
        r.add(notePath, "# Questions\n- Original\n");
        const list = parseNotePositions(String(r.content.get(notePath))).lists[0];
        const capture = await r.service.capture({ ...values, workspaceId: "resource:study", text: "Saved once\nContinuation", noteLocation: {
            path: notePath, targetType: "list", anchor: list.anchor, label: list.label, position: "last"
        } });
        const draft = captureDraft(capture);
        if (["process", "afterProcess"].includes(failure)) r.failure[failure] = true;
        else r.failure.save = data => failure === "finish" ? !data.inbox.captures.some(item => item.id === capture.id) :
            data.inbox.captures.some(item => item.operation?.kind === "note-insertion" && item.operation.state === failure);
        await assert.rejects(() => r.service.createNote(draft, capture.id), /failure/i);
        assert.ok(r.service.get(capture.id), "Failed " + failure + " keeps the Capture");
        r.failure.process = false; r.failure.save = null;
        const retry = r.reload(), retryDraft = captureDraft(retry.get(capture.id));
        assert.equal(retryDraft.type, "note"); assert.equal(retryDraft.noteAction, "existing");
        if (failure !== "prepared") await assert.rejects(() => retry.updateCapture(capture.id, { noteAction: "new" }), /original note position/);
        await retry.createNote(retryDraft, capture.id);
        assert.equal(retry.count, 0);
        assert.equal(r.calls.edits.length, 1, "Retrying " + failure + " inserts exactly once across reload");
        assert.equal(r.calls.creates.length, 0);
        assert.equal(r.content.get(notePath), "# Questions\n- Original\n- Saved once\n  Continuation\n");
    }
    const r = fixture(), notePath = r.r.root + "/Math/Changed.md";
    r.add(notePath, "Original\n");
    const capture = await r.service.capture({ ...values, workspaceId: "resource:study", noteLocation: { path: notePath, targetType: "note", position: "end" } });
    r.failure.save = data => data.inbox.captures.length === 0;
    await assert.rejects(() => r.service.createNote(captureDraft(capture), capture.id), /Save failure/);
    r.failure.save = null; r.content.set(notePath, String(r.content.get(notePath)) + "Later user edit\n");
    const before = r.content.get(notePath), retry = r.reload();
    await assert.rejects(() => retry.createNote(captureDraft(retry.get(capture.id)), capture.id), /changed after insertion/);
    assert.equal(r.content.get(notePath), before, "An ambiguous edited output is never inserted twice or overwritten");
    await retry.delete(capture.id);
    assert.equal(r.content.get(notePath), before, "Deleting a receipt never deletes or rolls back an existing user note");
    console.log("Existing-note persistence, insertion, concurrency and retry tests passed.");
}

run().then(existingNoteFlow).catch(error => { console.error(error); process.exitCode = 1; });
