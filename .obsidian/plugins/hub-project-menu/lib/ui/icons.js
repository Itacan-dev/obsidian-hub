"use strict";

const { getIcon, setIcon } = require("obsidian");

// Obsidian's unprefixed names include legacy aliases (folder -> folder-open,
// presentation -> monitor). Prefer canonical Lucide names at the Hub boundary,
// while retaining registered custom icons and legacy-only names as a fallback.
const resolvedNames = new Map();
function setHubIcon(element, name) {
    let resolved = resolvedNames.get(name);
    if (!resolved) {
        const canonical = name.startsWith("lucide-") ? name : "lucide-" + name;
        resolved = getIcon(canonical) ? canonical : name;
        resolvedNames.set(name, resolved);
    }
    if (name.replace(/^lucide-/, "") === "clock-arrow-right" && !getIcon(resolved)) {
        // Obsidian 1.13.7 does not yet ship this requested Lucide icon. Use the
        // official upstream SVG, as the shared History icon already does.
        // https://github.com/lucide-icons/lucide/blob/main/icons/clock-arrow-right.svg
        // ISC License, Copyright (c) 2026 Lucide Icons and Contributors.
        // Permission to use, copy, modify, and/or distribute this software for any
        // purpose with or without fee is hereby granted, provided that the above
        // copyright notice and this permission notice appear in all copies.
        // THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
        // WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
        // MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
        // ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
        // WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
        // ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
        // OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
        const svg = element.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("lucide", "lucide-clock-arrow-right");
        for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" })) svg.setAttribute(key, value);
        for (const d of ["M12 6v6l2 1", "M13.5 21.885A10 10 0 1 1 22 12", "M14 18h8", "m18 22 4-4-4-4"]) {
            const path = element.ownerDocument.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", d); svg.append(path);
        }
        element.replaceChildren(svg);
        return;
    }
    if (name.replace(/^lucide-/, "") === "file-question-mark" && !getIcon(resolved)) {
        // Official Lucide SVG for Obsidian releases predating this icon name.
        // https://github.com/lucide-icons/lucide/blob/main/icons/file-question-mark.svg
        // ISC License, Copyright (c) 2026 Lucide Icons and Contributors; the
        // permission and warranty notice above also applies to this SVG.
        const svg = element.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("lucide", "lucide-file-question-mark");
        for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" })) svg.setAttribute(key, value);
        for (const d of ["M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z", "M12 17h.01", "M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"]) {
            const path = element.ownerDocument.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", d); svg.append(path);
        }
        element.replaceChildren(svg); return;
    }
    setIcon(element, resolved);
}

module.exports = { setHubIcon };
