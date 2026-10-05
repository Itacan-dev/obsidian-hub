"use strict";

function setHubTooltip(element, text, position = "bottom") {
    element.removeAttribute("title");
    if (!text) {
        element.removeAttribute("aria-label");
        element.removeAttribute("data-tooltip-position");
        return;
    }
    element.setAttribute("aria-label", String(text));
    element.setAttribute("data-tooltip-position", position);
}

function watchHubTooltips(root, component) {
    // These title classes are shared by Project/Resource full and note views.
    const titles = ".project-browser-name, .project-folder-crumb";
    const watched = new Set();
    const labels = new WeakMap();
    const refreshTitle = element => {
        const text = element.textContent?.trim() ?? "";
        const overflowing = !element.isContentEditable && element.clientWidth > 0 &&
            element.scrollWidth > element.clientWidth &&
            element.ownerDocument.defaultView.getComputedStyle(element).textOverflow === "ellipsis";
        if (overflowing && text) {
            setHubTooltip(element, text);
            labels.set(element, text);
        } else if (labels.has(element)) {
            // Do not erase an unrelated error/help tooltip assigned by the UI.
            if (element.getAttribute("aria-label") === labels.get(element)) setHubTooltip(element, null);
            labels.delete(element);
        }
    };
    const resize = new ResizeObserver(records => records.forEach(({ target }) => refreshTitle(target)));
    const update = element => {
        if (element.hasAttribute?.("title")) setHubTooltip(element, element.getAttribute("title"));
        if (element.matches?.(titles)) {
            if (!watched.has(element)) { watched.add(element); resize.observe(element); }
            refreshTitle(element);
        }
        element.querySelectorAll?.(`[title], ${titles}`).forEach(update);
    };
    const refreshHovered = event => {
        const title = event.target.closest?.(titles);
        if (title && root.contains(title)) refreshTitle(title);
    };
    // Refresh before Obsidian's mouse tooltip handler, including after font/layout changes.
    component.registerDomEvent(root, "pointerover", refreshHovered, true);
    component.registerDomEvent(root, "focusin", refreshHovered, true);
    update(root);
    const observer = new MutationObserver(records => {
        const changed = new Set(records.map(record =>
            record.target.nodeType === 3 ? record.target.parentElement : record.target));
        changed.forEach(update);
        for (const element of watched) {
            if (!root.contains(element)) { resize.unobserve(element); watched.delete(element); }
        }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ["title", "class", "contenteditable"] });
    component.register(() => { observer.disconnect(); resize.disconnect(); watched.clear(); });
}

let detailTooltipId = 0;

