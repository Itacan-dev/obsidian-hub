"use strict";

// One owned animation lifecycle for guidance and next-action cues. Replaying an
// explicit attempt restarts from normal; rerenders never schedule animations.
function mountTransientEffects(root) {
    const view = root.ownerDocument.defaultView, effects = new Map();
    let disposed = false;
    const reducedMotion = () => view.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function cancel(element) { effects.get(element)?.finish(); }
    function run(element, cls, done = () => {}) {
        if (disposed || !element?.isConnected) return;
        cancel(element);
        const finish = event => {
            if (event && event.target !== element) return;
            const effect = effects.get(element); if (!effect) return;
            view.cancelAnimationFrame(effect.frame); view.clearTimeout(effect.timer);
            element.classList.remove(cls); element.removeEventListener("animationend", finish);
            effects.delete(element); done();
        };
        const effect = { finish, frame: null, timer: null }; effects.set(element, effect);
        // A fresh frame ensures repeated failed attempts replay both pulses.
        effect.frame = view.requestAnimationFrame(() => {
            if (disposed || !element.isConnected) { finish(); return; }
            element.classList.add(cls);
            element.addEventListener("animationend", finish);
            effect.timer = view.setTimeout(finish, reducedMotion() ? 700 : 1800);
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
    return { run, cancel, reveal,
        pulse(element, container, done) { reveal(element, container); run(element, "hub-attention", done); },
        destroy() { disposed = true; for (const effect of [...effects.values()]) effect.finish(); }
    };
}

module.exports = { mountTransientEffects };
