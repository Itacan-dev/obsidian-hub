"use strict";

const { mountHeaderImage, normalizeImagePlacement, imagePlacementGeometry } = require("./header-image");

// Small cover backgrounds need explicit high-quality downsampling: changing
// background-image to <img> still leaves Chromium choosing the same filtering.
// Keep CSS in charge of geometry, clipping, hover and drag-clone appearance.
function createCardImageCache() {
    const sources = new Map(), previews = new Map();
    const windows = new Map();
    let disposed = false;
    const touch = (map, key) => {
        const value = map.get(key);
        if (value) { map.delete(key); map.set(key, value); }
        return value;
    };
    const trim = (map, count, budget) => {
        let bytes = [...map.values()].reduce((sum, entry) => sum + entry.bytes, 0);
        while (map.size > count || bytes > budget) {
            const key = map.keys().next().value;
            bytes -= map.get(key).bytes; map.delete(key);
        }
    };
    return {
        load(doc, url, path) {
            const cached = touch(sources, url);
            if (cached) return cached.promise;
            const image = new doc.defaultView.Image();
            image.crossOrigin = 'anonymous';
            image.src = url;
            const view = doc.defaultView;
            if (!disposed && !windows.has(view)) {
                const release = () => {
                    for (const [key, source] of sources) if (source.view === view) {
                        source.invalidated = true; sources.delete(key);
                    }
                    view.removeEventListener('pagehide', release);
                    windows.delete(view);
                };
                windows.set(view, release); view.addEventListener('pagehide', release);
            }
            const entry = { path, view, bytes: 0, promise: null };
            entry.promise = image.decode().then(() => {
                if (sources.get(url) === entry) {
                    entry.bytes = image.naturalWidth * image.naturalHeight * 4;
                    trim(sources, 24, 64 * 1024 * 1024);
                }
                return image;
            }).catch(error => {
                if (sources.get(url) === entry) sources.delete(url);
                throw error; // A failed decode must be retryable on a later visit.
            });
            entry.promise.valid = () => !disposed && !entry.invalidated;
            if (!disposed) { sources.set(url, entry); trim(sources, 24, 64 * 1024 * 1024); }
            return entry.promise;
        },
        preview(key) { return touch(previews, key)?.url; },
        remember(key, url, path) {
            if (disposed) return;
            previews.delete(key);
            previews.set(key, { url, path, bytes: url.length * 2 });
            trim(previews, 48, 12 * 1024 * 1024);
        },
        invalidate(path) {
            for (const map of [sources, previews]) for (const [key, entry] of map) {
                if (entry.path === path || entry.path?.startsWith(path + '/')) {
                    entry.invalidated = true; map.delete(key);
                }
            }
        },
        destroy() {
            disposed = true;
            for (const release of windows.values()) release();
            sources.clear(); previews.clear();
        }
    };
}

