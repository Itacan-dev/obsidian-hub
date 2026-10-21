import { TaskHandle } from "./task-service-contract";
/** Converts existing indexed values; never allocates identities or writes. */
export function legacyTaskHandle(task: { path: string; line: number; text: string; hubTaskId?: string | null }): Extract<TaskHandle, { kind: "legacy" }>;
