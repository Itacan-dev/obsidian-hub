import { DocumentRecord, Evidence } from "../contracts";
export function chunks(document: DocumentRecord): Omit<Evidence, "sourceId">[] {
  const result: Omit<Evidence, "sourceId">[] = [];
  for (const segment of document.segments) {
    const lines = segment.text.split("\n");
    for (let start = 0; start < lines.length;) {
      if (lines[start].length > 2200) {
        for (let column = 0; column < lines[start].length; column += 2200) result.push({ documentId: document.id, path: document.path, revision: document.revision, text: lines[start].slice(column, column + 2200), location: { ...segment.location, startLine: segment.location.startLine + start, endLine: segment.location.startLine + start, startColumn: column } });
        start++; continue;
      }
      let end = start, length = 0;
      while (end < lines.length && end - start < 60 && length + lines[end].length < 2200) length += lines[end++].length + 1;
      if (end === start) end++;
      const text = lines.slice(start, end).join("\n").slice(0, 2200);
      if (text.trim()) result.push({ documentId: document.id, path: document.path, revision: document.revision, text, location: { ...segment.location, startLine: segment.location.startLine + start, endLine: segment.location.startLine + end - 1 } });
      start = end;
    }
  }
  return result;
}
