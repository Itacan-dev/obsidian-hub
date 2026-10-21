import type { AtomicTaskCommandV1, TaskSaveCommandV1, TaskCreateRichCommandV1, TaskSaveDraftV1, AtomicScopeV1, CompletionIntentV1, InitialCompletionV1, SavedStepV1, AtomicTaskEffectsV1, TargetEffectV1, AtomicActionEnvelopeV2, CompletionEvidencePortV2, CompletionProofRequestV2, AtomicCreateHostOptionsV2, PrivateBarrierV2, DeferredEditorDraftV1 } from "../contracts";
import type { Command } from "../../src/contracts";
import type { CompletionEvidencePortV1 } from "../../oath/completion-proof";
const scope: AtomicScopeV1 = { authorityId: "authority", owner: { type: "resource", id: "study" }, partitionId: "study", expectedPartitionRevision: 0, inventoryPin: "pin" };
const draft: TaskSaveDraftV1 = { version: 1, metadata: { title: "Task", description: "", importance: null, start: null, due: { date: "2028-02-29", time: null }, location: null, phase: null }, continuation: "", steps: [], deletions: [], parentCompletion: { kind: "keep" } };
const save: TaskSaveCommandV1 = { type: "task.save", operationId: "save", taskId: "task", expectedRevision: 1, expectedRepositoryRevision: 1, payload: { version: 1, scope, expectedContentRevision: 0, expectedTreeDigest: "digest", expectedBindings: [{ stepId: null, eventId: null }], recurrence: { kind: "none" }, draft } };
const create: TaskCreateRichCommandV1 = { type: "task.createRich", operationId: "create", expectedRepositoryRevision: 0, payload: { version: 1, scope, draft: { version: 1, metadata: draft.metadata, continuation: "Body", steps: [{ id: "step", parentStepId: null, order: 0, title: "Same", body: "Body", initial: { completed: true, completedAt: null } }], initial: { completed: false, completedAt: null } } } };
const commands: readonly AtomicTaskCommandV1[] = [save, create]; void commands;
const completion: CompletionIntentV1 = { kind: "complete", completedAt: null }; void completion;
// @ts-expect-error keep cannot retimestamp a completed target
const retimestamp: CompletionIntentV1 = { kind: "keep", completedAt: 1 };
// @ts-expect-error open initial state has explicit null time
const openWithTime: InitialCompletionV1 = { completed: false, completedAt: 1 };
// @ts-expect-error new Step uses initial state, not a retained-target transition
const invalidNew: SavedStepV1 = { id: "s", parentStepId: null, order: 0, title: "S", body: "", state: "new", completion: { kind: "complete" } };
// @ts-expect-error retained Step cannot override initial state
const invalidRetained: SavedStepV1 = { id: "s", parentStepId: null, order: 0, title: "S", body: "", state: "existing", initial: { completed: true } };
// @ts-expect-error complete metadata cannot omit description
const missingMetadata: TaskSaveDraftV1["metadata"] = { title: "T", importance: null, start: null, due: null, location: null, phase: null };
// @ts-expect-error current content guard is mandatory
const missingContent: TaskSaveCommandV1["payload"] = { version: 1, scope, expectedTreeDigest: "d", expectedBindings: [], recurrence: { kind: "none" }, draft };
// @ts-expect-error rich creation cannot target an existing task revision
const existingCreate: TaskCreateRichCommandV1 = { ...create, taskId: "existing" };
// @ts-expect-error ordinary rich creation has no migration carrier
const provenance: TaskCreateRichCommandV1["payload"]["draft"] = { ...create.payload.draft, migration: { source: "legacy" } };
// @ts-expect-error ordinary rich Step has no source clocks
const clocks: TaskCreateRichCommandV1["payload"]["draft"]["steps"][number] = { ...create.payload.draft.steps[0], createdAt: 123 };
// @ts-expect-error proposed commands have not been added to the actual dispatcher union
const actualCommand: Command = save;
const hostCreation: AtomicCreateHostOptionsV2 = { version: 2, authorityId: "a", partitions: [], reason: "Disposable", syntheticOnly: true, taskMutationVersion: 1 }; void hostCreation;
// @ts-expect-error creation is explicit and synthetic only
const realHost: AtomicCreateHostOptionsV2 = { ...hostCreation, syntheticOnly: false };
const barrier: PrivateBarrierV2 = { version: 2, authorityId: "a", minimumLogicalSchemaVersion: 1, requiredCapabilities: ["private-native-storage-v1", "atomic-task-mutations-v1"], importRecoveryScope: null }; void barrier;
declare const effect: TargetEffectV1;
if (effect.transition === "initial") { const noCommittedBefore: null = effect.before; void noCommittedBefore; }
declare const effects: AtomicTaskEffectsV1; effects.effects.forEach(e => { const index: number = e.index; void index; });
declare const envelope: AtomicActionEnvelopeV2;
if (envelope.action.kind === "full-save") { const taskRevision: number = envelope.action.target.expectedTaskRevision; void taskRevision; }
// @ts-expect-error atomic application envelope is explicitly native only
const legacyEnvelope: AtomicActionEnvelopeV2 = { ...envelope, authority: { backend: "legacy-markdown", applicationContextId: "app" } };
declare const port: CompletionEvidencePortV2, request: CompletionProofRequestV2;
port.readCurrentCompletionProof(request).then(proof => { const version: 2 = proof.version; void version; proof.rows.forEach(r => r.creation?.atomicEffect?.effectsDigest); });
// @ts-expect-error v2 proof cannot be substituted for a v1 provider without negotiation
const v1: CompletionEvidencePortV1 = port;
declare const editor: DeferredEditorDraftV1; const guardedDraft: TaskSaveDraftV1 = editor.draft; void guardedDraft;
