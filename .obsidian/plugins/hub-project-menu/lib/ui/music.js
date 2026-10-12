"use strict";
const { createWindowTitle, setWindowUndertext } = require("./window-title");
const { Modal } = require("obsidian");
const { setHubIcon } = require("./icons");
const { action } = require("./capture-modal");
const { MUSIC_PROVIDERS } = require("../domain/music");
const { setHubTooltip } = require("./tooltips");
let instance = 0;

class MusicModal extends Modal {
    constructor(app, onClose, plugin) {
        super(app); this.closed = onClose; this.plugin = plugin;
        this.controller = plugin.music; this.library = plugin.musicLibrary;
        this.titleId = `hub-music-${++instance}-title`;
    }
    onOpen() {
        this.modalEl.classList.add("hub-oath-dialog", "hub-music-dialog");
        this.contentEl.classList.add("hub-button-scope", "hub-capture-content", "hub-music-content");
        this.contentEl.tabIndex = -1;
        const header = this.contentEl.createEl("header", { cls: "hub-capture-header" });
        const heading = createWindowTitle(header, "Music", "music", { attr: { id: this.titleId } });
        setWindowUndertext(heading, header.createEl("p", { cls: "hub-oath-muted", text: "Play your configured music" }));
        this.modalEl.setAttribute("aria-labelledby", this.titleId);
        this.modalEl.querySelector(".modal-close-button")?.setAttribute("aria-label", "Close Music");
        this.body = this.contentEl.createDiv({ cls: "hub-capture-body hub-music-body" });
        this.empty = this.body.createDiv({ cls: "hub-music-empty" });
        this.empty.createEl("p", { cls: "hub-oath-muted", text: "Add music in Settings, then choose it here when you work." });
        action(this.empty, "Open Music settings", "settings", () => this.openSettings());
        this.layout = this.body.createDiv({ cls: "hub-music-layout" });
        const configured = this.layout.createEl("section", { cls: "hub-music-configured", attr: { "aria-label": "Configured music" } });
        configured.createEl("h3", { text: "Your music" });
        this.list = configured.createDiv({ cls: "hub-music-list" });
        const playing = this.layout.createEl("section", { cls: "hub-music-now", attr: { "aria-label": "Now playing" } });
        playing.createEl("h3", { text: "Now playing" });
        this.artwork = playing.createEl("img", { cls: "hub-music-now-artwork", attr: { alt: "", referrerpolicy: "no-referrer" } });
        this.artwork.hidden = true;
        this.artwork.addEventListener("error", () => {
            this.failedArtwork = this.artwork.getAttribute("src"); this.artwork.hidden = true;
        });
        this.name = playing.createDiv({ cls: "hub-music-now-title" });
        this.artist = playing.createDiv({ cls: "hub-capture-muted" });
        this.source = playing.createDiv({ cls: "hub-capture-muted" });
        this.feedback = playing.createDiv({ cls: "hub-music-feedback hub-capture-muted", attr: { role: "status", "aria-live": "polite" } });
        this.surface = playing.createDiv({ cls: "hub-music-player" });
        this.transport = playing.createDiv({ cls: "hub-music-transport" });
        this.progress = playing.createDiv({ cls: "hub-music-progress" });
        this.volumeHost = playing.createDiv({ cls: "hub-music-volume" });
        const footer = this.contentEl.createDiv({ cls: "hub-capture-actions hub-music-actions" });
        action(footer, "Music settings", "settings", () => this.openSettings());
        action(footer, "Close", null, () => this.close());
        this.stop = this.controller.onChange(state => this.renderState(state));
        this.stopLibrary = this.library.onChange(() => this.renderList());
        this.renderList(); this.controller.attach(this.surface);
        this.contentEl.focus();
    }
    openSettings() { this.close(); this.plugin.settingsControl?.open("music"); }
    renderList() {
        const entries = this.controller.entries;
        this.empty.hidden = !!entries.length; this.layout.hidden = !entries.length;
        this.list.empty(); this.rows = new Map();
        for (const item of entries) {
            const provider = MUSIC_PROVIDERS.find(provider => provider.id === item.provider);
            const row = this.list.createEl("button", { cls: "hub-inbox-row hub-music-row", attr: { type: "button" } });
            const graphic = row.createSpan({ cls: "hub-capture-icon hub-music-source-icon", attr: { "aria-hidden": "true" } });
            setHubIcon(graphic, provider?.icon ?? "music");
            if (item.artwork) {
                const art = graphic.createEl("img", { cls: "hub-music-artwork", attr: { alt: "", loading: "lazy", referrerpolicy: "no-referrer" } });
                art.addEventListener("load", () => { graphic.replaceChildren(art); art.classList.add("is-loaded"); }, { once: true });
                art.addEventListener("error", () => art.remove(), { once: true });
                art.src = item.artwork;
            }
            const copy = row.createSpan({ cls: "hub-inbox-row-copy" });
            copy.createSpan({ cls: "hub-music-row-title", text: item.name });
            copy.createSpan({ cls: "hub-capture-muted", text: `${provider?.name ?? item.provider} · ${sourceLabel(item.sourceType)}` });
            row.addEventListener("click", () => { void this.controller.select(item.id); });
            this.rows.set(item.id, row);
        }
        this.renderState(this.controller.snapshot);
    }
    renderState(state) {
        const { item, capabilities } = state;
        for (const [id, row] of this.rows ?? []) {
            row.classList.toggle("is-selected", item?.id === id);
            row.setAttribute("aria-current", item?.id === id ? "true" : "false");
        }
        this.name.textContent = item ? state.title : "Choose music to begin.";
        this.artist.textContent = item ? state.artist || "" : "";
        this.artist.hidden = !this.artist.textContent;
        this.artwork.hidden = !item || !state.artwork || this.failedArtwork === state.artwork;
        if (item && state.artwork && this.artwork.getAttribute("src") !== state.artwork) {
            this.failedArtwork = null; this.artwork.src = state.artwork;
        }
        else if (!state.artwork) this.artwork.removeAttribute("src");
        this.source.textContent = item ? MUSIC_PROVIDERS.find(provider => provider.id === item.provider)?.name ?? item.provider : "";
        this.feedback.classList.toggle("hub-task-error", state.status === "error");
        this.feedback.textContent = state.message || (state.status === "loading" ? "Loading player…" : "");
        this.surface.hidden = !item || !capabilities.visiblePlayer;
        const key = JSON.stringify([item?.id, capabilities]);
        if (key !== this.controlsKey) { this.controlsKey = key; this.renderControls(capabilities); }
        const loading = state.status === "loading";
        this.transport.querySelectorAll("button").forEach(button => { button.disabled = loading; });
        if (this.playButton) {
            const isPlaying = state.status === "playing";
            this.playButton.disabled = loading || !(isPlaying ? capabilities.pause : capabilities.play);
            setHubIcon(this.playButton.querySelector(".hub-capture-icon"), isPlaying ? "pause" : "play");
            this.playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
            setHubTooltip(this.playButton, isPlaying ? "Pause" : "Play");
        }
        const duration = Number.isFinite(state.duration) ? Math.max(0, state.duration) : 0;
        const time = Number.isFinite(state.currentTime) ? Math.max(0, state.currentTime) : 0;
        if (this.seekInput) {
            this.seekInput.max = String(duration || 1); this.seekInput.disabled = !duration || loading;
            if (!this.seeking) this.seekInput.value = String(Math.min(duration, time));
            this.seekInput.setAttribute("aria-valuetext", `${formatTime(time)} of ${formatTime(duration)}`);
        }
        if (this.time) this.time.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
        if (this.volumeInput) {
            this.volumeInput.disabled = loading;
            if (this.volumeInput.ownerDocument.activeElement !== this.volumeInput) this.volumeInput.value = String(state.volume ?? 1);
        }
    }
    renderControls(capabilities) {
        this.transport.empty(); this.progress.empty(); this.volumeHost.empty();
        this.playButton = this.seekInput = this.time = this.volumeInput = null;
        this.seeking = false;
        const control = (label, icon, callback) => {
            const button = action(this.transport, "", icon, callback, "hub-music-transport-button");
            button.setAttribute("aria-label", label); setHubTooltip(button, label); return button;
        };
        if (capabilities.previous) control("Previous", "skip-back", () => { void this.controller.previous(); });
        if (capabilities.play || capabilities.pause) this.playButton = control("Play", "play", () => { void this.controller.toggle(); });
        if (capabilities.next) control("Next", "skip-forward", () => { void this.controller.next(); });
        if (capabilities.seek) {
            this.seekInput = this.progress.createEl("input", { attr: { type: "range", min: "0", max: "1", step: "0.1", "aria-label": "Playback position" } });
            this.seekInput.addEventListener("pointerdown", () => { this.seeking = true; });
            this.seekInput.addEventListener("input", () => { this.seeking = true; });
            for (const event of ["pointerup", "pointercancel", "blur"]) this.seekInput.addEventListener(event, () => { this.seeking = false; });
            this.seekInput.addEventListener("change", () => {
                this.seeking = false;
                void this.controller.seek(Number(this.seekInput.value));
            });
        }
        if (capabilities.progress) this.time = this.progress.createSpan({ cls: "hub-capture-muted hub-music-time" });
        if (capabilities.volume) {
            setHubIcon(this.volumeHost.createSpan({ cls: "hub-capture-icon", attr: { "aria-hidden": "true" } }), "volume-2");
            this.volumeInput = this.volumeHost.createEl("input", { attr: { type: "range", min: "0", max: "1", step: "0.01", "aria-label": "Volume" } });
            this.volumeInput.addEventListener("input", () => { void this.controller.setVolume(Number(this.volumeInput.value)); });
        }
    }
    onClose() {
        this.stop?.(); this.stopLibrary?.(); this.controller.detach(this.surface);
        this.contentEl.empty(); this.closed?.();
    }
}

