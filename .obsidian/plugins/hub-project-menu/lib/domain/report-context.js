"use strict";

const { localISODate } = require("./dates");
const { normalizeFocusItems } = require("./focus");

function onDay(record, date) {
    const timestamp = Number(record.timestamp);
    return timestamp > 0 && localISODate(new Date(timestamp)) === date;
}

// Select by recorded identity, never by today's file location or workspace name.
function workspaceId(record) {
    return record.projectId || (record.resourceType ? `resource:${record.resourceType}` : null);
}

function captureReportContext(service, date, id) {
    const evidence = service.taskProgressEvidence?.() ?? {availability:"unavailable",records:[]};
    const select = records => (records ?? []).filter(record =>
        workspaceId(record) === id && onDay(record, date));
    return {
        version: 1,
        tasksAvailability: evidence.availability,
        tasks: select(evidence.records).map(task => ({
            id: task.id ?? null, text: task.text, timestamp: task.timestamp,
            ...(task.kind ? { kind: task.kind } : {}),
            ...(task.nativeHistory ? { nativeHistory: task.nativeHistory } : {}),
            ...(task.kind === "step" ? { parentTaskId: task.parentTaskId, parentText: task.parentText } : {}),
            ...(task.path ? { path: task.path } : {})
        })).sort((a, b) => a.timestamp - b.timestamp),
        activity: select(service.activityLog).map(item => ({
            action: item.action, title: item.title, oldTitle: item.oldTitle ?? null,
            timestamp: item.timestamp
        })).sort((a, b) => b.timestamp - a.timestamp),
        focus: normalizeFocusItems(service.dailyFocus?.[date])
            .filter(item => item.projectId === id).map(item => item.text)
    };
}

function savedReportContext(service, date, id, previous) {
    // Editing a past reflection must not rewrite its evidence from current data.
    if (previous?.version === 1 && date !== localISODate()) return previous;
    return captureReportContext(service, date, id);
}

function reportDay(service, date, scope = null) {
    const reports = service.getProgressReports(scope).filter(report => report.date === date)
        .map(report => ({ ...report, context: report.context?.version === 1
            ? report.context : captureReportContext(service, date, report.projectId) }));
    const recorded = service.data?.reportFocusByDate?.[date];
    // Pending focus is a single consumable list. Never borrow a different day's list.
    const nextFocus = normalizeFocusItems(recorded?.items ??
        (service.pendingFocus?.sourceDate === date ? service.pendingFocus.items : []));
    return { date, reports, nextFocus,
        sharedFocus: normalizeFocusItems(service.dailyFocus?.[date]).filter(item => !item.projectId) };
}

const activityLabels = {
    created: "created", edited: "edited", deleted: "deleted", renamed: "renamed",
    "project-created": "projects created", "project-renamed": "projects renamed",
    "project-deleted": "projects deleted"
};
function activitySummary(entries) {
    const counts = new Map();
    for (const entry of entries) counts.set(entry.action, (counts.get(entry.action) ?? 0) + 1);
    return [...counts].map(([action, count]) => `${count} ${activityLabels[action] ?? action}`).join(" · ");
}

module.exports = { captureReportContext, savedReportContext, reportDay, activitySummary };
