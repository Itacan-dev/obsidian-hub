"use strict";
const { refreshHeaderImages } = require("../ui/header-image");

class HubTransitionService {
    constructor() {
        this.navigatingRoots = new WeakSet();
        this.presentations = new Map();
        this.destroyed = false;
    }

    async enter(root, imageReady = false) {
        if (!root || this.destroyed) return;
        if (!root.isConnected || this.destroyed) return;
        refreshHeaderImages(root);
        root.dataset.hubReady = "true";
        const presentation = this.presentations.get(root.ownerDocument);
        if (presentation) {
            presentation.readyRoots.delete(root);
            presentation.readyRoots.add(root);
            return;
        }
        if (root.isConnected) root.classList.remove("is-hub-cover-pending");
    }

    isNoteMode(root) {
        return Boolean(root?.closest(".hub-project-rail") ||
            root?.ownerDocument?.body.classList.contains("hub-project-note-mode"));
    }

    async navigate(root, navigate) {
        if (!root || typeof navigate !== "function" || this.destroyed ||
            this.navigatingRoots.has(root)) return;
        this.navigatingRoots.add(root);
        this.presentations.get(root.ownerDocument)?.cancel();
        try {
            return await navigate();
        } finally {
            this.navigatingRoots.delete(root);
        }
    }

    stageWorkspace(doc) {
        this.presentations.get(doc)?.cancel();
        if (this.destroyed) return null;
        const main = doc?.querySelector?.(".workspace-split.mod-root");
        if (!main) return null;
        // changeLayout() can replace the entire main split when restoring Last
        // File. Keep the non-blocking render observer on its stable shell.
        const container = main.closest(".workspace") || main.parentElement;
        if (!container) return null;
        let observer = null, abort = null, cancelled = false;
        const stage = {
            readyRoots: new Set(),
            presentedRoot: null,
            cancel: () => {
                cancelled = true;
                observer?.disconnect();
                abort?.();
                if (this.presentations.get(doc) === stage) this.presentations.delete(doc);
                // Every enter() deferred by this handoff must be completed,
                // including another reading view that rendered in the meantime.
                for (const root of stage.readyRoots) {
                    if (!this.destroyed && root !== stage.presentedRoot && root.isConnected) {
                        void this.enter(root).catch(error => {
                            root.classList.remove("is-hub-cover-pending");
                            console.error("Could not finish deferred Hub cover entry", error);
                        });
                    }
                }
                stage.readyRoots.clear();
            },
            reveal: async (getLeafElement, context, note) => {
                // Native openFile may finish after unload/supersession. Do not
                // install an observer for a handoff that was already cancelled.
                if (cancelled || this.destroyed) return;
                // Dataview signals completion through enter(), not openFile().
                // Observe only during a layout handoff; never poll or guess a delay.
                const destinationRoot = () => {
                    const leaf = getLeafElement();
                    const selector = context ? ".project-dashboard" : ".home-dashboard";
                    const matches = root => root.isConnected && root.getClientRects().length > 0 &&
                        leaf?.contains(root) && root.matches(selector) &&
                        (!context || root.dataset.hubContextId === context.projectId);
                    // Readiness order wins over DOM order. Ignore the hidden
                    // Live Preview copy that Obsidian retains in the same leaf.
                    return [...stage.readyRoots].filter(matches).at(-1) ||
                        [...(leaf?.querySelectorAll(selector) ?? [])].filter(matches).at(-1);
                };
                let root;
                do {
                    root = await new Promise((resolve, reject) => {
                        abort = () => resolve(null);
                        const check = () => {
                            const leaf = getLeafElement();
                            const candidate = destinationRoot();
                            if (candidate?.dataset.hubReady === "true" &&
                                (!context || candidate.dataset.hubContextId === context.projectId)) {
                                observer?.disconnect(); resolve(candidate);
                            } else if (leaf?.querySelector(".dataview-error, .block-language-dataviewjs .error")) {
                                observer?.disconnect(); reject(new Error("The destination dashboard could not render."));
                            }
                        };
                        observer = new doc.defaultView.MutationObserver(check);
                        observer.observe(container, { childList: true, subtree: true, attributes: true,
                            attributeFilter: ["data-hub-ready"] });
                        check();
                    });
                    if (!root || cancelled) return;
                    // Apply already-loaded cover geometry; never wait for network/decode.
                    refreshHeaderImages(root);
                    if (cancelled) return;
                } while (root !== destinationRoot());
                stage.presentedRoot = root;
                this.presentations.delete(doc);
                root.classList.remove("is-hub-cover-pending");
                // Only the committed structural first frame is required here.
            }
        };
        this.presentations.set(doc, stage);
        return stage;
    }

    navigateToLastFile(root, navigate) {
        return this.navigate(root, navigate);
    }

    destroy() {
        this.destroyed = true;
        for (const presentation of this.presentations.values()) presentation.cancel();
    }
}

module.exports = {
    HubTransitionService
};
