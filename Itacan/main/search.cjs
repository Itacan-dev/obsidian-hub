// Each query has its own cancellation token. Filename results are requested first.
const fs = require('node:fs/promises');
const { oathAllows } = require('./oath.cjs');

class LibrarySearch {
  constructor() { this.active = new Map(); }
  cancel(token) {
    const controller = this.active.get(token);
    if (controller) controller.abort();
  }
  clear() {
    for (const controller of this.active.values()) controller.abort();
    this.active.clear();
  }
  async query(library,state,{query,token,scope,phase,folders},onMatches) {
    if (typeof query !== 'string' || !query.trim() || !['names','content'].includes(phase)) return [];
    if (typeof token !== 'string' && !Number.isSafeInteger(token)) throw Error('Invalid search token.');
    const needle = query.trim().toLowerCase();
    const controller = new AbortController();
    this.cancel(token);
    this.active.set(token,controller);
    const signal = controller.signal, results = [], visited = new Set();
    const walk = async folder => {
      if (signal.aborted || visited.has(folder) || !oathAllows(state,folder)) return;
      visited.add(folder);
      let entries;
      try { entries = await library.entries(folder); }
      catch (error) { if (['ENOENT','EACCES','EPERM'].includes(error.code)) return; throw error; }
      if (phase === 'names') {
        for (const item of entries) if (item.name.toLowerCase().includes(needle) &&
            (item.kind !== 'file' || item.openable)) results.push(item);
      } else {
        const notes = entries.filter(item=>item.kind === 'note');
        for (let i=0; i<notes.length && !signal.aborted; i+=8) {
          const batch = await Promise.all(notes.slice(i,i+8).map(async item=>{
            try {
              const bytes = await fs.readFile(await library.notePath(item.path),{signal});
              const lines = new TextDecoder('utf-8',{fatal:true}).decode(bytes).split(/\r?\n/);
              const index = lines.findIndex(line=>line.toLowerCase().includes(needle));
              return index < 0 ? null : {...item,line:index+1,snippet:lines[index].slice(0,180)};
            } catch { return null; }
          }));
          const matches = batch.filter(Boolean);
          if (matches.length && !signal.aborted) {
            if (onMatches) onMatches(matches);
            else results.push(...matches);
          }
        }
      }
      for (const item of entries) if (item.kind === 'folder' && !signal.aborted) await walk(item.path);
    };
    try {
      let roots = folders?.length ? folders : scope ? [scope] : null;
      if (!roots && state.oath?.status === 'active') {
        const owner = state.oath.owner;
        roots = [owner,...(state.sharedFolders?.[owner] || [])];
      }
      if (!roots) {
        const {projects,resources,extraResources} = await library.home();
        roots = [...projects,...resources,...extraResources].map(w=>w.path);
      }
      for (const folder of roots) await walk(folder);
      return signal.aborted ? [] : results;
    } finally { if (this.active.get(token) === controller) this.active.delete(token); }
  }
}
module.exports = { LibrarySearch };
