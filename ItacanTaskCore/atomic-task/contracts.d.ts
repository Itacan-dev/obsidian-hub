/** N3-B2-A frozen proposal only. No dispatcher, codec or proof-v2 implementation. */
import type { WorkspaceRef, LocationRef, PhaseRef, LocalEndpoint, PartitionDefinition } from "../src/contracts";
import type { PrivateBarrierV1 } from "../src/private-storage-codec";
import type { NativeHeadV1, NativeTargetV1, EnrollmentOrderV1, CompletionProofRequestV1, CompletionProofReadV1, CompletionProofRowV1, CompletionReceiptEvidenceV1, CompletionEventEvidenceV1, CompletionEvidencePortV1 } from "../oath/completion-proof";
import type { ActionEnvelopeV1, NativeActionGuardV1, NativeAuthorityV1, ExistingTargetV1 } from "../application/contracts";

export type CompletionIntentV1 = { kind: "keep" } | { kind: "complete"; completedAt?: number | null } | { kind: "reopen" };
export type InitialCompletionV1 = { completed: false; completedAt: null } | { completed: true; completedAt?: number | null };
export interface AtomicScopeV1 { authorityId: string; owner: WorkspaceRef; partitionId: string; expectedPartitionRevision: number; inventoryPin: string }
export interface EditableMetadataV1 { title: string; description: string; importance: "must" | "should" | null; start: LocalEndpoint | null; due: LocalEndpoint | null; location: LocationRef | null; phase: PhaseRef | null }
export type RecurrenceOccurrenceGuardV1 = { kind: "none" } | {
  kind: "member"; namespaceVersion: 1 | 2; seriesId: string; seriesRevision: number;
  ruleRevision: number; templateRevision: number | null; membershipDigest: string; ledgerDigest: string;
};
interface StepDraftFieldsV1 { id: string; parentStepId: string | null; order: number; title: string; body: string }
export type SavedStepV1 = StepDraftFieldsV1 & (
  { state: "existing"; completion: CompletionIntentV1; initial?: never } |
  { state: "new"; initial: InitialCompletionV1; completion?: never }
);
export interface SubtreeDeletionV1 { stepId: string; cascade: boolean; descendantIds: readonly string[] }
export interface TaskSaveDraftV1 { version: 1; metadata: EditableMetadataV1; continuation: string; steps: readonly SavedStepV1[]; deletions: readonly SubtreeDeletionV1[]; parentCompletion: CompletionIntentV1 }
export interface TaskSaveGuardsV1 { expectedContentRevision: number; expectedTreeDigest: string; expectedBindings: readonly { stepId: string | null; eventId: string | null }[]; recurrence: RecurrenceOccurrenceGuardV1 }
export interface TaskSaveCommandV1 {
  type: "task.save"; operationId: string; taskId: string; expectedRevision: number; expectedRepositoryRevision: number;
  payload: TaskSaveGuardsV1 & { version: 1; scope: AtomicScopeV1; draft: TaskSaveDraftV1 };
}
export interface RichStepV1 { id?: string; parentStepId: string | null; order: number; title: string; body: string; initial: InitialCompletionV1 }
export interface RichTaskDraftV1 { version: 1; id?: string; metadata: EditableMetadataV1; continuation: string; steps: readonly RichStepV1[]; initial: InitialCompletionV1 }
export interface TaskCreateRichCommandV1 {
  type: "task.createRich"; operationId: string; expectedRepositoryRevision: number; taskId?: never; expectedRevision?: never;
  payload: { version: 1; scope: AtomicScopeV1; draft: RichTaskDraftV1 };
}
export type AtomicTaskCommandV1 = TaskSaveCommandV1 | TaskCreateRichCommandV1;

export interface BindingReferenceV1 { taskId: string; stepId: string | null; eventId: string }
export interface EffectTargetStateV1 { completed: boolean; completedAt: number | null; binding: BindingReferenceV1 | null }
interface EffectBaseV1 { version: 1; index: number; taskId: string; stepId: string | null }
export type TargetEffectV1 = EffectBaseV1 & (
  { transition: "complete"; origin: "genuine-parent-completion" | "genuine-step-completion"; eventId: string; before: EffectTargetStateV1; after: EffectTargetStateV1 } |
  { transition: "initial"; origin: "initial-parent-completion" | "initial-step-completion"; eventId: string; before: null; after: EffectTargetStateV1 } |
  { transition: "reopen"; origin: "reopening"; eventId: string; before: EffectTargetStateV1; after: EffectTargetStateV1 } |
  { transition: "detach"; origin: "deletion-detachment"; eventId: string | null; before: EffectTargetStateV1; after: null }
);
export interface AtomicTaskEffectsV1 {
  version: 1; kind: "save" | "initialize"; taskId: string; changed: boolean;
  before: null | { taskRevision: number; contentRevision: number; taskDigest: string; treeDigest: string; bindingsDigest: string };
  after: { taskRevision: number; contentRevision: number; taskDigest: string };
  retainedStepIds: readonly string[]; insertedStepIds: readonly string[]; retiredStepIds: readonly string[];
  effects: readonly TargetEffectV1[]; digest: string;
}
export interface AtomicTaskSummaryV1 { version: 1; kind: "save" | "initialize"; taskId: string; stepIds: readonly string[]; createdEventIds: readonly string[]; reopenedEventIds: readonly string[]; retiredStepIds: readonly string[]; effectsDigest: string }

