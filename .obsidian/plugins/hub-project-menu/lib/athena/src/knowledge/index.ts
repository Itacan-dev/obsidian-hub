import MiniSearch from "minisearch";
import { Evidence } from "../contracts";
interface Entry { id: number; title: string; heading: string; identifiers: string; aliases: string; text: string; evidence: Omit<Evidence, "sourceId"> }
export class LocalIndex {
  private searcher = new MiniSearch<Entry>({ fields: ["title", "heading", "identifiers", "aliases", "text"], storeFields: ["evidence"], tokenize: value => value.normalize("NFKC").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean) });
  private serial = 0;
  private paths = new Map<string, number[]>();
  add(evidence: Omit<Evidence, "sourceId">, labels: string[] = []): void {
    const id = ++this.serial;
    this.searcher.add({ id, title: evidence.path.split("/").at(-1)!, heading: evidence.location.heading ?? "", identifiers: evidence.path, aliases: labels.join(" "), text: evidence.text, evidence });
    const ids = this.paths.get(evidence.path) ?? []; ids.push(id); this.paths.set(evidence.path, ids);
  }
  remove(path: string): void { const ids = this.paths.get(path); if (ids) this.searcher.discardAll(ids); this.paths.delete(path); }
  search(query: string): Omit<Evidence, "sourceId">[] {
    if (!query.trim()) return [];
    return this.searcher.search(query.slice(0, 2048), { boost: { title: 4, aliases: 4, heading: 3, identifiers: 1.5 }, combineWith: "OR", prefix: term => term.length >= 3, fuzzy: false })
      .sort((a, b) => b.score - a.score || String(a.evidence.path).localeCompare(String(b.evidence.path)) || a.evidence.location.startLine - b.evidence.location.startLine)
      .slice(0, 100).map(item => item.evidence);
  }
}
