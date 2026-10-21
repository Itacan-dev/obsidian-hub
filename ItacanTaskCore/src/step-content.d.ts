import type { Json, WorkspaceRef, NativeTask } from "./contracts";
export interface PhysicalSource { documentId: string; path: string; root: string; revision: string; owner: WorkspaceRef }
export interface SourceTarget { taskId: string; stepId: string | null; taskRevision: number }
export interface SourceRange { start: number; end: number }
export interface CaptureRequest {
    id: string; version: 1; parserVersion: 1; source: PhysicalSource; target: SourceTarget; line: number;
    expectedRange: SourceRange | null; metadata: Json; explicitDescription: string | null;
}
export type SourceDiagnostic = "UNSUPPORTED_UTF8" | "NOT_TASK_LINE" | "FENCED_EXAMPLE" |
    "CHECKBOX_STATUS_UNINTERPRETED" | "TASKS_SYNTAX_UNINTERPRETED" | "HUB_ID_UNRECOGNIZED" |
    "HTML_COMMENT_UNINTERPRETED" | "LONE_CR_UNSUPPORTED" | "UNCLOSED_FENCE_REGION_AMBIGUOUS";
export interface ParsedSource {
    encoding: "utf-8" | "unsupported"; normalized: string | null; marker: string | null; title: string | null;
    continuation: string | null;
    steps: { line: number; startByte: number; endByte: number; parentIndex: number | null; order: number; title: string; marker: string }[];
    metadata: Json; explicitDescription: string | null; diagnostics: SourceDiagnostic[]; status: "supported-region" | "quarantined";
}
export interface SourceEnvelope {
    format: "itacan-private-source-envelope"; version: 1; parserVersion: 1; decisionRevision: string;
    id: string; privacy: "local-private"; source: PhysicalSource; target: SourceTarget;
    document: { sha256: string; byteLength: number };
    region: SourceRange & { line: number; insideFence: boolean };
    raw: { encoding: "utf-8" | "unsupported"; hex: string; sha256: string; eol: { lf: number; crlf: number; cr: number; finalNewline: boolean; bom: boolean } };
    unresolvedContext: (SourceRange & { hex: string; sha256: string }) | null;
    folderContext: { type: "source-parent-folder-evidence"; path: string; noteAssociation: false };
    parsed: ParsedSource; checksum: string;
}
interface DraftFields { id: string; parentStepId: string | null; order: number; title: string; body: string }
export type StepDraft = (DraftFields & { state: "existing"; completed: boolean }) | (DraftFields & { state: "new"; completed: false });
export interface TaskStepDraft { version: 1; taskId: string; expectedRevision: number; steps: StepDraft[] }
export interface SubtreeDeletion { stepId: string; cascade: boolean; descendantIds: string[] }
export interface ContentEdit { version: 1; expectedRevision: number; appendOriginals: SourceEnvelope[]; continuation: string }
export interface StructuralEditPayload {
    version: 1; draft: TaskStepDraft; deletions: SubtreeDeletion[];
    taskPatch: Partial<Pick<NativeTask, "title" | "description">>; content: ContentEdit | null;
}
export interface CurrentSearchSpecimen {
    version: 1; kind: "current-native-search-specimen"; id: string; owner: WorkspaceRef; title: string; description: string;
    continuation: string; steps: { id: string; parentStepId: string | null; order: number; title: string; body: string }[];
    metadata: Pick<NativeTask, "importance" | "start" | "due" | "phase">; parity: string;
}
export const CONTENT_DECISION: string;
export function captureSourceEnvelope(bytes: Uint8Array, request: CaptureRequest): SourceEnvelope;
export function validateEnvelope(envelope: unknown): SourceEnvelope;
export function originalBytes(envelope: SourceEnvelope): Uint8Array;
export function verifySourceEnvelope(envelope: SourceEnvelope, bytes: Uint8Array, source: PhysicalSource): true;
export function currentSearchProjection(task: NativeTask, expectedOwner: WorkspaceRef): CurrentSearchSpecimen;
