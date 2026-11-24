import { homeView } from './home/home.js';
import { workspaceView } from './workspace/workspace.js';
import { Documents } from './document/buffers.js';
import { quickAdd, inbox } from './capture/capture.js';
import { dailyPlan } from './plan/plan.js';
import { el, icon, button, report } from './ui/elements.js';
import './ui/shared.css';
import './home/home.css';
import './workspace/workspace.css';
import './workspace/desk.css';
import './document/document.css';
import './tasks/tasks.css';
import './capture/capture.css';
import './plan/plan.css';

const api = window.itacan;
const frame = document.querySelector('#application');
const view = document.querySelector('#view');
const libraryButton = document.querySelector('#library-button');
const tools = el('div', 'actions global-tools');
libraryButton.before(tools);
let library, state, documents, layout, screen;
let navigating = false;

const ctx = {
  get library() { return library; },
  get state() { return state; },
  get documents() { return documents; },
  get layout() { return layout; },
  report,
  noteBreadcrumb: path => navigation({ kind: 'desk', path }),
  install(next) { state = next; screen?.refresh?.(); },
  async reloadWork() { ctx.install(await api.work(library.session)); },
  async update(group, action, data) {
    const next = await api.update(library.session, group, action, data);
    if (group === 'layout') state = next;
    else ctx.install(next);
    return next;
  },
  openFolder: path => navigate({ kind: 'folder', path }),
  openNote: (path, editing = false, anchor = '') => navigate({ kind: 'note', path, editing, anchor }),
  chooseLibrary: () => navigate({ kind: 'choose' }),
  refresh: () => navigate({ kind: 'home' }),
  showDesk: () => navigate({ kind: 'desk' }),
  restore: async preset => {
    const retained = new Set(preset.panes.flatMap(p => p.tabs));
    const closing = [...documents.open.values()].filter(b => !retained.has(b.path));
    if (!await documents.allowClose(closing)) return;
    layout = structuredClone(preset);
    await ctx.update('layout', 'remember', { layout });
    for (const buffer of closing) documents.open.delete(buffer.path);
    await ctx.showDesk();
  },
  async changeFile(from, parent, name, trash = false) {
    const affected = [...documents.open.values()].filter(b => b.path === from || b.path.startsWith(from + '/'));
    await Promise.all(affected.map(b => b.pending));
    if (trash && !await documents.allowClose(affected)) return false;
    state = await api.moveItem(library.session, from, parent, name, trash);
    documents.relocate(from, trash ? '' : parent + '/' + name);
    if (state.lastLayout) layout = structuredClone(state.lastLayout);
    library = (await api.home()).library;
    return true;
  }
};
tools.append(button('Quick Add', () => quickAdd(ctx)), button('Inbox', () => inbox(ctx)), button('Plan', () => dailyPlan(ctx)));
function navigation(route) {
  const crumbs = document.querySelector('#breadcrumbs');
  crumbs.replaceChildren();
  const add = (label, action) => {
    const item = el(action ? 'button' : 'span', 'crumb', label);
    if (action) item.onclick = action;
    else item.setAttribute('aria-current', 'page');
    if (crumbs.childElementCount) crumbs.append(icon('chevron'));
    crumbs.append(item);
  };
  add('Home', route.kind === 'home' ? null : ctx.refresh);
  const parts = route.path?.split('/') || [];
  for (let i = 1; i < parts.length; i++) {
    const folder = parts.slice(0, i + 1).join('/');
    add(parts[i], i === parts.length - 1 ? null : () => ctx.openFolder(folder));
  }
  tools.hidden = !library;
  libraryButton.replaceChildren(icon('library'), document.createTextNode(library?.name || 'Choose library'));
  libraryButton.title = 'Choose library folder';
}
async function navigate(route) {
  if (navigating) return;
  navigating = true;
  frame.inert = true;
  try {
    document.querySelector('#message').hidden = true;
    let next;
    if (route.kind === 'choose' || route.kind === 'home' || route.kind === 'desk' && !layout.panes.some(p => p.file)) {
      let selected;
      if (route.kind === 'choose') {
        if (documents && !await documents.allowClose()) return;
        selected = await api.chooseLibrary();
        if (!selected) return;
      } else {
        const result = await api.home();
        selected = result.library;
        if (result.message) report(result.message);
      }
      const changed = selected?.session !== library?.session;
      library = selected;
      if (library) {
        state = await api.work(library.session);
        if (changed) {
          documents = new Documents(library.session);
          layout = structuredClone(state.lastLayout || { active: 0, panes: [{ tabs: [], file: '', edit: false }] });
        }
      }
      route = { kind: 'home' };
      next = homeView(library, ctx);
    } else if (route.kind === 'folder') next = await workspaceView(library, route.path, ctx);
    else {
      const { addTab, deskView } = await import('./workspace/desk.js');
      if (route.kind === 'note') {
        await documents.get(route.path);
        addTab(layout, route.path, route.editing);
        await ctx.update('layout', 'remember', { layout });
      }
      if (screen?.syncDesk) {
        await screen.syncDesk(route.anchor);
        return true;
      }
      next = await deskView(ctx, route.anchor);
      route.path = layout.panes[layout.active].file;
    }
    screen?.dispose?.();
    screen = next;
    view.replaceChildren(next.root);
    navigation(route);
    window.scrollTo(0, 0);
    frame.inert = false;
    view.focus({ preventScroll: true });
    next.mounted?.();
    return true;
  } catch (error) { report(error); return false; }
  finally { navigating = false; frame.inert = false; }
}
libraryButton.onclick = ctx.chooseLibrary;
document.querySelector('#brand').onclick = ctx.refresh;
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (!navigating && !document.querySelector('dialog[open]')) void screen?.save?.();
  }
});
api.onRequestClose(async () => {
  if (navigating || document.querySelector('dialog[open]')) return api.answerClose(false);
  navigating = true;
  frame.inert = true;
  try { await api.answerClose(!documents || await documents.allowClose()); }
  finally { navigating = false; frame.inert = false; }
});
void ctx.refresh();
