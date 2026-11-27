import { el, button, report } from '../ui/elements.js';
import { pickPath } from '../ui/forms.js';
import { mediaView } from '../document/media.js';
import { documentView } from '../document/document.js';
import { splitLayout, mountSplits } from './splits.js';
import { mountDeskRail } from './desk-rail.js';
import { deskTabs } from './desk-tabs.js';
import './desk.css';

export { addTab } from './desk-tabs.js';

// Each pane keeps its own reading and edit positions across visits to the desk.
const positionsByPane = new WeakMap();

export async function deskView(ctx, anchor) {
  const { layout, documents } = ctx;
  const root = el('section', 'desk');
  const grid = el('div', 'desk-grid');
  const panes = el('div', 'panes');
  const hosts = new Map();
  const current = () => layout.panes[layout.active];

  function rememberView(pane, part) {
    if (part.view && pane.tabs.includes(part.file)) (pane.views ||= {})[part.file] = part.view.snapshot();
  }
  function snapshot() {
    splitLayout(layout);
    for (const [pane, part] of hosts) {
      rememberView(pane, part);
      for (const file of Object.keys(pane.views || {})) {
        if (!pane.tabs.includes(file)) delete pane.views[file];
      }
    }
    return structuredClone(layout);
  }

  const remember = () => ctx.presets.remember({ layout: snapshot() });
  const tabs = deskTabs(ctx, snapshot, remember);
  const rail = mountDeskRail(ctx, grid, panes, current, remember);
  root.append(grid);

  function showContext() {
    rail.showContext();
    for (const [pane, part] of hosts) part.host.classList.toggle('selected-pane', pane === current());
    ctx.noteBreadcrumb(current().file);
  }

  function createPane(pane) {
    const host = el('div', 'pane');
    const strip = el('div', 'tabs');
    host.append(strip);
    function select() {
      const index = layout.panes.indexOf(pane);
      if (layout.active === index || index < 0) return;
      layout.active = index;
      showContext();
      remember().catch(report);
    }
    function observe(event) {
      if (event.isTrusted) ctx.observeWorkspace(pane.file);
    }
    for (const type of ['pointerdown', 'wheel', 'keydown']) host.addEventListener(type, observe, { passive: true });
    host.addEventListener('pointerdown', select);
    host.addEventListener('focusin', select);
    panes.append(host);
    const clearDrop = tabs.enableDrops(host, pane, rail.drag);
    const positions = positionsByPane.get(pane) || new Map();
    positionsByPane.set(pane, positions);
    const part = { host, strip, positions, clearDrop };
    hosts.set(pane, part);
    return part;
  }

  function unavailableDocument(pane, error) {
    const missing = pane.file;
    const content = el('section', 'empty');
    content.append(el('p', '', 'Document unavailable · ' + missing + ' · ' + error.message));
    content.append(button('Relink document', async () => {
      const selected = await pickPath(ctx, 'Relink document', 'document', '');
      if (!selected) return;
      const file = (await documents.get(selected)).path;
      await ctx.relinkDocument(missing, file);
      for (const other of layout.panes) {
        other.tabs = [...new Set(other.tabs.map(tab => tab === missing ? file : tab))];
        if (other.file === missing) other.file = file;
        if (other.views?.[missing]) {
          other.views[file] = other.views[missing];
          delete other.views[missing];
        }
      }
      tabs.activate(pane, file);
      await remember();
      await ctx.showDesk();
    }));
    return content;
  }

  async function showDocument(part, pane, anchor) {
    let next, content;
    try {
      const buffer = await documents.get(pane.file);
      const saved = pane.views?.[pane.file];
      const position = part.positions.get(pane.file) || { ...saved, read: saved?.read || 0 };
      part.positions.set(pane.file, position);
      next = buffer.kind ? mediaView(buffer, position) : documentView(buffer, pane, {
        openNote: ctx.openNote,
        pickCopyFolder: () => pickPath(ctx, 'Choose a folder for the recovered copy', 'folder'),
        anchor: pane === current() ? anchor : '',
        position,
        changedMode: () => { remember().catch(report); }
      });
      content = next.root;
    } catch (error) {
      content = unavailableDocument(pane, error);
    }
    rememberView(pane, part);
    part.view?.dispose();
    if (part.host.lastElementChild === part.strip) part.host.append(content);
    else part.host.lastElementChild.replaceWith(content);
    part.view = next;
    part.file = pane.file;
  }

  let renderedTree, renderedPanes = [];
  function arrange() {
    const tree = splitLayout(layout);
    const samePanes = renderedPanes.length === layout.panes.length && layout.panes.every((pane, i) => pane === renderedPanes[i]);
    if (tree === renderedTree && samePanes) return;
    const elements = new Map(layout.panes.map(pane => [pane.id, hosts.get(pane).host]));
    mountSplits(tree, elements, panes, remember);
    renderedTree = tree;
    renderedPanes = [...layout.panes];
  }

  async function syncDesk(anchor) {
    for (const [pane, part] of hosts) {
      if (!layout.panes.includes(pane)) {
        part.view?.dispose();
        part.host.remove();
        hosts.delete(pane);
      }
    }
    const changed = [];
    for (const pane of layout.panes) {
      const part = hosts.get(pane) || createPane(pane);
      tabs.render(part.strip, pane, part.positions);
      if (part.file === pane.file && part.view) {
        if (pane === current()) part.view.display(pane.edit, anchor);
      } else {
        await showDocument(part, pane, anchor);
        changed.push(part);
      }
    }
    arrange();
    // Scroll offsets can be restored once the split has its final viewport.
    if (root.isConnected) {
      for (const part of changed) {
        part.view?.mounted();
        part.strip.querySelector('[aria-pressed=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' });
      }
    }
    showContext();
  }

  root.addEventListener('dragend', () => {
    tabs.resetDrag();
    for (const part of hosts.values()) part.clearDrop();
  });
  await syncDesk(anchor);
  return {
    root, navigationHost: rail.navigationHost, syncDesk, snapshot,
    closeTab: tabs.closeCurrent, cycleTab: tabs.cycle,
    refresh(group, action, id) {
      if (!group || group === 'task' || group === 'oath') rail.refreshTasks(id);
    },
    save: () => documents.open.get(current().file)?.save().catch(report),
    mounted() { for (const [pane, part] of hosts) part.view?.mounted(pane === current()); },
    dispose() { for (const part of hosts.values()) part.view?.dispose(); }
  };
}
