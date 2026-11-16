"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const channel = process.argv.find(value => value.startsWith("--reminder-channel="))?.split("=")[1];
contextBridge.exposeInMainWorld("reminder", Object.freeze({
    action: (action, value) => ipcRenderer.invoke(channel, action, value),
    onModel: callback => ipcRenderer.on(channel + ":model", (_event, value) => callback(value))
}));
