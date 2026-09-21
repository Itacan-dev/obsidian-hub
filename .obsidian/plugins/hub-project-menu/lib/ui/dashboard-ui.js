"use strict";
const { setHubTooltip } = require("./tooltips");
const { progressColors, progressColor } = require("./progress-colors");

const navigationTooltips = new WeakMap();
const heatmapRevealGraphs = new WeakSet();

function selectNavigation(parent, role) {
    for (const button of parent.querySelectorAll("[data-hub-nav]")) {
        const active = button.dataset.hubNav === role;
        button.classList.toggle("is-active", active);
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
        navigationTooltips.get(button)?.();
    }
}

function createDashboardUi({
    navClass,
    getLastNavigation = () =>
        globalThis.window?.hubGetLastNavigation?.() ?? {}
}) {
    if (!navClass) {
        throw new Error("A dashboard navigation class is required.");
    }

    function el(parent, tag, cls, text = "") {
        return parent.createEl(tag, {
            cls,
            text
        });
    }

    function markDashboardRow(element, order) {
        element.classList.add("hub-dashboard-enter-row");
        element.style.setProperty(
            "--hub-enter-order",
            String(order)
        );
        return element;
    }

    function historyHeading(parent) {
        const title = parent.createDiv({ cls: "hub-history-heading" });
        title.setAttribute("role", "heading");
        title.setAttribute("aria-level", "3");
        const icon = title.createSpan({ cls: "hub-history-icon" });
        icon.setAttribute("aria-hidden", "true");
        const nativeIcon = require("obsidian").getIcon("rotate-ccw-clock");
        if (nativeIcon) {
            icon.appendChild(nativeIcon);
        } else {
            // Older Obsidian releases lack this Lucide icon. Use the official
            // geometry locally, without replacing or registering native icons.
            // https://github.com/lucide-icons/lucide/blob/main/icons/rotate-ccw-clock.svg
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
            const svg = icon.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
            for (const [key, value] of Object.entries({
                viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
                "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round"
            })) svg.setAttribute(key, value);
            for (const d of ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5", "M12 7v5l4 2"]) {
                const path = icon.ownerDocument.createElementNS(svg.namespaceURI, "path");
                path.setAttribute("d", d);
                svg.appendChild(path);
            }
            icon.appendChild(svg);
        }
        title.createSpan({ text: "History" });
        return title;
    }

    function navButton(
        parent,
        label,
        onClick,
        active = false,
        onMiddleClick = null,
        tooltip = null,
        role = null
    ) {
        const button = parent.createEl("button", {
            cls: `${navClass}${active ? " is-active" : ""}`,
            text: label
        });

        if (role) {
            button.dataset.hubNav = role;
        }

        if (active) {
            button.setAttribute("aria-current", "page");
        }

        const refreshTooltip = () => {
            if (button.classList.contains("is-active")) {
                setHubTooltip(button, null);
                return;
            }
            const value =
                typeof tooltip === "function"
                    ? tooltip()
                    : tooltip;

            setHubTooltip(button, value);
        };

        navigationTooltips.set(button, refreshTooltip);
        refreshTooltip();
        button.addEventListener("pointerenter", refreshTooltip);
        button.addEventListener("focus", refreshTooltip);
        button.addEventListener("click", event => {
            if (button.classList.contains("is-active")) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            onClick(event);
        });

        if (onMiddleClick) {
            button.addEventListener("auxclick", event => {
                if (event.button !== 1) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                if (button.classList.contains("is-active")) return;
                onMiddleClick(event);
            });
        }

        return button;
    }

    function lastNavigationInfo() {
        return getLastNavigation() ?? {};
    }

    function workspaceButton(parent, root, active = false) {
        const open = () => globalThis.window?.hubOpenWorkspace?.(root);
        const button = navButton(parent, "Workspace", open, active, open,
            "Go to last opened Project or Resource", "workspace");
        button.disabled = !active && globalThis.window?.hubHasWorkspace?.() === false;
        return button;
    }

    function presetsButton(parent, component) {
        let menu = null;
        const button = navButton(parent, "Presets", () => {
            if (button.getAttribute("aria-expanded") === "true") { menu?.close(); return; }
            menu = globalThis.window?.hubShowPresets?.(button);
        }, false, null, "Saved note-mode configurations", "presets");
        button.setAttribute("aria-haspopup", "menu");
        button.setAttribute("aria-expanded", "false");
        disclosureIcons(button);
        component.register(() => menu?.close());
        return button;
    }

    function disclosureIcons(button) {
        button.classList.add("hub-disclosure");
        // Both icons follow the same aria-expanded state the menu owns, including
        // outside clicks, Escape, selection, resize and view disposal.
        for (const [state, name] of [["closed", "chevron-right"], ["open", "chevron-down"]]) {
            const icon = button.createEl("span", { cls: `hub-presets-chevron is-${state}` });
            icon.setAttribute("aria-hidden", "true");
            require("obsidian").setIcon(icon, name);
        }
    }

    function placeHeatmapNavigation(calendar, toolbar, previous, year, next) {
        const months = calendar.querySelector(".heatmap-calendar-months");
        if (!months) return;
        toolbar.className = "hub-heatmap-navigation";
        previous.className = next.className = "hub-heatmap-arrow hub-button-plain";
        previous.type = next.type = "button";
        setHubTooltip(previous, "Previous year");
        setHubTooltip(next, "Next year");
        year.className = "hub-heatmap-year";
        year.setAttribute("aria-label", year.textContent);
        year.textContent = year.textContent.slice(-2);
        // Keep the native month grid and its column assignments untouched.
        // Anchor the label and buttons to their respective native grid areas.
        months.parentElement.classList.add("hub-heatmap-with-navigation");
        toolbar.replaceChildren(previous, next);
        months.after(year, toolbar);
        const graph = months.parentElement;
        if (!heatmapRevealGraphs.has(graph)) {
            heatmapRevealGraphs.add(graph);
            // Local listeners go away with the rendered graph. No overlay hit
            // zones intercept cell clicks/tooltips, and no polling is needed.
            graph.addEventListener("pointermove", event => {
                if (event.pointerType === "touch") return;
                const bounds = graph.querySelector(".heatmap-calendar-boxes")?.getBoundingClientRect();
                if (!bounds) return;
                const withinHeight = event.clientY >= bounds.top - 14 && event.clientY <= bounds.bottom + 14;
                for (const [button, edge] of [[previous, bounds.left], [next, bounds.right]]) {
                    button.classList.toggle("is-near", !button.disabled &&
                        (button.contains(event.target) || (withinHeight && Math.abs(event.clientX - edge) <= 32)));
                }
            });
            graph.addEventListener("pointerleave", () => {
                previous.classList.remove("is-near");
                next.classList.remove("is-near");
            });
        }
    }


    function lastFileTooltip() {
        const file = lastNavigationInfo().file;
        return file?.name
            ? [
                "Go to last opened file:",
                file.name,
                `In ${file.projectName}`
            ].join("\n")
            : "Go to last opened file";
    }


    return Object.freeze({
        createFrame: (container, component, className) => require("./dashboard-frame").createDashboardFrame(container, component, className),
        el,
        historyHeading,
        historyKind: require("../domain/history").historyKind,
        createHistoryPager: require("./history-pager").createHistoryPager,
        historyDate: when => when.format("D MMM"),
        lastFileTooltip,
        lastNavigationInfo,
        markDashboardRow,
        navButton,
        workspaceButton,
        presetsButton,
        disclosureIcons,
        placeHeatmapNavigation,
        progressColors,
        progressColor,
        selectNavigation
    });
}

module.exports = {
    createDashboardUi,
    selectNavigation
};
