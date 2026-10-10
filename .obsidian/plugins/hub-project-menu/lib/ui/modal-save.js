"use strict";

// Match CaptureModal's pending-save controls without changing modal ownership.
// Call only after validation; the owning modal guards close() while saving.
function lockModalControls(modal) {
    const controls = [...modal.contentEl.querySelectorAll("button,input,textarea,select")];
    const disabled = controls.map(control => control.disabled);
    const busy = modal.modalEl.getAttribute("aria-busy");
    controls.forEach(control => { control.disabled = true; });
    modal.modalEl.setAttribute("aria-busy", "true");
    return () => {
        controls.forEach((control, index) => { control.disabled = disabled[index]; });
        if (busy === null) modal.modalEl.removeAttribute("aria-busy");
        else modal.modalEl.setAttribute("aria-busy", busy);
    };
}

module.exports = { lockModalControls };
