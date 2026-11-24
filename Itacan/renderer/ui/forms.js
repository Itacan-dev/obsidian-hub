import { el, button } from './elements.js';
import { showDialog } from './dialog.js';

export function field(parent, label, type = 'text', value = '', choices) {
  const wrap = el('label', 'field', label);
  const input = el(choices ? 'select' : type === 'textarea' ? 'textarea' : 'input');
  input.setAttribute('aria-label', label);
  if (choices) for (const choice of choices) input.add(new Option(choice || 'None', choice));
  else if (input.tagName === 'INPUT') input.type = type;
  input.value = value;
  wrap.append(input); parent.append(wrap);
  return input;
}
export function confirmAction(title, description, label) {
  return showDialog({ title, description, actions: [{ label: 'Cancel', value: false }, { label, value: true, primary: true }] });
}
// Walk one folder at a time, shared by filing, task references, Plan and moves.
export async function pickPath(ctx, title, kind, start = '') {
  const body = el('div', 'path-picker');
  let folder = start, selected = null, generation = 0;
  const header = el('div', 'actions');
  const search = field(body, 'Filter', 'search');
  const list = el('div', 'picker-list');
  body.prepend(header); body.append(list);
  let rows = [];
  function render() {
    list.replaceChildren();
    for (const item of rows.filter(e => e.name.toLowerCase().includes(search.value.toLowerCase()))) {
      if (item.kind === 'folder') list.append(button(item.name, () => load(item.path), { symbol: 'folder' }));
      if (item.kind === 'note' && ['note', 'location'].includes(kind)) {
        const row = button(item.name, () => { selected = item.path; render(); }, { symbol: 'note' });
        row.setAttribute('aria-pressed', String(selected === item.path));
        list.append(row);
      }
    }
  }
  async function load(path) {
    const ticket = ++generation;
    folder = path; selected = null; search.value = ''; rows = []; render();
    header.replaceChildren(el('strong', '', path || 'Workspaces'));
    if (path && path !== start) header.append(button('Back', () => load(path.split('/').length === 2 ? '' : path.split('/').slice(0, -1).join('/'))));
    const options = path ? await window.itacan.entries(ctx.library.session, path) : [...ctx.library.projects, ...ctx.library.resources];
    if (ticket === generation) { rows = options; render(); }
  }
  search.oninput = render;
  await load(folder);
  return showDialog({
    title, content: body, actions: [{ label: 'Cancel', value: null }, {
      label: 'Choose', primary: true, get value() { return selected || folder; },
      run() { if (!(selected || folder && kind !== 'note')) throw Error('Select a destination.'); }
    }]
  });
}
