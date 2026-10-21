import type { RecordedHistoryProjection, StatisticsCompletionProjection } from "./contracts";
export type DurableRecordedHistory = RecordedHistoryProjection & { repositoryRevision: number };
export type DurableStatisticsHistory = StatisticsCompletionProjection & { repositoryRevision: number };
/** Receives a validated detached private state. No store is opened or mutated. */
export function projectDurableHistoryCompatibility(state: unknown, options: {version:1;projection:"recorded"}): DurableRecordedHistory;
export function projectDurableHistoryCompatibility(state: unknown, options: {version:1;projection:"statistics"}): DurableStatisticsHistory;
