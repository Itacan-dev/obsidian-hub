"use strict";
const { ownColorRoot } = require("./color-system");
const frames = new WeakMap();

function createDashboardFrame(container, component, className, page = null) {
    frames.get(container)?.abort();
    const controller = new AbortController();
    const root = container.ownerDocument.createElement("div");
    root.className = className;
    let releasePage = () => {};
    const disposeColors = ownColorRoot(root, () => releasePage());
    let pageReleased = false;
    // A real frame plus its source/view identity is proof of a dashboard page.
    // Embedded dashboards and source editors must not claim the surrounding note.
    const refreshPage = () => {
        if (pageReleased) return;
        const preview = container.closest(".markdown-preview-view");
        const native = preview?.closest(".workspace-leaf-content");
        let eligible = false;
        if (page?.sourcePath && preview && !container.closest(".hub-color-host-island") &&
            (!native || ["markdown", "hub-prepared-home", "hub-prepared-note-rail"].includes(native.dataset.type))) {
            eligible = !!preview.classList.contains("hub-color-page") && ["home", "note"].includes(component.hubDestinationMode);
            if (!eligible && native?.dataset.type === "markdown") page.app?.workspace?.iterateAllLeaves?.(leaf => {
                if (leaf.view?.containerEl === native && leaf.view?.getViewType?.() === "markdown" && leaf.view?.file?.path === page.sourcePath) eligible = true;
            });
        }
        root.toggleAttribute("data-hub-dashboard-page", eligible);
    };
    const event = page?.app?.workspace?.on && page.app.workspace.offref
        ? page.app.workspace.on("file-open", refreshPage) : null;
    releasePage = () => {
        if (pageReleased) return; pageReleased = true;
        if (event) page.app.workspace.offref(event);
        root.removeAttribute("data-hub-dashboard-page");
    };
    component.register(releasePage);
    const work = [];
    const layoutWork = [];
    const current = () => !controller.signal.aborted && frames.get(container) === frame && root.isConnected;
    const frame = {
        root, current,
        abort: () => { controller.abort(); if (!root.isConnected) disposeColors(); },
        defer: task => work.push(task),
        // Geometry needs attached, styled DOM, but must precede the first paint.
        // Detached prepared views retain these tasks until their activation.
        beforePaint: task => layoutWork.push(task),
        prepareLayout() {
            if (!current()) return;
            refreshPage();
            for (const task of layoutWork.splice(0)) task();
        },
        commit() {
            if (controller.signal.aborted || frames.get(container) !== frame) return;
            // Dataview owns this container, including its scoped view.css style.
            // Replace only the Hub root, preserving every host-owned sibling.
            const previous = [...container.children].find(child =>
                child.matches('.home-dashboard, .project-dashboard'));
            if (previous) previous.replaceWith(root);
            else container.appendChild(root);
            frame.prepareLayout();
            root.dataset.hubReady = "true";
            component.hubOnFrameCommit?.(frame);
            if (!component.hubDeferFrameActivation) frame.activate(true);
        },
        activate(allowDetached = false) {
            if (controller.signal.aborted || frames.get(container) !== frame ||
                (!allowDetached && !root.isConnected)) return;
            frame.prepareLayout();
            require("./header-image").refreshHeaderImages(root);
            for (const task of work.splice(0)) {
                const run = () => current() ? task() : undefined;
                const view = container.ownerDocument.defaultView;
                if (view.scheduler?.postTask) {
                    void view.scheduler.postTask(run, { priority: "background", signal: controller.signal })
                        .catch(error => { if (error.name !== "AbortError") console.error("Hub panel update failed", error); });
                } else {
                    // A task boundary, not a delay or an animation-frame readiness gate.
                    const channel = new view.MessageChannel();
                    channel.port1.onmessage = () => {
                        channel.port1.close(); channel.port2.close();
                        Promise.resolve().then(run).catch(error => console.error("Hub panel update failed", error));
                    };
                    channel.port2.postMessage(null);
                }
            }
        }
    };
    frames.set(container, frame);
    component.register(frame.abort);
    return frame;
}

module.exports = { createDashboardFrame };
