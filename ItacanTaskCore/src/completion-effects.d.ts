import type { AtomicTaskEffectsV1, AtomicTaskSummaryV1, CompletionEffectExcerptV2 } from "../atomic-task/contracts";
import type { NativeTask, Receipt } from "./contracts";
export function validateReceipt(state: unknown, receipt: Receipt): AtomicTaskEffectsV1;
export function validateState(state: unknown): void;
export function selectedEffect(state: unknown, receipt: Receipt, eventId: string): CompletionEffectExcerptV2 | null;
export function summary(task: NativeTask, effects: AtomicTaskEffectsV1): AtomicTaskSummaryV1;
export function hash(value: unknown): string;
export function ordered<T extends {id:string;parentStepId:string|null;order:number}>(steps: readonly T[]): T[];
