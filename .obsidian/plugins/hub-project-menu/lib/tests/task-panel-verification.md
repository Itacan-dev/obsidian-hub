# Phase 2B-2C-1 — Project and Resource Tasks panel reads

Implemented and verified on 2026-10-16. Project and all four Resource Tasks
panels use the existing shared legacy-backed facade. Markdown, existing metadata,
history, writers and Oath resolution remain authoritative. Native storage is inactive.
Stop after this phase; Roadmap/Phase selection is documented, not implemented.

## Files and integration points

Paths beginning `System/` are relative to the vault; other paths below are
relative to `.obsidian/plugins/hub-project-menu/`.

| Modified existing file | Change |
| --- | --- |
| `System/Dashboards/Project/view.js:2775` | One panel read controller for the shared Project/Resource renderer; existing task UI receives optional guarded action callbacks. |
| `System/Dashboards/Project/view.js:2782` | Existing immediate writer edits reconcile through the controller, invalidate outstanding reads and retain their note state until import acknowledgment. |
| `System/Dashboards/Project/view.js:2828` | `readProjectTasks` awaits the facade-backed reader; no raw Dataview fallback or independent task-data subscription remains in this section. |
| `System/Dashboards/Project/view.js:2985` | Checkbox action validates its legacy reference, then calls the unchanged plugin toggle writer. Clear and source opening use equivalent guards at `:3174` / `:3027`. |
| `System/Dashboards/Project/view.js:3101` | Async publication checks component generation, connection, active workspace mode/rail and existing edit deferral. Unchanged input does not rebuild rows. Errors retain rows and one restrained status. |
| `plugin.js:12739` | `hubCreateTaskUi` retains its existing implementation, with optional per-panel mutate/edit callbacks; default Home callers continue using the identical original callbacks. |
| `plugin.js:12751` | Exposes the panel read factory using the existing `this.taskService`; `:12965` removes that global at unload. No second facade/backend is constructed. |
| `lib/services/task-service-contract.d.ts:56` | Narrow structured display base, optional primitive capture provenance, Step-parent evidence, and display-only evidence for invalid action locators. `:102` explicitly permits `panel` policy. |
| `lib/services/task-service-legacy.js:70` | Structured `panel` uses recursive `within(path,currentRoot)`; workspace/Schedule retain `validLocation`. Global ambiguity accounting still sees excluded tasks. |
| `lib/services/task-service-legacy-read.js:10` | Separates portable display evidence from validated legacy reference construction; retains full indexed text separately from canonical title, Steps/ancestry, nullable times, metadata and capture provenance. Invalid panel references can retain display with actions unavailable. |
| `lib/services/task-service-legacy-bridge.js:6` | Copies optional normalized capture provenance into the existing explicit legacy read bridge. No generic Dataview/file/source-block DTO fields are added. |
| `lib/tests/task-data.test.js` | Awaits the actual dashboard reader bound to a real facade/panel controller. All original move/rename/ownership/import/delete/disposal assertions remain. |
| `lib/tests/task-service-types.fixture.ts` | Accepts explicit panel policy; unknown policy remains a compile-time error. |
| `lib/tests/task-service-boundary.test.js` | Adds the approved panel boundary and retains prior consumer/native/writer checks. |
| `lib/services/TASK-SERVICE.md` | Current report/handoff pointers. |
| `main.js` | Generated verified candidate; installation record below. |

New production helper: `lib/services/task-panel-read.js:34` owns one consumer
session, cached portable render inputs, semantic equality, guarded action
callbacks and local mutation reconciliation. Its plugin-wide WeakMap registry
adds one unload callback and removes retired panels, rather than retaining a
new plugin cleanup closure for every mount. Component close removes only that
panel's facade listener; one adapter watcher serves all live consumers.

Reconciliation retains affected-note state, not a durable task mirror. A newer
read cannot replace an immediate completion result with an older indexed state.
Matching imported data releases retained evidence. Rename/delete discards missing
sources; a move outside the physical workspace cannot expand visibility. If a
later import disagrees and the affected note changed externally before local
acknowledgment, the retained evidence is superseded. That exceptional path reads
only the locally edited note; ordinary enumeration reads zero Markdown sources.
Source evidence stays private and temporary, and never becomes a DTO or native
revision. Legacy notifications do not claim atomic persistence.

