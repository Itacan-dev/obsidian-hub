# Phase 2B-2D — Home Tasks read integration

Home Tasks now reads the single existing legacy-backed Task Service Facade.
Markdown, effective task metadata and recorded Wizard History remain authoritative.
Native storage stays inactive. History/Statistics and Oath resolution are deferred.

## Implementation and boundaries

Paths beginning `lib/` or `plugin.js` are relative to
`.obsidian/plugins/hub-project-menu/`; `System/` paths are vault-relative.

| Source / line | Final responsibility |
| --- | --- |
| `task-service-contract.d.ts:70,105` | Explicit structured `home` policy; primitive page Project-reference evidence and separately named physical owner. No Dataview page/link or file object escapes. |
| `task-service-legacy.js:50` | Existing one global task-data read also captures portable page references for Home. Other consumers retain the previous read path. |
| `task-service-legacy.js:82` | Global indexed Home query, no workspace composition/exclusions, one shared identity context, tolerant row diagnostics and retained unsafe display. Strict `queryVisible(home)` remains unsupported. |
| `home-task-read.js:23` | Home-owned TaskReadSession on the one `plugin.taskService`; cached projection and current presentation mapping. |
| `home-task-read.js:33,58,110` | Fresh strict legacy task/Step/reveal preflight plus actual physical-owner comparison. No native-style facade mutations. |
| `home-task-read.js:44,68,102` | Temporary note-scoped immediate edits/clear reconciliation, stale-generation cancellation, canonical acknowledgment and external-source supersession. |
| `home-task-read.js:54` | Idempotent owned cleanup and one plugin cleanup registry; shared facade remains open for other consumers. Accepted inline cleanup commits retain their original writer path. |
| `plugin.js:12754` | Home factory and matching unload cleanup only; one existing facade construction. |
| `System/Dashboards/Home/view.js:840` | Home session, interaction-aware deferral, original shared task UI with guarded legacy actions. |
| Home `:866,1041,1193,5455` | Immediate edits, task completion, clear requests and completed-source reconciliation. |
| Home `:887` | Original task-card/group/Oath rendering with retained scroll and focused control identity on changed projection. |
| Home `:5477` | Async task-only loader, current owner paths, latest-result publication, last-valid-content retention and one restrained error status. No independent raw read fallback or task-data subscription. |
| Home `:5510,5529` | Initial independent secondary loading and unchanged task count/active filtering. Task invalidation never calls `loadSecondaryData()` or Progress rendering. |

Home still uses its original `projectFromReference`, `projectForPage`,
`resourceForPage` and `isActiveProject`. Primitive reference evidence feeds these
same functions; current mutable Project objects are retained. Resource registry
entries retain their original presentation conversion. Resource identification
wins before explicit Project attribution. Mounted Resource notes stay Resources.
All four registered Resources remain eligible without a new filter or setting.

Physical `row.home.physicalOwner` is distinct from the presentation object.
Completion/Edit/Step writers receive source-validated legacy references and
resolve their actual physical source context. Valid attributed tasks outside
Project roots remain actionable. Cross-owner stale actions are rejected.
The existing clear request's recorded presentation-attribution fields are
preserved for historical compatibility; they do not become metadata ownership.
No History attribution migration is included.

Canonical title, full indexed continuation/Markdown text, independent description,
importance, nullable start/due times, Phase evidence, ordered nested Steps, hidden
IDs, temporary ID-less locators and capture provenance cross the explicit legacy
read bridge. Reads do not allocate IDs or invent source paths. Invalid locators
can retain display without granting an action. Copied IDs and ambiguous locators
stay visible with guarded actions. A query-wide failure retains the last valid
projection rather than declaring an empty task set.

The read session cancels obsolete results; Home checks its own generation,
component disposal and connected root again at publication. Inline editors use
the original UI's render deferral. Native menus and task/Step modal drafts defer
Home task queries/publication; normal pointer/keyboard/focus events resume them
after dismissal. Unchanged projections keep existing DOM nodes, menus and focus.
Changed projections restore task/group focus and scroll; disclosures remain in
the unchanged task UI's local state. Temporary note overlays are never persisted.
Clear acknowledgment adopts canonical imported locators even when the original
clear event only supplied removed parent lines, not whole block lengths.

## Original versus current behavior

The frozen original is `home-read-original.cjs`, copied before production edits
and verified against the original Home backup. `home-read-baseline.json` records
28 eligible original tasks and their physical/presentation owners. Fixtures also
contain inactive/deleted owners and unowned tasks for eligibility comparisons.

