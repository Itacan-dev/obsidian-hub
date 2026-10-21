# Phase 2B-2E-2 — completed Statistics input integration

Completed in Phase 2B-2E-2. See the [implementation and verification report](../tests/statistics-read-verification.md).
Statistics now awaits the shared recorded projection; optional legacy project
names and safe partial event evidence are preserved. Aggregations and all other
providers remain unchanged. The user explicitly changed the opening range to
All time. Recorded History, Markdown, metadata, reports, activity and Oath
persistence remain authoritative; native storage remains inactive.

The original pre-implementation audit below is retained as historical context;
its synchronous interface and deferred field descriptions describe the baseline.

## Actual snapshot and consumer boundary

Paths below are relative to `.obsidian/plugins/hub-project-menu/`.

| Source | Actual responsibility / next change boundary |
| --- | --- |
| `lib/services/statistics.js:8 readStatistics(plugin,now)` | Synchronous snapshot of current Projects/Resources, note metadata, Wizard activity, `wizard.completedTaskHistory`, reports and all device Oath histories. Replace **only** the authorized completion input. |
| `lib/ui/statistics.js:17 constructor / :25 onOpen` | Optional supplied source; `source ??= readStatistics(plugin)` once per modal. Async conversion needs initial loading/disposal guards while retaining supplied-snapshot behavior. |
| `lib/ui/statistics.js:19 cache` and range/workspace controls | Existing aggregates cache by range/workspace; controls do not reread task data or persist settings/events. Preserve that separation. |
| `lib/domain/statistics.js:63 prepareStatistics` | Builds workspace registry/cohorts and source families from recorded inputs. Keep this calculation unchanged unless separately authorized. |
| `lib/domain/statistics.js:114 aggregateStatistics` | Range/calendar binning, per-workspace task and Step series, notes, activity, Oath duration and report points. Do not substitute new calculations. |
| `task-service-legacy.js queryHistory({projection:"recorded"})` | New source-independent recorded projection delegated to the unchanged Wizard getter/domain query. No task-index or Markdown scan. |

## Correct completion input

Use recorded fields, not current task ownership, current checkbox state, Home
presentation or a generic HistoryFact's nullable canonical fields. The new
`RecordedHistoryQuery.rows[].fact.recorded` preserves optional primitive IDs,
kind, timestamps, historical attribution, source evidence and null/absence.
Do not pass `historyReadKey` into any persistence/aggregate identity: that is a
dashboard-only ephemeral DOM focus key. Do not silently drop partial/missing-source
records before applying the existing Statistics rules.

The new projection's field whitelist covers Home/workspace History. One concrete
Statistics-specific gap to audit **in the next phase** is legacy `record.project`
(display-name fallback), used by `identify(record)` after `projectName`.
It is not required by the current History displays and is not exposed yet. Add
only required portable evidence before migrating Statistics. Check any other
Statistics-specific legacy fields against actual saved data without rewriting it.

Current exact semantics in `domain/statistics.js`:

- `uniqueRecords()` deduplicates **truthy event `id`** values, retains ID-less
  entries, and keeps the first occurrence. This differs intentionally from
  History displays, which preserve all returned rows. Do not apply dashboard
  deduplication or equate task ID with completion event ID.
- Completion timestamps must be finite numbers, greater than zero, within the
  Date range and not in the future. Numeric strings/null/missing values are
  excluded by existing rules; do not coerce them or infer times from current tasks.
- Task and Step counts use exact recorded `kind === "step"`. Parent completion
  does not synthesize Step events. Reopen/clear/deletion semantics stay in writers.
- Historical workspace kind comes from `historyKind`: target/context kind,
  Resource evidence/prefix, then recorded path fallback. Stable recorded IDs
  define cohorts, never display names or current physical source.
- Current registry names/status remain where currently used. Missing IDs become
  Unassigned; unknown historical IDs create deleted-workspace cohorts with
  recorded `projectName` / legacy `project` fallback. Shelved/Future/renamed owners
  remain distinct from deleted or unassigned cohorts.
- Completion events also enter recorded work/activity evidence and last-active
  cohort selection. Preserve the `activityKeys` boundary before report-only cohorts.

## Independent source families — do not migrate them implicitly

- **Progress reports:** existing Wizard `getProgressReports()` and Resource
  variant; integer 0–4 scores, original report work date, range filtering, points
  and work-distribution percentages. Report edits do not move work to edit time.
- **Notes:** surviving Markdown notes from current vault/metadata, exclusions for
  dashboards/Meta/hidden/implementation files, creation metrics, distinct surviving
  edited-note counts. Do not infer deleted-note history from completion events.
- **Activity:** authoritative Wizard log; only current accepted creation/edit
  events and note eligibility rules contribute. Keep its source and reduction.
- **Oath:** all `oathsByDevice` histories, existing truthy-ID dedup, fulfilled/broken
  accepted states, recorded workspace snapshot, valid start/end times, clipping
  and cross-day duration. This is not the Oath task-resolution phase.
- **Calendar boundaries:** `statisticsRange()` clamps month subtraction and builds
  local-calendar bins; DST days need not be 24 hours. End is exclusive, current
  `now` is respected, and all-time earliest evidence spans independent families.

## Refresh and verification plan

Capture a fresh original Statistics snapshot/aggregate/DOM baseline before edits.
Decide explicitly whether a modal remains a snapshot (current behavior) or has a
separately authorized refresh; do not subscribe every range change to task imports.
The History dashboard consumers currently invalidate only on existing
`hub-completed-tasks-changed` events and own their caches. They do not introduce
a shared historical store or a task-data watcher to reuse as Statistics authority.

Compare identical original/current source facts and every aggregate/range/cohort,
including duplicate/ID-less/noncanonical events, Step/task overlap, reopen/clear,
missing/moved sources, presentation-owner conflicts, both shared Projects, all
Resources, deleted/inactive owners, old names, invalid/string timestamps,
midnight/DST/month/year boundaries, cross-device Oath duplicates and report-only
owners. Test supplied snapshots, modal close while pending, range changes while
loading, failure/recovery, source immutability and zero writes/index scans.

Reuse `statistics.test.js`, actual Statistics browser checks, History's 47 focused
tests and 79 browser checks, previous 205 facade-consumer checks, both declarations
and inactive core suites. Re-establish backups, exact factory allowlist and safety
hash gates for the separately authorized phase. Preserve the known inherited
workspace divider and standalone History heading assertions/tolerances.

**STOP FOR REVIEW — Phase 2B-2E-2 is implemented. Oath migration remains separate.**
