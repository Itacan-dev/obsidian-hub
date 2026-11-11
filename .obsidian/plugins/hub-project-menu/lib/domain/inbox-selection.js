"use strict";

function inboxSelection(items, selected, anchor, target, modifiers, eligibility) {
    const ids = items.map(item => item.id), item = items.find(item => item.id === target);
    if (!item) return null;
    const add = !!(modifiers.ctrlKey || modifiers.metaKey), range = !!modifiers.shiftKey;
    const current = new Set([...selected].filter(id => ids.includes(id)));
    const result = (set, nextAnchor) => ({ ids: ids.filter(id => set.has(id)), anchor: nextAnchor });
    if (!add && !range) return result(new Set([target]), target);
    if (add && !range && current.has(target)) { current.delete(target); return result(current, target); }
    const first = items.find(c => current.has(c.id)), firstEligibility = first && eligibility(first), endEligibility = eligibility(item);
    if (firstEligibility?.reason) return { reason: firstEligibility.reason };
    if (endEligibility.reason) return { reason: endEligibility.reason };
    const anchorItem = items.find(c => c.id === anchor) ?? first ?? item, anchorEligibility = eligibility(anchorItem);
    const group = range ? anchorEligibility.group : firstEligibility?.group ?? endEligibility.group;
    if (range && anchorEligibility.reason) return { reason: anchorEligibility.reason };
    if (endEligibility.group !== group || add && firstEligibility && firstEligibility.group !== group) return { reason: "Select matching texts or files without unrelated retained operations." };
    if (!range) { current.add(target); return result(current, target); }
    const a = ids.indexOf(anchorItem.id), b = ids.indexOf(target), next = add ? current : new Set();
    for (const candidate of items.slice(Math.min(a, b), Math.max(a, b) + 1)) {
        const allowed = eligibility(candidate);
        if (!allowed.reason && allowed.group === group) next.add(candidate.id);
    }
    return result(next, anchorItem.id);
}

function inboxFiles(captures, resolvePath = ref => ref.path) {
    const seen = new Set(), refs = [];
    for (const capture of captures) for (const ref of capture.attachments ?? []) {
        const path = resolvePath(ref);
        if (!seen.has(path)) { seen.add(path); refs.push(ref); }
    }
    return refs;
}
module.exports = { inboxSelection, inboxFiles };