| Area | Original behavior | New behavior | Evidence |
| --- | --- | --- | --- |
| Global task inclusion | Global indexed Markdown, including nested/System/Templates/hidden and attributed outside notes | Same Home-specific global policy | `home-read.test.js`, original baseline |
| Active Project filtering | Active and not deleted; Future/Shelved/deleted excluded | Same mutable-owner filter | Original/current task/group/owner facts; actual Home DOM |
| All Resource tasks | Knowledge, Research, Explorations, Inspiration | Same registered Resources | Four Resource fixtures; inclusion parity |
| Resource-first precedence | Physical Resource wins over page Project | Same original resolver | Dedicated Resource conflict and mounted-folder assertions |
| Explicit Project metadata | Reference/name/path attribution before physical Project inference | Primitive reference plus original Home registry | Outside-root and cross-Project dedicated assertions |
| Physical owner validation | Source writer resolves actual context | Fresh identity/source preflight and physical-owner check | Actual writer tests, cross-owner rejection, outside-root action tests |
| Task grouping/order/counts | Project then Resource aggregation and original groups | Unchanged functions | Original task positions/identities and browser summary/DOM |
| Task-card and Step rendering | Shared cards, continuation, dates, descriptions, nested Steps | Same renderer and styles | Nonempty original/current DOM, labels, rectangles; native card tests |
| Task Add/Edit/completion | Existing Markdown/editor/recurrence/history writers | Identical writer implementations | 23 actual writer/action checks, native control and task-form browser checks |
| Oath partitioning | Ordinary/pinned/completed/missing; actual-owner fallback | Same service and partition renderer | Actual Home Oath DOM/geometry; Oath regressions |
| Async task refresh | Direct indexed task refresh | Owned facade session, latest generation, temporary local overlay | Deterministic promises, delayed imports, acknowledgment, external edits |
| History/Progress refresh | Independent secondary sources/events | Unchanged source blocks; no task-triggered secondary loading | Factory/source comparison; browser Progress counter |
| Previous facade consumers | Search, Brief, Schedule, panels and Phase editor | Identical factories | 157 prior focused checks and targeted browser fixtures |

Intentional safety differences: ambiguous/missing/stale action references now
fail before a writer; malformed individual rows no longer remove unrelated
valid tasks; failed queries retain content with one status. Changed-index reads
cannot undo immediate local edits. These do not change visibility or assign
ownership/IDs. The original inherent limit remains: an ID-less byte-identical
replacement cannot establish durable task identity.

## Executed verification

- **48 new Home focused tests**: 16 query/ownership/cache/lifecycle, 23 real
  legacy writer/action cases and 9 deterministic reconciliation/lifecycle cases.
- **157 previous facade checks**, all executed with Home: **205/205 pass**.
  Includes facade contract/sharing/boundary, Search, Daily Brief, Schedule,
  structured queries, Project/Resource panels and Phase editor transactions.
- **30 existing regression files pass**: tasks, mutations, task-data, planning,
  progress/history, creation retry/created completion, association removal,
  composer/form/date presentation, Project planning/Roadmap, shared Projects,
  data store, Inbox, Oath/workspace/shared Resources, workspace state, Statistics,
  Search, Daily Brief/navigation/snapshot/configuration, workspace, compact form
  and layout polish. Existing simulated conflict/fallback logs are retained.
- **66 native-core tests pass**; both TypeScript 6.0.3 checks report **zero
  diagnostics**. No native core production import is introduced.
- **27 actual Home browser checks pass**, including nonempty original/current
  task DOM and measured geometry, counts, active/completed/missing Resource Oath
  commitments, task/Step writes during delayed reads/imports, exactly-once
  feedback, checkbox focus, task/Step/inline drafts, native menu retention,
  failure/recovery, source reveal, click dismissal resumption, stale remount and
  accepted cleanup commits.
- Original-only fixture independently passes **3 checks** against frozen source.
- Existing Home native action fixture passes **48 Home and 36 workspace/Note
  responsive layouts**, native menus/keyboard/confirmation/cancel/scope tests.
  Its old workspace host was adapted to await the already asynchronous panel
  reader. No assertion or geometry tolerance was weakened.
- Previous browser fixtures pass: Search **21**, Schedule **22**, actual panels
  **8 contexts** plus their interactions, Phase editor **38**, task forms/Quick
  Add/Inbox **64**, Daily Brief footer/navigation/Oath fixture; native configured
  feedback **591** and task-card/Step correction **480** checks.
- Broad `task-workspace-before` and `task-workspace` both reproduce inherited
  **“Mode separator aligns with Files divider”** failure at 1280x1000. The
  assertion/tolerance remains; later assertions did not execute and are uncounted.
- Staged factories: **161 → 162 modules**, exactly two changed existing factories
  (`plugin.js`, `task-service-legacy.js`), one new `home-task-read.js`; **159
  existing factories identical**. Every legacy task/planning writer, strict
  action validator, previous consumer, Oath/Statistics reader and native asset is
  verified unchanged. Non-task Home sections and original count/filter functions
  compare identically.

The first browser fixture attempt serialized file values rather than Map entries
and produced an empty-panel comparison. That result is **not evidence of task
parity**. It was corrected; the retained final runs assert real Project/Resource
rows and compare the frozen original's nonempty output with the candidate.
Original task-result capture and original source/backup provenance were valid
before production edits. Final screenshots and DOM/rectangle records are retained.

