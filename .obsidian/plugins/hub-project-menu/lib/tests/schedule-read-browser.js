"use strict";
window.runScheduleReadChecks = async ctx => {
    let checks = 0;
    const check = (condition, message) => { checks++; if (!condition) throw Error(message); };
    const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
    const waitFor = predicate => new Promise(resolve => { if (predicate()) return resolve(); const observer = new MutationObserver(() => {
        if (predicate()) { observer.disconnect(); resolve(); }
    }); observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); });
    const clickMode = mode => ctx.get().root.querySelector(`[data-workspace-mode=${mode}]`).click();
    const clickControl = key => ctx.get().root.querySelector(`[data-schedule-control=${key}]`).click();
    const ready = () => ctx.get().root.querySelector('.hub-task-view-content')?.getAttribute('aria-busy') !== 'true' &&
        !!ctx.get().root.querySelector('[data-schedule-control=view-week]');
    const snapshot = () => {
        const content = ctx.get().root.querySelector('.hub-task-view-content');
        return { text: content.textContent.replace(/\s+/g, ' ').trim(),
            dates: [...content.querySelectorAll('time')].map(el => [el.textContent, el.getAttribute('datetime'), el.className]),
            controls: [...content.querySelectorAll('[data-schedule-control]')].map(el => [el.dataset.scheduleControl, el.getAttribute('aria-pressed')]),
            tasks: [...content.querySelectorAll('.project-task-text')].map(el => el.textContent) };
    };
    // Execute the captured original renderer against the very same fixture,
    // module graph, date and source data as the production facade renderer.
    ctx.sources['ui/task-workspace-original'] = await (await fetch('task-workspace-original.cjs')).text();
    const oldMount = ctx.load('ui/task-workspace-original').mountTaskWorkspace;
    async function renderSequence(mount) {
        ctx.mount(ctx.project, mount); clickMode('schedule'); await waitFor(ready);
        const results = [snapshot()];
        for (const view of ['month', 'week', 'upcoming']) {
            clickControl('view-' + view); results.push(snapshot());
            if (view !== 'upcoming') for (const direction of ['next', 'previous', 'today']) { clickControl(direction); results.push(snapshot()); }
        }
        return results;
    }
    const before = JSON.stringify([...ctx.contents]), historyBefore = ctx.counts().history;
    const original = await renderSequence(oldMount), current = await renderSequence();
    check(JSON.stringify(current) === JSON.stringify(original), 'Exact old/new rendered Overview/Month/Week, date labels, grouping, order and controls');
    check(JSON.stringify([...ctx.contents]) === before && ctx.counts().history === historyBefore, 'Read/render navigation writes no task Markdown or history');
    check(!ctx.get().root.textContent.includes('Solve problem set 4'), 'Schedule still excludes mounted Resource tasks');
    const indexReads = ctx.counts().reads;
    for (const key of ['view-month', 'next', 'previous', 'view-week', 'today', 'view-upcoming']) clickControl(key);
    check(ctx.counts().reads === indexReads, 'View and date navigation reuse the current read without rescanning');
    const location = ctx.get().root.querySelector('.hub-full-location');
    location.click(); await ctx.settle(); check(ctx.plugin.opened?.startsWith(ctx.project.root + '/'), 'Location uses validated facade reveal and original note route');
    const count = ctx.counts().history, checkbox = ctx.get().root.querySelector('.hub-full-task-card input[type=checkbox]');
    const textBefore = JSON.stringify([...ctx.contents]); checkbox.click();
    await waitFor(() => ctx.counts().history > count); await ctx.settle();
    check(ctx.counts().history === count + 1 && JSON.stringify([...ctx.contents]) !== textBefore, 'Unchanged legacy completion writer records exactly one event');
    const taskButton = ctx.get().root.querySelector('.hub-full-add-task'); taskButton.click(); await ctx.settle();
    check(!!document.querySelector('.modal-container'), 'Existing Task button opens the legacy creator: ' + ctx.notices.join('; ')); window.lastModal?.close();
    ctx.mount(ctx.resource); check(!ctx.get().root.querySelector('[data-workspace-mode=schedule]'), 'Resource early return remains unchanged');

    const actual = ctx.plugin.taskService, requests = []; let started = deferred();
    const wrapper = { subscribe: actual.subscribe.bind(actual), resolveReveal: actual.resolveReveal.bind(actual),
        resolveLegacyAction: actual.resolveLegacyAction.bind(actual), close: actual.close.bind(actual),
        queryStructured(options) { const request = { options, ...deferred() }; requests.push(request); started.resolve(request); return request.promise; } };
    ctx.plugin.taskService = wrapper;
    ctx.mount(ctx.project); clickMode('schedule'); const a = await started.promise; started = deferred();
    // The old component is disposed before Project B's read begins.
    ctx.mount(ctx.plugin.projectWizard.getProjectById('p2')); clickMode('schedule'); const b = await started.promise;
    b.resolve(await actual.queryStructured(b.options)); await waitFor(ready); const newest = snapshot();
    a.resolve(await actual.queryStructured(a.options)); await ctx.settle();
    check(JSON.stringify(snapshot()) === JSON.stringify(newest), 'Late Project A cannot overwrite Project B');
    started = deferred(); ctx.mount(ctx.project); clickMode('schedule'); const pending = await started.promise;
    ctx.get().controller.state.scheduleView = 'week'; ctx.get().controller.render(); clickControl('next'); clickControl('next'); clickControl('view-month');
    const anchor = ctx.get().controller.state.anchor.getTime();
    pending.resolve(await actual.queryStructured(pending.options)); await waitFor(ready);
    check(ctx.get().controller.state.scheduleView === 'month' && ctx.get().controller.state.anchor.getTime() === anchor, 'Pending read retains newest view and date navigation');
    check(ctx.get().root.querySelector('[data-schedule-control=view-month]').getAttribute('aria-pressed') === 'true', 'Actual renderer publishes the latest Month view');
    started = deferred(); ctx.plugin.taskData.invalidateAll(); await ctx.settle(); const old = await started.promise;
    started = deferred(); ctx.plugin.taskData.invalidateAll(); await ctx.settle(); const fresh = await started.promise;
    fresh.resolve(await actual.queryStructured(fresh.options)); await waitFor(ready); const refreshed = snapshot();
    old.resolve(await actual.queryStructured(old.options)); await ctx.settle();
    check(JSON.stringify(snapshot()) === JSON.stringify(refreshed), 'Older invalidated read cannot overwrite completed Dataview refresh');
    clickControl('view-upcoming');
    started = deferred(); ctx.plugin.taskData.invalidateAll(); await ctx.settle(); const beforeWrite = await started.promise;
    const oldData = await actual.queryStructured(beforeWrite.options), requestCount = requests.length;
    const writer = ctx.plugin.mutateTask, written = deferred(), events = ctx.counts().history;
    ctx.plugin.mutateTask = async request => { const result = await writer(request); written.resolve(); return result; };
    const row = ctx.get().root.querySelector('.hub-full-task-card'), title = row.querySelector('.project-task-text').textContent;
    row.querySelector('input[type=checkbox]').click(); await written.promise; await ctx.settle();
    beforeWrite.resolve(oldData);
    for (const request of requests.slice(requestCount)) request.resolve(await actual.queryStructured(request.options));
    await ctx.settle(); ctx.plugin.mutateTask = writer;
    check(ctx.counts().history === events + 1, 'Legacy mutation while a read is pending records one completion');
    check(![...ctx.get().root.querySelectorAll('.project-task-text')].some(el => el.textContent === title), 'Old pending index data cannot undo the immediate legacy writer result');
    check(ctx.get().root.querySelector('.hub-task-view-content').getAttribute('aria-busy') !== 'true', 'Writer reconciliation clears the cancelled loading state');
    for (const operation of ['rename', 'delete']) {
        started = deferred(); ctx.plugin.taskData.invalidateAll(); await ctx.settle(); const prior = await started.promise;
        const priorData = await actual.queryStructured(prior.options);
        const path = ctx.project.root + (operation === 'rename' ? '/Tasks.md' : '/Moved Tasks.md');
        const file = ctx.objects.get(path); check(!!file, 'Source exists before ' + operation + ' race');
        started = deferred(); ctx.objects.delete(path);
        if (operation === 'rename') {
            const next = ctx.project.root + '/Moved Tasks.md'; file.path = next; ctx.objects.set(next, file);
            ctx.contents.set(next, ctx.contents.get(path)); ctx.contents.delete(path);
            ctx.plugin.app.vault.emit('rename', file, path);
        } else { ctx.contents.delete(path); ctx.plugin.app.vault.emit('delete', file); }
        await ctx.settle(); const replacement = await started.promise;
        replacement.resolve(await actual.queryStructured(replacement.options)); await waitFor(ready); await ctx.settle(); const latest = snapshot();
        prior.resolve(priorData); await ctx.settle();
        const observed = snapshot();
        const differences = Object.keys(latest).filter(key => JSON.stringify(latest[key]) !== JSON.stringify(observed[key]));
        check(differences.length === 0, 'Late source read cannot reverse ' + operation + ': ' + JSON.stringify(differences.map(key => ({ key, expected: latest[key], observed: observed[key] }))).slice(0, 1800));
    }
    started = deferred(); ctx.plugin.taskData.invalidateAll(); await ctx.settle(); const closed = await started.promise;
    ctx.get().component.unload(); const closedText = ctx.get().root.textContent; closed.reject(Error('Disposed read rejected')); await ctx.settle();
    check(ctx.get().root.textContent === closedText, 'Closed component ignores rejected pending reads');
    ctx.plugin.taskService = actual;
    for (let i = 0; i < 10; i++) { ctx.mount(ctx.project); ctx.get().component.unload(); }
    check(ctx.plugin.taskData.subscribers.size === 1, 'Repeated Schedule mount/disposal retains only the shared Search facade watcher');
    ctx.mount(ctx.project); clickMode('schedule'); await waitFor(ready);
    ctx.get().root.querySelector('[data-schedule-control=view-week]').focus();
    check(document.activeElement.dataset.scheduleControl === 'view-week', 'Schedule controls remain keyboard focusable');
    document.getElementById('result').textContent = `PASS: ${checks} actual Schedule facade checks; old/new DOM parity, Overview/Month/Week/date navigation, source reveal, legacy completion/create, scopes, pending generations, disposal and shared watcher ownership.`;
};
