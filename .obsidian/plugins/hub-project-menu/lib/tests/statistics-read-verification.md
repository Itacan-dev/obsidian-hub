# Phase 2B-2E-2 — Statistics completion-history input

Statistics now acquires recorded task/Step completion events through the existing
single legacy-backed Task Service. Markdown and Wizard History remain authoritative.
All aggregation code, independent providers, writers and previous consumers remain
unchanged. The opening range changes from 3 months to All time by the user's
explicit reply on 2026-10-16. No Oath task-resolution migration is included.

## Implementation and original boundary

Paths below are relative to `.obsidian/plugins/hub-project-menu/`.

| File / line | Responsibility |
| --- | --- |
| lib/services/statistics.js:11 | Explicit recorded-evidence compatibility adapter; no sorting, deduplication, canonical-ID substitution or current-task reconstruction |
| lib/services/statistics.js:26,43 | Async readStatistics, using plugin.taskService.queryHistory({projection:"recorded"}) exactly once per opening |
| lib/services/statistics.js:28–42 | Same workspace/note/activity/report/all-device Oath provider calls; record copies bind those inputs before awaiting History |
| lib/services/task-history-legacy-read.js:5,20 | Optional legacy project evidence, exact primitive/null/absence handling and existing event order |
| lib/services/task-history-legacy-read.js:45,51 | Safe partial evidence plus unavailable-field diagnostics; invalid display rows retain fact:null and remain excluded by previous History consumers |
| lib/services/task-service-contract.d.ts:95,104,111 | Optional project, partial scalar evidence and unavailableFields declarations; default History API unchanged |
| lib/ui/statistics.js:16,29,34 | One plugin cleanup registry, per-modal generation, supplied-source synchronous rendering and user-selected All time default |
| lib/ui/statistics.js:68,79,121,208 | Complete publication, loading/retry/failure, original aggregate cache/render guard and close/disposal |
| lib/domain/statistics.js:54,63,114 | Unchanged truthy event-ID deduplication, snapshot calculations and aggregation algorithms |
| lib/domain/history.js:4 | Unchanged recorded kind/identity precedence |
| plugin.js:12653,12904 | Unchanged Statistics entry gate and plugin-unload modal closure |

The [source/field matrix](statistics-read-field-audit.md) was written before
production edits. Fresh original service/UI/domain sources and numerical outputs
were frozen, and the existing original Statistics browser fixture ran before edits.
Exact DOM/geometry comparisons execute the immutable original UI beside current UI.
Frozen sources are hash-checked against the initial baseline, not reconstructed.

Progress providers remain the two existing getProgressReports calls; activity remains
wizard.activityLog; notes retain the exact Markdown/metadata/ctime/ownership rules;
Oaths retain every device bucket's existing history array. Only temporary record
copies prevent unrelated source mutations while the History promise is pending.
One unchanged prepareStatistics call constructs the complete snapshot after loading.
There is no second snapshot, task subscription, raw-Wizard fallback or persistent cache.

## Numerical and behavior comparison

| Area | Original behavior | New behavior | Verification |
| --- | --- | --- | --- |
| Recorded event inclusion | Wizard completion array | Same Wizard/domain source through recorded projection | Frozen full snapshot, actual writers, persisted-field audit |
| Event deduplication | First truthy event id wins before timestamp filtering | Unchanged domain code | Repeated IDs, invalid first event, no/empty/null/zero IDs, numeric versus string IDs |
| Task/Step counts | Exact kind === step, otherwise task | Unchanged | Related IDs, distinct completions, reopen/recomplete, nested Steps, parent/clear/delete workflows |
| Project attribution | Stable recorded ID; current matching name/status | Preserved | Private/Itacan/Hub, renamed, Future/Shelved, collisions and conflicting evidence |
| Legacy project fallback | Unknown truthy ID label: projectName ?? project ?? Deleted workspace | Preserved optional primitive evidence | Null/empty/absent modern name, deleted IDs, matching/duplicate current names |
| Resource attribution | Recorded kind/type/ID prefix/path precedence | Preserved | All four Resources and Resource-source/Project-presentation conflict |
| Deleted/inactive cohorts | Historical IDs retained, ID-less events Unassigned | Preserved | Deleted/missing/moved sources, inactive registry and report-only cohorts |
| Time ranges | Local-calendar 7d/30d/3m/1y/all; exclusive end and now bound | Unchanged | Six controlled clocks, both DST transitions, midnight, month/year/leap boundaries, string/invalid/future times |
| Progress points | Integer 0–4 report score, recorded work date | Unchanged | Full original/current snapshot and every aggregate |
| Work distribution | Raw report points and existing percentages | Unchanged | Exact workspace rows, comparison, chart models |
| Notes | Surviving-note creation/edit semantics | Unchanged | Original regression, provider counts and full-snapshot comparison |
| Oath history | All device histories, truthy IDs, clipping and states | Unchanged | Standard/Strict, duplicate devices, broken/fulfilled, exact duration models |
| Modal loaded UI | Seven sections, same controls/charts/tooltips/scroll | Same for identical range/workspace | Exact DOM, text, attributes and rectangles for 15 selections; existing responsive UI fixture |
| Opening range | 3 months in actual original source | All time, explicitly requested by user | Updated default assertion and actual async modal test |
| Snapshot/cache | Once per opening; bounded range/workspace cache | Preserved across await, failures/retries and disposal | Deferred source edits, generations, no query on ranges or History notifications |
| History writers | Existing plugin/editor/domain writers | Identical factories | Actual completion/reopen/Step/clear workflows and bundle comparison |

