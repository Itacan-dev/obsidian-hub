import { ConnectionStatus, GenerationRequest, ModelDescriptor, ModelProvider, ProviderEvent, checkAbort } from "../contracts";
export class MockProvider implements ModelProvider {
  readonly descriptor = { id: "mock", name: "Recording mock", location: "mock", authentication: "none" } as const;
  readonly requests: GenerationRequest[] = [];
  async connect(signal: AbortSignal): Promise<ConnectionStatus> { checkAbort(signal); return { state: "ready", message: "Mock provider ready; no inference or network access." }; }
  async listModels(signal: AbortSignal): Promise<ModelDescriptor[]> { checkAbort(signal); return [{ id: "recording-mock", name: "Recording mock", contextLength: 4096, streaming: true, tools: false, inputModalities: ["text"], usage: false }]; }
  async *generate(request: GenerationRequest, signal: AbortSignal): AsyncIterable<ProviderEvent> {
    checkAbort(signal);
    this.requests.push(structuredClone(request));
    if (this.requests.length > 8) this.requests.shift();
    const text = request.evidence.length ? `Mock response — selected evidence (no model inference):\n\n${request.evidence.map(item => `[${item.sourceId}] ${item.text}`).join("\n\n")}` : "Mock response — no matching evidence was selected.";
    for (let offset = 0; offset < text.length; offset += 40) { checkAbort(signal); yield { type: "text", text: text.slice(offset, offset + 40) }; await new Promise(resolve => setTimeout(resolve, 0)); }
    yield { type: "complete" };
  }
  forgetContext(): void { this.requests.length = 0; }
  async disconnect(): Promise<void> { this.forgetContext(); }
}
