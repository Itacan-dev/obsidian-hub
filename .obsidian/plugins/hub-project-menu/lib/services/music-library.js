"use strict";
const fs = require("fs");
const nodePath = require("path");
const { musicProvider, musicDefaults, normalizeMusicConfig, createMusicItem, safeArtwork } = require("../domain/music");

const preferenceQueue = Symbol("Music preferences queue");
const preferenceRun = Symbol("Music preference action");
const preferencePublish = Symbol("Music preference read");
const preferenceData = new WeakMap();
const preferenceCopy = value => value == null ? value : require("./application-storage/codec").copy(value);
function preferenceError(code) { const error = Error(code); error.code = code; return error; }
class MusicLibrary {
    constructor(plugin, options = {}) {
        this.plugin = plugin; this.app = plugin.app; this.options = options;
        this.listeners = new Set(); this.queue = Promise.resolve(); this.disposed = false;
        this.compatibilityError = null;
        if (options.transactionalPreferences !== undefined) {
            const port = options.transactionalPreferences;
            if (!port || !["read", "prepare", "submit", "reconcile"].every(key => typeof port[key] === "function")) throw preferenceError("MUSIC_PREFERENCES_CONTRACT");
            preferenceData.set(this, { port, readiness: "unavailable", prepared: null, outcome: null });
        } else this.state;
    }
    get state() {
        const preferences = preferenceData.get(this);
        if (preferences && preferences.readiness !== "ready") throw preferenceError("MUSIC_PREFERENCES_UNAVAILABLE");
        try { const state = normalizeMusicConfig(this.plugin.projectWizard.data.music); this.compatibilityError = null; return state; }
        catch (error) {
            // A future library must remain untouched and must not prevent Home,
            // Settings or other services from loading in this older prototype.
            this.compatibilityError = error.message; return musicDefaults();
        }
    }
    get(id) { return this.state.items.find(item => item.id === id) ?? null; }
    list({ enabledOnly = false } = {}) {
        const state = this.state;
        return enabledOnly ? state.items.filter(item => state.enabled && state.providers[item.provider] && item.enabled) : state.items;
    }
    onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    emit() { for (const listener of this.listeners) { try { listener(this.state); } catch (error) { console.error("Could not refresh Music", error); } } }
    enqueue(work) {
        if (preferenceData.has(this)) return Promise.reject(preferenceError("MUSIC_MUTATION_NOT_ADOPTED"));
        const result = this.queue.catch(() => {}).then(async () => {
            if (this.disposed) throw Error("Music is no longer available.");
            await this.plugin.dataStore.writeQueue?.catch(() => {});
            this.state;
            if (this.compatibilityError) throw Error(this.compatibilityError);
            return work();
        });
        this.queue = result; return result;
    }
    async save(next) {
        if (preferenceData.has(this)) throw preferenceError("MUSIC_MUTATION_NOT_ADOPTED");
        const data = this.plugin.projectWizard.data, previous = data.music;
        data.music = next;
        try { await this.plugin.dataStore.save(data); this.plugin.projectWizard.data.music = next; }
        catch (error) {
            if (data.music === next) { if (previous === undefined) delete data.music; else data.music = previous; }
            throw error;
        }
        this.emit(); return next;
    }
    [preferenceQueue](work) {
        const result = this.queue.catch(() => {}).then(async () => {
            if (this.disposed) throw preferenceError("MUSIC_DISPOSED");
            return work();
        });
        this.queue = result; return result;
    }
    getPreferenceStatus() {
        const p = preferenceData.get(this);
        return p ? preferenceCopy({ readiness: this.disposed ? "disposed" : p.readiness, prepared: p.prepared, outcome: p.outcome }) : null;
    }
    async refreshPreferences() {
        return this[preferenceQueue](async () => {
            const p = preferenceData.get(this);
            if (!p) throw preferenceError("MUSIC_PREFERENCES_NOT_SELECTED");
            if (p.prepared && !["committed", "replayed", "cancelled"].includes(p.outcome?.status)) throw preferenceError("MUSIC_PREFERENCE_REVIEW_REQUIRED");
            await this[preferencePublish](p); return this.state;
        });
    }
    async [preferencePublish](p) {
        p.readiness = "unavailable";
        try {
            const current = await p.port.read();
            if (this.disposed) return;
            // Read current authority, never an operation's historical result.
            const next = current.field.present ? preferenceCopy(current.field.value) : musicDefaults();
            this.plugin.projectWizard.data.music = next;
            p.readiness = "ready"; this.emit();
        } catch (_) { if (!this.disposed) p.readiness = "unavailable"; }
    }
    async [preferenceRun](intent, prepared = null, reconcile = false, signal) {
        const p = preferenceData.get(this);
        if (!p) throw preferenceError("MUSIC_PREFERENCES_NOT_SELECTED");
        if (!prepared) {
            if (p.prepared && !["committed", "replayed", "cancelled"].includes(p.outcome?.status)) throw preferenceError("MUSIC_PREFERENCE_REVIEW_REQUIRED");
            let original;
            try { original = await p.port.read(); } catch (error) { p.readiness = "unavailable"; throw error; }
            if (this.disposed) throw preferenceError("MUSIC_DISPOSED");
            prepared = p.port.prepare(intent, original);
        } else if (p.prepared && p.prepared.request.operationId !== prepared.request?.operationId && !["committed", "replayed", "cancelled"].includes(p.outcome?.status)) {
            throw preferenceError("MUSIC_PREFERENCE_REVIEW_REQUIRED");
        }
        if (!p.prepared || p.prepared.request.operationId !== prepared.request.operationId) p.prepared = preferenceCopy(prepared);
        p.readiness = "unavailable";
        p.outcome = null;
        let outcome;
        try { outcome = await (reconcile ? p.port.reconcile(prepared) : p.port.submit(prepared, signal)); }
        catch (_) { outcome = { version: 1, privacy: "local-private", status: "uncertain", code: "MUSIC_RESPONSE_UNAVAILABLE", operationId: prepared.request.operationId }; }
        if (this.disposed) return outcome;
        p.outcome = preferenceCopy(outcome);
        if (["committed", "replayed"].includes(outcome.status)) await this[preferencePublish](p);
        else p.readiness = "blocked";
        return outcome;
    }
    reconcilePreferences(prepared = this.getPreferenceStatus()?.prepared) {
        const original = preferenceCopy(prepared);
        return this[preferenceQueue](() => this[preferenceRun](null, original, true));
    }
    replayPreferences(prepared = this.getPreferenceStatus()?.prepared, signal) {
        const original = preferenceCopy(prepared);
        return this[preferenceQueue](() => this[preferenceRun](null, original, false, signal));
    }
    setEnabled(enabled) {
        if (preferenceData.has(this)) return this[preferenceQueue](() => this[preferenceRun]({ kind: "set-enabled", enabled: !!enabled }));
        return this.enqueue(() => this.save({ ...this.state, enabled: !!enabled }));
    }
    setProviderEnabled(provider, enabled) {
        if (preferenceData.has(this)) return this[preferenceQueue](() => this[preferenceRun]({ kind: "set-provider-enabled", provider, enabled: !!enabled }));
        return this.enqueue(() => {
            if (!musicProvider(provider)) throw Error("Unknown music source.");
            const state = this.state;
            return this.save({ ...state, providers: { ...state.providers, [provider]: !!enabled } });
        });
    }
    required(id) { const item = this.get(id); if (!item) throw Error("This music item is no longer available."); return item; }
    update(id, values) {
        return this.enqueue(() => {
            const item = this.required(id), name = values.name === undefined ? item.name : String(values.name).trim();
            if (!name) throw Error("Enter a display name.");
            const next = { ...item, name, enabled: values.enabled === undefined ? item.enabled : !!values.enabled };
            return this.save({ ...this.state, items: this.state.items.map(candidate => candidate.id === id ? next : candidate) });
        });
    }
    rename(id, name) { return this.update(id, { name }); }
    setItemEnabled(id, enabled) { return this.update(id, { enabled }); }
    remove(id) {
        return this.enqueue(() => { this.required(id); return this.save({ ...this.state, items: this.state.items.filter(item => item.id !== id) }); });
    }
    move(id, delta) {
        return this.enqueue(() => {
            const state = this.state, items = [...state.items], from = items.findIndex(item => item.id === id);
            if (from < 0) throw Error("This music item is no longer available.");
            const to = Math.max(0, Math.min(items.length - 1, from + Math.trunc(Number(delta) || 0)));
            if (to === from) return state;
            items.splice(to, 0, items.splice(from, 1)[0]); return this.save({ ...state, items });
        });
    }
    reorder(ids) {
        return this.enqueue(() => {
            const state = this.state, requested = Array.isArray(ids) ? ids : [];
            if (requested.length !== state.items.length || new Set(requested).size !== requested.length || requested.some(id => !state.items.some(item => item.id === id))) {
                throw Error("The music library changed. Try reordering again.");
            }
            return this.save({ ...state, items: requested.map(id => state.items.find(item => item.id === id)) });
        });
    }
    async metadata(item) {
        if (this.options.metadata === false || item.provider === "local") return {};
        let request = this.options.request;
        if (!request) { try { request = require("obsidian").requestUrl; } catch (_) { return {}; } }
        if (!request) return {};
        // Official oEmbed needs no account or OAuth. Never insert returned HTML.
        // https://developer.spotify.com/documentation/embeds/reference/oembed
        const endpoint = item.provider === "spotify" ? "https://open.spotify.com/oembed?url=" : "https://www.youtube.com/oembed?format=json&url=";
        const source = item.provider === "youtube-music" ? item.source.replace("music.youtube.com", "www.youtube.com") : item.source;
        let timer;
        try {
            const response = await Promise.race([request({ url: endpoint + encodeURIComponent(source), throw: false }),
                new Promise(resolve => { timer = setTimeout(() => resolve(null), 3500); })]);
            const metadata = response?.json;
            return response?.status === 200 && metadata ? { ...(typeof metadata.title === "string" && metadata.title.trim() ? { name: metadata.title.trim() } : {}),
                ...(safeArtwork(metadata.thumbnail_url) ? { artwork: safeArtwork(metadata.thumbnail_url) } : {}) } : {};
        } catch (_) { return {}; } // Metadata is optional; unavailable links still save.
        finally { clearTimeout(timer); }
    }
    async add(values) {
        if (preferenceData.has(this)) throw preferenceError("MUSIC_MUTATION_NOT_ADOPTED");
        const item = createMusicItem(values);
        if (item.provider === "local") await this.assertLocalSource(item.source);
        const metadata = await this.metadata(item);
        Object.assign(item, metadata);
        if (String(values.name ?? "").trim()) item.name = String(values.name).trim();
        return this.enqueue(async () => { await this.save({ ...this.state, items: [...this.state.items, item] }); return item; });
    }
    sourcePath(source) {
        if (typeof source === "string") return source;
        if (this.plugin.inbox?.sourcePath) return this.plugin.inbox.sourcePath(source);
        if (typeof source?.path === "string" && source.path) return source.path;
        try { return require("electron").webUtils?.getPathForFile(source) || null; } catch (_) { return null; }
    }
    localReference(source) {
        const path = this.sourcePath(source);
        if (!path) throw Error("The file picker did not provide a local path. Choose the audio file again on desktop.");
        const base = this.app.vault.adapter?.getBasePath?.();
        if (base && nodePath.isAbsolute(path)) {
            const relative = nodePath.relative(base, path);
            if (relative && !relative.startsWith("..") && !nodePath.isAbsolute(relative)) {
                const file = this.app.vault.getAbstractFileByPath(relative.replace(/\\/g, "/"));
                if (file && !Array.isArray(file.children)) return file.path;
            }
        }
        return path;
    }
    async assertLocalSource(source) {
        const file = this.app.vault.getAbstractFileByPath(source);
        if (file && !Array.isArray(file.children)) return;
        if (!nodePath.isAbsolute(source) && !nodePath.win32.isAbsolute(source)) throw Error(`"${source}" is no longer available in the vault.`);
        try { await fs.promises.access(source, fs.constants.R_OK); if (!(await fs.promises.stat(source)).isFile()) throw Error("Not a file"); }
        catch (_) { throw Error(`"${source.split(/[\\/]/).pop()}" cannot be read. Choose an available audio file.`); }
    }
    addLocalFiles(sources) {
        return this.enqueue(async () => {
            if (!sources?.length) throw Error("Choose one or more audio files.");
            const items = Array.from(sources).map(source => createMusicItem({ provider: "local", source: this.localReference(source) }));
            // Validate the complete selection before writing any references.
            for (const item of items) await this.assertLocalSource(item.source);
            await this.save({ ...this.state, items: [...this.state.items, ...items] }); return items;
        });
    }
    destroy() { this.disposed = true; this.listeners.clear(); }
}
module.exports = { MusicLibrary };
