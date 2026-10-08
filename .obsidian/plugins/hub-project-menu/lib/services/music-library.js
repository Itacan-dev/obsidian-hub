"use strict";
const fs = require("fs");
const nodePath = require("path");
const { musicProvider, musicDefaults, normalizeMusicConfig, createMusicItem, safeArtwork } = require("../domain/music");

class MusicLibrary {
    constructor(plugin, options = {}) {
        this.plugin = plugin; this.app = plugin.app; this.options = options;
        this.listeners = new Set(); this.queue = Promise.resolve(); this.disposed = false;
        this.compatibilityError = null; this.state;
    }
    get state() {
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
        const data = this.plugin.projectWizard.data, previous = data.music;
        data.music = next;
        try { await this.plugin.dataStore.save(data); this.plugin.projectWizard.data.music = next; }
        catch (error) {
            if (data.music === next) { if (previous === undefined) delete data.music; else data.music = previous; }
            throw error;
        }
        this.emit(); return next;
    }
    setEnabled(enabled) { return this.enqueue(() => this.save({ ...this.state, enabled: !!enabled })); }
    setProviderEnabled(provider, enabled) {
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
