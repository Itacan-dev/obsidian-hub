import { createMemoryRepository, type Command, type WorkspaceRef, type LocalEndpoint, type TaskRepository, deserializeSharedPartition } from "../src/contracts";
import { createJsonRepository, type StoragePort } from "../src/json-repository";

const owner: WorkspaceRef = { type: "project", id: "project-id" };
const idFactory = () => "00000000-0000-4000-8000-000000000001";
const definitions = [{ id: "project", kind: "git-project" as const, owner }];
async function example(): Promise<void> {
    const memory: TaskRepository = await createMemoryRepository({ partitions: definitions, idFactory });
    const command: Command = { type: "task.create", operationId: "create-once", payload: { task: { owner, title: "Typed", due: { date: "2026-10-16", time: null }, steps: [{ title: "Step", order: 0 }] } } };
    const result = await memory.execute(command);
    if (result.task) await memory.execute({ type: "task.complete", operationId: "complete-once", taskId: result.task.id, expectedRevision: result.task.revision, payload: { completed: true } });
    const packet = deserializeSharedPartition(memory.exportSharedPartition("project"));
    const eventId: string | undefined = packet.completionRefs[0]?.eventId;
    void eventId;
    const persistent: TaskRepository = await createJsonRepository({ directory: "/explicit/disposable/example", partitions: definitions });
    await persistent.close(); await memory.close();
}
void example;
// @ts-expect-error missing task identity/revision on an existing-task command
const missingRevision: Command = { type: "task.complete", operationId: "bad", payload: { completed: true } };
// @ts-expect-error local date is deliberately not a timestamp
const timestampDate: LocalEndpoint = { date: 1700000000, time: null };
// @ts-expect-error unrelated UI/source-note fields are outside the native contract
const sourceNote: Command = { type: "task.create", operationId: "bad", payload: { task: { owner, title: "X", path: "Tasks.md" } } };
// @ts-expect-error a Phase is a Project-qualified record, not a bare string
const unqualifiedPhase: Command = { type: "task.relocate", taskId: "uuid", expectedRevision: 1, operationId: "bad", payload: { owner, location: null, phase: "phase-id" } };
void missingRevision; void timestampDate; void sourceNote; void unqualifiedPhase;
const storagePortIsAnInterfaceOnly: StoragePort | null = null; void storagePortIsAnInterfaceOnly;
