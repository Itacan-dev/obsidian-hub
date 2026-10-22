"use strict";
const { localISODate, parseLocalISODate, itacanDay } = require("./dates");
const { reportDay, captureReportContext } = require("./report-context");
const { taskIsFuture, taskIsOverdue } = require("./task-planning");
const { normalizedTaskText } = require("./tasks");

/** @typedef {{kind: 'home'|'workspace'|'file'|'configuration', workspaceId?: string, path?: string, taskId?: string, stepId?: string, taskText?: string, taskLine?: number, stepText?: string}} BriefTarget */
/**
 * @typedef {Object} DailyBriefContext
 * @property {string} briefDate Local 06:00 day key; report dates keep their existing midnight boundary.
 * @property {string|null} lastWorkDate
 * @property {Array} days Meaningful historical dates, newest first, with ranked workspace facts.
 * @property {Array} workspaces Workspace facts for lastWorkDate.
 * @property {Array} relevantTasks Task facts reconstructed from recorded completions at the day boundary where possible.
 * @property {Array} overdueTasks
 * @property {Object|null} oathState
 * @property {BriefTarget} fallbackTarget
 */

const dailyBriefDay = itacanDay;
function dailyBriefStart(now = new Date()) {
    const date = parseLocalISODate(dailyBriefDay(now));
    date.setHours(6, 0, 0, 0);
    return date;
}

// Keep only the displayed recap, bounded to Last work and three earlier dates.
// The resolved recommendation is part of this artifact; no raw activity or current task trees are copied.
function dailyBriefSnapshot(context, recommendation) {
    return JSON.parse(JSON.stringify({ version: 1, dayKey: context.briefDate, recommendation,
        days: context.days.slice(0, 4).map(day => ({ ...day, workspaces: day.workspaces.map(workspace => ({
            workspaceId: workspace.workspaceId, workspaceName: workspace.workspaceName, workspaceType: workspace.workspaceType,
            significance: workspace.significance, progressSummary: workspace.progressSummary, taskProgress: workspace.taskProgress,
            nextFocus: workspace.nextFocus.map(({ available, ...focus }) => focus), lastRelevantFile: workspace.lastRelevantFile,
            lastActivityTime: workspace.lastActivityTime, fulfilledOaths: workspace.fulfilledOaths.map(({ id, timestamp }) => ({ id, timestamp }))
        })) })) }));
}
function briefFromSnapshot(snapshot) {
    const { dayKey, days, recommendation } = JSON.parse(JSON.stringify(snapshot));
    return { context: { briefDate: dayKey, lastWorkDate: days[0]?.date ?? null,
        days, workspaces: days[0]?.workspaces ?? [] }, recommendation };
}
const identity = value => value.projectId ?? (value.resourceType ? `resource:${value.resourceType}` : null);
const titleKey = text => normalizedTaskText(text).trim().toLocaleLowerCase();
const dateOf = value => Number(value) > 0 && Number.isFinite(new Date(Number(value)).getTime())
    ? localISODate(new Date(Number(value))) : null;
const byTime = (a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0);

function meaningfulWorkspace(workspace) {
    return !!(workspace.progressSummary?.trim() || workspace.significance > 0 ||
        workspace.taskProgress?.length || workspace.nextFocus?.length || workspace.fulfilledOaths?.length);
}
function rankWorkspaces(workspaces) {
    const relevance = workspace => workspace.nextFocus.some(focus => focus.available) ? 2 : workspace.continuations.length ? 1 : 0;
    return [...workspaces].sort((a, b) => (b.significance ?? 0) - (a.significance ?? 0) ||
        relevance(b) - relevance(a) || b.lastActivityTime - a.lastActivityTime || a.workspaceName.localeCompare(b.workspaceName));
}
function mergeProgress(records) {
    const result = new Map();
    for (const record of records) {
        const key = `${record.kind ?? "task"}:${record.hubTaskId ?? record.id ??
            JSON.stringify([record.timestamp, record.path, record.parentText, record.text])}`;
        if (!result.has(key) || byTime(result.get(key), record) <= 0) result.set(key, { ...record });
    }
    return [...result.values()].sort(byTime);
}
function matchesProgress(task, event) {
    if (task.nativeReference) return event.nativeHistory?.authorityId === task.nativeReference.authorityId && event.nativeHistory?.taskId === task.nativeReference.taskId;
    const id = event.kind === "step" ? event.parentTaskId : event.hubTaskId;
    return id ? task.hubTaskId === id : task.path === event.path &&
        titleKey(task.text) === titleKey(event.kind === "step" ? event.parentText : event.text);
}
function fileTarget(task, step) {
    if (task.nativeReference) return { kind: "native-task", workspaceId: task.workspaceId, authorityId: task.nativeReference.authorityId, owner: task.nativeReference.owner, taskId: task.id, stepId: step?.id ?? null };
    return { kind: "file", workspaceId: task.workspaceId, path: task.path, taskText: task.text, taskLine: task.line,
        ...(step ? { stepText: step.text } : {}),
        ...(task.hubTaskId ? { taskId: task.hubTaskId } : {}), ...(step?.hubTaskId ? { stepId: step.hubTaskId } : {}) };
}

