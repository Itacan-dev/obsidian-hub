"use strict";
const { MusicProvider, clamp } = require("./provider-base");

async function localResource(plugin, item) {
    const source = item.source, vault = plugin.app.vault;
    const file = vault.getAbstractFileByPath?.(source);
    if (file && !file.children) return vault.getResourcePath(file);
    const path = require("path"), fs = require("fs"), { pathToFileURL } = require("url");
    if (!path.isAbsolute(source)) throw new Error("This audio file is missing from the vault. Check its location in Settings → Music.");
    let stat;
    try {
        await fs.promises.access(source, fs.constants.R_OK);
        stat = await fs.promises.stat(source);
        if (!stat.isFile()) throw new Error("Not a file");
    } catch (_) { throw new Error("This audio file is missing or unreadable. Check its location in Settings → Music."); }
    const fileURL = pathToFileURL(source).href, prefix = vault.adapter?.resourcePathPrefix;
    // Raw file:// media is blocked by Obsidian's app:// renderer. Reuse its
    // desktop adapter's existing native resource route and escaping convention
    // without copying the file. getResourcePath accepts external references in
    // newer Obsidian versions, but older adapters join them to the vault path.
    if (typeof prefix === "string" && prefix.startsWith("app://")) {
        const resource = fileURL.startsWith("file:///") ? fileURL.slice(8)
            : fileURL.startsWith("file://") ? "%5C%5C" + fileURL.slice(7) : fileURL;
        return prefix + resource + "?" + Math.round(stat.mtimeMs);
    }
    return fileURL;
}

class LocalAudioProvider extends MusicProvider {
    constructor(plugin, item, options) {
        super(plugin, item, options, { play: true, pause: true, seek: true, volume: true,
            progress: true, persistent: true });
        this.audio = this.document.createElement("audio");
        this.audio.preload = "metadata"; this.audio.hidden = true; this.element.appendChild(this.audio);
        const progress = () => this.emit({ currentTime: Number(this.audio.currentTime) || 0,
            duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0, volume: this.audio.volume });
        for (const event of ["timeupdate", "durationchange", "loadedmetadata", "volumechange", "seeked"]) this.listen(this.audio, event, progress);
        this.listen(this.audio, "playing", () => this.emit({ status: "playing", message: "" }));
        this.listen(this.audio, "pause", () => { if (!this.audio.ended) this.emit({ status: "paused" }); });
        this.listen(this.audio, "waiting", () => this.emit({ status: "loading" }));
        this.listen(this.audio, "ended", () => { this.emit({ status: "ended" }); this.options.onEnded?.(); });
        this.listen(this.audio, "error", () => {
            const message = this.audio.error?.code === 4 ? "This audio format cannot be played in Obsidian. Choose an MP3, WAV, OGG or compatible M4A file."
                : "This audio file could not be read. Check its location in Settings → Music.";
            this.rejectReady?.(new Error(message)); this.error(message);
        });
    }
    mount() {
        // Chromium pauses media when its connected DOM subtree is removed.
        // Local audio needs no visible surface: keep this native media element
        // detached for its entire plugin-owned lifetime, including modal reopen.
    }
    async load() {
        this.emit({ status: "loading", title: this.item.name });
        const source = await this.active(localResource(this.plugin, this.item));
        const ready = this.readyPromise("This audio file could not be opened. Check its location and format in Settings → Music.");
        this.listen(this.audio, "loadedmetadata", () => { this.emit({ status: "ready", message: "" }); this.resolveReady(); });
        this.audio.src = source; this.audio.load();
        await this.active(ready);
    }
    async play() {
        if (this.destroyed) return;
        try { await this.active(this.audio.play()); }
        catch (error) {
            if (error.cancelled) throw error;
            const message = error.name === "NotAllowedError" ? "Press Play to start this audio file."
                : "This audio file could not be played. Check its location and format in Settings → Music.";
            this.error(message); throw new Error(message);
        }
    }
    pause() { if (!this.destroyed) this.audio.pause(); }
    seek(seconds) { if (!this.destroyed && Number.isFinite(this.audio.duration)) this.audio.currentTime = clamp(seconds, this.audio.duration); }
    setVolume(value) { if (!this.destroyed) this.audio.volume = clamp(value); }
    suspend() { /* Native audio deliberately continues while the Music dialog is closed. */ }
    destroy() {
        if (this.destroyed) return;
        this.audio.pause(); super.destroy(); this.audio.removeAttribute("src"); this.audio.load();
    }
}

module.exports = { LocalAudioProvider, localResource };
