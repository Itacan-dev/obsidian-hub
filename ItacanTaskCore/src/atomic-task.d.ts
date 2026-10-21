/** Atomic participant in the existing repository transaction; no independent writer. */
export type { CompletionIntentV1, InitialCompletionV1, AtomicScopeV1, EditableMetadataV1, RecurrenceOccurrenceGuardV1, SavedStepV1, TaskSaveDraftV1, TaskSaveGuardsV1, TaskSaveCommandV1, RichStepV1, RichTaskDraftV1, TaskCreateRichCommandV1, AtomicTaskCommandV1, AtomicTaskEffectsV1, TargetEffectV1, AtomicTaskSummaryV1 } from "../atomic-task/contracts";
import type { AtomicTaskCommandV1, RecurrenceOccurrenceGuardV1 } from "../atomic-task/contracts";
import type { NativeTask } from "./contracts";
export function validateCommand(command: AtomicTaskCommandV1): void;
export function recurrenceGuard(state: unknown, task: NativeTask): RecurrenceOccurrenceGuardV1;
