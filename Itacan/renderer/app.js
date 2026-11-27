import './ui/shared.css';
import { createShell } from './shell/shell.js';
import { workOperations } from './work-operations.js';
import { progressEditor, localDay, observeWorkspace, pendingWorkspaces } from './progress/report.js';
import { homeView } from './home/home.js';
import { workspaceView } from './workspace/workspace.js';
import { Documents } from './document/buffers.js';
import { quickAdd } from './capture/capture.js';
import { report } from './shell/notice.js';
import { recoveryView } from './workspace/recovery.js';
import preferences from '../contracts/preferences.cjs';
import { settingsDialog, applyPreferences, matchCommand } from './settings/settings.js';
import { confirmBreak } from './oath/oath.js';

const api = window.itacan;
let library, state, documents, layout, screen;
let navigating = false;
let recovering = false;

const ctx = {
  get library() { return library; },
  get documents() { return documents; },
  get layout() { return layout || state?.lastLayout; },
  report,
  observeWorkspace: path=>observeWorkspace(ctx,ctx.workspaces.contextFor(path,screen?.owner || ctx.layout?.workspace)),
  noteBreadcrumb: () => navigation('desk'),
  install(next, group, action, id) {
    if ((next.revision || 0) < (state?.revision || 0)) return;
    const wasActive = state?.oath?.status === 'active';
    state = next;
    if (group === 'settings' || !group) applyPreferences(state.settings,library.session);
    screen?.refresh?.(group, action, id);
    shell.refreshTools();
    if (!wasActive && state.oath?.status === 'active') {
      layout = null;
      setTimeout(()=>ctx.openFolder(state.oath?.owner || state.lastFolder),0);
    }
  },
  async reloadWork() {
    const session = library.session;
    const next = await api.work(session);
    if (session === library?.session && !recovering) ctx.install(next);
  },
  ...workOperations(async (group, action, data) => {
    const session = library.session;
    const next = await api[group](session,action,data);
    if (session !== library?.session || (next.revision || 0) < (state?.revision || 0)) return state;
    if (group === 'task') {
      const owner=data.owner || data.path || state.tasks.find(t=>t.id===data.id)?.owner;
      ctx.observeWorkspace(owner);
    }
    if (group === 'layout') state = next;
    else ctx.install(next, group, action, data.id);
    return next;
  }, () => state),
  openFolder: (path, options = {}) => navigate({ kind: 'folder', path, ...options }),
  openNote: (path, editing, anchor = '', placement = 'replace', workspace) => navigate({ kind: 'note', path, editing, anchor, placement, workspace }),
  snapshot: () => screen?.snapshot?.() || ctx.layout,
  chooseLibrary: () => navigate({ kind: 'choose' }),
  chooseSample: () => navigate({ kind: 'choose', sample:true }),
  refresh: () => navigate({ kind: 'home' }),
  showDesk: () => navigate({ kind: 'desk' }),
  restore: async preset => {
    const restored = await api.resolveLayout(library.session, preset.layout);
    const outsideWorkspace = restored.workspace && !allowed(restored.workspace);
    const outsideDocument = restored.panes.some(pane => pane.tabs.some(file => !allowed(file)));
    if (outsideWorkspace || outsideDocument) throw Error('This preset includes content outside the active Oath.');
    const retained = new Set(restored.panes.flatMap(p => p.tabs));
    const closing = [...documents.open.values()].filter(b => !retained.has(b.path));
    if (!await documents.allowClose(closing)) return;
    const explorer = restored.explorer;
    if (explorer && restored.folder) {
      const path = restored.workspace || restored.folder.split('/').slice(0, 2).join('/');
      await ctx.workspaces.saveExplorer({ ...explorer, path });
    }
    delete restored.explorer;
    layout = restored;
    if (screen?.syncDesk) { screen.dispose(); screen = null; }
    if (layout.folder) await ctx.workspaces.visit({path:layout.folder,workspace:layout.workspace}).catch(()=>{layout.folder='';});
    await ctx.presets.remember({ layout });
    for (const buffer of closing) documents.open.delete(buffer.path);
    await ctx.showDesk();
  },
  async relinkDocument(from,to) {
    if (!allowed(to)) throw Error('This document is outside the active Oath.');
    await ctx.workspaces.relinkDocument({from,to});
  },
  async changeFile(from, parent, name, trash = false) {
    const affected = [...documents.open.values()].filter(b => b.path === from || b.path.startsWith(from + '/'));
    await Promise.all(affected.map(b => b.pending));
    if (trash && !await documents.allowClose(affected)) return false;
    state = await api.moveItem(library.session, from, parent, name, trash);
    documents.relocate(from, trash ? '' : parent + '/' + name);
    if (screen?.syncDesk) {
      screen.dispose();
      screen = null;
    }
    if (state.lastLayout) layout = null;
    library = (await api.home()).library;
    return true;
  }
};
let mode;

