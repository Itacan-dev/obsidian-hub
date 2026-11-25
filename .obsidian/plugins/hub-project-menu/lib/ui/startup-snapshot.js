"use strict";

function keepStartupSnapshotUnfocusable(document) {
    const frame = document.getElementById("startup-snapshot");
    if (frame?.tagName !== "IFRAME" || !frame.hasAttribute("srcdoc") ||
        frame.getAttribute("sandbox") !== "allow-same-origin") return;

    // Obsidian already makes the snapshot's body inert. Make the iframe
    // itself inert too, so a slow-start modal cannot save focus in its
    // scriptless document and later try to restore it as a live Obsidian node.
    frame.inert = true;
    if (document.activeElement === frame) frame.blur();
}

module.exports = { keepStartupSnapshotUnfocusable };
