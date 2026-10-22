"use strict";
// Ephemeral accepted completion input for synchronous report capture; never persisted as History.
function attachNativeReportEvidence(plugin, host) {
    let closed = false, generation = 0, value = null, running = null, pending = false;
    const wizard = plugin.projectWizard;
    const read = () => value ? { availability: "current", records: value.records } : { availability: "unavailable", records: [] };
    wizard.taskProgressEvidence = read;
    const notify = () => document.dispatchEvent(new Event("hub-task-progress-evidence-changed"));
    const refresh = () => {
        if (closed) return; generation++; value = null; pending = true;
        if (!running) running = (async () => { while (pending && !closed) { pending = false; const ticket = generation;
            try { const result = await host.completionFeed.read(); if (!closed && ticket === generation) value = result; } catch (_) { /* Unavailable is explicit, not an empty complete input. */ }
            if (!closed) notify();
        } })().finally(() => { running = null; if (pending && !closed) refresh(); });
        return running;
    };
    const stop = host.completionFeed.subscribe(refresh); void refresh();
    plugin.register(() => { closed = true; value = null; generation++; stop(); if (wizard.taskProgressEvidence === read) delete wizard.taskProgressEvidence; });
}
module.exports = { attachNativeReportEvidence };
