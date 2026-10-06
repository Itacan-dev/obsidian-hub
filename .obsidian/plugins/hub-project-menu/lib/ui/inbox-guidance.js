"use strict";

const { mountTransientEffects } = require("./attention");
let instance = 0;

// Presentation only: the service's ordered missing requirements and readiness
// remain the single source of truth, including invalid optional Task edits.
function mountCaptureGuidance({ body, readyArrow, completion, guideOnOpen = false }) {
    const hintId = `hub-inbox-guidance-${++instance}`;
    const hint = body.createSpan({ cls: "hub-guidance-status", attr: { id: hintId, role: "status", "aria-live": "polite" } });
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
            if (guideOnOpen && !opened && target) guide();
            // Inbox guides on opening; Quick Add only guides direct attempts.
            // Edits never move the user's place or replay attention.
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

function mountInboxGuidance(options) {
    return mountCaptureGuidance({ ...options, guideOnOpen: true });
}

module.exports = { mountInboxGuidance, mountCaptureGuidance };
