import { ReadFeature, ReadOperation, TaskReadiness, TaskReadRequest, TaskReadResult, TaskReadInvalidation, TaskServiceAdapter } from "./task-service-contract";
export const READ_FEATURES: readonly ReadFeature[];
export const READ_OPERATIONS: readonly ReadOperation[];
export function taskReadiness(adapter: TaskServiceAdapter, required?: ReadFeature[]): Promise<TaskReadiness>;
export function readTaskContract(adapter: TaskServiceAdapter, request: TaskReadRequest): Promise<TaskReadResult>;
export function subscribeTaskReads(adapter: TaskServiceAdapter, listener: (change: TaskReadInvalidation) => void): () => void;
