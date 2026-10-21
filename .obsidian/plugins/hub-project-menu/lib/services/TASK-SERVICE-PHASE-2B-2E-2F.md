# Remaining read consumers after Home — audit handoff

Phase 2B-2D implements Home Tasks only. This document authorizes no further
implementation. Keep the one explicitly legacy-backed facade, Markdown task
authority, all writers and inactive native core unchanged.

## Phase 2B-2E — recorded History and Statistics

Consider two reviewable subdivisions: **2E-1 recorded task/Step History**, then
**2E-2 Statistics snapshots and aggregates**. Capture current recorded data and
original rendering before either integration. Current task state cannot replace
recorded historical evidence.

| Actual source entry | Responsibility / next audit |
| --- | --- |
| `System/Dashboards/Home/view.js`, `loadSecondaryData()` around 5510 | Initial Home activity/progress/completed-history reads stay independent. Home completed-history event handler around 5459 still refreshes recorded History separately. |
| Home `renderCompletedTaskHistory():4727` | Preserve historical pagination, dates, labels, cleared and moved/deleted source behavior. Reinspect current lines before changes. |
| `System/Dashboards/Project/view.js:4534`, `renderProjectTaskHistory()` | Existing `hubGetCompletedTaskHistory()` and owner filtering serve both Project/Resource contexts. Audit deleted owners, Resource event conventions and retained source-opening behavior. |
| `plugin.js:5670`, `getCompletedTaskHistory()` and `lib/domain/history.js` | Recorded task versus Step events, identifiers, parent references, timestamp/owner-at-event, deduplication and reopen/clear compatibility remain authoritative. |
| `task-service-legacy.js`, `queryHistory()` | Existing facade projection is a starting point. Compare all recorded fields before adopting it; do not infer timestamps from checked tasks. |
| `lib/services/statistics.js:8`, `readStatistics()` | One snapshot combines current workspace definitions, note metadata, activity, recorded completions, reports and all device Oath histories. Preserve cohorts and historical attribution. |
| `lib/ui/statistics.js:25` | Modal snapshots once and caches aggregates by range/workspace. Range changes must remain free of task/index scans and writes. |

Home clear-completed requests still preserve their existing **recorded presentation
attribution** fields, while fresh source preflight and metadata removal use actual
source identities. Completion/Edit writers resolve physical ownership themselves.
Audit these historical conventions explicitly before changing archive ownership.
Never rewrite historical owners from Home presentation or today's physical roots.

Required fixtures: task/Step completion, reopen, repeated completion, clear with
nested Steps and continuation blocks, missing/deleted/moved sources, renamed or
deleted/private/shared Projects, all Resources, inactive statuses, duplicate
events, historical names, report scoring, cross-device Oath history, range/DST
boundaries and shared persistence failures. Compare snapshot facts, aggregate
totals, original DOM/geometry, pagination/navigation and zero-write behavior.
Leave Progress reports and other Statistics source families on existing services
unless the separate phase explicitly authorizes their migration.

## Phase 2B-2F — Oath task-resolution reads

First audit candidates and commitment identity/eligibility as one scope; migrate
hydration/lifecycle only after its coupled invariants are proven. Split into
2F-1 candidate/read evidence and 2F-2 committed-task hydration if review benefits,
without partially switching authority inside a live commitment.

| Actual source entry in `lib/services/oath.js` | Responsibility / next audit |
| --- | --- |
| `:74 tasks()` | Global legacy task enumeration. Home's new policy does **not** replace this reader. |
| `:92 workspaceTasks()` / `:100 setupRequirements()` | Physical workspace eligibility, task grouping and identity exclusions. Preserve Standard/Strict restrictions and Resource mount permissions. |
| `:178` startup subscription / timer | Completed-import refreshes and timestamp-only clock updates; no task scan on each display tick. |
| `:192 resolveWork()` | Persistent committed IDs, copied/missing tasks, source snapshot checks, `awaitingIndex` evidence for just-assigned IDs, current metadata and fulfillment. |
| Setup path around `:290` and strict review/navigation modules | Task enrollment, source identity allocation only during explicit setup, locks, duration, cancellation, interruption, persistence and session ownership. |
| `lib/ui/oath-tasks.js` | Home/Project partition and pinned/missing display remain unchanged. This renderer consumes service work; it does not define enrollment eligibility. |

Required fixtures: persistent commitments through rename/move/delete, copied
parent/Step IDs, source/title drift, ID-less enrollment and delayed import,
completed/reopened Steps, exactly-once fulfillment/history, Standard and Strict
locking, interruption/reload/wake, multiple windows/device state and Resource
mount restrictions. Test fresh source validation separately from indexed
candidate discovery. Do not make mounted Resources eligible for Project Oaths.

## Existing Home boundary to preserve

`home-task-read.js` owns one TaskReadSession of the shared facade; its global
`policy:"home"` preserves broad discovery. `row.home.physicalOwner` and primitive
`projectReference` are evidence, while Home's original registry resolves mutable
presentation objects with Resource precedence. Home Tasks and Oath candidates
have different policies. Do not compose one from the other.

Local writer reconciliation is temporary and note-scoped; current source changes
can supersede it, and canonical imports retire it. Closing the read session must
not cancel an existing inline cleanup commit. Reuse the 48 Home focused tests,
27 actual Home browser checks, previous 157 facade checks and safety tooling;
re-establish new baselines/backups for each future phase.

**STOP FOR REVIEW. No History/Statistics or Oath read migration is implemented.**
