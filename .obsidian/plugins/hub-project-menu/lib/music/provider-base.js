"use strict";

function cancelled() { const error = new Error("Music playback was stopped."); error.cancelled = true; return error; }
function clamp(value, maximum = 1) { return Math.max(0, Math.min(maximum, Number(value) || 0)); }

class MusicProvider {
    constructor(plugin, item, options = {}, capabilities = {}) {
        this.plugin = plugin; this.item = item; this.options = options;
        this.document = options.document || globalThis.document;
        this.element = this.document.createElement("div");
        this.element.className = "hub-music-provider-surface";
        this.capabilities = { play: false, pause: false, previous: false, next: false, seek: false,
            volume: false, progress: false, persistent: false, visiblePlayer: false, ...capabilities };
        this.destroyed = false; this.cleanups = [];
        this.stopped = new Promise(resolve => { this.resolveStopped = resolve; });
    }
    mount(host) { if (!this.destroyed && this.element.parentElement !== host) host.appendChild(this.element); }
    emit(state) { if (!this.destroyed) this.options.onState?.(state); }
    error(message) { if (!this.destroyed) { this.emit({ status: "error", message }); this.options.onError?.(message); } }
    listen(target, event, callback) {
        const guarded = (...args) => { if (!this.destroyed) callback(...args); };
        target.addEventListener(event, guarded);
        this.cleanups.push(() => target.removeEventListener(event, guarded));
    }
    async active(task) {
        const result = await Promise.race([task, this.stopped.then(() => { throw cancelled(); })]);
        if (this.destroyed) throw cancelled(); return result;
    }
    readyPromise(timeoutMessage, timeout = 20000) {
        let settled = false, timer;
        const promise = new Promise((resolve, reject) => {
            this.resolveReady = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
            this.rejectReady = error => { if (settled) return; settled = true; clearTimeout(timer); reject(error); };
            timer = setTimeout(() => this.rejectReady(new Error(timeoutMessage)), timeout);
            timer.unref?.();
        });
        // The operation may be cancelled while an asynchronous API is loading.
        promise.catch(() => {});
        this.cleanups.push(() => { clearTimeout(timer); this.rejectReady(cancelled()); });
        return promise;
    }
    suspend() { this.pause?.(); }
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true; this.resolveStopped();
        for (const cleanup of this.cleanups.splice(0)) { try { cleanup(); } catch (_) { /* Already detached. */ } }
        this.element.remove();
    }
}

module.exports = { MusicProvider, clamp, cancelled };
