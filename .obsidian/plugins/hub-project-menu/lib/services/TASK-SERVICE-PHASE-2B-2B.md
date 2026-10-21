# Phase 2B-2B handoff: Daily Brief task reads and read-only Schedule data

Historical pre-implementation handoff, retained for context. Phase 2B-2B is now
complete; see its [completion report](../tests/task-read-verification.md).
The next proposed scope is [Phase 2B-2C](TASK-SERVICE-PHASE-2B-2C.md), which has
not been implemented. Paths/line numbers below describe the original boundary.

This is a proposed next phase, not implemented work. Phase 2B-2A stops after
Search. Reuse the single `plugin.taskService`, explicitly backed by
`LegacyTaskAdapter`. Markdown, Dataview, the effective local/shared metadata and
Wizard history remain authoritative. Keep native storage inactive.

## Current paths and the precise read boundary

| Consumer | Current production path | Proposed next read boundary |
| --- | --- | --- |
| Daily Brief availability/context | [`daily-brief.js:38`](daily-brief.js#L38) calls synchronous `context()`; [`context():118`](daily-brief.js#L118) calls `taskData.readPages(oath.api())`, maps physical owners and passes raw tasks to `buildDailyBriefContext` | Await one tolerant facade read appropriate for recommendations, with sufficient metadata and Steps. Preserve active-Project/all-Resource eligibility; Search's inactive-Project eligibility is different. |
| Daily Brief live task target | [`validateTarget():180`](daily-brief.js#L180) enumerates `oath.tasks()`, matches hidden ID or path/text/line, then reads the source snapshot and effective metadata | Resolve a portable task/Step reference with fresh facade read/reveal validation. Preserve completion, future-start, Step availability, unique-match and Oath permission checks. Do not migrate Oath's own reads or writes. |
| Daily Brief history/navigation | [`domain/daily-brief.js:73`](../domain/daily-brief.js#L73) constructs persisted file targets; [`buildDailyBriefContext():80`](../domain/daily-brief.js#L80) combines report, completion, Oath and activity evidence. [`historicalPath():207`](daily-brief.js#L207) and configuration navigation retain historical layouts and rename evidence | Separate live task evidence from historical-only records. Preserve the existing snapshot version/old target compatibility, report inputs, 06:00 local-day/DST cutoff and continuation/fallback policy. Keep historical file/configuration/workspace navigation on its existing routes. |
| Schedule reads | [`mountTaskWorkspace():17`](../ui/task-workspace.js#L17) currently returns early for Resources; [`refresh():114`](../ui/task-workspace.js#L114) reads `taskData.readWorkspace(dv, workspace)`; [`subscribe:179`](../ui/task-workspace.js#L179) refreshes it | Replace only Project Schedule enumeration/subscription with facade-backed reads. Preserve existing physical workspace visibility, folder labels, filters, sorting, upcoming/calendar/timeline state and Resource early return. No mounted Resource expansion. |
| Schedule source navigation | [`task-workspace.js:148`](../ui/task-workspace.js#L148) supplies `openSource(currentPath(task.path))` to existing renderers | Use validated `legacy-source` reveal targets for source actions; explicitly reject unsupported native targets. Keep established note opening, workspace/Oath restrictions and focus restoration. |

Verify these locations against the working tree before editing: they are a
handoff map, not permission to replace the entire consumer.

## Facade and evidence gaps to resolve first

The current [`queryDisplay`](task-service-contract.d.ts#L78) intentionally serves
Search only: it has canonical title, full indexed compatibility text, completion,
owner, due endpoint, description, source evidence and row diagnostics. It does
**not** provide Steps, importance, start endpoint, Phase, completion evidence or
the full source structures expected by Schedule renderers. Do not repurpose its
compatibility text as canonical title or fill omitted fields with invented data.

Existing `getTask`, `readSteps`, `queryOwned` and `queryVisible` expose the richer
`TaskDTO`, but strict queries fail on one bad row and perform source validation
and a global index scan per task. The 1,000-task measurement was 1,432.581 ms,
1,000 source reads and 1,001 index scans. Do not put this strict loop in a render
or availability refresh. Add a narrowly typed tolerant read with query-scoped
identity accounting if needed, preserving the final source validation and the
current strict API. Design and test the DTO adaptation before redirecting reads.

[`queryHistory`](task-service-legacy.js#L173) already exposes best-effort
completion facts, but is not a substitute for the whole Wizard/report model.
Audit its owner-at-event, task/parent/Step identities, timestamp and source
mapping against `completedAtBoundary` and `captureReportContext`. Preserve raw
historical evidence for deleted tasks, report snapshots, activity/rename events,
workspace configurations and Oath summaries. Do not allocate IDs to reconcile
historical titles or treat historical-only evidence as a live task.

`TaskDTO.source.locator` and legacy handles can support an explicit legacy-only
bridge. Persisted Daily Brief v1 targets still contain task ID or temporary
path/text/line and optional Step ID/text; loading them requires compatibility
validation, not an assumed permanent identity. Preserve native reveal variants
as separate types without implementing a native handler.

## Async and lifecycle requirements

Daily Brief's `refreshAvailability`, `context` and `load` currently assume a
synchronous context. Audit all callers before changing that contract. Use a
generation for day, invalidation, availability and disposal; coalesce outstanding
reads; recheck readiness/Oath/foreground/day after awaits; prevent a stale read
from saving a snapshot or marking the brief shown. Preserve once-per-day
persistence and existing provider/trigger failure handling. Replace only its
task-data subscription (`daily-brief.js:97`) with the shared facade notification.

Schedule must discard results after a mode, workspace, note-rail or container
change, task invalidation or component disposal. Retain selection, expansions,
keyboard focus and existing deferred rendering. Use one service subscription
per owned consumer, not a facade or raw watcher per renderer. Keep metadata and
layout listeners required for non-task labels/layout. Test outstanding reads
during rename/delete and concurrent Search/Brief/Schedule activity.

## Writer bridges that remain unchanged

Schedule rows still share `createTaskUi`, `plugin.mutateTask`, `openTaskEditor`,
`openTaskCreator`, `applyTaskEdit`, planning labels and existing callbacks
(`task-workspace.js:106`). Those operations need legacy source/line/Step shapes.
Design an explicit, freshly validated adapter at that existing action boundary;
never pass an incomplete display DTO into a writer or reconstruct a fake task
from its title. Preserve the current Add/Edit, checkbox, Step, delete/clear,
Phase, Inbox, Quick Add, Roadmap and Oath implementations. Do not redirect their
reads as a side effect of changing Schedule data.

Keep Daily Brief's existing snapshot/shown-day/report persistence and navigation
history semantics. No new task/history writes may occur merely because a read
was redirected. Shared Project partitioning, conflict protection and private
Resource isolation stay unchanged.

## Verification gates for the next phase

Capture actual old/new fixtures before edits, including Daily Brief history at
06:00/DST, completion/reopen/Step chronology, historical-only/deleted records,
ID-less/copy-conflicted targets, active/inactive Projects, all Resources,
saved snapshots, configuration restoration, future starts, Oath restrictions
and fallback navigation. For Schedule cover physical workspace ownership,
current mounted-folder exclusions, dates/date-only/midnight, filters/order,
calendar/timeline/upcoming presentation, selection/focus and existing action
bridge parity. Add deterministic cancellation/invalidation/disposal races,
subscriber cleanup and read-only state snapshots. Measure 100/1,000/5,000 tasks.

Rerun `daily-brief.test.js`, `task-workspace.test.js`, `task-data.test.js`,
`task-date-presentation.test.js`, `task-progress.test.js`, `task-history.test.js`,
`task-form.test.js`, `oath*.test.js`, `shared-projects.integration.test.js`,
`workspace-state.integration.test.js`, Search parity/lifecycle/browser checks,
the 42 facade tests, 66 core tests and both declaration checks. Use the supported
Daily Brief and task-workspace browser fixtures; classify any existing unrelated
layout failures with a captured baseline. Back up source/bundles, stage and
verify before any authorized installation, and never reload Obsidian implicitly.

**Stop here. Phase 2B-2B requires further user instructions.**
