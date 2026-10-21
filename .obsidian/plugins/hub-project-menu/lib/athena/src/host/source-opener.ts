import type { App, TFile } from "obsidian";
import { AthenaError, ReadOnlyHost, SourceLocation, checkAbort } from "../contracts";

export async function openVerifiedSource(host: ReadOnlyHost, app: App, path: string, location: SourceLocation, signal: AbortSignal): Promise<void> {
  if (!/\.(md|pdf)$/i.test(path)) throw new AthenaError("Use the inert excerpt preview for this format.");
  // Enforce containment, links, size and live permissions again at the opening boundary.
  await host.read({ path, size: 0, mtime: 0 }, signal); checkAbort(signal);
  if (!host.allowed(path)) throw new AthenaError("This source is now restricted.");
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || !("extension" in file) || file.path !== path) throw new AthenaError("The source is no longer available.");
  const pdf = /\.pdf$/i.test(path), page = Math.max(1, location.page ?? 1);
  // Open the verified file object directly; filenames are never parsed as URLs or links.
  await app.workspace.getLeaf(true).openFile(file as TFile, { active: true,
    eState: pdf ? { subpath: `#page=${page}` } : { line: Math.max(0, location.startLine - 1) },
    ...(pdf ? { state: { page } } : {}) });
}
