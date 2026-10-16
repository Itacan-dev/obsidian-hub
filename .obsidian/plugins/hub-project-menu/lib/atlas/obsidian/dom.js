"use strict";
function text(node, value) { const next = String(value ?? ""); if (node.textContent !== next) node.textContent = next; }
function place(parent, node, before = null) {
    if (node.parentNode === parent && node.nextSibling === before) return;
    if (node.parentNode === parent && typeof parent.moveBefore === "function") parent.moveBefore(node, before);
    else parent.insertBefore(node, before);
}
// A keyed list owns only its direct children. Updating a label or status never
// detaches a row; callers keep interactive controls and disclosures in the record.
function keyed(parent, create, update, key = item => item.id) {
    const records = new Map();
    return items => {
        const wanted = new Set(items.map(key));
        for (const [id, record] of records) if (!wanted.has(id)) { record.node.remove(); records.delete(id); }
        let cursor = parent.firstChild;
        for (const item of items) {
            const id = key(item); let record = records.get(id);
            if (!record) { record = create(item); records.set(id, record); }
            record.value = item; update(record, item);
            if (record.node !== cursor) place(parent, record.node, cursor);
            cursor = record.node.nextSibling;
        }
    };
}
function phaseAnnouncer(parent) {
    const node = parent.ownerDocument.createElement("div"); node.className = "hub-atlas-announcement"; node.setAttribute("role", "status"); node.setAttribute("aria-live", "polite"); node.setAttribute("aria-atomic", "true"); parent.appendChild(node);
    let previous = null;
    return items => { const key = JSON.stringify(items.map(i => [i.key, i.phase])); if (key === previous) return; previous = key;
        text(node, items.map(i => i.label + ": " + (i.detail ?? i.phase)).join(". ")); };
}
module.exports = { text, place, keyed, phaseAnnouncer };