function lastDesk() {
  return mode === 'folder' ? ctx.presets.lastLayout(screen?.owner) : ctx.layout;
}

const shell = createShell(ctx, {
  openWorkspace() {
    const desk = ctx.layout;
    const folder = mode === 'desk' ? desk?.folder : state?.lastFolder;
    if (!folder) return report('Open a Project or Resource first.');
    const workspace = mode === 'desk' ? desk.workspace : state.lastWorkspace;
    return ctx.openFolder(folder, { workspace });
  },
  async resumeDesk() {
    if (mode === 'folder' && lastDesk()) layout = structuredClone(lastDesk());
    await ctx.showDesk();
  },
  async logProgress() {
    await ctx.reloadWork();
    const current = mode === 'home' ? null : screen?.owner || ctx.layout?.workspace || ctx.workspaces.lastWorkspace();
    return progressEditor(ctx, localDay(), null, { current });
  }
});
const { frame, view } = shell;

function navigation(kind) {
  mode = kind;
  const desk = lastDesk();
  shell.refreshNavigation(kind, desk?.panes[desk.active]?.file, recovering);
}

api.onNotice(report);
api.onWorkChanged(id => {
  if (library?.session === id) ctx.reloadWork().catch(report);
});

function allowed(path) {
  const oath = state?.oath;
  return oath?.status !== 'active' || ctx.workspaces.contextFor(path, oath.owner) === oath.owner;
}

async function rememberDesk() {
  if (!screen?.snapshot) return;
  const captured = screen.snapshot();
  if (JSON.stringify(captured) !== JSON.stringify(state.lastLayout)) {
    await ctx.presets.remember({ layout: captured });
  }
}

async function loadLibrary(selected) {
  const changed = selected?.session !== library?.session;
  library = selected;
  if (!library) return;
  try {
    state = await api.work(library.session);
    recovering = false;
  } catch (error) {
    recovering = true;
    if (changed) {
      state = null;
      documents = null;
      layout = null;
    }
    screen?.dispose?.();
    screen = recoveryView(library, error, ctx.chooseLibrary);
    shell.mount(screen);
    navigation('recovery');
    return;
  }
  applyPreferences(state.settings, library.session);
  if (changed || !documents) {
    ctx.fileClipboard = null;
    documents = new Documents(library.session, () => state?.settings?.saveMode !== 'manual');
    layout = null;
  }
}

async function openDocumentTab(route, addTab) {
  const buffer = await documents.get(route.path);
  const owner = ctx.workspaces.contextFor(buffer.path, route.workspace || screen?.owner || layout.workspace);
  layout.workspace = owner;
  const preferred = state.settings?.editorMode || preferences.defaults.editorMode;
  route.editing ??= preferred === 'live' ? 'live' : preferred === 'source';

  // Replacing the last view of a dirty document needs the normal close decision.
  const pane = layout.panes[layout.active];
  const previous = pane.file;
  const replaces = route.placement === 'replace' && previous && !pane.tabs.includes(buffer.path)
    && !layout.panes.some(other => other !== pane && other.tabs.includes(previous));
  const closing = replaces && documents.open.get(previous);
  if (closing && !await documents.allowClose([closing])) return false;

  if (addTab(layout, buffer.path, route.editing, route.placement)) {
    const lastFolder = state.lastFolder;
    const sameWorkspace = lastFolder === owner || lastFolder?.startsWith(owner + '/');
    layout.folder = state.explorers?.[owner]?.folder || (sameWorkspace ? lastFolder : owner);
    if (layout.folder !== lastFolder) {
      await ctx.workspaces.visit({ path: layout.folder, workspace: owner });
    }
    await ctx.presets.remember({ layout });
    if (closing) documents.open.delete(previous);
  }
  return true;
}

