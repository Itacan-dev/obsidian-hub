import { createHash, randomUUID } from "node:crypto";
import { Coverage, DocumentRecord, Evidence, ExtractionStatus, ReadOnlyHost, Scope, checkAbort, isAbort } from "../contracts";
import { EligibilityPolicy, extension, sizeLimit, vaultPath, within } from "./eligibility";
import { PdfReader, extract } from "./extractors";
import { chunks } from "./chunking";
import { LocalIndex } from "./index";

export const contentHash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
export class KnowledgeService {
  private index = new LocalIndex();
  readonly documents = new Map<string, DocumentRecord>();
  readonly statuses = new Map<string, ExtractionStatus>();
  private stamps = new Map<string, string>();
  private refreshJob?: Promise<void>;
  private lifetime = new AbortController();
  private epoch = 0;
  private bytesIndexed = 0;
  private dirty = true;
  coverage: Coverage = { discovered: 0, indexed: 0, skipped: 0, indexing: false, complete: false };
  constructor(readonly host: ReadOnlyHost, readonly policy: EligibilityPolicy, readonly identities: Record<string, string>, private readonly pdf?: PdfReader, private readonly changed: () => void = () => {}) {}
  currentPath(id: string): string | null { return Object.keys(this.identities).find(path => this.identities[path] === id) ?? null; }
  permitted(evidence: Evidence): boolean { const path = this.currentPath(evidence.documentId); return !!path && this.host.allowed(path) && this.policy.supports(path) && this.statuses.get(path)?.status !== "excluded"; }
  rename(oldPath: string, path: string): void {
    for (const key of Object.keys(this.identities)) if (within(key, oldPath)) {
      this.identities[path + key.slice(oldPath.length)] = this.identities[key]; delete this.identities[key];
    }
    this.clear();
  }
  clear(): void {
    this.epoch++; this.lifetime.abort(); this.lifetime = new AbortController();
    this.index = new LocalIndex(); this.documents.clear(); this.statuses.clear(); this.stamps.clear(); this.bytesIndexed = 0; this.dirty = true;
    this.coverage = { discovered: 0, indexed: 0, skipped: 0, indexing: false, complete: false }; this.changed();
  }
  cancelRefresh(): void {
    this.epoch++; this.lifetime.abort(); this.lifetime = new AbortController(); this.dirty = true;
    this.coverage.indexing = false; this.coverage.complete = false; this.changed();
  }
  private drop(path: string): void {
    const document = this.documents.get(path);
    if (document) this.bytesIndexed -= document.segments.reduce((sum, segment) => sum + Buffer.byteLength(segment.text), 0);
    this.index.remove(path); this.documents.delete(path); this.stamps.delete(path);
  }
  invalidate(path?: string): void {
    if (!path) { this.clear(); return; }
    if (!this.policy.allowsPath(path)) return;
    this.epoch++; this.lifetime.abort(); this.lifetime = new AbortController();
    for (const key of this.documents.keys()) if (within(key, path)) {
      this.drop(key); this.statuses.delete(key);
    }
    this.dirty = true; this.coverage.complete = false; this.coverage.indexing = false; this.changed();
  }
  async refresh(signal = new AbortController().signal, force = false): Promise<void> {
    checkAbort(signal);
    while (this.refreshJob) {
      try { await this.refreshJob; } catch (error) { checkAbort(signal); if (!isAbort(error)) throw error; }
      checkAbort(signal); if (!this.dirty) return;
    }
    if (!this.dirty && !force) return;
    const epoch = this.epoch, ownSignal = this.lifetime.signal;
    this.refreshJob = this.build(AbortSignal.any([signal, ownSignal]), epoch).finally(() => { this.refreshJob = undefined; });
    await this.refreshJob;
  }
  private async build(signal: AbortSignal, epoch: number): Promise<void> {
    this.dirty = true; this.coverage.complete = false; this.coverage.indexing = true; this.changed();
    try {
      const files = await this.host.list(signal);
      checkAbort(signal);
      this.coverage.discovered = files.length;
      const paths = new Set(files.map(file => file.path));
      for (const key of this.documents.keys()) if (!paths.has(key)) this.drop(key);
      for (const key of this.statuses.keys()) if (!paths.has(key)) this.statuses.delete(key);
      this.bytesIndexed = [...this.documents.values()].reduce((total, document) => total + document.segments.reduce((sum, segment) => sum + Buffer.byteLength(segment.text), 0), 0);
      let cursor = 0;
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (cursor < files.length) {
          const file = files[cursor++]; checkAbort(signal);
          if (!this.policy.supports(file.path) || !this.host.allowed(file.path)) { this.drop(file.path); this.statuses.set(file.path, { path: file.path, status: this.policy.supports(file.path) ? "excluded" : "unsupported" }); continue; }
          if (file.size > sizeLimit(file.path)) { this.drop(file.path); this.statuses.set(file.path, { path: file.path, status: "oversized" }); continue; }
          const stamp = `${file.size}:${file.mtime}`;
          if (this.stamps.get(file.path) === stamp) continue;
          // Failed replacement extraction must not leave an older searchable revision behind.
          this.drop(file.path);
          if (this.bytesIndexed >= 50 * 1024 * 1024 || this.documents.size >= 10000) { this.statuses.set(file.path, { path: file.path, status: "capacity" }); continue; }
          try {
            const read = await this.host.read(file, signal), revision = contentHash(read.bytes);
            const extracted = await extract(file.path, read.bytes, signal, this.pdf);
            checkAbort(signal);
            if (epoch !== this.epoch || !this.host.allowed(file.path)) continue;
            if (!extracted.segments.length) { this.statuses.set(file.path, { path: file.path, status: extension(file.path) === "pdf" ? "scanned" : "failed", message: "No usable text was found." }); continue; }
            const id = Object.hasOwn(this.identities, file.path) ? this.identities[file.path] : (this.identities[file.path] = randomUUID());
            const document = { id, path: file.path, revision, format: extension(file.path), ...extracted };
            const previousSize = this.documents.get(file.path)?.segments.reduce((sum, segment) => sum + Buffer.byteLength(segment.text), 0) ?? 0;
            const size = extracted.segments.reduce((sum, segment) => sum + Buffer.byteLength(segment.text), 0);
            if (this.bytesIndexed - previousSize + size > 50 * 1024 * 1024 || (!this.documents.has(file.path) && this.documents.size >= 10000)) { this.statuses.set(file.path, { path: file.path, status: "capacity" }); continue; }
            this.index.remove(file.path);
            this.documents.set(file.path, document);
            for (const chunk of chunks(document)) this.index.add(chunk, document.searchLabels);
            this.bytesIndexed += size - previousSize;
            this.stamps.set(file.path, stamp); this.statuses.set(file.path, { path: file.path, status: "indexed", message: extracted.warnings.join(" ") || undefined });
          } catch (error) {
            checkAbort(signal);
            const message = error instanceof Error ? error.message : "Extraction failed.";
            this.statuses.set(file.path, { path: file.path, status: /password/i.test(message) ? "password" : /timeout|timed out/i.test(message) ? "timeout" : /sensitive|excluded/i.test(message) ? "excluded" : "failed", message: message.slice(0, 160) });
          }
          this.coverage.indexed = this.documents.size; this.changed();
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }));
      checkAbort(signal);
      this.dirty = false;
      this.coverage.skipped = [...this.statuses.values()].filter(item => item.status !== "indexed").length;
      this.coverage.complete = ![...this.statuses.values()].some(item => ["capacity", "failed", "timeout"].includes(item.status));
    } finally { if (epoch === this.epoch) { this.coverage.indexed = this.documents.size; this.coverage.indexing = false; this.changed(); } }
  }
  async search(query: string, scope: Scope, signal: AbortSignal, activePath?: string | null): Promise<Evidence[]> {
    await this.refresh(signal); checkAbort(signal);
    let root: string | null = null;
    if (scope.kind === "folder") root = vaultPath(scope.path);
    if (scope.kind === "project") { root = this.host.projectRoot(scope.id); if (!root) return []; }
    const inScope = (path: string) => scope.kind === "document" ? path === scope.path : root ? within(path, root) : true;
    let found = this.index.search(query).filter(item => inScope(item.path) && this.host.allowed(item.path) && this.documents.get(item.path)?.revision === item.revision);
    if (activePath && inScope(activePath) && this.host.allowed(activePath)) {
      const document = this.documents.get(activePath);
      if (document) found = [...chunks(document).slice(0, 2), ...found];
    }
    const unique = new Set<string>(), selected: Evidence[] = [], paths = new Set<string>();
    for (const hit of found) {
      const key = `${hit.documentId}:${hit.location.page}:${hit.location.cell}:${hit.location.startLine}:${hit.location.startColumn}`;
      if (unique.has(key) || (!paths.has(hit.path) && paths.size >= 4)) continue;
      unique.add(key); paths.add(hit.path); selected.push({ ...hit, sourceId: `S${selected.length + 1}` });
      if (selected.length === 6) break;
    }
    return selected;
  }
  async validate(evidence: Evidence[], signal: AbortSignal): Promise<boolean> {
    const seen = new Map<string, string>();
    for (const item of evidence) {
      checkAbort(signal);
      if (!this.permitted(item)) return false;
      const path = this.currentPath(item.documentId)!;
      try {
        if (!seen.has(path)) seen.set(path, contentHash((await this.host.read({ path, size: 0, mtime: 0 }, signal)).bytes));
        if (seen.get(path) !== item.revision) { this.invalidate(path); return false; }
      } catch { checkAbort(signal); this.invalidate(path); return false; }
    }
    return true;
  }
  dispose(): void { this.lifetime.abort(); this.documents.clear(); this.statuses.clear(); }
}
