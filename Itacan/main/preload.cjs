const { contextBridge, ipcRenderer } = require('electron');

async function call(channel, ...args) {
  const reply = await ipcRenderer.invoke(channel, ...args);
  if (reply.error) throw Error(reply.error);
  return reply.value;
}
contextBridge.exposeInMainWorld('itacan', {
  work: id => call('work-read', id),
  update: (id, group, action, data) => call('work-update', id, group, action, data),
  moveItem: (id, from, parent, name, trash) => call('move-item', id, from, parent, name, trash),
  fileText: (id, data) => call('file-text', id, data),
  captureFiles: (id,text) => call('capture-files', id,text),
  resolveAttachment: (id, capture, parent) => call('resolve-attachment', id, capture, parent),
  home: () => call('home'),
  chooseLibrary: () => call('choose-library'),
  entries: (id, folder) => call('entries', id, folder),
  create: (id, parent, name, kind, text) => call('create', id, parent, name, kind, text),
  readNote: (id, file) => call('read-note', id, file),
  openAttachment: (id, file) => call('open-attachment', id, file),
  saveNote: (id, file, text, revision) => call('save-note', id, file, text, revision),
  openWebLink: url => call('web-link', url),
  onRequestClose: handler => { ipcRenderer.on('request-close', () => handler()); },
  answerClose: allowed => call('close-answer', allowed)
});
