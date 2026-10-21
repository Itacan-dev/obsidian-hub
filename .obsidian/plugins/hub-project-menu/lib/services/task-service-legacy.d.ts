import { TaskOperations, TaskServiceLifecycle, TaskCapabilities, TaskChange } from "./task-service-contract";
export interface LegacyTaskAdapter extends TaskOperations, TaskServiceLifecycle {}
export class LegacyTaskAdapter {
    /** Host objects are deliberately confined to this adapter's injection boundary. */
    constructor(options: { plugin: unknown; dataview: unknown; onSubscriberError?: (error: unknown) => void });
    capabilities(): TaskCapabilities;
    readiness(): import("./task-service-contract").ReadinessSnapshot;
    subscribe(listener: (change: TaskChange) => void | Promise<void>): () => void;
    close(): Promise<void>;
}
