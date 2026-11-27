const { app, dialog, ipcMain, clipboard, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { openLibrary, atomicReplace } = require('./library.cjs');
const { LibraryWork } = require('./work.cjs');
const { LibrarySearch } = require('./search.cjs');
const { DeviceDrafts } = require('./drafts.cjs');
const { copySample } = require('./sample.cjs');
const { oathAllows } = require('./oath.cjs');
const { statisticsNotes } = require('./progress.cjs');
const { installDeviceShortcuts } = require('./settings.cjs');
const { createItem, saveDocument, copyItem, moveItem, importFiles, captureFiles, resolveAttachment, fileText } = require('./files.cjs');
const { appURL } = require('./protocol.cjs');

async function restoreLibrarySelection() {
  const settingsFile = path.join(app.getPath('userData'), 'settings.json');
  const selection = { settingsFile, library: null, work: null, message: '' };
  try {
    const settings = JSON.parse(await fs.readFile(settingsFile, 'utf8'));
    selection.library = await openLibrary(settings.directory);
  } catch (error) {
    if (error.code !== 'ENOENT' || await fs.stat(settingsFile).then(() => true, () => false)) {
      selection.message = 'The last library could not be opened. Choose its folder to reconnect.';
    }
  }
  return selection;
}

function installRendererIPC(win, selection, answerClose) {
  const drafts = new DeviceDrafts(app.getPath('userData'));
  const search = new LibrarySearch();

  // All channels share the same sender check and preload response envelope.
  function handle(channel, action) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame ||
          event.senderFrame.url !== appURL) {
        throw Error('Unknown window.');
      }
      try {
        return { value: await action(...args) };
      } catch (error) {
        return { error: error.message || 'The operation failed.' };
      }
    });
  }
  function current(id) {
    const library = selection.library;
    if (!library || id !== library.session) throw Error('The library changed. Open the document again.');
    return library;
  }
  function currentWork(id) {
    const library = current(id);
    if (selection.work?.library !== library) selection.work = new LibraryWork(library);
    return selection.work;
  }
  function checked(id, file) {
    const library = current(id);
    if (!oathAllows(selection.work?.latest || {}, file)) throw Error('This item is outside your active Oath.');
    return library;
  }
  function checkExternal() {
    if (selection.work?.latest?.oath?.status === 'active') {
      throw Error('Finish or break the active Oath before opening an external shortcut.');
    }
  }

  handle('close-answer', answerClose);
  handle('home', async () => ({
    library: selection.library ? await selection.library.home() : null,
    message: selection.message
  }));
  handle('choose-library', async mode => {
    if (['active', 'rest'].includes(selection.work?.latest?.oath?.status)) {
      throw Error('Finish or break the active Oath before switching libraries.');
    }
    const sample = mode === 'sample';
    const result = await dialog.showOpenDialog(win, {
      title: sample ? 'Choose where to create your example library' : 'Choose an Itacan library or an empty folder',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return null;
    let directory = result.filePaths[0];
    if (sample) directory = await copySample(path.join(app.getAppPath(), 'examples', 'Field Library'), directory);
    const library = await openLibrary(directory, true);
    const overview = await library.home();
    await atomicReplace(selection.settingsFile, JSON.stringify({ directory: library.root }, null, 2) + '\n');
    search.clear();
    selection.library = library;
    selection.work = null;
    selection.message = '';
    return overview;
  });

  handle('work-read', id => currentWork(id).transaction());
  const domains = ['task', 'workspace', 'oath', 'roadmap', 'music', 'settings', 'progress', 'layout', 'plan', 'capture', 'inbox'];
  for (const group of domains) {
    handle(group + '-operation', (id, action, data) => currentWork(id).command(group, action, data));
  }
  handle('statistics-notes', id => statisticsNotes(current(id)));
  handle('search', async (id, request) => {
    const library = current(id);
    const state = selection.work?.latest || {};
    if (request.phase !== 'content' || !request.stream) return search.query(library, state, request);
    function sendMatches(matches) {
      if (selection.library?.session === id && !win.isDestroyed()) {
        win.webContents.send('search-matches', id, request.token, matches);
      }
    }
    await search.query(library, state, request, sendMatches);
    // End this stream even if the selected library changed during the scan.
    // Electron delivers these events in order; an invoke reply can overtake them.
    if (!win.isDestroyed()) win.webContents.send('search-matches', id, request.token, null);
  });
  handle('cancel-search', (id, token) => {
    current(id);
    search.cancel(token);
  });

  handle('document-path', async (id, file) => {
    const library = checked(id, file);
    return library.relativePath(await library.documentPath(file));
  });
  handle('get-draft', (id, file) => drafts.get(checked(id, file), file));
  handle('put-draft', (id, file, draft) => drafts.put(current(id), file, draft));
  handle('entries', (id, folder, times) => checked(id, folder).entries(folder, 2, times));
  handle('create', (id, parent, name, kind, text) => createItem(currentWork(id), parent, name, kind, text));
  handle('read-note', (id, file) => checked(id, file).readNote(file));
  handle('resolve-layout', (id, layout) => current(id).resolveLayout(layout));
  handle('save-note', (id, file, text, revision) => saveDocument(currentWork(id), file, text, revision, () => {
    win.webContents.send('library-notice', 'Note saved. Its activity record could not be updated.');
  }));

  handle('move-item', async (id, from, parent, name, trash) => {
    const { state, removed } = await moveItem(currentWork(id), from, parent, name, trash);
    // Library Trash retains the item if the OS cannot accept it.
    if (removed) await shell.trashItem(removed).catch(() => {});
    return state;
  });
  handle('copy-item', (id, source, parent) => copyItem(currentWork(id), source, parent));
  handle('copy-paths', async (id, paths) => {
    const library = current(id);
    for (const relative of paths) await library.resolve(relative);
    clipboard.writeText(paths.join('\n'));
  });
  handle('reveal-item', async (id, relative) => shell.showItemInFolder(await current(id).resolve(relative)));
  handle('capture-files', async id => {
    const selected = await dialog.showOpenDialog(win, { title: 'Capture files', properties: ['openFile', 'multiSelections'] });
    const store = currentWork(id);
    return selected.canceled ? null : captureFiles(store, selected.filePaths, '', true);
  });
  handle('import-files', (id, parent, files) => importFiles(currentWork(id), parent, files));
  handle('stage-files', (id, files) => captureFiles(currentWork(id), files, '', true));
  handle('file-text', (id, data) => fileText(currentWork(id), data));
  handle('resolve-attachment', (id, capture, parent, staged) => resolveAttachment(currentWork(id), capture, parent, staged));

  handle('open-attachment', async (id, file) => {
    checkExternal();
    const problem = await shell.openPath(await checked(id, file).attachmentPath(file));
    if (problem) throw Error(problem);
  });
  handle('web-link', async value => {
    checkExternal();
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) throw Error('Unsupported link type.');
    await shell.openExternal(url.href);
  });
  installDeviceShortcuts({
    app, dialog, shell,
    window: () => win,
    handle: (channel, action) => handle(channel, (...args) => {
      if (channel === 'launch-device-app') checkExternal();
      return action(...args);
    })
  });
}

module.exports = { restoreLibrarySelection, installRendererIPC };