Legacy project names never resolve a new ID by current name. A name-only event
remains Unassigned, even when its spelling matches one or two current Projects.
Unknown IDs retain their deleted-cohort label from the first accepted event.
Current source ownership, checkbox state, title, location or source existence is
irrelevant to completion inclusion. archivedAt never replaces a missing timestamp.

No numerical discrepancy was found. Original snapshot: 128 accepted completions,
16 cohorts and 85 exact range/workspace models. All source families participate.
Additional controlled-clock comparisons cover every cohort/range, not only totals.
A read-only census of actual persisted History found 174 accepted records, zero
projection diagnostics and exact completion-only range/cohort parity. It emitted
only field-type counts and hashes, no personal record contents, and performed no writes.

Compatibility limits are explicit: unsupported nonportable statistically relevant
evidence (for example object-valued event IDs) causes a retryable snapshot failure,
not misleading zeroes or silent data loss. Invalid/nonfinite timestamps retain the
original exclusion semantics. Missing title/path can retain trustworthy statistical
fields without becoming a valid History display row. Unsupported unused fields have
diagnostics; unknown private fields are not exported. No IDs are inferred/allocated.

## Executed checks

- 30 new focused tests plus the previous 252: **282/282 pass**. Actual writer tests
  now compare facade-backed Statistics directly with the frozen original after each
  completion/reopen/Step/edit/delete/clear/move/recurrence/failure operation.
- **34 existing regression files pass**, including Statistics' original ranges,
  DST, reports, real mutation semantics, notes, empty and 100k-event tests. Existing
  expected conflict/store-error logs remain visible in saved output.
- Both TypeScript 6.0.3 declaration checks: **zero diagnostics**. All **66 inactive
  native-core tests pass**.
- **99 actual Statistics browser checks pass**: 45 exact model/DOM/rectangle checks
  across five ranges and three scopes, lifecycle/error/cache/keyboard/tooltip/read
  isolation checks, and 24 real modal-open benchmark checks. Deferred tests cover
  close/reopen, multiple instances, older request completion, plugin unload, retry,
  range selection during loading and concurrent History notifications. Supplied
  snapshots render synchronously. Failed queries show no partial metric cards.
- Existing Statistics fixture passes its seven sections, five ranges, filters,
  stacked bars, chart keyboard/data tables, historical/empty states and
  1000/680/420/310px responsive checks.
- Previous browsers pass: History **79**, Home **27**, workspace Tasks **8 contexts**,
  Phase editor **38**, Search **21**, Schedule **22**, Quick Add/Inbox/task forms **64**,
  native Home actions **48 Home / 36 workspace layouts**, History progressive paging,
  Markdown/LaTeX/keyboard/source behavior, History metadata, Daily Brief, Progress
  navigation and Step progress.
- Additional supplied-modal/tooltip checks pass: Phase 2C interactions **93** and
  native-CSS configured feedback **591**. Three explicit browser module registries
  gained the Statistics error dependency. The Phase 2C keyboard fixture explicitly
  selects its original 3m multi-bin range: All time's one-day sample otherwise has
  no distinct ArrowRight/Home date. Its assertions were retained.
- Candidate safe parse/require smoke passes without onload, vault writes or reload.
  Stage comparison: **164 modules**, exactly three changed factories, **161 identical**;
  no new factories. Domain Statistics, plugin/Wizard, facade adapter/default History,
  all writers, prior consumers, Oath/Progress/note helpers and auxiliary build assets
  compare identically.

