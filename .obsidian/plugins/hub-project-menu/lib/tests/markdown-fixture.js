"use strict";
// Inert approximation of Obsidian's native rendering boundary, for DOM fixtures.
function renderFixtureMarkdown(app, text, element) {
    function inline(parent, value) {
        const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)|\[\[([^\]]+)\]\]/g;
        let end = 0;
        for (const match of value.matchAll(pattern)) {
            parent.append(document.createTextNode(value.slice(end, match.index)));
            if (match[1]) parent.createEl("strong", { text: match[1] });
            else if (match[2]) parent.createEl("em", { text: match[2] });
            else if (match[3]) parent.createEl("a", { text: match[3], attr: { href: match[4] } });
            else parent.createEl("a", { text: match[5], cls: "internal-link", attr: { href: match[5], "data-href": match[5] } });
            end = match.index + match[0].length;
        }
        parent.append(document.createTextNode(value.slice(end)));
    }
    for (const block of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
        const lines = block.split("\n");
        if (lines.every(line => /^[-*] /.test(line) || /^\d+\. /.test(line))) {
            const list = element.createEl(/^\d/.test(lines[0]) ? "ol" : "ul");
            for (const line of lines) inline(list.createEl("li"), line.replace(/^(?:[-*]|\d+\.) /, ""));
        } else inline(element.createEl("p"), block);
    }
}
module.exports = { renderFixtureMarkdown };
