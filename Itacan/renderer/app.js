import { homeView } from './home/home.js';
import { workspaceView } from './workspace/workspace.js';
import { el, icon, report } from './ui/elements.js';
import './ui/shared.css';
import './home/home.css';
import './workspace/workspace.css';
import './document/document.css';

const api = window.itacan;
const frame = document.querySelector('#application');
const view = document.querySelector('#view');
const libraryButton = document.querySelector('#library-button');
let library;
let screen;
let navigating = false;

const actions = {
  openFolder: path => navigate({ kind: 'folder', path }),
  openNote: (path, editing = false, anchor = '') => navigate({ kind: 'note', path, editing, anchor }),
  chooseLibrary: () => navigate({ kind: 'choose' }),
  refresh: () => navigate({ kind: 'home' })
};
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
  add('Home', route.kind === 'home' ? null : actions.refresh);
  if (route.path) {
    const parts = route.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const folder = parts.slice(0, i + 1).join('/');
      add(parts[i], i === parts.length - 1 ? null : () => actions.openFolder(folder));
    }
  }
  libraryButton.replaceChildren(icon('library'), document.createTextNode(library?.name || 'Choose library'));
  libraryButton.title = 'Choose library folder';
}
async function navigate(route) {
  if (navigating) return;
  navigating = true;
  frame.inert = true;
  try {
    document.querySelector('#message').hidden = true;
    if (screen?.leave && !await screen.leave()) return;
    let next;
    if (route.kind === 'choose') {
      const selected = await api.chooseLibrary();
      if (!selected) return;
      library = selected;
      route = { kind: 'home' };
      next = homeView(library, actions);
    } else if (route.kind === 'home') {
      const state = await api.home();
      library = state.library;
      if (state.message) report(state.message);
      next = homeView(library, actions);
    } else if (route.kind === 'folder') next = await workspaceView(library, route.path, actions);
    else {
      const { documentView } = await import('./document/document.js');
      next = await documentView(library, route.path, { ...actions, ...route });
    }
    screen?.dispose?.();
    screen = next;
    view.replaceChildren(next.root);
    navigation(route);
    window.scrollTo(0, 0);
    frame.inert = false;
    view.focus({ preventScroll: true });
    next.mounted?.();
  } catch (error) { report(error); }
  finally { navigating = false; frame.inert = false; }
}
libraryButton.onclick = actions.chooseLibrary;
document.querySelector('#brand').onclick = actions.refresh;
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
  try {
    const allowed = !screen?.leave || await screen.leave();
    await api.answerClose(allowed);
  } finally { navigating = false; frame.inert = false; }
});
void actions.refresh();
