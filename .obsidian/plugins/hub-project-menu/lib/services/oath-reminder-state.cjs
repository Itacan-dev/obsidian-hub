"use strict";
// Reminder reducer. Time is injected and monotonic.
class ReminderState {
    constructor() { this.reset(); }
    reset() { this.state = "hidden"; this.since = null; this.lastSample = null; this.unknownSince = null; this.lastExternal = null; }
    sample(kind, now, label = "") {
        if (this.lastSample !== null && now - this.lastSample > 500) this.reset();
        this.lastSample = now;
        if (kind === "permitted") { this.reset(); this.lastSample = now; }
        else if (kind === "unknown") {
            this.since = null;
            this.unknownSince ??= now;
            if (this.state !== "visible" || now - this.unknownSince >= 500) this.state = "hidden";
        } else if (kind === "self") {
            this.unknownSince = null;
            // The reminder is never a return to permitted work.
        } else if (kind === "non-permitted") {
            this.unknownSince = null;
            this.lastExternal = label;
            this.since ??= now;
            if (this.state !== "visible") this.state = now - this.since >= 3000 ? "visible" : "pending";
        } else throw Error("Invalid foreground classification");
        return { visible: this.state === "visible", state: this.state, label: kind === "self" ? "" : this.lastExternal };
    }
}
module.exports = { ReminderState };
