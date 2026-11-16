"use strict";

// One scroll owner per panel. Rendering more rows does not clear existing
// Markdown components, reset scroll position, or retain a previous view's work.
function createHistoryPager(container, component) {
    let records = [], renderRow = null, cursor = 0;
    const append = () => {
        const end = Math.min(cursor + 50, records.length);
        while (cursor < end) renderRow(records[cursor++]);
    };
    const scroll = () => {
        if (cursor < records.length &&
            container.scrollTop + container.clientHeight >= container.scrollHeight - 48) append();
    };
    container.addEventListener("scroll", scroll, { passive: true });
    const reset = () => { records = []; renderRow = null; cursor = 0; };
    component.register(() => { reset(); container.removeEventListener("scroll", scroll); });
    return {
        reset,
        get renderedCount() { return cursor; },
        render(items, renderer, minimumCount = 50) { reset(); records = items; renderRow = renderer; do { append(); } while (cursor < Math.min(minimumCount, records.length)); }
    };
}
module.exports = { createHistoryPager };

