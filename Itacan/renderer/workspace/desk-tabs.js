import './desk-tabs.css';
import { el, button, report } from '../ui/elements.js';
import { onContext } from '../ui/menu.js';
import { splitPane } from './splits.js';
import { paneDrop } from './pane-drop.js';
import { fileDragType } from './file-drag.js';

const tabType = 'application/x-itacan-tab';

export function addTab(layout, file, edit, placement) {
  const pane = layout.panes[layout.active];
  if (placement === 'split' || placement === 'below') {
    const next = { file, tabs: [file], edit };
    splitPane(layout, pane, next, placement === 'below' ? 'column' : 'row');
    layout.panes.splice(++layout.active, 0, next);
    return true;
  }
  if (pane.file === file && pane.edit === edit) return false;
  if (!pane.tabs.includes(file)) {
    if (placement === 'replace' && pane.file) pane.tabs.splice(pane.tabs.indexOf(pane.file), 1, file);
    else pane.tabs.push(file);
  }
  pane.file = file;
  pane.edit = edit;
  return true;
}

export function deskTabs(ctx, snapshot, remember) {
  const { layout, documents } = ctx;
  const current = () => layout.panes[layout.active];
  let draggedTab;

  function activate(pane, file) {
    pane.file = file;
    pane.edit = pane.views?.[file]?.editing ?? false;
    layout.active = layout.panes.indexOf(pane);
  }

  function removeTab(pane, file) {
    const active = current();
    const index = pane.tabs.indexOf(file);
    if (index < 0) return;
    pane.tabs.splice(index, 1);
    if (pane.file === file) activate(pane, pane.tabs[Math.min(index, pane.tabs.length - 1)] || '');
    if (!pane.tabs.length && layout.panes.length > 1) layout.panes.splice(layout.panes.indexOf(pane), 1);
    layout.active = layout.panes.includes(active) ? layout.panes.indexOf(active) : Math.min(layout.active, layout.panes.length - 1);
  }

  async function select(pane, file) {
    activate(pane, file);
    await remember();
    await ctx.showDesk();
  }

  async function closeTabs(pane, files) {
    // Ask about a dirty buffer only when removing the last tab displaying it.
    const closing = files
      .filter(file => !layout.panes.some(other => other !== pane && other.tabs.includes(file)))
      .map(file => documents.open.get(file))
      .filter(Boolean);
    if (!await documents.allowClose(closing)) return;
    for (const buffer of closing) documents.open.delete(buffer.path);
    for (const file of files) removeTab(pane, file);
    await remember();
    await ctx.showDesk();
  }

  async function moveTab(from, file, to, index, edge) {
    if (from === to && !edge && from.tabs.indexOf(file) === index) return;
    if (!from) file = (await documents.get(file)).path;
    snapshot();
    if (edge) {
      const next = { tabs: [], file: '', edit: false };
      const before = edge === 'left' || edge === 'top';
      const horizontal = edge === 'left' || edge === 'right';
      splitPane(layout, to, next, horizontal ? 'row' : 'column', before);
      layout.panes.splice(layout.panes.indexOf(to) + Number(!before), 0, next);
      to = next;
      index = 0;
    }
    if (from === to) {
      to.tabs.splice(to.tabs.indexOf(file), 1);
      to.tabs.splice(index, 0, file);
    } else {
      const prefs = from?.views?.[file];
      if (from) removeTab(from, file);
      if (!to.tabs.includes(file)) {
        to.tabs.splice(index, 0, file);
        if (prefs) (to.views ||= {})[file] = prefs;
      }
    }
    await select(to, file);
  }

  function tabMenu(pane, path) {
    const options = [
      { label: 'Close tab', run: () => closeTabs(pane, [path]) },
      { label: 'Close pane', run: () => closeTabs(pane, [...pane.tabs]) },
      { label: 'Split right', run: () => ctx.openNote(path, pane.edit, '', 'split') },
      { label: 'Split below', run: () => ctx.openNote(path, pane.edit, '', 'below') }
    ];
    for (const [index, target] of layout.panes.entries()) {
      if (target !== pane) options.push({ label: 'Move to pane ' + (index + 1), run: () => moveTab(pane, path, target, target.tabs.length) });
    }
    for (const [delta, label] of [[-1, 'Move tab earlier'], [1, 'Move tab later']]) {
      const index = pane.tabs.indexOf(path) + delta;
      if (index >= 0 && index < pane.tabs.length) options.push({ label, run: () => moveTab(pane, path, pane, index) });
    }
    return options;
  }

  function createTab(pane, path) {
    const wrapper = el('div', 'document-tab');
    wrapper.dataset.file = path;
    const name = path.split('/').at(-1);
    const tab = button(name, () => pane.file !== path && select(pane, path));
    tab.title = path;
    tab.dataset.path = path;
    tab.draggable = true;
    tab.ondragstart = event => {
      draggedTab = { pane, path };
      event.dataTransfer.setData(tabType, path);
      event.dataTransfer.effectAllowed = 'move';
    };
    tab.ondragend = () => { draggedTab = null; };
    tab.onmousedown = event => { if (event.button === 1) event.preventDefault(); };
    tab.onauxclick = event => {
      if (event.button === 1) {
        event.preventDefault();
        closeTabs(pane, [path]).catch(report);
      }
    };
    onContext(tab, () => tabMenu(pane, path));
    const close = button('', () => closeTabs(pane, [path]), { variant: 'tab-close', symbol: 'close' });
    close.title = 'Close ' + name;
    close.setAttribute('aria-label', close.title);
    wrapper.append(tab, close);
    return wrapper;
  }

  function render(strip, pane, positions) {
    for (const previous of [...strip.children]) {
      const file = previous.dataset.file;
      if (!pane.tabs.includes(file)) {
        positions.delete(file);
        previous.remove();
      }
    }
    for (const [index, path] of pane.tabs.entries()) {
      const existing = [...strip.children].find(tab => tab.dataset.file === path);
      const tab = existing || createTab(pane, path);
      if (strip.children[index] !== tab) strip.insertBefore(tab, strip.children[index] || null);
      tab.firstElementChild.setAttribute('aria-pressed', String(path === pane.file));
    }
  }

  function enableDrops(host, pane, railDrag) {
    function dragged(event) {
      const types = event.dataTransfer.types;
      if (types.includes(tabType)) return draggedTab;
      const [file] = railDrag.paths;
      if (types.includes(fileDragType) && railDrag.paths.length === 1 && /\.(?:md|pdf|png|jpe?g|webp|gif|avif)$/i.test(file)) {
        return { path: file };
      }
    }
    return paneDrop(host, pane, dragged, (source, to, index, edge) => {
      draggedTab = null;
      railDrag.finish();
      return moveTab(source.pane, source.path, to, index, edge);
    });
  }

  return {
    activate, render, enableDrops,
    resetDrag() { draggedTab = null; },
    closeCurrent: () => closeTabs(current(), [current().file]),
    cycle(step) {
      const pane = current();
      const count = pane.tabs.length;
      if (count >= 2) return select(pane, pane.tabs[(pane.tabs.indexOf(pane.file) + step + count) % count]);
    }
  };
}
