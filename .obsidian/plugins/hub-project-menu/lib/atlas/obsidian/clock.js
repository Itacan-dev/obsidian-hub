"use strict";

// Wall time persists across restarts; elapsed time prevents an in-process clock
// rewind from extending a lease. Core rejects wall time below saved checkpoints.
function createClock(wall = Date.now, monotonic = () => performance.now()) {
    const startWall = wall(), startElapsed = monotonic();
    return Object.freeze({ now() {
        const current = wall();
        if (!Number.isSafeInteger(current) || current < 0) return NaN;
        return Math.max(current, Math.floor(startWall + monotonic() - startElapsed));
    } });
}

module.exports = { createClock };
