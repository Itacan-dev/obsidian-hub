const { app, BrowserWindow, dialog, ipcMain, clipboard, Menu, protocol, session, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { openLibrary, atomicReplace, imageTypes } = require('./library.cjs');

const { LibrarySearch } = require('./search.cjs');
const { DeviceDrafts } = require('./drafts.cjs');
const { oathAllows } = require('./oath.cjs');
const { audioPath, audioTypes } = require('./music.cjs');
const { createReadStream } = require('node:fs');
const { Readable } = require('node:stream');
const { installDeviceShortcuts, readWindowBounds, rememberWindowBounds } = require('./settings.cjs');
const search = new LibrarySearch();

const appURL = 'itacan://app/index.html';
protocol.registerSchemesAsPrivileged([{ scheme: 'itacan', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (!app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getPath('appData'), 'Itacan Development'));
}
const settingsFile = path.join(app.getPath('userData'), 'settings.json');
const fromSource = !app.isPackaged && app.commandLine.hasSwitch('itacan-dev');
const publicDir = fromSource ? path.join(app.getAppPath(), 'build/app/public') : path.join(__dirname, '../public');
const types = { ...imageTypes, '.js': 'text/javascript', '.mjs':'text/javascript', '.bcmap':'application/octet-stream', '.pfb':'application/octet-stream', '.wasm':'application/wasm', '.bin':'application/octet-stream', '.icc':'application/octet-stream', '.otf':'font/otf', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' itacan://image itacan://media; media-src 'self' itacan://audio; worker-src 'self'; font-src 'self' blob:; connect-src 'self' itacan://media; base-uri 'none'; form-action 'none'; frame-src 'none'";
const { statisticsNotes } = require('./progress.cjs');
const { LibraryWork } = require('./work.cjs');
const { createItem, saveDocument, copyItem, moveItem, importFiles, captureFiles, resolveAttachment, fileText } = require('./files.cjs');
let library;
let work;
let win;
let closeRequested = false;
let closeApproved = false;
let startupMessage = '';

async function serve(request) {
  try {
    const url = new URL(request.url);
    let relative = decodeURIComponent(url.pathname.slice(1));
    const media = url.hostname === 'media' || (url.hostname === 'app' && relative.startsWith('media/'));
    if (media && url.hostname === 'app') relative = relative.slice(6);
    let file, type;
    if (url.hostname === 'audio') {
      if (!library || url.searchParams.get('library') !== library.session || !oathAllows(work?.latest || {},relative)) return new Response(null,{status:404});
      file = await audioPath(library,relative);
      const {size} = await fs.stat(file);
      const range = request.headers.get('range');
      let start=0, end=size-1;
      if (range) {
        const match=/^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || !match[1] && !match[2]) return new Response(null,{status:416});
        start=match[1] ? Number(match[1]) : Math.max(size-Number(match[2]),0);
        end=match[1] && match[2] ? Math.min(size-1,Number(match[2])) : size-1;
        if (!Number.isSafeInteger(start) || start>end) return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
      }
      const headers={'Content-Type':audioTypes[path.extname(relative).toLowerCase()],'Accept-Ranges':'bytes','Content-Length':String(end-start+1)};
      if (range) headers['Content-Range']='bytes '+start+'-'+end+'/'+size;
      const stream = size && request.method!=='HEAD' ? Readable.toWeb(createReadStream(file,{start,end,signal:request.signal})) : null;
      return new Response(stream,{status:range?206:200,headers});
    }
    if (url.hostname === 'image' || media) {
      type = imageTypes[path.extname(relative).toLowerCase()];
      if (!type && media && /\.pdf$/i.test(relative)) type = 'application/pdf';
      if (library && !oathAllows(work?.latest || {},relative)) return new Response(null,{status:403});
      if (!type || !library || url.searchParams.get('library') !== library.session) return new Response(null, { status: 404 });
      file = await library.attachmentPath(relative);
    } else {
      if (url.hostname !== 'app' || relative.split('/').some(part => !part || !/^[a-z0-9_.-]+$/i.test(part) || part.startsWith('.'))) {
        return new Response(null, { status: 404 });
      }
      file = path.join(publicDir, relative);
      type = types[path.extname(file)];
      if (!type) return new Response(null, { status: 404 });
    }
    const mediaHeaders = {};
    if (media) {
      const stat = await fs.stat(file);
      Object.assign(mediaHeaders, {
        'ETag':'"'+stat.size+'-'+stat.mtimeMs+'"','Last-Modified':stat.mtime.toUTCString(),
        'Cache-Control':'no-store','Access-Control-Expose-Headers':'ETag, Last-Modified'
      });
    }
    return new Response(request.method==='HEAD' ? null : await fs.readFile(file), { headers: {
      ...mediaHeaders,
      ...(url.hostname === 'media' ? {'Access-Control-Allow-Origin':'itacan://app'} : {}),
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
  const drafts = new DeviceDrafts(app.getPath('userData'));
  function checked(id,file) {
    const selected = current(id);
    if (!oathAllows(work?.latest || {},file)) throw Error('This item is outside your active Oath.');
    return selected;
  }
  function checkExternal() {
    if (work?.latest?.oath?.status === 'active') throw Error('Finish or break the active Oath before opening an external shortcut.');
  }
  protocol.handle('itacan', serve);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, reply) => reply(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  handle('home', async () => ({ library: library ? await library.home() : null, message: startupMessage }));
  handle('choose-library', async mode => {
    if (['active','rest'].includes(work?.latest?.oath?.status)) throw Error('Finish or break the active Oath before switching libraries.');
    const sample = mode === 'sample';
    const result = await dialog.showOpenDialog(win, { title: sample ? 'Choose where to create your example library' : 'Choose an Itacan library or an empty folder',
      properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return null;
    const directory = sample ? await require('./sample.cjs').copySample(
      path.join(app.getAppPath(),'examples','Field Library'),result.filePaths[0]) : result.filePaths[0];
    const next = await openLibrary(directory, true);
    const overview = await next.home();
    await atomicReplace(settingsFile, JSON.stringify({ directory: next.root }, null, 2) + '\n');
    search.clear();
    library = next;
    work = null;
    startupMessage = '';
    return overview;
  });
  function currentWork(id) {
    const selected = current(id);
    if (work?.library !== selected) work = new LibraryWork(selected);
    return work;
  }
  installDeviceShortcuts({handle:(channel,action)=>handle(channel,(...args)=>{
    if(channel==='launch-device-app') checkExternal();
    return action(...args);
  }),app,dialog,shell,window:()=>win});
  handle('search', (id,request)=>search.query(current(id),work?.latest || {},request,
    request.phase === 'content' && request.stream ? matches=>{
      if (library?.session === id && !win.isDestroyed()) win.webContents.send('search-matches',id,request.token,matches);
    } : undefined));
  handle('cancel-search', (id,token)=>{current(id);search.cancel(token);});
  handle('get-draft',(id,file)=>drafts.get(checked(id,file),file));
  handle('put-draft',(id,file,draft)=>drafts.put(current(id),file,draft));
  handle('document-path',async (id,file)=>{
    const selected = checked(id,file);
    return selected.relativePath(await selected.documentPath(file));
  });
  handle('statistics-notes',id=>statisticsNotes(current(id)));
  handle('work-read', id => currentWork(id).transaction());
  for (const group of ['task','workspace','oath','roadmap','music','settings','progress','layout','plan','capture','inbox']) {
    handle(group+'-operation',(id,action,data)=>currentWork(id).command(group,action,data));
  }
  handle('move-item', async (id, from, parent, name, trash) => {
    const {state, removed} = await moveItem(currentWork(id), from, parent, name, trash);
    if (removed) await shell.trashItem(removed).catch(() => {}); // Library Trash retains the item if the OS cannot accept it.
    return state;
  });
  handle('copy-item',(id,source,parent)=>copyItem(currentWork(id),source,parent));
  handle('copy-paths',async (id,paths)=>{
    const library = current(id);
    for (const path of paths) await library.resolve(path);
    clipboard.writeText(paths.join('\n'));
  });
  handle('reveal-item',async(id,path)=>shell.showItemInFolder(await current(id).resolve(path)));
  handle('capture-files', async (id) => {
    const selected = await dialog.showOpenDialog(win, {title:'Capture files', properties:['openFile','multiSelections']});
    const store = currentWork(id);
    return selected.canceled ? null : captureFiles(store, selected.filePaths, '', true);
  });
  handle('import-files',(id,parent,files)=>importFiles(currentWork(id),parent,files));
  handle('stage-files', (id, files) => captureFiles(currentWork(id), files, '', true));
  handle('file-text', (id, data) => fileText(currentWork(id), data));
  handle('resolve-attachment', (id, capture, parent, staged) => resolveAttachment(currentWork(id), capture, parent, staged));
  handle('entries', (id, folder, times) => checked(id,folder).entries(folder,2,times));
  handle('create', (id, parent, name, kind, text) => createItem(currentWork(id), parent, name, kind, text));
  handle('read-note', (id, file) => checked(id,file).readNote(file));
  handle('resolve-layout', (id, layout) => current(id).resolveLayout(layout));
  handle('open-attachment', async (id, file) => {
    checkExternal();
    const problem = await shell.openPath(await checked(id,file).attachmentPath(file));
    if (problem) throw Error(problem);
  });
  handle('save-note', (id, file, text, revision) => saveDocument(currentWork(id), file, text, revision,
    ()=>win.webContents.send('library-notice','Note saved. Its activity record could not be updated.')));
  handle('web-link', async value => {
    checkExternal();
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

  const savedWindow = await readWindowBounds(app);
  win = new BrowserWindow({ width: 1160, height: 800, ...savedWindow.bounds, minWidth: 680, minHeight: 480, show: false,
    title: 'Itacan', backgroundColor: '#f6f5ef', webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false
    } });
  rememberWindowBounds(app,win);
  let oathFullscreen = false, beforeFullscreen = false;
  const refreshOath = () => {
    const active = work?.latest?.oath?.status === 'active';
    if (!win || win.isDestroyed() || active === oathFullscreen) return;
    if (active) beforeFullscreen = win.isFullScreen();
    oathFullscreen = active;
    win.setFullScreen(active || beforeFullscreen);
  };
  win.on('leave-full-screen',()=>{ if (oathFullscreen) win.setFullScreen(true); });
  const tick = setInterval(async () => {
    const oath = work?.latest?.oath;
    const boundary = oath?.status === 'scheduled' ? oath.startsAt : oath?.restUntil || oath?.endsAt;
    if (!boundary || Date.parse(boundary) > Date.now() || work.ticking) return refreshOath();
    const store = work;
    store.ticking = true;
    try {
      const prev = store.latest.revision;
      const state = await store.transaction();
      if (work === store && prev !== state.revision && !win.isDestroyed()) win.webContents.send('work-changed',store.library.session);
    } catch (error) { console.error('Oath clock:',error.message); }
    finally { store.ticking = false; refreshOath(); }
  },1000);
  tick.unref();
  win.on('closed',()=>clearInterval(tick));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.on('close', event => {
    if (closeApproved || win.webContents.isCrashed() || win.webContents.isLoadingMainFrame()) return;
    event.preventDefault();
    if (!closeRequested) { closeRequested = true; win.webContents.send('request-close'); }
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [{ role: 'close', accelerator:process.platform==='darwin'?'Shift+Command+W':'Alt+F4' }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'togglefullscreen', accelerator: process.platform === 'darwin' ? 'Control+Command+F' : 'F11' }] }
  ]));
  win.once('ready-to-show', () => { if (savedWindow.maximized) win.maximize(); win.show(); });
  await win.loadURL(appURL);
}
if (app.requestSingleInstanceLock()) {
  app.on('second-instance', () => { if (win?.isMinimized()) win.restore(); win?.focus(); });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('Itacan could not start', error.message); app.quit(); });
} else app.quit();
