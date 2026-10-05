"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "../../../../..");
const files = ["System/Dashboards/Home/view.css", "System/Dashboards/Project/view.css",
    "System/Dashboards/Daily/view.css", ".obsidian/plugins/hub-project-menu/styles.css"];
const css = files.map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
const expected = { meta: "0.66rem", secondary: "0.72rem", compact: "0.78rem",
    body: "0.84rem", subheading: "0.9rem", heading: "1rem", title: "1.65rem" };
const tokens = [...css.matchAll(/--hub-font-([\w-]+)\s*:\s*([^;]+);/g)];
assert.equal(tokens.length, 7, "Define each semantic size once");
assert.deepEqual(Object.fromEntries(tokens.map(m => [m[1], m[2].trim()])), expected);
const exemptions = new Map([
    [".home-focus-dot", "0.65rem"], // Existing decorative diamond, not text.
    [".home-progress-scope-chevron", "0.75em"], // Relative icon.
    [".home-progress-calendar .heatmap-calendar-boxes li", "0"],
    [".project-progress-calendar .heatmap-calendar-boxes li", "0"]
]);
const used = new Set();
for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const name = selector.replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/\s+/g, " ");
    for (const match of body.matchAll(/font-size\s*:\s*([^;]+);/g)) {
        const size = match[1].replace(/\s*!important/, "").trim();
        if (size === "inherit") continue; // Inherit the existing semantic size.
        if (exemptions.has(name)) assert.equal(size, exemptions.get(name));
        else {
            const token = size.match(/^var\(--hub-font-([\w-]+)\)$/)?.[1];
            assert.ok(token in expected, name + " has an unclassified size: " + size);
            used.add(token);
        }
    }
}
assert.equal(used.size, 7);
for (const [, selector, body] of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const match of body.matchAll(/\bfont\s*:\s*([^;{}]+);/g)) {
        // The existing Oath pledge intentionally uses a distinct quotation face.
        const expected = selector.trim() === ".hub-oath-pledge" ? "italic 1.2rem/1.6 Georgia, serif" : "inherit";
        assert.equal(match[1].trim(), expected, "Do not hide extra sizes in font shorthand");
    }
}
console.log("Hub typography checks passed: seven semantic text sizes; only decorative/hidden exceptions.");
