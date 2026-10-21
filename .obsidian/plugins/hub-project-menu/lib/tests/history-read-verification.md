# Phase 2B-2E-1 — recorded Task and Step History integration

Home and Project/Resource recorded task/Step History now read through the one
existing legacy-backed Task Service Facade. Recorded Wizard events remain
authoritative. No completion/history writer, Statistics source, Progress report,
Oath resolver or native authority is migrated.

## Original model and field coverage

The [field-by-field audit](history-read-field-audit.md) was written before consumer
changes. It identifies stored fields, original UI use, facade gaps, historical
ownership precedence, default/absent/null evidence and existing lifecycle rules.
Original dashboard sources were frozen before edits as
`history-read-home-original.cjs` and `history-read-project-original.cjs` and compare
against verified original backups. `history-read-baseline.json` captures actual
Wizard-query output and original Home/workspace selections for **146 events**.

Wizard startup accepts records with string title/path. Its unchanged domain
query returns shallow copies in stored order and does not read current tasks,
reattribute or deduplicate events. Existing writers maintain active check/event
bindings: reopen removes the bound completion, recompletion gets a new event,
edit/delete/move preserves historical display snapshots, and clear retains
existing History or creates the existing archive record when no bound event
exists. Task and Step transitions remain distinct. Parent completion does not
invent Step events. These behaviors are exercised with actual writers.

## Implementation and exact boundaries

Paths beginning `lib/` or `plugin.js` are relative to
`.obsidian/plugins/hub-project-menu/`; `System/` paths are vault-relative.

| Source / line | Responsibility |
| --- | --- |
| `lib/services/task-service-contract.d.ts:89,99,104,135` | Portable optional recorded primitives, explicit recorded-note evidence, diagnostics and an overloaded `queryHistory({projection:"recorded"})` response. Default HistoryFact array API remains unchanged. |
| `lib/services/task-service-legacy.js:243` | Existing authoritative Wizard getter and exact recorded owner/handle filtering; only explicit projection validation/dispatch added. |
| `lib/services/task-history-legacy-read.js:10` | Detached historical field projection, task versus Step identity, event order, timestamp evidence, recorded owners, row-level recovery and source-independent facts. |
| `lib/services/task-history-read.js:5` | Narrow recorded-to-render conversion with private ephemeral DOM/focus keys; no persistent identity or read deduplication. |
| `lib/services/task-history-read.js:16` | Preserve expanded existing pager batches, scroll and focused event/control through a real refresh. Existing shared pager stays authoritative for pagination. |
| `lib/services/task-history-read.js:36,43,48` | Consumer-owned promise cache, explicit History invalidation, stale-result cancellation and retryable failures. No task-data subscription or independent History store. |
| `lib/services/task-history-read.js:41,44` | One plugin cleanup registry, idempotent component cleanup; closing a view does not close the shared facade or other readers. |
| `lib/services/task-history-read.js:63` | Validate the exact recorded current note path/file at activation, without task-title search, source scan or fabricated target. |
| `plugin.js:12757,12971` | History reader factory and global cleanup only. Wizard getters, event notifications, normalization, all History/task writers and previous host bridges are identical. |
| `System/Dashboards/Home/view.js:4103,4730` | Owned History read state, async refresh and latest-generation publication into the original cached History array. |
| Home `:4753,4799,4932` | Original History renderer/filter/sort/labels, row focus key and exact recorded-note opening. |
| Home `:5490,5535` | Existing History event invalidates only this reader; initial secondary loader awaits its History input. Clear deltas still reconcile Tasks once. History-only notifications do not rebuild Tasks/Progress. |
| `System/Dashboards/Project/view.js:3888,4538` | Owned workspace History session and async read wrapper, retained context/DOM on unchanged results and mode/disposal guards. |
| Project `:4565,4618,4728` | Original historical filtering/rendering with detached recorded input and safe note activation. Resource and Project filtering remain different. |
| Project `:4808,5058` | Task-History tab refresh and existing completed-History event; only real clear deltas call the unchanged task-row reconciliation. |

The recorded projection preserves event `id`, raw task/Step `kind`, target and
parent IDs/titles, exact text/continuation, source path/line, timestamp,
`archivedAt`, recorded Project ID/name/status/path/root, context/target kind and
Resource type. Optional fields remain absent; explicit null remains null.
Legacy identifiers are preserved verbatim in recorded evidence. Canonical
nullable fields do not claim evidence absent from the source. No durable IDs or
native revisions are manufactured. All values supplied to the renderer are
detached primitives, not mutable persistence objects.

