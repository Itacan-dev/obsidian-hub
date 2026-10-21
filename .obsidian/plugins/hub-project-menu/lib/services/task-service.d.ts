import { TaskServiceAdapter, TaskOperations, TaskServiceLifecycle, TaskCapabilities, TaskChange, TaskReadProtocol } from "./task-service-contract";
export * from "./task-service-contract";
export interface TaskService extends TaskOperations, TaskServiceLifecycle, TaskReadProtocol {}
export class TaskService {
    constructor(adapter: TaskServiceAdapter);
    capabilities(): TaskCapabilities;
    subscribe(listener: (change: TaskChange) => void | Promise<void>): () => void;
    close(): Promise<void>;
}
export const TASK_SERVICE_OPERATIONS: readonly (keyof TaskOperations)[];
