"use strict";
const fs = require("fs").promises, path = require("path"), { randomUUID } = require("crypto");
const { DEFAULT_PREFERENCES, DEFAULT_DOCK, normalizePreferences, resolvePalette } = require("../ui/color-palettes");
// Appearance owns only this file. Never save plugin data or shared project snapshots.
class AppearanceService {
    constructor({ file, colors = require("../ui/color-system"), io = fs, onError = () => {} }) {
        this.file=file; this.colors=colors; this.io=io; this.onError=onError;
        this.value={...DEFAULT_PREFERENCES}; this.confirmed=this.value; this.diskRaw=null;
        this.listeners=new Set(); this.documents=new Map(); this.queue=Promise.resolve();
        this.sequence=0; this.pending=0; this.available=!!file; this.error=""; this.closed=false; this.dock=null;
    }
    snapshot() { return { ...this.value, available:this.available && !this.closed, pending:this.pending>0, error:this.error }; }
    subscribe(listener) { this.listeners.add(listener); listener(this.snapshot()); return () => this.listeners.delete(listener); }
    emit() { for(const listener of this.listeners) listener(this.snapshot()); }
    async read() { try { return await this.io.readFile(this.file,"utf8"); } catch(error) { if(error.code==="ENOENT") return null; throw error; } }
    decode(raw) {
        if(raw===null) return {...DEFAULT_PREFERENCES};
        const data=JSON.parse(raw); if(!data || Array.isArray(data)) throw Error("Invalid Appearance preferences");
        return normalizePreferences(data);
    }
    async initialize() {
        if(this.file) try { const raw=await this.read(); this.value=this.decode(raw); this.confirmed=this.value; this.diskRaw=raw; }
        catch(error) { this.available=false; this.error="Saved colors could not be read. The preference file was preserved."; }
        else this.error="Color preferences are unavailable in this environment.";
        this.apply(); return this;
    }
    apply() { if(this.closed) return; this.contract=resolvePalette(this.value); this.revision=this.colors.applyResolvedColors(this.contract); this.updateDock(); this.emit(); }
    attachDocument(doc) {
        if(this.documents.has(doc)) return;
        this.colors.attachColorDocument(doc);
        const focus=()=>{ void this.refresh(); }, mode=()=>{ this.updateDock(); this.emit(); };
        const dispose=()=>{ doc.defaultView.removeEventListener("focus",focus); doc.removeEventListener("hub-color-mode-change",mode); doc.defaultView.removeEventListener("pagehide",dispose); this.documents.delete(doc); };
        doc.defaultView.addEventListener("focus",focus); doc.addEventListener("hub-color-mode-change",mode); doc.defaultView.addEventListener("pagehide",dispose);
        this.documents.set(doc,dispose);
    }
    connectDock(setColors, doc) { this.dock={setColors,doc}; this.updateDock(); }
    updateDock() {
        if(!this.dock) return;
        const dock=this.dock.doc.body.classList.contains("theme-dark") ? this.contract.dock : DEFAULT_DOCK;
        try { this.dock.setColors({version:1, revision:this.revision, colors:{...dock}}); }
        catch(error) { this.onError("The dock could not receive the selected colors. Its Oath remains active."); }
    }
    set(next) {
        if(!this.available || this.closed) return Promise.resolve(false);
        const value=normalizePreferences({version:1,paletteId:next.paletteId,coordinateInterfaceColors:next.coordinateInterfaceColors});
        const sequence=++this.sequence; this.value=value; this.pending++; this.error=""; this.apply();
        const work=async()=>{
            try {
                if(!this.available) throw Error("Appearance storage is unavailable");
                const raw=await this.read();
                if(raw!==this.diskRaw) { this.available=false; throw Error("Color preferences changed outside this window. Reopen Itacan before changing them again."); }
                const text=JSON.stringify(value,null,2)+"\n", temporary=this.file+"."+randomUUID()+".tmp";
                let handle;
                try { handle=await this.io.open(temporary,"wx"); await handle.writeFile(text,"utf8"); await handle.sync(); await handle.close(); handle=null; await this.io.rename(temporary,this.file); }
                catch(error) {
                    // A failed response can follow successful publication. Reconcile exact bytes.
                    const observed=await this.read().catch(()=>undefined);
                    if(observed!==text) throw error;
                } finally { if(handle) await handle.close().catch(()=>{}); await this.io.unlink(temporary).catch(()=>{}); }
                if(await this.read()!==text) { this.available=false; throw Error("Saved colors could not be verified."); }
                this.diskRaw=text; this.confirmed=value; return true;
            } catch(error) {
                if(sequence===this.sequence) { this.value=this.confirmed; this.error=error.message || "Colors could not be saved."; this.apply(); if(!this.closed) this.onError(this.error); }
                return false;
            } finally { this.pending--; this.emit(); }
        };
        this.queue=this.queue.then(work,work); return this.queue;
    }
    refresh() {
        if(this.closed || !this.file || this.pending || !this.available) return this.queue;
        const work=async()=>{
            if(this.closed || this.pending) return;
            try { const raw=await this.read(); if(raw!==this.diskRaw) { this.value=this.decode(raw); this.confirmed=this.value; this.diskRaw=raw; this.apply(); } }
            catch(error) { this.available=false; this.error="Saved colors could not be read. The preference file was preserved."; this.emit(); }
        };
        this.queue=this.queue.then(work,work); return this.queue;
    }
    destroy() { this.closed=true; this.dock=null; for(const dispose of [...this.documents.values()]) dispose(); this.listeners.clear(); return this.queue; }
}
function appearanceFile(plugin) {
    const base=plugin.app.vault.adapter.getBasePath?.(); if(!base) return null;
    const directory=plugin.manifest.dir || `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`;
    return path.join(path.isAbsolute(directory)?directory:path.join(base,directory),"appearance.json");
}
module.exports={AppearanceService,appearanceFile};
