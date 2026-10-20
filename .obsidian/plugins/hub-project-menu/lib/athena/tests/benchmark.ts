import assert from "node:assert/strict";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { EligibilityPolicy } from "../src/knowledge/eligibility";
import { KnowledgeService } from "../src/knowledge/documents";
import { MemoryHost } from "./fixtures";

async function run() {
  const policy = new EligibilityPolicy(), host = new MemoryHost(policy), count = 5000, perFile = Math.floor(50 * 1024 * 1024 / count), queries: { text: string; path: string }[] = [];
  const filler = "Repeated experimental procedure uses controlled samples, calibration, spectra and documented measurements.\n";
  for (let index = 0; index < count; index++) {
    const path = `Unregistered/Series${Math.floor(index / 100)}/Study${index}.md`, marker = `reagent${String(index).padStart(5, "0")}`;
    const introduction = `# Sample ${index}\nThe unique ${marker} experimental calibration is ${index + 520} nanometers.\n`;
    host.files.set(path, (introduction + filler.repeat(Math.ceil(perFile / filler.length))).slice(0, perFile));
    if (index % 50 === 0) queries.push({ text: `${marker} calibration`, path });
  }
  const knowledge = new KnowledgeService(host, policy, {}), signal = new AbortController().signal, start = performance.now();
  await knowledge.refresh(signal); const buildMs = performance.now() - start;
  assert.equal(knowledge.documents.size, count, JSON.stringify(knowledge.coverage)); assert(knowledge.coverage.complete);
  const latencies: number[] = []; let hits = 0;
  for (let repeat = 0; repeat < 3; repeat++) for (const query of queries) {
    const before = performance.now(), results = await knowledge.search(query.text, { kind: "vault" }, signal); await knowledge.validate(results, signal);
    latencies.push(performance.now() - before);
    if (repeat === 0 && results.slice(0, 5).some(item => item.path === query.path)) hits++;
  }
  latencies.sort((a, b) => a - b); const p95 = latencies[Math.floor(latencies.length * .95)];
  const result = { corpus: "synthetic Markdown in memory; extraction, hashing, indexing, search and evidence revalidation", documents: count, bytes: perFile * count, goldenQueries: queries.length, hitsAtFive: hits, warmQueries: latencies.length, buildMs: Math.round(buildMs), warmP95Ms: Number(p95.toFixed(2)), rssMiB: Math.round(process.memoryUsage().rss / 1048576), platform: process.platform, node: process.versions.node, cpu: os.cpus()[0].model, systemMemoryGiB: Math.round(os.totalmem() / 1073741824) };
  console.log(JSON.stringify(result, null, 2)); knowledge.dispose();
  assert(p95 < 250, "Warm search exceeds the provisional 250 ms p95 target"); assert(hits / queries.length >= .9, "Synthetic lexical source recall is below 90%");
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
