"use strict";
const { mountHeaderImage } = require("../ui/header-image");

const HOME_COVER_PERIODS = Object.freeze([
    { name: "morning", label: "Morning", hours: "06:00–11:59", start: 6, greeting: "Good morning", cover: "Assets/Covers/morning.jpg" },
    { name: "afternoon", label: "Afternoon", hours: "12:00–17:59", start: 12, greeting: "Good afternoon", cover: "Assets/Covers/day.jpeg" },
    { name: "evening", label: "Evening", hours: "18:00–23:59", start: 18, greeting: "Good evening", cover: "Assets/Covers/night.jpeg" },
    { name: "night", label: "Night", hours: "00:00–05:59", start: 0, greeting: "Good night", cover: "Assets/Covers/night.jpeg" }
].map(Object.freeze));

function homeTimePeriod(date = new Date()) {
    const start = Math.floor(date.getHours() / 6) * 6;
    return HOME_COVER_PERIODS.find(period => period.start === start);
}

class HomeCovers {
    constructor(plugin) { this.plugin = plugin; this.listeners = new Set(); this.mounts = new Set(); }
    config(name) {
        const period = HOME_COVER_PERIODS.find(period => period.name === name);
        if (!period) throw Error("Unknown Home cover period.");
        const data = this.plugin.projectWizard.data;
        const saved = data.homeCoverImages?.[name];
        const imagePath = saved?.path || period.cover;
        const path = this.plugin.app.vault.getAbstractFileByPath(imagePath) ? imagePath : period.cover;
        // Read the old Home image placement until this period is edited. Never
        // mutate the shared legacy record (Evening/Night may share an image).
        const placement = saved && Object.prototype.hasOwnProperty.call(saved, "placement")
            ? saved.placement : data.headerImagePlacements?.[`home::${path}`] ?? null;
        return { path, placement };
    }
    async save(name, config) {
        const data = this.plugin.projectWizard.data;
        data.homeCoverImages = { ...data.homeCoverImages, [name]: config };
        await this.plugin.dataStore.save(data);
        for (const listener of this.listeners) listener(name);
    }
    placementOptions(name) {
        return { initial: this.config(name).placement, save: placement => this.save(name, { ...this.config(name), placement }) };
    }
    async changeImage(name, source) {
        const extension = source.name.split(".").pop()?.toLowerCase();
        if (!["png", "jpg", "jpeg", "webp", "gif", "avif", "svg", "bmp", "ico"].includes(extension)) {
            throw Error("Choose a supported image file.");
        }
        const folder = "Assets/Covers/Home";
        await this.plugin.projectWizard.ensureFolder(folder);
        const path = `${folder}/${name}-${require("crypto").randomUUID()}.${extension}`;
        await this.plugin.app.vault.createBinary(path, await source.arrayBuffer());
        // A new image starts with the same default crop as the real Home cover.
        await this.save(name, { path, placement: null });
    }
    mount(cover, image, component, name, openModal) {
        const { Menu, Component } = require("obsidian");
        const owner = component;
        component = new Component(); component.load();
        owner.register(() => component.unload());
        this.mounts.add(component);
        component.register(() => this.mounts.delete(component));
        let editor = mountHeaderImage({ cover, image, component, manageMenu: false, ...this.placementOptions(name) });
        let disposed = false, revision = 0;
        const update = async changed => {
            if (changed !== name || disposed) return;
            const version = ++revision;
            const file = this.plugin.app.vault.getAbstractFileByPath(this.config(name).path);
            if (!file) return;
            const next = cover.ownerDocument.createElement("img");
            next.className = "home-cover-image hub-home-cover-staging";
            next.alt = ""; next.src = this.plugin.app.vault.getResourcePath(file);
            try { await next.decode(); } catch (_) { return; }
            if (disposed || version !== revision) return;
            cover.append(next);
            const nextEditor = mountHeaderImage({ cover, image: next, component, manageMenu: false, ...this.placementOptions(name) });
            await nextEditor.prepare();
            if (disposed || version !== revision) { nextEditor.dispose(); next.remove(); return; }
            editor.dispose(); image.remove(); image = next; editor = nextEditor;
            next.classList.remove("hub-home-cover-staging");
        };
        this.listeners.add(update);
        component.register(() => { disposed = true; this.listeners.delete(update); });
        component.registerDomEvent(cover, "contextmenu", event => {
            event.preventDefault(); event.stopPropagation();
            const menu = new Menu();
            menu.addItem(item => item.setTitle("Edit cover images…").setIcon("image").onClick(() => openModal(cover)));
            menu.showAtMouseEvent(event);
        });
    }
    destroy() { for (const component of [...this.mounts]) component.unload(); this.listeners.clear(); }
}

module.exports = { HOME_COVER_PERIODS, homeTimePeriod, HomeCovers };
