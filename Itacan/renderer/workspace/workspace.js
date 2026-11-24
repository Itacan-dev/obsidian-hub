import { el, button, icon, report } from '../ui/elements.js';
import { askName } from '../ui/dialog.js';

export async function workspaceView(library, folder, { openFolder, openNote }) {
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
    panel.append(row);
  }
  root.append(panel);
  return { root };
}
