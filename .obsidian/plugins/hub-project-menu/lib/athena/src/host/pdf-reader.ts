import { AthenaError, Segment, checkAbort } from "../contracts";
import { PdfReader } from "../knowledge/extractors";
export function createPdfReader(loadTrustedWorker: () => Promise<string>): PdfReader {
  let pending = Promise.resolve();
  return (bytes, signal) => {
    const job = pending.catch(() => {}).then(async () => {
      checkAbort(signal);
      const code = await loadTrustedWorker(); checkAbort(signal);
      return new Promise<{ segments: Segment[]; warnings: string[] }>((resolve, reject) => {
        const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
        let worker: Worker;
        try { worker = new Worker(url); } catch { URL.revokeObjectURL(url); reject(new AthenaError("PDF workers are unavailable in this runtime.")); return; }
        const finish = () => { clearTimeout(timeout); signal.removeEventListener("abort", abort); worker.terminate(); URL.revokeObjectURL(url); };
        const abort = () => { finish(); reject(new DOMException("Cancelled", "AbortError")); };
        const timeout = setTimeout(() => { finish(); reject(new AthenaError("PDF extraction timed out.")); }, 30000);
        signal.addEventListener("abort", abort, { once: true });
        worker.onerror = () => { finish(); reject(new AthenaError("PDF worker failed to start or parse this document.")); };
        worker.onmessage = event => {
          const value = event.data;
          if (value?.type !== "athena-pdf-result") return;
          finish();
          if (value?.error) reject(new AthenaError(typeof value.error === "string" ? value.error.slice(0, 160) : "PDF extraction failed."));
          else if (!Array.isArray(value?.segments) || !Array.isArray(value?.warnings)) reject(new AthenaError("Invalid PDF extraction result."));
          else resolve(value);
        };
        const copy = new Uint8Array(bytes); worker.postMessage({ type: "athena-pdf-request", bytes: copy }, [copy.buffer]);
        if (signal.aborted) abort();
      });
    });
    pending = job.then(() => {}, () => {});
    // Queued callers can cancel immediately, without waiting for another PDF.
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException("Cancelled", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      job.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
      if (signal.aborted) abort();
    });
  };
}
