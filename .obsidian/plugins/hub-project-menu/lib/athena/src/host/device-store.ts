import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { AthenaError } from "../contracts";

export function deviceRoot(): string {
  if (process.platform === "win32") return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Itacan", "Athena");
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Itacan", "Athena");
  return path.join(process.env.XDG_DATA_HOME && path.isAbsolute(process.env.XDG_DATA_HOME) ? process.env.XDG_DATA_HOME : path.join(os.homedir(), ".local", "share"), "itacan", "athena");
}
async function prospectiveLocation(target: string): Promise<string> {
  let ancestor = target; const missing: string[] = [];
  while (true) {
    try { return path.join(await fs.realpath(ancestor), ...missing); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT" || path.dirname(ancestor) === ancestor) throw error; missing.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  }
}
export class DeviceStore {
  private pending = Promise.resolve();
  private signature: string | null | undefined;
  private constructor(readonly directory: string) {}
  static async open(vault: string, root = deviceRoot()): Promise<DeviceStore> {
    const canonical = await fs.realpath(vault);
    const outside = (target: string) => {
      const relative = path.relative(canonical, target);
      if (!relative || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))) throw new AthenaError("Athena's device store must be outside the vault.");
    };
    const absolute = path.resolve(root); outside(absolute);
    // Resolve existing ancestors before creating anything, including redirected app-data roots.
    root = await prospectiveLocation(absolute); outside(root);
    const identity = createHash("sha256").update(process.platform === "win32" ? canonical.toLowerCase() : canonical).digest("hex");
    const directory = await prospectiveLocation(path.join(root, "vaults", identity)); outside(directory);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    // A redirected device-store directory must not point back into the vault.
    const actual = await fs.realpath(directory); outside(actual);
    return new DeviceStore(actual);
  }
  private file(): string { return path.join(this.directory, "state.json"); }
  private async bytes(): Promise<string | null> {
    try { const stat = await fs.lstat(this.file()); if (stat.isSymbolicLink() || !stat.isFile()) throw new AthenaError("Athena history must be a regular device-local file."); if (stat.size > 16 * 1024 * 1024) throw new AthenaError("Athena history exceeds its storage limit. Preserve the file before recovery."); return await fs.readFile(this.file(), "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  async load(): Promise<unknown> {
    const bytes = await this.bytes(); this.signature = bytes;
    if (bytes === null) return null;
    try { return JSON.parse(bytes); } catch { throw new AthenaError("Athena history is malformed. The original has been preserved; restore a valid copy before continuing."); }
  }
  save(value: unknown): Promise<void> {
    const text = JSON.stringify(value);
    if (Buffer.byteLength(text) > 16 * 1024 * 1024) return Promise.reject(new AthenaError("Athena history is full. Delete an older conversation before saving more."));
    const operation = this.pending.catch(() => {}).then(async () => {
      const current = await this.bytes();
      if (this.signature !== undefined && current !== this.signature) throw new AthenaError("Athena history changed in another process. Reload before saving.");
      if (current === text) return;
      const temporary = path.join(this.directory, `.state-${randomUUID()}.tmp`);
      try {
        const handle = await fs.open(temporary, "wx", 0o600);
        try { await handle.writeFile(text, "utf8"); await handle.sync(); } finally { await handle.close(); }
        await fs.rename(temporary, this.file()); this.signature = text;
      } finally { await fs.unlink(temporary).catch(() => {}); }
    });
    this.pending = operation; return operation;
  }
  flush(): Promise<void> { return this.pending; }
}