Historical owner and presentation fields are not replaced by physical ownership
today. Home retains its original `historyKind` categorization, current matching
Resource label/Project name lookup and recorded-name fallback. Workspace History
retains exact-ID matching with original root/path fallbacks; Resource History
uses recorded Resource type **or** recorded root. It does not use current task
workspace discovery policies. All predicates and timestamp sorting compare
identically with the original source.

Source evidence and activation are separate. Existing History opens an existing
recorded **note**, without promising an exact current-task jump. That behavior
is retained even when the recorded task is gone or the note's title/task content
changes. Missing/moved-away sources leave the event visible. Activation rechecks
the recorded path and refuses invalid paths or folders; it never searches for a
same-title substitute or silently follows a task into another owner.

Home's existing completed-History event previously invoked the full active
context, including unnecessary task/progress work. It now refreshes only recorded
History. Clear notifications still perform the existing immediate task-cache
cleanup and one task render before refreshing History. Workspace handling follows
the same separation. Reports, Activity, heatmap, Calendar, Focus and Resource
panels retain independent sources/events. History refresh does not call their
loaders or regenerate reports. The prior Home Tasks enumeration/actions and
Project/Resource Tasks section compare byte-identically with baseline.

Query failures retain the last valid History and show one restrained status.
An initial failed query is distinct from a legitimate empty list. Errors stay
out of ordinary rows; diagnostics are available on the query. Home hides History
error status outside the Tasks tab and retries when reentering after a failure.
Generation/component/root guards prevent old queries from publishing into a new
view or Reports/Activity. Unchanged projections retain nodes and expanded pages;
changed projections preserve expanded batches, scroll and event/control focus.

## Behavioral comparison

| Area | Previous behavior | New behavior | Verification |
| --- | --- | --- | --- |
| Recorded event inclusion | Authoritative Wizard/domain records | Same source, no current-task prerequisite | 146-event original baseline; 12 Home/workspace selections |
| Event identity/deduplication | Preserve recorded event IDs/order; writer-managed dedup | No new IDs, no read dedup; duplicated evidence/distinct completions retained | Query tests and actual lifecycle writers |
| Task versus Step events | Exact recorded Step kind and parent context | Same icons, labels, identities and counts | Focused tests, actual nested Step workflows, browser |
| Event timestamps | Recorded values; legacy optional/string/null | Exact recorded primitives plus nullable canonical evidence | Field-presence tests, DST/midnight fixtures, original/current DOM |
| Historical ownership | Recorded context/Resource conventions | Preserved independently of today's source owner/status | Cross-owner move/delete/rename fixtures; both shared Projects and all Resources |
| Historical presentation owner | Clear can record Home presentation attribution | Same recorded fields, including Resource source with Project presentation | Actual legacy clear-archive writer tests |
| Reopen/clear semantics | Bound event removal/recompletion; clear retains/archives | Identical writers and resulting event records | 23 writer/read/Statistics checks and existing regressions |
| Deleted/moved source events | Display retained; existing recorded note opens when available | Same display and exact-note navigation | Query/browser deletion and missing-source cases |
| Home History UI | Original categories, names, dates and 50-row pager | Same renderer/data semantics | Exact original/current DOM/rectangles, both scopes |
| Project/Resource History UI | Original recorded owner filtering/source labels/pager | Same Project versus Resource conventions | Ten workspace original/current comparisons |
| Source navigation | Open recorded note; no exact task search | Recheck exact valid recorded note at activation | Keyboard navigation and delete-before-click browser checks |
| History writers | Existing completion/Step/edit/delete/clear/recurrence paths | Byte-identical | Whole plugin/adapter factory comparison and actual workflows |
| Statistics/Progress | Independent existing snapshots and reports | Unchanged inputs, aggregates and services | Read-before/after Statistics snapshots, regression/browser suites |
| Previous facade consumers | 205 completed checks | Unchanged factories/integrations | All 205 checks plus targeted browsers |

Intentional read-safety improvements are limited to invalid-record diagnostics,
query failure retention, stale-result protection, stable interaction state and
rejecting malformed navigation paths/folders. No historical policy is redesigned.

## Executed verification

