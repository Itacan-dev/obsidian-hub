"use strict";
const { inheritColorOwner } = require("./color-system");
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
function createImmediateHubTooltip(root, { interactive = false, contentOnly = false } = {}) {
    const doc = root.ownerDocument, win = doc.defaultView;
    const definitions = new WeakMap(), cleanups = [];
    let hovered = null, focused = null, active = null, tooltip = null;
    let keyboardNavigation = false, activeDescription = null, pinned = null, overTooltip = false, leaveTimer = null, detachedObserver = null;
    const id = `hub-detail-tooltip-${++detailTooltipId}`;
    function hide() {
        win.clearTimeout(leaveTimer); detachedObserver?.disconnect(); detachedObserver = null;
        if (active) {
            const descriptions = (active.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(value => value && value !== id);
            if (descriptions.length) active.setAttribute('aria-describedby', descriptions.join(' '));
            else active.removeAttribute('aria-describedby');
            if (activeDescription !== null) active.setAttribute('aria-description', activeDescription);
        }
        activeDescription = null;
        tooltip?.remove(); tooltip = null; active = null;
    }
    function dismiss() { hovered = focused = pinned = null; overTooltip = false; hide(); }
    function position() {
        if (!tooltip || !active?.isConnected) return;
        const rect = active.getBoundingClientRect(), bounds = tooltip.getBoundingClientRect();
        const viewport = win.visualViewport, left = (viewport?.offsetLeft ?? 0) + 8, top = (viewport?.offsetTop ?? 0) + 8;
        const right = left + (viewport?.width ?? win.innerWidth) - 16, bottom = top + (viewport?.height ?? win.innerHeight) - 16;
        tooltip.style.left = `${Math.max(left, Math.min(rect.left + rect.width / 2 - bounds.width / 2, right - bounds.width))}px`;
        const below = rect.bottom + 6;
        tooltip.style.top = `${Math.max(top, Math.min(below + bounds.height <= bottom ? below : rect.top - bounds.height - 6, bottom - bounds.height))}px`;
    }
    function leave() {
        win.clearTimeout(leaveTimer);
        leaveTimer = win.setTimeout(() => { if (!hovered && !focused && !pinned && !overTooltip) hide(); }, 150);
    }
    function show() {
        const button = pinned ?? hovered ?? focused;
        if (!button || !root.contains(button) || button.disabled) { if (interactive) leave(); else hide(); return; }
        win.clearTimeout(leaveTimer);
        if (active === button) return;
        hide(); active = button;
        const definition = definitions.get(button);
        tooltip = doc.createElement('div');
        tooltip.className = 'tooltip mod-bottom hub-detail-tooltip hub-button-scope' + (contentOnly ? ' hub-task-description-tooltip' : '');
        tooltip.id = id; tooltip.setAttribute('role', 'tooltip');
        if (!contentOnly) { const title = tooltip.appendChild(doc.createElement('strong')); title.textContent = definition.title; }
        const description = tooltip.appendChild(doc.createElement('div'));
        description.className = 'hub-detail-tooltip-description';
        description.textContent = definition.description;
        inheritColorOwner(tooltip, root);
        doc.body.append(tooltip);
        if (interactive) {
            // The same native tooltip surface enters the top layer only for
            // read-only task previews, so modal/popover scrolling cannot clip it.
            tooltip.setAttribute('popover', 'manual'); tooltip.showPopover?.();
            tooltip.addEventListener('pointerenter', () => { overTooltip = true; win.clearTimeout(leaveTimer); });
            tooltip.addEventListener('pointerleave', () => { overTooltip = false; if (!hovered && !focused && !pinned) leave(); });
            detachedObserver = new win.MutationObserver(() => {
                if (!root.isConnected) dispose();
                else if (!active?.isConnected || active.hidden) dismiss(); else position();
            });
            detachedObserver.observe(doc.body, { childList: true, subtree: true });
        }
        activeDescription = button.getAttribute('aria-description');
        button.removeAttribute('aria-description');
        button.setAttribute('aria-describedby', [button.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
        position();
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
        if (interactive && tooltip?.contains(event.relatedTarget)) { hovered = null; overTooltip = true; return; }
        hovered = null; show();
    });
    // :focus-visible alone is insufficient: modal autofocus may inherit it
    // from the key that opened the report. Require a new navigation gesture.
    if (interactive) listen(win, 'keydown', event => {
        if (event.key === 'Escape' && tooltip) { dismiss(); event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    listen(doc, 'keydown', event => {
        keyboardNavigation = event.key === 'Tab' ||
            (root.contains(event.target) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key));
    }, true);
    listen(doc, 'keyup', () => { keyboardNavigation = false; }, true);
    listen(doc, 'pointerdown', event => {
        if (interactive && tooltip?.contains(event.target)) return;
        if (interactive && active && !active.contains(event.target)) dismiss();
        keyboardNavigation = false; focused = null; show();
    }, true);
    listen(root, 'focusin', event => {
        const button = target(event);
        focused = interactive ? button : keyboardNavigation && button?.matches(':focus-visible') ? button : null;
        show();
    });
    listen(root, 'focusout', () => {
        focused = null;
        if (interactive && !hovered && !pinned && !overTooltip) hide(); else show();
    });
    listen(root, 'keydown', event => {
        if (event.key === 'Escape' && tooltip) {
            hide(); event.preventDefault(); event.stopPropagation();
        }
    });
    if (interactive) listen(root, 'click', event => {
        const button = target(event); if (!button) return;
        if (pinned === button) dismiss(); else { pinned = button; show(); }
    }, true);
    listen(win, 'resize', interactive ? dismiss : hide);
    listen(doc, 'scroll', event => { if (!interactive || !tooltip?.contains(event.target)) (interactive ? dismiss : hide)(); }, true);
    function dispose() { dismiss(); cleanups.splice(0).forEach(cleanup => cleanup()); }
    return {
        bind(button, definition) {
            // Suppress the native duplicate without erasing the control's name.
            button.removeAttribute('title');
            button.removeAttribute('data-tooltip-position');
            // Obsidian checks this property before showing aria-label tooltips.
            const nativeTooltip = button.style.getPropertyValue('--no-tooltip'), priority = button.style.getPropertyPriority('--no-tooltip');
            button.style.setProperty('--no-tooltip', 'true');
            cleanups.push(() => {
                if (nativeTooltip) button.style.setProperty('--no-tooltip', nativeTooltip, priority);
                else button.style.removeProperty('--no-tooltip');
            });
            definitions.set(button, definition);
            if (!button.hasAttribute('aria-description')) button.setAttribute('aria-description', contentOnly ? definition.description : `${definition.title} ${definition.description}`);
        },
        update(button, definition) {
            definitions.set(button, definition);
            const text = contentOnly ? definition.description : `${definition.title} ${definition.description}`;
            if (active === button) { activeDescription = text; tooltip.querySelector('.hub-detail-tooltip-description').textContent = definition.description; position(); }
            else button.setAttribute('aria-description', text);
        },
        dismiss,
        dispose
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
            inheritColorOwner(tooltip, root);
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
