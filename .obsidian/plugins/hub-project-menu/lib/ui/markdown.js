"use strict";

// One native Markdown/MathJax rendering lifecycle for compact Hub text.
function createHubMarkdown({ app, component, interactive = true }) {
    const { Component, MarkdownRenderer } = require("obsidian");
    const children = new Set();
    let rendered = new WeakMap();
    let disposed = false;
    function clear() {
        for (const child of children) component.removeChild(child);
        children.clear();
        rendered = new WeakMap();
    }
    component.register(() => { disposed = true; children.clear(); });

    function render(element, text, sourcePath, canCommit = () => true) {
        if (disposed) return Promise.resolve();
        const getPath = typeof sourcePath === "function" ? sourcePath : () => sourcePath || "";
        const previous = rendered.get(element);
        if (previous) { component.removeChild(previous); children.delete(previous); }
        const child = new Component();
        rendered.set(element, child);
        component.addChild(child);
        children.add(child);
        element.classList.add("hub-markdown");
        const preview = element.ownerDocument.createElement("div");
        const current = () => !disposed && children.has(child) && canCommit();
        const click = event => {
            if (!interactive) return;
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
                // Oath status shares native formatting without navigation or
                // embedded task controls. Keep its text in the accessibility tree.
                if (!interactive) {
                    for (const link of preview.querySelectorAll("a")) {
                        const text = preview.ownerDocument.createElement("span");
                        text.replaceChildren(...link.childNodes);
                        link.replaceWith(text);
                    }
                    for (const control of preview.querySelectorAll("input, button, select, textarea")) {
                        const text = preview.ownerDocument.createElement("span");
                        text.textContent = control.type === "checkbox"
                            ? (control.checked ? "Completed: " : "Incomplete: ") : control.textContent || control.value || "";
                        control.replaceWith(text);
                    }
                }
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
