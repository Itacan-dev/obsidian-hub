"use strict";

// One owned animation lifecycle for guidance and next-action cues. Replaying an
// explicit attempt restarts from normal; rerenders never schedule animations.
function mountTransientEffects(root) {
    const view = root.ownerDocument.defaultView, effects = new Map();
    const surfaceSelector = 'button,textarea,select,input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]),.hub-oath-choice,.project-task-row,[role="button"]';
    const canvas = root.ownerDocument.createElement("canvas"); canvas.width = canvas.height = 1;
    const paint = canvas.getContext("2d");
    let disposed = false;
    const reducedMotion = () => view.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function surfaceBackground(node) {
        // Transparent buttons and muted selections need their visible resting
        // color, otherwise their tint compounds with the highlighted parent.
        const ancestors = []; for (let parent = node; parent; parent = parent.parentElement) ancestors.push(parent);
        paint.clearRect(0, 0, 1, 1);
        paint.fillStyle = view.getComputedStyle(root).getPropertyValue("--hub-color-surface-page").trim() || view.getComputedStyle(root).getPropertyValue("--background-primary").trim() || "#1e1e1e";
        paint.fillRect(0, 0, 1, 1);
        for (const parent of ancestors.reverse()) {
            paint.fillStyle = view.getComputedStyle(parent).backgroundColor; paint.fillRect(0, 0, 1, 1);
        }
        const [red, green, blue] = paint.getImageData(0, 0, 1, 1).data;
        return `rgb(${red}, ${green}, ${blue})`;
    }
    function cancel(element) { effects.get(element)?.finish(); }
    function run(element, cls, done = () => {}) {
        if (disposed || !element?.isConnected) return;
        cancel(element);
        const finish = event => {
            if (event && event.target !== element) return;
            const effect = effects.get(element); if (!effect) return;
            view.cancelAnimationFrame(effect.frame); view.clearTimeout(effect.timer);
            element.classList.remove(cls); element.removeEventListener("animationend", finish);
            for (const surface of effect.surfaces) {
                const { node, value, priority, marker } = surface;
                if (value) node.style.setProperty("--hub-attention-base-surface", value, priority);
                else node.style.removeProperty("--hub-attention-base-surface");
                if (marker == null) node.removeAttribute("data-hub-attention-surface");
                else node.setAttribute("data-hub-attention-surface", marker);
                // Restoring theme transitions at an interrupted peak can fade
                // from amber. End that background transition before a replay
                // samples the resting surface again.
                for (const animation of node.getAnimations())
                    if (animation.transitionProperty === "background-color") animation.cancel();
            }
            effects.delete(element); done();
        };
        const effect = { finish, frame: null, timer: null, surfaces: [] }; effects.set(element, effect);
        // A fresh frame ensures repeated failed attempts replay both pulses.
        effect.frame = view.requestAnimationFrame(() => {
            if (disposed || !element.isConnected) { finish(); return; }
            if (cls === "hub-attention") {
                // Capture the actual theme/selection surfaces before applying
                // one inherited CSS pulse. Foreground colors are never touched.
                effect.surfaces = [...(element.matches(surfaceSelector) ? [element] : []),
                    ...element.querySelectorAll(surfaceSelector)].map(node => ({
                    node, background: surfaceBackground(node),
                    value: node.style.getPropertyValue("--hub-attention-base-surface"),
                    priority: node.style.getPropertyPriority("--hub-attention-base-surface"),
                    marker: node.getAttribute("data-hub-attention-surface")
                }));
                for (const { node, background } of effect.surfaces) {
                    node.style.setProperty("--hub-attention-base-surface", background);
                    node.setAttribute("data-hub-attention-surface", "");
                }
            }
            element.classList.add(cls);
            element.addEventListener("animationend", finish);
            // Fallbacks outlast both pulses; reduced motion is briefly static.
            effect.timer = view.setTimeout(finish, reducedMotion() ? 700 : cls === "hub-attention" ? 2600 : 2500);
        });
    }
    function reveal(element, container) {
        if (!element?.isConnected) return;
        const behavior = reducedMotion() ? "instant" : "smooth";
        if (!container) { element.scrollIntoView({ block: "nearest", behavior }); return; }
        const bounds = container.getBoundingClientRect(), field = element.getBoundingClientRect();
        if (field.top < bounds.top + 6 || field.bottom > bounds.bottom - 6)
            container.scrollTo({ top: Math.max(0, container.scrollTop + field.top - bounds.top - 8), behavior });
    }
    return { run, cancel, cancelAll: () => { for (const effect of [...effects.values()]) effect.finish(); }, reveal,
        pulse(element, container, done) { reveal(element, container); run(element, "hub-attention", done); },
        destroy() { disposed = true; for (const effect of [...effects.values()]) effect.finish(); }
    };
}

module.exports = { mountTransientEffects };