All actions validate source/identity before entering the original legacy
writer/editor. Indexed continuation text remains the input to the original
inline writer's existing continuation-validation logic. No facade mutation
method replaces task UI writers. Batch clear validates all references before
calling the unchanged clear writer and its existing confirmation flow. Panel rows
retain primitive owning-workspace evidence; an indexed move across physical
owners rejects stale actions before old clear/history context can reach a writer.
Existing raw Resource Oath references keep their actual Resource owner. Phase
label changes also participate in render equality, even when task fields match.
Read disposal preserves accepted writes and the existing inline UI's cleanup
commit; it cannot cancel a pending save merely because the panel closed.
Plugin/facade shutdown still rejects new source-validation preflight.

New evidence files:

- `lib/tests/task-panel-fixture.cjs`, `task-panel-original.cjs`,
  `task-panel-baseline.json`, `task-panel-record-input.cjs`, `task-panel-input.json`:
  original reader/renderer and synthetic input capture before production edits.
  The original source section remains exactly equal to its backed-up source.
- `lib/tests/task-panel-read.test.js`, `task-panel-actions.test.js`:
  focused contract/parity, generation, lifecycle and actual writer comparisons.
- `lib/tests/task-panel.html`, `task-panel-before.html`, `task-panel-browser.js`,
  `task-panel-test-host.js`, `task-panel-interactions.js`: independent actual
  dashboard Tasks-section browser harness with original shared UI/card/Step code.
- `lib/tests/task-panel-benchmark.cjs`, `task-panel-build-check.cjs`,
  `task-panel-safety.cjs`: comparative performance, exact factories/writer
  provenance, backup/data/status/whitespace audit.
- This report and `lib/services/TASK-SERVICE-PHASE-2B-2C-2.md`.

## Behavior comparison

| Area | Original behavior | New behavior | Evidence |
| --- | --- | --- | --- |
| Project task inclusion | Recursive physical root, including nested/System/Templates/hidden locations; inactive and both shared Projects | Same order, task identities/locators, full text and metadata; mounted Resource tasks remain outside the Project | Frozen original data for App, Other, Itacan, Obsidian Hub; panel read tests |
| Resource task inclusion | Physical Knowledge/Research/Explorations/Inspiration roots | Same Resource-owned sets; mounted Knowledge note remains Knowledge-owned | Four frozen Resource baselines, owner assertions, browser DOM |
| Task groups/counts | Existing active/future/completed partition, ordering and disclosure | Same grouping/counts; unchanged inputs retain DOM | Semantic baselines and exact expanded DOM/layout comparison |
| Task-card presentation | Existing shared card/Markdown/source/Phase/date/description renderer | Same renderer, CSS, labels, attributes and measured element rectangles | Eight actual original/current Tasks panels, screenshots and serialized DOM |
| Steps | Existing order, display text, source references, nested ancestry and disclosure | Portable ancestry plus explicit legacy evidence; no IDs allocated on read | Frozen nested Steps, structured tests, real checkbox/editor browser paths, card/Step fixture |
| Completion actions | Plugin task/Step writers, Tasks-plugin recurrence, history and Oath feedback | Same writer functions and exactly matching source/metadata/check/history effects | 21 action tests, completion/reopen/save-on-close browser checks, immutable writer factory comparison |
| Add/Edit actions | Existing creator/editor, Steps and Phase actions | Same UI/writers after guarded source resolution; inline continuations preserved | Actual writer comparison and 64 existing form workflow checks |
| Oath partitioning | Existing ordinary/pinned/missing/completed resolution and fulfillment | Same Oath service and partition renderer; committed task appears once | Exact original/current active-Oath panel DOM, Oath regression suites |
| Async refresh | Direct indexed refresh with immediate edit reconciliation | Generation/disposal/mode guards; retained mutation evidence; draft deferral; last valid rows on query failure | Deterministic delayed reads, actual task/Step/inline drafts and focus, import/recovery, watcher lifecycle tests |
| Search/Daily Brief/Schedule | Completed facade integrations | Source/factories identical; established data/DOM/navigation tests pass | 23 Search, 21 Daily Brief/Schedule/structured tests and targeted browsers |

