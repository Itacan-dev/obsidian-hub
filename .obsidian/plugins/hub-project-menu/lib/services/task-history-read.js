"use strict";
const consumers = new WeakMap();
function preserveHistoryInteraction(body, render) {
    const document = body.ownerDocument, focused = document.activeElement;
    const row = body.contains(focused) ? focused.closest("[role=button]") : null;
    const key = row?.historyReadKey, controls = "a[href],button,input,textarea,select,[tabindex]";
    const control = row ? [...row.querySelectorAll(controls)].indexOf(focused) : -1;
    const scroll = body.scrollTop, count = body.childElementCount;
    render();
    // Keep already expanded 50-row batches when a real History refresh occurs.
    // The existing pager remains the only pagination implementation.
    let previous = -1;
    while (body.childElementCount < count && previous !== body.childElementCount) {
        previous = body.childElementCount;
        body.scrollTop = body.scrollHeight;
        body.dispatchEvent(new document.defaultView.Event("scroll"));
    }
    body.scrollTop = scroll;
    if (key && !focused.isConnected) {
        const next = [...body.querySelectorAll("[role=button]")].find(row => row.historyReadKey === key);
        (control >= 0 ? next?.querySelectorAll(controls)[control] : next)?.focus({ preventScroll: true });
    }
}
function createTaskHistoryRead({ plugin, component, completionFeed, changed = () => { } }) {
    let closed = false, generation = 0, cached = null, last = null;
    let active = consumers.get(plugin);
    if (!active) {
        consumers.set(plugin, active = new Set());
        plugin.register(() => {
            for (const close of [...active])
                close();
            active.clear();
            consumers.delete(plugin);
        });
    }
    const invalidate = () => { generation++; cached = null; };
    const close = () => {
        if (closed)
            return;
        closed = true;
        invalidate();
        active.delete(close);
    };
    active.add(close);
    component.register(close);
    if (completionFeed) {
        const stop = completionFeed.subscribe(() => {
            if (!closed) {
                invalidate();
                changed();
            }
        });
        component.register(stop);
    }
    return {
        invalidate, close,
        async read(cancelled = () => false) {
            if (closed || cancelled())
                return null;
            const ticket = generation;
            if (!cached)
                cached = completionFeed.read().then(result => ({ records: result.records, diagnostics: result.diagnostics, signature: JSON.stringify(result.records) }));
            const pending = cached;
            let result;
            try {
                result = await pending;
            }
            catch (error) {
                if (cached === pending)
                    cached = null;
                if (closed || ticket !== generation || cancelled())
                    return null;
                throw error;
            }
            if (closed || ticket !== generation || cancelled())
                return null;
            return { ...result, changed: result.signature !== last };
        },
        accept(result) { last = result.signature; },
        preserve(body, render) { preserveHistoryInteraction(body, render); },
        reveal(record) {
            if (closed)
                throw Error("This History view has closed.");
            if (record?.nativeHistory) {
                if (!completionFeed || record.nativeHistory.navigation.state !== "available")
                    return null;
                return completionFeed.reveal(record);
            }
            return null;
        }
    };
}
module.exports = { createTaskHistoryRead };
