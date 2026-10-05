"use strict";

const { mountTransientEffects } = require("./attention");
let instance = 0;

// Presentation only: the service's ordered missing requirements and readiness
// remain the single source of truth, including invalid optional Task edits.
function mountInboxGuidance({ body, readyArrow, completion }) {
    const hintId = `hub-inbox-guidance-${++instance}`;
    const hint = body.createSpan({ cls: "hub-inbox-guidance-status", attr: { id: hintId, role: "status", "aria-live": "polite" } });
    const effects = mountTransientEffects(body);
    let warning = null, readyCued = false, opened = false, disposed = false;
    const firstMissing = state => [...body.querySelectorAll("[data-capture-field]")]
        .find(field => state.missing.includes(field.dataset.captureField));
    function clearWarning() {
        if (!warning) return;
        const element = warning; warning = null;
        effects.cancel(element);
        for (const control of [element, ...element.querySelectorAll("button,input,textarea,select")]) {
            const ids = (control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(id => id && id !== hintId);
            if (ids.length) control.setAttribute("aria-describedby", ids.join(" ")); else control.removeAttribute("aria-describedby");
        }
        hint.textContent = "";
    }
    function guide() {
        if (disposed) return false;
        clearWarning();
        const state = completion(), target = firstMissing(state);
        if (!target) return false;
        warning = target; hint.textContent = `${target.dataset.captureField} is required.`;
        for (const control of [...target.querySelectorAll("button,input,textarea,select")]) {
            const ids = new Set((control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
            ids.add(hintId); control.setAttribute("aria-describedby", [...ids].join(" "));
        }
        effects.pulse(target, body, clearWarning);
        return true;
    }
    return {
        guide,
        update() {
            if (disposed) return;
            const state = completion(), target = firstMissing(state);
            if (!opened && target) guide();
            // Only opening guides a missing field. Edits never move the user's
            // place or replay attention, even if the next requirement changes.
            if (warning && target !== warning) clearWarning();
            if (state.ready && !readyCued) { readyCued = true; effects.run(readyArrow, "hub-ready-nudge"); }
            if (!state.ready) { readyCued = false; effects.cancel(readyArrow); }
            opened = true;
        },
        destroy() {
            disposed = true; clearWarning(); hint.remove();
            effects.destroy();
        }
    };
}

module.exports = { mountInboxGuidance };
