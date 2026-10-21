import * as fs from "node:fs/promises";
import * as path from "node:path";
import { AthenaError } from "../contracts";
import { vaultPath } from "../knowledge/eligibility";
export class PathGuard {
  private canonical?: Promise<string>;
  constructor(private readonly base: string) {}
  async root(): Promise<string> { return this.canonical ??= fs.realpath(this.base); }
  async check(relative: string, directory = false): Promise<{ size: number; mtime: number }> {
    relative = vaultPath(relative);
    const root = await this.root();
    let current = root;
    for (const component of relative.split("/")) {
      current = path.join(current, component);
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new AthenaError("Symbolic links and junctions are excluded.");
    }
    const real = await fs.realpath(current), difference = path.relative(root, real);
    if (!difference || difference === ".." || difference.startsWith(".." + path.sep) || path.isAbsolute(difference)) throw new AthenaError("Source is outside the vault.");
    if (process.platform === "win32" && difference.split(path.sep).join("/").toLowerCase() !== relative.toLowerCase()) throw new AthenaError("Windows path aliases are excluded.");
    const stat = await fs.stat(real);
    if (directory ? !stat.isDirectory() : !stat.isFile()) throw new AthenaError("Source is no longer available.");
    return { size: stat.size, mtime: stat.mtimeMs };
  }
}
