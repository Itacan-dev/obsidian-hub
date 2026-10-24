import type { CommandAdmissionGateV1, CommandAdmissionTicketV1 } from "./command-admission";
import type { AtomicTaskCommandV1, AtomicTaskEffectsV1 } from "./atomic-task";
import type { SnapshotRequestV2, CoherentSnapshotV2 } from "./snapshot-read";
/** Portable contract. IDs are strings validated at runtime, UUIDs where stated. */
export type WorkspaceRef = { type: "project" | "resource"; id: string };
export type LocationRef = { type: "folder" | "note"; id: string };
export type PhaseRef = { projectId: string; phaseId: string };
export type LocalEndpoint = { date: string; time: string | null };
import type { StructuralEditPayload } from "./step-content";
import type { SnapshotRequestV1, CoherentSnapshotV1 } from "./snapshot-read";
import type { HistoryImportCommand, HistoryImportResult, HistoryImportEvidenceProvider, HistoryImportPlanView } from "./history-import";
import type { DurableRecordedHistory, DurableStatisticsHistory } from "../history/durable-projection";
export * from "./history-import";
import type { RecurrenceCommand, RecurrenceSnapshot, RecurrenceReadiness, ExternalReservations, RecurrenceGenerationCommand, RecurrenceSnapshotV2, RecurrenceReadinessV2 } from "./recurrence";
export * from "./recurrence";
export { CONTENT_DECISION, captureSourceEnvelope, validateEnvelope, originalBytes, verifySourceEnvelope, currentSearchProjection } from "./step-content";
export type { SourceEnvelope, CaptureRequest, StepDraft, TaskStepDraft, StructuralEditPayload, ContentEdit, CurrentSearchSpecimen } from "./step-content";
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface CaptureSource { origin?: string; workspaceId?: string; workspaceName?: string; path?: string; title?: string; url?: string }
export interface MigrationProvenance { source: string; sourceId: string; importedAt: number | null; evidence: Json }
export interface NativeStep {
    id: string; taskId: string; parentStepId: string | null; order: number; title: string;
    completed: boolean; completedAt: number | null; createdAt: number | null; modifiedAt: number | null;
}
export interface NativeTask {
    schemaVersion: 1; id: string; revision: number; partitionId: string; owner: WorkspaceRef; location: LocationRef | null;
    title: string; completed: boolean; completedAt: number | null; importance: "should" | "must" | null;
    start: LocalEndpoint | null; due: LocalEndpoint | null; description: string; phase: PhaseRef | null; steps: NativeStep[];
    createdAt: number | null; modifiedAt: number | null; archivedAt: number | null; deletedAt: number | null;
    migration: MigrationProvenance | null; captureSource: CaptureSource | null;
}
export type StepInput = Pick<NativeStep, "title"> & Partial<Omit<NativeStep, "title" | "taskId">>;
export type TaskInput = Pick<NativeTask, "owner" | "title"> & Partial<Omit<NativeTask, "owner" | "title" | "revision" | "partitionId" | "steps" | "archivedAt" | "deletedAt">> & { steps?: StepInput[]; archivedAt?: null; deletedAt?: null };
export interface Partition {
    id: string; kind: "private-project" | "git-project" | "resource"; owner: WorkspaceRef;
    revision: number; head: string | null; parentHead: string | null;
}
export type PartitionDefinition = Pick<Partition, "id" | "kind" | "owner">;
export interface CompletionContext { workingContext?: WorkspaceRef | null; oathId?: string | null; sessionId?: string | null }
export interface HistoryRecord {
    id: string; operationId: string; partitionId: string; kind: "task" | "step"; taskId: string | null; stepId: string | null;
    timestamp: number | null; recordedAt: number | null; ownerAtEvent: WorkspaceRef | null; workingContext: WorkspaceRef | null;
    oathId: string | null; sessionId: string | null; snapshot: { title: string; parentTitle: string | null };
    counted: boolean; reopenedAt: number | null; legacy: Json;
}
export interface CommandBase {
    operationId: string; expectedRepositoryRevision?: number; context?: CompletionContext;
    /** Private durable correlation evidence; no external service transaction is implied. */
    coordination?: { service: string; id: string; evidence?: Json };
}
type ExistingTask = { taskId: string; expectedRevision: number };
export type Command = CommandBase & (
    | import("./git-shared").GitReceiveCommandV2
    | AtomicTaskCommandV1
    | HistoryImportCommand
    | RecurrenceCommand
    | RecurrenceGenerationCommand
    | { type: "task.create"; payload: { task: TaskInput } }
    | { type: "task.createMany"; payload: { tasks: TaskInput[] } }
    | { type: "history.record"; payload: { record: HistoryRecord } }
    | ExistingTask & (
        | { type: "task.update"; payload: { patch: Partial<Pick<NativeTask, "title" | "importance" | "start" | "due" | "description" | "captureSource">> } }
        | { type: "task.editStructure"; payload: StructuralEditPayload }
        | { type: "task.relocate"; payload: { owner: WorkspaceRef; location: LocationRef | null; phase: PhaseRef | null } }
        | { type: "task.complete"; payload: { completed: boolean; completedAt?: number | null } }
        | { type: "task.archive"; payload: { archived: boolean } }
        | { type: "task.delete"; payload: Record<string, never> }
        | { type: "step.add"; payload: { step: StepInput & { order: number } } }
        | { type: "step.update"; payload: { stepId: string; patch: Partial<Pick<NativeStep, "title" | "parentStepId" | "order">> } }
        | { type: "step.reorder"; payload: { parentStepId: string | null; stepIds: string[] } }
        | { type: "step.delete"; payload: { stepId: string; cascade?: boolean } }
        | { type: "step.complete"; payload: { stepId: string; completed: boolean; completedAt?: number | null } }
    )
);
export interface Change { type: Command["type"]; operationId: string; repositoryRevision: number; taskIds: string[]; eventIds: string[]; partitions: Partition[] }
export interface CommandResult {
    operationId: string; repositoryRevision: number; revisionId: string; taskId: string | null; taskRevision: number | null;
    task: NativeTask | null; tasks: NativeTask[]; change: Change; replayed: boolean;
    recurrence?: RecurrenceSnapshot | RecurrenceSnapshotV2;
    historyImport?: HistoryImportResult;
    atomicTask?: AtomicTaskEffectsV1;
    gitShared?: import("./git-shared").GitApplicationSummaryV1;
    /** Only a returned replay, never a stored local receipt. */
    originReplay?: import("./git-shared").GitOriginReplayV1;
}
export interface Receipt { operationId: string; payload: string; result: CommandResult; partitionIds: string[]; coordination: CommandBase["coordination"] | null }
export interface RepositoryInfo {
    taskMutationVersion?: 1;
    schemaVersion: 1 | 2 | 3 | 4; storeId: string; revision: number; revisionId: string; parentRevisionId: string | null; partitions: Partition[];
    recovery: null | { recoveredRevision: number; recoveredRevisionId: string; failures: { file: string; reason: string }[]; source: string; requestedRevision: number | null };
    storage?: { format: "private-v4"; wireVersion: 4; authorityId: string; minimumLogicalSchemaVersion: 1 | 2 | 3 | 4; fenced: boolean; taskMutationVersion?: 1; gitSharedVersion?: 2 };
}
export interface TaskQuery {
    owner?: WorkspaceRef; completed?: boolean; location?: LocationRef | null; phase?: PhaseRef;
    start?: { from?: string; to?: string }; due?: { from?: string; to?: string }; partitionId?: string;
    includeArchived?: boolean; includeDeleted?: boolean; predicate?: (task: NativeTask) => boolean; scope?: Json;
}
export interface HistoryQuery { taskId?: string; stepId?: string; partitionId?: string; counted?: boolean; kind?: "task" | "step" }
export interface ReferenceResolvers {
    location?: (reference: LocationRef) => null | (LocationRef & { owner: WorkspaceRef }) | Promise<null | (LocationRef & { owner: WorkspaceRef })>;
    phase?: (reference: PhaseRef) => PhaseRef | null | Promise<PhaseRef | null>;
    /** Future hierarchy/mount query hook; these IDs grant no sharing eligibility. */
    queryScope?: (scope: Json) => string[];
}
export interface RepositoryOptions {
    /** Internal host participant; never a consumer execution callback. */
    commandAdmission?: CommandAdmissionGateV1;
    historyImportEvidence?: HistoryImportEvidenceProvider;
    /** Immutable captured inventory; changing cross-store planning is unsupported. */
    externalReservations?: ExternalReservations;
    /** Required for explicit Git-capable roots; never enables an existing private root. */
    sharedReplicaId?: string;
    idFactory: () => string; clock?: () => number; resolvers?: ReferenceResolvers;
    onSubscriberError?: (error: unknown) => void;
    /** Explicit fault injection for disposable tests only. */
    fault?: (stage: string) => void | Promise<void>;
}
export interface TaskRepository {
    /** Queued authoritative fixed projection; existing cached getters are unchanged. */
    readSnapshot(request: SnapshotRequestV1): Promise<CoherentSnapshotV1>;
    readSnapshot(request: SnapshotRequestV2): Promise<CoherentSnapshotV2>;
    readSnapshot(request: import("./editor-read").EditorReadRequestV1): Promise<import("./editor-read").EditorSnapshotV1>;
    getHistoryImportPlan(id: string, options: {version:1}): HistoryImportPlanView | null;
    historyCompatibility(options: {version:1;projection:"recorded"}): DurableRecordedHistory;
    historyCompatibility(options: {version:1;projection:"statistics"}): DurableStatisticsHistory;
    getRecurrenceSeries(id: string): RecurrenceSnapshot | null;
    getRecurrenceSeries(id: string, options: {version:2}): RecurrenceSnapshotV2 | null;
    recurrenceReadiness(): RecurrenceReadiness;
    recurrenceReadiness(options: {version:2;seriesId:string}): RecurrenceReadinessV2;
    info(): RepositoryInfo;
    getTask(id: string, options?: { includeDeleted?: boolean }): NativeTask | null;
    getReceipt(operationId: string): Receipt | null;
    queryTasks(query?: TaskQuery): NativeTask[];
    queryHistory(query?: HistoryQuery): HistoryRecord[];
    execute(command: Command, admissionTicket?: CommandAdmissionTicketV1, replicationEvidence?: import("./git-shared").GitReplicationEvidenceV1): Promise<CommandResult>;
    subscribe(listener: (change: Change) => void | Promise<void>): () => void;
    exportSharedPartition(partitionId: string): string;
    /** Queued, validated Git-only export; v1 snapshot exports retain their old grammar. */
    exportSharedPacket(): Promise<import("./git-shared").GitPacketV3>;
    close(): Promise<void>;
}
export class RepositoryError extends Error { constructor(code: string, message: string, details?: Record<string, unknown>); code: string; details: Record<string, unknown> }
export class MemoryStorage { constructor() }
export function createMemoryRepository(options: RepositoryOptions & { partitions: PartitionDefinition[]; storeId?: string; storage?: MemoryStorage; taskMutationVersion?: 1; gitSharedVersion?: 2 }): Promise<TaskRepository>;
export function openMemoryRepository(options: RepositoryOptions & { storage: MemoryStorage }): Promise<TaskRepository>;
export interface CompletionRef { taskId: string; stepId: string | null; eventId: string }
export interface SharedPacket { format: "itacan-task-partition"; schemaVersion: 1; partition: Partition; tasks: Omit<NativeTask, "captureSource" | "migration">[]; completionRefs: CompletionRef[] }
export function serializeSharedPartition(value: { partition: Partition; tasks: NativeTask[]; completionRefs?: CompletionRef[] }): string;
/** Pure validation/deserialization only. Does not import, synchronize or write. */
export function deserializeSharedPartition(text: string, expectedPartition?: Partition | null): SharedPacket;
export function validateSharedPacket(packet: unknown): SharedPacket;
export function comparePartitionHeads(local: Partition, remote: Partition): "same" | "remote-direct-child" | "local-direct-child" | "conflict-or-unproven-ancestry";
export const SCHEMA_VERSION: 1;
export function validateTask(task: unknown): void;
export function validateSteps(steps: unknown, taskId: string): void;
export function validatePartition(partition: unknown): void;
export function validateHistory(record: unknown): void;
export function validateState(state: unknown): void;
export function dateEndpoint(endpoint: unknown): void;

export interface TaskRepository {readSnapshot(request:import("./snapshot-read").OperationReadRequestV3):Promise<import("./snapshot-read").OperationSnapshotV3>}

export interface TaskRepository {readSnapshot(request:import("./history-read").HistoryReadRequestV4):Promise<import("./history-read").HistorySnapshotV4>}

export function deserializeSharedPacketV2(text:string):Promise<never>;
export function deserializeSharedPacketV3(text:string,expectedGenesis?:import("./git-shared").GitGenesisV1):Promise<import("./git-shared").GitPacketV3>;
