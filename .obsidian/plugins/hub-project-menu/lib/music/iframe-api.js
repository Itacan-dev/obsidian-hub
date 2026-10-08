"use strict";

const windows = new WeakMap();
const descriptions = {
    youtube: { callback: "onYouTubeIframeAPIReady", source: "https://www.youtube.com/iframe_api",
        read: window => window.YT?.Player ? window.YT : null, label: "YouTube" },
    spotify: { callback: "onSpotifyIframeApiReady", source: "https://open.spotify.com/embed/iframe-api/v1", label: "Spotify" }
};

// Share official API scripts within each Obsidian window, including reopened
// Music dialogs. Preserve another plugin's ready callback if one is installed.
function loadIframeAPI(document, provider) {
    const window = document.defaultView, description = descriptions[provider];
    let loaded = windows.get(window);
    if (!loaded) { loaded = new Map(); windows.set(window, loaded); }
    const available = description.read?.(window);
    if (available) return Promise.resolve(available);
    if (loaded.has(provider)) return loaded.get(provider);
    const promise = new Promise((resolve, reject) => {
        const script = document.createElement("script"), previous = window[description.callback];
        let settled = false;
        const restore = () => { if (window[description.callback] === ready) window[description.callback] = previous; };
        const fail = () => {
            if (settled) return; settled = true; clearTimeout(timer); restore(); script.remove();
            loaded.delete(provider); reject(new Error(`${description.label} could not load. Check your connection and try again.`));
        };
        const ready = api => {
            if (settled) return;
            const value = api || description.read?.(window);
            if (!value) { fail(); return; }
            settled = true; clearTimeout(timer); restore();
            try { previous?.(api); } catch (_) { /* Another plugin's callback does not own Music. */ }
            resolve(value);
        };
        const timer = setTimeout(fail, 15000); timer.unref?.();
        window[description.callback] = ready;
        script.src = description.source; script.async = true;
        script.addEventListener("error", fail, { once: true });
        document.head.appendChild(script);
    });
    loaded.set(provider, promise); return promise;
}

module.exports = { loadIframeAPI };
