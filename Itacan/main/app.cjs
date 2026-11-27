const { app, dialog, protocol, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { appURL, serve } = require('./protocol.cjs');
const { createMainWindow } = require('./window.cjs');
const { restoreLibrarySelection, installRendererIPC } = require('./library-ipc.cjs');

protocol.registerSchemesAsPrivileged([{
  scheme: 'itacan',
  privileges: { standard: true, secure: true, supportFetchAPI: true }
}]);
if (!app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getPath('appData'), 'Itacan Development'));
}

let mainWindow;

async function start() {
  const fromSource = !app.isPackaged && app.commandLine.hasSwitch('itacan-dev');
  const appRoot = app.getAppPath();
  if (fromSource) {
    // Build only after acquiring the window's single-instance lock.
    process.chdir(appRoot);
    await import(pathToFileURL(path.join(appRoot, 'scripts/build.mjs')).href);
  }
  const publicDir = fromSource ? path.join(appRoot, 'build/app/public') : path.join(__dirname, '../public');
  const selection = await restoreLibrarySelection();
  protocol.handle('itacan', request => serve(request, publicDir, selection));
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, reply) => reply(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  const { win, answerClose } = await createMainWindow(selection);
  mainWindow = win;
  installRendererIPC(win, selection, answerClose);
  await win.loadURL(appURL);
}

if (app.requestSingleInstanceLock()) {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('Itacan could not start', error.message);
    app.quit();
  });
} else {
  app.quit();
}
