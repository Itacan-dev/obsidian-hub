const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { choices, shortcuts, periods, coverArt } = require('../contracts/preferences.cjs');
const { imageTypes, atomicReplace } = require('./library.cjs');
const syncFs = require('node:fs');

function validateBindings(values, partial=false) {
  const bindings = {};
  const seen = new Set();
  for (const [key,[label,standard]] of Object.entries(shortcuts)) {
    if (partial && !values[key]) continue;
    const binding = values[key] ?? standard;
    if (typeof binding !== 'string' || !/^(Mod|Ctrl|Alt)(\+Alt)?(\+Shift)?\+(Space|Tab|[A-Z0-9,./-])$/.test(binding))
      throw Error('Invalid shortcut for '+label+'.');
    const normalized = binding.replace(/^Mod\+/,process.platform === 'darwin' ? 'Cmd+' : 'Ctrl+');
    if (seen.has(normalized)) throw Error('Shortcut already assigned: '+binding+'.');
    seen.add(normalized);
    bindings[key] = binding;
  }
  return bindings;
}

async function setPreferences(state, values, library) {
  const next = { ...state.settings };
  for (const [key, options] of Object.entries(choices)) {
    if (!(key in values)) continue;
    if (!options.includes(values[key])) throw Error('Unsupported preference: '+key);
    next[key] = values[key];
  }
  if (values.shortcuts) next.shortcuts = validateBindings(values.shortcuts);
  if ('musicEnabled' in values) {
    if (typeof values.musicEnabled !== 'boolean') throw Error('Invalid Music setting.');
    next.musicEnabled = values.musicEnabled;
  }
  if (values.covers) {
    const covers = {};
    for (const period of periods) {
      const item = values.covers[period];
      if (!item) continue;
      if (!coverArt.includes(item.art) || !Number.isInteger(item.position) || item.position < 0 || item.position > 100)
        throw Error('Choose a valid cover and position.');
      const file = item.path || '';
      if (file && (!imageTypes[path.extname(file).toLowerCase()] || (file !== state.settings?.covers?.[period]?.path && !(await library.attachmentPath(file)))))
        throw Error('Choose an image from the library.');
      covers[period] = {art:item.art,path:file,position:item.position};
    }
    next.covers = covers;
  }
  if (values.websites) {
    if (!Array.isArray(values.websites) || values.websites.length > 24) throw Error('Keep at most 24 website shortcuts.');
    next.websites = values.websites.map(item => {
      const url = new URL(item.url);
      const label = String(item.label || '').trim();
      if (!label || !['http:','https:'].includes(url.protocol) || url.username || url.password) throw Error('Enter a name and a web address.');
      return {label,url:url.href};
    });
  }
  state.settings = next;
}

// A native picker authorizes each local launcher. Only its ID and label leave main.
function installDeviceShortcuts({handle,app,dialog,shell,window}) {
  const file = path.join(app.getPath('userData'),'application-shortcuts.json');
  const preferencesPath = path.join(app.getPath('userData'),'device-preferences.json');
  handle('read-device-preferences',async()=>{
    try {return JSON.parse(await fs.readFile(preferencesPath,'utf8'));}
    catch(error){if(error.code==='ENOENT')return {};throw error;}
  });
  handle('save-device-preferences',async values=>{
    const preferences = {shortcuts:validateBindings(values.shortcuts || {},true)};
    await atomicReplace(preferencesPath,JSON.stringify(preferences,null,2)+'\n');
    return preferences;
  });
  const summary = rows => rows.map(({id,label})=>({id,label}));
  async function read() {
    try { return JSON.parse(await fs.readFile(file,'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  const save = rows => atomicReplace(file,JSON.stringify(rows,null,2)+'\n');
  handle('device-apps',async()=>summary(await read()));
  handle('choose-device-app',async()=>{
    const choice = await dialog.showOpenDialog(window(),{
      title:'Choose application', properties:['openFile'],
      ...(process.platform==='win32' ? {filters:[{name:'Application',extensions:['exe']}]} : {})
    });
    const rows = await read();
    if (!choice.canceled && choice.filePaths.length) {
      const target = await fs.realpath(choice.filePaths[0]);
      const stat = await fs.stat(target);
      const executable = process.platform === 'win32' ? stat.isFile() && /\.exe$/i.test(target)
        : process.platform === 'darwin' && /\.app$/i.test(target) && stat.isDirectory() || stat.isFile() && !!(stat.mode & 0o111);
      if (!executable) throw Error('Choose an installed application.');
      if (!rows.some(row=>row.target===target)) rows.push({id:randomUUID(),label:path.basename(target).replace(/\.(exe|app)$/i,''),target});
      await save(rows);
    }
    return summary(rows);
  });
  handle('remove-device-app',async id=>{
    const rows = (await read()).filter(row=>row.id!==id);
    await save(rows);
    return summary(rows);
  });
  handle('launch-device-app',async id=>{
    const row = (await read()).find(entry=>entry.id===id);
    if (!row) throw Error('This application is unavailable. Choose it in Settings.');
    const error = await shell.openPath(row.target);
    if (error) throw Error(error);
  });
}
async function readWindowBounds(app) {
  const fallback = {bounds:{},maximized:true};
  try {
    const value=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'window.json'),'utf8'));
    const {x,y,width,height}=value.bounds;
    if (![x,y,width,height].every(Number.isSafeInteger) || width<680 || height<480) return fallback;
    const display=require('electron').screen.getDisplayMatching(value.bounds);
    const area=display.workArea;
    const w=Math.max(680,Math.min(width,area.width)),h=Math.max(480,Math.min(height,area.height));
    return {bounds:{width:w,height:h,x:Math.max(area.x,Math.min(x,area.x+area.width-w)),y:Math.max(area.y,Math.min(y,area.y+area.height-h))},maximized:value.maximized === true};
  } catch {return fallback;}
}
function rememberWindowBounds(app,win) {
  const file=path.join(app.getPath('userData'),'window.json');
  win.on('close',()=>{
    if(win.isDestroyed() || win.isFullScreen() || win.isMinimized())return;
    try {
      const value={bounds:win.getNormalBounds(),maximized:win.isMaximized()};
      syncFs.writeFileSync(file+'.tmp',JSON.stringify(value),'utf8');
      syncFs.renameSync(file+'.tmp',file);
    } catch(error){console.warn('Window preferences:',error.message);}
  });
}

function rewriteCoverRefs(state, moved) {
  for (const cover of Object.values(state.settings?.covers || {})) {
    if (cover.path) cover.path = moved(cover.path);
  }
}

module.exports = { rewriteCoverRefs, setPreferences, installDeviceShortcuts, readWindowBounds, rememberWindowBounds };
