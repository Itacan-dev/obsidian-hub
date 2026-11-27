import { el, button, report } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';

const categories = ['Tasks', 'Files', 'Workspaces'];
const groupFor = kind => kind === 'task' ? 'Tasks' : kind === 'workspace' ? 'Workspaces' : 'Files';

export async function planPicker(ctx, plan, relink) {
  const body = el('div', 'plan-picker');
  const tabs = el('div', 'segmented-controls');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Item type');
  const workspaces = [...ctx.library.projects, ...ctx.library.resources];
  const names = workspaces.map(w => w.path);
  const all = 'All workspaces';
  const search = el('input','text-input'); search.type='search'; search.setAttribute('aria-label','Filter items');
  const scope = el('select','text-input'); scope.setAttribute('aria-label','Workspace');
  for(const name of [all,...names]) scope.add(new Option(name,name));
  body.append(search,scope);
  search.placeholder = 'Search';
  const trail = el('div', 'actions');
  const list = el('div', 'picker-list');
  const review = el('details', 'plan-review');
  body.prepend(tabs);
  body.append(trail, list, review);

  let category = relink ? 'Files' : 'Tasks';
  let folder = '', generation = 0;
  const selection = new Map();
  async function matchingFiles(roots, query, ticket) {
    const found = [];
    async function visit(folder) {
      for (const item of await window.itacan.entries(ctx.library.session,folder)) {
        if (ticket !== generation) return;
        if (item.kind === 'folder') await visit(item.path);
        else if ((item.kind === 'note' || item.openable) && item.path.toLowerCase().includes(query)) found.push(item);
      }
    }
    for (const root of roots) {
      if (ticket !== generation) break;
      await visit(root);
    }
    return found;
  }
  if (relink) {
    const owner = relink.ref.split('/').slice(0, 2).join('/');
    if (names.includes(owner)) scope.value = owner;
  }

  function refreshSelection() {
    const submit = body.closest('dialog')?.querySelector('footer .primary');
    if (submit) {
      submit.disabled = !selection.size;
      submit.textContent = relink ? 'Relink selected' : 'Add selected (' + selection.size + ')';
    }
    review.hidden = !selection.size;
    review.replaceChildren(el('summary', '', 'Review selected (' + selection.size + ')'));
    for (const group of categories) {
      const selected = [...selection].filter(([, item]) => groupFor(item.kind) === group);
      if (!selected.length) continue;
      review.append(el('strong', '', group));
      for (const [key, item] of selected) {
        const row = el('div', 'section-heading');
        const remove = button('Remove', () => { selection.delete(key); return render(); });
        remove.setAttribute('aria-label', 'Remove ' + item.label);
        row.append(el('span', '', item.label), remove);
        review.append(row);
      }
    }
  }

  function option(kind, ref, label, detail) {
    const key = kind + '|' + ref;
    const status = el('small','muted');
    const control = button(label, () => {
      if (selection.has(key)) selection.delete(key);
      else {
        if (relink) selection.clear();
        selection.set(key, {kind, ref, label});
      }
      if (relink) for (const other of list.querySelectorAll('button:enabled[aria-pressed=true]')) {
        other.setAttribute('aria-pressed','false');
        other.lastElementChild.textContent='';
      }
      status.textContent=selection.has(key)?'New':'';
      control.setAttribute('aria-pressed',String(selection.has(key)));
      refreshSelection();
    });
    control.setAttribute('aria-label', label);
    control.append(el('small', 'muted', detail));
    control.disabled = plan.entries.some(e => !e.missing && e.ref === ref && e.id !== relink?.id);
    status.textContent=control.disabled?'In plan':selection.has(key)?'New':'';
    control.append(status);
    control.setAttribute('aria-pressed', String(control.disabled || selection.has(key)));
    list.append(control);
  }

  async function render() {
    const ticket = ++generation;
    const query = search.value.trim().toLowerCase();
    const matches = text => text.toLowerCase().includes(query);
    let entries;
    if (category === 'Files' && query) {
      entries = await matchingFiles(scope.value === all ? names : [scope.value],query,ticket);
      if (ticket !== generation) return;
    } else if (category === 'Files' && scope.value !== all) {
      folder ||= scope.value;
      entries = await window.itacan.entries(ctx.library.session, folder);
      if (ticket !== generation) return;
    }
    list.replaceChildren();
    trail.replaceChildren();
    refreshSelection();
    for (const tab of tabs.children) tab.setAttribute('aria-pressed', String(tab.textContent === category));
    scope.hidden = category === 'Workspaces';
    if (category === 'Tasks') {
      for (const task of ctx.tasks.list()) {
        if (!task.done && (scope.value === all || ctx.tasks.inWorkspace(scope.value,task)) && matches(task.title))
          option('task', task.id, task.title, task.owner);
      }
    } else if (category === 'Files' && query) {
      for (const item of entries) option(item.kind,item.path,item.name,item.path.split('/').slice(0,-1).join(' / '));
    } else if (category === 'Workspaces' || scope.value === all) {
      for (const workspace of workspaces.filter(w => matches(w.name))) {
        if (category === 'Workspaces') option('workspace', workspace.path, workspace.name, workspace.path.startsWith('Projects/') ? 'Project' : 'Resource');
        else list.append(button(workspace.name, () => { scope.value = folder = workspace.path; return render(); }));
      }
    } else {
      folder ||= scope.value;
      const parts = folder.split('/');
      for (let depth = 2; depth <= parts.length; depth++) {
        const path = parts.slice(0, depth).join('/');
        trail.append(button(parts[depth - 1], () => { folder = path; return render(); }, {variant:'quiet'}));
      }

      for (const entry of entries.filter(e => matches(e.name))) {
        if (entry.kind === 'folder') list.append(button(entry.name, () => {
          folder = entry.path;
          search.value = '';
          return render();
        }, {symbol:'folder'}));
        else if (entry.kind === 'note' || entry.openable) option(entry.kind, entry.path, entry.name, folder);
      }
    }
    if (!list.children.length) list.append(el('p', 'empty', 'No available items.'));
  }

  for (const name of categories) {
    const tab = button(name, () => {
      category = name;
      search.value = '';
      if (name === 'Files' && !folder && scope.value === all)
        scope.value = ctx.workspaces.lastFolder()?.split('/').slice(0, 2).join('/') || workspaces.find(w => w.name === 'Explorations')?.path || names[0];
      return render();
    });
    tab.disabled = !!relink && name !== 'Files';
    tabs.append(tab);
  }
  scope.onchange = () => { folder = ''; render().catch(report); };
  search.oninput = () => render().catch(report);
  list.onkeydown = event => {
    const controls = [...list.querySelectorAll('button:enabled')];
    const current = controls.indexOf(event.target);
    const indices = {Home:0, End:controls.length-1, ArrowUp:current-1, ArrowDown:current+1};
    if (current >= 0 && Object.hasOwn(indices, event.key)) {
      event.preventDefault();
      controls[Math.max(0, Math.min(controls.length-1, indices[event.key]))].focus();
    }
  };

  const answer = showDialog({
    title:relink ? 'Relink file' : 'Add to plan', description:'Choose what to include in your plan.',
    wide:true, content:body, actions:[
      {label:'Cancel', value:false}, {label:'Add selected', value:true, primary:true, run:async () => {
        const items = [...selection.values()];
        if (!items.length) throw Error('Select an item.');
        if (relink) await ctx.plans.relink({planId:plan.id, id:relink.id, ref:items[0].ref});
        else await ctx.plans.addMany({planId:plan.id, items});
      }}
    ]
  });
  await render();
  try { return await answer; } finally { generation++; }
}
