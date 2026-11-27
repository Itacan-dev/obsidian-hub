import { progressEditor,localDay,observeWorkspace,pendingWorkspaces } from './progress/report.js';
import { homeView } from './home/home.js';
import { workspaceView } from './workspace/workspace.js';
import { Documents } from './document/buffers.js';
import { quickAdd, inbox } from './capture/capture.js';
import { presetMenu } from './workspace/presets.js';
import { button, report } from './ui/elements.js';
import './ui/shared.css';
import './home/home.css';
import './workspace/workspace.css';
import './workspace/desk.css';
import './document/document.css';
import './tasks/tasks.css';
import './capture/capture.css';
import './plan/plan.css';
import './progress/progress.css';

const api = window.itacan;
const frame = document.querySelector('#application');
const view = document.querySelector('#view');
const libraryButton = document.querySelector('#library-button');
const bar = document.querySelector('#navigation');
const tools = document.querySelector('#capture-bar');
const inboxButton = button('Inbox', () => inbox(ctx));
function captureCount() {
  const count = state?.inbox.length || 0;
  inboxButton.textContent = count ? 'Inbox (' + count + ')' : 'Inbox';
  inboxButton.setAttribute('aria-label','Inbox');
}
let library, state, documents, layout, screen;
let navigating = false;

const ctx = {
  get library() { return library; },
  get state() { return state; },
  get documents() { return documents; },
  get layout() { return layout || state?.lastLayout; },
  report,
  observeWorkspace: path=>observeWorkspace(ctx,path),
  noteBreadcrumb: () => navigation('desk'),
  install(next, group, action, id) { state = next; screen?.refresh?.(group, action, id); captureCount(); },
  async reloadWork() { ctx.install(await api.work(library.session)); },
  async update(group, action, data) {
    const next = await api.update(library.session, group, action, data);
    if (group === 'task') {
      const owner=data.owner || data.path || state.tasks.find(t=>t.id===data.id)?.owner;
      ctx.observeWorkspace(owner);
    }
    if (group === 'layout') state = next;
    else ctx.install(next, group, action, data.id);
    return next;
  },
  openFolder: (path, options = {}) => navigate({ kind: 'folder', path, ...options }),
  openNote: (path, editing = false, anchor = '', placement = 'replace') => navigate({ kind: 'note', path, editing, anchor, placement }),
  snapshot: () => screen?.snapshot?.() || ctx.layout,
  chooseLibrary: () => navigate({ kind: 'choose' }),
  refresh: () => navigate({ kind: 'home' }),
  showDesk: () => navigate({ kind: 'desk' }),
  restore: async preset => {
    const restored = await api.resolveLayout(library.session, preset.layout);
    const retained = new Set(restored.panes.flatMap(p => p.tabs));
    const closing = [...documents.open.values()].filter(b => !retained.has(b.path));
    if (!await documents.allowClose(closing)) return;
    if (JSON.stringify(restored) !== JSON.stringify(preset.layout)) {
      await ctx.update('layout', 'preset', { name: preset.name, layout: restored });
    }
    const explorer = restored.explorer;
    if (explorer && restored.folder) await ctx.update('workspace','explorer',{...explorer,path:restored.folder.split('/').slice(0,2).join('/')});
    delete restored.explorer;
    layout = restored;
    if (screen?.syncDesk) { screen.dispose(); screen = null; }
    if (layout.folder) await ctx.update('workspace','visit',{path:layout.folder});
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
    if (screen?.syncDesk) {screen.dispose();screen=null;}
    if (state.lastLayout) layout = null;
    library = (await api.home()).library;
    return true;
  }
};
tools.append(button('Log progress',async()=>{
  await ctx.reloadWork();
  return progressEditor(ctx,localDay(),null,{current:mode==='home'?null:ctx.state.lastFolder?.split('/').slice(0,2).join('/')});
}),button('Quick Add', () => quickAdd(ctx)), inboxButton);
let mode;
const homeButton = button('Home', ctx.refresh);
const workspaceButton = button('Workspace', () => {
  const desk = ctx.layout;
  const folder = mode === 'desk' ? desk?.folder : state?.lastFolder;
  return folder ? ctx.openFolder(folder) : report('Open a Project or Resource first.');
});
const fileButton = button('Last File', ctx.showDesk);
const presets = button('Presets', () => presetMenu(ctx, presets, mode === 'desk'));
bar.querySelector('#routes').append(homeButton, workspaceButton, fileButton, presets);
function navigation(kind) {
  mode = kind;
  const desk = ctx.layout;
  for (const [control, current, available] of [
    [homeButton, kind === 'home', true],
    [workspaceButton, kind === 'folder', library],
    [fileButton, kind === 'desk', desk?.panes[desk.active]?.file]
  ]) {
    control.disabled = current || !available;
    if (current) control.setAttribute('aria-current', 'page');
    else control.removeAttribute('aria-current');
  }
  presets.disabled = !library;
  tools.hidden = !library;
  captureCount();
  libraryButton.textContent = library?.name || 'Choose library';
  libraryButton.title = 'Choose library folder';
}
async function navigate(route) {
  if (navigating) return;
  navigating = true;
  const previousFocus = document.activeElement;
  frame.inert = true;
  try {
    document.querySelector('#message').hidden = true;
    let next;
    if(screen?.snapshot && ['home','folder','choose'].includes(route.kind)) {
      const captured=screen.snapshot();
      if (JSON.stringify(captured)!==JSON.stringify(state.lastLayout)) await ctx.update('layout','remember',{layout:captured});
    }
    if (route.kind === 'choose' || route.kind === 'home' || route.kind === 'desk' && !ctx.layout?.panes.some(p => p.file)) {
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
          ctx.fileClipboard = null;
          documents = new Documents(library.session);
          layout = null;
        }
      }
      route = { kind: 'home' };
      next = homeView(library, ctx);
    } else if (route.kind === 'folder') {
      const owner = route.path.split('/').slice(0,2).join('/');
      if (screen?.owner === owner) {
        if (route.refreshTree) state=await api.work(library.session);
        await screen.openFolder(route.path, route);
        next = screen;
      } else {
        state=await api.work(library.session);
        next = await workspaceView(library, route.path, ctx, route);
      }
    }
    else {
      const { addTab, deskView } = await import('./workspace/desk.js');
      if (!layout) {
        layout = state.lastLayout ? await api.resolveLayout(library.session, state.lastLayout) :
          { active: 0, panes: [{ tabs: [], file: '', edit: false }] };
        if (state.lastLayout && JSON.stringify(layout) !== JSON.stringify(state.lastLayout)) {
          await ctx.update('layout', 'remember', { layout });
        }
      }
      if (route.kind === 'note') {
        const buffer = await documents.get(route.path);
        const pane = layout.panes[layout.active];
        const previous = pane.file;
        const replaces = route.placement === 'replace' && previous && !pane.tabs.includes(buffer.path)
          && !layout.panes.some(other => other !== pane && other.tabs.includes(previous));
        const closing = replaces && documents.open.get(previous);
        if (closing && !await documents.allowClose([closing])) return false;
        if (addTab(layout, buffer.path, route.editing, route.placement)) {
          const owner = buffer.path.split('/').slice(0,2).join('/');
          const previousFolder=state.lastFolder===owner || state.lastFolder?.startsWith(owner+'/') ? state.lastFolder : owner;
          layout.folder = state.explorers?.[owner]?.folder || previousFolder;
          if (layout.folder !== state.lastFolder) await ctx.update('workspace','visit',{path:layout.folder});
          await ctx.update('layout', 'remember', { layout });
          if (closing) documents.open.delete(previous);
        }
      }
      if (screen?.syncDesk) {
        await screen.syncDesk(route.anchor);
        ctx.observeWorkspace(layout.panes[layout.active].file);
        frame.inert = false;
        if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
        return true;
      }
      next = await deskView(ctx, route.anchor);
      route.path = layout.panes[layout.active].file;
    }
    const sameScreen = next === screen;
    if (!sameScreen) {
      screen?.dispose?.();
      screen = next;
      const cover=next.root.querySelector('.dashboard-cover');
      if (cover) cover.after(bar);
      else next.navigationHost.append(bar);
      view.replaceChildren(next.root);
      view.scrollTop = 0;
    }
    if (route.kind!=='home') ctx.observeWorkspace(route.path);
    navigation(route.kind === 'note' ? 'desk' : route.kind);
    frame.inert = false;
    if (sameScreen && previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    else view.focus({preventScroll:true});
    next.mounted?.(route, sameScreen && !previousFocus?.isConnected);
    return true;
  } catch (error) { report(error); return false; }
  finally { navigating = false; frame.inert = false; }
}
libraryButton.onclick = ctx.chooseLibrary;

