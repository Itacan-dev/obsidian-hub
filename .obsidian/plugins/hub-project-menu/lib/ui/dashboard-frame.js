"use strict";
const { ownColorRoot } = require("./color-system");
const frames = new WeakMap();

function createDashboardFrame(container, component, className) {
    frames.get(container)?.abort();
    const controller = new AbortController();
    const root = container.ownerDocument.createElement("div");
    root.className = className;
    const disposeColors = ownColorRoot(root);
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
