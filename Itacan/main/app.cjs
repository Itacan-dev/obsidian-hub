const { app, BrowserWindow, dialog, ipcMain, Menu, protocol, session, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { openLibrary, atomicReplace, imageTypes } = require('./library.cjs');

const appURL = 'itacan://app/index.html';
protocol.registerSchemesAsPrivileged([{ scheme: 'itacan', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (!app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getPath('appData'), 'Itacan Development'));
}
const settingsFile = path.join(app.getPath('userData'), 'settings.json');
const fromSource = !app.isPackaged && app.commandLine.hasSwitch('itacan-dev');
const publicDir = fromSource ? path.join(app.getAppPath(), 'build/app/public') : path.join(__dirname, '../public');
const types = { ...imageTypes, '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' itacan://image; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-src 'none'";
const { LibraryWork } = require('./work.cjs');
const { moveItem, captureFiles, resolveAttachment, fileText } = require('./files.cjs');
let library;
let work;
let win;
let closeRequested = false;
let closeApproved = false;
let startupMessage = '';

async function serve(request) {
  try {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname.slice(1));
    let file, type;
    if (url.hostname === 'image') {
      type = imageTypes[path.extname(relative).toLowerCase()];
      if (!type || !library || url.searchParams.get('library') !== library.session) return new Response(null, { status: 404 });
      file = await library.resolve(relative, 3);
    } else {
      if (url.hostname !== 'app' || relative.split('/').some(part => !part || !/^[a-z0-9_.-]+$/i.test(part) || part.startsWith('.'))) {
        return new Response(null, { status: 404 });
      }
      file = path.join(publicDir, relative);
      type = types[path.extname(file)];
      if (!type) return new Response(null, { status: 404 });
    }
    return new Response(await fs.readFile(file), { headers: {
      'Content-Type': type, 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff'
    } });
  } catch { return new Response(null, { status: 404 }); }
}

function handle(channel, action) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame ||
        event.senderFrame.url !== appURL) throw Error('Unknown window.');
    try { return { value: await action(...args) }; }
    catch (error) { return { error: error.message || 'The operation failed.' }; }
  });
}

function current(sessionId) {
  if (!library || sessionId !== library.session) throw Error('The library changed. Open the document again.');
  return library;
}

async function start() {
  // Build only after acquiring the window's single-instance lock.
  if (fromSource) {
    process.chdir(app.getAppPath());
    const { pathToFileURL } = require('node:url');
    await import(pathToFileURL(path.join(app.getAppPath(), 'scripts/build.mjs')).href);
  }
  try {
    const settings = JSON.parse(await fs.readFile(settingsFile, 'utf8'));
    library = await openLibrary(settings.directory);
  } catch (error) {
    if (error.code !== 'ENOENT' || await fs.stat(settingsFile).then(() => true, () => false)) {
      startupMessage = 'The last library could not be opened. Choose its folder to reconnect.';
    }
  }
  protocol.handle('itacan', serve);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, reply) => reply(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  handle('home', async () => ({ library: library ? await library.home() : null, message: startupMessage }));
  handle('choose-library', async () => {
    const result = await dialog.showOpenDialog(win, { title: 'Choose an Itacan library or an empty folder',
      properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return null;
    const next = await openLibrary(result.filePaths[0], true);
    const overview = await next.home();
    await atomicReplace(settingsFile, JSON.stringify({ directory: next.root }, null, 2) + '\n');
    library = next;
    startupMessage = '';
    return overview;
  });
  function currentWork(id) {
    const selected = current(id);
    if (work?.library !== selected) work = new LibraryWork(selected);
    return work;
  }
  handle('work-read', id => currentWork(id).transaction());
  handle('work-update', (id, group, action, data) => currentWork(id).command(group, action, data));
  handle('move-item', async (id, from, parent, name, trash) => {
    const {state, removed} = await moveItem(currentWork(id), from, parent, name, trash);
    if (removed) await shell.trashItem(removed).catch(() => {}); // Library Trash retains the item if the OS cannot accept it.
    return state;
  });
  handle('capture-files', async (id,text) => {
    const selected = await dialog.showOpenDialog(win, {title:'Capture files', properties:['openFile','multiSelections']});
    const store = currentWork(id);
    return selected.canceled ? null : captureFiles(store, selected.filePaths, text);
  });
  handle('file-text', (id, data) => fileText(currentWork(id), data));
  handle('resolve-attachment', (id, capture, parent) => resolveAttachment(currentWork(id), capture, parent));
  handle('entries', (id, folder) => current(id).entries(folder));
  handle('create', (id, parent, name, kind, text) => current(id).create(parent, name, kind, text));
  handle('read-note', (id, file) => current(id).readNote(file));
  handle('open-attachment', async (id, file) => {
    const problem = await shell.openPath(await current(id).attachmentPath(file));
    if (problem) throw Error(problem);
  });
  handle('save-note', (id, file, text, revision) => current(id).saveNote(file, text, revision));
  handle('web-link', async value => {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) throw Error('Unsupported link type.');
    await shell.openExternal(url.href);
  });
  handle('close-answer', allowed => {
    if (!closeRequested) return;
    closeRequested = false;
    closeApproved = allowed === true;
    if (closeApproved) win.close();
  });

  win = new BrowserWindow({ width: 1160, height: 800, minWidth: 680, minHeight: 480, show: false,
    title: 'Itacan', backgroundColor: '#f6f5ef', webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false
    } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.on('close', event => {
    if (closeApproved || win.webContents.isCrashed() || win.webContents.isLoadingMainFrame()) return;
    event.preventDefault();
    if (!closeRequested) { closeRequested = true; win.webContents.send('request-close'); }
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [{ role: 'close' }] },
    { role: 'editMenu' }
  ]));
  win.once('ready-to-show', () => win.show());
  await win.loadURL(appURL);
}
if (app.requestSingleInstanceLock()) {
  app.on('second-instance', () => { if (win?.isMinimized()) win.restore(); win?.focus(); });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('Itacan could not start', error.message); app.quit(); });
} else app.quit();
