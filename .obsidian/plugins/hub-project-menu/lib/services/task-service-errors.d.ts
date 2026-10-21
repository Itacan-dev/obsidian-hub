export class TaskServiceError extends Error {
    constructor(code: string, message: string, details?: Record<string, unknown>, cause?: unknown);
    code: string; details: Record<string, unknown>; cause?: unknown;
}