function sourceLabel(type) { return ({ file: "Audio file", video: "Video", track: "Track", playlist: "Playlist", album: "Album", artist: "Artist" })[type] ?? "Music"; }
function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(value / 60), remainder = String(value % 60).padStart(2, "0");
    return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}

function mountMusicControl(plugin, host) {
    const button = host.createEl("button", { cls: "hub-oath-button hub-music-button",
        attr: { type: "button", "aria-label": "Music", "aria-haspopup": "dialog" } });
    setHubIcon(button.createSpan({ cls: "hub-oath-icon", attr: { "aria-hidden": "true" } }), "music");
    button.createSpan({ text: "Music" }); setHubTooltip(button, "Music", "top");
    let modal = null, destroyed = false;
    const open = () => {
        if (destroyed || !plugin.musicLibrary.state.enabled) return;
        if (modal) { modal.contentEl.focus(); return; }
        if (button.ownerDocument.querySelector(".modal-container")) return;
        modal = new MusicModal(plugin.app, () => { modal = null; if (!destroyed && button.isConnected && !button.hidden) button.focus(); }, plugin);
        modal.open();
    };
    plugin.registerDomEvent(button, "click", open);
    const update = () => { button.hidden = !plugin.musicLibrary.state.enabled; if (button.hidden) modal?.close(); };
    const stop = plugin.musicLibrary.onChange(update); update();
    return { button, open, destroy() { destroyed = true; stop(); modal?.close(); button.remove(); } };
}
module.exports = { MusicModal, mountMusicControl, formatTime };
