"use strict";

// One native Markdown/MathJax rendering lifecycle for compact Hub text.
function createHubMarkdown({ app, component }) {
    const { Component, MarkdownRenderer } = require("obsidian");
    const children = new Set();
    let disposed = false;
    function clear() {
        for (const child of children) component.removeChild(child);
        children.clear();
    }
    component.register(() => { disposed = true; children.clear(); });

    function render(element, text, sourcePath, canCommit = () => true) {
        if (disposed) return Promise.resolve();
        const getPath = typeof sourcePath === "function" ? sourcePath : () => sourcePath || "";
        const child = new Component();
        component.addChild(child);
        children.add(child);
        element.classList.add("hub-markdown");
        const preview = element.ownerDocument.createElement("div");
        const current = () => !disposed && children.has(child) && canCommit();
        const click = event => {
            const link = event.target.closest("a.internal-link");
            if (link) {
                event.preventDefault(); event.stopPropagation();
                void app.workspace.openLinkText(link.getAttribute("data-href") ?? link.getAttribute("href"),
                    getPath(), event.ctrlKey || event.metaKey);
            } else if (event.target.closest("a, button, input, textarea")) event.stopPropagation();
        };
        element.addEventListener("click", click);
        child.register(() => element.removeEventListener("click", click));
        return Promise.resolve().then(() => {
            if (disposed || !children.has(child)) return;
            return MarkdownRenderer.render(app, text, preview, getPath(), child);
        })
            .then(() => {
                if (!current()) return;
                // A single paragraph needs no extra block box in an existing
                // title/summary. Plain text keeps the exact inherited styling.
                const content = preview.childNodes.length === 1 && preview.firstElementChild?.tagName === "P"
                    ? preview.firstElementChild : preview;
                element.replaceChildren(...content.childNodes);
            }).catch(error => {
                if (current()) element.textContent = text;
                console.error("Could not render Hub Markdown", error);
            });
    }
    return { render, clear };
}

module.exports = { createHubMarkdown };
