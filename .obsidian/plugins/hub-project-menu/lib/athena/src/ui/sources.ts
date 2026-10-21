import { Evidence } from "../contracts";
import { button, el } from "./safe-markdown";
export function sourceLabel(item: Evidence): string {
  const location = item.location;
  return `[${item.sourceId}] ${item.path} · ${location.page ? `page ${location.page}` : `${location.cell ? `cell ${location.cell} · ` : ""}lines ${location.startLine}–${location.endLine}`}`;
}
export function renderSources(parent: HTMLElement, evidence: Evidence[], open: (item: Evidence) => void): void {
  parent.replaceChildren();
  for (const item of evidence) {
    const row = el(parent, "details", "hub-athena-source");
    el(row, "summary", "", sourceLabel(item));
    if (item.location.heading) el(row, "div", "hub-athena-muted", item.location.heading);
    el(row, "pre", "hub-athena-excerpt", item.text);
    button(row, "Inspect source", () => open(item));
  }
}
