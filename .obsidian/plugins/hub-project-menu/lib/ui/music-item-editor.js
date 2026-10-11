"use strict";
const { CaptureModal, action } = require("./capture-modal");
const { MUSIC_PROVIDERS, LOCAL_AUDIO_EXTENSIONS, normalizeMusicSource } = require("../domain/music");

class MusicItemModal extends CaptureModal {
    constructor(service, options = {}) { super(service.app, service, options); this.files = []; this.item = options.item ?? null; }
    field(parent, label, name) {
        const host = parent.createDiv({ cls: "hub-music-item-field" });
        const id = this.prefix + "-" + name;
        host.createEl("label", { cls: "hub-capture-label", text: label, attr: { for: id } });
        return { host, id };
    }
    onOpen() {
        this.modalEl.classList.add("hub-music-item-dialog", "hub-quick-add-dialog");
        this.header(this.item ? "Rename music" : "Add music", this.item ? "Choose a name for this music." : "Save a music link or choose local files.", "music");
        const form = this.contentEl.createEl("form", { cls: "hub-music-item-form hub-capture-content" });
        const body = form.createDiv({ cls: "hub-capture-body hub-capture-form" });
        if (!this.item) {
            let field = this.field(body, "Source", "provider");
            this.provider = field.host.createEl("select", { cls: "dropdown", attr: { id: field.id } });
            for (const provider of MUSIC_PROVIDERS) this.provider.createEl("option", { text: provider.name, attr: { value: provider.id } });
            this.provider.value = MUSIC_PROVIDERS.find(provider => this.service.state.providers[provider.id])?.id ?? "spotify";
            this.provider.addEventListener("change", () => this.refreshSource());
            field = this.field(body, "Music URL", "source"); this.sourceField = field.host;
            this.source = field.host.createEl("input", { attr: { id: field.id, type: "text", inputmode: "url", spellcheck: "false", autocomplete: "off", placeholder: "Paste a music URL" } });
            this.source.addEventListener("input", () => { this.error.textContent = ""; this.source.removeAttribute("aria-invalid"); });
            this.sourceHelp = field.host.createDiv({ cls: "hub-capture-muted" });
            this.localField = body.createDiv({ cls: "hub-music-item-field" });
            this.localField.createDiv({ cls: "hub-capture-label", text: "Audio files" });
            this.fileInput = this.localField.createEl("input", { attr: { type: "file", multiple: "", hidden: "", tabindex: "-1",
                accept: LOCAL_AUDIO_EXTENSIONS.map(extension => "." + extension).join(","), "aria-label": "Choose audio files" } });
            this.fileInput.addEventListener("change", () => {
                this.files = [...this.fileInput.files]; this.fileInput.value = ""; this.error.textContent = ""; this.renderFiles();
            });
            this.chooseFileButton = action(this.localField, "Choose audio files", "folder-open", () => this.fileInput.click());
            this.fileList = this.localField.createDiv({ cls: "hub-music-local-files hub-capture-attachments" });
            this.localField.createDiv({ cls: "hub-capture-muted", text: "Files stay in their current location." });
        }
        const field = this.field(body, this.item ? "Display name" : "Display name (optional)", "name"); this.nameField = field.host;
        this.name = field.host.createEl("input", { attr: { id: field.id, type: "text", placeholder: "Use the music title" } });
        this.name.value = this.item?.name ?? "";
        if (this.item) this.name.required = true;
        const footer = form.createDiv({ cls: "hub-capture-actions" });
        action(footer, "Cancel", null, () => this.close());
        const save = footer.createEl("button", { cls: "mod-cta", text: this.item ? "Save" : "Add music", attr: { type: "submit" } });
        form.addEventListener("submit", event => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            void this.run(async () => {
                if (this.item) await this.service.rename(this.item.id, this.name.value);
                else if (this.provider.value === "local") await this.service.addLocalFiles(this.files);
                else {
                    try { normalizeMusicSource(this.provider.value, this.source.value); }
                    catch (error) { this.source.setAttribute("aria-invalid", "true"); this.source.focus(); throw error; }
                    await this.service.add({ provider: this.provider.value, source: this.source.value, name: this.name.value });
                }
                this.finish();
            });
        });
        save.setAttribute("aria-label", this.item ? "Save display name" : "Add music");
        this.refreshSource(); (this.item ? this.name : this.provider.value === "local" ? this.chooseFileButton : this.source).focus();
        if (this.item) this.name.select();
    }
    refreshSource() {
        if (!this.provider) return;
        const provider = this.provider.value, local = provider === "local";
        this.sourceField.hidden = local; this.localField.hidden = !local; this.nameField.hidden = local;
        this.source.required = !local;
        this.sourceHelp.textContent = provider === "spotify" ? "Tracks, albums, playlists and artists." : provider === "youtube-music" ? "Songs, albums or playlists from music.youtube.com. An album's shared playlist link gives the most reliable playback." : "YouTube videos or playlists.";
        this.source.placeholder = provider === "spotify" ? "https://open.spotify.com/..." : provider === "youtube-music" ? "https://music.youtube.com/..." : "https://www.youtube.com/...";
        this.source.removeAttribute("aria-invalid"); this.error.textContent = "";
    }
    renderFiles() {
        this.fileList.empty();
        for (const file of this.files) {
            const row = this.fileList.createDiv({ cls: "hub-capture-attachment" });
            row.createSpan({ cls: "hub-capture-filename", text: file.name });
            const remove = action(row, "", "x", () => { this.files = this.files.filter(candidate => candidate !== file); this.renderFiles(); }, "hub-capture-small-action");
            remove.setAttribute("aria-label", "Remove " + file.name); remove.title = "Remove " + file.name;
        }
    }
}
function openMusicItemEditor(service, options = {}) { const modal = new MusicItemModal(service, options); modal.open(); return modal; }
module.exports = { MusicItemModal, openMusicItemEditor };