// Opt-in immediate, two-line variant of Obsidian's tooltip surface. Existing
// aria-label tooltips and their timing are deliberately untouched.
function createImmediateHubTooltip(root) {
    const doc = root.ownerDocument, win = doc.defaultView;
    const definitions = new WeakMap(), cleanups = [];
    let hovered = null, focused = null, active = null, tooltip = null;
    let keyboardNavigation = false;
    const id = `hub-detail-tooltip-${++detailTooltipId}`;
    function hide() {
        active?.removeAttribute('aria-describedby');
        tooltip?.remove(); tooltip = null; active = null;
    }
    function show() {
        const button = hovered ?? focused;
        if (!button || !root.contains(button) || button.disabled) { hide(); return; }
        if (active === button) return;
        hide(); active = button;
        const definition = definitions.get(button);
        tooltip = doc.createElement('div');
        tooltip.className = 'tooltip mod-bottom hub-detail-tooltip hub-button-scope';
        tooltip.id = id; tooltip.setAttribute('role', 'tooltip');
        const title = tooltip.appendChild(doc.createElement('strong'));
        title.textContent = definition.title;
        const description = tooltip.appendChild(doc.createElement('div'));
        description.className = 'hub-detail-tooltip-description';
        description.textContent = definition.description;
        doc.body.append(tooltip);
        button.setAttribute('aria-describedby', id);
        const rect = button.getBoundingClientRect(), bounds = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - bounds.width / 2, win.innerWidth - bounds.width - 8))}px`;
        const below = rect.bottom + 6;
        tooltip.style.top = `${Math.max(8, below + bounds.height <= win.innerHeight - 8 ? below : rect.top - bounds.height - 6)}px`;
    }
    const target = event => {
        const button = event.target.closest?.('button');
        return button && definitions.has(button) ? button : null;
    };
    function listen(element, type, handler, options) {
        element.addEventListener(type, handler, options);
        cleanups.push(() => element.removeEventListener(type, handler, options));
    }
    // Insertion under a stationary cursor can generate pointerover. Actual
    // movement expresses hover intent without a timer or appearance delay.
    listen(root, 'pointermove', event => {
        if (event.pointerType === 'touch') return;
        hovered = target(event); show();
    });
    listen(root, 'pointerout', event => {
        if (hovered?.contains(event.relatedTarget)) return;
        hovered = null; show();
    });
    // :focus-visible alone is insufficient: modal autofocus may inherit it
    // from the key that opened the report. Require a new navigation gesture.
    listen(doc, 'keydown', event => {
        keyboardNavigation = event.key === 'Tab' ||
            (root.contains(event.target) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key));
    }, true);
    listen(doc, 'keyup', () => { keyboardNavigation = false; }, true);
    listen(doc, 'pointerdown', () => {
        keyboardNavigation = false; focused = null; show();
    }, true);
    listen(root, 'focusin', event => {
        const button = target(event);
        focused = keyboardNavigation && button?.matches(':focus-visible') ? button : null;
        show();
    });
    listen(root, 'focusout', () => { focused = null; show(); });
    listen(root, 'keydown', event => {
        if (event.key === 'Escape' && tooltip) {
            hide(); event.preventDefault(); event.stopPropagation();
        }
    });
    listen(win, 'resize', hide);
    listen(doc, 'scroll', hide, true);
    return {
        bind(button, definition) {
            setHubTooltip(button, null); // No browser title or delayed duplicate.
            definitions.set(button, definition);
            button.setAttribute('aria-description', `${definition.title} ${definition.description}`);
        },
        dispose() { hide(); cleanups.splice(0).forEach(cleanup => cleanup()); }
    };
}

// Obsidian's normal aria-label tooltips handle pointer hover. Opt-in keyboard
// help uses that same small native surface, default delay and placement.
function bindHubFocusTooltip(root, component, selector) {
    const doc = root.ownerDocument, win = doc.defaultView;
    let timer = 0, tooltip = null, target = null;
    const hide = () => {
        win.clearTimeout(timer); timer = 0;
        target?.removeAttribute("aria-describedby");
        tooltip?.remove(); tooltip = null; target = null;
    };
    const listen = (element, type, handler, options) => {
        element.addEventListener(type, handler, options);
        component.register(() => element.removeEventListener(type, handler, options));
    };
    listen(root, "focusin", event => {
        hide();
        const element = event.target.closest?.(selector);
        if (!element?.matches(":focus-visible")) return;
        const delay = Number(element.getAttribute("data-tooltip-delay") ?? 1000);
        timer = win.setTimeout(() => {
            if (!root.contains(element) || doc.activeElement !== element) return;
            target = element;
            tooltip = doc.createElement("div");
            tooltip.className = "tooltip"; tooltip.setAttribute("role", "tooltip");
            tooltip.id = `hub-focus-tooltip-${++detailTooltipId}`;
            tooltip.textContent = element.dataset.hubFocusTooltip || element.getAttribute("aria-label");
            const arrow = tooltip.appendChild(doc.createElement("div")); arrow.className = "tooltip-arrow";
            doc.body.append(tooltip); element.setAttribute("aria-describedby", tooltip.id);
            const bounds = element.getBoundingClientRect(), size = tooltip.getBoundingClientRect();
            const gap = Number(element.getAttribute("data-tooltip-gap") ?? 8);
            const center = Math.max(size.width / 2 + gap, Math.min(bounds.left + bounds.width / 2, win.innerWidth - size.width / 2 - gap));
            tooltip.style.left = center + "px";
            tooltip.style.top = Math.max(gap, Math.min(bounds.bottom + gap, win.innerHeight - size.height - gap)) + "px";
            arrow.style.left = Math.max(5, Math.min(size.width - 5, bounds.left + bounds.width / 2 - center + size.width / 2)) + "px";
        }, delay);
    });
    listen(root, "focusout", hide);
    listen(doc, "pointerdown", hide, true);
    listen(doc, "pointerover", hide, true); // Leave hover to the native handler.
    listen(doc, "keydown", event => { if (event.key === "Escape") hide(); });
    listen(doc, "scroll", hide, true); listen(win, "resize", hide);
    component.register(hide);
    return hide;
}

module.exports = { setHubTooltip, watchHubTooltips, createImmediateHubTooltip, bindHubFocusTooltip };
