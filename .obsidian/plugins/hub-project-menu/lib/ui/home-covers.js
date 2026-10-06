"use strict";
const { createWindowTitle, setWindowUndertext } = require("./window-title");
const { HOME_COVER_PERIODS } = require("../services/home-covers");
const { mountHeaderImage } = require("./header-image");

function openHomeCoverEditor(service, sourceCover) {
    const { Modal, Component, Menu, Notice, setIcon } = require("obsidian");
    class HomeCoverModal extends Modal {
        onOpen() {
            this.owner = new Component(); this.owner.load(); this.closed = false;
            this.modalEl.classList.add("hub-home-covers-dialog");
            this.contentEl.classList.add("hub-button-scope", "hub-home-covers-editor");
            const heading = createWindowTitle(this.contentEl, "Edit cover images", "image");
            setWindowUndertext(heading, this.contentEl.createEl("p", { text: "Right-click a preview to change its image or image placement." }));
            this.previews = [];
            this.sourceSize = { width: sourceCover.clientWidth, height: sourceCover.clientHeight };
            for (const period of HOME_COVER_PERIODS) {
                const section = this.contentEl.createDiv({ cls: "hub-home-cover-period" });
                const heading = section.createDiv({ cls: "hub-home-cover-heading" });
                heading.createEl("h3", { text: period.label });
                heading.createSpan({ cls: "hub-home-cover-time", text: period.hours });
                const menuButton = heading.createEl("button", { cls: "hub-home-cover-menu", attr: {
                    type: "button", "aria-label": `${period.label} cover image options`, "aria-haspopup": "menu"
                } });
                setIcon(menuButton, "ellipsis");
                const frame = section.createDiv({ cls: "hub-home-cover-frame" });
                frame.tabIndex = 0;
                frame.setAttribute("aria-label", `${period.label} cover image options`);
                frame.setAttribute("aria-haspopup", "menu");
                const surface = frame.createDiv({ cls: "home-cover hub-home-cover-preview" });
                const style = sourceCover.ownerDocument.defaultView.getComputedStyle(sourceCover);
                Object.assign(surface.style, { borderRadius: style.borderRadius, clipPath: style.clipPath, overflow: style.overflow });
                const preview = { name: period.name, frame, surface, editor: null };
                this.previews.push(preview);
                const showMenu = (event, anchor = frame) => {
                    event.preventDefault(); event.stopPropagation();
                    const menu = new Menu();
                    menu.addItem(item => item.setTitle("Change image…").setIcon("image")
                        .setDisabled(!!preview.editor?.editing).onClick(() => this.chooseImage(preview)));
                    menu.addItem(item => item.setTitle("Edit image placement…").setIcon("move")
                        .setDisabled(!preview.editor || this.previews.some(p => p !== preview && p.editor?.editing))
                        .onClick(() => preview.editor?.begin()));
                    if (event.type === "contextmenu") menu.showAtMouseEvent(event);
                    else { const rect = anchor.getBoundingClientRect(); menu.showAtPosition({ x: rect.left, y: rect.bottom }); }
                };
                this.owner.registerDomEvent(menuButton, "click", event => showMenu(event, menuButton));
                this.owner.registerDomEvent(frame, "contextmenu", showMenu);
                this.owner.registerDomEvent(frame, "keydown", event => {
                    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) showMenu(event);
                });
                void this.renderPreview(preview);
            }
            this.resizePreviews();
            const resize = new ResizeObserver(() => this.resizePreviews());
            resize.observe(this.contentEl); resize.observe(sourceCover);
            this.owner.register(() => resize.disconnect());
            this.scope.register([], "Escape", () => {
                const active = this.previews.find(preview => preview.editor?.editing);
                if (active) active.editor.cancel();
                else this.close();
                return false;
            });
            const actions = this.contentEl.createDiv({ cls: "hub-project-wizard-actions" });
            actions.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
        }
        resizePreviews() {
            if (sourceCover.clientWidth && sourceCover.clientHeight) {
                this.sourceSize = { width: sourceCover.clientWidth, height: sourceCover.clientHeight };
            }
            const { width, height } = this.sourceSize;
            for (const { frame, surface } of this.previews) {
                const scale = frame.clientWidth / width;
                frame.style.height = `${height * scale}px`;
                const style = surface.ownerDocument.defaultView.getComputedStyle(surface);
                for (const corner of ["TopLeft", "TopRight", "BottomLeft", "BottomRight"]) {
                    const property = `border${corner}Radius`;
                    frame.style[property] = style[property].replace(/([\d.]+)px/g, (_, value) => `${Number(value) * scale}px`);
                }
                // The editor already converts pointer coordinates on scaled surfaces.
                Object.assign(surface.style, { width: `${width}px`, height: `${height}px`, transform: `scale(${scale})` });
            }
        }
        async renderPreview(preview) {
            const file = service.plugin.app.vault.getAbstractFileByPath(service.config(preview.name).path);
            const image = preview.surface.ownerDocument.createElement("img");
            image.className = "home-cover-image hub-home-cover-staging"; image.alt = "";
            try {
                if (!file) throw Error("Cover image is missing. Right-click to choose an image.");
                image.src = service.plugin.app.vault.getResourcePath(file);
                await image.decode();
                if (this.closed) return;
                preview.editor?.dispose(); preview.surface.replaceChildren(image);
                preview.editor = mountHeaderImage({ cover: preview.surface, image, component: this.owner,
                    controlsHost: preview.frame, manageMenu: false, ...service.placementOptions(preview.name) });
                await preview.editor.prepare();
                image.classList.remove("hub-home-cover-staging");
            } catch (error) {
                if (!this.closed) new Notice(error.message || "Could not load cover preview.");
            }
        }
        chooseImage(preview) {
            const input = this.contentEl.ownerDocument.createElement("input");
            input.type = "file"; input.accept = "image/*";
            input.addEventListener("change", async () => {
                const source = input.files?.[0];
                if (!source || this.closed) return;
                const url = URL.createObjectURL(source);
                try {
                    const image = this.contentEl.ownerDocument.createElement("img"); image.src = url;
                    await image.decode();
                    if (this.closed) return;
                    await service.changeImage(preview.name, source);
                    if (!this.closed) await this.renderPreview(preview);
                } catch (error) { if (!this.closed) new Notice(error.message || "Could not change cover image."); }
                finally { URL.revokeObjectURL(url); }
            }, { once: true });
            input.click();
        }
        onClose() { this.closed = true; this.owner?.unload(); this.contentEl.empty(); }
    }
    const modal = new HomeCoverModal(service.plugin.app); modal.open(); return modal;
}

module.exports = { openHomeCoverEditor };
