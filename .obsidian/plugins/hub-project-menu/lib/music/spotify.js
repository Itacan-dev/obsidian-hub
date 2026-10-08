"use strict";
const { MusicProvider, cancelled } = require("./provider-base");
const { SpotifyEmbedBackend } = require("./spotify-embed");
const { normalizeMusicSource, safeArtwork } = require("../domain/music");

// Official Spotify Embed backend retained for standalone Itacan. Obsidian's
// Electron runtime lacks usable Widevine and receives preview-only playback;
// this prototype chooses Spotify Connect directly, without an Embed fallback.
class SpotifyProvider extends MusicProvider {
    constructor(plugin, item, options = {}) {
        if (options.spotifyBackend === "embed") return new SpotifyEmbedBackend(plugin, item, options);
        super(plugin, item, options, { persistent: true });
        this.service = plugin.spotifyConnect;
        this.restoreVolumeOnLoad = false;
        this.uri = normalizeMusicSource("spotify", item.source).metadata.uri;
        this.visible = false; this.loaded = false; this.startedItem = false;
        this.ownsPlayback = false; this.command = Promise.resolve();
        this.now = options.now ?? (() => Date.now());
        this.connected = !!this.service?.snapshot.connected;
        if (this.service) this.cleanups.push(this.service.onChange(() => {
            const connected = !!this.service.snapshot.connected;
            // State reads also notify service listeners; only auth transitions
            // need another query here.
            if (connected === this.connected) return;
            this.connected = connected;
            if (!connected) {
                this.stopTimers(); this.updateCapabilities(null);
                this.error("Connect Spotify in Settings to play your saved music.");
            } else if (this.visible) {
                this.loaded = true;
                void this.sync().then(() => this.startTimers()).catch(error => this.error(error.message));
            }
        }));
        this.listen(this.document, "visibilitychange", () => {
            if (!this.document.hidden && this.visible && this.loaded) {
                void this.sync().then(() => this.startTimers()).catch(error => this.error(error.message));
            } else this.stopTimers();
        });
    }
    mount() {
        this.visible = true;
        if (this.loaded && this.connected) void this.sync().then(() => this.startTimers()).catch(error => this.error(error.message));
    }
    detach() { this.visible = false; this.stopTimers(); }
    async load() {
        this.emit({ status: "loading", title: this.item.name, message: "" });
        if (!this.service || !this.connected) throw new Error("Connect Spotify in Settings to play your saved music.");
        this.loaded = true; await this.active(this.sync()); this.startTimers();
    }
    updateCapabilities(state) {
        const connected = !!this.service?.snapshot.connected, device = state?.device;
        const usable = device && !device.is_restricted, disallows = state?.actions?.disallows ?? {};
        Object.assign(this.capabilities, {
            play: connected && (!this.startedItem || !disallows.resuming),
            pause: connected && !!usable && !disallows.pausing,
            previous: connected && !!usable && !!state?.item && !disallows.skipping_prev,
            next: connected && !!usable && !!state?.item && !disallows.skipping_next,
            seek: connected && !!usable && !!state?.item && !disallows.seeking,
            volume: connected && !!usable && device.supports_volume === true,
            progress: connected && !!state?.item
        });
    }
    async sync() {
        if (this.destroyed || !this.connected) return;
        if (this.syncing) return this.syncing;
        this.syncing = (async () => {
            const state = await this.service.getPlaybackState();
            if (this.destroyed) return;
            const track = state?.item;
            if (state?.context?.uri === this.uri || track?.uri === this.uri) this.startedItem = true;
            this.updateCapabilities(state); this.receivedAt = this.now(); this.remoteState = state;
            this.emit({
                status: state ? state.is_playing ? "playing" : "paused" : "ready",
                title: this.item.name, trackTitle: track?.name || "",
                artist: (track?.artists ?? []).map(artist => artist.name).filter(Boolean).join(", "),
                artwork: safeArtwork(track?.album?.images?.[0]?.url) || safeArtwork(track?.images?.[0]?.url) || "",
                currentTime: Math.max(0, Number(state?.progress_ms) || 0) / 1000,
                duration: Math.max(0, Number(track?.duration_ms) || 0) / 1000,
                ...(Number.isFinite(state?.device?.volume_percent) ? { volume: state.device.volume_percent / 100 } : {}),
                message: state ? "" : "Open Spotify on a device, then press Play."
            });
            return state;
        })().finally(() => { this.syncing = null; });
        return this.syncing;
    }
    startTimers() {
        this.stopTimers();
        if (this.destroyed || !this.visible || this.document.hidden || !this.connected) return;
        const poll = async () => {
            if (this.destroyed || !this.visible || this.document.hidden) return;
            let wait = 5000;
            try { await this.sync(); }
            catch (error) { this.error(error.message); wait = Math.max(wait, error.retryAfterMs || 0); }
            if (!this.destroyed && this.visible && !this.document.hidden) this.pollTimer = setTimeout(poll, wait);
        };
        this.pollTimer = setTimeout(poll, 5000);
        this.progressTimer = setInterval(() => {
            if (!this.remoteState?.is_playing || !this.remoteState.item) return;
            const duration = Number(this.remoteState.item.duration_ms) / 1000;
            const currentTime = Math.min(duration, ((Number(this.remoteState.progress_ms) || 0) + this.now() - this.receivedAt) / 1000);
            this.emit({ currentTime: Math.max(0, currentTime) });
        }, 1000);
        this.pollTimer.unref?.(); this.progressTimer.unref?.();
    }
    stopTimers() {
        clearTimeout(this.pollTimer); clearInterval(this.progressTimer);
        this.pollTimer = this.progressTimer = null;
    }
    perform(method, ...args) {
        const operation = this.command.catch(() => {}).then(async () => {
            if (this.destroyed) throw cancelled();
            // A lost response may still have applied the remote command.
            if (["startItem", "resume", "previous", "next"].includes(method)) this.ownsPlayback = true;
            await this.service[method](...args);
            if (method === "startItem") this.startedItem = true;
            if (method === "pause") this.ownsPlayback = false;
            if (!this.destroyed) await this.sync();
        });
        this.command = operation;
        return this.active(operation);
    }
    play() { return this.perform(this.startedItem ? "resume" : "startItem", ...(this.startedItem ? [] : [this.item])); }
    pause() { return this.perform("pause"); }
    previous() { return this.perform("previous"); }
    next() { return this.perform("next"); }
    seek(seconds) { return this.perform("seek", seconds); }
    setVolume(value) {
        // Slider drags retain only the latest value while a request is pending.
        this.pendingVolume = value;
        if (!this.volumeTask) {
            this.volumeTask = (async () => {
                while (this.pendingVolume !== undefined && !this.destroyed) {
                    const requested = this.pendingVolume; this.pendingVolume = undefined;
                    await this.perform("setVolume", requested);
                }
            })().finally(() => { this.volumeTask = null; });
        }
        return this.volumeTask;
    }
    suspend() {
        this.detach(); this.pendingVolume = undefined;
        // requestUrl is not abortable. Wait for any in-flight playback write
        // before the final pause, even after destroy cancels the UI operation.
        return this.command.catch(() => {}).then(async () => {
            if (this.ownsPlayback) {
                if (!this.service?.snapshot.connected) throw new Error("Connect Spotify in Settings, then try switching music again so Spotify can be paused.");
                await this.service.pause();
            }
            this.ownsPlayback = false;
        });
    }
    destroy() {
        if (this.destroyed) return;
        this.detach(); super.destroy();
    }
}

module.exports = { SpotifyProvider, SpotifyEmbedBackend };
