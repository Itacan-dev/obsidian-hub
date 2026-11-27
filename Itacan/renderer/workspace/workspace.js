import { dashboardDate } from '../ui/dashboard.js';
import { el, button } from '../ui/elements.js';
import { onContext } from '../ui/menu.js';
import { contextSearch } from '../ui/context-search.js';
import { progressPanel } from '../progress/panel.js';
import { taskPanel } from '../tasks/tasks.js';
import { launchShortcuts } from '../settings/settings.js';
import { roadmapDialog, workspacePlan } from '../plan/project.js';
import { workspaceName } from './context.js';
import { fileBrowser } from './file-browser.js';
import './workspace.css';

export async function workspaceView(library, folder, ctx, route = {}) {
  const owner = ctx.workspaces.contextFor(folder, route.workspace);
  const isProject = owner.startsWith('Projects/');
  const go = (path, options = {}) => ctx.openFolder(path, { workspace: owner, ...options });

  const root = el('section', 'workspace view-width');
  const cover = el('div', 'dashboard-cover workspace-cover');
  const title = el('header', 'dashboard-heading');
  const titleBox = el('div');
  titleBox.append(
    el('h1', '', workspaceName(library, owner)),
    el('p', 'context-label', isProject ? 'Project' : 'Resource')
  );
  title.append(titleBox, dashboardDate());

  const progress = progressPanel(ctx, owner);
  const tasks = taskPanel(ctx, owner);
  const files = fileBrowser(ctx, owner, folder, go, () => progress.refresh('files'));
  if (isProject) onContext(titleBox, () => files.workspaceMenu());

  const shortcuts = el('div', 'workspace-shortcuts');
  if (isProject) shortcuts.append(el('strong', 'context-label', 'Work'));
  shortcuts.append(contextSearch(ctx, owner, () => files.folder));
  if (isProject) {
    shortcuts.append(
      button('Roadmap', () => roadmapDialog(ctx, owner)),
      button('Today’s plan', () => workspacePlan(ctx, owner))
    );
  }
  shortcuts.append(launchShortcuts(ctx));

  const work = el('div', 'workspace-work');
  const summary = el('div', 'workspace-summary');
  summary.append(tasks.root, progress.root);
  work.append(files.root, summary);
  root.append(cover, title, shortcuts, work);
  await files.openFolder(folder, route);

  return {
    root,
    owner,
    openFolder: files.openFolder,
    mounted: files.mounted,
    refresh(group, action, id) {
      progress.refresh(group);
      const attachmentsChanged = group === 'workspace' && ['attach', 'detach'].includes(action);
      if (!group || group === 'task' || group === 'oath' || attachmentsChanged) tasks.refresh(id);
    }
  };
}
