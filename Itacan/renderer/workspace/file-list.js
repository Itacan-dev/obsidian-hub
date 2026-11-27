import { el, report } from '../ui/elements.js';
import { onContext } from '../ui/menu.js';

export function fileList(ctx, owner, actions, currentFolder) {
  const list = el('div', 'file-list');
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Folder contents');
  list.setAttribute('aria-multiselectable', 'true');
  actions.drag.target(list, currentFolder);

  let entries = [];
  const selected = new Set();
  let anchor = null;

  function findRow(path) {
    return [...list.children].find(row => row.dataset.path === path);
  }

  function syncSelection() {
    for (const row of list.children) {
      row.setAttribute('aria-selected', String(selected.has(row.dataset.path)));
    }
  }

  function selectRow(entry, index, event) {
    if (event.shiftKey && anchor !== null) {
      if (!event.ctrlKey) selected.clear();
      const range = entries.slice(Math.min(anchor, index), Math.max(anchor, index) + 1);
      for (const item of range) selected.add(item.path);
    } else {
      if (!event.ctrlKey && !event.metaKey) selected.clear();
      if (selected.has(entry.path)) selected.delete(entry.path);
      else selected.add(entry.path);
      anchor = index;
    }
    syncSelection();
  }

  function rowFor(entry, index) {
    const row = el('button', 'file-row');
    row.setAttribute('role', 'option');
    row.dataset.path = entry.path;
    row.append(el('span', 'file-name', entry.name));
    for (const [key, className] of [['mtime', 'file-modified'], ['ctime', 'file-created']]) {
      const date = entry[key] ? new Date(entry[key]).toLocaleDateString() : '—';
      row.append(el('small', 'muted ' + className, date));
    }
    actions.drag.source(row, () => {
      if (!selected.has(entry.path)) {
        selected.clear();
        selected.add(entry.path);
        anchor = index;
        syncSelection();
      }
      return [...selected];
    });
    if (entry.kind === 'folder') actions.drag.target(row, entry.path);
    if (entry.kind === 'note' || entry.openable) {
      row.onauxclick = event => {
        if (event.button !== 1) return;
        event.preventDefault();
        ctx.openNote(entry.path, undefined, '', 'split', owner).catch(report);
      };
    }
    row.onclick = event => selectRow(entry, index, event);
    row.ondblclick = event => {
      if (!event?.ctrlKey && !event?.metaKey && !event?.shiftKey) Promise.resolve(actions.open(entry)).catch(report);
    };
    row.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        row.ondblclick();
      }
      if (event.key === 'Delete') actions.manage('Delete', selected.size ? [...selected] : [entry.path]).catch(report);
    };
    onContext(row, () => {
      if (!selected.has(entry.path)) {
        selected.clear();
        selected.add(entry.path);
        syncSelection();
      }
      const files = entries.filter(item => selected.has(item.path) && (item.kind === 'note' || item.openable));
      return actions.fileMenu(entry, [...selected], files);
    });
    return row;
  }

  function sort(key, direction) {
    anchor = null;
    entries.sort((a, b) => {
      const foldersFirst = Number(b.kind === 'folder') - Number(a.kind === 'folder');
      if (foldersFirst) return foldersFirst;
      const comparison = key === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a[key] - b[key];
      return direction * comparison;
    });
    const rows = document.createDocumentFragment();
    entries.forEach((entry, index) => rows.append(rowFor(entry, index)));
    list.replaceChildren(rows);
    syncSelection();
    if (!entries.length) list.append(el('p', 'empty', 'This folder is empty.'));
  }

  function setEntries(rows, { retainSelection, selected: selectPath }) {
    entries = rows;
    if (!retainSelection) selected.clear();
    else for (const path of selected) {
      if (!entries.some(entry => entry.path === path)) selected.delete(path);
    }
    if (selectPath) selected.add(selectPath);
  }

  function rename(path) {
    const row = findRow(path);
    if (!row) return false;
    const name = path.split('/').at(-1);
    const parent = path.slice(0, path.lastIndexOf('/'));
    const isNote = entries.find(entry => entry.path === path)?.kind === 'note';
    const input = el('input', 'text-input');
    input.value = isNote ? name.slice(0, -3) : name;
    input.setAttribute('aria-label', 'Item name');
    row.before(input);
    row.hidden = true;
    input.focus();
    input.select();

    let finished = false;
    async function finish(cancel) {
      if (finished) return;
      finished = true;
      const value = input.value.trim();
      const next = value && isNote && !/\.md$/i.test(value) ? value + '.md' : value;
      if (!cancel && next && next !== name) {
        try {
          await ctx.changeFile(path, parent, next);
          await ctx.openFolder(parent, { workspace: owner, selected: parent + '/' + next, refreshTree: true });
          return;
        } catch (error) {
          finished = false;
          report(error);
          input.focus();
          return;
        }
      }
      input.remove();
      row.hidden = false;
      row.focus();
    }
    input.onkeydown = event => {
      if (!['Escape', 'Enter'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      void finish(event.key === 'Escape');
    };
    input.onblur = () => void finish(false);
    return true;
  }

  function keydown(event) {
    if (event.target.closest('input')) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === 'a') {
      for (const entry of entries) selected.add(entry.path);
      syncSelection();
    } else if (mod && ['x', 'c'].includes(key) && selected.size) {
      actions.addToClipboard(selected, key === 'x');
    } else if (mod && key === 'v') {
      actions.paste(currentFolder()).catch(report);
    } else if (mod && event.shiftKey && key === 'n') {
      actions.create('folder').catch(report);
    } else if (key === 'f2' && selected.size === 1) {
      rename([...selected][0]);
    } else if (key === 'escape') {
      selected.clear();
      syncSelection();
    } else if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) && event.target.closest('.file-row')) {
      const rows = [...list.children];
      const index = rows.indexOf(event.target.closest('.file-row'));
      let next = index + (event.key === 'ArrowDown' ? 1 : -1);
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = rows.length - 1;
      const row = rows[Math.max(0, Math.min(rows.length - 1, next))];
      row.dispatchEvent(new MouseEvent('click', { shiftKey: event.shiftKey }));
      row.focus();
    } else {
      return;
    }
    event.preventDefault();
  }

  return { root: list, setEntries, sort, rename, findRow, keydown };
}
