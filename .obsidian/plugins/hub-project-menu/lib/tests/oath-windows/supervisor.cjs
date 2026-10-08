"use strict";
const path = require("node:path"), { EventEmitter } = require("node:events");
class Supervisor extends EventEmitter {
    constructor(utilityProcess, timeoutMs = 2500) {
        super(); this.utilityProcess = utilityProcess; this.timeoutMs = timeoutMs; this.seq = 0; this.child = null; this.pending = null; this.stopped = false;
    }
    start() {
        if (this.stopped) throw Error("Supervisor stopped");
        if (this.child) return;
        const child = this.utilityProcess.fork(path.join(__dirname, "worker.cjs"), [], {
            env: { ...process.env, ELECTRON_RUN_AS_NODE: "", ITACAN_OATH_ADAPTER: "phase2" },
            stdio: "pipe", serviceName: "Itacan Phase 2 Windows observation", partition: "oath-phase2-observer"
        });
        this.child = child;
        child.stdout?.resume(); child.stderr?.resume();
        child.on("message", message => {
            if (this.child === child && message.stage) { this.emit("diagnostic", { stage: message.stage, durationMs: message.durationMs }); return; }
            if (this.child !== child || !this.pending || this.pending.id !== message.id) return;
            const item = this.pending; this.pending = null; clearTimeout(item.timer);
            message.error ? item.reject(Error(message.error)) : item.resolve(message.result);
        });
        child.on("exit", code => {
            if (this.child !== child) return;
            this.child = null; this.fail(Error("Utility exited: " + code)); this.emit("health", "exited");
        });
        child.on("error", () => { if (this.child === child) this.invalidate(Error("Utility error")); });
        this.emit("health", "started");
        this.heartbeat ??= setInterval(() => { if (this.child && !this.pending) this.child.postMessage({ action: "heartbeat" }); }, 1000);
    }
    fail(error) { if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; } }
    invalidate(error) {
        const old = this.child; this.child = null; this.fail(error); old?.kill(); this.emit("health", "unavailable");
    }
    request(action, extra = {}) {
        if (this.pending) return Promise.reject(Error("Adapter request already in flight"));
        if (!this.child || this.stopped) return Promise.reject(Error("Adapter unavailable; explicit bounded restart required"));
        return new Promise((resolve, reject) => {
            const id = ++this.seq;
            const timer = setTimeout(() => this.invalidate(Error("Adapter request timed out")), this.timeoutMs);
            this.pending = { id, timer, resolve, reject };
            try { this.child.postMessage({ ...extra, id, action }); } catch (error) { this.invalidate(error); }
        });
    }
    stop() { this.stopped = true; clearInterval(this.heartbeat); this.invalidate(Error("Adapter stopped")); }
}
module.exports = { Supervisor };