Intentional safety differences: copied IDs, ambiguous temporary locators,
unavailable metadata/source references and malformed action locators cannot open
or mutate a different task. Trustworthy invalid-locator display remains visible
without an invented line/handle; unsafe actions reject. A source may be
displayable without being actionable. No IDs or history events arise from reads.
Entirely malformed rows without trustworthy text/path remain diagnostics.

Completion chronology is not inferred from checkboxes. This panel renderer needs
source references and existing metadata, rather than a copied history timestamp;
the existing Wizard/history and Oath services retain their original responsibilities.

## Executed verification

- **41 new focused tests:** 20 panel read/contract/parity/lifecycle tests and
  21 actual existing task/Step/edit/Phase/clear/recurrence writer, ownership and cleanup-commit tests.
- **128 checks pass** in `facade-consumers-complete.out.log`: these 41,
  42 existing facade checks, 23 Search checks, 21 Daily Brief/Schedule/structured
  checks and the preserved task-data regression file.
- **30 existing regression files pass** in `legacy-regressions-final.out.log`:
  tasks, mutations, data, planning, progress, history, creation retry/completed
  creation, association removal, composer routing, forms/date presentation,
  Project planning/Milestones, shared Projects/data store, Inbox, Oath/workspace/
  shared Resources, workspace persistence, statistics, Search, Daily Brief/
  navigation/snapshot/configuration, Task Workspace, compact form and layout.
- **66 inactive native-core tests pass**, using disposable repositories only.
- Both TypeScript 6.0.3 checks pass with **zero diagnostics**.
- Actual dashboard panel browser: eight original/current DOM/layout comparisons,
  expanded groups/Steps, Oath partition parity, keyboard Edit, Header Add,
  original checkbox/Step writer paths, immediate completion versus held read,
  cached lagging index, task/Step/pending-new-Step/inline drafts and focus,
  menu retention, failure/recovery, mode/rail guards, Project-to-Knowledge race,
  repeated mount/unmount, quiet close and backend watcher cleanup pass.
- Existing browser fixtures pass: Schedule **22 checks**, Search **21**,
  Daily Brief footer/control, task form workflows **64**, configured-icon/
  description feedback **591**, and card/Step correction **480**. The latter two
  use archived native Obsidian CSS through the required preview parameter.
- Bundle factory/provenance check passes: **160 modules**, **155 existing
  factories identical**, four approved changed factories and one new helper.
  Every strict adapter method from `#owner` onward and every plugin task writer
  from `toggleTask` onward is byte-identical. Optional entry callback/factory/
  cleanup changes are matched exactly. Other generated assets are identical.

The broad `task-workspace` browser still stops at **Mode separator aligns with
Files divider** at 1280×1000. The captured original `task-workspace-before`
reproduced the identical failure before edits. Its assertion/tolerance remains
unchanged; subsequent broad-fixture assertions are not counted as executed.
Independent panel and Schedule fixtures provide targeted coverage.

Earlier development failures remain in logs: incorrect expected validation code,
missing fixture checkbox global, lazy Step editor activation, the old synchronous
task-data harness, missing native-CSS preview, the build check's initial use of
unrewritten require paths, and fixture EOF whitespace. Their final scoped checks
pass. The existing simulated workspace revision-conflict log and Daily Brief
fake navigation fallback remain expected outputs of passing legacy tests.

No production-vault task actions, live Obsidian plugin onload/reload, native
activation, Roadmap read migration, Home migration or unrelated browser suites
were executed. Browser components use isolated vault/Obsidian API fixtures;
the actual dashboard Tasks section and shared production UI/writers are executed,
but the full live Obsidian application is not launched for this verification.
Other viewports, real multi-window Obsidian runtime and production disk latency
are unmeasured; multiple consumer/window lifetimes are covered synthetically.

## Performance

Final candidate benchmark, Node 24.21.0 / Europe/Stockholm, in-memory synthetic
notes with ten parents per note and one Step each. Times are milliseconds.
The old path executes the captured actual dashboard reader. Cached means 20
rereads; workspace switches create three fresh workspace consumers. Preparation
applies existing grouping and extracts the same semantic render facts three times;
it does not measure full Chromium paint or large DOM construction.

