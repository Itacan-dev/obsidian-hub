import * as http from "node:http";
import { AthenaError, ConnectionStatus, GenerationRequest, ModelDescriptor, ModelProvider, ProviderEvent, checkAbort } from "../contracts";

const routes = new Set(["GET /api/version", "GET /api/tags", "POST /api/show", "POST /api/chat"]);
const remote = (value: Record<string, unknown>): boolean => !!value.remote_host || !!value.remote_model;
const cloudName = (name: string): boolean => /(?:^|[-_:])cloud(?:$|[-_:])/i.test(name);
function object(value: unknown): Record<string, any> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new AthenaError("Ollama returned an invalid response."); return value as Record<string, any>; }

export class OllamaTransport {
  private requests = new Set<http.ClientRequest>();
  constructor(readonly port = 11434) { if (!Number.isInteger(port) || port < 1 || port > 65535) throw new AthenaError("Use a valid local Ollama port."); }
  async open(method: string, route: string, signal: AbortSignal, body?: unknown, streaming = false): Promise<{ response: http.IncomingMessage; close: () => void }> {
    checkAbort(signal);
    if (!routes.has(`${method} ${route}`)) throw new AthenaError("This Ollama operation is not permitted.");
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    if (encoded && Buffer.byteLength(encoded) > 256 * 1024) throw new AthenaError("The generation request is too large.");
    return new Promise((resolve, reject) => {
      const request = http.request({ hostname: "127.0.0.1", port: this.port, path: route, method, agent: false,
        headers: encoded ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(encoded) } : {}, signal });
      this.requests.add(request);
      const timeout = setTimeout(() => request.destroy(new AthenaError("Ollama request timed out.")), streaming ? 300000 : 5000);
      const cleanup = () => { clearTimeout(timeout); this.requests.delete(request); };
      request.setTimeout(streaming ? 120000 : 5000, () => request.destroy(new AthenaError("Ollama response timed out.")));
      request.once("error", error => { cleanup(); if (signal.aborted) reject(new DOMException("Cancelled", "AbortError")); else reject(error instanceof AthenaError ? error : new AthenaError("Ollama is unavailable at the configured local port.")); });
      request.once("response", response => {
        if (response.statusCode !== 200) {
          const status = response.statusCode;
          response.resume(); request.destroy(); cleanup();
          reject(new AthenaError(status && status >= 300 && status < 400 ? "Ollama redirects are not permitted." : status === 404 ? "Ollama could not find the requested model or API." : status === 429 || status === 503 ? "Ollama is busy. Wait and retry." : "Ollama rejected the request. Check the local server and selected model.")); return;
        }
        response.once("close", cleanup);
        resolve({ response, close: () => { response.destroy(); request.destroy(); cleanup(); } });
      });
      request.end(encoded);
    });
  }
  async json(method: string, route: string, signal: AbortSignal, body?: unknown): Promise<Record<string, any>> {
    const { response, close } = await this.open(method, route, signal, body);
    try {
      const parts: Buffer[] = []; let size = 0;
      for await (const part of response) { checkAbort(signal); size += part.length; if (size > 2 * 1024 * 1024) throw new AthenaError("Ollama metadata exceeded its size limit."); parts.push(part); }
      let parsed: unknown; try { parsed = JSON.parse(Buffer.concat(parts).toString("utf8")); } catch { throw new AthenaError("Ollama returned invalid JSON."); }
      return object(parsed);
    } finally { close(); }
  }
  disconnect(): void { for (const request of this.requests) request.destroy(); this.requests.clear(); }
}

