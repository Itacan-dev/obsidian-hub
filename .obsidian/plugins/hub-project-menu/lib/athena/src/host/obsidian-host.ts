import type { App, TFile } from "obsidian";
import { AthenaError, FileRef, ReadOnlyHost, ReadResult, abortable, checkAbort } from "../contracts";
import { EligibilityPolicy, sizeLimit, vaultPath } from "../knowledge/eligibility";
import { PathGuard } from "./path-guard";

export interface HostOptions { basePath: string; canRead: (path: string) => boolean; projectRoot: (id: string) => string | null }
export class ObsidianHost implements ReadOnlyHost {
  readonly guard: PathGuard;
  constructor(private readonly app: App, readonly policy: EligibilityPolicy, private readonly options: HostOptions) { this.guard = new PathGuard(options.basePath); }
  allowed(path: string): boolean { try { return this.policy.supports(path) && this.options.canRead(path); } catch { return false; } }
  activePath(): string | null { const path = this.app.workspace.getActiveFile()?.path; return path && this.allowed(path) ? path : null; }
  projectRoot(id: string): string | null { return this.options.projectRoot(id); }
  list(signal: AbortSignal): Promise<FileRef[]> { return abortable(this.discover(signal), signal); }
  private async discover(signal: AbortSignal): Promise<FileRef[]> {
    checkAbort(signal);
    const files = new Map<string, FileRef>();
    for (const file of this.app.vault.getFiles()) if (this.policy.allowsPath(file.path)) files.set(file.path, { path: file.path, size: file.stat.size, mtime: file.stat.mtime });
    const pending = [""], seen = new Set<string>();
    // Adapter discovery includes supported code/text files absent from the loaded catalog.
    while (pending.length) {
      checkAbort(signal);
      const folder = pending.shift()!;
      if (seen.has(folder)) continue;
      seen.add(folder);
      if (seen.size > 20000 || files.size > 20000) throw new AthenaError("Discovery limit reached. Narrow the retrieval scope with exclusions.");
      if (folder) {
        if (!this.policy.allowsPath(folder, true)) continue;
        try { await this.guard.check(folder, true); } catch { checkAbort(signal); continue; }
        checkAbort(signal); if (!this.policy.allowsPath(folder, true)) continue;
      }
      let listed: { files: string[]; folders: string[] };
      try { listed = await this.app.vault.adapter.list(folder); }
      catch { throw new AthenaError("Some vault folders could not be enumerated. Exclude unavailable folders and refresh."); }
      checkAbort(signal);
      for (const child of listed.folders) if (this.policy.allowsPath(child, true)) pending.push(vaultPath(child));
      for (const candidate of listed.files) {
        if (!this.policy.allowsPath(candidate) || files.has(candidate)) continue;
        try {
          const stat = await this.guard.check(candidate) as { size: number; mtime: number };
          checkAbort(signal);
          files.set(candidate, { path: candidate, ...stat });
        } catch { checkAbort(signal); /* Disallowed links and disappeared entries are never read. */ }
      }
    }
    return [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
  }
  read(file: FileRef, signal: AbortSignal): Promise<ReadResult> { return abortable(this.readCurrent(file, signal), signal); }
  private async readCurrent(file: FileRef, signal: AbortSignal): Promise<ReadResult> {
    checkAbort(signal);
    if (!this.allowed(file.path)) throw new AthenaError("Source is excluded or unavailable during this Oath.");
    const before = await this.guard.check(file.path) as { size: number; mtime: number };
    checkAbort(signal);
    if (!this.allowed(file.path)) throw new AthenaError("Source is now excluded.");
    if (before.size > sizeLimit(file.path)) throw new AthenaError("Source exceeds the file-size limit.");
    const loaded = this.app.vault.getAbstractFileByPath(file.path);
    // Fresh native reads establish citation revisions even before Obsidian's cache catches up.
    const bytes = new Uint8Array(loaded && !Array.isArray((loaded as unknown as { children?: unknown }).children)
      ? await this.app.vault.readBinary(loaded as TFile) : await this.app.vault.adapter.readBinary(file.path));
    checkAbort(signal);
    const after = await this.guard.check(file.path) as { size: number; mtime: number };
    if (!this.allowed(file.path)) throw new AthenaError("Source is now excluded.");
    if (bytes.byteLength > sizeLimit(file.path)) throw new AthenaError("Source exceeds the file-size limit.");
    if (before.mtime !== after.mtime || before.size !== after.size || bytes.length !== after.size) throw new AthenaError("Source changed while it was being read. Refresh and retry.");
    return { bytes, mtime: after.mtime };
  }
}
