"use strict";
const { MusicProvider } = require("./provider-base");
const { loadIframeAPI } = require("./iframe-api");

const runtimeMessage = "Spotify may play previews in Obsidian when encrypted playback is unavailable.";

class SpotifyEmbedBackend extends MusicProvider {
    constructor(plugin, item, options) {
        // Spotify documents play/pause and playback events. Its seek method is
        // documented for podcast episodes; configured music uses the Embed's
        // own supported seek/collection controls rather than invented APIs.
        super(plugin, item, options, { play: true, pause: true, progress: true, visiblePlayer: true });
        this.element.classList.add("hub-music-spotify-surface");
        this.playbackActive = false;
    }
    async load() {
        this.emit({ status: "loading", title: this.item.name, message: runtimeMessage });
        const api = await this.active(this.options.spotifyAPI || loadIframeAPI(this.document, "spotify"));
        const host = this.document.createElement("div"); this.element.appendChild(host);
        const ready = this.readyPromise("The Spotify embed could not load. Check your connection and try again.");
        // https://developer.spotify.com/documentation/embeds/references/iframe-api
        api.createController(host, { url: this.item.source, width: "100%", height: 352 }, controller => {
            if (this.destroyed) { controller.destroy(); return; }
            this.controller = controller;
            const onReady = () => { this.emit({ status: "ready", message: runtimeMessage }); this.resolveReady(); };
            const onUpdate = event => {
                if (this.destroyed) return;
                const data = event.data || {}, duration = (Number(data.duration) || 0) / 1000, currentTime = (Number(data.position) || 0) / 1000;
                this.playbackActive = data.isPaused === false;
                this.emit({ status: data.isBuffering ? "loading" : data.isPaused ? "paused" : "playing",
                    currentTime, duration, playingURI: data.playingURI,
                    message: duration > 0 && duration <= 30 ? "Spotify may be playing a preview in this Obsidian runtime." : runtimeMessage });
            };
            const onStarted = event => { this.playbackActive = true; this.emit({ status: "playing", playingURI: event.data?.playingURI }); };
            for (const [name, callback] of [["ready", onReady], ["playback_update", onUpdate], ["playback_started", onStarted]]) {
                controller.addListener(name, callback);
                this.cleanups.push(() => controller.removeListener?.(name, callback));
            }
            const frame = this.element.querySelector("iframe");
            if (frame) { frame.title = "Spotify music player"; frame.setAttribute("allow", "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"); }
        });
        await this.active(ready);
    }
    play() {
        if (!this.destroyed && this.element.isConnected && this.controller) {
            this.playbackActive = true; (this.controller.resume || this.controller.play)?.call(this.controller);
        }
    }
    pause() {
        if (!this.destroyed && this.playbackActive) { this.playbackActive = false; this.controller?.pause(); }
    }
    suspend() { this.pause(); this.emit({ status: "paused" }); }
    destroy() {
        if (this.destroyed) return;
        this.pause(); super.destroy(); this.controller?.destroy(); this.controller = null;
    }
}

module.exports = { SpotifyEmbedBackend };
