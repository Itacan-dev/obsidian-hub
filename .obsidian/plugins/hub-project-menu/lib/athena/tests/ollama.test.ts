import { test } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { OllamaProvider, OllamaTransport } from "../src/providers/ollama";
import { assemble } from "../src/knowledge/context";
const digest = "a".repeat(64), signal = () => new AbortController().signal;
async function serverFixture() {
  let mode = "ok", identity = digest, remote = false, inference = 0;
  const bodies: any[] = [];
  const server = http.createServer(async (req, res) => {
    const pieces: Buffer[] = []; for await (const part of req) pieces.push(part);
    const body = pieces.length ? JSON.parse(Buffer.concat(pieces).toString()) : {};
    const json = (value: unknown) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(value)); };
    if (req.url === "/api/version") { if (mode === "redirect") { res.writeHead(302, { Location: "http://127.0.0.1:1/elsewhere" }); res.end(); } else json({ version: "0.40.5" }); return; }
    if (req.url === "/api/tags") { json({ models: [{ name: "local-model", digest: identity, size: 100, ...(remote ? { remote_host: "https://cloud.invalid", remote_model: "remote" } : {}) }, { name: "hidden:cloud", digest, size: 100, remote_host: "https://cloud.invalid" }] }); return; }
    if (req.url === "/api/show") { json({ capabilities: ["completion"], model_info: { "general.architecture": "test", "test.context_length": 8192 } }); return; }
    if (req.url === "/api/chat") {
      inference++; bodies.push(body); res.setHeader("Content-Type", "application/x-ndjson");
      if (mode === "hold") { res.write(JSON.stringify({ message: { content: "partial" }, done: false }) + "\n"); return; }
      if (mode === "malformed") { res.end("{invalid}\n"); return; }
      if (mode === "tool") { res.end(JSON.stringify({ message: { tool_calls: [{ function: { name: "read_secret" } }] }, done: true }) + "\n"); return; }
      if (mode === "error") { res.end(JSON.stringify({ message: { content: "partial" } }) + "\n" + JSON.stringify({ error: "PRIVATE_RAW_ERROR_MUST_NOT_ESCAPE" }) + "\n"); return; }
      if (mode === "incomplete") { res.end(JSON.stringify({ message: { content: "partial" }, done: false }) + "\n"); return; }
      const bytes = Buffer.from(JSON.stringify({ message: { content: "Copper λ is 520 nm [S1]." }, done: false }) + "\n" + JSON.stringify({ done: true, eval_count: 5 }));
      const unicode = bytes.indexOf(Buffer.from("λ")); res.write(bytes.subarray(0, unicode + 1)); setTimeout(() => res.end(bytes.subarray(unicode + 1)), 5); return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = (server.address() as { port: number }).port;
  return { port, bodies, get inference() { return inference; }, mode(value: string) { mode = value; }, mutate() { identity = "b".repeat(64); }, remote() { remote = true; }, async close() { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
async function connected(port: number) { const provider = new OllamaProvider(new OllamaTransport(port)); await provider.connect(signal()); const models = await provider.listModels(signal()); assert.equal(models.length, 1); return provider; }

test("Ollama streams split UTF-8 NDJSON, has no tools/auth headers and preserves native messages", async () => {
  const server = await serverFixture();
  try {
    const provider = await connected(server.port), request = assemble("What is copper?", [], "local-model", 4096);
    await provider.prepare(request.model, signal()); let text = "", complete = false;
    for await (const event of provider.generate(request, signal())) { if (event.type === "text") text += event.text; else complete = true; }
    assert.equal(text, "Copper λ is 520 nm [S1]."); assert(complete); assert.equal(server.inference, 1);
    assert.equal(server.bodies[0].stream, true); assert(!("tools" in server.bodies[0])); assert.equal(server.bodies[0].options.num_ctx, 4096);
    await provider.disconnect();
  } finally { await server.close(); }
});

test("remote models, changed digests and redirects are rejected before inference", async () => {
  const server = await serverFixture();
  try {
    const provider = await connected(server.port); server.mutate(); await assert.rejects(provider.prepare("local-model", signal()), /changed/); assert.equal(server.inference, 0);
    server.remote(); assert.equal((await provider.listModels(signal())).length, 0); assert.equal(server.inference, 0);
    server.mode("redirect"); await assert.rejects(provider.connect(signal()), /redirects/);
    await assert.rejects(new OllamaTransport(server.port).json("GET", "https://example.invalid", signal()), /not permitted/);
    assert.throws(() => new OllamaTransport(0), /valid local/); await provider.disconnect();
  } finally { await server.close(); }
});

test("stream errors, incomplete EOF, malformed JSON and unsolicited tool calls cannot succeed", async () => {
  const server = await serverFixture();
  try {
    const provider = await connected(server.port);
    for (const mode of ["error", "incomplete", "malformed", "tool"]) {
      server.mode(mode); await provider.prepare("local-model", signal());
      await assert.rejects(async () => { for await (const _event of provider.generate(assemble("q", [], "local-model", 4096), signal())) {} }, error => { assert(!String(error).includes("PRIVATE_RAW_ERROR")); return true; });
    }
    await provider.disconnect();
  } finally { await server.close(); }
});

test("cancellation destroys a streaming local request", async () => {
  const server = await serverFixture();
  try {
    const provider = await connected(server.port); server.mode("hold"); const abort = new AbortController();
    await provider.prepare("local-model", abort.signal);
    const start = Date.now();
    await assert.rejects(async () => { for await (const event of provider.generate(assemble("q", [], "local-model", 4096), abort.signal)) if (event.type === "text") abort.abort(); });
    assert(Date.now() - start < 1500); await provider.disconnect();
  } finally { await server.close(); }
});
