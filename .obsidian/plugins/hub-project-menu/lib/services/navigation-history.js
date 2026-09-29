"use strict";

const { itacanDay } = require("../domain/dates");
const { TFile } = require("obsidian");
const { prepareNoteLayout, browserViewState } = require("../domain/navigation");
const { fileHistoryKey, validFileHistoryEntry, uniqueHistory, rememberHistory, migrateNavigationHistory } = require("../domain/navigation-history");

class HubNavigationHistory {
    constructor(modes) { this.modes = modes; }
    get state() { return this.modes.state; }
    initialize() {
        if (migrateNavigationHistory(this.state, path => this.modes.contextFor(path))) this.modes.saveState();
    }
    file(path) { return path ? this.modes.app.vault.getAbstractFileByPath(path) : null; }
    context(id) { return id ? this.modes.contextFor(id) : null; }
    exists(context) { return !!context && this.file(context.path) instanceof TFile; }
    allowed(reference) { return this.modes.plugin.oath?.canOpen(reference, false) !== false; }
    eligibleContext(context) {
        return this.exists(context) && (context.contextKind === "resource" || context.status === "active") && this.allowed(context);
    }
    eligiblePath(path) {
        const owner = this.modes.contextFor(path);
        return this.file(path) instanceof TFile &&
            (!owner || owner.contextKind === "resource" || owner.status === "active") && this.allowed(path);
    }
    rememberWorkspace(context) {
        this.initialize();
        this.state.workspaceHistory = rememberHistory(this.state.workspaceHistory.filter(id => typeof id === "string"), context.projectId);
    }
    rememberFile(context, file = null) {
        this.initialize();
        this.state.fileHistory = rememberHistory(this.state.fileHistory.filter(validFileHistoryEntry),
            { contextId: context?.projectId ?? null, path: file?.path ?? null }, fileHistoryKey);
    }
    rememberConfiguration(context, configuration, now = Date.now(), worked = false) {
        const saved = this.state.projects[context.projectId] ??= {};
        const day = itacanDay(new Date(now));
        const latest = saved.configurations?.[0];
        if (latest && (!worked || latest.day === day)) {
            const { capturedAt, day, ...previous } = latest;
            if (JSON.stringify(previous) === JSON.stringify(configuration)) return;
        }
        // Latest configuration for this work day plus the previous worked day.
        // Both use the existing Preset/Last File native layout format.
        const legacy = !saved.configurations ? this.configurationAt(context.projectId, now) : null;
        const previous = (saved.configurations ?? (legacy ? [{ ...legacy, capturedAt: 0, day: "legacy" }] : [])).filter(item => item.day !== day).slice(0, 1);
        saved.configurations = JSON.parse(JSON.stringify([{ ...configuration, capturedAt: now, day }, ...previous]));
    }
    configurationAt(contextId, before) {
        const saved = this.state.projects[contextId];
        if (!saved) return null;
        const found = saved.configurations?.find(item => item.capturedAt < before);
        if (found) return JSON.parse(JSON.stringify(found));
        // Legacy Last File layouts have no time evidence; never invent a date.
        if (!saved.configurations && saved.layout) return JSON.parse(JSON.stringify({
            contextId, hubPath: saved.hubPath ?? this.context(contextId)?.path,
            root: this.context(contextId)?.root, layout: saved.layout, capturedAt: null
        }));
        return null;
    }
    prune() {
        this.initialize();
        const workspaces = uniqueHistory(this.state.workspaceHistory.filter(id => typeof id === "string" && this.exists(this.context(id))));
        const files = uniqueHistory(this.state.fileHistory.filter(entry => {
            if (!validFileHistoryEntry(entry)) return false;
            const context = this.context(entry.contextId);
            if (entry.contextId && !this.exists(context)) return false;
            if (entry.path) return this.file(entry.path) instanceof TFile && entry.path !== "Home.md" &&
                this.modes.contextFor(entry.path)?.path !== entry.path;
            // Browser availability is temporary; do not prune because its plugin
            // is disabled or because an Oath filters the saved workspace.
            const hasBrowser = node => !!browserViewState(node?.state) || (node?.children ?? []).some(hasBrowser);
            return !!context && hasBrowser(this.state.projects[context.projectId]?.layout?.main);
        }), fileHistoryKey);
        if (JSON.stringify(workspaces) !== JSON.stringify(this.state.workspaceHistory) ||
            JSON.stringify(files) !== JSON.stringify(this.state.fileHistory)) {
            this.state.workspaceHistory = workspaces;
            this.state.fileHistory = files;
            this.modes.saveState();
        }
    }
    workspace() {
        this.prune();
        return this.state.workspaceHistory.map(id => this.context(id)).find(context => this.eligibleContext(context)) ?? null;
    }
    layout(context, entry) {
        if (!context) return null;
        const layout = prepareNoteLayout(this.state.projects[context.projectId]?.layout, context.path,
            path => this.eligiblePath(path), type => this.modes.canRestoreLayoutView(type));
        if (!layout) return null;
        const leaves = [];
        const visit = node => {
            if (node.type === "leaf") leaves.push(node);
            for (const child of node.children ?? []) visit(child);
        };
        visit(layout.main);
        const matches = leaf => entry.path ? leaf.state?.state?.file === entry.path : !!browserViewState(leaf.state);
        const active = leaves.find(leaf => leaf.id === layout.active && matches(leaf)) || leaves.find(matches);
        if (!active) return null;
        layout.active = active.id;
        const select = node => {
            if (node.type === "leaf") return node.id === active.id;
            const selected = (node.children ?? []).map(select).findIndex(Boolean);
            if (selected >= 0 && node.type === "tabs") node.currentTab = selected;
            return selected >= 0;
        };
        select(layout.main);
        return layout;
    }
    resolveFile(scopeId = null) {
        this.prune();
        for (const entry of this.state.fileHistory) {
            if (scopeId && entry.contextId !== scopeId) continue;
            const context = this.context(entry.contextId) || (entry.path ? this.modes.contextFor(entry.path) : null);
            if (context && !this.eligibleContext(context)) continue;
            if (entry.path && (!this.eligiblePath(entry.path) ||
                (context && !this.modes.contextContainsFile(context, entry.path)))) continue;
            const layout = this.layout(context, entry);
            if (!entry.path && !layout) continue;
            return { entry, context, file: this.file(entry.path), layout };
        }
        return null;
    }
    rewritePaths(rewrite) {
        this.initialize();
        const entries = uniqueHistory(this.state.fileHistory.filter(validFileHistoryEntry).map(entry =>
            ({ ...entry, path: rewrite(entry.path) })), fileHistoryKey);
        if (JSON.stringify(entries) === JSON.stringify(this.state.fileHistory)) return false;
        this.state.fileHistory = entries;
        return true;
    }
    deletePath(path) {
        this.initialize();
        const removed = value => value === path || value?.startsWith(`${path}/`);
        const deletedContexts = new Set(Object.entries(this.state.projects ?? {})
            .filter(([, saved]) => removed(saved?.hubPath)).map(([id]) => id));
        for (const id of this.state.workspaceHistory) if (removed(this.context(id)?.path)) deletedContexts.add(id);
        const workspaces = this.state.workspaceHistory.filter(id => !deletedContexts.has(id));
        const files = this.state.fileHistory.filter(entry => validFileHistoryEntry(entry) && !deletedContexts.has(entry.contextId) && !removed(entry.path));
        const changed = workspaces.length !== this.state.workspaceHistory.length || files.length !== this.state.fileHistory.length;
        this.state.workspaceHistory = workspaces;
        this.state.fileHistory = files;
        return changed;
    }
}

module.exports = { HubNavigationHistory };
