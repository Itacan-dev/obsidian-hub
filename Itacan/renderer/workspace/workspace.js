import { el, button, icon, report } from '../ui/elements.js';
import { taskPanel } from '../tasks/tasks.js';
import { pickPath, confirmAction } from '../ui/forms.js';
import { askName, showDialog } from '../ui/dialog.js';

export async function workspaceView(library, folder, ctx) {
  const { openFolder, openNote } = ctx;
  const entries = await window.itacan.entries(library.session, folder);
  const parts = folder.split('/');
  const root = el('section', 'workspace view-width');
  const header = el('header', 'view-title');
  header.append(el('p', 'context-label', parts[0] === 'Projects' ? 'Project' : 'Resource'), el('h1', '', parts.at(-1)));
  root.append(header);
  const panel = el('section', 'files panel');
  const toolbar = el('header', 'section-heading');
  const actions = el('div', 'actions');
  async function create(kind) {
    const name = await askName(kind === 'note' ? 'New note' : 'New folder');
    if (!name) return;
    const created = await window.itacan.create(library.session, folder, name, kind);
    if (kind === 'note') await openNote(created, true);
    else await openFolder(created);
  }
  async function manage(entry, current = false) {
    const parent = entry.path.split('/').slice(0, -1).join('/');
    const options = [{ label: 'Rename', value: 'rename' }];
    if (parent !== 'Projects') options.push({ label: 'Move', value: 'move' });
    options.push({ label: 'Delete', value: 'delete' });
    const action = await showDialog({ title: entry.name, actions: options });
    if (!action) return;
    let name = entry.name, destination = parent;
    if (action === 'rename') name = await askName('Rename item', name, 'Rename');
    if (action === 'move') destination = await pickPath(ctx, 'Move to folder', 'folder');
    if (!name || !destination) return;
    const trash = action === 'delete';
    if (trash && !await confirmAction('Delete item?', 'Move ' + entry.name + ' and its contents to Trash?', 'Delete')) return;
    if (!await ctx.changeFile(entry.path, destination, name, trash)) return;
    if (!current) await openFolder(folder);
    else if (!trash) await openFolder(destination + '/' + name);
    else if (parent === 'Projects') await ctx.refresh();
    else await openFolder(parent);
  }
  if (parts.length > 2 || parts[0] === 'Projects') actions.append(button('Manage folder', () => manage({ name: parts.at(-1), path: folder }, true)));
  actions.append(button('New folder', () => create('folder'), { symbol: 'folder' }),
    button('New note', () => create('note'), { symbol: 'plus', variant: 'primary' }));
  toolbar.append(el('h2', '', 'Files'), actions);
  panel.append(toolbar);
  if (!entries.length) panel.append(el('p', 'empty', 'This folder is empty.'));
  for (const entry of entries) {
    const interactive = entry.kind !== 'file' || entry.openable;
    const row = el(interactive ? 'button' : 'div', 'file-row');
    row.append(icon(entry.kind), el('span', 'file-name', entry.name),
      el('span', 'file-type', { note: 'Markdown', folder: 'Folder', file: 'Attachment' }[entry.kind]));
    if (interactive) {
      row.append(icon('chevron'));
      row.onclick = () => {
        if (entry.kind === 'folder') return openFolder(entry.path);
        if (entry.kind === 'note') return openNote(entry.path);
        return window.itacan.openAttachment(library.session, entry.path).catch(report);
      };
    }
    const line = el('div', 'entry-line');
    const menu = button('Manage', () => manage(entry), { variant: 'quiet' });
    menu.setAttribute('aria-label', 'Manage ' + entry.name);
    line.append(row, menu); panel.append(line);
  }
  const tasks = taskPanel(ctx, parts.slice(0, 2).join('/'));
  root.append(panel, tasks.root);
  return { root, refresh: tasks.refresh };
}
