import { TaskService, TaskDTO, TaskDraft, TaskHandle, TaskChange, TaskServiceAdapter } from "../services/task-service";
import "./task-read-types.fixture";
import { LegacyTaskAdapter } from "../services/task-service-legacy";
import { legacyTaskHandle } from "../services/task-service-legacy-values";
const legacy = new LegacyTaskAdapter({ plugin: {}, dataview: {} });
const service = new TaskService(legacy);
const handle: TaskHandle = legacyTaskHandle({ path: "Synthetic/Note.md", line: 0, text: "Read", hubTaskId: "old-non-uuid-id" });
void service.getTask(handle);
void service.queryStructured({ workspace: { type: "project", id: "p" }, policy: "workspace", validation: "indexed" }).then(query => {
    for (const row of query.rows) if (row.view) {
        const validation: "indexed" | "source-checked" = row.view.validation;
        const steps = row.view.steps;
        const evidence: "legacy-task-read" = row.view.legacy.kind;
        void validation; void steps; void evidence;
        // @ts-expect-error Structured reads never expose a platform file object.
        row.view.file.path;
    }
});
void service.resolveSavedTarget({ path: "Note.md", taskId: "old-id", stepText: "Existing Step" });
void service.resolveOathWork({ workspace: { type: "project", id: "p" }, references: [{ id: "parent", path: "Old.md", text: "Saved text" }],
    awaitingIndex: [{ id: "parent", path: "Current.md", line: 2, text: "Current text" }] }).then(read => {
    const task: import("../services/task-service-contract").OathCommittedTask | null = read.rows[0].task;
    const diagnostic: string = read.rows[0].diagnostics[0].code;
    void task; void diagnostic;
});
// @ts-expect-error commitments require stable IDs, not title-only locators
void service.resolveOathWork({ workspace: { type: "project", id: "p" }, references: [{ path: "Old.md", text: "Saved text" }] });
void service.resolveLegacyAction(handle);
void service.queryStructured({ policy: "panel", validation: "indexed" });
void service.queryHistory({ projection: "recorded" }).then(query => {
    const consistency: "legacy-recorded" = query.consistency;
    for (const row of query.rows) if (row.fact) {
        const title: string = row.fact.recorded.text;
        const source: "recorded-legacy-note" | undefined = row.fact.recordedSource?.kind;
        void title; void source;
        // @ts-expect-error Recorded facts do not expose raw files or persistence objects.
        row.fact.file.path;
        // @ts-expect-error A recorded note is not a native revision-bearing event.
        row.fact.repositoryRevision;
    }
    void consistency;
});
// @ts-expect-error History has no live-task reconstruction projection.
void service.queryHistory({ projection: "current-checkboxes" });
void service.queryStructured({ policy: "home", validation: "indexed" }).then(query => {
    for (const row of query.rows) if (row.home) {
        const reference: string | null = row.home.projectReference;
        const physical = row.home.physicalOwner;
        void reference; void physical;
        // @ts-expect-error Home evidence never exports the raw indexed page.
        row.home.page.file.path;
    }
});
// @ts-expect-error Unknown visibility policies remain rejected.
void service.queryStructured({ policy: "mounted" });
void service.queryDisplay().then(query => {
    for (const row of query.rows) {
        if (row.view) {
            const readOnly: false = row.view.capabilities.edit;
            void readOnly;
            // @ts-expect-error An indexed display view does not expose a source TFile.
            row.view.file.path;
        }
    }
});
void service.getTask({ kind: "native", id: "canonical-uuid-validated-by-future-native-adapter" });
const draft: TaskDraft = { title: "Test", completed: false, importance: null, start: null, due: { date: "2026-10-18", time: null }, description: "", phase: null, steps: [] };
void service.createTask({ owner: { type: "project", id: "synthetic" }, destination: { kind: "legacy-source", path: "Synthetic/Note.md" }, draft });
void service.readEditable(handle).then(edit => service.saveEditable(edit.token, edit.draft));
service.subscribe((change: TaskChange) => {
    if (change.kind === "committed") { const revision: number = change.repositoryRevision; void revision; }
    else { const unknownDurability: "unknown" = change.durability; void unknownDurability; }
});
declare const nativeDTO: TaskDTO;
const title: string = nativeDTO.title;
void title;
// @ts-expect-error Source files are not universal task properties.
nativeDTO.file.path;
// @ts-expect-error A path cannot masquerade as a native task identity.
void service.getTask({ kind: "native", path: "Synthetic/Note.md" });
// @ts-expect-error A legacy locator must retain its expected title.
void service.getTask({ kind: "legacy", identity: null, locator: { path: "Synthetic/Note.md", line: 0 } });
// @ts-expect-error Date-only endpoints explicitly have a nullable time.
draft.due = { date: "2026-10-18" };
declare const adapter: TaskServiceAdapter;
new TaskService(adapter);
void service.queryStructured({ policy: "oath-candidates", workspace: { type: "project", id: "synthetic" }, validation: "indexed" }).then(query => {
    const setupOnly: "oath-candidates" | undefined = query.policy;
    const complete: boolean | undefined = query.complete;
    void setupOnly; void complete;
});
// @ts-expect-error Setup candidates require an explicit workspace.
void service.queryStructured({ policy: "oath-candidates" });
// @ts-expect-error Candidate discovery cannot request source hydration.
void service.queryStructured({ policy: "oath-candidates", workspace: { type: "project", id: "synthetic" }, validation: "source" });
void service.queryHistory({ projection: "recorded" }).then(query => {
    for (const row of query.rows) {
        const legacyName: string | number | boolean | null | undefined = row.fact?.recorded.project ?? row.recorded?.project;
        const unavailable: string[] | undefined = row.unavailableFields;
        void legacyName; void unavailable;
        // @ts-expect-error Partial recorded evidence never exposes a mutable persistence object.
        row.recorded.save();
    }
});
