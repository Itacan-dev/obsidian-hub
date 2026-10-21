import { randomUUID } from "node:crypto";
import { AthenaError, AthenaSettings, AthenaState, ConnectionStatus, Conversation, Evidence, ModelDescriptor, ModelProvider, Scope, Turn, checkAbort, safeMessage } from "./contracts";
import { KnowledgeService } from "./knowledge/documents";
import { assemble } from "./knowledge/context";
import { vaultPath } from "./knowledge/eligibility";
export interface StateWriter { save(value: AthenaState): Promise<void>; flush?(): Promise<void> }
export class AthenaController {
  private listeners = new Set<() => void>();
  private active?: AbortController;
  private connection?: AbortController;
  private disposed = false;
  private checkpoint = 0;
  private provider: ModelProvider;
  models: ModelDescriptor[] = [];
  status: ConnectionStatus = { state: "disconnected", message: "Connect to a local model, or search without inference." };
  issue = "";
  get busy(): boolean { return !!this.active; }
  constructor(readonly state: AthenaState, readonly knowledge: KnowledgeService, private readonly store: StateWriter, private readonly makeProvider: (settings: AthenaSettings) => ModelProvider) { this.provider = makeProvider(state.settings); }
  subscribe(callback: () => void): () => void { this.listeners.add(callback); return () => this.listeners.delete(callback); }
  notify(): void { if (!this.disposed) for (const callback of this.listeners) { try { callback(); } catch { /* One detached view cannot stop shared services. */ } } }
  conversation(id?: string): Conversation {
    const found = this.state.conversations.find(item => item.id === id);
    if (found) return found;
    if (id) throw new AthenaError("This conversation was deleted.");
    const created = { id: randomUUID(), title: "New conversation", turns: [] };
    this.state.conversations.push(created); this.notify(); return created;
  }
  async newConversation(): Promise<Conversation> { const value = this.conversation(); await this.persist(); return value; }
  async deleteConversation(id: string): Promise<void> { this.stop(); this.provider.forgetContext?.(); this.state.conversations = this.state.conversations.filter(item => item.id !== id); await this.persist(); this.notify(); }
  async persist(): Promise<void> {
    try { await this.store.save(this.state); }
    catch { this.issue = "Athena state could not be saved. The existing file is preserved; reload or resolve the storage conflict."; this.notify(); throw new AthenaError(this.issue); }
  }
  async updateSettings(changes: Partial<AthenaSettings>): Promise<void> {
    this.stop(); const wasConnecting = !!this.connection; this.connection?.abort(); this.connection = undefined;
    const next = { ...this.state.settings, ...changes };
    if (!Number.isInteger(next.port) || next.port < 1 || next.port > 65535 || ![4096, 8192, 16384, 32768].includes(next.contextLength) || !["ollama", "mock"].includes(next.provider)) throw new AthenaError("Invalid Athena settings.");
    for (const value of next.excluded) vaultPath(value);
    const reconnect = wasConnecting || next.port !== this.state.settings.port || next.provider !== this.state.settings.provider || !next.enabled;
    if ((next.port !== this.state.settings.port || next.provider !== this.state.settings.provider) && changes.localOnlyConfirmed !== true) next.localOnlyConfirmed = false;
    this.provider.forgetContext?.();
    const previousPolicy = this.knowledge.policy.revision, enabledChanged = next.enabled !== this.state.settings.enabled;
    this.knowledge.policy.setExcluded(next.excluded);
    this.state.settings = next;
    if (enabledChanged || previousPolicy !== this.knowledge.policy.revision) this.knowledge.clear();
    this.purgeExcludedHistory();
    if (reconnect) { await this.provider.disconnect(); this.provider = this.makeProvider(next); this.models = []; this.status = { state: "disconnected", message: "Connect to the configured local provider." }; }
    await this.persist(); this.notify();
  }
  private purgeExcludedHistory(): void {
    // Permanent exclusions purge stored derived answers too; Oath filtering is temporary.
    for (const conversation of this.state.conversations) for (const turn of conversation.turns) {
      if ([...turn.evidence, ...(turn.dependencies ?? [])].some(item => {
        const path = this.knowledge.currentPath(item.documentId); return !path || !this.knowledge.policy.supports(path);
      })) { turn.answer = ""; turn.evidence = []; turn.dependencies = []; turn.state = "error"; turn.error = "Context removed because a source is now excluded."; }
    }
  }
  async connect(): Promise<void> {
    this.stop(); this.connection?.abort();
    const controller = this.connection = new AbortController();
    this.status = { state: "connecting", message: "Checking local provider and downloaded models…" }; this.notify();
    try {
      const status = await this.provider.connect(controller.signal), models = await this.provider.listModels(controller.signal);
      checkAbort(controller.signal);
      if (this.disposed || this.connection !== controller) return;
      this.models = models; this.status = models.length ? status : { state: "unavailable", message: "No verified local chat models were found. Install a local model in Ollama, then reconnect." };
      if (!models.some(model => model.id === this.state.settings.model)) this.state.settings.model = models[0]?.id ?? "";
      await this.persist();
    } catch (error) { if (!controller.signal.aborted && !this.disposed) this.status = { state: "unavailable", message: safeMessage(error) }; }
    finally { if (this.connection === controller) this.connection = undefined; this.notify(); }
  }
  allowed(turn: Turn): boolean { return [...turn.evidence, ...(turn.dependencies ?? [])].every(item => this.knowledge.permitted(item)); }
  contextChanged(): void { this.stop(); this.provider.forgetContext?.(); this.knowledge.clear(); this.notify(); }
  sourcesChanged(path: string): void { this.stop(); this.knowledge.invalidate(path); this.notify(); }
  sourceRenamed(oldPath: string, path: string): void { this.stop(); this.provider.forgetContext?.(); this.knowledge.rename(oldPath, path); this.purgeExcludedHistory(); this.notify(); }
  async search(question: string, scope: Scope, activePath: string | null, signal: AbortSignal): Promise<Evidence[]> {
    if (!this.state.settings.enabled) throw new AthenaError("Enable local retrieval in Athena settings first.");
    for (let attempt = 0; attempt < 2; attempt++) {
      const evidence = await this.knowledge.search(question, scope, signal, activePath);
      if (await this.knowledge.validate(evidence, signal)) return evidence;
    }
    throw new AthenaError("Sources changed during retrieval. Refresh and retry.");
  }
  async send(id: string, question: string, scope: Scope, includeActive: boolean): Promise<void> {
    question = question.trim();
    if (!question || this.busy) throw new AthenaError(this.busy ? "Stop the active response before starting another." : "Enter a question.");
    if (this.status.state !== "ready") throw new AthenaError("Connect a local model first. Search vault works without a model.");
    if (this.state.settings.provider === "ollama" && !this.state.settings.localOnlyConfirmed) throw new AthenaError("Confirm local-only Ollama setup in Athena settings before sending content.");
    const model = this.models.find(item => item.id === this.state.settings.model);
    if (!model) throw new AthenaError("Select an available local model.");
    const conversation = this.conversation(id), controller = this.active = new AbortController(), signal = controller.signal;
    const activePath = includeActive ? this.knowledge.host.activePath() : null;
    const turn: Turn = { id: randomUUID(), question, answer: "", evidence: [], provider: this.provider.descriptor.id, model: model.id, state: "retrieving", createdAt: Date.now() };
    conversation.turns.push(turn); if (conversation.title === "New conversation") conversation.title = question.slice(0, 60);
    this.issue = ""; this.notify();
    try {
      await this.persist();
      const evidence = await this.search(question, scope, activePath, signal);
      const previous = conversation.turns.filter(item => item !== turn && item.state === "complete" && this.allowed(item));
      const history = previous.flatMap(item => [{ role: "user" as const, text: item.question }, { role: "assistant" as const, text: item.answer }]);
      const request = assemble(question, evidence, model.id, Math.min(model.contextLength, this.state.settings.contextLength), history);
      turn.evidence = request.evidence;
      turn.dependencies = request.history.length ? [...new Map(previous.flatMap(item => [...item.evidence, ...(item.dependencies ?? [])]).map(item => [`${item.documentId}:${item.revision}`, { ...item, text: "" }])).values()] : [];
      await this.persist();
      await this.provider.prepare?.(model.id, signal);
      if (!await this.knowledge.validate(turn.evidence, signal) || !this.allowed(turn)) throw new AthenaError("Context changed before transmission. Retry with current sources.");
      checkAbort(signal);
      if (!this.state.settings.enabled || (this.provider.descriptor.location !== "local" && this.provider.descriptor.location !== "mock")) throw new AthenaError("This transmission is not permitted.");
      turn.state = "streaming"; this.notify();
      let complete = false;
      for await (const event of this.provider.generate(request, signal)) {
        checkAbort(signal);
        if (this.disposed || this.active !== controller) break;
        if (event.type === "text") {
          if (turn.answer.length + event.text.length > 100000) throw new AthenaError("Response length limit reached.");
          turn.answer += event.text;
          if (Date.now() - this.checkpoint > 2000) { this.checkpoint = Date.now(); await this.persist(); }
          this.notify();
        } else if (event.type === "complete") complete = true;
      }
      checkAbort(signal);
      if (!complete) throw new AthenaError("The provider did not complete the response.");
      turn.state = "complete";
    } catch (error) { turn.state = signal.aborted ? "cancelled" : "error"; turn.error = signal.aborted ? undefined : safeMessage(error); }
    finally { if (this.active === controller) this.active = undefined; await this.persist().catch(() => {}); this.notify(); }
  }
  stop(): void { this.active?.abort(); }
  async dispose(): Promise<void> { this.disposed = true; this.stop(); this.connection?.abort(); this.knowledge.dispose(); this.listeners.clear(); await this.provider.disconnect(); await this.persist().catch(() => {}); await this.store.flush?.().catch(() => {}); }
}
