"use strict";
const { MusicProvider } = require("./provider-base");
const { configuredConsentDestination } = require("./browser-guard");

class YouTubeMusicProvider extends MusicProvider {
    constructor(plugin, item, options) {
        super(plugin, item, options, { visiblePlayer: true });
        this.element.classList.add("hub-music-youtube-music-surface");
    }
    async load() {
        const atlas = this.plugin.atlas, state = atlas?.view?.(), remote = this.document.defaultView.electron?.remote;
        if (!remote || !this.plugin.app.getWebviewPartition || state?.status !== "READY" || !state.enabled)
            throw new Error("YouTube Music needs the desktop Atlas browser. Set up Atlas, then reopen this item.");
        this.playbackMessage = this.item.sourceType === "album"
                ? "For album playback, save the album’s YouTube Music playlist link. Album pages can open here; playback stops when Music closes."
                : "Use the YouTube Music player below. Playback stops when Music closes.";
        this.emit({ status: "loading", title: this.item.name, message: this.playbackMessage });
        // Atlas already protects every webview in this existing Obsidian
        // partition. Keep the service's actual player; no scraping, injected
        // DOM controls, alternative session or hidden player is used.
        const webview = this.webview = this.document.createElement("webview");
        const partition = this.plugin.app.getWebviewPartition();
        webview.setAttribute("partition", partition); webview.setAttribute("src", "about:blank");
        webview.setAttribute("webpreferences", "contextIsolation=yes,sandbox=yes,nodeIntegration=no");
        webview.setAttribute("aria-label", "Configured YouTube Music player");
        const ready = this.readyPromise("YouTube Music could not load. Check Atlas access and your connection.");
        let attached = false;
        this.listen(webview, "dom-ready", () => {
            if (attached) return; attached = true;
            try {
                this.nativeId = webview.getWebContentsId();
                const path = require("path"), directory = path.resolve(this.plugin.app.vault.adapter.getBasePath(), this.plugin.manifest.dir);
                this.guard = remote.require(path.join(directory, "lib/music/browser-guard.js"))
                    .constrainMusicGuest(this.nativeId, partition, this.item.source, () => {
                        const message = "Music only opens the configured YouTube Music content. Choose the saved item again to return to it.";
                        this.fail(message);
                    });
                Promise.resolve(webview.loadURL(this.item.source)).catch(() => {
                    if (!this.destroyed) { const message = "YouTube Music could not open this item. Check Atlas access and the saved link.";
                        this.fail(message); }
                });
            } catch (_) {
                const message = "The protected YouTube Music browser is unavailable in this Obsidian runtime.";
                this.fail(message);
            }
        });
        this.listen(webview, "did-navigate", event => {
            if (event.url === "about:blank") return;
            this.emit({ status: "ready", message: configuredConsentDestination(this.item.source, event.url)
                ? "Complete YouTube Music’s consent screen below to play the configured music." : this.playbackMessage }); this.resolveReady();
        });
        this.listen(webview, "did-fail-load", event => {
            if (event.errorCode === -3 || event.isMainFrame === false) return;
            const message = "YouTube Music could not load this item. Check Atlas access and your connection.";
            this.fail(message);
        });
        this.listen(webview, "media-started-playing", () => this.emit({ status: "playing" }));
        this.listen(webview, "media-paused", () => this.emit({ status: "paused" }));
        this.listen(webview, "destroyed", () => {
            if (this.nativeId != null) atlas.forget?.(this.nativeId);
            const message = "Atlas stopped the YouTube Music browser. Check access in Atlas, then reopen the saved item.";
            this.fail(message);
        });
        const checkAccess = () => {
            const current = atlas.view(), context = current.contexts?.find(context => context.nativeId === this.nativeId);
            if (context?.closed || ["BLOCKED", "ENFORCEMENT_FAILED"].includes(context?.phase)) {
                const consent = context.origin === "https://consent.youtube.com/" || context.origin === "https://consent.youtube.com";
                const message = consent ? "Atlas blocked required YouTube Music consent at consent.youtube.com. Review that exact hostname in Atlas, then reopen this item."
                    : "Atlas has blocked YouTube Music. Review music.youtube.com in Atlas, then reopen this item.";
                this.fail(message, true);
            }
        };
        this.cleanups.push(atlas.subscribe(checkAccess));
        this.element.appendChild(webview);
        await this.active(ready);
    }
    fail(message, specific = false) {
        if (!this.failureMessage || specific) this.failureMessage = message;
        this.rejectReady?.(new Error(this.failureMessage)); this.error(this.failureMessage);
    }
    play() { /* The service has no supported JavaScript playback API; use its visible controls. */ }
    suspend() { this.destroy(); }
    destroy() {
        if (this.destroyed) return;
        // Removing the guest guarantees stop even when a service has no public
        // pause API. Reopening reconstructs the saved source, never a hidden tab.
        super.destroy(); this.guard?.destroy(); this.guard = null; this.webview?.remove(); this.webview = null;
        if (this.nativeId != null) this.plugin.atlas?.forget?.(this.nativeId);
    }
}

module.exports = { YouTubeMusicProvider };