- **47 new focused tests pass:** 24 recorded query/field/attribution/session tests
  and 23 actual completion/Step/reopen/edit/delete/clear/recurrence/writer-failure/
  partition/read-only Statistics cases. Clear includes previously unrecorded
  externally checked parents with Steps and no task IDs, including presentation
  attribution differing from the physical Resource owner.
- **205 prior facade-consumer checks pass** with the new History tests in the
  combined run: **252/252**. The default facade History API remains compatible.
- **34 existing regression files pass:** the previous 30 task/data/creation/
  planning/history/sharing/Inbox/Oath/Statistics/Search/Brief/workspace/form suites,
  plus History status retention, navigation history, heatmap and Progress colors.
  Expected simulated conflict/store-failure logs are retained as test evidence.
- Both TypeScript 6.0.3 declaration checks report **zero diagnostics**; all **66
  native-core tests pass**. The native package remains unreachable in production.
- **79 actual History browser checks pass:** nonempty original/current Home
  scopes and ten workspaces, first-page/expanded-pager DOM, labels/dates/rectangles,
  empty-versus-initial-failure behavior, failures/recovery, A/B completion races,
  clear notifications, paging/focus during loading, exact-note keyboard opening,
  source deletion, mode switching, remount/Project-to-Resource isolation, multiple
  consumers and plugin cleanup. History events retain a simultaneous production
  task-card node and do not call task rendering without real clear deltas.
- Original-only baseline browser passed **37 checks before production edits**.
  Current parity uses the same frozen original source and fixture data.
- Existing History browser checks pass: 50/100/123 progressive paging, Markdown/
  LaTeX and keyboard/control/source behavior, and metadata colors/date/time
  presentation. The Markdown renderer fixture only gained its new detached
  History input/status/reveal host fields; no assertion was weakened.
- Previous browsers pass: Home **27**, workspace Tasks **8 contexts** plus its
  interactions, Phase editor **38**, Search **21**, Schedule **22**, task forms/
  Quick Add/Inbox **64**, Daily Brief footer/navigation/Oath, native Home actions
  **48 Home / 36 workspace-note layouts**, Statistics UI, Progress navigation and
  actual Step progress/first-ID/pending/save-failure behavior.
- Stage comparison passes: **162 → 164 modules**, exactly two modified existing
  factories (`plugin.js`, `task-service-legacy.js`), two new History helpers and
  **160 identical existing factories**. Wizard/domain history, all writers,
  Statistics/Progress/Oath, prior task policies/readers and auxiliary assets are
  identical. Actual Home/workspace task code and History predicates/sort are
  separately source-compared.

Inherited failures remain unchanged and uncounted beyond their failure points:

1. Both `task-workspace-before` and `task-workspace` fail **“Mode separator aligns
   with Files divider”** at 1280x1000, as previously documented. Later checks did
   not execute; assertion/tolerance is unchanged.
2. Standalone `history-heading` fails **“Icon visible at existing size”**. Every
   imported fixture/source/style input matches the pre-phase baseline exactly
   (`inherited-heading.json`). It does not load either changed dashboard JS.
   This failure is inherited; later heading assertions did not execute. Its
   exact-size assertion and all styles remain untouched.

Critical event identity, historical attribution and actual History renderer
parity checks pass. The inherited standalone heading/divider issues are not
expanded into unrelated layout repairs.

Browser host APIs and Moment host behavior are mocked; production History row
renderers, pager, date helpers, row activation, facade and read session execute.
The independent Markdown fixture verifies the production Markdown delegation
contract. Full live Obsidian runtime, a whole-dashboard screenshot and manual
user acceptance are not claimed; Obsidian is not reloaded for tests.

Compatibility limitations are explicit: legacy records may lack IDs, dates or
full Step ancestry; no new evidence is inferred. Existing renderer behavior for
absent/null/string timestamps remains unchanged (including legacy Moment's
missing-date fallback), while canonical historical timestamp stays nullable.
Ephemeral focus keys do not establish durable identity for ID-less records.
Unknown/private persistence fields are not exported; unsupported known scalar
evidence yields row diagnostics. Statistics-specific legacy `project` name
fallback is deferred to the separately authorized Statistics input phase.

## Performance

Synthetic Node 24.21.0, Europe/Stockholm, median of seven runs on identical
100/1,000/5,000-event task/Step/legacy/multi-workspace datasets. These are in-memory
costs, not live Obsidian latency. Original queries use the actual Wizard/domain
getter; filtering uses actual original workspace predicates/sort; pagination uses
the unchanged real pager. Cached Home originally reused an array reference;
Project originally called its direct getter at each render.

