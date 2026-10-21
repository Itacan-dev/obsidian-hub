"use strict";
// Consumer-owned promise cache, invalidated by the one shared facade. It is not
// task authority. Failures are observable and retryable; old reads never publish.
class TaskReadSession {
    constructor(service, changed = () => {}) {
        this.service = service; this.generation = 0; this.cache = new Map(); this.closed = false;
        this.unsubscribe = service.subscribe(() => { this.invalidate(); changed(); });
    }
    invalidate() { this.generation++; this.cache.clear(); }
    async read(options, cancelled = () => false) {
        const key = JSON.stringify(options);
        while (!this.closed && !cancelled()) {
            const generation = this.generation;
            let pending = this.cache.get(key);
            if (!pending) {
                pending = Promise.resolve().then(() => this.service.queryStructured(options));
                this.cache.set(key, pending);
            }
            let result;
            try { result = await pending; }
            catch (error) { if (this.cache.get(key) === pending) this.cache.delete(key); if (this.closed || cancelled()) return null;
                if (generation !== this.generation) continue; throw error; }
            if (this.closed || cancelled()) return null;
            if (generation === this.generation) return result;
        }
        return null;
    }
    close() { if (this.closed) return; this.closed = true; this.invalidate(); this.unsubscribe(); }
}
module.exports = { TaskReadSession };
