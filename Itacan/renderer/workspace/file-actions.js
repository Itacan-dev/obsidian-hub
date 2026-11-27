import { askName } from '../ui/dialog.js';
import { confirmAction, pickPath } from '../ui/forms.js';
import { fileDrag } from './file-drag.js';
import { placements } from './tree.js';

// Commands are shared by the file rows, folder tree, keyboard shortcuts and toolbar.
export function fileActions(ctx, owner, currentFolder, go, startInlineRename) {
  const session = ctx.library.session;

  async function create(kind, parent = currentFolder()) {
    const base = kind === 'note' ? 'New note' : 'New folder';
    const suffix = kind === 'note' ? '.md' : '';
    const existing = await window.itacan.entries(session, parent);
    const names = new Set(existing.map(item => item.name));
    let name = base;
    let counter = 1;
    while (names.has(name + suffix)) name = base + ' (' + (++counter) + ')';
    const path = await window.itacan.create(session, parent, name, kind);
    await go(parent, { rename: path, selected: path, refreshTree: true });
  }

  async function manage(action, paths) {
    const first = paths[0];
    const parent = first.slice(0, first.lastIndexOf('/'));
    const destination = action === 'Move' ? await pickPath(ctx, 'Move to folder', 'folder') : parent;
    if (!destination) return;

    let name = first.split('/').at(-1);
    if (action === 'Rename') {
      if (startInlineRename(first)) return;
      if (first !== owner) return go(parent, { rename: first, selected: first });
      name = await askName('Rename workspace', name, 'Rename');
    }
    if (!name) return;
    const deleting = action === 'Delete';
    if (deleting && !await confirmAction('Delete selection?', paths.join('\n'), 'Delete')) return;

    try {
      for (const path of paths) {
        const nextName = action === 'Rename' ? name : path.split('/').at(-1);
        if (!await ctx.changeFile(path, destination, nextName, deleting)) break;
      }
    } finally {
      if (paths.includes(owner)) await ctx.refresh();
      else await go(paths.includes(currentFolder()) ? parent : currentFolder(), { refreshTree: true });
    }
  }

  function manageOptions(paths) {
    return ['Rename', 'Move', 'Delete']
      .filter(action => action !== 'Rename' || paths.length === 1)
      .filter(action => action !== 'Move' || paths[0] !== owner)
      .map(label => ({ label, run: () => manage(label, paths) }));
  }

  function addToClipboard(paths, cut) {
    ctx.fileClipboard = { paths: [...paths], cut };
  }

  async function paste(parent) {
    const clip = ctx.fileClipboard;
    if (!clip) return;
    try {
      for (const path of [...clip.paths]) {
        if (clip.cut) {
          await ctx.changeFile(path, parent, path.split('/').at(-1));
          clip.paths.splice(clip.paths.indexOf(path), 1);
        } else {
          await window.itacan.copyItem(session, path, parent);
        }
      }
    } finally {
      await go(currentFolder(), { refreshTree: true });
    }
  }

  async function moveDropped(paths, parent) {
    const folder = currentFolder();
    let nextFolder = folder;
    if (paths.length > 1) {
      const children = await window.itacan.entries(session, parent);
      const names = new Set(children.map(entry => entry.name));
      const collision = paths.map(path => path.split('/').at(-1)).find(name => names.has(name));
      if (collision) throw Error('An item already has the name ' + collision + '.');
    }
    try {
      for (const path of paths) {
        const name = path.split('/').at(-1);
        await ctx.changeFile(path, parent, name);
        if (path === folder || folder.startsWith(path + '/')) {
          nextFolder = parent + '/' + name + folder.slice(path.length);
        }
      }
    } finally {
      await go(nextFolder, { refreshTree: true, retainSelection: true });
    }
  }

  const drag = fileDrag(moveDropped, async (files, parent) => {
    ctx.install(await window.itacan.importFiles(session, parent, files), 'files');
    await go(currentFolder(), { refreshTree: true, retainSelection: true });
  }, parent => parent !== owner);

  const creationOptions = path => [
    { label: 'New note', disabled: path === owner, run: () => create('note', path) },
    { label: 'New folder', run: () => create('folder', path) },
    { label: 'Paste', disabled: !ctx.fileClipboard?.paths.length, run: () => paste(path) }
  ];
  const reveal = path => ({ label: 'Show in system explorer', run: () => window.itacan.revealItem(session, path) });

  function folderMenu(path) {
    const options = [...creationOptions(path), reveal(path)];
    if (ctx.workspaces.attachments(owner).includes(path)) {
      options.push({ label: 'Detach from Project', run: async () => {
        await ctx.workspaces.detachFolder({ project: owner, folder: path });
        await go(owner, { refreshTree: true });
      } });
    } else if (path !== owner) {
      options.push(...manageOptions([path]));
    }
    return options;
  }

  function open(entry) {
    if (entry.kind === 'folder') return go(entry.path);
    if (entry.kind === 'note' || entry.openable) return ctx.openNote(entry.path, undefined, '', 'replace', owner);
  }

  function fileMenu(entry, paths, files) {
    const items = [{
      label: 'Add selected files to plan',
      disabled: !files.length,
      run: () => ctx.plans.addMany({ items: files.map(file => ({ kind: file.kind, ref: file.path })) })
    }];
    if (paths.length === 1) {
      if (entry.kind === 'note' || entry.openable) items.push(...placements(ctx, entry, owner));
      else items.push({ label: 'Open', run: () => open(entry), disabled: entry.kind === 'file' });
      if (entry.kind === 'folder') items.push(...creationOptions(entry.path));
      items.push(reveal(entry.path));
    }
    return [
      ...items, ...manageOptions(paths),
      { label: 'Cut', run: () => addToClipboard(paths, true) },
      { label: 'Copy', run: () => addToClipboard(paths, false) },
      { label: paths.length === 1 ? 'Copy path' : 'Copy paths', run: () => window.itacan.copyPaths(session, paths) }
    ];
  }

  return { create, manage, manageOptions, addToClipboard, paste, drag, folderMenu, open, fileMenu };
}
