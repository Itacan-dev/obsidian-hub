const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');
const { readWindowBounds, rememberWindowBounds } = require('./settings.cjs');

function trackOathWindow(win, selection) {
  let oathFullscreen = false;
  let beforeFullscreen = false;

  function refreshFullscreen() {
    const active = selection.work?.latest?.oath?.status === 'active';
    if (win.isDestroyed() || active === oathFullscreen) return;
    if (active) beforeFullscreen = win.isFullScreen();
    oathFullscreen = active;
    win.setFullScreen(active || beforeFullscreen);
  }

  win.on('leave-full-screen', () => {
    if (oathFullscreen) win.setFullScreen(true);
  });
  const clock = setInterval(async () => {
    const store = selection.work;
    const oath = store?.latest?.oath;
    const boundary = oath?.status === 'scheduled' ? oath.startsAt : oath?.restUntil || oath?.endsAt;
    if (!boundary || Date.parse(boundary) > Date.now() || store.ticking) {
      refreshFullscreen();
      return;
    }

    store.ticking = true;
    try {
      const revision = store.latest.revision;
      const state = await store.transaction();
      if (selection.work === store && revision !== state.revision && !win.isDestroyed()) {
        win.webContents.send('work-changed', store.library.session);
      }
    } catch (error) {
      console.error('Oath clock:', error.message);
    } finally {
      store.ticking = false;
      refreshFullscreen();
    }
  }, 1000);
  clock.unref();
  win.on('closed', () => clearInterval(clock));
}

async function createMainWindow(selection) {
  const saved = await readWindowBounds(app);
  const win = new BrowserWindow({
    width: 1160,
    height: 800,
    ...saved.bounds,
    minWidth: 680,
    minHeight: 480,
    show: false,
    title: 'Itacan',
    backgroundColor: '#f6f5ef',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false
    }
  });
  rememberWindowBounds(app, win);
  trackOathWindow(win, selection);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());

  // The renderer checks open documents before approving an ordinary close.
  let closeRequested = false;
  let closeApproved = false;
  win.on('close', event => {
    if (closeApproved || win.webContents.isCrashed() || win.webContents.isLoadingMainFrame()) return;
    event.preventDefault();
    if (!closeRequested) {
      closeRequested = true;
      win.webContents.send('request-close');
    }
  });
  function answerClose(allowed) {
    if (!closeRequested) return;
    closeRequested = false;
    closeApproved = allowed === true;
    if (closeApproved) win.close();
  }

  const mac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [{ role: 'close', accelerator: mac ? 'Shift+Command+W' : 'Alt+F4' }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'togglefullscreen', accelerator: mac ? 'Control+Command+F' : 'F11' }] }
  ]));
  win.once('ready-to-show', () => {
    if (saved.maximized) win.maximize();
    win.show();
  });
  return { win, answerClose };
}

module.exports = { createMainWindow };
