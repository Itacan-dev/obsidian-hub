"use strict";
const { dailyBriefDay } = require("../domain/daily-brief");

// Foreground activations arm one attempt. Hydration can finish that attempt;
// ordinary data updates and the passage of 06:00 cannot arm another one.
class DailyBriefTrigger {
    constructor({ now = () => new Date(), ready, blocked, shownDay, load, open, persist, report = console.error }) {
        Object.assign(this, { now, ready, blocked, shownDay, load, open, persist, report });
        this.activation = 0; this.sessionShown = new Set(); this.foreground = false; this.pending = false; this.running = null; this.disposed = false;
    }
    activate() {
        if (this.disposed || this.foreground) return this.running;
        this.foreground = true; this.pending = true; this.activation++;
        return this.resume();
    }
    background() { this.foreground = false; this.pending = false; this.activation++; }
    resume() {
        if (this.disposed || this.running || !this.foreground || !this.pending || !this.ready()) return this.running;
        this.running = this.attempt().catch(error => { this.pending = false; this.report("Daily Brief could not open", error); })
            .finally(() => { this.running = null; if (this.pending && this.foreground && this.ready()) void this.resume(); });
        return this.running;
    }
    async attempt() {
        const day = dailyBriefDay(this.now()), activation = this.activation;
        if (this.blocked() || this.shownDay() === day || this.sessionShown.has(day)) { this.pending = false; return; }
        const brief = await this.load(this.now());
        if (this.disposed || !this.foreground || !this.pending || activation !== this.activation) return;
        // A slow hydration/provider must never open the previous day's brief.
        if (dailyBriefDay(this.now()) !== day || this.blocked()) { this.pending = false; return; }
        if (!this.ready()) return;
        this.pending = false;
        if (!brief?.context.lastWorkDate || !await this.open(brief)) return;
        this.sessionShown.add(day);
        await this.persist(day);
    }
    destroy() { this.disposed = true; this.pending = false; }
}
module.exports = { DailyBriefTrigger };