| Events | Initial query original / current ms | Refresh original / current ms | Workspace filter original / current ms | Pager preparation original / current ms | Normalization original / current ms |
| --- | --- | --- | --- | --- | --- |
| 100 | 0.024 / 0.408 | 0.017 / 0.242 | 0.010 / 0.010 | 0.008 / 0.012 | 0.020 / 0.120 |
| 1,000 | 0.168 / 2.831 | 0.168 / 2.468 | 0.024 / 0.014 | 0.015 / 0.016 | 0.166 / 0.960 |
| 5,000 | 0.849 / 15.705 | 0.933 / 13.630 | 0.113 / 0.317 | 0.113 / 0.190 | 0.866 / 6.063 |

Cached Home references and current consumer reads round below 0.001 ms in these
runs. Original workspace rereads cost 0.020 / 0.191 / 0.931 ms respectively.
Seven cached reads issue **zero** additional History queries; seven explicit
History invalidations issue **seven**. Ten unrelated task invalidations issue
**zero** History queries. All datasets use **zero task-index scans, zero Markdown
source reads and zero writes**. The larger cold/refresh cost pays for detached
field evidence, diagnostics, conversion and change detection once per invalidation;
no event-per-task scan or live-source resolution loop exists. No serious
unresolved performance blocker was found in these measured workloads.

## Safety and installation

Verified original backups/evidence:
`System/Backups/itacan-phase2b2e1-20261016-e2d9b287/`.
Working audit:
`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-phase2b2e1-e2d9b287eba1420fb671b0ee5bf0cdbb`.

The fresh baseline records **1,029 unique files**, including ignored private task
Markdown, real history/metadata, shared data, settings, Brief/Oath/report records
and inactive core, plus **248 initial Git-status entries**. Twelve source/bundle
backups are protected, including both separately loaded dashboards and two
preemptively protected but unchanged previous browser hosts. Frozen originals
are verified against these backups.

The final phase safety gate verifies all baseline files, original backup hashes, every
initial status entry, an exact changed/new-file allowlist, introduced whitespace
and absence of live native manifests/locks/generations. It finds exactly **ten
approved changed existing files and twenty new phase files**, verifies all twelve
original backups and preserves all 248 initial status entries. Task Markdown,
recorded task/Step History, local/shared metadata, shared Project data, Progress
reports, Statistics source data, Oath/Brief saved records, settings, workspace
definitions and mounts are unchanged. Native storage remains inactive.
No reset/clean/rebase/
commit/shared synchronization is performed. Application-managed workspace changes
are recorded separately and never restored over current data. Obsidian changed
`.obsidian/workspace.json`; this file was observed only, never written or restored.

```text
Original main.js  002EE9EB84826EDCA45EE43EEBD1CFC9CACEBF02472905F60D6126A6AC903CDC
Candidate main.js 8B20B6877F2D42CE1283B7E2B546950AEBD89E1D55A9B150160537A10ECC4F08
```

The reviewed `main.js` is installed and matches the candidate SHA256 above.
Installed safe parse/require and existing plugin-load checks pass without onload.
Only `main.js` was copied from disposable staging; `atlas-native.cjs` and strict
Oath assets are unchanged and were not overwritten. Both dashboard sources are
separately backed up and match the tested production input hashes. The installation
and final safety manifests, original/candidate builds, test logs, screenshots,
DOM/rectangle evidence, report and handoffs are retained with the verified backups.
No automatic Obsidian reload/restart or plugin disable/enable occurred.
**Manual reload is required when the user is ready.**

## Handoffs and stop

[Statistics task-history input handoff](../services/TASK-SERVICE-PHASE-2B-2E-2.md)
documents the actual snapshot/cache, recorded event input, truthy-ID deduplication,
task/Step counts, historical/deleted/inactive cohorts, legacy name gap, DST/range
semantics, Oath history, note metrics, Progress points and work distribution.
Only the separately authorized completion input may change next; other source
families/calculations remain authoritative.

[Separate Oath task-resolution handoff](../services/TASK-SERVICE-PHASE-2B-2F.md)
retains enrollment/hydration/Standard/Strict/Resource-permission/lifecycle audit
requirements. Neither future phase is implemented.

**STOP AFTER PHASE 2B-2E-1.** No Statistics migration, Oath resolution migration,
writer migration, native activation, Git synchronization or task-location work.
