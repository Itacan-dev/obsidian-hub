/** Inactive Node-only, private, allocation-free evidence contracts. No import writer. */
import type { Json, WorkspaceRef, HistoryRecord } from "../src/contracts";
import type { IdentityState, OwnerRegistration } from "../identity/contracts";
import type { SourceEnvelope } from "../src/step-content";
export const HISTORY_DECISION: "N1-E1-E01-E09-r1";
export const HISTORY_POLICIES: readonly ["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08", "E09"];
export interface RawHistorySource { encoding: "utf-8" | "opaque"; hex: string; sha256: string; byteLength: number }
export interface PinnedIdentity { version: 1; storeId: string; revision: number; planId: string; planDigest: string; snapshot: IdentityState }
/** Raw metadata permits invalid values to survive into a blocked disposition. */
export interface SourceMetadata { start: Json; due: Json; importance: Json; location: Json; phase: Json; recurrence: Json }
export interface HistoryTarget { entryId: string; completed: boolean; completedAt: number | null; metadata: SourceMetadata | null }
export interface HistoryCaptureV1 {
    format: "itacan-history-capture"; version: 1; parserVersion: 1; decisionRevision: typeof HISTORY_DECISION;
    privacy: "local-private"; scope: "global-synthetic"; id: string; lineage: string; revision: string;
    registryRevision: string; registry: OwnerRegistration[]; sourceRevision: string; historyRevision: string; checksRevision: string;
    rawSource: RawHistorySource | null; history: Json[]; checks: Json[]; identity: PinnedIdentity | null;
    content: { entryId: string; envelope: SourceEnvelope }[]; targets: HistoryTarget[]; digest: string;
}
export interface RawEventIdentity { present: boolean; type: "absent" | "null" | "string" | "number" | "boolean" | "unsupported"; value: Json }
export interface HistoryEventGroup {
    key: string; rowKeys: string[]; ordinals: number[]; rawIdentity: RawEventIdentity; kind: "task" | "step";
    owner: WorkspaceRef | null; nativeEventId: null; canonicalTimestamp: number | null;
    timeQuality: "archive-time-unverified" | "recorded-time-unverified" | "current-check-proven";
    reasons: string[]; disposition: "historical-event-evidence" | "quarantined-event-evidence";
}
export interface BindingEvidence { entryId: string; taskEntryId: string; groupKey: string; rowKeys: string[]; checkOrdinal: number; canonicalTimestamp: number | null }
export type TreeDisposition = "eligible-evidence-only" | "quarantined-tree";
export interface AnalyzedTarget { entryId: string; taskEntryId: string; kind: "task" | "step"; nativeId: string | null; owner: WorkspaceRef | null; completed: boolean; sourceCompletedAt: number | null; binding: BindingEvidence | null; reasons: string[]; disposition: TreeDisposition }
export interface HistoryAnalysis {
    version: 1; kind: "history-analysis-only"; decisionRevision: typeof HISTORY_DECISION; captureDigest: string; privacy: "local-private";
    globalBlockers: string[]; groups: HistoryEventGroup[]; targets: AnalyzedTarget[];
    trees: { taskEntryId: string; entryIds: string[]; disposition: TreeDisposition; reasons: string[] }[];
    bindings: BindingEvidence[]; orphanChecks: { ordinal: number; reason: string }[];
    accounting: { historyRows: number; groupedRows: number; eventGroups: number; targets: number; eligibleTrees: number; quarantinedTrees: number; importedTasks: 0; importedEvents: 0; allocatedEventIds: 0 };
    readiness: { evidenceAnalyzed: true; nativeImportImplemented: false; productionAuthority: false; crossStoreConsumption: false };
}
export interface HistoryReview {
    version: 1; decisionRevision: typeof HISTORY_DECISION; captureDigest: string; reviewer: string; syntheticOnly: true; policyIds: typeof HISTORY_POLICIES;
    expectedIdentityRevision: number | null; expectedPlanDigest: string | null; expectedRegistryRevision: string;
    expectedSourceRevision: string; expectedHistoryRevision: string; expectedChecksRevision: string;
    priorCaptures: { lineage: string; digest: string; sourceFiles: { id: string; path: string }[] }[];
}
export interface ImportProposal {
    format: "itacan-history-import-proposal"; version: 1; decisionRevision: typeof HISTORY_DECISION; privacy: "local-private";
    mode: "evidence-only"; canExecute: false; capture: HistoryCaptureV1; review: HistoryReview; analysis: HistoryAnalysis; digest: string;
}
/** Pure simulation. Not a persisted reopen or evidence of a native commit. */
export interface VisibilitySpecimen { version: 1; captureDigest: string; reopenedTargets: string[] }
export type CanonicalEventSpecimen = { version: 1; event: HistoryRecord; publication: { revision: number; index: number } } & (
    { origin: "native-completion"; groupKey: null } | { origin: "represented-import"; groupKey: string }
);
export interface RecordedHistoryProjection { version: 1; kind: "recorded-history-input-specimen"; privacy: "local-private"; captureDigest: string; records: Json[]; suppressedRowKeys: string[] }
export interface StatisticsCompletionProjection { version: 1; kind: "statistics-completion-input-specimen"; privacy: "local-private"; captureDigest: string; records: Json[]; representedNativeEventIds: string[]; suppressedRowKeys: string[] }
export function evidenceDigest(value: object): string;
export function historyRowKey(capture: Pick<HistoryCaptureV1, "lineage" | "id">, ordinal: number): string;
export function validateHistoryCapture(value: unknown): HistoryCaptureV1;
export function analyzeHistoryCapture(capture: HistoryCaptureV1): HistoryAnalysis;
export function proposeImportBundle(capture: HistoryCaptureV1, review: HistoryReview): ImportProposal;
export function projectRecordedHistory(evidence: HistoryCaptureV1 | ImportProposal, visibility?: VisibilitySpecimen): RecordedHistoryProjection;
export function projectStatisticsCompletions(evidence: HistoryCaptureV1 | ImportProposal, canonicalEvents?: CanonicalEventSpecimen[], visibility?: VisibilitySpecimen): StatisticsCompletionProjection;
