"use strict";
const { ownMenuColors, ownNoticeColors } = require("./color-system");


const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const headerImages = new WeakMap();
function refreshHeaderImages(root) {
    for (const cover of root.querySelectorAll(".home-cover, .project-cover")) headerImages.get(cover)?.refresh();
}

async function prepareHeaderImages(root) {
    await Promise.all([...root.querySelectorAll(".home-cover, .project-cover")].map(async cover => {
        const editor = headerImages.get(cover);
        if (editor) return editor.prepare();
        await cover.querySelector("img")?.decode?.().catch(() => {});
    }));
}

function normalizeImagePlacement(value, defaultY = 50) {
    return {
        x: clamp(Number.isFinite(value?.x) ? value.x : 50, 0, 100),
        y: clamp(Number.isFinite(value?.y) ? value.y : defaultY, 0, 100),
        zoom: clamp(Number.isFinite(value?.zoom) ? value.zoom : 1, 1, 3)
    };
}

function imagePlacementGeometry(width, height, naturalWidth, naturalHeight, placement) {
    const scale = Math.max(width / naturalWidth, height / naturalHeight) * placement.zoom;
    const imageWidth = naturalWidth * scale, imageHeight = naturalHeight * scale;
    return { width, height, imageWidth, imageHeight, scale,
        left: (width - imageWidth) * placement.x / 100,
        top: (height - imageHeight) * placement.y / 100 };
}

