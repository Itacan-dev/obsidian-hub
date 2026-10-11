"use strict";
const { MusicProvider, clamp } = require("./provider-base");
const { loadIframeAPI } = require("./iframe-api");

const errors = {
    2: "This YouTube link is invalid. Check it in Settings → Music.",
    5: "YouTube could not play this video in Obsidian.",
    100: "This YouTube video is unavailable or private.",
    101: "This video does not allow embedded playback.",
    150: "This video does not allow embedded playback.",
    153: "YouTube could not verify this Obsidian embed. Playback is unavailable in this runtime."
};

class YouTubeProvider extends MusicProvider {
    constructor(plugin, item, options) {
        const url = new URL(item.source), playlistId = item.metadata?.playlistId || url.searchParams.get("list");
        super(plugin, item, options, { play: true, pause: true, seek: true, volume: true, progress: true,
            previous: !!playlistId, next: !!playlistId, visiblePlayer: true });
        this.videoId = item.metadata?.videoId || url.searchParams.get("v"); this.playlistId = playlistId;
        this.startSeconds = Number(item.metadata?.startSeconds) || 0;
        this.element.classList.add("hub-music-youtube-surface");
    }
    async load() {
        this.emit({ status: "loading", title: this.item.name });
        const api = await this.active(this.options.youtubeAPI || loadIframeAPI(this.document, "youtube"));
        const host = this.document.createElement("div"); this.element.appendChild(host);
        const ready = this.readyPromise("The YouTube player could not load. Check your connection and try again.");
        const vars = { controls: 1, playsinline: 1, autoplay: 0, rel: 0, start: this.startSeconds };
        if (this.playlistId) { vars.listType = "playlist"; vars.list = this.playlistId; }
        const origin = this.document.defaultView.location?.origin;
        if (/^https?:\/\//.test(origin || "")) vars.origin = origin;
        // Official player, controls and branding stay visible. No background
        // playback or unofficial media extraction is used.
        // https://developers.google.com/youtube/iframe_api_reference
        this.player = new api.Player(host, { width: "100%", height: "270", ...(this.videoId ? { videoId: this.videoId } : {}),
            playerVars: vars, events: {
                onReady: event => {
                    if (this.destroyed) { event.target.destroy(); return; }
                    this.player = event.target;
                    if (this.playlistId && !this.videoId) this.player.cuePlaylist({ listType: "playlist", list: this.playlistId, startSeconds: this.startSeconds });
                    this.emit({ status: "ready", message: "" }); this.resolveReady(); this.updateProgress();
                },
                onStateChange: event => {
                    if (this.destroyed) return;
                    const statuses = { "-1": "ready", 0: "ended", 1: "playing", 2: "paused", 3: "loading", 5: "ready" };
                    this.emit({ status: statuses[event.data] || "ready", ...(event.data === 1 ? { message: "" } : {}) });
                    this.updateProgress();
                    if (event.data === 0 && !this.playlistId) this.options.onEnded?.();
                },
                onError: event => {
                    const message = errors[event.data] || "YouTube could not load this video or playlist.";
                    this.rejectReady?.(new Error(message)); this.error(message);
                },
                onAutoplayBlocked: () => this.emit({ status: "paused", message: "Press Play in the YouTube player to start playback." })
            } });
        const frame = this.player.getIframe?.();
        if (frame) { frame.title = "YouTube music player"; frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin"); }
        await this.active(ready);
        const timer = setInterval(() => this.updateProgress(), 500); timer.unref?.();
        this.cleanups.push(() => clearInterval(timer));
        this.listen(this.document, "visibilitychange", () => { if (this.document.hidden) this.suspend(); });
        // Focusing the embedded player's own controls blurs its parent window.
        // Document visibility and modal lifetime determine visible playback.
    }
    updateProgress() {
        if (this.destroyed || !this.player?.getCurrentTime) return;
        try { this.emit({ currentTime: Number(this.player.getCurrentTime()) || 0, duration: Number(this.player.getDuration()) || 0,
            volume: clamp(this.player.getVolume() / 100) }); } catch (_) { /* A frame may be initializing. */ }
    }
    play() {
        if (this.destroyed || !this.player) return;
        if (!this.element.isConnected || this.document.hidden) { this.emit({ status: "paused", message: "Keep Music open to play YouTube." }); return; }
        this.player.playVideo();
    }
    pause() { if (!this.destroyed) this.player?.pauseVideo?.(); }
    previous() { if (!this.destroyed && this.playlistId) this.player?.previousVideo?.(); }
    next() { if (!this.destroyed && this.playlistId) this.player?.nextVideo?.(); }
    seek(seconds) { if (!this.destroyed) this.player?.seekTo?.(Math.max(0, Number(seconds) || 0), true); }
    setVolume(value) { if (!this.destroyed) this.player?.setVolume?.(Math.round(clamp(value) * 100)); }
    suspend() { this.pause(); this.emit({ status: "paused", message: "YouTube pauses when Music closes." }); }
    destroy() {
        if (this.destroyed) return;
        this.player?.pauseVideo?.(); super.destroy(); this.player?.destroy?.(); this.player = null;
    }
}

module.exports = { YouTubeProvider };
