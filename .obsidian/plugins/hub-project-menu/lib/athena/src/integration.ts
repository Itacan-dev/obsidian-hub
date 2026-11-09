import type { Plugin, WorkspaceLeaf } from "obsidian";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { AthenaController } from "./controller";
import { restoreState } from "./conversation-store";
import { AthenaError, Evidence, safeMessage } from "./contracts";
import { DeviceStore } from "./host/device-store";
import { ObsidianHost } from "./host/obsidian-host";
import { createPdfReader } from "./host/pdf-reader";
import { openVerifiedSource } from "./host/source-opener";
import { EligibilityPolicy } from "./knowledge/eligibility";
import { KnowledgeService } from "./knowledge/documents";
import { MockProvider } from "./providers/mock";
import { OllamaProvider, OllamaTransport } from "./providers/ollama";
import { SidebarPresenter } from "./ui/sidebar";
import { mountSettings } from "./ui/settings";
import { button, el } from "./ui/safe-markdown";
import { sourceLabel } from "./ui/sources";

export const ATHENA_VIEW = "hub-athena";
interface HubPlugin extends Plugin {
  oath?: { canOpen(path: string, notify: boolean): boolean; onChange(callback: () => void): () => void };
  projectWizard?: { getProjectRecords(): { projectId: string; name: string; root: string }[] };
}
export function installAthena(plugin: HubPlugin, options: { storeRoot?: string; openSettings?: () => void; ownColors?: (root: HTMLElement) => () => void } = {}) {
  const { ItemView, Modal } = require("obsidian") as typeof import("obsidian");
  let destroyed = false;
  const views = new Set<AthenaView>(), modals = new Set<import("obsidian").Modal>();
  const projects = () => plugin.projectWizard?.getProjectRecords() ?? [];
  const openSettings = () => options.openSettings?.();
  const ready = (async () => {
    const adapter = plugin.app.vault.adapter as unknown as { getBasePath?: () => string };
    const basePath = adapter.getBasePath?.();
    if (!basePath) throw new AthenaError("Athena requires Obsidian desktop file access.");
    const store = await DeviceStore.open(basePath, options.storeRoot), state = restoreState(await store.load());
    if (destroyed) throw new AthenaError("Athena was unloaded.");
    const policy = new EligibilityPolicy(plugin.app.vault.configDir); policy.setExcluded(state.settings.excluded);
    const host = new ObsidianHost(plugin.app, policy, { basePath,
      canRead: file => !destroyed && plugin.oath?.canOpen(file, false) !== false,
      projectRoot: id => projects().find(project => project.projectId === id)?.root ?? null });
    const configured = plugin.manifest.dir;
    const pluginDirectory = configured && /[\\/]/.test(configured) ? configured : `${plugin.app.vault.configDir}/plugins/${configured || plugin.manifest.id}`;
    const asset = path.join(path.isAbsolute(pluginDirectory) ? pluginDirectory : path.join(basePath, pluginDirectory), "lib/athena/assets/pdf-worker.js");
    let workerSource: Promise<string> | undefined;
    const pdf = createPdfReader(() => workerSource ??= fs.readFile(asset, "utf8"));
    let controller: AthenaController;
    const knowledge = new KnowledgeService(host, policy, state.identities, pdf, () => controller?.notify());
    controller = new AthenaController(state, knowledge, store, settings => settings.provider === "mock" ? new MockProvider() : new OllamaProvider(new OllamaTransport(settings.port)));
    if (plugin.oath?.onChange) plugin.register(plugin.oath.onChange(() => controller.contextChanged()));
    plugin.app.workspace.onLayoutReady(() => {
      if (destroyed) return;
      const contentChanged = (file: import("obsidian").TAbstractFile) => {
        if (policy.allowsPath(file.path)) controller.sourcesChanged(file.path);
      };
      plugin.registerEvent(plugin.app.vault.on("create", contentChanged));
      plugin.registerEvent(plugin.app.vault.on("modify", contentChanged));
      plugin.registerEvent(plugin.app.vault.on("delete", contentChanged));
      plugin.registerEvent(plugin.app.vault.on("rename", (file, oldPath) => {
        if (policy.allowsPath(file.path) || policy.allowsPath(oldPath)) { controller.sourceRenamed(oldPath, file.path); void controller.persist().catch(() => {}); }
      }));
      const refresh = () => { if (state.settings.enabled && !controller.busy && !knowledge.coverage.indexing) void knowledge.refresh(undefined, true).then(() => controller.persist()).catch(() => {}); };
      plugin.registerInterval(window.setInterval(refresh, 5 * 60 * 1000));
      plugin.registerDomEvent(window, "focus", refresh);
      plugin.registerEvent(plugin.app.workspace.on("active-leaf-change", () => controller.notify()));
      refresh();
    });
    return controller;
  })();
  // Initialization failure remains local to Athena, never to the Hub/Atlas load.
  void ready.catch(() => {});

  const openSource = (evidence: Evidence) => { void ready.then(async controller => {
    if (destroyed || !controller.knowledge.permitted(evidence)) return;
    class SourceModal extends Modal {
      private disposeColors?: () => void;
      private unsubscribe?: () => void;
      onOpen() {
        this.disposeColors = options.ownColors?.(this.containerEl);
        modals.add(this); this.modalEl.classList.add("hub-athena-source-modal", "hub-button-scope");
        el(this.contentEl, "h2", "", sourceLabel(evidence));
        const status = el(this.contentEl, "p", "hub-athena-muted", "Checking source revision…");
        el(this.contentEl, "pre", "hub-athena-excerpt", evidence.text);
        this.unsubscribe = controller.subscribe(() => {
          if (!controller.knowledge.permitted(evidence)) { this.contentEl.replaceChildren(); el(this.contentEl, "p", "", "This source is now restricted. Close this preview."); }
        });
        void controller.knowledge.validate([evidence], new AbortController().signal).then(current => {
          if (!this.contentEl.isConnected || destroyed || !controller.knowledge.permitted(evidence)) return;
          status.textContent = current ? "Recorded excerpt from the current source revision." : "The source changed or disappeared. This is the recorded excerpt from the answer's revision.";
        }).catch(() => { status.textContent = "Current source revision could not be checked."; });
        const currentPath = controller.knowledge.currentPath(evidence.documentId);
        if (currentPath && /\.(md|pdf)$/i.test(currentPath)) button(this.contentEl, "Open current source", () => {
          if (destroyed || !controller.knowledge.permitted(evidence)) return;
          const actual = controller.knowledge.currentPath(evidence.documentId);
          if (!actual) { status.textContent = "The source is no longer available."; return; }
          void openVerifiedSource(controller.knowledge.host, plugin.app, actual, evidence.location, new AbortController().signal).catch(() => { status.textContent = "The source is unavailable, changed, or restricted."; });
        });
      }
      onClose() { this.disposeColors?.(); this.unsubscribe?.(); modals.delete(this); this.contentEl.replaceChildren(); }
    }
    new SourceModal(plugin.app).open();
  }).catch(() => {}); };

  class AthenaView extends ItemView {
    presenter?: SidebarPresenter;
    private disposeColors?: () => void;
    private selected?: string;
    private closed = true;
    constructor(leaf: WorkspaceLeaf) { super(leaf); this.navigation = false; }
    getViewType() { return ATHENA_VIEW; }
    getDisplayText() { return "Athena"; }
    getIcon() { return "sparkles"; }
    getState() { return { conversationId: this.presenter?.conversationId ?? this.selected }; }
    async setState(state: { conversationId?: string }, result: import("obsidian").ViewStateResult) {
      this.selected = typeof state.conversationId === "string" ? state.conversationId : undefined;
      if (this.presenter && this.selected) { this.presenter.conversationId = this.selected; this.presenter.render(); }
      await super.setState(state, result);
    }
    async onOpen() {
      this.disposeColors = options.ownColors?.(this.contentEl);
      this.closed = false; views.add(this); this.contentEl.classList.add("hub-athena-view");
      el(this.contentEl, "p", "", "Loading Athena…");
      try {
        const controller = await ready;
        if (this.closed || destroyed) return;
        this.contentEl.replaceChildren();
        this.presenter = new SidebarPresenter(this.contentEl, controller, { conversationId: this.selected, projects: () => projects().map(project => ({ id: project.projectId, name: project.name })), openSource, openSettings });
      } catch (error) { if (!this.closed && !destroyed) { this.contentEl.replaceChildren(); el(this.contentEl, "p", "hub-athena-error", safeMessage(error)); } }
    }
    releaseColorScope() { this.disposeColors?.(); this.disposeColors = undefined; }
    async onClose() { this.releaseColorScope(); this.closed = true; this.presenter?.dispose(); this.presenter = undefined; views.delete(this); if (!views.size) void ready.then(controller => controller.stop()).catch(() => {}); }
  }
  plugin.registerView(ATHENA_VIEW, leaf => new AthenaView(leaf));
  const open = async () => {
    if (destroyed) return;
    const workspace = plugin.app.workspace;
    let leaf: WorkspaceLeaf | undefined = workspace.getLeavesOfType(ATHENA_VIEW)[0];
    if (!leaf) { const side = workspace.getRightLeaf(false); if (!side) throw new AthenaError("A right sidebar leaf is unavailable."); leaf = side; await leaf.setViewState({ type: ATHENA_VIEW, active: true }); }
    await workspace.revealLeaf(leaf);
  };
  plugin.addCommand({ id: "open-athena", name: "Open Athena", callback: () => { void open().catch(() => {}); } });
  return {
    open,
    mountSettings(parent: HTMLElement) {
      let disposed = false, unmount: (() => void) | undefined;
      const loading = el(parent, "p", "", "Loading Athena settings…");
      void ready.then(controller => { if (!disposed && !destroyed) { loading.remove(); unmount = mountSettings(parent, controller, () => { void open().catch(() => {}); }); } }).catch(error => { if (!disposed && !destroyed) loading.textContent = safeMessage(error); });
      return () => { disposed = true; unmount?.(); loading.remove(); };
    },
    preserveRightSidebar(): boolean {
      return !destroyed && plugin.app.workspace.getLeavesOfType(ATHENA_VIEW).some(leaf => leaf.getRoot() === plugin.app.workspace.rightSplit && [...leaf.view.containerEl.getClientRects()].some(rect => rect.width > 0 && rect.height > 0));
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      for (const view of views) { view.releaseColorScope(); view.presenter?.dispose(); }
      for (const modal of modals) modal.close();
      views.clear(); modals.clear(); void ready.then(controller => controller.dispose()).catch(() => {});
    }
  };
}
