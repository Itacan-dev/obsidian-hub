"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const channel = process.argv.find(value => value.startsWith("--itacan-prototype-channel="))?.split("=")[1];
contextBridge.exposeInMainWorld("prototypeRecovery", {
    release: () => ipcRenderer.invoke(channel, "release"),
    status: callback => ipcRenderer.on(channel + ":status", (_event, text) => callback(text))
});
