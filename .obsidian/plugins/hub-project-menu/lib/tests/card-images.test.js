"use strict";
const assert = require("assert/strict");
const { createCardImageRenderer } = require("../ui/card-images");

async function run() {
    const draws = [], images = [], observers = [], media = [], cleanup = [];
    let encodes = 0;
    const win = {
        devicePixelRatio: 1,
        Image: class {
            constructor() {
                this.naturalWidth = 1200; this.naturalHeight = 675;
                this.ready = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
                images.push(this);
            }
            decode() { return this.ready; }
        },
        ResizeObserver: class {
            constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
            observe(el) { this.targets.add(el); }
            unobserve(el) { this.targets.delete(el); }
            disconnect() { this.targets.clear(); }
        },
        matchMedia(query) {
            const m = { query, addEventListener(_, fn) { this.listener = fn; },
                removeEventListener() { this.listener = null; } };
            media.push(m); return m;
        }
    };
    const doc = { defaultView: win, createElement(tag) {
        assert.equal(tag, "canvas");
        const canvas = { getContext() {
            return { drawImage(...args) {
                assert.equal(this.imageSmoothingEnabled, true);
                assert.equal(this.imageSmoothingQuality, "high");
                draws.push({ args, width: canvas.width, height: canvas.height });
            } };
        }, toDataURL(format) { assert.equal(format, "image/png"); return `data:image/png;base64,${++encodes}`; } };
        return canvas;
    } };
    const setImage = createCardImageRenderer({ ownerDocument: doc }, { register: fn => cleanup.push(fn) },
        () => ({ initial: { x: 0, y: 100, zoom: 2 } }));
    const element = () => ({ isConnected: true, style: {} });
    const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
    async function size(el, width, height) {
        observers[0].callback([{ target: el, contentRect: { width, height } }]);
        await flush();
    }
    const first = element(); setImage(first, "original.jpg");
    assert.equal(first.style.backgroundImage, 'none', "No unplaced source is exposed while decoding");
    await size(first, 176.25, 118);
    images[0].resolve(); await flush();
    assert.equal(images[0].crossOrigin, "anonymous", "Vault resource URLs remain canvas-readable");
    assert.match(first.style.backgroundImage, /data:image\/png/);
    assert.equal(first.style.backgroundSize, "100% 100%", "No second cover crop on rounded raster size");
    assert.equal(draws[0].width, 353);
    assert.equal(draws[0].height, 236);
    const [, sx, sy, sw, sh] = draws[0].args;
    assert.equal(sx + sw / 2, 600); assert.equal(sy + sh / 2, 337.5);
    assert.ok(Math.abs(sw / sh - 176.25 / 118) < 1e-12, "Centered crop retains exact CSS aspect ratio");
    const second = element(); setImage(second, "original.jpg"); await size(second, 176.25, 118);
    assert.equal(encodes, 1, "Same source and size share the cached preview");
    assert.equal(images.length, 1, "Source is decoded once per dashboard");
    await size(second, 76, 76);
    assert.equal(draws[1].width, 152); assert.equal(draws[1].args[3], draws[1].args[4]);
    win.devicePixelRatio = 2; media.at(-1).listener(); await flush();
    assert.ok(draws.some(d => d.width === 705 && d.height === 472));
    assert.ok(draws.some(d => d.width === 304 && d.height === 304));
    await size(second, 300, 300);
    assert.equal(draws.at(-1).width, 675, "2x headroom is capped to the cropped source resolution");
    assert.equal(draws.at(-1).height, 675);
    await size(second, 1500, 1500);
    assert.equal(second.style.backgroundImage, 'url("original.jpg")', "Never upscale a cached low-resolution preview");
    assert.ok(Math.abs(parseFloat(second.style.backgroundSize) - 8000 / 3) < 1e-9);
    assert.ok(second.style.backgroundSize.endsWith(" 1500px"));
    const placed = element();setImage(placed, "original.jpg", { key: "individual-card" });
    assert.equal(placed.style.backgroundImage, "none", "Saved placement never flashes the default crop");
    await size(placed, 76, 76);
    const crop = draws.at(-1).args;
    assert.equal(crop[1], 0, "Stored horizontal placement is applied to the sampled crop");
    assert.ok(Math.abs(crop[2] - 337.5) < 1e-9, "Stored vertical placement is applied");
    assert.ok(Math.abs(crop[3] - 337.5) < 1e-9, "Stored zoom determines source crop size");
    const savedPreview = placed.style.backgroundImage;
    observers[0].callback([{ target: placed, contentRect: { width: 77, height: 76 } }]);
    assert.equal(placed.style.backgroundImage, savedPreview, "Resize retains the placed image until its replacement is ready");
    await flush();

    const race = element(); setImage(race, "old.jpg"); await size(race, 76, 76);
    setImage(race, "new.jpg"); await size(race, 76, 76);
    images[2].resolve(); await flush(); const latest = race.style.backgroundImage;
    images[1].resolve(); await flush(); assert.equal(race.style.backgroundImage, latest);
    const failed = element(); setImage(failed, "missing.jpg"); await size(failed, 76, 76);
    images[3].reject(new Error("decode failed")); await flush();
    assert.equal(failed.style.backgroundImage, 'url("missing.jpg")');
    const animated = element(); setImage(animated, "animated.gif?mtime=1");
    assert.equal(observers[0].targets.has(animated), true, "Animated backgrounds can still have placement");
    first.isConnected = false; await size(second, 76, 76);
    assert.equal(observers[0].targets.has(first), false);
    const pending = element(); setImage(pending, "pending.jpg"); await size(pending, 76, 76);
    cleanup[0](); images[4].resolve(); await flush();
    assert.equal(pending.style.backgroundImage, 'none');
    assert.equal(observers[0].targets.size, 0); assert.equal(media.at(-1).listener, null);
    console.log("Card images passed: high-quality lossless downsampling, exact centered crops, shared cache, resize, DPR, source replacement races, failure fallback, no upscaling and disposal.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
