import { AthenaError } from "../contracts";

export const TEXT_LIMIT = 2 * 1024 * 1024;
export const NOTEBOOK_LIMIT = 5 * 1024 * 1024;
export const PDF_LIMIT = 25 * 1024 * 1024;
const formats = new Set("md txt json jsonc yaml yml toml ini log csv tsv ipynb pdf py ts js jsx tsx mjs cjs mts cts cpp c cc cxx h hpp java cs go rs rb php swift kt kts r jl lua scala tex bib html htm xml css scss sql sh bash zsh ps1 bat cmd vue svelte".split(" "));
const privateNames = /^(?:\.env(?:\..*)?|(?:credentials?|secrets?|tokens?|passwords?)(?:[._-].*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\..*)?)$/i;
const privateExtensions = /\.(?:pem|key|p12|pfx|keystore|kdbx|sqlite|db)$/i;
const generatedDirectories = new Set(["node_modules", "__pycache__", "vendor", "dist", "build", "coverage", "atlas-state"]);
export function vaultPath(value: string): string {
  if (typeof value !== "string" || !value || value.length > 4096 || /[\x00-\x1f\x7f]/.test(value) || /^[\\/]|^[a-z]:|^[a-z][a-z0-9+.-]*:/i.test(value)) throw new AthenaError("Invalid vault path.");
  const parts = value.replace(/\\/g, "/").split("/");
  if (parts.some(part => !part || part === "." || part === ".." || /[ .]$|[:<>"|?*]/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new AthenaError("Invalid vault path.");
  return parts.join("/");
}
export function within(path: string, root: string): boolean { return path === root || path.startsWith(root + "/"); }
export function extension(path: string): string { return path.split("/").at(-1)!.split(".").at(-1)!.toLowerCase(); }
export function sizeLimit(path: string): number { const ext = extension(path); return ext === "pdf" ? PDF_LIMIT : ext === "ipynb" ? NOTEBOOK_LIMIT : TEXT_LIMIT; }
export class EligibilityPolicy {
  private excluded: string[] = [];
  readonly protectedRoots: string[];
  revision = 0;
  constructor(configDirectory = ".obsidian", internalRoots: string[] = []) {
    this.protectedRoots = [configDirectory, ".obsidian", "AtlasCore", "System/Backups", "System/Migrations", "System/Dashboards", "System/Scripts", "System/CSS", "System/Templates", "System/Project Templates", "System/Hub-shared-projects.json", ...internalRoots].map(root => vaultPath(root).toLowerCase());
  }
  setExcluded(paths: string[]): void {
    const next = [...new Set(paths.map(path => vaultPath(path.trim()).toLowerCase()))].sort();
    if (JSON.stringify(next) !== JSON.stringify(this.excluded)) { this.excluded = next; this.revision++; }
  }
  allowsPath(path: string, directory = false): boolean {
    try { path = vaultPath(path); } catch { return false; }
    const lower = path.toLowerCase(), parts = lower.split("/");
    if (parts.some(part => part.startsWith(".") || generatedDirectories.has(part))) return false;
    if ([...this.protectedRoots, ...this.excluded].some(root => within(lower, root))) return false;
    const name = parts.at(-1)!;
    return directory || (!privateNames.test(name) && !privateExtensions.test(name));
  }
  supports(path: string): boolean { return this.allowsPath(path) && formats.has(extension(path)); }
}
export function containsSecret(text: string): boolean {
  return /-----BEGIN (?:[A-Z ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----/.test(text) ||
    /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{25,}|AKIA[A-Z0-9]{16})\b/.test(text) ||
    /["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)["']?\s*[:=]\s*["'][^"'\r\n]{12,}["']/i.test(text);
}
