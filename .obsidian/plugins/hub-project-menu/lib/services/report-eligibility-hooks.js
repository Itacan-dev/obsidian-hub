"use strict";
function installReportEligibilityHooks(plugin) {
    let userActivation = false;
    const trackDocument = doc => {
        const activation = event => {
            if (!event.isTrusted) return;
            userActivation = true; queueMicrotask(() => { userActivation = false; });
        };
        for (const type of ["click", "keydown"]) plugin.registerDomEvent(doc, type, activation, true);
        const reading = event => {
            if (!event.isTrusted || event.target.closest?.(".modal-container")) return;
            if (!event.target.closest?.(".markdown-source-view, .markdown-preview-view, .pdf-container")) return;
            const leaf = plugin.app.workspace.activeLeaf;
            if (!leaf?.containerEl?.contains(event.target)) return;
            plugin.reportEligibility.observe(plugin.workspaceModes.currentContext(), "content");
        };
        for (const type of ["pointerdown", "wheel", "keydown"]) plugin.registerDomEvent(doc, type, reading, true);
        plugin.registerDomEvent(doc, "click", event => {
            if (!event.isTrusted || !event.target.closest?.(".workspace-tab-header")) return;
            queueMicrotask(() => plugin.reportEligibility.observe(plugin.workspaceModes.currentContext(), "navigation"));
        });
    };
    trackDocument(document);
    plugin.registerEvent(plugin.app.workspace.on("window-open", (_workspace, win) => trackDocument(win.document)));
    plugin.registerEvent(plugin.app.workspace.on("file-open", file => {
        if (userActivation && plugin.workspaceModes.internalDepth === 0 && plugin.app.workspace.getActiveFile()?.path === file?.path) {
            plugin.reportEligibility.observe(plugin.workspaceModes.contextForFile(file.path), "navigation");
        }
    }));
    const mountExplorer = window.hubMountWorkspaceExplorer;
    if (mountExplorer) {
        const wrapped = options => mountExplorer({ ...options, createItem: async (...args) => {
            const workspace = plugin.workspaceModes.contextFor(options.dashboardPath);
            const result = await options.createItem(...args);
            if (result) plugin.reportEligibility.observe(workspace, "files");
            return result;
        } });
        window.hubMountWorkspaceExplorer = wrapped;
        plugin.register(() => { if (window.hubMountWorkspaceExplorer === wrapped) window.hubMountWorkspaceExplorer = mountExplorer; });
    }
    // Explicit shell entry points, rather than internal restoration/navigation callbacks.
    for (const name of ["hubOpenWorkspace", "hubOpenLastProject", "hubOpenLastResource", "hubOpenResourceFull", "hubOpenLastFile", "hubOpenProjectFull", "hubOpenProjectNote", "hubOpenFile"]) {
        const original = window[name]; if (typeof original !== "function") continue;
        const wrapped = function(...args) {
            const intentional = userActivation;
            const result = original.apply(this, args);
            if (intentional) Promise.resolve(result).then(ok => {
                if (ok !== false) plugin.reportEligibility.observe(plugin.workspaceModes.currentContext(), "navigation");
            }).catch(() => {});
            return result;
        };
        window[name] = wrapped;
        plugin.register(() => { if (window[name] === wrapped) window[name] = original; });
    }
    // Mutations made through the existing explicit file-command boundary only.
    const files = plugin.fileOperations;
    if (files) {
        const execute = files.execute;
        files.execute = function(kind, from, to, options = {}) {
            const workspace = plugin.workspaceModes.contextForFile(from);
            return execute.call(this, kind, from, to, options).then(result => {
                if (!options.compensation && !options.captureRecoveryHash) {
                    plugin.reportEligibility.observe(kind === "copy" ? plugin.workspaceModes.contextForFile(to) : workspace, "files");
                }
                return result;
            });
        };
        plugin.register(() => { files.execute = execute; });
    }
}
module.exports = { installReportEligibilityHooks };
