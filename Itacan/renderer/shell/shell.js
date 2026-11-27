import './shell.css';
import { button, el, icon } from '../ui/elements.js';
import { quickAdd, inbox } from '../capture/capture.js';
import { oathControl } from '../oath/oath.js';
import { musicButton } from '../music/music.js';
import { presetMenu } from '../workspace/presets.js';
import { settingsDialog } from '../settings/settings.js';

export function createShell(ctx, { openWorkspace, resumeDesk, logProgress }) {
  const frame = el('div');
  frame.id = 'application';

  const navigation = el('nav', 'app-bar');
  navigation.id = 'navigation';
  navigation.setAttribute('aria-label', 'Main navigation');
  const routes = el('div', 'actions');
  routes.id = 'routes';
  const home = button('Home', ctx.refresh);
  const workspace = button('Workspace', openWorkspace);
  const lastFile = button('Last File', resumeDesk);
  let activeView;
  const presets = button('Presets', () => presetMenu(ctx, presets, activeView === 'desk'));
  routes.append(home, workspace, lastFile, presets);

  const library = button('', ctx.chooseLibrary, { variant: 'quiet' });
  const libraryName = el('span', '', 'Choose library');
  library.append(icon('library'), libraryName);
  library.id = 'library-button';
  library.title = 'Choose library folder';
  navigation.append(routes, library);

  const view = el('main');
  view.id = 'view';
  view.tabIndex = -1;

  const toolbar = el('footer', 'actions');
  toolbar.id = 'capture-bar';
  const oath = oathControl(ctx);
  const music = musicButton(ctx);
  const inboxButton = button('Inbox', () => inbox(ctx));
  inboxButton.setAttribute('aria-label', 'Inbox');
  toolbar.append(oath.root, button('Log progress', logProgress),
    button('Quick Add', () => quickAdd(ctx), { symbol: 'plus' }), inboxButton,
    music.root, button('Settings', () => settingsDialog(ctx)));

  const notice = el('p');
  notice.id = 'message';
  notice.setAttribute('role', 'alert');
  notice.hidden = true;
  frame.append(navigation, view, toolbar);
  document.body.append(frame, notice);

  function refreshTools() {
    const count = ctx.inbox.list().length;
    inboxButton.textContent = count ? 'Inbox (' + count + ')' : 'Inbox';
    oath.refresh();
    music.refresh();
  }

  function refreshNavigation(kind, canResume, recovering) {
    activeView = kind;
    for (const [control, current, available] of [
      [home, kind === 'home', true],
      [workspace, kind === 'folder', ctx.library],
      [lastFile, kind === 'desk', canResume]
    ]) {
      control.disabled = recovering || current || !available;
      if (current) control.setAttribute('aria-current', 'page');
      else control.removeAttribute('aria-current');
    }
    presets.disabled = recovering || !ctx.library;
    toolbar.hidden = recovering || !ctx.library;
    libraryName.textContent = ctx.library?.name || 'Choose library';
    refreshTools();
  }

  // Move the same navigation controls between the dashboard and the desk rail.
  function mount(screen) {
    const cover = screen.root.querySelector('.dashboard-cover');
    if (cover) cover.after(navigation);
    else screen.navigationHost.append(navigation);
    view.replaceChildren(screen.root);
  }

  return { frame, view, mount, refreshTools, refreshNavigation, clearNotice: () => { notice.hidden = true; } };
}