document.addEventListener('keydown', event => {
  if(!navigating && library && (event.metaKey || event.ctrlKey) && event.shiftKey && event.code==='Space' && !document.querySelector('dialog[open]')) {
    event.preventDefault();if(!event.repeat)quickAdd(ctx).catch(report);return;
  }
  if(!navigating && screen?.syncDesk && !document.querySelector('dialog[open]')) {
    if((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='w' && !event.shiftKey) {
      event.preventDefault();screen.closeTab().catch(report);return;
    }
    if(event.ctrlKey && event.key==='Tab') {
      event.preventDefault();screen.cycleTab(event.shiftKey?-1:1).catch(report);return;
    }
  }
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
    if (documents && !await documents.allowClose()) return api.answerClose(false);
    if (screen?.snapshot) {
      const captured=screen.snapshot();
      if(JSON.stringify(captured)!==JSON.stringify(state.lastLayout))await ctx.update('layout','remember',{layout:captured});
    }
    if (library) {
      state=await api.work(library.session);
      const day=localDay();
      const pending=pendingWorkspaces(ctx,day);
      if (pending.length && !await progressEditor(ctx,day,null,{pending})) return api.answerClose(false);
    }
    await api.answerClose(true);
  } catch(error){report(error);await api.answerClose(false);}
  finally { navigating = false; frame.inert = false; }
});
// Refresh a day-bound dashboard at local midnight or after the machine wakes.
let shownDay=localDay();
async function checkDay() {
  const ended=state?.plan?.endsAt && Date.parse(state.plan.endsAt)<=Date.now();
  if (!library || navigating || (!ended && localDay()===shownDay) || document.querySelector('dialog[open]')) return;
  await ctx.reloadWork(); shownDay=localDay();
}
function scheduleDay(){
  const next=new Date();next.setHours(24,0,0,0);
  setTimeout(()=>{checkDay().catch(report);scheduleDay();},next-Date.now()+100);
}
scheduleDay();
window.addEventListener('focus',()=>checkDay().catch(report));
document.addEventListener('close',()=>checkDay().catch(report),true);
void ctx.refresh();
