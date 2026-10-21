/** Private, inactive, Node-only evidence analysis. No storage/allocator/host API. */
import type { WorkspaceRef, NativeTask, Partition, HistoryRecord, Receipt, Json } from "../src/contracts";
import type { IdentityState } from "../identity/contracts";
import type { OathCommittedReference, OathCommittedRead, OathCommittedTask, NativeNavigationTarget, TaskReadiness } from "../../.obsidian/plugins/hub-project-menu/lib/services/task-service-contract";
export const DECISION: "N1-F1-F01-F10-r1";
export const READINESS: readonly TaskReadiness["state"][];
export const PRIVATE_CLASSES: readonly string[];
export interface OwnerEvidenceV1 {
    owner: WorkspaceRef; root: string; shared: boolean; status: "active" | "future" | "shelved";
    available: boolean; partitionId: string;
    shareApproval: null | { version: 1; projectId: string; root: string; reviewDigest: string };
}
/** Full logical native state is private; domain validation runs before analysis. */
export interface NativeStateEvidence {
    schemaVersion: 1 | 2 | 3 | 4; storeId: string; revision: number; revisionId: string; parentRevisionId: string | null;
    partitions: Partition[]; tasks: NativeTask[]; history: HistoryRecord[]; bindings: { taskId: string; stepId: string | null; eventId: string }[];
    receipts: Receipt[]; retiredStepIds: string[]; recurrence?: Json; historyImport?: Json;
}
export interface AliasPinV1 { legacyId: string; storeId: string; ledgerRevision: number; planId: string; planDigest: string; snapshotDigest: string }
export interface NativeAuthorityV1 {
    kind: "native"; authorityId: string; partitionId: string; taskId: string;
    enrollment: { repositoryRevision: number; revisionId: string; taskRevision: number };
    aliasPin: AliasPinV1 | null;
}
export type CommitmentTargetV1 = {
    version: 1; session: { deviceId: string; oathId: string }; owner: WorkspaceRef;
} & (
    | { original: { kind: "legacy-task"; reference: OathCommittedReference };
        authority: { kind: "legacy-markdown"; sourceAuthority: string } | (NativeAuthorityV1 & { aliasPin: AliasPinV1 }) }
    | { original: { kind: "native-task"; taskId: string; text: string }; authority: NativeAuthorityV1 & { aliasPin: null } }
);
export interface OathEvidenceV1 {
    format: "itacan-oath-evidence"; version: 1; decisionRevision: typeof DECISION; privacy: "local-private"; scope: "closed-synthetic";
    registry: OwnerEvidenceV1[];
    legacy: null | { sourceAuthority: string; readiness: TaskReadiness["state"]; read: OathCommittedRead | null };
    native: null | { state: NativeStateEvidence | null; readiness: TaskReadiness["state"]; recovery: { state: "intact" | "fenced" | "unknown"; taskIds: string[]; stepIds: string[] } };
    identity: null | { snapshot: IdentityState; planId: string };
    candidates?: CommitmentTargetV1[];
}
export type ResolutionState = "resolved-native" | "resolved-legacy" | "awaiting-index" | "pending-native-publication" |
    "missing" | "deleted" | "retired-step" | "ambiguous" | "quarantined" | "owner-mismatch" | "authority-mismatch" | "unavailable";
export interface CommitmentResolutionV1 {
    version: 1; privacy: "local-private"; state: ResolutionState; reason: string; target: CommitmentTargetV1;
    task: NativeTask | OathCommittedTask | null;
    navigation: NativeNavigationTarget | { kind: "legacy-source"; path: string; line: number; existingId: string } | null;
}
export interface CompletionEligibilityV1 {
    version: 1; state: "eligible" | "ineligible" | "unknown" | "unsupported"; reason: string;
    displayCompleted: boolean | null; eventId: string | null; operationId: string | null; repositoryRevision: number | null;
}
export interface OathAnalysisV1 {
    version: 1; privacy: "local-private"; decisionRevision: typeof DECISION;
    accounting: { owners: number; legacyRows: number; nativeTasks: number; nativeEvents: number; publishedAliases: number; candidateRows: number };
    candidateGroups: { key: string; indexes: number[]; selectable: boolean; reason: string }[];
    unresolvedCandidates: { index: number; state: ResolutionState; reason: string }[]; limitations: string[];
}
export interface MigrationProtectionV1 {
    version: 1; privacy: "local-private"; state: "known" | "protection-unknown"; migrationAuthorized: false;
    protectedTrees: { session: CommitmentTargetV1["session"]; authority: CommitmentTargetV1["authority"]; taskId: string; stepIds: string[]; protectsWholeTree: true }[];
    unknown: { reason: string; session: { deviceId: string | null; oathId: string | null } }[];
}
export interface ProtectionOath { state: string; id?: string; deviceId?: string; targets?: CommitmentTargetV1[]; fulfilledAt?: number | null }
export interface SharingDispositionV1 { version: 1; privacy: "local-private"; state: "private" | "blocked" | "canonical-fields-only"; reason: string; packet: null }
export function analyzeOathEvidence(evidence: OathEvidenceV1): OathAnalysisV1;
export function resolveCommitmentTarget(target: CommitmentTargetV1, evidence: OathEvidenceV1): CommitmentResolutionV1;
export function assessCompletionEligibility(target: CommitmentTargetV1, evidence: OathEvidenceV1): CompletionEligibilityV1;
export function assessMigrationProtection(oaths: ProtectionOath[], evidence: OathEvidenceV1): MigrationProtectionV1;
export function classifyTaskSharing(task: NativeTask, owners: OwnerEvidenceV1[]): SharingDispositionV1;
