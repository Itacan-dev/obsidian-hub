import { el, button, report } from './elements.js';
import { showDialog } from './dialog.js';
import {workspaceName} from '../workspace/context.js';
import './forms.css';

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
export async function pickPath(ctx, title, kind, start = '', { fields, onSelect, confirm = 'Choose', commit } = {}) {
  const body = el('div', kind === 'location' ? 'path-picker task-location-picker' : 'path-picker');
  const fileOnly = ['note','document','audio','image'].includes(kind);
  let folder = start, selected = null, generation = 0;
  const header = el('div', 'actions');
  const workspaces = [...ctx.library.projects,...ctx.library.resources];
  let workspace;
  if (kind === 'location') {
    workspace = field(body, 'Workspace', 'select', '', workspaces.map(w=>w.path));
    workspace.onchange = () => load(workspace.value,workspace.value).catch(report);
    folder ||= workspaces[0]?.path || '';
  }
  const search = field(body, 'Filter', 'search');
  const list = el('div', 'picker-list');
  search.parentElement.before(header); body.append(list);
  if (fields) body.prepend(fields);
  let rows = [];
  function syncConfirm() {
    const submit=body.closest('dialog')?.querySelector('footer .primary');
    if(submit)submit.disabled=!(selected || folder && !fileOnly);
  }
  function render() {
    list.replaceChildren();
    for (const item of rows.filter(e => e.name.toLowerCase().includes(search.value.toLowerCase()))) {
      if (item.kind === 'folder') list.append(button(item.name, () => load(item.path), { symbol: 'folder' }));
      const audio = kind === 'audio' && item.kind === 'file' && /\.(mp3|m4a|aac|wav|ogg|flac|opus)$/i.test(item.name);
      const image = kind === 'image' && item.kind === 'file' && /\.(png|jpe?g|gif|avif|webp)$/i.test(item.name);
      if (audio || image || item.kind === 'note' && ['note', 'document', 'location'].includes(kind) || ['document','location'].includes(kind) && item.openable) {
        const row = button(item.name, async () => {
          selected = item.path;
          for (const other of list.querySelectorAll('[aria-pressed]')) other.setAttribute('aria-pressed',String(other === row));
          await onSelect?.(selected);syncConfirm();
        }, { symbol: 'note' });
        row.setAttribute('aria-pressed', String(selected === item.path));
        list.append(row);
      }
    }
  }
  async function load(path, candidate = workspace?.value) {
    const ticket = ++generation;
    const submit = body.closest('dialog')?.querySelector('footer .primary');
    const keepFocus = list.contains(document.activeElement) || header.contains(document.activeElement);
    if (submit) submit.disabled = true;
    list.inert = true;
    try {
      const options = path ? await window.itacan.entries(ctx.library.session, path) : workspaces;
      if (ticket !== generation) return;
      folder = path; selected = null; search.value = '';
      const owner = workspace && ctx.workspaces.contextFor(path,candidate);
      const attached = workspace ? ctx.workspaces.attachments(owner) : [];
      if (workspace && path===owner) {
        for (const target of attached) {
          const parts=target.split('/');
          options.push({kind:'folder',path:target,name:workspaceName(ctx.library,parts.slice(0,2).join('/'))+' / '+parts.slice(2).join('/')});
        }
      }
      rows = options; render(); list.scrollTop = 0;
      header.replaceChildren();
      if (workspace) {
        workspace.value = owner;
        const shared=attached.find(root=>path===root || path.startsWith(root+'/'));
        const parents=[owner];
        if (shared) parents.push(shared);
        const root=shared || owner;
        for (const part of path.slice(root.length).split('/').filter(Boolean)) parents.push(parents.at(-1)+'/'+part);
        for (const parent of parents) {
          const crumb = button(parent.split('/').at(-1), () => load(parent,owner), {variant:'quiet'});
          crumb.disabled = parent===path;
          header.append(crumb);
        }
      } else {
        header.append(el('strong', '', path || 'Workspaces'));
        if (path && path !== start) header.append(button('Back', () => load(path.split('/').length === 2 ? '' : path.split('/').slice(0, -1).join('/'))));
      }
      await onSelect?.(null);
    } finally {
      if (ticket === generation) {
        list.inert = false;
        syncConfirm();
        if (keepFocus) (list.firstElementChild || search).focus({preventScroll:true});
      }
    }
  }
  search.oninput = () => {
    if(selected && !selected.split('/').at(-1).toLowerCase().includes(search.value.toLowerCase())) {
      selected=null;Promise.resolve(onSelect?.(null)).catch(report);
    }
    render();syncConfirm();
  };
  await load(folder);
  const answer=showDialog({
    title, content: body, actions: [{ label: 'Cancel', value: null }, {
      label: confirm, primary: true, get value() { return selected || folder; },
      async run() {
        if (!(selected || folder && !fileOnly)) throw Error('Select a destination.');
        await commit?.(selected || folder,workspace?.value);
      }
    }]
  });
  syncConfirm();return answer;
}
