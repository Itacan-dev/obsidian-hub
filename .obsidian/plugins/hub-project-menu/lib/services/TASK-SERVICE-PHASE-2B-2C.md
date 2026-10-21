# Phase 2B-2C handoff — Tasks panel reads and Roadmap task reads

Proposed work only. Phase 2B-2B stops after Daily Brief/Schedule. Reuse the
existing `plugin.taskService` and its one legacy adapter; native authority,
Task-location changes, mounted Resource expansion and writer migration remain
outside scope. Reinspect current sources before editing.

## Recommended subdivisions

1. **2B-2C-1: Project/Resource Tasks panel reads.** Establish old actual dashboard
   render inputs/DOM, add the correct panel visibility policy to the structured
   read contract, then convert enumeration/subscription only. Keep legacy action
   and Oath partition bridges. Verify before tackling planning pickers.
2. **2B-2C-2: Roadmap-associated task reads.** Audit the Phase editor's task list
   and selection lifecycle, then migrate its candidate reads if the selected
   legacy references can safely continue into the existing transaction. If a
   path requires writer redesign, explicitly defer it to the writer phase rather
   than silently changing Phase assignment semantics.

## Exact current dependencies

| Path | Current behavior and next boundary |
| --- | --- |
| [`System/Dashboards/Project/view.js:2815`](../../../../../System/Dashboards/Project/view.js#L2815) | `readProjectTasks()` recursively calls `window.hubTaskData.readPages(dv, projectRoot)` with a raw Dataview fallback. Project and Resource dashboards share this renderer. `renderCurrentTasks():3098` synchronously assigns that list; `:3183` subscribes directly to task data. Adapt those task-only reads through the shared facade; do not leave an independent raw task authority as failure fallback. |
| [`System/Dashboards/Project/view.js:2774`](../../../../../System/Dashboards/Project/view.js#L2774) | `hubCreateTaskUi` reconciles legacy edits and owns Add, task menus, checkbox/Step actions and Oath partitioning. `renderTaskRows():2824` groups active/future/completed tasks; `:2874` binds existing raw source references. Preserve all those actions and their current presentation. |
| [`lib/ui/tasks.js`](../ui/tasks.js), [`task-card.js`](../ui/task-card.js), [`task-steps.js`](../ui/task-steps.js) | Render full indexed text, Markdown, descriptions, dates, importance, progress/Steps, disclosure and source labels; keep focus, pending edits, deferred rebuilds, completion sounds, group expansion and menu behavior. Rendering does not confer edit permission. |
| [`project-planning.js:20`](project-planning.js#L20) | `tasks(dv,id)` uses `taskData.readWorkspace` plus an explicit physical-owner Project ID check. Keep both restrictions when adapting it. This is not the broader Tasks panel policy. |
| [`planning-editor.js:35`](../ui/planning-editor.js#L35) | Calls `service.tasks()` synchronously, initializes existing Phase selection in a path/line keyed map and supplies the “Add tasks” picker. Its selected task objects later feed Phase assignment writes. Make async selection loading/disposal explicit; do not replace a selected reference with a same-title task. |
| [`project-roadmap.js:273`](../ui/project-roadmap.js#L273) | Main Roadmap renders planning records and subscribes to planning changes. Its task-read dependency is mainly the Phase editor/picker, not a separate general task list. Preserve planning-only rendering/subscriptions and geometry. |
| [`project-planning.js:51`](project-planning.js#L51) | `link()` reads a source snapshot, checks actual Project ownership, assigns an existing/new hidden ID only during the existing explicit write and updates metadata in the current transaction/rollback flow. Keep this writer and transaction semantics unchanged. |

Paths beginning `System/` are relative to the vault; plugin paths are relative
to `.obsidian/plugins/hub-project-menu/`. Main Home task reads, Oath enrollment,
Inbox/Quick Add and task writers are not implicitly included in either subdivision.

## Contract and identity gates

`queryStructured`, `TaskReadSession`, `legacyReadTask`, `legacyActionTask`,
`legacyActionRequest`, `resolveSavedTarget` and `resolveReveal` are available from
Phase 2B-2B. Their typed source/index distinction and per-row diagnostics must
remain honest. Search's `queryDisplay` is unchanged and should stay lightweight.
Existing strict queries retain their expensive per-task source validation and
are unsuitable as a replacement render loop.

The new structured query currently accepts **workspace** visibility only.
The Tasks panel's recursive `readPages(dv,root)` is broader: do not silently
apply Schedule's `validLocation` System/Templates/hidden exclusions to it.
Audit the actual Project and all four Resource panels first; add a typed
`panel` policy with exact captured parity if needed. Keep physical owner refs
independent of the viewing workspace. Preserve inactive Project eligibility
where the panel currently permits it. Resource views stay Resource-owned;
mounted Resource tasks must not become Project tasks or enter Project Oaths.
Roadmap remains Project-only and retains its additional owner check.

Structured views include canonical title, full compatibility text, start/due
endpoints with nullable time, importance, description, owning Phase, ordered
Step handles/ancestry and a primitive legacy source reference. They are not
editor snapshots or durable revisions. Audit task-card needs for capture-source
provenance, completion timestamps/history and other omitted evidence before
using this projection on every panel. Reuse the real Wizard/history services
where still authoritative; add only required read evidence and never infer
completion chronology from current checked state.

Use persistent task/Step IDs when present and guarded path/line/title locators
otherwise. Reads allocate no IDs. A copied ID, unresolved row or diagnostic-only
record must not acquire unsafe actions. Preserve safe display and matching
evidence: Phase 2B-2B demonstrated that dropping an unresolved task can silently
turn task-specific historical focus into a general workspace recommendation.
Analogously, missing Phase-picker data must never be treated as the user's
decision to unassign a previously selected task.

## Legacy action and async gates

The Schedule bridge now resolves fresh legacy source/Step references before
calling its unchanged writers, and handles immediate legacy reconciliation
before Dataview imports. Reuse the explicit pattern where appropriate, without
passing a normalized DTO directly to `mutateTask`, Add/Edit or Phase writers.
Keep native reveal targets separate; do not construct a synthetic Markdown
note for a native handle.

For panels, protect Project/Resource changes, query generations, component
unload, note-rail transitions, pending inline edits and the asynchronous
Markdown lifecycle. For Phase pickers, protect modal close, Project/Phase
revision changes, selection while loading, rename/delete and save while a
refresh is pending. Preserve typed input, selection, focus and menu anchoring.
Use facade invalidation after the established Dataview import; keep non-task
planning, label and layout subscriptions. One shared backend watcher serves
many consumer subscriptions; consumers close only their own sessions.

## Verification gates

Capture actual old/new task and Step identities, inclusion, text, dates,
importance, Phase labels, grouping/order, counts and DOM for Project plus all
four Resource panels, inactive/shared Projects and excluded/mounted locations.
Test duplicate/missing IDs, stale locators, nested Steps through prose lists,
continuations and descriptions, midnight/date-only/DST boundaries, mutations
while reads are pending, Oath partitioning, keyboard/pointer focus, menus,
disclosure and repeated mount/unmount. Verify existing Phase assignment and
rollback effects against direct legacy operations, including unresolved
selection retention. Add deterministic out-of-order/read-close races and
read-only Markdown/metadata/history snapshots.

Run current facade, Search, Daily Brief, Schedule, task-workspace, task-card,
task-form, planning, mutation/history, shared Project and Oath suites, both
declaration checks and the 66 core tests. Use supported browser harnesses for
actual dashboard and picker rendering. The broad task-workspace browser fixture
has an inherited divider-alignment failure, reproduced with the captured
original renderer in `task-workspace-before.html`; do not count its later
assertions as executed or remove the assertion. The focused
`schedule-read.html` covers the approved Schedule flows independently.

Benchmark 100/1,000/5,000 tasks, cold/cached/invalidation, source reads/index scans
and date/view or query navigation. Source-checking all Daily Brief candidates
adds a measured cold cost; do not introduce that cost into every panel render.
Do not optimize by skipping unsafe rows or weakening final validation. Back up
source/bundles, stage/compare before an authorized installation and never
reload Obsidian implicitly.

**STOP — Phase 2B-2C is not implemented or started.**