function createCardImageRenderer(root, component, placementStorage = null, sharedCache = null) {
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    const entries = new Map();
    const cache = sharedCache ?? createCardImageCache();
    let disposed = false;
    let resolution;
    const background = url => `url(${JSON.stringify(url)})`;

    const load = (url, path) => cache.load(doc, url, path);

    async function render(element, entry) {
        if (disposed || !element.isConnected) return;
        const { width, height } = entry;
        if (!width || !height) return;
        const dpr = win.devicePixelRatio || 1;
        // Include the CSS aspect ratio: rounding physical pixels must not shift
        // the existing centered cover crop at fractional widths / display zoom.
        const key = JSON.stringify([entry.url, width, height, dpr, entry.placement]);
        entry.key = key;
        const cachedPreview = cache.preview(key);
        if (cachedPreview) {
            // ResizeObserver delivers the new dimensions before paint. Publish
            // a warm raster synchronously, without decoding the source again.
            element.style.backgroundImage = background(cachedPreview);
            element.style.backgroundSize = '100% 100%';
            element.style.backgroundPosition = `${entry.placement.x}% ${entry.placement.y}%`;
            return;
        }
        let nextImage = background(entry.url), nextSize = "";
        const nextPosition = `${entry.placement.x}% ${entry.placement.y}%`;
        let pending;
        try {
            pending = load(entry.url, entry.path);
            const image = await pending;
            if (!pending.valid()) return;
            if (disposed || entries.get(element) !== entry || entry.key !== key || !element.isConnected) return;
            const geometry = imagePlacementGeometry(width, height, image.naturalWidth, image.naturalHeight, entry.placement);
            nextSize = `${geometry.imageWidth}px ${geometry.imageHeight}px`;
            if (!entry.resample) return;
            let url = cache.preview(key);
            if (!url) {
                const scale = geometry.scale;
                if (scale * dpr >= 1) return; // Never manufacture source detail.
                const sw = width / scale, sh = height / scale;
                // CSS places these previews on fractional pixels and scales the
                // cards on hover. Retain 2x sampling headroom for that final pass
                // instead of interpolating an already final-sized raster again.
                // Cap at the source's real detail; this is not image upscaling.
                const density = Math.min(dpr * 2, 1 / scale);
                const pw = Math.ceil(width * density), ph = Math.ceil(height * density);
                const canvas = doc.createElement("canvas");
                canvas.width = pw;
                canvas.height = ph;
                const context = canvas.getContext("2d");
                if (!context) return;
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = "high";
                context.drawImage(image,
                    -geometry.left / scale, -geometry.top / scale,
                    sw, sh, 0, 0, pw, ph);
                url = canvas.toDataURL("image/png"); // Lossless, memory only.
                cache.remember(key, url, entry.path);
            }
            nextImage = background(url);
            nextSize = "100% 100%";
        } catch (_) {
            // Unsupported formats or canvas security restrictions keep
            // the original resource URL; a failed preview never hides a card.
        } finally {
            // Publish image and geometry together. Never expose the centered
            // source while decoding, or reset a saved crop during an update.
            if (!disposed && (!pending || pending.valid()) && entries.get(element) === entry && entry.key === key && element.isConnected) {
                element.style.backgroundImage = nextImage;
                element.style.backgroundSize = nextSize;
                element.style.backgroundPosition = nextPosition;
            }
        }
    }

    function prune() {
        for (const element of entries.keys()) {
            // A dashboard is built detached before its structural commit.
            // Lifetime follows ownership, not whether the host has mounted yet.
            if (!root.contains(element)) {
                observer.unobserve(element);
                entries.get(element).editor?.dispose();
                entries.delete(element);
            }
        }
    }

    const observer = new win.ResizeObserver(changes => {
        prune();
        for (const { target, contentRect } of changes) {
            const entry = entries.get(target);
            if (!entry) continue;
            entry.width = contentRect.width;
            entry.height = contentRect.height;
            void render(target, entry);
        }
    });

    function watchResolution() {
        resolution?.removeEventListener("change", onResolution);
        resolution = win.matchMedia(`(resolution: ${win.devicePixelRatio || 1}dppx)`);
        resolution.addEventListener("change", onResolution);
    }

    function onResolution() {
        prune();
        for (const [element, entry] of entries) void render(element, entry);
        watchResolution();
    }
    watchResolution();

    component.register(() => {
        disposed = true;
        observer.disconnect();
        resolution.removeEventListener("change", onResolution);
        for (const entry of entries.values()) entry.editor?.dispose();
        entries.clear();
        if (!sharedCache) cache.destroy();
    });

    return (element, url, options = {}) => {
        element.style.backgroundImage = "none";
        element.style.backgroundSize = "";
        observer.unobserve(element);
        entries.get(element)?.editor?.dispose();
        entries.delete(element);
        if (disposed) return;
        prune();
        const storage = options.key && placementStorage?.(options.key);
        const entry = { url, path: options.sourcePath, placement: normalizeImagePlacement(storage?.initial),
            // Retain vector rendering and GIF animation rather than flattening them.
            resample: !/\.(svg|gif|apng)(?:[?#]|$)/i.test(url) };
        entries.set(element, entry);
        observer.observe(element);
        if (storage && options.card) {
            const pending = load(url, entry.path);
            return pending.then(image => {
                if (!pending.valid() || disposed || entries.get(element) !== entry || !root.contains(element)) return;
                entry.editor = mountHeaderImage({
                    cover: element, image, component, ...storage, defaultY: 50,
                    controlsHost: options.card, surfaceClass: "hub-card-image",
                    applyPlacement: placement => {
                        entry.placement = normalizeImagePlacement(placement);
                        void render(element, entry);
                        if (!entry.width || !entry.height) return null;
                        return imagePlacementGeometry(entry.width, entry.height,
                            image.naturalWidth, image.naturalHeight, entry.placement);
                    }
                });
            }).catch(error => console.warn("Hub card image placement unavailable", error));
        }
    };
}

module.exports = { createCardImageRenderer, createCardImageCache };
