const { contextBridge, ipcRenderer, webUtils } = require('electron');

async function call(channel, ...args) {
  const reply = await ipcRenderer.invoke(channel, ...args);
  if (reply.error) throw Error(reply.error);
  return reply.value;
}
function droppedFiles(files) {
  return Promise.all(files.map(async file=>webUtils.getPathForFile(file) ||
    {name:file.name,bytes:new Uint8Array(await file.arrayBuffer())}));
}
async function streamNoteMatches(id, request, onMatches) {
  let listener;
  const finished = new Promise((resolve, reject) => {
    listener = (_event, session, token, matches) => {
      if (session !== id || token !== request.token) return;
      if (matches === null) {
        resolve();
      } else {
        try { onMatches(matches); }
        catch (error) { reject(error); }
      }
    };
    ipcRenderer.on('search-matches', listener);
  });
  try {
    await Promise.all([call('search', id, { ...request, phase: 'content', stream: true }), finished]);
  } finally {
    ipcRenderer.removeListener('search-matches', listener);
  }
}
contextBridge.exposeInMainWorld('itacan', {
  statisticsNotes: id => call('statistics-notes',id),
  work: id => call('work-read', id),
  ...Object.fromEntries(['task','workspace','oath','roadmap','music','settings','progress','layout','plan','capture','inbox'].map(
    group=>[group,(id,action,data)=>call(group+'-operation',id,action,data)])),
  search:(id,request)=>call('search',id,request),
  streamNoteMatches,
  cancelSearch:(id,token)=>call('cancel-search',id,token),
  documentPath:(id,file)=>call('document-path',id,file),
  getDraft:(id,file)=>call('get-draft',id,file),
  putDraft:(id,file,draft)=>call('put-draft',id,file,draft),
  readDevicePreferences:()=>call('read-device-preferences'),
  saveDevicePreferences:settings=>call('save-device-preferences',settings),
  listDeviceApps:()=>call('device-apps'),
  chooseDeviceApp:()=>call('choose-device-app'),
  removeDeviceApp:id=>call('remove-device-app',id),
  launchDeviceApp:id=>call('launch-device-app',id),
  onWorkChanged:handler=>ipcRenderer.on('work-changed',(_event,id)=>handler(id)),
  onNotice:handler=>ipcRenderer.on('library-notice',(_event,message)=>handler(message)),
  copyItem: (id,path,parent) => call('copy-item',id,path,parent),
  copyPaths: (id,paths) => call('copy-paths',id,paths),
  revealItem: (id,path) => call('reveal-item',id,path),
  moveItem: (id, from, parent, name, trash) => call('move-item', id, from, parent, name, trash),
  fileText: (id, data) => call('file-text', id, data),
  captureFiles: id => call('capture-files', id),
  stageFiles: async (id,files)=>call('stage-files',id,await droppedFiles(files)),
  importFiles: async (id,parent,files)=>call('import-files',id,parent,await droppedFiles(files)),
  resolveAttachment: (id, capture, parent, staged) => call('resolve-attachment', id, capture, parent, staged),
  home: () => call('home'),
  chooseLibrary: mode => call('choose-library',mode),
  entries: (id, folder, times) => call('entries', id, folder, times),
  create: (id, parent, name, kind, text) => call('create', id, parent, name, kind, text),
  readNote: (id, file) => call('read-note', id, file),
  resolveLayout: (id, layout) => call('resolve-layout', id, layout),
  openAttachment: (id, file) => call('open-attachment', id, file),
  saveNote: (id, file, text, revision) => call('save-note', id, file, text, revision),
  openWebLink: url => call('web-link', url),
  onRequestClose: handler => { ipcRenderer.on('request-close', () => handler()); },
  answerClose: allowed => call('close-answer', allowed)
});
