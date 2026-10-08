"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("oathExperiment", Object.freeze({
    focusHost: () => ipcRenderer.invoke("oath-phase1:focus"),
    stop: () => ipcRenderer.invoke("oath-phase1:stop")
}));