Inherited failures were rerun with unchanged assertions and inputs:
1. task-workspace-before and task-workspace fail “Mode separator aligns with Files divider”.
2. history-heading fails “Icon visible at existing size”.
Later assertions in those fixtures did not execute and are not counted as passes.
The initial-baseline hashes protect their production/fixture/style inputs.
An attempted history-status browser invocation had no corresponding HTML fixture
and is not counted; the existing history-status.test.js regression passed.

Live Obsidian execution, manual acceptance and the entire unrelated browser catalog
are not claimed. Host APIs are mocked; production service, facade/legacy adapter,
domain, actual modal and chart code execute in isolated temporary browser profiles.
No live plugin startup or Obsidian restart/reload is used for testing.

## Performance

Node 24.21.0, Europe/Stockholm, medians of seven identical synthetic workloads.
All datasets contain mixed tasks/Steps, duplicate IDs, legacy names and multiple
workspaces. Original input acquisition reads its array reference (rounds to 0 ms);
it is not incorrectly benchmarked as an uncached facade query.

| Events | Original / new full snapshot ms | Facade acquisition ms | Projection / input mapping ms | Five ranges ms | All workspace aggregates ms | Cached five ranges ms | Reopen snapshot ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | 0.103 / 0.244 | 0.201 | 0.137 / 0.014 | 0.579 | 1.947 | 0.001 | 0.215 |
| 1,000 | 0.422 / 1.894 | 1.304 | 1.126 / 0.143 | 1.019 | 6.420 | <0.001 | 1.588 |
| 5,000 | 1.551 / 8.375 | 5.577 | 4.110 / 0.746 | 3.321 | 27.114 | <0.001 | 8.018 |

Separate actual-browser median modal creation through two animation frames, three
opens per size, original/current ms: 100 **32.9/32.6**, 1,000 **32.9/32.5**,
5,000 **31.3/32.7**. These frame-paced samples are not claims of a speedup or live
Obsidian latency. Each opening reacquires one coherent snapshot; cached range changes
issue zero queries/scans. Seven measured reopen snapshots make seven History reads,
seven note scans and fourteen existing report-provider calls. All workloads have
zero task-index scans, Markdown source reads or writes. The bounded cold projection
cost is measured and does not constitute a serious unresolved regression here.

## Safety, backups and installation

Fresh audit:
`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-phase2b2e2-49e976b379e74faf81237c8afc6eb175`.
Durable backup/evidence:
`System/Backups/itacan-phase2b2e2-20261016-49e976b3/`.

The baseline protects **1,049 unique files and 268 initial Git-status entries**,
including ignored task Markdown, authoritative plugin data, local/shared metadata
and shared Project state. Fourteen original source/bundle/test-host backups are
hash-verified. The phase gate preserves every baseline file/status entry, checks an
exact existing/new-file allowlist, frozen originals, introduced whitespace and no
native manifests/writer locks/generations. Obsidian-managed workspace.json changes
are observed separately and never restored.

Real task Markdown, recorded History, local/shared metadata, shared Project state,
Progress reports, note metadata, Oath histories, Brief records, settings, workspace
definitions and Resource mounts remain unchanged. No reset/clean/rebase/commit,
Git synchronization, task location work or native initialization is performed.

```text
Before main.js    8B20B6877F2D42CE1283B7E2B546950AEBD89E1D55A9B150160537A10ECC4F08
Candidate main.js F3D2850C8A59BC61195E99429510B626A9E5EAD735507569EBE35D4AB04931E5
```

The reviewed main.js is installed and its SHA256 matches the tested candidate above.
Installed safe parse/require and plugin-load checks pass without onload. The final
safety gate reports exactly **14 changed existing files and 15 new phase files**,
all 14 verified original backups, all 268 preserved initial status entries and
zero native authority files. Only main.js was copied; atlas-native.cjs, strict
Oath assets and dashboard sources were not overwritten. Installation/final safety
manifests, original/candidate builds, full logs, numerical/DOM/rectangle evidence,
screenshots, this report, field audit and handoffs are retained with the backups.
No automatic Obsidian reload/restart or disable/enable is authorized or performed.
**Manual reload is required when the user is ready.**

## Handoff and stop

The [Phase 2B-2F handoff](../services/TASK-SERVICE-PHASE-2B-2F.md) recommends separately
reviewable candidate-discovery and committed-resolution phases, with actual source
entry points, shared eligibility/identity rules, enrollment writer boundaries,
awaitingIndex, Standard/Strict recovery, exactly-once outcomes and multi-device tests.
Separation is conditional on proving candidate-to-enrollment parity; otherwise the
handoff requires a revised combined read boundary before implementation.

**STOP AFTER PHASE 2B-2E-2 — FOR REVIEW.** No Oath task-resolution implementation,
writer migration, native activation, Git synchronization or task-location work.