| Tasks | Initial old/new | Cached mean old/new | Invalidation old/new | Three workspace switches old/new | Three preparations old/new |
| --- | --- | --- | --- | --- | --- |
| 100 | 1.285 / 4.833 | 0.404 / 0.003 | 0.315 / 1.667 | 0.925 / 3.002 | 5.782 / 1.620 |
| 1,000 | 4.035 / 10.811 | 3.013 / 0.011 | 2.675 / 10.058 | 5.903 / 20.042 | 14.592 / 14.496 |
| 5,000 | 19.375 / 51.971 | 14.119 / 0.056 | 12.675 / 48.021 | 30.284 / 96.499 | 71.391 / 66.977 |

Both cold and invalidation paths perform **one Dataview scan**, **zero source
reads** and **zero writes**. Cached facade rereads add zero scans/source reads,
versus 20 old scans for 20 rereads. Three fresh workspace consumers add three
scans in either implementation. Source-inspected global identity passes per cold
read are two for the facade (existing task-data plus display ambiguity context)
versus one originally; there is no global source-validation loop per rendered
task. The source-policy-only extra ID counts are skipped for indexed panels.

The cold cost is explicit: about 33 ms extra at 5,000 tasks and 35 ms extra after
invalidation; three fresh workspace loads cost about 66 ms extra. Cached reads
are substantially faster and unchanged inputs avoid row rebuilds. This does not
establish production latency. Fresh action validation and large batch-clear
preflight are not benchmarked here. Exceptional pending-write conflict checking
can read its affected note; normal enumeration and the benchmark remain source-free.

## Safety, backups and installation

Durable originals/evidence:
`System/Backups/itacan-phase2b2c1-20261016-581be41b/`.
Working audit:
`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-phase2b2c1-581be41b31a043f3b7fbd604306fad57`.

The initial baseline contains **1,104 hash records / 976 unique files**,
including ignored private Markdown, metadata/settings, shared Project data and
the Phase 2A package, plus **189 initial Git-status entries**. Eleven original
source/test/doc/bundle backups are independently hash-verified. All initial status
entries remain. Only the eleven allowed existing implementation/artifact files
and eighteen new phase files are expected to differ after installation.
The source build before edits exactly matched the previously installed bundle.

Real task Markdown, task metadata/history, Git-shared Project data, plugin settings,
Project/Resource definitions, mounts and Oath commitments remain unchanged.
Existing writers, Home, Roadmap/Phase selection, Inbox/Quick Add, statistics and
all previous read consumers remain unchanged. No new native CURRENT/WRITER/
generation file or live repository exists. No reset, clean, rebase or commit was
issued. Phase-only whitespace checks pass; inherited blank lines in the exact
frozen original section are verified against its source rather than rewritten.

An unrelated **application-managed `.obsidian/workspace.json` change** occurred
during execution. It is recorded separately in the safety audit and was never
written or restored by this work. Code backups must not be used to restore old
application-managed state over the current vault.

Staged `atlas-native.cjs` and `strict-oath-assets.json` are identical to baseline
and are not copied. The only installed generated artifact is `main.js`; the
dashboard source change is already in its existing vault script location.

```text
Original main.js  197F008B40F13FF48435F59C78451D15D566099C327EFBA24167EFDF84295428
Candidate main.js B7324A70F3D59DF7AD29B2F307E6E6CE6B594D8D73C997ADCC78158B49854211
```

The final bundle is installed and hash-matches the tested candidate. The isolated
installed-plugin parse/require smoke check passes without invoking onload.
An intermediate verified bundle was replaced after the final ownership and
Phase-label guards; its bundle and installation record are retained separately
under `intermediate/`. No Obsidian reload occurred between these copies.
Installation status and final installed hash are recorded in `installation.json`
and `safety-final.json` in the durable backup. No automatic reload/restart or
plugin disable/enable is performed. Manual Obsidian reload is left to the user.

## Handoff and stop

See [the precise Phase 2B-2C-2 handoff](../services/TASK-SERVICE-PHASE-2B-2C-2.md)
for Project planning candidates, Phase-picker selection, existing assignments,
source guards, revision conflicts, transaction/rollback and required tests.
Missing/unresolved selections must never become implicit unassignments.

**STOP AFTER PHASE 2B-2C-1.** Roadmap integration, Home, writer migration,
native activation, Git synchronization and the new location system remain deferred.
