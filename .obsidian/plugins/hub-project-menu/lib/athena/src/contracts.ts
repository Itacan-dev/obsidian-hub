export type AuthMode = "none" | "api-key" | "oauth" | "backend-session";
export interface ProviderDescriptor { id: string; name: string; location: "mock" | "local" | "cloud" | "backend"; authentication: AuthMode }
export interface ProviderCapabilities { streaming: boolean; tools: boolean; inputModalities?: ("text" | "image" | "audio")[]; usage?: boolean }
export interface ModelDescriptor extends ProviderCapabilities { id: string; name: string; digest?: string; contextLength: number }
export type ConnectionStatus = { state: "disconnected" | "connecting" | "ready" | "unavailable" | "authentication-required"; message: string };
export interface FileRef { path: string; size: number; mtime: number }
export interface ReadResult { bytes: Uint8Array; mtime: number }
export interface ReadOnlyHost {
  list(signal: AbortSignal): Promise<FileRef[]>;
  read(file: FileRef, signal: AbortSignal): Promise<ReadResult>;
  allowed(path: string): boolean;
  activePath(): string | null;
  projectRoot(id: string): string | null;
}
export type Scope = { kind: "vault" } | { kind: "folder"; path: string } | { kind: "document"; path: string } | { kind: "project"; id: string };
export interface SourceLocation { startLine: number; endLine: number; startColumn?: number; heading?: string; page?: number; cell?: string }
export interface Segment { text: string; location: SourceLocation }
export interface DocumentRecord { id: string; path: string; revision: string; format: string; segments: Segment[]; warnings: string[]; searchLabels?: string[] }
export interface Evidence { sourceId: string; documentId: string; path: string; revision: string; text: string; location: SourceLocation }
export interface ExtractionStatus { path: string; status: "indexed" | "excluded" | "unsupported" | "oversized" | "failed" | "scanned" | "password" | "timeout" | "capacity"; message?: string }
export interface Coverage { discovered: number; indexed: number; skipped: number; indexing: boolean; complete: boolean }
export interface GenerationRequest {
  model: string;
  instructions: string;
  history: { role: "user" | "assistant"; text: string }[];
  question: string;
  evidence: Evidence[];
  contextLength: number;
  outputTokens: number;
}
export type ProviderEvent = { type: "text"; text: string } | { type: "complete"; usage?: { inputTokens?: number; outputTokens?: number; durationMs?: number } };
export interface ModelProvider {
  readonly descriptor: ProviderDescriptor;
  connect(signal: AbortSignal): Promise<ConnectionStatus>;
  listModels(signal: AbortSignal): Promise<ModelDescriptor[]>;
  prepare?(model: string, signal: AbortSignal): Promise<void>;
  generate(request: GenerationRequest, signal: AbortSignal): AsyncIterable<ProviderEvent>;
  forgetContext?(): void;
  disconnect(): Promise<void>;
}
export interface AthenaSettings { enabled: boolean; provider: "ollama" | "mock"; port: number; model: string; contextLength: number; excluded: string[]; localOnlyConfirmed: boolean }
export interface Turn {
  id: string; question: string; answer: string; evidence: Evidence[]; provider: string; model: string;
  state: "retrieving" | "streaming" | "complete" | "cancelled" | "error" | "interrupted";
  createdAt: number; error?: string;
  dependencies?: Evidence[];
}
export interface Conversation { id: string; title: string; turns: Turn[] }
export interface AthenaState { version: 1; settings: AthenaSettings; conversations: Conversation[]; identities: Record<string, string> }
export const DEFAULT_SETTINGS: AthenaSettings = { enabled: false, provider: "ollama", port: 11434, model: "", contextLength: 4096, excluded: [], localOnlyConfirmed: false };
export function checkAbort(signal: AbortSignal): void { if (signal.aborted) throw new DOMException("Cancelled", "AbortError"); }
export function isAbort(error: unknown): boolean { return !!error && typeof error === "object" && "name" in error && error.name === "AbortError"; }
export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new DOMException("Cancelled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    work.then(value => { signal.removeEventListener("abort", abort); resolve(value); }, error => { signal.removeEventListener("abort", abort); reject(error); });
    if (signal.aborted) abort();
  });
}
export function safeMessage(error: unknown): string {
  if (error instanceof AthenaError) return error.message;
  if (isAbort(error)) return "Cancelled.";
  return "Athena could not complete this operation. Retry or refresh sources.";
}
export class AthenaError extends Error { constructor(message: string) { super(message); this.name = "AthenaError"; } }
