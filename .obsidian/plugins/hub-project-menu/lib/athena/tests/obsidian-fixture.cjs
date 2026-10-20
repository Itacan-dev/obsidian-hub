"use strict";
const assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 15000) { const end = Date.now() + timeout; while (Date.now() < end) { const value = check(); if (value) return value; await delay(40); } throw Error("Timed out: " + label); }
module.exports = async scratch => {
  let plugin = app.plugins.plugins["hub-project-menu"]; assert(plugin.athena, "Production Hub owns Athena integration");
  await until(() => app.workspace.layoutReady, "native workspace restoration");
  document.querySelectorAll(".modal-container .modal-close-button,.modal-container .modal-header-button").forEach(button => button.click());
  assert(app.commands.executeCommandById("hub-project-menu:open-athena")); const view = await until(() => app.workspace.getLeavesOfType("hub-athena")[0]?.view?.presenter, "native Athena ItemView");
  const controller = view.controller, host = controller.knowledge.host, reads = [], read = host.read.bind(host); host.read = async (...args) => { reads.push(args[0].path); return read(...args); };
  assert.equal(controller.state.settings.enabled, false); assert.equal(controller.status.state, "disconnected");
  plugin.settingsControl.open("athena"); await until(() => document.querySelector(".hub-athena-settings"), "Athena native Settings");
  const settings = document.querySelector(".hub-athena-settings"); assert.equal(document.querySelector('.hub-settings-dialog [role="tab"][aria-selected="true"]').textContent, "Athena");
  settings.querySelector('input[type="checkbox"]').checked = true; settings.querySelector("select").value = "mock"; settings.querySelector("textarea").value = "Private";
  [...settings.querySelectorAll("button")].find(button => button.textContent === "Save settings").click(); await until(() => controller.state.settings.enabled && controller.state.settings.provider === "mock", "device-local configuration");
  await controller.connect(); document.querySelector(".hub-settings-dialog .modal-close-button,.hub-settings-dialog .modal-header-button")?.click();
  await controller.send(view.conversationId, "copper calibration wavelength?", { kind: "vault" }, false); await delay(100);
  const conversation = controller.state.conversations.find(item => item.id === view.conversationId); assert.equal(conversation.turns[0].state, "complete", conversation.turns[0].error);
  assert(conversation.turns[0].evidence.some(item => item.path === "Unregistered/Lab.md" && item.location.startLine === 1));
  assert(!reads.some(item => item.startsWith("Private/") || item.startsWith(".obsidian/")));
  assert(controller.knowledge.documents.get("Research/Paper.pdf")?.segments[0].text.includes("520"), JSON.stringify([...controller.knowledge.statuses.values()]));
  assert.equal(controller.knowledge.documents.get("Research/Paper.pdf").segments[0].location.page, 1);
  assert(controller.knowledge.documents.get("Code/analysis.py")); assert.equal(document.querySelectorAll(".hub-athena img,.hub-athena script,.hub-athena iframe").length, 0); assert.equal(globalThis.athenaInjected, undefined);
  await plugin.athena.open(); await until(() => plugin.athena.preserveRightSidebar(), "visible native Athena sidebar"); plugin.workspaceModes.collapseNativeSidebars(); assert.equal(app.workspace.rightSplit.collapsed, false);
  app.workspace.rightSplit.collapse(); plugin.workspaceModes.collapseNativeSidebars(); assert.equal(app.workspace.rightSplit.collapsed, true); await plugin.athena.open();
  const input = view.root.querySelector("textarea"); input.value = "Retain this draft"; input.focus(); input.setSelectionRange(2, 7); controller.notify(); await delay(80); assert.equal(view.root.querySelector("textarea"), input); assert.equal(input.value, "Retain this draft"); assert.equal(input.selectionStart, 2);
  const before = conversation.turns.length; input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true })); await delay(60); assert.equal(conversation.turns.length, before);
  const inspect = [...view.root.querySelectorAll("button")].find(button => button.textContent === "Inspect source"); inspect.closest("details").open = true; inspect.click();
  await until(() => document.querySelector(".hub-athena-source-modal"), "inert native source preview"); assert(document.querySelector(".hub-athena-source-modal pre").textContent.includes("520"));
  const sourcePath = conversation.turns[0].evidence[0].path;
  [...document.querySelectorAll(".hub-athena-source-modal button")].find(button => button.textContent === "Open current source").click();
  await until(() => app.workspace.getActiveFile()?.path === sourcePath, "verified native source file opening");
  document.querySelector(".hub-athena-source-modal .modal-close-button,.hub-athena-source-modal .modal-header-button")?.click();
  input.value = "appendix"; [...view.root.querySelectorAll("button")].find(button => button.textContent === "Search vault").click();
  const pdfSource = await until(() => [...view.root.querySelectorAll(".hub-athena-search-results details")].find(row => row.querySelector("summary")?.textContent.includes("page 2")), "PDF page-two evidence");
  pdfSource.open = true; pdfSource.querySelector("button").click(); await until(() => document.querySelector(".hub-athena-source-modal"), "PDF source preview");
  [...document.querySelectorAll(".hub-athena-source-modal button")].find(button => button.textContent === "Open current source").click();
  try { await until(() => app.workspace.getLeavesOfType("pdf").some(leaf => { const viewer = leaf.view.viewer?.child?.pdfViewer; return leaf.view.getState().file === "Research/Paper.pdf" && (viewer?.pdfViewer ?? viewer)?.currentPageNumber === 2; }), "native PDF page-two navigation"); }
  catch (error) {
    console.log("Athena fixture PDF diagnostics", JSON.stringify({ active: app.workspace.getActiveFile()?.path, status: document.querySelector(".hub-athena-source-modal .hub-athena-muted")?.textContent,
      views: app.workspace.getLeavesOfType("pdf").map(leaf => ({ state: leaf.view.getState(), pdfKeys: Object.keys(leaf.view.viewer?.child?.pdfViewer ?? {}), currentPage: leaf.view.viewer?.child?.pdfViewer?.pdfViewer?.currentPageNumber, inputs: [...leaf.view.contentEl.querySelectorAll("input")].map(input => ({ type: input.type, className: input.className, value: input.value })) })) })); throw error;
  }
  document.querySelector(".hub-athena-source-modal .modal-close-button,.hub-athena-source-modal .modal-header-button")?.click();
  const directory = controller.store.directory; assert(!directory.startsWith(path.join(scratch, "vault") + path.sep)); await controller.persist();
  const stored = JSON.parse(fs.readFileSync(path.join(directory, "state.json"), "utf8")); assert.equal(stored.conversations[0].turns[0].state, "complete");
  const id = conversation.id; await app.plugins.disablePlugin("hub-project-menu"); await delay(100); await app.plugins.enablePlugin("hub-project-menu"); plugin = app.plugins.plugins["hub-project-menu"]; await plugin.athena.open();
  const restored = await until(() => app.workspace.getLeavesOfType("hub-athena").find(leaf => leaf.view.presenter)?.view.presenter, "restored native view"); assert(restored.controller.state.conversations.some(item => item.id === id && item.turns[0]?.state === "complete"));
  const shared = restored.controller, oathListeners = plugin.oath.listeners.size;
  for (let index = 0; index < 50; index++) {
    app.workspace.getLeavesOfType("hub-athena")[0].detach(); await delay(1); assert.equal(shared.listeners.size, 0);
    await plugin.athena.open(); const current = await until(() => app.workspace.getLeavesOfType("hub-athena")[0]?.view.presenter, "native reopen"); assert.equal(current.controller, shared); assert.equal(shared.listeners.size, 1);
  }
  assert.equal(plugin.oath.listeners.size, oathListeners); await shared.connect();
  await plugin.athena.open(); await until(() => plugin.athena.preserveRightSidebar(), "final visible sidebar");
  for (const theme of ["theme-light", "theme-dark"]) {
    document.body.classList.remove("theme-light", "theme-dark"); document.body.classList.add(theme); await delay(40);
    const root = app.workspace.getLeavesOfType("hub-athena")[0].view.contentEl;
    assert(root.scrollWidth <= root.clientWidth + 2, JSON.stringify({ theme, width: root.clientWidth, scroll: root.scrollWidth, collapsed: app.workspace.rightSplit.collapsed, children: [...root.children].map(item => ({ className: item.className, width: item.getBoundingClientRect().width, scroll: item.scrollWidth })) }));
  }
  return { obsidian: plugin.constructor.__athenaRuntimeApi.apiVersion, checks: ["production bundle/command/native view", "native Settings category", "real Vault and adapter reads", "configuration/exclusion boundaries", "PDF worker asset and page location", "code discovery", "inert rendering", "visible sidebar preservation and explicit collapse", "draft/selection/IME", "native source inspection and opening", "offline PDF retrieval and native page-two navigation", "device-local persistence and plugin reload", "50 native view cycles with stable listeners", "light/dark layouts"], inference: "recording mock only; no Ollama request" };
};
