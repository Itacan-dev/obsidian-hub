import { getDocument } from "pdfjs-dist/build/pdf.mjs";
import { WorkerMessageHandler } from "pdfjs-dist/build/pdf.worker.mjs";
import type { Segment } from "../contracts";

// All PDF.js parsing, including its in-process worker shim, runs in this disposable
// browser worker. No Node APIs, URL inputs, viewer, annotations or postprocessors.
(globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = { WorkerMessageHandler };
// Text extraction has no network capability, including optional PDF.js asset fetches.
globalThis.fetch = async () => { throw Error("External PDF resources are disabled."); };
Object.defineProperty(globalThis, "XMLHttpRequest", { value: undefined });
Object.defineProperty(globalThis, "importScripts", { value: () => { throw Error("External PDF scripts are disabled."); } });
globalThis.onmessage = async event => {
  if (event.data?.type !== "athena-pdf-request") return;
  const bytes = event.data.bytes;
  const reply = (value: unknown) => globalThis.postMessage({ type: "athena-pdf-result", ...(value as object) });
  if (!(bytes instanceof Uint8Array) || bytes.length > 25 * 1024 * 1024) { reply({ error: "PDF size limit exceeded." }); return; }
  const task = getDocument({ data: bytes, useSystemFonts: false, disableFontFace: true, enableXfa: false, useWorkerFetch: false, useWasm: false, isEvalSupported: false, stopAtErrors: true });
  try {
    const document = await task.promise;
    if (document.numPages > 500) throw Error("pages");
    const segments: Segment[] = [], emptyPages: number[] = []; let characters = 0;
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number), content = await page.getTextContent();
      const lines: string[] = []; let line = "", previousY: number | undefined;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        characters += item.str.length + 1;
        if (characters > 2_000_000) throw Error("text-size");
        const y = item.transform[5];
        if (previousY !== undefined && Math.abs(previousY - y) > 2 && line) { lines.push(line); line = ""; }
        line += (line && !/\s$/.test(line) && !/^\s/.test(item.str) ? " " : "") + item.str;
        if (item.hasEOL) { lines.push(line); line = ""; }
        previousY = y;
      }
      if (line) lines.push(line);
      const text = lines.join("\n");
      if (text.trim()) segments.push({ text, location: { page: number, startLine: 1, endLine: lines.length } });
      else emptyPages.push(number);
      page.cleanup();
    }
    reply({ segments, warnings: ["PDF text may misorder columns, equations and symbols; figures are not interpreted.", ...(emptyPages.length && segments.length ? [`Partial text: ${emptyPages.length} pages have no usable text (OCR is unavailable).`] : [])] });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    reply({ error: name === "PasswordException" ? "Password-protected PDF." : error instanceof Error && error.message === "pages" ? "PDF page limit exceeded." : error instanceof Error && error.message === "text-size" ? "PDF extracted-text limit exceeded." : "Malformed or unsupported PDF." });
  } finally { await task.destroy(); }
};