Browser host APIs and Markdown host rendering are mocked; actual production Home
task/UI/service code executes. Adjacent Calendar/Focus fixture panels retain Home
CSS geometry, while independent real panel source blocks compare byte-identically.
Full live Obsidian runtime/manual user acceptance and a whole-dashboard screenshot
are not claimed. Obsidian is deliberately not reloaded for tests. Existing shared
date/form/Oath suites supply additional DST, recurrence and transaction coverage.

## Performance

Synthetic in-memory Node 24.21.0, Europe/Stockholm; median of seven runs per
operation on identical 100/1,000/5,000-task datasets with all Resources, active/
inactive/deleted/shared Projects, Steps and explicit outside Project references.
Times below are **original / current milliseconds**, not live Obsidian latency.

| Tasks | Cold | Cached read | After invalidation | Owner filtering | Group preparation | Three mount/unmounts | Status changes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | 0.879 / 1.680 | 0.704 / 0.082 | 0.605 / 1.020 | 0.002 / 0.003 | 0.068 / 0.058 | 1.683 / 3.370 | 0.462 / 0.090 |
| 1,000 | 2.341 / 7.152 | 2.109 / 0.683 | 2.044 / 7.362 | 0.016 / 0.025 | 0.646 / 0.350 | 5.943 / 20.466 | 1.725 / 0.755 |
| 5,000 | 6.496 / 26.881 | 6.456 / 3.370 | 6.292 / 30.112 | 0.049 / 0.044 | 1.874 / 1.786 | 19.094 / 78.129 | 6.519 / 3.413 |

Cold/invalidation reads use **one index scan**, two global identity passes
(existing task-data plus facade projection), **zero Markdown source reads** and
**zero writes**. Originally there was one identity pass. Seven cached reads add
zero scans; seven invalidations add seven. Grouping/filtering does not rescan.
Secondary-panel work is absent from both task paths. Changed-source checks read
only a pending locally edited note; strong action validation remains at actions.
The 5,000-task cold overhead is about 20 ms, invalidation overhead about 24 ms;
cached reads and status filtering improve. No per-task global/source loop exists
in enumeration. Cold remount overhead is reported explicitly; no serious
unresolved performance blocker was found in these measured synthetic workloads.

## Safety and installation

Fresh verified originals and evidence:
`System/Backups/itacan-phase2b2d-20261016-5b13000e/`.
Working audit:
`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-phase2b2d-5b13000ef90a43b890d35dbd1835db11`.

The baseline covers **1,010 unique files**, including ignored private Markdown,
metadata/history, shared Project data, saved Brief/Oath records, settings and
inactive core, and **228 initial Git-status entries**. Twelve original source/
bundle backups are protected, including separately loaded production Home source
and one unchanged preemptive read-helper backup. The phase safety script compares
all originals, preserves every initial status entry, limits additions/changes to
an explicit allowlist and checks introduced whitespace and native inactivity.

The final audit confirms no real task Markdown, task metadata/history, saved
Daily Brief/Oath data, shared Project state, workspace definitions/mounts or
settings changed. All 228 initial Git-status entries remain. It records exactly
eleven approved changed existing files and nineteen new phase files; all twelve
original backups match their baseline hashes and no native authority files exist.
No reset/clean/rebase/commit/synchronization/reload is performed. Any application
change to `.obsidian/workspace.json` is recorded separately and never restored.
Obsidian did change that file during this phase; it was observed only.

Original installed bundle and source build match exactly. Staging emits auxiliary
assets only into the audit directory; `atlas-native.cjs` and strict Oath assets
match baseline and were not overwritten. Home's separately loaded source and
all production inputs are hash-gated alongside the candidate before bundle copy.

```text
Original main.js  4DC7ADDAFAED71C6961B81B9E024744214815F1B134A8F087CC15EA294B61BD6
Candidate main.js 002EE9EB84826EDCA45EE43EEBD1CFC9CACEBF02472905F60D6126A6AC903CDC
```

The reviewed `main.js` is installed and matches the candidate SHA256 above.
The installed safe parse/require smoke check and existing plugin-load check pass
without invoking onload. Installation and final safety manifests are retained
with the verified original backups. Only `main.js` was copied from staging;
approved source changes, including separately loaded Home, match the tested
inputs. No automatic Obsidian reload/restart or plugin disable/enable occurred.
**Manual reload is required when the user is ready.**

## Handoff and stop

[History/Statistics and Oath handoff](../services/TASK-SERVICE-PHASE-2B-2E-2F.md)
identifies actual remaining source entry points, historical attribution/dedup
hazards, task versus Step events, deleted/moved sources, Stats snapshot cohorts,
Standard/Strict enrollment/hydration/fulfillment and Resource mount permissions.
Recommended separate 2E-1/2E-2 and optional 2F subdivisions are audit proposals.

**STOP AFTER PHASE 2B-2D.** No History/Statistics/Oath read migration, writer
migration, native activation, Git synchronization or task-location work proceeds.
