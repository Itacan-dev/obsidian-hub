import './file-browser.css';
import { el, button, report } from '../ui/elements.js';
import { menu } from '../ui/menu.js';
import { fileTree } from './tree.js';
import { workspaceName } from './context.js';
import { attachFolder } from './shared-folders.js';
import { resizeDivider } from './divider.js';
import { fileActions } from './file-actions.js';
import { fileList } from './file-list.js';

export function fileBrowser(ctx, owner, folder, go, onTreeRefresh) {
  const root = el('section', 'files panel');
  const heading = el('header', 'section-heading');
  heading.append(el('h2', '', 'Files'));
  const browser = el('div', 'folder-browser');
  const content = el('div', 'folder-contents');
  const crumbs = el('nav', 'actions folder-crumbs');
  const columns = el('div', 'file-columns');
  const tools = el('div', 'actions explorer-tools');

  const stored = ctx.workspaces.explorer(owner) || {};
  const order = [...(stored.order || [])];
  const expanded = [...(stored.expanded || [])];
  let sort = stored.sort || 'name';
  let direction = stored.direction || 1;
  let width = stored.width;
  const saveView = () => ctx.workspaces.saveExplorer({ path: owner, folder, expanded, sort, direction, width, order });

  const actions = fileActions(ctx, owner, () => folder, go, path => list.rename(path));
  const list = fileList(ctx, owner, actions, () => folder);
  const tree = fileTree(ctx, owner, {
    foldersOnly: true, selected: folder, expanded, select: go, changed: saveView,
    folderMenu: actions.folderMenu, fileDrag: actions.drag, folderOrder: order, reorderFolders: saveView
  });
  const setWidth = next => {
    width = next;
    if (width) browser.style.setProperty('--folder-width', width + 'px');
    else browser.style.removeProperty('--folder-width');
  };
  const divider = resizeDivider('Folder navigation width', () => tree.root.getBoundingClientRect().width, next => {
    const available = browser.clientWidth;
    setWidth(Math.round(Math.max(Math.min(160, available * .4), Math.min(available - 165, next))));
  }, saveView, {
    rememberSize() {
      const previous = width;
      return () => setWidth(previous);
    }
  });
  divider.ondblclick = () => {
    setWidth(null);
    saveView().catch(report);
  };
  setWidth(width);

  async function applySort(key, nextDirection) {
    sort = key;
    direction = nextDirection;
    list.sort(sort, direction);
    await saveView();
  }

  const choices = [];
  for (const [key, label] of [['name', 'Name'], ['mtime', 'Modified'], ['ctime', 'Created']]) {
    const defaultDirection = key === 'name' ? 1 : -1;
    columns.append(button(label, () => applySort(key, sort === key ? -direction : defaultDirection), { variant: 'quiet' }));
    const labels = key === 'name' ? ['Ascending', 'Descending'] : ['Oldest', 'Newest'];
    labels.forEach((order, index) => choices.push({
      label: label + ' · ' + order, run: () => applySort(key, index === 0 ? 1 : -1)
    }));
  }
  function tool(name, symbol, run) {
    const control = button('', run, { symbol });
    control.title = name;
    control.setAttribute('aria-label', name);
    return control;
  }
  const newNote = tool('New note', 'notePlus', () => actions.create('note'));
  const sortButton = tool('Sort by', 'sort', () => menu(sortButton, choices));
  tools.append(newNote, tool('New folder', 'folderPlus', () => actions.create('folder')), sortButton);
  tree.root.prepend(tools);

  if (owner.startsWith('Projects/')) {
    heading.append(button('Attach Resource folder', async () => {
      if (await attachFolder(ctx, owner)) await tree.refresh();
    }, { variant: 'quiet', symbol: 'plus' }));
  }
  root.onkeydown = list.keydown;
  content.oncontextmenu = event => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    menu(content, actions.folderMenu(folder), event);
  };
  content.append(crumbs, columns, list.root);
  browser.append(tree.root, divider, content);
  root.append(heading, browser);

  function showCrumbs() {
    const parts = folder.split('/');
    crumbs.replaceChildren(...parts.slice(1).map((name, index) => {
      const target = parts.slice(0, index + 2).join('/');
      return button(index ? name : workspaceName(ctx.library, target), () => go(target), { variant: 'quiet' });
    }));
  }

  async function openFolder(path, options) {
    const rows = await window.itacan.entries(ctx.library.session, path, true);
    if (ctx.workspaces.lastFolder() !== path || ctx.workspaces.lastWorkspace() !== owner) {
      await ctx.workspaces.visit({ path, workspace: owner });
    }
    const changed = path !== folder;
    folder = path;
    list.setEntries(rows, { retainSelection: !changed && options.retainSelection, selected: options.selected });
    if (changed || !crumbs.childElementCount) showCrumbs();
    newNote.disabled = folder === owner;
    newNote.title = newNote.disabled ? 'Create notes inside a workspace folder' : 'New note';
    if (options.refreshTree) {
      const saved = ctx.workspaces.explorer(owner);
      if (saved?.order) order.splice(0, order.length, ...saved.order);
      if (saved?.expanded) expanded.splice(0, expanded.length, ...saved.expanded);
      await tree.refresh();
      onTreeRefresh();
    }
    tree.setSelected(folder);
    const top = list.root.scrollTop;
    list.sort(sort, direction);
    list.root.scrollTop = changed ? 0 : top;
  }

  return {
    root,
    get folder() { return folder; },
    openFolder,
    workspaceMenu: () => actions.manageOptions([owner]),
    mounted(options, lostFocus) {
      if (options.rename) list.rename(options.rename);
      else if (options.selected) list.findRow(options.selected)?.focus();
      else if (lostFocus) crumbs.lastElementChild.focus({ preventScroll: true });
    }
  };
}
