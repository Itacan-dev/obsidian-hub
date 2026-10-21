import { AthenaController } from "../controller";
import { AthenaError, Evidence, Scope, Turn, safeMessage } from "../contracts";
import { button, el, label, renderMessage } from "./safe-markdown";
import { renderSources } from "./sources";
export interface SidebarOptions {
  conversationId?: string;
  projects: () => { id: string; name: string }[];
  openSource: (evidence: Evidence) => void;
  openSettings: () => void;
}
export class SidebarPresenter {
  conversationId: string;
  private disposed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private unsubscribe: () => void;
  private searchAbort?: AbortController;
  private searchEvidence: Evidence[] = [];
  private rows = new Map<string, { root: HTMLElement; answer: HTMLElement; status: HTMLElement; sources: HTMLElement; signature: string }>();
  private status: HTMLElement;
  private conversations: HTMLSelectElement;
  private models: HTMLSelectElement;
  private scope: HTMLSelectElement;
  private folder: HTMLInputElement;
  private projects: HTMLSelectElement;
  private active: HTMLInputElement;
  private activeLabel: HTMLElement;
  private transcript: HTMLElement;
  private input: HTMLTextAreaElement;
  private sendButton: HTMLButtonElement;
  private searchButton: HTMLButtonElement;
  private stopButton: HTMLButtonElement;
  private coverage: HTMLElement;
  private coverageDetails: HTMLElement;
  private coverageSignature = "";
  private error: HTMLElement;
  private results: HTMLElement;
  constructor(readonly root: HTMLElement, private readonly controller: AthenaController, private readonly options: SidebarOptions) {
    root.classList.add("hub-athena", "hub-button-scope");
    this.conversationId = controller.state.conversations.find(item => item.id === options.conversationId)?.id ?? controller.state.conversations[0]?.id ?? controller.conversation().id;
    const top = el(root, "div", "hub-athena-top");
    const heading = el(top, "div", "hub-athena-toolbar"); el(heading, "strong", "", "Athena");
    button(heading, "Settings", options.openSettings);
    this.status = el(top, "div", "hub-athena-muted"); this.status.setAttribute("role", "status");
    const history = el(top, "div", "hub-athena-toolbar");
    this.conversations = el(history, "select"); this.conversations.setAttribute("aria-label", "Conversation");
    this.conversations.addEventListener("change", () => { this.conversationId = this.conversations.value; this.render(); });
    button(history, "New", () => { void this.run(async () => { this.conversationId = (await controller.newConversation()).id; this.render(); }); });
    button(history, "Delete", () => { if (root.ownerDocument.defaultView?.confirm("Delete this Athena conversation and its stored excerpts?")) void this.run(async () => { await controller.deleteConversation(this.conversationId); this.conversationId = controller.state.conversations[0]?.id ?? controller.conversation().id; this.render(); }); });
    const modelRow = el(top, "div", "hub-athena-toolbar");
    this.models = el(modelRow, "select"); this.models.setAttribute("aria-label", "Local model");
    this.models.addEventListener("change", () => { void this.run(() => controller.updateSettings({ model: this.models.value })); });
    button(modelRow, "Connect", () => { void this.run(() => controller.connect()); });
    const context = el(top, "div", "hub-athena-context");
    const scopeLabel = label(context, "Search scope"); this.scope = el(scopeLabel, "select");
    for (const [value, text] of [["vault", "Eligible vault"], ["document", "Active document"], ["folder", "Folder"], ["project", "Project"]]) { const option = el(this.scope, "option", "", text); option.value = value; }
    this.scope.addEventListener("change", () => this.renderScope());
    this.folder = el(context, "input"); this.folder.placeholder = "Vault-relative folder"; this.folder.setAttribute("aria-label", "Folder scope");
    this.projects = el(context, "select"); this.projects.setAttribute("aria-label", "Project scope");
    for (const project of options.projects()) { const option = el(this.projects, "option", "", project.name); option.value = project.id; }
    this.activeLabel = label(context, ""); this.active = el(this.activeLabel, "input"); this.active.type = "checkbox";
    el(this.activeLabel, "span", "", "Include active document");
    this.coverage = el(top, "div", "hub-athena-muted");
    const extraction = el(top, "details", "hub-athena-coverage"); el(extraction, "summary", "", "Extraction details");
    this.coverageDetails = el(extraction, "div", "hub-athena-muted");
    button(top, "Refresh sources", () => { void this.run(async () => {
      if (!controller.state.settings.enabled) throw new AthenaError("Enable local retrieval in Athena settings first.");
      this.searchAbort?.abort(); const abort = this.searchAbort = new AbortController();
      this.closeResults(); controller.contextChanged();
      try { await controller.knowledge.refresh(abort.signal); await controller.persist(); } finally { if (this.searchAbort === abort) this.searchAbort = undefined; }
    }); });
    this.transcript = el(root, "div", "hub-athena-transcript"); this.transcript.setAttribute("role", "log"); this.transcript.setAttribute("aria-label", "Athena conversation"); this.transcript.tabIndex = 0;
    this.results = el(root, "div", "hub-athena-search-results"); this.results.hidden = true;
    const composer = el(root, "div", "hub-athena-composer");
    const inputLabel = label(composer, "Question");
    this.input = el(inputLabel, "textarea"); this.input.rows = 3; this.input.placeholder = "Ask about your files…";
    this.input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing && !event.ctrlKey && !event.metaKey && !this.sendButton.disabled) { event.preventDefault(); this.send(); } });
    const actions = el(composer, "div", "hub-athena-toolbar");
    this.sendButton = button(actions, "Send", () => this.send()); this.sendButton.classList.add("mod-cta");
    this.searchButton = button(actions, "Search vault", () => { void this.run(async () => {
      this.searchAbort?.abort(); const abort = this.searchAbort = new AbortController();
      try {
        const evidence = await controller.search(this.input.value, this.selectedScope(), this.active.checked ? controller.knowledge.host.activePath() : null, abort.signal);
        if (this.disposed || abort.signal.aborted || !controller.state.settings.enabled) return;
        this.searchEvidence = evidence.filter(item => controller.knowledge.permitted(item)); this.renderResults();
      } finally { if (this.searchAbort === abort) this.searchAbort = undefined; }
    }); });
    this.stopButton = button(actions, "Stop", () => { controller.stop(); this.searchAbort?.abort(); controller.knowledge.cancelRefresh(); });
    this.error = el(composer, "div", "hub-athena-error"); this.error.setAttribute("role", "alert");
    this.unsubscribe = controller.subscribe(() => this.schedule()); this.render();
  }
  private async run(action: () => Promise<unknown>): Promise<void> { this.error.textContent = ""; this.schedule(); try { await action(); } catch (error) { if (!this.disposed) this.error.textContent = safeMessage(error); } this.schedule(); }
  private renderScope(): void { this.folder.hidden = this.scope.value !== "folder"; this.projects.hidden = this.scope.value !== "project"; }
  private closeResults(): void { this.searchEvidence = []; this.results.hidden = true; this.results.replaceChildren(); }
  private renderResults(): void {
    this.results.hidden = false; this.results.replaceChildren();
    const toolbar = el(this.results, "div", "hub-athena-toolbar"); el(toolbar, "strong", "", this.searchEvidence.length ? "Retrieved context · no inference" : "No matching sources");
    button(toolbar, "Close", () => this.closeResults());
    renderSources(el(this.results, "div"), this.searchEvidence, this.options.openSource);
  }
  private selectedScope(): Scope {
    if (this.scope.value === "folder") return { kind: "folder", path: this.folder.value.trim() };
    if (this.scope.value === "project") return { kind: "project", id: this.projects.value };
    if (this.scope.value === "document") { const path = this.controller.knowledge.host.activePath(); if (!path) throw new AthenaError("Select an eligible document in the main workspace first."); return { kind: "document", path }; }
    return { kind: "vault" };
  }
  private send(): void {
    const question = this.input.value;
    void this.run(async () => {
      const scope = this.selectedScope(); this.input.value = "";
      try { await this.controller.send(this.conversationId, question, scope, this.active.checked); }
      catch (error) { if (!this.input.value) this.input.value = question; throw error; }
    });
  }
  private schedule(): void { if (!this.disposed && !this.timer) this.timer = setTimeout(() => { this.timer = undefined; if (!this.disposed) this.render(); }, 50); }
  private optionsFor(select: HTMLSelectElement, entries: { id: string; name: string }[], selected: string): void {
    const signature = JSON.stringify(entries);
    if (select.dataset.options !== signature) { select.replaceChildren(); for (const entry of entries) { const option = el(select, "option", "", entry.name); option.value = entry.id; } select.dataset.options = signature; }
    select.value = selected;
  }
  render(): void {
    if (this.disposed) return;
    const controller = this.controller, coverage = controller.knowledge.coverage;
    this.status.textContent = `${controller.state.settings.provider === "mock" ? "Mock · no inference" : "Local · Ollama"} · ${controller.status.message}`;
    this.optionsFor(this.conversations, controller.state.conversations.map(item => ({ id: item.id, name: item.title })), this.conversationId);
    this.optionsFor(this.models, controller.models.length ? controller.models : [{ id: controller.state.settings.model, name: controller.state.settings.model || "Connect to discover local models" }], controller.state.settings.model);
    this.models.disabled = controller.busy || !controller.models.length;
    this.coverage.textContent = !controller.state.settings.enabled ? "Local retrieval is disabled. Enable it in Settings." : `${coverage.indexing ? "Indexing locally" : coverage.complete ? "Local index" : "Index incomplete"}: ${coverage.indexed} indexed · ${coverage.skipped} skipped`;
    const coverageSignature = JSON.stringify(coverage);
    if (this.coverageSignature !== coverageSignature) {
      this.coverageSignature = coverageSignature; this.coverageDetails.replaceChildren();
      const statuses = [...controller.knowledge.statuses.values()].filter(item => item.status !== "indexed" || item.message);
      if (!statuses.length) el(this.coverageDetails, "p", "", "No extraction issues reported. Image content and scanned PDFs require OCR, which is unavailable.");
      for (const item of statuses.slice(0, 50)) el(this.coverageDetails, "p", "", `${item.path}: ${item.status}${item.message ? ` · ${item.message}` : ""}`);
      if (statuses.length > 50) el(this.coverageDetails, "p", "", `${statuses.length - 50} additional files have extraction notices. Narrow scope with exclusions to inspect them.`);
    }
    this.activeLabel.title = controller.knowledge.host.activePath() ?? "No eligible active document";
    this.sendButton.disabled = controller.busy || !controller.state.settings.enabled || controller.status.state !== "ready";
    this.searchButton.disabled = controller.busy || !controller.state.settings.enabled;
    this.stopButton.disabled = !controller.busy && !coverage.indexing && !this.searchAbort;
    if (!controller.state.settings.enabled || this.searchEvidence.some(item => !controller.knowledge.permitted(item))) this.closeResults();
    this.renderScope();
    const conversation = controller.state.conversations.find(item => item.id === this.conversationId);
    const turns = conversation?.turns ?? [], keep = new Set(turns.map(turn => turn.id));
    const stick = this.transcript.scrollHeight - this.transcript.scrollTop - this.transcript.clientHeight < 80;
    for (const [id, row] of this.rows) if (!keep.has(id)) { row.root.remove(); this.rows.delete(id); }
    for (const turn of turns) this.renderTurn(turn);
    if (stick) this.transcript.scrollTop = this.transcript.scrollHeight;
    if (controller.issue) this.error.textContent = controller.issue;
  }
  private renderTurn(turn: Turn): void {
    let row = this.rows.get(turn.id);
    if (!row) {
      const root = el(this.transcript, "article", "hub-athena-turn");
      el(root, "div", "hub-athena-role", "You"); el(root, "div", "hub-athena-question", turn.question);
      el(root, "div", "hub-athena-role", "Athena");
      row = { root, answer: el(root, "div", "hub-athena-answer"), status: el(root, "div", "hub-athena-muted"), sources: el(root, "div", "hub-athena-sources"), signature: "" }; this.rows.set(turn.id, row);
    }
    const allowed = this.controller.allowed(turn);
    renderMessage(row.answer, allowed ? turn.answer : "This response is hidden while its source access is restricted.");
    row.status.textContent = allowed ? turn.error || ({ retrieving: "Retrieving local context…", streaming: "Generating locally…", complete: "", cancelled: "Cancelled · partial response", interrupted: "Interrupted · partial response restored", error: "Request failed" }[turn.state] ?? "") : "Restricted context";
    const signature = allowed ? JSON.stringify(turn.evidence) : "restricted";
    if (row.signature !== signature) { renderSources(row.sources, allowed ? turn.evidence : [], this.options.openSource); row.signature = signature; }
  }
  dispose(): void { this.disposed = true; if (this.timer) clearTimeout(this.timer); this.searchAbort?.abort(); this.unsubscribe(); this.rows.clear(); this.root.replaceChildren(); }
}
