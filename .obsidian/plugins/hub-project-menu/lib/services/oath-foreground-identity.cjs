"use strict";
const path = require("node:path"), fs = require("node:fs"), { randomUUID } = require("node:crypto");
// Portable adapter boundary: no Obsidian imports. Tokens describe an observation lifetime,
// not an OS-guaranteed HWND generation. Same-PID same-HWND reuse between polls is unknowable.
class Inventory {
    constructor(verifyPath = value => fs.realpathSync.native(value)) {
        this.verifyPath = verifyPath; this.live = new Map();
    }
    record(raw) {
        let executable = null, reason = null;
        try {
            if (!raw?.owner?.path || !path.win32.isAbsolute(raw.owner.path)) throw Error("missing absolute executable path");
            executable = path.win32.normalize(this.verifyPath(raw.owner.path)).toLowerCase();
        } catch { reason = "executable identity unavailable"; }
        if (!Number.isSafeInteger(raw?.id) || !Number.isInteger(raw?.owner?.processId) || raw.owner.processId <= 0) reason = "invalid window identity";
        return { handle: raw?.id ?? null, pid: raw?.owner?.processId ?? null, executable,
            title: typeof raw?.title === "string" ? raw.title : "", bounds: raw?.bounds ?? null,
            identity: reason ? "unknown" : "observed", reason, minimized: null };
    }
    update(rawWindows) {
        if (!Array.isArray(rawWindows)) { this.live.clear(); throw Error("Enumeration unavailable, not an empty desktop"); }
        const next = new Map();
        const windows = rawWindows.map(raw => {
            const value = this.record(raw), key = JSON.stringify([value.handle, value.pid, value.executable]);
            const previous = this.live.get(key);
            const record = { ...value, token: previous?.token ?? randomUUID() }; next.set(key, record); return record;
        });
        this.live = next; return windows;
    }
    resolve(token) {
        const value = [...this.live.values()].find(item => item.token === token);
        if (!value || value.identity !== "observed") throw Error("Stale or unknown window token");
        return value;
    }
}
module.exports = { Inventory };
