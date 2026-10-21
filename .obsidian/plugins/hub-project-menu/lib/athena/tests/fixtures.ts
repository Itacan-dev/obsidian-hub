import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import type { App } from "obsidian";
import { ObsidianHost } from "../src/host/obsidian-host";
import { EligibilityPolicy } from "../src/knowledge/eligibility";
import { FileRef, ReadOnlyHost, ReadResult } from "../src/contracts";
export class MemoryHost implements ReadOnlyHost {
  readonly files = new Map<string, string | Uint8Array>();
  readonly reads: string[] = [];
  restricted = new Set<string>();
  active: string | null = null;
  constructor(readonly policy: EligibilityPolicy) {}
  allowed(path: string): boolean { return this.policy.supports(path) && !this.restricted.has(path); }
  activePath(): string | null { return this.active; }
  projectRoot(id: string): string | null { return id === "p" ? "Research" : null; }
  async list(): Promise<FileRef[]> { return [...this.files].filter(([path]) => this.policy.allowsPath(path)).map(([path, value]) => ({ path, size: typeof value === "string" ? Buffer.byteLength(value) : value.length, mtime: 1 })); }
  async read(file: FileRef): Promise<ReadResult> { this.reads.push(file.path); if (!this.allowed(file.path)) throw Error("excluded"); const value = this.files.get(file.path); if (value === undefined) throw Error("missing"); return { bytes: typeof value === "string" ? Buffer.from(value) : value, mtime: 1 }; }
}
export async function temporary() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "athena-test-"));
  return { directory, async cleanup() { const resolved = path.resolve(directory); if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("athena-test-")) throw Error("Unexpected cleanup path"); await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } };
}
export function diskHost(directory: string, policy: EligibilityPolicy) {
  const reads: string[] = [];
  const adapter = {
    async list(folder: string) { const entries = await fs.readdir(path.join(directory, folder), { withFileTypes: true }); return { files: entries.filter(item => !item.isDirectory()).map(item => folder ? `${folder}/${item.name}` : item.name), folders: entries.filter(item => item.isDirectory()).map(item => folder ? `${folder}/${item.name}` : item.name) }; },
    async readBinary(file: string) { reads.push(file); const bytes = await fs.readFile(path.join(directory, file)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }
  };
  const app = { vault: { adapter, getFiles: () => [], getAbstractFileByPath: () => null }, workspace: { getActiveFile: () => null } } as unknown as App;
  return { host: new ObsidianHost(app, policy, { basePath: directory, canRead: () => true, projectRoot: () => null }), reads };
}
export function syntheticPdf(text = "Athena synthetic PDF copper calibration 520 nm"): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let result = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((value, index) => { offsets.push(Buffer.byteLength(result)); result += `${index + 1} 0 obj\n${value}\nendobj\n`; });
  const xref = Buffer.byteLength(result); result += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(result);
}
