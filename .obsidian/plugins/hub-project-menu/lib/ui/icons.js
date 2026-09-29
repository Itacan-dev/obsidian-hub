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
    setIcon(element, resolved);
}

module.exports = { setHubIcon };
