"use strict";

const pending = new WeakMap();

function trackDashboardRender(element, work) {
    const root = element.closest(".home-dashboard, .project-dashboard");
    if (!root) return work;
    let jobs = pending.get(root);
    if (!jobs) pending.set(root, jobs = new Set());
    jobs.add(work);
    work.then(() => jobs.delete(work), () => jobs.delete(work));
    return work;
}

async function prepareDashboardContent(root) {
    while (pending.get(root)?.size) {
        await Promise.allSettled([...pending.get(root)]);
    }
}

module.exports = { trackDashboardRender, prepareDashboardContent };
