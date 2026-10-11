"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("oathPreview", {
    action: action => ipcRenderer.invoke("oath-preview:action", action),
    status: callback => ipcRenderer.on("oath-preview:status", (_event, message) => callback(message))
});
