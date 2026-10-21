import { AthenaError, DocumentRecord, Segment, checkAbort } from "../contracts";
import { containsSecret, extension } from "./eligibility";

export type PdfReader = (bytes: Uint8Array, signal: AbortSignal) => Promise<{ segments: Segment[]; warnings: string[] }>;
function markdownLabels(text: string): string[] {
  const lines = text.split(/\r\n|\n|\r/); if (lines[0]?.trim() !== "---") return [];
  const end = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/.test(line));
  if (end < 0) return [];
  const labels: string[] = []; let list = false;
  const add = (raw: string) => {
    const value = raw.trim().replace(/^(?:"(.*)"|'(.*)')$/, (_, double, single) => double ?? single);
    // Deliberately limited scalar syntax; no general YAML parser, tags, anchors or directives.
    if (value && value.length <= 128 && !/[\[\]{}!&*|>\x00-\x1f]/.test(value) && labels.length < 20) labels.push(value);
  };
  for (const line of lines.slice(1, Math.min(end, 100))) {
    const match = line.match(/^(title|aliases|alias)\s*:\s*(.*?)\s*$/i);
    if (match) { list = !match[2] && match[1].toLowerCase() !== "title"; if (match[2].startsWith("[") && match[2].endsWith("]")) match[2].slice(1, -1).split(",").forEach(add); else add(match[2]); }
    else if (list && /^\s+-\s+/.test(line)) add(line.replace(/^\s+-\s+/, ""));
    else if (line.trim()) list = false;
  }
  return labels;
}
function textSegments(text: string, markdown: boolean): Segment[] {
  const lines = text.split(/\r\n|\n|\r/), segments: Segment[] = [];
  let start = 0, heading: string | undefined, fence = "";
  if (markdown && lines[0]?.trim() === "---") {
    const end = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/.test(line));
    if (end < 0) return [];
    start = end + 1;
  }
  const emit = (end: number) => { if (end > start) { const value = lines.slice(start, end).join("\n"); if (value.trim()) segments.push({ text: value, location: { startLine: start + 1, endLine: end, heading } }); } };
  for (let index = start; index < lines.length; index++) {
    const line = lines[index];
    const marker = markdown && line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) { if (!fence) fence = marker[1][0]; else if (marker[1][0] === fence) fence = ""; }
    const match = markdown && !fence && line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (match && index > start) { emit(index); start = index; heading = match[1]; }
    else if (match) heading = match[1];
  }
  emit(lines.length);
  return segments;
}
export async function extract(path: string, bytes: Uint8Array, signal: AbortSignal, pdf?: PdfReader): Promise<Pick<DocumentRecord, "segments" | "warnings" | "searchLabels">> {
  checkAbort(signal);
  const ext = extension(path);
  if (ext === "pdf") {
    if (!pdf) throw new AthenaError("PDF extraction is unavailable in this runtime.");
    const result = await pdf(bytes, signal);
    if (result.segments.some(segment => containsSecret(segment.text))) throw new AthenaError("Excluded: potentially sensitive content.");
    return result;
  }
  if (bytes.includes(0)) throw new AthenaError("Unsupported binary text encoding.");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, ""); }
  catch { throw new AthenaError("Unsupported text encoding; UTF-8 is required."); }
  if (containsSecret(text)) throw new AthenaError("Excluded: potentially sensitive content.");
  if (ext === "ipynb") {
    let notebook: { cells?: unknown[] };
    try { notebook = JSON.parse(text); } catch { throw new AthenaError("Invalid notebook JSON."); }
    if (!notebook || !Array.isArray(notebook.cells) || notebook.cells.length > 10000) throw new AthenaError("Invalid or oversized notebook.");
    const segments: Segment[] = [];
    let total = 0;
    for (const [index, value] of notebook.cells.entries()) {
      checkAbort(signal);
      const cell = value as { cell_type?: string; id?: string; source?: unknown };
      if (!cell || !["code", "markdown"].includes(cell.cell_type ?? "")) continue;
      const source = typeof cell.source === "string" ? cell.source : Array.isArray(cell.source) && cell.source.every(item => typeof item === "string") ? cell.source.join("") : "";
      total += source.length;
      if (total > 2_000_000) throw new AthenaError("Notebook extracted-text limit exceeded.");
      for (const segment of textSegments(source, cell.cell_type === "markdown")) segments.push({ ...segment, location: { ...segment.location, cell: `${index + 1}${typeof cell.id === "string" && /^[\w-]{1,64}$/.test(cell.id) ? ` (${cell.id})` : ""}` } });
    }
    return { segments, warnings: ["Cell sources only; outputs and attachments are excluded."] };
  }
  return { segments: textSegments(text, ext === "md"), warnings: [], ...(ext === "md" ? { searchLabels: markdownLabels(text) } : {}) };
}
