"use strict";

const { createMusicProvider } = require("../music/providers");

// Playback belongs to the plugin, never to a Modal. Only durable references
// live in MusicLibrary; these handles and progress are intentionally transient.
class MusicController {
    constructor(plugin, library, options = {}) {
        this.plugin = plugin; this.library = library;
        this.factory = options.createProvider ?? createMusicProvider;
        this.document = options.document ?? globalThis.document;
        this.listeners = new Set(); this.generation = 0; this.disposed = false;
        this.surface = null; this.provider = null; this.itemId = null; this.releasing = null;
        this.state = { status: "idle", currentTime: 0, duration: 0, volume: 1, message: "" };
        this.stopLibrary = library.onChange(() => this.reconcile());
    }
    get item() { return this.library.get(this.itemId); }
    get entries() { return this.library.list({ enabledOnly: true }); }
    get snapshot() {
        const item = this.item;
        const capabilities = { ...(this.provider?.capabilities ?? {}) };
        if (item?.provider === "local") {
            const queue = this.entries.filter(entry => entry.provider === "local");
            const index = queue.findIndex(entry => entry.id === item.id);
            capabilities.previous = index > 0; capabilities.next = index >= 0 && index < queue.length - 1;
        }
        return { ...this.state, item, title: this.state.trackTitle || this.state.title || item?.name || "", capabilities };
    }
    onChange(callback) { this.listeners.add(callback); return () => this.listeners.delete(callback); }
    emit() {
        if (this.disposed) return;
        const state = this.snapshot;
        for (const callback of this.listeners) callback(state);
    }
    update(patch) { this.state = { ...this.state, ...patch }; this.emit(); }
    attach(surface) {
        if (this.disposed) return;
        this.surface = surface;
        this.document = surface.ownerDocument;
        if (this.provider) this.provider.mount(surface);
        else if (this.itemId && this.entries.some(item => item.id === this.itemId)) {
            // Visible streaming players were released on close. Reconnect without
            // autoplay; local playback retains the exact same adapter/audio node.
            void this.select(this.itemId, { autoplay: false, resumeAt: this.state.currentTime });
        }
        this.emit();
    }
    detach(surface) {
        if (surface && this.surface !== surface) return;
        this.surface = null;
        if (!this.provider) return;
        if (this.provider.capabilities.persistent) {
            // Remote providers stop visible polling; local audio keeps playing.
            this.provider.detach?.();
            this.provider.element?.remove();
            return;
        }
        void this.release().catch(error => this.update({ status: "error", message: error.message }));
        if (this.itemId) this.update({ status: "paused" });
    }
    release() {
        ++this.generation;
        const previous = this.provider; this.provider = null;
        if (!previous && this.releasing?.pending) return this.releasing.promise;
        const target = previous || this.releasing?.provider;
        if (!target) return Promise.resolve();
        // Destruction also cancels pending SDK loads, so a late ready callback
        // cannot resurrect a player after a switch, close or feature disable.
        // Keep a failed remote pause available for retry. A replacement source
        // must not start while the previously owned source may still be playing.
        const record = { provider: target, pending: true };
        this.releasing = record;
        let stopping;
        try { stopping = target.suspend?.(); } catch (error) { stopping = Promise.reject(error); }
        try { target.destroy(); } catch (error) { console.warn("Could not release Music player", error); }
        record.promise = Promise.resolve(stopping).then(() => {
            if (this.releasing === record) this.releasing = null;
        }, error => { record.pending = false; throw error; });
        // Some releases happen without a selection (disable/unload).
        record.promise.catch(() => {});
        return record.promise;
    }
    async select(id, { autoplay = true, resumeAt = 0 } = {}) {
        if (this.disposed) return;
        const item = this.entries.find(entry => entry.id === id);
        if (!this.library.state.enabled || !item) return;
        if (this.provider && this.itemId === id && this.state.status !== "error") {
            if (autoplay) await this.play();
            return;
        }
        const stopping = this.release(); this.itemId = id;
        const generation = this.generation;
        const requestedVolume = this.state.volume;
        this.state = { status: "loading", currentTime: 0, duration: 0, volume: requestedVolume, message: "", title: item.name };
        const current = () => !this.disposed && generation === this.generation;
        this.emit();
        try {
            await stopping;
            if (!current()) return;
            const provider = this.factory(this.plugin, item, {
                document: this.document,
                onState: patch => { if (current()) this.update(patch); },
                onError: message => { if (current()) this.update({ status: "error", message }); },
                onEnded: () => { if (current()) void this.ended(); }
            });
            this.provider = provider;
            if (!this.surface && !provider.capabilities.persistent) {
                void this.release().catch(error => this.update({ status: "error", message: error.message }));
                this.update({ status: "paused" }); return;
            }
            if (this.surface) provider.mount(this.surface);
            this.emit();
            await provider.load();
            if (!current()) return;
            // Initial metadata reports the new player's default volume. Preserve
            // the user's level across track switches and automatic queue advance.
            if (provider.capabilities.volume && provider.restoreVolumeOnLoad !== false) {
                // Native volumechange arrives asynchronously. Update the intent
                // now so an immediate next/previous command also retains it.
                this.update({ volume: requestedVolume });
                await provider.setVolume(requestedVolume);
            }
            if (!current()) return;
            if (resumeAt > 0 && provider.capabilities.seek) await provider.seek(resumeAt);
            if (!current()) return;
            if (autoplay && provider.capabilities.play) await provider.play();
        } catch (error) {
            if (current()) this.update({ status: "error", message: error.message || "This music could not be played. Try again or check its source in Settings." });
        }
    }
    async call(method, ...args) {
        const provider = this.provider, generation = this.generation;
        if (!provider || this.disposed) return;
        try { await provider[method]?.(...args); }
        catch (error) { if (generation === this.generation) this.update({ status: "error", message: error.message || "The player is unavailable. Try selecting this music again." }); }
    }
    play() {
        if (this.itemId && (!this.provider || this.state.status === "error")) return this.select(this.itemId, { resumeAt: this.state.currentTime });
        return this.call("play");
    }
    pause() { return this.call("pause"); }
    toggle() { return this.state.status === "playing" ? this.pause() : this.play(); }
    seek(seconds) { if (Number.isFinite(seconds)) return this.call("seek", Math.max(0, seconds)); }
    setVolume(value) {
        if (!Number.isFinite(value)) return;
        value = Math.max(0, Math.min(1, value));
        this.state.volume = value;
        return this.call("setVolume", value);
    }
    async step(direction) {
        if (this.item?.provider !== "local") return this.call(direction < 0 ? "previous" : "next");
        const queue = this.entries.filter(item => item.provider === "local");
        const index = queue.findIndex(item => item.id === this.itemId), next = queue[index + direction];
        if (index >= 0 && next) await this.select(next.id);
    }
    previous() { return this.step(-1); }
    next() { return this.step(1); }
    async ended() {
        this.update({ status: "ended" });
        if (this.item?.provider === "local" && this.snapshot.capabilities.next) await this.next();
    }
    reconcile() {
        if (!this.library.state.enabled || this.itemId && !this.entries.some(item => item.id === this.itemId)) {
            const stopping = this.release(), generation = this.generation; this.itemId = null;
            stopping.catch(error => { if (generation === this.generation) this.update({ status: "error", message: error.message }); });
            this.state = { status: "idle", currentTime: 0, duration: 0, volume: this.state.volume, message: "" };
        } else if (this.item) this.state.title = this.item.name;
        this.emit();
    }
    destroy() {
        if (this.disposed) return;
        this.stopLibrary(); const stopping = this.release(); this.disposed = true;
        this.listeners.clear(); this.surface = null;
        return stopping;
    }
}

module.exports = { MusicController };
