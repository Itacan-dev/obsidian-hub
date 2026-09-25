"use strict";

// Paths are the vault's file identity; rename hooks rewrite them. Workspace IDs
// are canonical projectId values, including the fixed resource:<type> IDs.
const HISTORY_LIMIT = 500;
const fileHistoryKey = entry => JSON.stringify([entry.contextId ?? null, entry.path ?? null]);
const validFileHistoryEntry = entry => !!entry && typeof entry === "object" &&
    (entry.contextId == null || typeof entry.contextId === "string") &&
    (entry.path == null || typeof entry.path === "string") && !!(entry.contextId || entry.path);

function uniqueHistory(entries, key = value => value) {
    const seen = new Set();
    return entries.filter(entry => {
        const id = key(entry);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    }).slice(0, HISTORY_LIMIT);
}

function rememberHistory(entries, entry, key) {
    return uniqueHistory([entry, ...entries], key);
}

// Seed once, without guessing recency between legacy per-workspace snapshots.
// Array presence is the migration marker, even when all entries were deleted.
function migrateNavigationHistory(state, contextForPath) {
    if (state.version === 4 && Array.isArray(state.workspaceHistory) && Array.isArray(state.fileHistory)) return false;
    let changed = false;
    const legacy = state.lastFile;
    const legacyContextId = legacy?.contextKind === "resource"
        ? `resource:${legacy.contextId}` : legacy?.contextId ??
            (legacy?.path ? contextForPath(legacy.path)?.projectId : null);
    if (!Array.isArray(state.workspaceHistory)) {
        const id = state.lastWorkspaceId || legacyContextId || state.lastProjectId ||
            (state.lastResourceId ? `resource:${state.lastResourceId}` : null);
        state.workspaceHistory = id ? [id] : [];
        changed = true;
    }
    if (!Array.isArray(state.fileHistory)) {
        const entries = [];
        if (legacy && (legacy.path || legacyContextId)) {
            entries.push({ path: legacy.path ?? null, contextId: legacyContextId ?? null });
        }
        for (const [contextId, saved] of Object.entries(state.projects ?? {})) {
            if (!saved) continue;
            const leaves = [];
            const visit = node => {
                if (node?.type === "leaf") leaves.push(node);
                for (const child of node?.children ?? []) visit(child);
            };
            visit(saved.layout?.main);
            leaves.sort((a, b) => Number(b.id === saved.layout.active) - Number(a.id === saved.layout.active));
            if (leaves[0]?.id === saved.layout?.active && leaves[0]?.state?.type === "webviewer") {
                entries.push({ contextId, path: null });
            }
            if (saved.lastNotePath) entries.push({ contextId, path: saved.lastNotePath });
            for (const leaf of leaves) {
                const path = leaf.state?.state?.file;
                if (path && path !== saved.hubPath) entries.push({ contextId, path });
                else if (leaf.state?.type === "webviewer") entries.push({ contextId, path: null });
            }
        }
        state.fileHistory = uniqueHistory(entries, fileHistoryKey);
        changed = true;
    }
    if (state.version !== 4) { state.version = 4; changed = true; }
    return changed;
}

module.exports = { HISTORY_LIMIT, fileHistoryKey, validFileHistoryEntry, uniqueHistory, rememberHistory, migrateNavigationHistory };
