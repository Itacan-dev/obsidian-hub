"use strict";

const { setHubIcon } = require("./icons");
const { createImmediateHubTooltip } = require("./tooltips");

let hostId = 0;
const selectedPanels = new WeakMap();

function mountExpansionHost({ host, panels, signal, stateOwner = host, stateKey = null }) {
    const doc = host.ownerDocument;
    const win = doc.defaultView;
    const viewport = host.closest(".markdown-preview-view, .view-content");
    const motion = win.matchMedia("(prefers-reduced-motion: reduce)");
    const events = new win.AbortController();
    const listen = (node, name, callback) => node.addEventListener(name, callback, { signal: events.signal });
    const id = "hub-panel-host-" + ++hostId;
    const tooltips = createImmediateHubTooltip(host);
    const nav = doc.createElement("div");
    nav.className = "hub-expansion-tabs";
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Dashboard panels");
    nav.style.setProperty("--hub-expansion-peer-count", panels.length - 1);

    function createLane(name, track = doc.createElement("div")) {
        const lane = doc.createElement("div");
        lane.className = "hub-expansion-lane hub-expansion-" + name;
        track.classList.add("hub-expansion-track");
        lane.append(track);
        return lane;
    }

    const navigation = createLane("navigation", nav);

    function button(className, label, icon) {
        const control = doc.createElement("button");
        control.type = "button";
        control.className = className;
        control.setAttribute("aria-label", label);
        const artwork = control.appendChild(doc.createElement("span"));
        artwork.className = "hub-expansion-icon";
        if (className.includes("hub-expansion-toggle")) artwork.classList.add("hub-expansion-visual-slot");
        artwork.setAttribute("aria-hidden", "true");
        setHubIcon(artwork, icon);
        return control;
    }

    const toggleClasses = " hub-expansion-toggle hub-button-plain hub-icon-action";
    const collapseControl = button("hub-expansion-collapse" + toggleClasses, "Collapse panel", "minimize");
    const scrollPositions = new Map();
    let active = null, slot = null, phase = "compact", animation = null, cleanupMotion = null;
    const entries = panels.map((panel, index) => {
        const { element, header, surface = header.parentElement, title, icon, navigationLabel = title } = panel;
        const trigger = button("hub-expansion-trigger" + toggleClasses, "Expand " + title, "expand");
        const tab = button("hub-expansion-tab hub-button-plain hub-icon-action", navigationLabel, icon);
        const label = tab.appendChild(doc.createElement("span"));
        label.textContent = navigationLabel;
        label.setAttribute("aria-hidden", "true");
        label.className = "hub-expansion-label";
        tab.id = id + "-tab-" + index;
        tab.setAttribute("role", "tab");
        const generatedId = !element.id;
        if (generatedId) element.id = id + "-panel-" + index;
        for (const control of [tab, trigger]) control.setAttribute("aria-controls", element.id);
        trigger.setAttribute("aria-expanded", "false");
        tooltips.bind(trigger, { title: "Expand " + title, description: "" });
        tooltips.bind(tab, { title: navigationLabel, description: "" });
        const actions = createLane("actions");
        actions.firstElementChild.append(...(panel.actions ?? []).filter(Boolean));
        const center = panel.center && createLane("center");
        if (center) {
            panel.center.before(center);
            center.firstElementChild.append(panel.center);
            header.classList.add("hub-expansion-has-center");
        }
        header.classList.add("hub-expansion-header");
        surface.classList.add("hub-dashboard-panel");
        const headerBand = doc.createElement("div");
        headerBand.className = "hub-expansion-header-band";
        header.before(headerBand);
        headerBand.append(header);
        header.append(actions, trigger);
        nav.append(tab);
        const entry = { ...panel, surface, headerBand, trigger, tab, actions, center, generatedId, scrollOwners: [element, ...(panel.scrollOwners ?? [])],
            role: element.getAttribute("role"),
            labelledBy: element.getAttribute("aria-labelledby") };
        for (const heading of entry.compactHeading ?? []) {
            heading.classList.add("hub-expansion-compact-heading");
            const iconSlot = heading.querySelector("svg")?.parentElement;
            if (iconSlot) iconSlot.classList.add("hub-panel-heading-slot");
        }
        listen(trigger, "click", () => select(entry));
        listen(tab, "click", () => select(entry));
        return entry;
    });
    tooltips.bind(collapseControl, { title: "Collapse panel", description: "" });
    const originalTabIndex = host.getAttribute("tabindex");
    host.setAttribute("tabindex", "-1");
    host.classList.add("hub-expansion-host");

    function revealInLane(lane, control) {
        const view = lane.getBoundingClientRect();
        const box = control.getBoundingClientRect();
        const offset = box.left < view.left ? box.left - view.left : Math.max(0, box.right - view.right);
        if (offset) lane.scrollBy({ left: offset / (lane.currentCSSZoom || 1), behavior: "instant" });
    }

    function revealFocus(control) {
        if (doc.activeElement !== control) return;
        const view = viewport?.getBoundingClientRect();
        const box = control.getBoundingClientRect();
        const top = Math.max(0, view?.top ?? 0);
        const bottom = Math.min(win.innerHeight, view?.bottom ?? win.innerHeight);
        const offset = box.top < top ? box.top - top : Math.max(0, box.bottom - bottom);
        if (offset) (viewport ?? win).scrollBy({ top: offset / (viewport?.currentCSSZoom || 1), behavior: "instant" });
    }

    function sizeHost() {
        if (!active || !host.isConnected || !host.clientWidth || animation) return;
        const box = host.getBoundingClientRect();
        const scale = host.currentCSSZoom || 1;
        const status = doc.querySelector(".status-bar");
        const bottom = Math.min(win.innerHeight, viewport?.getBoundingClientRect().bottom ?? Infinity,
            status?.getClientRects().length ? status.getBoundingClientRect().top : Infinity);
        // Adding the scroll offset keeps the host size independent of outer page scrolling.
        const top = box.top + (viewport?.scrollTop ?? win.scrollY) * (viewport?.currentCSSZoom || 1);
        const style = win.getComputedStyle(host);
        const token = (name, fallback) => parseFloat(style.getPropertyValue(name)) || fallback;
        const target = token("--hub-full-view-top-row-height", 320) + token("--hub-panel-gap", 12)
            + token("--hub-full-view-bottom-row-height", 404);
        const height = Math.round(Math.min(target, Math.max(320, (bottom - top) / scale - 12)));
        const dimension = height + "px";
        if (host.style.getPropertyValue("--hub-expanded-height") !== dimension) {
            host.style.setProperty("--hub-expanded-height", dimension);
        }
    }

    function stopMotion() {
        const previous = animation;
        animation = null;
        previous?.cancel();
        const cleanup = cleanupMotion;
        cleanupMotion = null;
        cleanup?.();
    }

    function updateTabs() {
        for (const entry of entries) {
            const selected = entry === active;
            entry.tab.setAttribute("aria-selected", String(selected));
            entry.tab.tabIndex = selected ? 0 : -1;
        }
    }

    function hideNeighbors(hidden, animate = false) {
        for (const entry of entries) {
            const hide = hidden && entry !== active;
            const element = entry.element;
            const changed = element.classList.contains("hub-panel-muted") !== hide;
            const opacity = win.getComputedStyle(element).opacity;
            element.inert = hide;
            element.classList.toggle("hub-panel-muted", hide);
            for (const effect of element.getAnimations().filter(effect => effect.id === id + "-fade")) effect.cancel();
            if (animate && changed) {
                const effect = element.animate([{ opacity, visibility: "visible" },
                    { opacity: hide ? 0 : 1, visibility: "visible" }], { duration: 190, easing: "ease-out" });
                effect.id = id + "-fade";
            }
        }
    }

    function expandElement(entry) {
        entry.onBeforeExpand?.();
        // Keep the original grid position available when the panel is absolutely positioned.
        slot = doc.createElement(entry.element.localName);
        slot.className = entry.element.className + " hub-expansion-slot";
        slot.classList.remove("hub-panel-muted");
        slot.style.setProperty("--hub-slot-height", entry.element.offsetHeight + "px");
        slot.inert = true;
        entry.element.before(slot);
        entry.element.classList.add("hub-panel-expanded");
        entry.header.classList.add("hub-expanded-header");
        entry.trigger.setAttribute("aria-expanded", "true");
        entry.header.prepend(navigation);
        entry.header.append(collapseControl);
        entry.element.setAttribute("role", "tabpanel");
        entry.element.setAttribute("aria-labelledby", entry.tab.id);
    }

    function releaseElement(entry) {
        slot?.remove();
        slot = null;
        entry.element.classList.remove("hub-panel-expanded");
        entry.header.classList.remove("hub-expanded-header");
        entry.trigger.setAttribute("aria-expanded", "false");
        for (const [name, value] of [["role", entry.role], ["aria-labelledby", entry.labelledBy]]) {
            if (value === null) entry.element.removeAttribute(name);
            else entry.element.setAttribute(name, value);
        }
        entry.onExpandedChange?.(false);
    }

    function visualBounds(element) {
        const box = element.getBoundingClientRect();
        if (!animation || !element.classList.contains("hub-panel-moving")) return box;
        const clip = win.getComputedStyle(element).clipPath;
        const insets = clip.slice(6).split(" ").map(parseFloat);
        if (!Number.isFinite(insets[0])) return box;
        const scale = element.currentCSSZoom || 1;
        const right = Number.isFinite(insets[1]) ? insets[1] : insets[0];
        const bottom = Number.isFinite(insets[2]) ? insets[2] : insets[0];
        return { top: box.top, left: box.left, width: box.width - right * scale, height: box.height - bottom * scale };
    }

    function headerParts(entry, expanded) {
        return expanded ? [navigation, collapseControl, entry.center].filter(Boolean)
            : [...(entry.compactHeading ?? []), entry.trigger];
    }

    function snapshot(entry, nodes) {
        const bounds = entry.element.getBoundingClientRect(), scale = entry.element.currentCSSZoom || 1;
        return nodes.filter(node => node?.getClientRects().length).map(node => {
            const box = node.getBoundingClientRect();
            const copy = node.cloneNode(true);
            for (const member of [copy, ...copy.querySelectorAll("[id]")]) member.removeAttribute("id");
            copy.classList.add("hub-expansion-copy");
            copy.inert = true;
            copy.setAttribute("aria-hidden", "true");
            Object.assign(copy.style, {
                top: (box.top - bounds.top) / scale + "px", left: (box.left - bounds.left) / scale + "px",
                width: box.width / scale + "px", height: box.height / scale + "px"
            });
            if (node.scrollTop) copy.dataset.scrollTop = node.scrollTop;
            return copy;
        });
    }

    function animateBounds(entry, from, to, { closing = false, outgoing = [], finish } = {}) {
        const element = entry.element;
        const sameBounds = ["top", "left", "width", "height"].every(key => Math.abs(from[key] - to[key]) < 1);
        if (motion.matches || !from.width || !to.width || sameBounds) { finish?.(); return; }

        const base = element.getBoundingClientRect(), scale = element.currentCSSZoom || 1;
        const duration = 220, halfway = duration / 2;
        const width = Math.max(base.width, from.width, to.width);
        const height = Math.max(base.height, from.height, to.height);
        const frame = box => ({
            transform: "translate(" + (box.left - base.left) / scale + "px, " + (box.top - base.top) / scale + "px)",
            clipPath: "inset(0px " + (width - box.width) / scale + "px " + (height - box.height) / scale + "px 0px round 6px)"
        });
        const styles = { width: element.style.width, height: element.style.height };
        element.style.width = width / scale + "px";
        element.style.height = height / scale + "px";
        const gutters = [...element.querySelectorAll(".hub-scrollbar, .hub-expansion-lane, .home-project-grid, .home-resource-grid")]
            .filter(node => node.getClientRects().length).map(node => {
                const computed = win.getComputedStyle(node);
                const vertical = node.offsetWidth - node.clientWidth - parseFloat(computed.borderLeftWidth) - parseFloat(computed.borderRightWidth);
                const horizontal = node.offsetHeight - node.clientHeight - parseFloat(computed.borderTopWidth) - parseFloat(computed.borderBottomWidth);
                const previous = [node.style.paddingRight, node.style.paddingBottom];
                if (vertical > 0) node.style.paddingRight = parseFloat(computed.paddingRight) + vertical + "px";
                if (horizontal > 0) node.style.paddingBottom = parseFloat(computed.paddingBottom) + horizontal + "px";
                return [node, previous];
            });
        host.classList.add("hub-expansion-moving");
        element.classList.add("hub-panel-moving");
        element.append(...outgoing);
        for (const copy of outgoing) copy.scrollTop = Number(copy.dataset.scrollTop ?? 0);
        const fades = [];
        const fade = (nodes, start, end, delay = 0) => {
            for (const node of nodes) {
                if (node) fades.push(node.animate([{ opacity: start }, { opacity: end }],
                    { duration: halfway, delay, fill: "both", easing: "linear" }));
            }
        };
        const inactive = [];
        let midpoint;
        const gate = nodes => {
            for (const node of nodes) {
                if (node && !node.inert) { node.inert = true; inactive.push(node); }
            }
        };
        const bodies = entry.transitionBodies;
        const headerEdgeSpace = (element.getBoundingClientRect().width -
            entry.header.getBoundingClientRect().width) / scale;
        if (closing) {
            const expanded = [...headerParts(entry, true), bodies?.expanded];
            fade(expanded, 1, 0);
            gate(expanded);
            midpoint = win.setTimeout(() => {
                element.classList.add("hub-expansion-show-compact");
                entry.header.style.inlineSize = Math.max(0, to.width / scale - headerEdgeSpace) + "px";
                if (bodies) entry.onExpandedChange?.(false);
                const compact = [...headerParts(entry, false), bodies?.compact];
                gate(compact);
                fade(compact, 0, 1);
            }, halfway);
        } else {
            const incoming = [...headerParts(entry, true), bodies?.expanded];
            gate(incoming);
            fade(outgoing, 1, 0);
            fade(incoming, 0, 1, halfway);
        }

        const effect = element.animate([frame(from), frame(to)],
            { duration, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" });
        animation = effect;
        cleanupMotion = () => {
            win.clearTimeout(midpoint);
            for (const fadeEffect of fades) fadeEffect.cancel();
            for (const node of inactive) node.inert = false;
            for (const copy of outgoing) copy.remove();
            for (const [node, [right, bottom]] of gutters) {
                node.style.paddingRight = right;
                node.style.paddingBottom = bottom;
            }
            Object.assign(element.style, styles);
            entry.header.style.removeProperty("inline-size");
            element.classList.remove("hub-panel-moving", "hub-expansion-show-compact");
            host.classList.remove("hub-expansion-moving");
        };
        effect.onfinish = () => {
            if (animation !== effect) return;
            stopMotion();
            finish?.();
        };
    }

    function select(entry, quietly = false) {
        if (active === entry && phase !== "collapsing") return;
        const previous = active;
        const from = visualBounds((previous ?? entry).element);
        const outgoing = !previous && !quietly && !motion.matches
            ? snapshot(entry, [...headerParts(entry, false), entry.transitionBodies?.compact]) : [];
        const wasClosing = phase === "collapsing";
        stopMotion();
        active = entry;
        phase = quietly ? "expanded" : "expanding";
        selectedPanels.set(stateOwner, { stateKey, title: entry.title });
        host.classList.add("hub-has-expanded-panel");
        host.classList.remove("hub-expansion-closing");
        if (previous !== entry) {
            if (previous) {
                for (const scroller of previous.scrollOwners) {
                    scrollPositions.set(scroller, { top: scroller.scrollTop, left: scroller.scrollLeft });
                }
                releaseElement(previous);
                previous.onLayout?.(false);
            }
            expandElement(entry);
        }
        updateTabs();
        sizeHost();
        if (entry !== previous || wasClosing) entry.onExpandedChange?.(true);
        hideNeighbors(true, !quietly && !motion.matches && (!previous || wasClosing));
        tooltips.dismiss();
        if (!quietly && !motion.matches) host.focus({ preventScroll: true });
        const finish = () => {
            phase = "expanded";
            sizeHost();
            if (!quietly) {
                entry.tab.focus({ preventScroll: true });
                revealInLane(navigation, entry.tab);
                revealFocus(entry.tab);
            }
            entry.onLayout?.(true);
        };
        revealInLane(navigation, entry.tab);
        for (const scroller of entry.scrollOwners) {
            const position = scrollPositions.get(scroller);
            if (position) scroller.scrollTo({ ...position, behavior: "instant" });
        }
        if (!quietly) animateBounds(entry, from, entry.element.getBoundingClientRect(), { outgoing, finish });
        else finish();
    }

    function finishCollapse(restoreFocus = true) {
        const previous = active;
        if (!previous) return;
        // A pointer click in Obsidian can leave focus on the document during collapse.
        const focused = doc.activeElement;
        const shouldRestoreFocus = host.contains(focused) || focused === doc.body;
        releaseElement(previous);
        active = null;
        phase = "compact";
        tooltips.dismiss();
        navigation.remove();
        collapseControl.remove();
        host.classList.remove("hub-has-expanded-panel", "hub-expansion-closing");
        host.style.removeProperty("--hub-expanded-height");
        scrollPositions.clear();
        hideNeighbors(false);
        if (restoreFocus && shouldRestoreFocus) {
            previous.trigger.focus({ preventScroll: true });
            revealFocus(previous.trigger);
        }
        previous.onLayout?.(false);
    }

    function collapse() {
        if (!active || phase === "collapsing") return;
        const from = visualBounds(active.element);
        stopMotion();
        selectedPanels.delete(stateOwner);
        phase = "collapsing";
        if (!motion.matches && host.contains(doc.activeElement)) host.focus({ preventScroll: true });
        host.classList.add("hub-expansion-closing");
        hideNeighbors(false, !motion.matches);
        const target = slot.getBoundingClientRect();
        animateBounds(active, from, target, { closing: true, finish: finishCollapse });
    }

    listen(nav, "keydown", event => {
        const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        const index = entries.findIndex(entry => entry.tab === event.target);
        const next = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 :
            (index + (event.key === "ArrowRight" ? 1 : -1) + entries.length) % entries.length;
        entries[index].tab.tabIndex = -1;
        entries[next].tab.tabIndex = 0;
        entries[next].tab.focus({ preventScroll: true });
    });
    listen(collapseControl, "click", collapse);
    listen(host, "focusin", event => {
        const lane = event.target.closest(".hub-expansion-header > .hub-expansion-lane");
        if (lane) revealInLane(lane, event.target);
    });
    listen(host, "keydown", event => {
        if (event.key !== "Escape" || !active || event.defaultPrevented || event.isComposing) return;
        if (event.target.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]")) return;
        event.preventDefault();
        event.stopPropagation();
        collapse();
    });
    listen(motion, "change", () => {
        if (!motion.matches) return;
        stopMotion();
        if (phase === "collapsing") finishCollapse();
        else if (active) {
            phase = "expanded";
            hideNeighbors(true);
            active.tab.focus({ preventScroll: true });
            active.onLayout?.(true);
        }
    });

    const resize = new win.ResizeObserver(sizeHost);
    resize.observe(host);
    if (viewport) resize.observe(viewport);
    listen(win, "resize", sizeHost);
    function dispose() {
        if (events.signal.aborted) return;
        signal.removeEventListener("abort", dispose);
        events.abort();
        resize.disconnect();
        stopMotion();
        finishCollapse(false);
        tooltips.dispose();
        host.classList.remove("hub-expansion-host");
        if (originalTabIndex === null) host.removeAttribute("tabindex");
        else host.setAttribute("tabindex", originalTabIndex);
        for (const entry of entries) {
            const { element, header, headerBand, surface, trigger, actions, center, generatedId, compactHeading } = entry;
            surface.classList.remove("hub-dashboard-panel");
            header.classList.remove("hub-expansion-header", "hub-expansion-has-center");
            trigger.remove();
            actions.replaceWith(...actions.firstElementChild.childNodes);
            if (center) center.replaceWith(...center.firstElementChild.childNodes);
            headerBand.replaceWith(header);
            if (generatedId) element.removeAttribute("id");
            for (const heading of compactHeading ?? []) {
                heading.classList.remove("hub-expansion-compact-heading");
                heading.querySelector("svg")?.parentElement.classList.remove("hub-panel-heading-slot");
            }
        }
    }
    signal.addEventListener("abort", dispose, { once: true });
    const selection = selectedPanels.get(stateOwner);
    const remembered = selection?.stateKey === stateKey && entries.find(entry => entry.title === selection.title);
    if (remembered) select(remembered, true);
    return {
        open(title) {
            const entry = entries.find(entry => entry.title === title);
            if (entry) select(entry);
        },
        reveal(title) {
            if (!active) return;
            const entry = entries.find(entry => entry.title === title);
            if (entry) select(entry, true);
        },
        reset() {
            if (selectedPanels.get(stateOwner)?.stateKey === stateKey) selectedPanels.delete(stateOwner);
            stopMotion();
            finishCollapse(false);
        },
        dispose
    };
}

module.exports = { mountExpansionHost };
