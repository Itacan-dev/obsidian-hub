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
contextBridge.exposeInMainWorld('itacan', {
  statisticsNotes: id => call('statistics-notes',id),
  work: id => call('work-read', id),
  update: (id, group, action, data) => call('work-update', id, group, action, data),
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
  chooseLibrary: () => call('choose-library'),
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
