"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const channel = process.argv.find(value => value.startsWith("--oath-dock-channel="))?.slice(20);
if (!channel || !/^itacan-oath-dock-[a-f0-9-]+$/.test(channel)) throw Error("Invalid dock channel");
contextBridge.exposeInMainWorld("oathDock", {
    request: (action, index) => ipcRenderer.invoke(channel, action, index),
    subscribe: callback => { ipcRenderer.on(channel + ":model", (_event, model) => callback(model)); }
});
