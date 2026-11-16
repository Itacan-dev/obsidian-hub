"use strict";
const { randomUUID } = require("crypto");
const { applications, validPolicy, classifyWindows } = require("../domain/oath-strict");
class StrictOathCoordinator {
    constructor({ enabled = false, host = null, observer = null, now = Date.now, verifyExecutable = null, createReminder = null } = {}) {
        this.createReminder = createReminder; this.enabled = enabled; this.host = host; this.observer = observer; this.now = now;
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
    update(health) {
        if (this.current?.policy.confirmationVersion === 4 && this.reminderUnavailable) health = { ...health, reminder: "unavailable", status: "degraded", warnings: [...(health.warnings ?? []).filter(w => !w.startsWith("The Oath Reminder is unavailable")), "The Oath Reminder is unavailable. Your Oath remains active."] };
        this.health = health; try { this.host?.updateDock?.(health); } catch (_) {} try { this.listener?.(health); } catch (_) {} }
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
            if (oath.policy.confirmationVersion === 4) {
                this.reminderUnavailable = false;
                if (!this.createReminder) throw Error("Oath Reminder is unavailable in this host.");
                this.reminder = await this.createReminder(oath.policy);
                if (generation !== this.generation) throw Error("Strict preparation was released.");
            }
            await this.host.enter();
            // Close the gap between the preflight and native preparation.
            const recheck = classifyWindows(await this.observer.listWindows(), oath.policy, this.host.identity);
            if (generation !== this.generation) throw Error("Strict preparation was released.");
            if (recheck.blockers.length) { this.reminder?.dispose(); this.reminder = null; await this.host.release(); return { ready: false, preflight: { ...recheck, ready: false } }; }
            this.current = JSON.parse(JSON.stringify(oath)); this.committed = false; this.seen = new Set();
            this.monitor = {
                baseline: this.applicationPaths(recheck), previous: new Set(), handled: new Set(),
                attempts: 0, lastAttempt: -Infinity, lastEvent: null
            };
            await this.host.openDock?.(oath.policy, { launch: executable => this.launch(executable), focus: () => this.host.focus() });
            if (generation !== this.generation) throw Error("Strict preparation was released.");
            this.update({ ...recheck, status: "prepared" });
            return { ready: true, sessionId: this.sessionId };
        } catch (error) { this.reminder?.dispose(); this.reminder = null; this.current = null; this.monitor = null; await this.host.release(); throw error; }
    }
    commit(id) {
        if (this.current?.id !== id) throw Error("Strict preparation lost.");
        this.committed = true;
        if (this.current.fulfilledAt == null) this.reminder?.start();
        else this.fulfill(id);
        this.update({ ...this.health, status: this.health.unknown?.length || this.health.uncertain?.length || this.health.coverageLimited ? "degraded" : "best-effort" });
        this.schedule();
    }
    fulfill(id) {
        if (this.current?.id !== id) return;
        this.reminder?.dispose(); this.reminder = null;
    }
    schedule() {
        clearTimeout(this.timer);
        if (this.current) { this.timer = setTimeout(() => void this.poll(), 5000); this.timer.unref?.(); }
    }
    applicationPaths(result) {
        return new Set([...result.candidates, ...result.uncertain].map(item => item.executable));
    }
    monitorApplications(result) {
        const monitor = this.monitor;
        const paths = this.applicationPaths(result);
        const eligible = [...paths].filter(executable =>
            !monitor.baseline.has(executable) && !monitor.handled.has(executable) && monitor.previous.has(executable));
        monitor.previous = paths;
        if (!eligible.length) return;
        for (const executable of eligible) monitor.handled.add(executable);
        const now = this.now();
        let outcome = "attempted";
        if (monitor.attempts >= 3) outcome = "budget-exhausted";
        else if (now - monitor.lastAttempt < 60000) outcome = "cooldown";
        monitor.lastEvent = { observedAt: now, applications: eligible, outcome };
        if (outcome !== "attempted") return;
        monitor.attempts++;
        monitor.lastAttempt = now;
        try { this.host.focus(); }
        catch { monitor.lastEvent.outcome = "focus-error"; }
    }
    monitoringStatus() {
        const monitor = this.monitor;
        return { attempts: monitor.attempts, limit: 3, lastEvent: monitor.lastEvent };
    }
    async poll() {
        if (!this.current || !this.committed || this.polling) return;
        this.polling = true; const current = this.current;
        try {
            await this.host.maintain?.();
            if (this.current !== current) return;
            const result = classifyWindows(await this.observer.listWindows(), current.policy, this.host.identity);
            if (this.current !== current) return;
            const bounded = current.policy.confirmationVersion === 3;
            let newlyDetected = false;
            if (bounded) this.monitorApplications(result);
            else if (current.policy.confirmationVersion < 4) {
                const keys = new Set(result.blockers.map(item => `${item.pid}:${item.executable}`));
                newlyDetected = [...keys].some(key => !this.seen.has(key));
                this.seen = keys;
            }
            const hostHealthy = this.host.healthy?.() ?? true;
            this.update({ ...result, ...(bounded ? { monitoring: this.monitoringStatus() } : {}), status: result.blockers.length || result.unknown.length || result.uncertain.length || result.coverageLimited || !hostHealthy ? "degraded" : "best-effort",
                warnings: [...result.warnings, ...(!hostHealthy ? ["Fullscreen or the Oath dock could not be maintained. Your Oath remains active."] : []),
                    ...(result.blockers.length ? ["A possible non-permitted application was detected. Its switchability is unverified. Return to your work when ready."] : [])] });
            // This is a nudge for a newly detected app, not a claim about foreground.
            if (newlyDetected && this.now() - this.lastFocus >= 15000) { this.lastFocus = this.now(); this.host.focus(); }
        } catch (error) {
            if (this.current === current) {
                if (this.monitor) this.monitor.previous.clear();
                this.update({ ...this.health, status: "degraded", warnings: [error.message] });
            }
        }
        finally { this.polling = false; this.schedule(); }
    }
    async release(id) {
        if (this.current && this.current.id !== id) throw Error("Strict session mismatch.");
        this.generation++; this.reminder?.dispose(); this.reminder = null; this.current = null; this.committed = false; this.monitor = null; this.seen = null; clearTimeout(this.timer); this.observer?.cancel?.();
        try { await this.host?.release(); this.update({ status: "idle", warnings: [] }); }
        catch (error) { this.update({ status: "recovery-required", warnings: [error.message, "Window guards are released. Retry restoration in Settings → The Oath."] }); throw error; }
    }
    detach() { this.listener = null; } // main-process ownership can survive renderer/plugin reload
}
module.exports = { StrictOathCoordinator };
