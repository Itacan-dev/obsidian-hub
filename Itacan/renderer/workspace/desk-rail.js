import './desk-rail.css';
import { el, button, report } from '../ui/elements.js';
import { taskPanel } from '../tasks/tasks.js';
import { resizeDivider } from './divider.js';
import { fileTree } from './tree.js';
import { fileDrag } from './file-drag.js';

export function mountDeskRail(ctx, grid, panes, currentPane, remember) {
  const { layout } = ctx;
  const rail = el('aside', 'desk-rail');
  const heading = el('header', 'rail-heading');
  const navigationHost = el('div', 'rail-navigation');
  const panels = el('div', 'rail-panels');
  rail.append(heading, navigationHost, panels);
  let explorer, tasks, workspace;

  const drag = fileDrag(async (paths, parent) => {
    await remember();
    for (const path of paths) await ctx.changeFile(path, parent, path.split('/').at(-1));
    await ctx.showDesk();
  }, async (files, parent) => {
    ctx.install(await window.itacan.importFiles(ctx.library.session, parent, files), 'files');
    await explorer.refresh();
  });

  function showContext() {
    const file = currentPane().file;
    const folder = ctx.workspaces.contextFor(file, layout.workspace);
    layout.workspace = folder;
    if (layout.folder !== folder && !layout.folder?.startsWith(folder + '/')) {
      layout.folder = ctx.workspaces.explorer(folder)?.folder || folder;
    }
    if (workspace !== folder) {
      workspace = folder;
      if (!layout.expanded) {
        const parts = file.split('/');
        layout.expanded = parts.slice(2, -1).map((_, i) => parts.slice(0, i + 3).join('/'));
      }
      const order = [...(ctx.workspaces.explorer(folder)?.order || [])];
      const reorderFolders = () => ctx.workspaces.saveExplorer({
        expanded: [], folder, ...ctx.workspaces.explorer(folder), path: folder, order
      });
      explorer = fileTree(ctx, folder, {
        expanded: layout.expanded, fileDrag: drag, folderOrder: order, reorderFolders,
        activeFile: () => currentPane().file, changed: remember
      });
      tasks = taskPanel(ctx, folder, () => currentPane().file);
      heading.replaceChildren(explorer.header);
      panels.replaceChildren(explorer.root, tasks.root);
    }
    for (const item of explorer?.root.querySelectorAll('[data-path]') || []) {
      if (item.dataset.path === file) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  }

  const toggle = button('', async () => {
    layout.railClosed = !layout.railClosed;
    styleRail();
    await remember();
  }, { symbol: 'back', variant: 'icon-button rail-toggle' });

  function styleRail() {
    grid.classList.toggle('closed-rail', !!layout.railClosed);
    if (layout.railWidth) grid.style.setProperty('--rail-width', layout.railWidth + 'px');
    else grid.style.removeProperty('--rail-width');
    toggle.setAttribute('aria-expanded', String(!layout.railClosed));
    toggle.title = layout.railClosed ? 'Show workspace rail' : 'Hide workspace rail';
    toggle.setAttribute('aria-label', toggle.title);
  }

  // CSS supplies the responsive full width. Persist only a deliberate adjustment.
  const measure = el('div', 'rail-measure');
  const divider = resizeDivider('Workspace rail width', () => rail.offsetWidth, width => {
    layout.railWidth = Math.round(Math.max(170, Math.min(width, measure.offsetWidth)));
    styleRail();
  }, remember, {
    rememberSize() {
      const previous = layout.railWidth;
      return () => {
        layout.railWidth = previous;
        styleRail();
      };
    }
  });

  divider.onkeydown = event => {
    const full = measure.offsetWidth;
    const half = Math.max(170, Math.round(full / 2));
    const sizes = { Home: 0, End: full, ArrowLeft: rail.offsetWidth > half + 1 ? half : 0, ArrowRight: full };
    if (!(event.key in sizes)) return;
    event.preventDefault();
    const width = sizes[event.key];
    layout.railClosed = width === 0;
    if (width === full) delete layout.railWidth;
    else if (width) layout.railWidth = width;
    styleRail();
    if (layout.railClosed) toggle.focus();
    remember().catch(report);
  };
  divider.ondblclick = () => {
    delete layout.railWidth;
    styleRail();
    remember().catch(report);
  };
  styleRail();
  grid.append(measure, rail, divider, panes, toggle);

  return { navigationHost, drag, showContext, refreshTasks: id => tasks?.refresh(id) };
}
