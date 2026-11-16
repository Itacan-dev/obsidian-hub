"use strict";
// Reporting eligibility only. No interaction history, duration, or productivity scoring.
const { localISODate, parseLocalISODate } = require("../domain/dates");
const { savedReportContext } = require("../domain/report-context");
const { validateFocusItems } = require("../domain/focus");
const clone = value => JSON.parse(JSON.stringify(value ?? {}));
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const validScore = n => Number.isInteger(n) && n >= 0 && n <= 4;
const idOf = w => w?.contextKind === "resource" ? `resource:${w.resourceType}` : w?.projectId;
const fields = id => id.startsWith("resource:")
    ? ["resourceWorkRatings", "resourceWorkLogs", id.slice(9)] : ["projectWorkRatings", "projectWorkLogs", id];
function stored(data, date, id) {
    const [ratings, logs, key] = fields(id);
    return { rating: data[ratings]?.[key]?.[date] ?? null, log: data[logs]?.[key]?.[date] ?? null };
}
function publish(wizard, data) {
    // Keep unrelated state that may have advanced while persistence was pending.
    for (const key of ["projectWorkRatings", "projectWorkLogs", "resourceWorkRatings", "resourceWorkLogs", "reportEngagementByDevice", "reportFocusByDate", "pendingFocus"]) {
        if (has(data, key)) { wizard.data[key] = data[key]; if (key in wizard) wizard[key] = data[key]; }
    }
}
async function saveProgress(wizard, input) {
    const { date, entries = [], cutoffs = {}, dismiss = {}, deviceId = wizard.store.deviceId, focus } = input;
    if (!parseLocalISODate(date) || date > localISODate()) throw Error("Choose today or an earlier date.");
    const seen = new Set();
    for (const entry of entries) {
        if (seen.has(entry.id)) throw Error("Duplicate report workspace."); seen.add(entry.id);
        if (has(entry, "rating") && entry.rating !== null && !validScore(entry.rating)) throw Error("Invalid progress rating.");
        if (has(entry, "summary") && (typeof entry.summary !== "string" || entry.summary.length > 1000)) throw Error("Reflection must contain at most 1000 characters.");
    }
    const focusItems = focus === undefined ? undefined : validateFocusItems(focus);
    const mutate = data => {
        for (const entry of entries) {
            const previous = stored(data, date, entry.id);
            if (entry.expected && JSON.stringify(previous) !== JSON.stringify(entry.expected)) {
                const error = Error("This report changed. Review the latest saved value before retrying.");
                error.code = "REPORT_CONFLICT"; error.workspaceId = entry.id; error.latest = previous; throw error;
            }
            const workspace = entry.id.startsWith("resource:") ? wizard.getResourceById(entry.id.slice(9)) : wizard.getProjectById(entry.id);
            if (!workspace && !previous.log && previous.rating === null) throw Error("Workspace is no longer available.");
            const rating = has(entry, "rating") ? entry.rating : previous.rating;
            const summary = has(entry, "summary") ? entry.summary.trim() : previous.log?.summary ?? "";
            const [rk, lk, key] = fields(entry.id);
            data[rk] ??= {}; data[lk] ??= {}; data[rk][key] ??= {}; data[lk][key] ??= {};
            delete data[rk][key][date]; delete data[lk][key][date];
            if (validScore(rating)) data[rk][key][date] = rating;
            if (validScore(rating) || summary) {
                const context = savedReportContext(wizard, date, entry.id, previous.log?.context);
                // A cache refresh is not evidence that previously recorded completions disappeared.
                if (context.tasksAvailability !== "current" && previous.log?.context?.tasksAvailability === "current") {
                    context.tasks = clone(previous.log.context.tasks); context.tasksAvailability = "current";
                }
                data[lk][key][date] = { ...previous.log, summary, context,
                    [entry.id.startsWith("resource:") ? "resourceName" : "projectName"]: previous.log?.resourceName ?? previous.log?.projectName ?? workspace?.label ?? workspace?.name ?? "Unavailable workspace",
                    timestamp: previous.log?.timestamp || Date.now(), updatedAt: Date.now() };
            }
        }
        if (focusItems !== undefined) {
            data.reportFocusByDate = { ...data.reportFocusByDate, [date]: { items: focusItems } };
            if (date === localISODate()) data.pendingFocus = { sourceDate: date, items: focusItems };
        }
        const buckets = data.reportEngagementByDevice ??= {};
        const days = buckets[deviceId] ??= {};
        const day = days[date] ??= {};
        for (const [id, cutoff] of Object.entries(cutoffs)) {
            const value = stored(data, date, id);
            if (!seen.has(id) || (!validScore(value.rating) && !value.log?.summary)) continue;
            const row = day[id] ??= {};
            row.observedRevision = Math.max(row.observedRevision || 0, cutoff);
            row.reportedThrough = Math.max(row.reportedThrough || 0, cutoff);
        }
        for (const [id, cutoff] of Object.entries(dismiss)) {
            const row = day[id] ??= {};
            row.observedRevision = Math.max(row.observedRevision || 0, cutoff);
            row.dismissedThrough = Math.max(row.dismissedThrough || 0, cutoff);
        }
    };
    let result;
    if (wizard.store.updateProgress) result = await wizard.store.updateProgress(mutate);
    else { result = clone(wizard.data); mutate(result); await wizard.store.save(result); }
    publish(wizard, result);
    return result;
}
class ReportEligibility {
    constructor(plugin) {
        this.plugin = plugin; this.wizard = plugin.projectWizard; this.deviceId = plugin.dataStore.deviceId;
        this.state = clone(this.wizard.data.reportEngagementByDevice?.[this.deviceId]);
        this.receiptKey = "itacan-report-dismissal:" + (plugin.app.vault.adapter.getBasePath?.() ?? plugin.app.vault.getName()) + ":" + this.deviceId;
        try {
            const receipts = JSON.parse(globalThis.localStorage?.getItem(this.receiptKey) || "{}");
            for (const [date, rows] of Object.entries(receipts)) for (const [id, revision] of Object.entries(rows)) {
                if (!Number.isSafeInteger(revision) || revision < 0 || !parseLocalISODate(date)) continue;
                const row = (this.state[date] ??= {})[id] ??= {};
                row.observedRevision = Math.max(row.observedRevision || 0, revision);
                row.dismissedThrough = Math.max(row.dismissedThrough || 0, revision);
            }
        } catch (_) { /* Corrupt local recovery metadata never prevents opening Itacan. */ }
        // Capture startup counters once per plugin activation. Service reconstruction
        // during an audit keeps the same baseline; no session history is persisted.
        this.sessionBaseline = plugin.reportSessionBaseline ??= Object.fromEntries(
            Object.entries(this.state).map(([date, rows]) => [date, Object.fromEntries(
                Object.entries(rows).map(([id, row]) => [id, row.observedRevision || 0])
            )])
        );
        this.tail = Promise.resolve();
        plugin.register?.(() => this.destroy());
    }
    observe(workspace, reason, operationId = null) {
        const id = typeof workspace === "string" ? workspace : idOf(workspace);
        if (!id || !(id.startsWith("resource:") ? this.wizard.getResourceById(id.slice(9)) : this.wizard.getProjectById(id))) return;
        const day = this.state[localISODate()] ??= {}, row = day[id] ??= {};
        // Retain only the latest local task receipt, never a task interaction log.
        if (operationId && row.lastTaskOperation === operationId) return;
        if (operationId) row.lastTaskOperation = operationId;
        row.observedRevision = (row.observedRevision || 0) + 1; row.lastObservedAt = Date.now();
        row.reasons = [...new Set([...(row.reasons ?? []), reason])];
        if (!this.timer) this.timer = setTimeout(() => { this.timer = null; this.flush().catch(error => console.error("Could not persist report eligibility", error)); }, 100);
    }
    cutoff(date, ids = Object.keys(this.state[date] ?? {})) {
        return Object.fromEntries(ids.map(id => [id, this.state[date]?.[id]?.observedRevision || 0]));
    }
    pending(date, { currentSession = false } = {}) {
        const persisted = this.wizard.data.reportEngagementByDevice?.[this.deviceId]?.[date] ?? {};
        return Object.keys(this.state[date] ?? {}).filter(id => {
            const row = this.state[date][id], saved = persisted[id] ?? {};
            return row.observedRevision > Math.max(
                currentSession ? this.sessionBaseline[date]?.[id] || 0 : 0,
                row.reportedThrough || 0, row.dismissedThrough || 0, saved.reportedThrough || 0, saved.dismissedThrough || 0
            );
        });
    }
    flush() {
        clearTimeout(this.timer); this.timer = null;
        const snapshot = clone(this.state);
        this.tail = this.tail.catch(() => {}).then(async () => {
            const data = await this.plugin.dataStore.updateProgress(data => {
                const days = (data.reportEngagementByDevice ??= {})[this.deviceId] ??= {};
                for (const [date, rows] of Object.entries(snapshot)) for (const [id, source] of Object.entries(rows)) {
                    const target = (days[date] ??= {})[id] ??= {};
                    for (const key of ["observedRevision", "reportedThrough", "dismissedThrough", "lastObservedAt"]) target[key] = Math.max(target[key] || 0, source[key] || 0);
                    target.reasons = [...new Set([...(target.reasons ?? []), ...(source.reasons ?? [])])];
                    if (source.lastTaskOperation) target.lastTaskOperation = source.lastTaskOperation;
                }
            });
            publish(this.wizard, data);
            // The receipt has now reached the durable store; a later skip writes a new one.
            try {
                const receipts = JSON.parse(globalThis.localStorage?.getItem(this.receiptKey) || "{}");
                for (const [date, rows] of Object.entries(receipts)) for (const [id, revision] of Object.entries(rows)) {
                    if ((data.reportEngagementByDevice?.[this.deviceId]?.[date]?.[id]?.dismissedThrough || 0) >= revision) delete rows[id];
                }
                globalThis.localStorage?.setItem(this.receiptKey, JSON.stringify(receipts));
            } catch (_) {}
        });
        return this.tail;
    }
    dismiss(date, cutoffs) {
        try {
            const receipts = JSON.parse(globalThis.localStorage?.getItem(this.receiptKey) || "{}");
            const day = receipts[date] ??= {};
            for (const [id, revision] of Object.entries(cutoffs)) day[id] = Math.max(day[id] || 0, revision);
            globalThis.localStorage?.setItem(this.receiptKey, JSON.stringify(receipts));
        } catch (error) { console.error("Could not persist report dismissal", error); }
        for (const [id, revision] of Object.entries(cutoffs)) {
            const row = (this.state[date] ??= {})[id] ??= {};
            row.dismissedThrough = Math.max(row.dismissedThrough || 0, revision);
        }
    }
    destroy() { clearTimeout(this.timer); this.timer = null; }
}
module.exports = { saveProgress, ReportEligibility, stored, idOf, validScore };
