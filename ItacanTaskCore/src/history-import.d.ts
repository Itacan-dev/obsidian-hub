/** Private inactive import. Writes and compatibility projections require Node. */
import type { WorkspaceRef, CommandBase, HistoryRecord, CompletionRef } from "./contracts";
import type { HistoryCaptureV1, ImportProposal, HistoryAnalysis } from "../history/contracts";
export const HISTORY_IMPORT_COMMANDS: { readonly version: 1; readonly commands: readonly ["history.prepareImport", "history.importBundle"] };
export interface ImportPins {
    captureId: string; lineage: string; captureRevision: string; captureDigest: string;
    sourceRevision: string; sourceDigest: string; historyRevision: string; historyDigest: string;
    checksRevision: string; checksDigest: string; registryRevision: string; registryDigest: string;
    identity: null | { storeId: string; revision: number; planId: string; planDigest: string; snapshotDigest: string };
    externalInventoryRevision: string; externalInventoryDigest: string;
}
export interface ImportOwnerSnapshot { owner: WorkspaceRef; label: string; status: string | null; evidence: "reviewed-closed-synthetic" }
export interface ImportDraft { entryId: string; title: string; description: string; continuation: string; steps: { entryId: string; title: string; body: string }[] }
export interface ReviewedHistoryImportBundle {
    format: "itacan-reviewed-history-import-bundle"; version: 1; proposal: ImportProposal; drafts: ImportDraft[];
    partitionMappings: { owner: WorkspaceRef; partitionId: string }[]; ownerSnapshots: ImportOwnerSnapshot[];
    nativeHistoryWitnesses: { eventId: string; legacyDigest: string }[]; digest: string;
}
export interface ImportPartitionGuard { owner: WorkspaceRef; partitionId: string; expectedRevision: number }
interface ImportPayload { version: 1; decisionRevision: "N1-E2-E01-E09-r1"; planId: string; bundleDigest: string; pins: ImportPins; partitions: ImportPartitionGuard[]; syntheticOnly: true; reason: string }
export type HistoryImportCommand = Omit<CommandBase, "expectedRepositoryRevision" | "context"> & {
    expectedRepositoryRevision: number; context?: never; taskId?: never; expectedRevision?: never;
} & (
    { type: "history.prepareImport"; payload: ImportPayload & { publicationOperationId: string; bundle: ReviewedHistoryImportBundle } } |
    { type: "history.importBundle"; payload: ImportPayload & { expectedPlanRevision: 1; preparedPlanDigest: string } }
);
export interface ImportReservation { id: string; kind: "task" | "step" | "event"; entryId: string | null; groupKey: string | null; owner: WorkspaceRef | null; partitionId: string | null; externalClaim: boolean; purpose: "eligible-target" | "quarantined-target" | "historical-event" }
export interface ImportEventAllocation { key: string; rowKeys: string[]; ordinals: number[]; eventId: string | null; reasons: string[]; owner: WorkspaceRef | null; partitionId: string | null; kind: "task" | "step"; timestamp: number | null; timeQuality: string }
export interface PreparedHistoryImportPlan { version: 1; revision: 1; id: string; bundleDigest: string; pins: ImportPins; publicationOperationId: string; preparedAt: number; preparedRepositoryRevision: number; analysisDigest: string; treeDispositions: HistoryAnalysis["trees"]; groups: ImportEventAllocation[]; reservations: ImportReservation[]; partitionIds: string[]; ownerSnapshots: ImportOwnerSnapshot[]; digest: string }
export interface HistoryImportOutcome { version: 1; planId: string; planRevision: 1; operationId: string; receiptOperationId: string; repositoryRevision: number; importedAt: number; taskIds: string[]; stepIds: string[]; eventIds: string[]; events: HistoryRecord[]; bindings: CompletionRef[]; creationDigest: string; digest: string }
export interface HistoryImportResult { version: 1; kind: "prepared" | "published"; planId: string; planRevision: 1; planDigest: string; bundleDigest: string; captureDigest: string; plan: PreparedHistoryImportPlan; outcome: HistoryImportOutcome | null; accounting: { allocatedEvents: number; importedTasks: number; importedSteps: number; importedEvents: number; quarantinedTrees: number } }
export interface HistoryImportObservation { version: 1; exclusive: true; capture: HistoryCaptureV1; externalInventory: { version: 1; revision: string; ids: string[] }; ownerSnapshots: ImportOwnerSnapshot[] }
/** Read-only closed-fixture witness; not a live source lease or commit authority. */
export interface HistoryImportEvidenceProvider { version: 1; mode: "closed-synthetic"; read(): HistoryImportObservation | Promise<HistoryImportObservation> }
export interface HistoryImportPlanView { version: 1; plan: PreparedHistoryImportPlan; outcome: HistoryImportOutcome | null; status: "prepared" | "published" }
