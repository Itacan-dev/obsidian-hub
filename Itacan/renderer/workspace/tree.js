import { el, button, report } from '../ui/elements.js';
export function fileTree(ctx, workspace) {
  const rail = el('aside', 'file-tree panel');
  rail.append(button(workspace.split('/').at(-1), () => ctx.openFolder(workspace), { symbol: 'folder' }));
  async function populate(parent, path) {
    const entries = await window.itacan.entries(ctx.library.session, path);
    for (const entry of entries) {
      if (entry.kind === 'folder') {
        const branch = el('details');
        branch.append(el('summary', '', entry.name));
        branch.ontoggle = async () => {
          if (!branch.open || branch.childElementCount > 1) return;
          const nested = el('div', 'tree-children');
          branch.append(nested);
          nested.append(button('Open folder', () => ctx.openFolder(entry.path)));
          try { await populate(nested, entry.path); } catch (e) { nested.remove(); report(e); }
        };
        parent.append(branch);
      } else if (entry.kind === 'note') {
        parent.append(button(entry.name, () => ctx.openNote(entry.path), { symbol: 'note' }));
      } else if (entry.openable) {
        parent.append(button(entry.name, () => window.itacan.openAttachment(ctx.library.session, entry.path), { symbol: 'file' }));
      }
    }
  }
  void populate(rail, workspace).catch(report);
  return rail;
}