// Inputs are existing services/selectors; the output is structured factual data.
// Availability is resolved here so providers never need vault or navigation APIs.
function buildDailyBriefContext(service, {
    now = new Date(), workspaces = [], tasks = [], workingConfigurations = [], oathState = null,
    resolvePath = () => null, resolveLink = () => null, canOpen = () => true, canOpenNative = () => false
} = {}) {
    const briefDate = dailyBriefDay(now), live = new Map(workspaces.map(workspace => [workspace.workspaceId, workspace]));
    const boundary = dailyBriefStart(now), cutoff = boundary.getTime();
    const history = service.completedTaskHistory ?? [];
    const beforeStart = record => Number(record.timestamp) > 0 && Number(record.timestamp) < cutoff;
    // A recorded completion after 06:00 must not erase the unfinished continuation
    // when the first brief is opened late. Untimestamped edits cannot be reconstructed.
    const completedAtBoundary = (item, parent = null) => {
        const records = history.filter(event => parent?.nativeReference ? matchesProgress(parent, event) && event.nativeHistory?.stepId === item.id : item.nativeReference ? matchesProgress(item, event) && event.kind !== "step" : parent ? event.kind === "step" && (item.hubTaskId
            ? event.hubTaskId === item.hubTaskId : matchesProgress(parent, event) && titleKey(event.text) === titleKey(item.text))
            : event.kind !== "step" && matchesProgress(item, event));
        return records.some(event => Number(event.timestamp) >= cutoff && Number(event.timestamp) <= now.getTime())
            ? records.some(beforeStart) : item.completed;
    };
    const relevantTasks = tasks.map(original => {
        const task = { ...original, completed: completedAtBoundary(original),
            steps: (original.steps ?? []).map(step => ({ ...step, completed: completedAtBoundary(step, original) })) };
        const workspace = live.get(task.workspaceId), path = resolvePath(task.path);
        return { ...task, path: path ?? task.path, steps: (task.steps ?? []).map(step => ({ ...step })),
            available: !!workspace?.available && !task.completed && !task.identityConflict && !task.nativeReadOnly && !taskIsFuture(task, boundary) && (task.nativeReference ? canOpenNative(task.nativeReference.owner) : !!path && canOpen(path)),
            future: taskIsFuture(task, boundary) };
    });
    const reports = [...service.getProgressReports(), ...service.getProgressReports({ kind: "resource" })];
    const oaths = new Map();
    for (const bucket of Object.values(service.data?.oathsByDevice ?? {})) {
        for (const oath of [...(bucket.history ?? []), bucket.current].filter(Boolean)) {
            if (!(oath.fulfilledAt > 0 || oath.state === "fulfilled") || !oath.workspace) continue;
            const timestamp = oath.fulfilledAt || oath.completedAt;
            if (!dateOf(timestamp)) continue;
            oaths.set(oath.id, { ...oath, timestamp, projectId: oath.workspace.type === "resource"
                ? `resource:${oath.workspace.id}` : oath.workspace.id });
        }
    }
    const dates = new Set([...reports.map(report => report.date), ...history.map(event => dateOf(event.timestamp)),
        ...Object.keys(service.data?.reportFocusByDate ?? {}), service.pendingFocus?.sourceDate,
        ...[...oaths.values()].map(oath => dateOf(oath.timestamp))]);
    const focusFact = (item, workspace) => {
        const matches = relevantTasks.filter(task => task.workspaceId === item.projectId).flatMap(task => {
            if (titleKey(task.text) === titleKey(item.text)) return [{ task, step: null }];
            return task.steps.filter(step => titleKey(step.text) === titleKey(item.text)).map(step => ({ task, step }));
        });
        if (matches.length) {
            const match = matches.length === 1 ? matches[0] : null;
            return { ...item, available: !!match?.task.available && !match?.step?.completed,
                target: match ? fileTarget(match.task, match.step) : null };
        }
        const link = item.text.match(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/)?.[1];
        const path = link ? resolveLink(link, workspace?.path) : null;
        return { ...item, available: !!workspace?.available && (link ? !!path && canOpen(path) : canOpen(workspace.path)),
            target: link ? (path ? { kind: "file", workspaceId: item.projectId, path } : null)
                : workspace ? { kind: "workspace", workspaceId: item.projectId, path: workspace.path } : null };
    };
    const days = [...dates].filter(date => parseLocalISODate(date) && date <= briefDate).sort().reverse().map(date => {
        const dayReports = reports.filter(report => report.date === date &&
            (date < briefDate ? !Number(report.timestamp) || beforeStart(report) : beforeStart(report) && dateOf(report.timestamp) === date));
        const dayHistory = history.filter(event => dateOf(event.timestamp) === date && beforeStart(event));
        const source = { ...service, getProgressReports: () => dayReports, completedTaskHistory: dayHistory };
        const day = reportDay(source, date);
        const focusRecord = service.data?.reportFocusByDate?.[date] ??
            (service.pendingFocus?.sourceDate === date ? service.pendingFocus : null);
        if (Number(focusRecord?.timestamp) >= cutoff || date === briefDate && !dayReports.length && !beforeStart(focusRecord ?? {})) day.nextFocus = [];
        const dayOaths = [...oaths.values()].filter(oath => dateOf(oath.timestamp) === date && beforeStart(oath));
        const ids = new Set([...dayReports.map(identity), ...dayHistory.map(identity), ...day.nextFocus.map(identity), ...dayOaths.map(identity)]);
        const facts = [...ids].filter(Boolean).map(id => {
            const workspace = live.get(id), report = day.reports.find(report => identity(report) === id);
            const events = dayHistory.filter(event => identity(event) === id);
            const progress = mergeProgress([...(report?.context.tasks ?? []).filter(beforeStart), ...captureReportContext(source, date, id).tasks]);
            const nextFocus = day.nextFocus.filter(item => item.projectId === id).map(item => focusFact(item, workspace));
            const fulfilledOaths = dayOaths.filter(oath => oath.projectId === id);
            const continuations = relevantTasks.filter(task => task.available && task.workspaceId === id &&
                progress.some(event => event.kind === "step" && matchesProgress(task, event)))
                .map(task => ({ task, nextStep: task.steps.find(step => !step.completed) ?? null,
                    lastProgressAt: Math.max(...progress.filter(event => matchesProgress(task, event)).map(event => Number(event.timestamp) || 0)) }))
                .sort((a, b) => b.lastProgressAt - a.lastProgressAt);
            const activity = (service.activityLog ?? []).filter(event => identity(event) === id && dateOf(event.timestamp) === date && beforeStart(event));
            const workingConfiguration = workingConfigurations.find(item => item.contextId === id) ?? null;
            const leaves = [];
            const visit = node => { if (node?.type === "leaf") leaves.push(node); for (const child of node?.children ?? []) visit(child); };
            visit(workingConfiguration?.layout?.main);
            const active = leaves.find(leaf => leaf.id === workingConfiguration?.layout?.active);
            const lastRelevantFile = active?.state?.state?.file;
            const focusRecord = service.data?.reportFocusByDate?.[date];
            return { workspaceId: id, workspaceName: report?.projectName ?? events[0]?.projectName ??
                nextFocus[0]?.projectName ?? fulfilledOaths[0]?.workspace.name ?? workspace?.name ?? "Unavailable workspace",
                workspaceType: id.startsWith("resource:") ? "resource" : "project",
                significance: report?.score ?? 0, progressSummary: report?.summary?.trim() ?? "",
                taskProgress: progress, nextFocus, continuations, fulfilledOaths, workingConfiguration,
                lastRelevantFile: lastRelevantFile && lastRelevantFile !== workingConfiguration.hubPath ? { kind: "file", workspaceId: id, path: lastRelevantFile } : null,
                lastActivityTime: Math.max(0, Number(report?.timestamp) || 0, Number(focusRecord?.timestamp) || 0,
                    ...progress.map(event => Number(event.timestamp) || 0), ...activity.map(event => Number(event.timestamp) || 0),
                    ...fulfilledOaths.map(oath => oath.timestamp)) };
        }).filter(meaningfulWorkspace);
        return { date, workspaces: rankWorkspaces(facts), hasReport: !!day.reports.length };
    }).filter(day => day.workspaces.length);
    const oathWorkspace = oathState?.active && live.get(oathState.workspaceId);
    const fallbackTarget = oathWorkspace?.available ? { kind: "workspace", workspaceId: oathWorkspace.workspaceId, path: oathWorkspace.path } : { kind: "home" };
    return { briefDate, lastWorkDate: days[0]?.date ?? null, days, workspaces: days[0]?.workspaces ?? [],
        relevantTasks, overdueTasks: relevantTasks.filter(task => task.available && taskIsOverdue(task, boundary)), oathState, fallbackTarget };
}
module.exports = { dailyBriefDay, dailyBriefStart, dailyBriefSnapshot, briefFromSnapshot, meaningfulWorkspace, rankWorkspaces, buildDailyBriefContext, matchesProgress };