function mountHeaderImage({ cover, image, component, initial, save, defaultY = 35, manageMenu = true,
    applyPlacement = null, controlsHost = cover, surfaceClass = "hub-header-image" }) {
    const { Menu, Notice, Component } = require("obsidian");
    const owner = component;
    component = new Component();
    component.load();
    owner.register(() => component.unload());
    let saved = initial ? normalizeImagePlacement(initial, defaultY) : null;
    let placement = normalizeImagePlacement(saved, defaultY);
    let editing = false;
    let saving = false;
    let dragging = null;
    let controls = null;
    let frame = null;
    let originalStyle = image.getAttribute("style");
    let geometry = null;
    let disposed = false;
    cover.classList.add(surfaceClass);
    image.draggable = false;

    if (!applyPlacement) {
        // Cover images are decoration, not Markdown image-viewer links. Stop
        // their ordinary click before it reaches the host's image handlers.
        // Card backgrounds use applyPlacement and retain normal navigation.
        component.registerDomEvent(cover, "click", event => {
            if (event.button !== 0 || event.target !== image) return;
            event.preventDefault();
            event.stopPropagation();
        }, true);
    }

    function render() {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        if (disposed) return;
        if (applyPlacement) {
            geometry = applyPlacement(placement);
            return;
        }
        if (!editing && !saved) {
            if (originalStyle === null) image.removeAttribute("style");
            else image.setAttribute("style", originalStyle);
            return;
        }
        if (!image.naturalWidth || !cover.clientWidth || !cover.clientHeight) return;
        const width = cover.clientWidth, height = cover.clientHeight;
        geometry = imagePlacementGeometry(width, height, image.naturalWidth, image.naturalHeight, placement);
        const { imageWidth, imageHeight, left, top } = geometry;
        Object.assign(image.style, {
            position: "absolute", maxWidth: "none", width: `${imageWidth}px`, height: `${imageHeight}px`,
            left: `${left}px`, top: `${top}px`, objectFit: "fill", objectPosition: "initial", transform: "none"
        });
    }
    function schedule() { if (frame === null) frame = requestAnimationFrame(render); }
    function finish() {
        editing = false;
        saving = false;
        if (dragging && cover.hasPointerCapture(dragging.id)) cover.releasePointerCapture(dragging.id);
        dragging = null;
        cover.classList.remove("is-image-editing");
        controlsHost.classList.remove("is-placement-editing");
        controls?.remove();
        controls = null;
        schedule();
    }
    function begin() {
        if (editing || disposed) return;
        editing = true;
        cover.classList.add("is-image-editing");
        controlsHost.classList.add("is-placement-editing");
        placement = normalizeImagePlacement(saved, defaultY);
        controls = controlsHost.createDiv({ cls: "hub-image-placement-controls hub-button-scope" });
        controls.addEventListener("click", event => event.stopPropagation());
        controls.addEventListener("pointerdown", event => event.stopPropagation());
        controls.createSpan({ text: "Drag to reposition · Scroll to zoom" });
        const cancel = controls.createEl("button", { text: "Cancel" });
        const done = controls.createEl("button", { text: "Done", cls: "mod-cta" });
        cancel.addEventListener("click", cancelEdit);
        done.addEventListener("click", async () => {
            saving = true;
            done.disabled = cancel.disabled = true;
            try {
                await save({ ...placement });
                saved = { ...placement };
                finish();
            } catch (error) {
                saving = false;
                done.disabled = cancel.disabled = false;
                ownNoticeColors(new Notice("Could not save image placement. Please try again."));
                console.error("Hub image placement save failed", error);
            }
        });
        schedule();
    }
    function cancelEdit() {
        if (!editing || saving || disposed) return;
        placement = normalizeImagePlacement(saved, defaultY);
        finish();
    }
    component.registerDomEvent(cover, "pointerdown", event => {
        if (!editing || saving || event.button !== 0 || controls?.contains(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        render();
        dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, placement: { ...placement } };
        cover.setPointerCapture(event.pointerId);
    });
    component.registerDomEvent(cover, "pointermove", event => {
        if (!dragging || saving || event.pointerId !== dragging.id || !geometry) return;
        const dx = geometry.width - geometry.imageWidth, dy = geometry.height - geometry.imageHeight;
        const rect = cover.getBoundingClientRect();
        const scaleX = rect.width / cover.offsetWidth || 1, scaleY = rect.height / cover.offsetHeight || 1;
        placement.x = dx ? clamp(dragging.placement.x + (event.clientX - dragging.x) / scaleX / dx * 100, 0, 100) : 50;
        placement.y = dy ? clamp(dragging.placement.y + (event.clientY - dragging.y) / scaleY / dy * 100, 0, 100) : 50;
        schedule();
    });
    const stopDrag = event => {
        if (dragging?.id !== event.pointerId) return;
        dragging = null;
        if (cover.hasPointerCapture(event.pointerId)) cover.releasePointerCapture(event.pointerId);
    };
    component.registerDomEvent(cover, "pointerup", stopDrag);
    component.registerDomEvent(cover, "pointercancel", stopDrag);
    component.registerDomEvent(cover, "wheel", event => {
        if (!editing || saving || controls?.contains(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        render();
        if (!geometry) return;
        const rect = cover.getBoundingClientRect();
        const px = (event.clientX - rect.left) * cover.offsetWidth / rect.width - cover.clientLeft;
        const py = (event.clientY - rect.top) * cover.offsetHeight / rect.height - cover.clientTop;
        const anchorX = (px - geometry.left) / geometry.imageWidth;
        const anchorY = (py - geometry.top) / geometry.imageHeight;
        const zoom = clamp(placement.zoom * Math.exp(-event.deltaY * 0.0015), 1, 3);
        const ratio = zoom / placement.zoom;
        const w = geometry.imageWidth * ratio, h = geometry.imageHeight * ratio;
        placement.zoom = zoom;
        placement.x = w === geometry.width ? 50 : clamp((px - anchorX * w) / (geometry.width - w) * 100, 0, 100);
        placement.y = h === geometry.height ? 50 : clamp((py - anchorY * h) / (geometry.height - h) * 100, 0, 100);
        schedule();
    }, { passive: false });
    if (controlsHost !== cover) {
        // Only intercept navigation/reordering during editing, not normal clicks.
        component.registerDomEvent(controlsHost, "click", event => {
            if (editing && !controls?.contains(event.target)) {
                event.preventDefault(); event.stopImmediatePropagation();
            }
        }, true);
        component.registerDomEvent(controlsHost, "pointerdown", event => {
            if (editing) event.stopPropagation();
        });
    }
    component.registerDomEvent(cover.ownerDocument, "keydown", event => {
        if (editing && !saving && event.key === "Escape") {
            cancelEdit();
            event.preventDefault();
        }
    });
    if (manageMenu) component.registerDomEvent(cover, "contextmenu", event => {
        event.preventDefault(); event.stopPropagation();
        const menu = ownMenuColors(new Menu());
        menu.addItem(item => item.setTitle("Edit image placement").setIcon("move").onClick(begin));
        menu.showAtMouseEvent(event);
    });
    component.registerDomEvent(image, "load", render);
    // ResizeObserver runs before paint. Scheduling another frame here exposed
    // old full-view coordinates when a hidden note-rail cover became visible.
    const resize = new ResizeObserver(render);
    resize.observe(cover);
    component.register(() => {
        disposed = true;
        if (headerImages.get(cover) === editor) headerImages.delete(cover);
        resize.disconnect();
        if (frame !== null) cancelAnimationFrame(frame);
        controls?.remove();
        cover.classList.remove("is-image-editing");
        controlsHost.classList.remove("is-placement-editing");
        if (!applyPlacement) {
            if (originalStyle === null) image.removeAttribute("style");
            else image.setAttribute("style", originalStyle);
        }
    });
    const editor = { begin, cancel: cancelEdit, refresh: render, get editing() { return editing; },
        dispose: () => component.unload(), prepare: async () => {
        await image.decode?.().catch(() => {});
        if (disposed) return;
        if (frame !== null) cancelAnimationFrame(frame);
        render();
    } };
    if (!applyPlacement) headerImages.set(cover, editor);
    schedule();
    return editor;
}

module.exports = { mountHeaderImage, normalizeImagePlacement, imagePlacementGeometry, prepareHeaderImages, refreshHeaderImages };
