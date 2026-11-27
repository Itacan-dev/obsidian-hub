import {workOperations} from './work-operations.js';
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

import { recoveryView } from './workspace/recovery.js';
import preferences from '../contracts/preferences.cjs';
import { settingsDialog, applyPreferences, matchCommand } from './settings/settings.js';
import { musicButton } from './music/music.js';
import { oathControl, confirmBreak } from './oath/oath.js';

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
    captureCount(); oathButton.refresh(); music.refresh();
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
    if ((restored.workspace && !allowed(restored.workspace)) || restored.panes.some(p=>p.tabs.some(file=>!allowed(file)))) throw Error('This preset includes content outside the active Oath.');
    const retained = new Set(restored.panes.flatMap(p => p.tabs));
    const closing = [...documents.open.values()].filter(b => !retained.has(b.path));
    if (!await documents.allowClose(closing)) return;
    const explorer = restored.explorer;
    if (explorer && restored.folder) await ctx.workspaces.saveExplorer({...explorer,path:restored.workspace || restored.folder.split('/').slice(0,2).join('/')});
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
    if (screen?.syncDesk) {screen.dispose();screen=null;}
    if (state.lastLayout) layout = null;
    library = (await api.home()).library;
    return true;
  }
};
const oathButton = oathControl(ctx);
const music = musicButton(ctx);
const settingsButton = button('Settings',()=>settingsDialog(ctx));
api.onNotice(report);
api.onWorkChanged(id=>{ if (library?.session===id) ctx.reloadWork().catch(report); });
function allowed(path) {
  const oath = state?.oath;
  return oath?.status !== 'active' || ctx.workspaces.contextFor(path,oath.owner) === oath.owner;
}
tools.append(oathButton.root,button('Log progress',async()=>{
  await ctx.reloadWork();
  return progressEditor(ctx,localDay(),null,{current:mode==='home'?null:screen?.owner || ctx.layout?.workspace || ctx.workspaces.lastWorkspace()});
}),button('Quick Add', () => quickAdd(ctx)), inboxButton,music.root,settingsButton);
let mode;
const homeButton = button('Home', ctx.refresh);
const workspaceButton = button('Workspace', () => {
  const desk = ctx.layout;
  const folder = mode === 'desk' ? desk?.folder : state?.lastFolder;
  return folder ? ctx.openFolder(folder,{workspace:mode==='desk'?desk?.workspace:state.lastWorkspace}) : report('Open a Project or Resource first.');
});
function lastDesk() {
  if (mode === 'folder') return state?.workspaceLayouts?.[screen?.owner];
  return ctx.layout;
}
const fileButton = button('Last File',async ()=>{
  if (mode === 'folder' && lastDesk()) layout=structuredClone(lastDesk());
  await ctx.showDesk();
});
const presets = button('Presets', () => presetMenu(ctx, presets, mode === 'desk'));
bar.querySelector('#routes').append(homeButton, workspaceButton, fileButton, presets);
function navigation(kind) {
  mode = kind;
  const desk = ctx.layout;
  for (const [control, current, available] of [
    [homeButton, kind === 'home', true],
    [workspaceButton, kind === 'folder', library],
    [fileButton, kind === 'desk', lastDesk()?.panes[lastDesk().active]?.file]
  ]) {
    control.disabled = current || !available;
    if (current) control.setAttribute('aria-current', 'page');
    else control.removeAttribute('aria-current');
  }
  presets.disabled = !library;
  tools.hidden = !library || recovering;
  if (recovering) { homeButton.disabled=true; workspaceButton.disabled=true; fileButton.disabled=true; presets.disabled=true; }
  captureCount(); oathButton.refresh(); music.refresh();
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
    if (state?.oath?.status === 'active' && (route.kind === 'home' || route.path && !allowed(route.path))) {
      report('Your active Oath is scoped to '+state.oath.owner+'.');
      route = {kind:'folder',path:state.oath.owner,workspace:state.oath.owner};
    }
    let next;
    if(screen?.snapshot && ['home','folder','choose'].includes(route.kind)) {
      const captured=screen.snapshot();
      if (JSON.stringify(captured)!==JSON.stringify(state.lastLayout)) await ctx.presets.remember({layout:captured});
    }
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
      const changed = selected?.session !== library?.session;
      library = selected;
      if (library) {
        try {
          state = await api.work(library.session);
          recovering = false;
        } catch(error) {
          recovering = true;
          if (changed) {state = null; documents = null; layout = null;}
          screen?.dispose?.();
          screen = recoveryView(library,error,ctx.chooseLibrary);
          screen.navigationHost.append(bar);
          view.replaceChildren(screen.root);
          navigation('recovery');
          return true;
        }
        applyPreferences(state.settings,library.session);
        if (changed || !documents) {
          ctx.fileClipboard = null;
          documents = new Documents(library.session,()=>state?.settings?.saveMode !== 'manual');
          layout = null;
        }
      }
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
    }
    else {
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
        if (screen?.syncDesk) {screen.dispose();screen=null;}
      }
      if (route.kind === 'note') {
        const buffer = await documents.get(route.path);
        const owner = ctx.workspaces.contextFor(buffer.path,route.workspace || screen?.owner || layout.workspace);
        layout.workspace = owner;
        const preferred = state.settings?.editorMode || preferences.defaults.editorMode;
        route.editing ??= preferred === 'source' ? true : preferred === 'live' ? 'live' : false;
        const pane = layout.panes[layout.active];
        const previous = pane.file;
        const replaces = route.placement === 'replace' && previous && !pane.tabs.includes(buffer.path)
          && !layout.panes.some(other => other !== pane && other.tabs.includes(previous));
        const closing = replaces && documents.open.get(previous);
        if (closing && !await documents.allowClose([closing])) return false;
        if (addTab(layout, buffer.path, route.editing, route.placement)) {
          const previousFolder=state.lastFolder===owner || state.lastFolder?.startsWith(owner+'/') ? state.lastFolder : owner;
          layout.folder = state.explorers?.[owner]?.folder || previousFolder;
          if (layout.folder !== state.lastFolder) await ctx.workspaces.visit({path:layout.folder,workspace:owner});
          await ctx.presets.remember({ layout });
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

document.addEventListener('keydown',event=>{
  if (navigating || !library || recovering || document.querySelector('dialog[open]')) return;
  const command = matchCommand(event,state?.settings);
  if (!command) return;
  const handlers = {
    settings:()=>settingsDialog(ctx),quickAdd:()=>quickAdd(ctx),
    save:()=>screen?.save?.(),closeTab:()=>screen?.closeTab?.(),
    nextTab:()=>screen?.cycleTab?.(1),previousTab:()=>screen?.cycleTab?.(-1)
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
    if (screen?.snapshot) {
      const captured=screen.snapshot();
      if(JSON.stringify(captured)!==JSON.stringify(state.lastLayout))await ctx.presets.remember({layout:captured});
    }
    if (library && !recovering) {
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