/** Proposed internal envelope versions. The outer wire version remains four. */
export interface PrivateBarrierV2 { version: 2; authorityId: string; minimumLogicalSchemaVersion: 1 | 2 | 3 | 4; requiredCapabilities: readonly string[]; importRecoveryScope: PrivateBarrierV1["importRecoveryScope"] }
export interface AtomicCreateHostOptionsV2 { version: 2; authorityId: string; partitions: readonly PartitionDefinition[]; reason: string; syntheticOnly: true; taskMutationVersion: 1 }
export interface AtomicJsonCreationFeatureV1 { taskMutationVersion: 1 }
/** Creation-only: opening must discover the persisted barrier, never enable it. */
export interface AtomicMemoryCreationFeatureV1 { taskMutationVersion: 1 }
export type AtomicRootRecoveryPolicyV1 = { version: 1; enabled: true; knownFallback: "all-mutations-and-replay-blocked"; clearOperation: false };

export type AtomicApplicationActionV2 =
  { kind: "full-save"; target: ExistingTargetV1; guards: TaskSaveGuardsV1; draft: TaskSaveDraftV1 } |
  { kind: "rich-create"; draft: RichTaskDraftV1 };
export interface AtomicActionEnvelopeV2 { version: 2; operationId: string; reason: string; authority: NativeAuthorityV1; owner: WorkspaceRef; guard: NativeActionGuardV1; action: AtomicApplicationActionV2 }
export type FutureApplicationEnvelope = ActionEnvelopeV1 | AtomicActionEnvelopeV2;

export interface CompletionEffectExcerptV2 {
  version: 1; effectsDigest: string; index: number; taskId: string; stepId: string | null; eventId: string;
  transition: "complete" | "initial"; origin: "genuine-parent-completion" | "genuine-step-completion" | "initial-parent-completion" | "initial-step-completion";
}
export type CompletionEventEvidenceV2 = Omit<CompletionEventEvidenceV1, "origin"> & { origin: CompletionEventEvidenceV1["origin"] | "task-save-completion" | "initial-completed-step" };
export type CompletionReceiptEvidenceV2 = CompletionReceiptEvidenceV1 & { atomicEffect: CompletionEffectExcerptV2 | null };
export type CompletionProofRequestV2 = Omit<CompletionProofRequestV1, "version"> & { version: 2 };
export type CompletionProofRowV2 = Omit<CompletionProofRowV1, "event" | "creation"> & { event: CompletionEventEvidenceV2 | null; creation: CompletionReceiptEvidenceV2 | null };
export type CompletionProofReadV2 = Omit<CompletionProofReadV1, "version" | "rows"> & { version: 2; rows: readonly CompletionProofRowV2[] };
export interface CompletionEvidencePortV2 {
  readCurrentCompletionProof(request: CompletionProofRequestV2, signal?: AbortSignal): Promise<CompletionProofReadV2>;
  subscribeInvalidations: CompletionEvidencePortV1["subscribeInvalidations"];
}
/** Future adapter overload; no implementation or new persistence is provided by A. */
export interface AtomicProofSelectionV2 { completionProofVersion: 2; evidence: CompletionEvidencePortV2; targets: readonly NativeTargetV1[]; enrollmentOrder: EnrollmentOrderV1 }
export interface DeferredEditorDraftV1 {
  version: 1; privacy: "local-private"; authorityId: string; head: NativeHeadV1; owner: WorkspaceRef; partitionId: string;
  taskId: string; taskRevision: number; expectedPartitionRevision: number; ownerContextPin: string; identityPin: string | null; inventoryPin: string; phasePin: string;
  currentCompletion: readonly { stepId: string | null; completed: boolean; completedAt: number | null }[];
  guards: TaskSaveGuardsV1; draft: TaskSaveDraftV1;
}
