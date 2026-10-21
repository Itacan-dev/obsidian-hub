import {
    TaskService, TaskReadProtocol, TaskReadRequest, TaskReadResult, NativeReadResult, LegacyReadResult, ReadFailure,
    NativeReadTask, NativeReadStep, NativeReadEvent, NativeNavigationTarget, TaskReadiness, TaskReadBackend
} from "../services/task-service";
declare const service: TaskService;
declare const native: NativeReadTask;
declare const step: NativeReadStep;
declare const event: NativeReadEvent;
declare const ready: TaskReadiness;
const protocol: TaskReadProtocol = service;
const revision: number = native.revision;
const parent: string | null = step.parentStepId;
const owner: "project" | "resource" = native.owner.type;
const nullableTime: string | null | undefined = native.due?.time;
void protocol; void revision; void parent; void owner; void nullableTime;
void service.read({ backend: "native", operation: "structured", owner: { type: "resource", id: "study" } });
void service.read({ backend: "native", operation: "committed", workspace: { type: "project", id: "p" },
    references: [{ kind: "native", id: "native-uuid" }, { kind: "legacy-id", id: "unmapped-legacy" }] });
void service.read({ backend: "native", operation: "history", selection: "current-bindings" });
void service.read({ backend: "native", operation: "navigation", handle: { kind: "native", id: "uuid" }, mode: "location" });
void service.read({ backend: "legacy-markdown", operation: "structured", options: { policy: "home", validation: "indexed" } });
void service.readiness(["source-independent", "history-counting", "mutation"]);
service.subscribeReads(change => {
    if (change.backend === "native") { const ephemeral: "ephemeral" = change.durability; void ephemeral; }
    else { const unconfirmed: "unknown" = change.durability; void unconfirmed; }
});
function never(value: never): never { throw Error(String(value)); }
function narrow(result: TaskReadResult) {
    if (result.status !== "ok") {
        const missing: ReadFailure = result; void missing.reason;
        // @ts-expect-error Unsupported/unavailable is not successful empty rows.
        result.rows;
        return;
    }
    if (result.backend === "legacy-markdown") {
        const legacy: LegacyReadResult = result;
        if (legacy.operation === "structured" || legacy.operation === "candidates") {
            const evidence = legacy.data.rows[0].view?.legacy;
            void evidence;
            // @ts-expect-error Legacy structured results are not native revision-bearing rows.
            legacy.data.rows[0].view?.revision;
        }
        return;
    }
    const native: NativeReadResult = result;
    switch (native.operation) {
        case "structured":
            native.rows[0].steps[0].parentStepId;
            // @ts-expect-error Native records have no legacy action locators.
            native.rows[0].legacy.path;
            break;
        case "candidates": native.workspace.type; native.rows[0].owner; break;
        case "committed":
            native.rows[0].reference.kind; native.rows[0].state;
            // @ts-expect-error Native commitments don't manufacture awaitingIndex flags.
            native.rows[0].retireAwaitingIndex;
            break;
        case "history":
            native.rows[0].eventId; native.rows[0].counted;
            // @ts-expect-error Native retained events are not raw legacy recorded facts.
            native.rows[0].recorded.project;
            break;
        case "navigation":
            if (native.target) navigation(native.target);
            break;
        case "target": native.task?.revision; native.step?.parentStepId; break;
        default: never(native);
    }
}
function navigation(target: NativeNavigationTarget) {
    switch (target.kind) {
        case "native-task":
            target.id;
            // @ts-expect-error A task identity is not a source path.
            target.path;
            break;
        case "native-location":
            target.owner; target.location.type;
            // @ts-expect-error A folder/note context is not a task source line.
            target.line;
            break;
        case "historical-provenance": target.source.path; break;
        default: never(target);
    }
}
if (ready.backend === "native") {
    ready.capabilities.operations.history.state;
    // @ts-expect-error Native readiness does not fabricate a Dataview index.
    ready.dataview.index.initialized;
}
if (ready.capabilities.features.history.state !== "supported") {
    const reason: string = ready.capabilities.features.history.reason; void reason;
}
// @ts-expect-error Native task DTO has no Markdown path.
native.path;
// @ts-expect-error Native Step DTO has no hidden Hub ID.
step.hubTaskId;
// @ts-expect-error Event identity does not imply a current completion binding.
event.binding;
// @ts-expect-error Unknown backend is not coerced to legacy.
const wrongBackend: TaskReadRequest = { backend: "other", operation: "structured" };
// @ts-expect-error Native structured request must use native owner, not legacy root paths.
const fakeSource: TaskReadRequest = { backend: "native", operation: "structured", path: "native.md" };
// @ts-expect-error A native source-independent task cannot be constructed with only a path.
const missingIdentity: NativeReadTask = { kind: "native-task-read", path: "native.md", line: 0 };
// @ts-expect-error New read protocol has no mutation operation.
void service.read({ backend: "native", operation: "complete", id: "uuid" });
// @ts-expect-error Explicit native target requires native ID, not legacy locator.
void service.read({ backend: "native", operation: "target", handle: { kind: "legacy", locator: { path: "x.md", line: 0, expectedTitle: "x" }, identity: null } });
// @ts-expect-error Backend readiness missing capability list is explicit.
const incomplete: TaskReadiness = { backend: "native", state: "ready", reason: "ready" };
declare const port: TaskReadBackend;
const nativeRequest: Parameters<typeof port.read>[0] = { backend: "native", operation: "history", selection: "retained" };
void nativeRequest; void wrongBackend; void fakeSource; void missingIdentity; void incomplete; void narrow;