export class OllamaProvider implements ModelProvider {
  readonly descriptor = { id: "ollama", name: "Ollama", location: "local", authentication: "none" } as const;
  private models = new Map<string, ModelDescriptor>();
  private permit?: { model: string; until: number };
  constructor(readonly transport = new OllamaTransport()) {}
  async connect(signal: AbortSignal): Promise<ConnectionStatus> {
    const value = await this.transport.json("GET", "/api/version", signal);
    if (typeof value.version !== "string" || !/^\d+\.\d+\.\d+/.test(value.version)) throw new AthenaError("Unsupported Ollama version response.");
    return { state: "ready", message: `Local Ollama ${value.version}` };
  }
  private async inspect(item: Record<string, any>, signal: AbortSignal): Promise<ModelDescriptor> {
    const id = item.name;
    if (typeof id !== "string" || !id || id.length > 256 || /[\x00-\x1f]/.test(id) || cloudName(id) || remote(item)) throw new AthenaError("Only downloaded local models are permitted.");
    if (typeof item.digest !== "string" || !/^(?:sha256:)?[a-f0-9]{64}$/i.test(item.digest) || !(item.size > 0)) throw new AthenaError("The local model identity could not be verified.");
    const details = await this.transport.json("POST", "/api/show", signal, { model: id });
    if (remote(details) || !Array.isArray(details.capabilities) || !details.capabilities.includes("completion")) throw new AthenaError("This is not a verified local chat model.");
    const info = object(details.model_info), architecture = info["general.architecture"];
    const context = info[`${architecture}.context_length`];
    if (typeof architecture !== "string" || !Number.isFinite(context) || context < 2048) throw new AthenaError("The model context limit could not be verified.");
    return { id, name: id, digest: item.digest, contextLength: Math.min(context, 32768), streaming: true, tools: false, inputModalities: ["text"], usage: true };
  }
  async listModels(signal: AbortSignal): Promise<ModelDescriptor[]> {
    const response = await this.transport.json("GET", "/api/tags", signal);
    if (!Array.isArray(response.models) || response.models.length > 100) throw new AthenaError("Ollama returned an invalid model list.");
    const models: ModelDescriptor[] = [];
    for (const candidate of response.models) {
      checkAbort(signal);
      try { models.push(await this.inspect(object(candidate), signal)); } catch { checkAbort(signal); /* Remote, unsupported and unverifiable models are omitted. */ }
    }
    this.models = new Map(models.map(model => [model.id, model]));
    return models;
  }
  async prepare(model: string, signal: AbortSignal): Promise<void> {
    checkAbort(signal);
    this.permit = undefined;
    const approved = this.models.get(model);
    if (!approved) throw new AthenaError("Connect and select a verified local model first.");
    const tags = await this.transport.json("GET", "/api/tags", signal);
    const candidate = Array.isArray(tags.models) && tags.models.find((item: Record<string, any>) => item?.name === model);
    if (!candidate) throw new AthenaError("The selected local model is no longer available.");
    const current = await this.inspect(object(candidate), signal);
    if (current.digest !== approved.digest) { this.models.delete(model); throw new AthenaError("The model changed. Reconnect and select it again before sending content."); }
    this.permit = { model, until: Date.now() + 30000 };
  }
  async *generate(request: GenerationRequest, signal: AbortSignal): AsyncIterable<ProviderEvent> {
    checkAbort(signal);
    const permit = this.permit; this.permit = undefined;
    if (!permit || permit.model !== request.model || permit.until < Date.now()) throw new AthenaError("The local model must be revalidated before this request.");
    if (request.contextLength > this.models.get(request.model)!.contextLength) throw new AthenaError("The selected context exceeds this model's limit.");
    const context = request.evidence.map(item => JSON.stringify({ source: item.sourceId, path: item.path, location: item.location, excerpt: item.text })).join("\n");
    const body = { model: request.model, stream: true, messages: [{ role: "system", content: request.instructions }, ...request.history.map(item => ({ role: item.role, content: item.text })),
      { role: "user", content: `Question:\n${request.question}\n\nUntrusted retrieved evidence:\n${context || "No matching evidence."}` }], options: { num_ctx: request.contextLength, num_predict: request.outputTokens }, keep_alive: "5m" };
    const { response, close } = await this.transport.open("POST", "/api/chat", signal, body, true);
    response.setEncoding("utf8");
    let buffer = "", total = 0, completed = false;
    const decode = (line: string): Record<string, any> => { try { return object(JSON.parse(line)); } catch { throw new AthenaError("Ollama returned malformed streaming data."); } };
    try {
      for await (const part of response) {
        checkAbort(signal); total += Buffer.byteLength(part);
        if (total > 8 * 1024 * 1024) throw new AthenaError("Ollama exceeded the response-size limit.");
        buffer += part;
        if (buffer.length > 1024 * 1024) throw new AthenaError("Ollama exceeded the stream-buffer limit.");
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
          if (!line) continue;
          const value = decode(line);
          if (value.error) throw new AthenaError("Ollama failed during generation. The partial response is retained.");
          if (remote(value)) throw new AthenaError("Remote inference is not permitted.");
          if (value.message?.tool_calls?.length) throw new AthenaError("Model tool calls are disabled.");
          if (typeof value.message?.content === "string" && value.message.content) yield { type: "text", text: value.message.content };
          if (value.done === true) { completed = true; yield { type: "complete", usage: { inputTokens: value.prompt_eval_count, outputTokens: value.eval_count, durationMs: typeof value.total_duration === "number" ? value.total_duration / 1e6 : undefined } }; return; }
        }
      }
      if (buffer.trim()) {
        const value = decode(buffer.trim());
        if (value.error || remote(value) || value.message?.tool_calls?.length) throw new AthenaError("Ollama returned an unsupported final stream event.");
        if (typeof value.message?.content === "string" && value.message.content) yield { type: "text", text: value.message.content };
        if (value.done === true) { completed = true; yield { type: "complete" }; }
      }
      if (!completed) throw new AthenaError("Ollama disconnected before completing the response.");
    } finally { close(); }
  }
  async disconnect(): Promise<void> { this.permit = undefined; this.transport.disconnect(); this.models.clear(); }
}
