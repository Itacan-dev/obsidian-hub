"use strict";
const { createPointerListReorder } = require("./pointer-list-reorder");

// Presets pointer visuals and Roadmap keyboard pickup/move/drop share stable IDs.
function bindListReorder({ rows, handles, status, commit, list, scroller }) {
    let drag = null, pending = false;
    const ids = rows.map(row => row.dataset.reorderId);
    const pointer = createPointerListReorder({ container: list, scroller,
        placeholderClass: "hub-preset-placeholder hub-roadmap-placeholder",
        sortingClass: "is-sorting-presets", animate: true,
        canStart: () => !pending && !drag && !pointer.busy,
        focusTarget: row => row.querySelector(".hub-roadmap-drag-handle"),
        commit: async (ordered, moved) => {
            if (ordered.every((row, index) => row.dataset.reorderId === ids[index])) return;
            pending = true;
            try { await commit(ordered.map(row => row.dataset.reorderId), moved.dataset.reorderId); }
            finally { pending = false; }
        }
    });
    const clear = () => {
        rows.forEach(row => row.classList.remove("is-dragging", "is-drop-before", "is-drop-after"));
        handles.forEach(handle => handle.setAttribute("aria-pressed", "false"));
        drag = null;
    };
    const indicate = () => {
        rows.forEach(row => row.classList.remove("is-drop-before", "is-drop-after"));
        if (!drag || drag.target === drag.index) return;
        rows[drag.target].classList.add(drag.target < drag.index ? "is-drop-before" : "is-drop-after");
        status.textContent = `Position ${drag.target + 1} of ${rows.length}. Press Space to drop, Escape to cancel.`;
    };
    const finish = async () => {
        if (!drag || pending) return;
        const { index, target } = drag;
        clear();
        if (index === target) return;
        const order = ids.slice(); order.splice(target, 0, order.splice(index, 1)[0]);
        pending = true; handles.forEach(handle => { handle.disabled = true; });
        try { await commit(order, ids[index]); }
        finally { pending = false; handles.forEach(handle => { handle.disabled = false; }); }
    };
    handles.forEach((handle, index) => {
        handle.draggable = false;
        handle.setAttribute("aria-pressed", "false");
        handle.setAttribute("aria-description", "Drag to reorder. With the keyboard, press Space to pick up, Up or Down to move, Space to drop, Escape to cancel.");
        handle.addEventListener("pointerdown", event => pointer.begin(event, rows[index], list));
        handle.addEventListener("keydown", event => {
            if (pending || pointer.busy) return;
            if (event.key === "Escape" && drag) { event.preventDefault(); clear(); status.textContent = "Reordering canceled."; return; }
            if ([" ", "Enter"].includes(event.key)) {
                event.preventDefault();
                if (drag?.keyboard) { void finish(); return; }
                if (rows.length < 2) return;
                clear(); drag = { index, target: index, keyboard: true };
                handle.setAttribute("aria-pressed", "true"); rows[index].classList.add("is-dragging");
                status.textContent = `Picked up phase ${index + 1} of ${rows.length}. Use Up or Down to move.`;
            } else if (drag?.keyboard && ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                drag.target = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 :
                    Math.max(0, Math.min(rows.length - 1, drag.target + (event.key === "ArrowUp" ? -1 : 1)));
                indicate();
            }
        });
    });
    return () => { pointer.cancel(); clear(); };
}
module.exports = { bindListReorder };
