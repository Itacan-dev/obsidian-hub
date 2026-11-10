"use strict";
const { randomUUID } = require("crypto");
const { applications, validPolicy, classifyWindows } = require("../domain/oath-strict");
class StrictOathCoordinator {
    constructor({ enabled = false, host = null, observer = null, now = Date.now, verifyExecutable = null } = {}) {
        this.enabled = enabled; this.host = host; this.observer = observer; this.now = now;
        this.sessionId = randomUUID(); this.current = null; this.lastFocus = -Infinity; this.generation = 0;
        this.verifyExecutable = verifyExecutable ?? (async value => {
            const fs = require("fs").promises;
            const resolved = await fs.realpath(value);
            if (!(await fs.stat(resolved)).isFile()) throw Error("Application is not a file.");
            return resolved;
        });
        this.health = { status: "disabled", warnings: [] }; this.listener = null; this.polling = false;
        this.host?.onLost?.(() => { void this.release(this.current?.id).catch(() => {}); });
    }
    setColors(payload) { this.host?.setColors?.(payload); }
    onHealth(listener) { this.listener = listener; }
    configureEnabled(value) { this.enabled = !!value; }
    update(health) { this.health = health; try { this.host?.updateDock?.(health); } catch (_) {} try { this.listener?.(health); } catch (_) {} }
    async retryRestoration() {
        if (this.current) throw Error("An active Strict Oath still owns this window.");
        await this.release();
    }
    async launch(executable, url = null) {
        const current = this.current;
        const requested = applications([executable])[0];
        let args = [];
        if (url != null) {
            const target = new URL(url);
            if (!requested.endsWith("\\firefox.exe") || !["https:", "http:"].includes(target.protocol)) throw Error("Website shortcuts require a permitted Firefox executable and an HTTP(S) address.");
            args = ["-new-tab", target.href];
        }
        if (!this.committed || !current?.policy.applications.includes(requested)) throw Error("This application is not permitted by your current active Oath.");
        const verified = await this.verifyApplications([requested]);
        if (!this.committed || this.current !== current || verified[0] !== requested) throw Error("Application permission changed. Return to Itacan.");
        if (!this.host.launch) throw Error("Application launch is unavailable in this host.");
        return this.host.launch(requested, args);
    }
    async verifyApplications(values) { return applications(await Promise.all(applications(values).map(value => this.verifyExecutable(value)))); }
    async preflight(policy) {
        if (!validPolicy(policy)) return { ready: false, blockers: [], warnings: ["Strict confirmation is missing or outdated."] };
        if (!this.enabled || !this.host) return { ready: false, blockers: [], warnings: ["Strict Oath is disabled pending review."] };
        if (this.current) return { ready: false, blockers: [], warnings: ["A Strict Oath already owns this window."] };
        try {
            await this.verifyApplications(policy.applications);
            const result = classifyWindows(await this.observer.listWindows(), policy, this.host.identity);
            return { ...result, ready: result.blockers.length === 0 };
        } catch (error) { return { ready: false, blockers: [], warnings: [error.message] }; }
    }
    owns(id, sessionId) { return this.current?.id === id && this.sessionId === sessionId; }
    async prepare(oath) {
        if (this.current) throw Error("A Strict Oath already owns this window.");
        const generation = this.generation;
        const preflight = await this.preflight(oath.policy);
        if (!preflight.ready) return { ready: false, preflight };
        try {
            if (generation !== this.generation) throw Error("Strict preparation was released.");
            await this.host.enter();
            // Close the gap between the preflight and native preparation.
            const recheck = classifyWindows(await this.observer.listWindows(), oath.policy, this.host.identity);
            if (generation !== this.generation) throw Error("Strict preparation was released.");
            if (recheck.blockers.length) { await this.host.release(); return { ready: false, preflight: { ...recheck, ready: false } }; }
            this.current = JSON.parse(JSON.stringify(oath)); this.committed = false; this.seen = new Set();
            await this.host.openDock?.(oath.policy, { launch: executable => this.launch(executable), focus: () => this.host.focus() });
            if (generation !== this.generation) throw Error("Strict preparation was released.");
            this.update({ status: "prepared", warnings: recheck.warnings });
            return { ready: true, sessionId: this.sessionId };
        } catch (error) { this.current = null; await this.host.release(); throw error; }
    }
    commit(id) {
        if (this.current?.id !== id) throw Error("Strict preparation lost.");
        this.committed = true;
        this.update({ status: "best-effort", warnings: this.health.warnings });
        this.schedule();
    }
    schedule() {
        clearTimeout(this.timer);
        if (this.current) { this.timer = setTimeout(() => void this.poll(), 5000); this.timer.unref?.(); }
    }
    async poll() {
        if (!this.current || this.polling) return;
        this.polling = true; const current = this.current;
        try {
            await this.host.maintain?.();
            if (this.current !== current) return;
            const result = classifyWindows(await this.observer.listWindows(), current.policy, this.host.identity);
            if (this.current !== current) return;
            const keys = new Set(result.blockers.map(item => `${item.pid}:${item.executable}`));
            const newlyDetected = [...keys].some(key => !this.seen.has(key)); this.seen = keys;
            const hostHealthy = this.host.healthy?.() ?? true;
            this.update({ status: result.blockers.length || result.unknown.length || !hostHealthy ? "degraded" : "best-effort",
                warnings: [...result.warnings, ...(!hostHealthy ? ["Fullscreen or the Oath dock could not be maintained. Your Oath remains active."] : []),
                    ...(result.blockers.length ? ["An unpermitted application is open. Return to your work when ready."] : [])] });
            // This is a nudge for a newly detected app, not a claim about foreground.
            if (newlyDetected && this.now() - this.lastFocus >= 15000) { this.lastFocus = this.now(); this.host.focus(); }
        } catch (error) { if (this.current === current) this.update({ status: "degraded", warnings: [error.message] }); }
        finally { this.polling = false; this.schedule(); }
    }
    async release(id) {
        if (this.current && this.current.id !== id) throw Error("Strict session mismatch.");
        this.generation++; this.current = null; this.committed = false; clearTimeout(this.timer); this.observer?.cancel?.();
        try { await this.host?.release(); this.update({ status: "idle", warnings: [] }); }
        catch (error) { this.update({ status: "recovery-required", warnings: [error.message, "Window guards are released. Retry restoration in Settings → The Oath."] }); throw error; }
    }
    detach() { this.listener = null; } // main-process ownership can survive renderer/plugin reload
}
module.exports = { StrictOathCoordinator };