async function navigate(route) {
  if (navigating) return;
  navigating = true;
  const previousFocus = document.activeElement;
  frame.inert = true;
  try {
    shell.clearNotice();
    if (state?.oath?.status === 'active' && (route.kind === 'home' || route.path && !allowed(route.path))) {
      report('Your active Oath is scoped to '+state.oath.owner+'.');
      route = {kind:'folder',path:state.oath.owner,workspace:state.oath.owner};
    }
    let next;
    if (['home', 'folder', 'choose'].includes(route.kind)) await rememberDesk();
    if (route.kind === 'choose' || route.kind === 'home' || route.kind === 'desk' && !ctx.layout?.panes.some(p => p.file)) {
      let selected;
      if (route.kind === 'choose') {
        if (['active','rest'].includes(state?.oath?.status) && !await confirmBreak(ctx)) return;
        if (documents && !await documents.allowClose()) return;
        selected = await api.chooseLibrary(route.sample ? 'sample' : undefined);
        if (!selected) return;
      } else {
        const result = await api.home();
        selected = result.library;
        if (result.message) report(result.message);
      }
      await loadLibrary(selected);
      if (recovering) return true;
      route = { kind: 'home' };
      next = homeView(library, ctx);
    } else if (route.kind === 'folder') {
      const owner = ctx.workspaces.contextFor(route.path,route.workspace);
      route.workspace = owner;
      if (screen?.owner === owner) {
        if (route.refreshTree) state=await api.work(library.session);
        await screen.openFolder(route.path, route);
        next = screen;
      } else {
        state=await api.work(library.session);
        next = await workspaceView(library, route.path, ctx, route);
      }
    } else {
      const { addTab, deskView } = await import('./workspace/desk.js');
      if (!layout) {
        layout = state.lastLayout ? await api.resolveLayout(library.session, state.lastLayout) :
          { active: 0, panes: [{ tabs: [], file: '', edit: false }] };
        if (state.lastLayout && JSON.stringify(layout) !== JSON.stringify(state.lastLayout)) {
          await ctx.presets.remember({ layout });
        }
      }
      if (state.oath?.status === 'active' && layout.panes.some(p=>p.tabs.some(path=>!allowed(path)))) {
        layout = {active:0,panes:[{file:'',tabs:[],edit:false}],workspace:state.oath.owner,folder:state.oath.owner};
        if (screen?.syncDesk) {
          screen.dispose();
          screen = null;
        }
      }
      if (route.kind === 'note' && !await openDocumentTab(route, addTab)) return false;
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
      shell.mount(next);
      view.scrollTop = 0;
    }
    if (route.kind!=='home') ctx.observeWorkspace(route.path);
    navigation(route.kind === 'note' ? 'desk' : route.kind);
    frame.inert = false;
    if (sameScreen && previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    else view.focus({preventScroll:true});
    next.mounted?.(route, sameScreen && !previousFocus?.isConnected);
    return true;
  } catch (error) {
    report(error);
    return false;
  } finally {
    navigating = false;
    frame.inert = false;
  }
}

document.addEventListener('keydown',event=>{
  if (navigating || !library || recovering || document.querySelector('dialog[open]')) return;
  const command = matchCommand(event,state?.settings);
  if (!command) return;
  const handlers = {
    settings: () => settingsDialog(ctx),
    quickAdd: () => quickAdd(ctx),
    save: () => screen?.save?.(),
    closeTab: () => screen?.closeTab?.(),
    nextTab: () => screen?.cycleTab?.(1),
    previousTab: () => screen?.cycleTab?.(-1)
  };
  if (handlers[command]) {
    event.preventDefault();
    if (!event.repeat) Promise.resolve(handlers[command]()).catch(report);
  }
});
api.onRequestClose(async () => {
  if (navigating || document.querySelector('dialog[open]')) return api.answerClose(false);
  navigating = true;
  frame.inert = true;
  try {
    if (['active','rest'].includes(state?.oath?.status) && !await confirmBreak(ctx)) return api.answerClose(false);
    if (documents && !await documents.allowClose()) return api.answerClose(false);
    await rememberDesk();
    if (library && !recovering) {
      state=await api.work(library.session);
      const day=localDay();
      const pending=pendingWorkspaces(ctx,day);
      if (pending.length && !await progressEditor(ctx,day,null,{pending})) return api.answerClose(false);
    }
    await api.answerClose(true);
  } catch (error) {
    report(error);
    await api.answerClose(false);
  } finally {
    navigating = false;
    frame.inert = false;
  }
});
// Refresh a day-bound dashboard at local midnight or after the machine wakes.
let shownDay=localDay();
async function checkDay() {
  const ended=state?.plan?.endsAt && Date.parse(state.plan.endsAt)<=Date.now();
  if (!library || navigating || recovering || (!ended && localDay()===shownDay) || document.querySelector('dialog[open]')) return;
  await ctx.reloadWork(); shownDay=localDay();
}
function scheduleDay(){
  const next=new Date();next.setHours(24,0,0,0);
  setTimeout(()=>{checkDay().catch(report);scheduleDay();},next-Date.now()+100);
}
scheduleDay();
window.addEventListener('focus',()=>{ checkDay().catch(report); documents?.revalidate().catch(report); });
document.addEventListener('close',()=>checkDay().catch(report),true);
void ctx.refresh();
