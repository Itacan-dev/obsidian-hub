"use strict";
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(process.env.ITACAN_VNEXT_RUN,'profile'));
app.whenReady().then(()=>{try{const file=path.join(process.env.APPDATA,'obsidian/obsidian-1.14.5.asar/app.js'),source=fs.readFileSync(file,'utf8'),parts=[];for(const key of ['@electron/remote','function h0','getCurrentWindow']){const n=source.indexOf(key);parts.push({key,offset:n,text:source.slice(Math.max(0,n-500),n+600)});}fs.writeFileSync(path.join(process.env.ITACAN_VNEXT_RUN,'host-loader.json'),JSON.stringify(parts,null,2));app.quit();}catch(e){console.error(e);app.exit(1)}});
