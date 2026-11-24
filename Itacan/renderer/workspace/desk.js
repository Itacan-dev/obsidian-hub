import { el, button, report } from '../ui/elements.js';
import { askName } from '../ui/dialog.js';
import { documentView } from '../document/document.js';
import { fileTree } from './tree.js';

export function addTab(layout, file, edit) {
  const pane = layout.panes[layout.active];
  if (!pane.tabs.includes(file)) pane.tabs.push(file);
  pane.file = file;
  pane.edit = edit;
}

export async function deskView(ctx, anchor) {
  const { layout, documents } = ctx;
  const root = el('section', 'desk');
  const controls = el('div', 'desk-tools actions');
  const grid = el('div', 'desk-grid');
  const panes = el('div', 'panes');
  const hosts = new Map();
  let tree, workspace;
  const remember = () => ctx.update('layout', 'remember', { layout: structuredClone(layout) });
  const current = () => layout.panes[layout.active];
  function showContext() {
    const folder = current().file.split('/').slice(0, 2).join('/');
    if (folder !== workspace) {
      workspace = folder;
      tree?.remove();
      tree = fileTree(ctx, folder);
      grid.prepend(tree);
    }
    for (const [pane, part] of hosts) part.host.classList.toggle('selected-pane', pane === current());
    ctx.noteBreadcrumb(current().file);
  }
  async function closeTab(pane) {
    const buffer = documents.open.get(pane.file);
    if (buffer && !layout.panes.some(other => other !== pane && other.tabs.includes(pane.file))) {
      if (!await documents.allowClose([buffer])) return;
      documents.open.delete(pane.file);
    }
    pane.tabs = pane.tabs.filter(f => f !== pane.file);
    pane.file = pane.tabs.at(-1) || '';
    if (!pane.file && layout.panes.length > 1) layout.panes.splice(layout.panes.indexOf(pane), 1);
    layout.active = Math.min(layout.active, layout.panes.length - 1);
    await remember();
    await ctx.showDesk();
  }
  function createPane(pane) {
    const host = el('div', 'pane');
    const tabs = el('div', 'tabs');
    host.append(tabs);
    function select() {
      const index = layout.panes.indexOf(pane);
      if (layout.active === index || index < 0) return;
      layout.active = index;
      showContext();
      void remember().catch(report);
    }
    host.addEventListener('pointerdown', select);
    host.addEventListener('focusin', select);
    panes.append(host);
    const part = { host, tabs };
    hosts.set(pane, part);
    return part;
  }
  async function syncDesk(anchor) {
    for (const [pane, part] of hosts) {
      if (layout.panes.includes(pane)) continue;
      part.view?.dispose(); part.host.remove(); hosts.delete(pane);
    }
    for (const pane of layout.panes) {
      const part = hosts.get(pane) || createPane(pane);
      part.tabs.replaceChildren();
      for (const path of pane.tabs) {
        const tab = button(path.split('/').at(-1), async () => {
          if (pane.file === path) return;
          pane.file = path;
          await remember();
          await ctx.showDesk();
        });
        tab.title = path;
        tab.setAttribute('aria-pressed', String(path === pane.file));
        part.tabs.append(tab);
      }
      part.tabs.append(button('Close tab', () => closeTab(pane)));
      if (part.file === pane.file && part.view) {
        if (pane === current()) part.view.display(pane.edit, anchor);
        continue;
      }
      part.view?.dispose();
      if (part.host.lastElementChild !== part.tabs) part.host.lastElementChild.remove();
      part.view = null;
      part.file = pane.file;
      try {
        const buffer = await documents.get(pane.file);
        part.view = documentView(buffer, pane, {
          openNote: ctx.openNote, anchor: pane === current() ? anchor : '',
          changedMode: () => void remember().catch(report)
        });
        part.host.append(part.view.root);
      } catch (error) {
        part.host.append(el('p', 'empty', 'Document unavailable · ' + pane.file + ' · ' + error.message));
      }
    }
    split.hidden = layout.panes.length > 1;
    showContext();
  }
  const split = button('Split view', async () => {
    layout.panes.push({ tabs: [current().file], file: current().file, edit: false });
    layout.active = 1;
    await remember(); await ctx.showDesk();
  });
  controls.append(button('Save layout', async () => {
    const name = await askName('Name this layout');
    if (name) await ctx.update('layout', 'preset', { name, layout: structuredClone(layout) });
  }), split);
  grid.append(panes); root.append(controls, grid);
  await syncDesk(anchor);
  return {
    root, syncDesk, save: () => documents.open.get(current().file)?.save().catch(report),
    mounted: () => hosts.get(current())?.view?.mounted(),
    dispose: () => { for (const part of hosts.values()) part.view?.dispose(); }
  };
}
