# Phase 2B-2C-2 — Roadmap and Phase-editor task reads

Implemented and verified on 2026-10-16. Phase candidates now use the existing
shared legacy-backed Task Service. Selection intent is independent of query
availability. Existing planning transactions, task writers, Markdown authority
and Roadmap rendering remain unchanged. Stop after this phase.

## Implementation and exact boundaries

Paths below are relative to `.obsidian/plugins/hub-project-menu/` unless prefixed
with `System/` (vault-relative).

| File / line | Change |
| --- | --- |
| `lib/services/project-planning.js:20` | `tasks` becomes async and delegates to `taskCandidates`. Existing callers in the Phase editor and test fixtures are adapted; no synchronous raw fallback remains. |
| `project-planning.js:23` | Queries `workspace`/`indexed` through `plugin.taskService` or the editor's session, re-resolves the Project, and filters actual portable owner type/Project ID. It converts through `legacyReadTask`; absent Phase membership retains the old absent-field convention. Diagnostics remain available. |
| `lib/services/phase-task-read.js:14` | Consumer-owned baseline, current selection, explicit additions/removals, candidate availability and first-seen candidate order. Existing IDs are unchanged; ID-less keys retain path/line meaning. |
| `phase-task-read.js:20` | Effective canonical metadata seeds existing assignment identities before the first async query. An unavailable assignment has no invented path, title, owner, line or action reference. |
| `phase-task-read.js:28` | Generation/cancellation guards, indexed discovery, initial physical-scope verification for otherwise unlocated metadata identities, row availability and selection preservation. Missing candidates never create a removal. |
| `phase-task-read.js:90` | Picker candidates retain original order and exclude selected/ambiguous/unusable references. Add validates current identity/title/Phase evidence; Remove records explicit intent. |
| `phase-task-read.js:105` | Save freezes publication; failure resumes the existing draft. `assignments():107` validates all explicit deltas with `legacyActionTask`, actual Project ownership and original expected Phase before any writer runs. Deltas retain original candidate write ordering. |
| `phase-task-read.js:125` | Idempotent close disposes only this consumer's session. One plugin cleanup registry closes active editors without accumulating retired-modal registrations. |
| `lib/ui/planning-editor.js:39` | Retains the original selected-row markup and Remove control, updates rows in place, preserves keyboard focus/order and adds restrained unavailable evidence when necessary. |
| `planning-editor.js:73` | Async refresh changes candidates/status without reconstructing title/date/description fields. Existing picker query, focus, scroll and selected identity are captured at publication and restored through the existing picker APIs. Phase names refresh from planning state once per refresh, rather than reading planning per candidate during typing. |
| `planning-editor.js:98` | Creates the modal-owned `PhaseTaskRead` and Component. Keeps task invalidation and planning subscriptions distinct; plugin close disposes the read and closes a non-saving modal. |
| `planning-editor.js:143` | Passes only explicit, validated legacy assignment deltas to unchanged `savePhase`, using the captured planning revision. Save locks controls, rejects duplicates, prevents closing while saving and retains fields/selection/error on failure. |
| `planning-editor.js:159` | Modal/picker/planning listener cleanup; late reads cannot publish into a closed or different editor. |

No facade contract or declaration additions were needed: existing structured
workspace queries, owner/Phase evidence, handles, diagnostics and the explicit
legacy bridge already provide the required data. Both declaration checks pass.
No facade mutation operation replaces planning writes.

`ProjectPlanningService.subscribe/changed/transaction/link/savePhase/
saveMilestone/remove/reorder`, from current `project-planning.js:37` onward,
remain **byte-identical** to the original source/factory. `transaction():39`,
`link():62` and `savePhase():84` retain queueing, revisions, expected Phase,
actual ownership, ID allocation during writes only, source line endings,
metadata persistence ordering and rollback. The main Roadmap module, plugin
entry, legacy adapter, other task writers, shared store and previous consumers
are also byte-identical in the generated module comparison.

## Assignment safety

The opening baseline, candidates, draft selection and explicit user deltas are
separate Maps. Refresh never reconstructs selection from an incomplete result.
Original action evidence stays tied to the selected identity and expected Phase;
safe persistent-ID source renames update display location without replacing that
evidence. Title/membership/owner/copy conflicts cannot silently substitute a task.

Metadata alone cannot establish source ownership. On the first successful load,
otherwise unlocated assignment IDs get one cached **indexed** global scope
check through the same facade. A known task in another Project/Resource or an
excluded location is not promoted to a Project assignment, even if legacy Phase
IDs collide. A missing/invalid source remains an unavailable identity with no
fabricated owner. Once the baseline has loaded, later missing/conflicting rows
remain represented. This exceptional scope check is neither a raw reader nor
per-task source validation; normal discovery needs one scoped query.

A proposed change involving an unresolved reference fails with the draft kept.
No partial set of preflight successes is sent to the writer. A metadata-only or
no-op Save can preserve unavailable assignments unchanged because it submits no
task delta. Explicit Remove still works when its actual source can be validated.
If the source cannot be resolved, removal stays a draft until validation recovers.

The established writer rechecks revision/source/ownership/Phase inside its own
transaction after read-side preflight. A cache refresh does not replace that
revision check. Phase-only changes produce no completion, history or Oath events.

## File inventory

Eight existing files change including the installed artifact:

- `lib/services/project-planning.js`, `lib/ui/planning-editor.js`.
- `lib/tests/project-planning.test.js`: injects the real facade and awaits the
  async read API; all original writer/revision/rollback assertions remain.
- `lib/tests/task-workspace-browser.js`: awaits its existing planning task reads;
  existing assertions, including the failing divider assertion, are retained.
- `lib/tests/task-form-workflows.html`: supplies the real facade in the isolated
  host; its 64 original workflow assertions remain.
- `lib/tests/task-service-boundary.test.js`: permits the authorized Phase reader
  and keeps Home/Oath/Inbox/native boundaries and previous assertions.
- `lib/services/TASK-SERVICE.md`: current completion/handoff pointers.
- `main.js`: verified generated artifact only.

New files:

- `lib/services/phase-task-read.js` and `TASK-SERVICE-PHASE-2B-2D.md`.
- `lib/tests/phase-read-fixture.cjs`, `phase-read-planning-original.cjs`,
  `phase-read-editor-original.cjs`, `phase-read-baseline.json`: actual original
  reader/editor/writer sources and candidate/selection/label baselines captured
  before production edits. Captured sources still match their original backups.
- `lib/tests/phase-read.test.js`, `phase-read-transactions.test.js`.
- `lib/tests/phase-read.html`, `phase-read-before.html`, `phase-read-browser.js`,
  `phase-read-interactions.js`: actual production Phase/Roadmap module fixtures.
- `lib/tests/phase-read-benchmark.cjs`, `phase-read-build-check.cjs`,
  `phase-read-safety.cjs`, and this report.

## Behavior comparison

| Area | Original behavior | New behavior | Verification evidence |
| --- | --- | --- | --- |
| Project candidate inclusion | Recursive workspace tasks plus physical Project owner; inactive/shared Projects supported | Same private/inactive/Itacan/Obsidian Hub sets, IDs, full text, metadata and order | Four frozen original result sets and owner tests |
| Workspace exclusions | System/Templates/hidden/outside-root and Resource/mounted tasks excluded | Same policy and owner restrictions; Phase-ID collision cannot admit another owner | Focused workspace, mounted Resource, collision tests |
| Phase membership | Canonical metadata and Project-qualified labels | Same membership/labels, including missing Phase references; original expected membership retained for actions | Baseline candidate facts and stale-membership tests |
| Picker filtering/order | Existing fuzzy modal, original ordering, selected/conflict exclusions and Phase labels | Same native picker class/conventions; cache refresh preserves input, focus, scroll and chosen identity | Four exact original/current label sets, browser typing/keyboard checks |
| Existing selected tasks | Initialized from the opening task list | Explicit opening baseline; unavailable initial IDs remain represented | Baseline/first-query/failure/recovery tests |
| Missing selected tasks | Direct synchronous enumeration | Missing/ambiguous reads never produce a removal delta | Central missing/failed/ambiguous/partial-query tests |
| Task Add/Remove | Explicit draft selection, Remove focus handling, Save/Cancel | Same controls and draft conventions; additions/removals survive refresh and retain write order | Node delta/order tests and actual modal controls |
| Phase assignment Save | Existing `savePhase` transaction | Same writer after explicit legacy conversion/preflight | Actual original/new Markdown/metadata/revision/check/history comparisons |
| Revision conflicts | Captured planning revision rejects an older editor | Same protection; refreshed candidates do not update the captured revision | Node and two real modal browser tests |
| Rollback | Source list and planning/metadata snapshot restoration; rollback failure visible | Same successful/failing transaction behavior, including preserved partial state on rollback failure | Source/metadata/rollback-failure parity tests |
| Roadmap UI | Original Phase/Milestone renderer and geometry | Module unchanged; candidate reads cause no redraw | Exact original/current Roadmap and Milestone-modal DOM/layout |
| Previous facade consumers | Completed Search/Brief/Schedule/panel integrations | Same production module factories and working browser/regression checks | 127 prior focused checks, existing regression and browser suites |

Intentional safety differences: copied Step/task IDs, stale temporary locators
and changed titles/Phase/owners are rejected before assignment writes. Unknown
existing IDs remain visibly unavailable without invented source references.
An unaffected existing assignment is preserved without requiring a source write.
These differences do not allocate IDs, change storage, expand mounts or weaken
the original transaction.

## Executed verification

- **30 new focused tests:** 20 read/selection/parity/lifecycle tests and 10 actual
  original/new transaction tests. They cover first-read failure, absent initial
  source, incomplete/failed refresh, copied identity, recovery, explicit intent,
  title/Phase/owner drift, persistent source rename, ID-less reads/assignment,
  pending refresh/save freeze, multi-Project sessions, concurrent revisions,
  source failure, metadata failure and rollback failure.
- **157 combined focused checks pass** in `facade-consumers-verified.out.log`:
  42 facade, 23 Search, 21 Brief/Schedule/structured, 41 panel and 30 new Phase.
- **30 existing regression files pass** in `legacy-regressions.out.log`:
  task/data/mutation/planning/progress/history/creation/retry/completed creation,
  association removal, composer routing, forms/dates, Project planning,
  Milestones, shared Projects/data store, Inbox, Oath/workspace/shared Resources,
  workspace persistence, statistics, Search, Daily Brief/navigation/snapshot/
  configuration, Task Workspace, compact form and layout.
- **66 inactive native-core tests pass**, using disposable repository fixtures.
- Both TypeScript 6.0.3 declaration checks pass with **zero diagnostics**.
- **38 actual Phase browser checks pass**: original/current Phase modal DOM,
  measured rectangles and picker labels/order for all four Project scenarios;
  unchanged Roadmap/Milestone geometry; no Roadmap redraw on discovery; pending
  query/input/keyboard/scroll races; selected/unavailable/recovery feedback;
  field drafts; Remove focus; explicit removal Save; stale-source failed Save;
  disabled controls and close prevention while saving; frozen refresh results;
  two-editor revision conflicts; A/B loads, repeated mounts and plugin unload.
- Prior browser checks pass: Project/Resource Tasks panels (eight exact original/
  current DOM comparisons plus action/lifecycle flows), Schedule **22**, Search
  **21**, Daily Brief footer/control and task form workflows **64**.
- Build comparison passes: **161 modules**, **158 unchanged existing factories**,
  two authorized changed factories and one new helper. All planning writer
  methods, Roadmap, plugin entry and previous writer/consumer factories match.

The broad current and captured-original task-workspace fixtures both still stop
at **Mode separator aligns with Files divider** at 1280×1000. Its assertion and
tolerance are unchanged. Later broad-fixture assertions are not counted as run.
The independent Phase and Schedule fixtures do execute their targeted checks.

Earlier development failures are retained in logs: missing synthetic metadata
entries during capture, a retained row's initial accessibility label, and random
UUID comparison for a deliberately failed rollback. These were resolved without
weakening assertions; UUID normalization preserves every source/metadata binding
and orphaned identity rather than deleting evidence. Passing legacy suites retain
their expected simulated workspace conflict and fake navigation fallback logs.

No live-vault task writes, live Phase assignment changes, plugin onload/reload,
Home migration or native activation were used for testing. Browser fixtures run
the production editor/Roadmap modules with isolated vault/Obsidian API hosts.
They preserve the native picker subclass/callback boundary; the fixture supplies
its search/keyboard host rather than loading Obsidian's full native matcher.
Real Obsidian multi-window operation, other viewports, all unrelated browser
fixtures and production disk latency are unexecuted. Existing API-level fuzzy
matching remains inherited; no replacement fuzzy engine ships in the plugin.

## Candidate-query performance

Final synthetic comparison, Node 24.21.0 / Europe/Stockholm, ten parents per
in-memory note with one Step each. Old discovery executes the captured original
reader. Cached is the mean of ten rereads; five filters use existing candidate
text/path evidence. Preparation extracts semantic display facts, not full DOM
construction/paint. Three switches create fresh Project sessions.

| Tasks | Initial old/new ms | Cached old/new ms | Invalidation old/new ms | Five filters old/new ms | Preparation old/new ms | Three switches old/new ms |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 1.334 / 7.186 | 0.488 / 0.114 | 0.309 / 1.210 | 0.118 / 0.107 | 0.123 / 0.010 | 0.824 / 3.197 |
| 1,000 | 4.054 / 12.171 | 3.223 / 0.913 | 2.644 / 8.108 | 0.738 / 0.538 | 0.053 / 0.041 | 8.032 / 21.095 |
| 5,000 | 19.766 / 50.577 | 16.506 / 2.010 | 13.512 / 43.379 | 2.911 / 2.964 | 0.242 / 0.273 | 39.446 / 94.794 |

Normal cold/invalidation discovery uses **one Dataview scan**, **zero source
reads**, **zero writes**, and two query-wide identity passes (existing task-data
and display context), versus one identity pass originally. Ten cached rereads
add zero index scans versus ten originally. Three new Project consumers add
three scans in either implementation. Picker typing does not query the index
or read source notes. A modal with initially unlocated assignment IDs may add
one cached indexed global scope check; it does not source-validate each task.

Cold cost at 5,000 tasks is about 31 ms higher; invalidation is about 30 ms
higher. Cached reads improve from about 16.5 to 2.0 ms and filtering remains
comparable. Three fresh switches cost about 55 ms more in aggregate. These are
explicit in-memory costs, not production latency claims. Strong source preflight
is restricted to explicit assignment changes and is not benchmarked as part of
enumeration. No unbounded per-task global/source validation loop is introduced.

## Safety, backups and installation

Fresh durable originals/evidence:
`System/Backups/itacan-phase2b2c2-20261016-74909cd2/`.
Working audit:
`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-phase2b2c2-74909cd28b054df8b7f2696d6c98300c`.

The baseline records **994 unique files** including ignored private Markdown,
task metadata/history, Project planning/shared data, settings and inactive core,
plus **208 initial Git-status entries**. Nine source/artifact backups are
hash-verified (including one preemptively protected but unchanged browser host).
All initial status entries remain. The allowed final implementation inventory is
eight changed existing files and sixteen new phase files; the safety JSON records
their exact paths/hashes. Captured original sources match their original backups.

Actual task Markdown, task metadata/history, Project Phase records, Git-shared
Project data, plugin settings, Project/Resource definitions, mounts, saved Briefs,
Oath commitments and native-core source remain unchanged. Existing planning and
task writers are identical. No reset/clean/rebase/commit occurred. No live native
manifest, writer lock or generation was created. Source/bundle hashes and
phase-only whitespace checks are verified before replacement.

Obsidian changed **`.obsidian/workspace.json`** during execution. This is recorded
separately as application-managed state; it was never written or restored by this
work. Code backups must not overwrite current application-managed data.

The initial source build exactly matched installed `main.js`. Staging changed
only the two approved read/editor factories plus one helper. `atlas-native.cjs`
and `strict-oath-assets.json` match baseline and are not installed over existing
assets. Only the reviewed `main.js` is copied after all required scoped gates.

```text
Original main.js  B7324A70F3D59DF7AD29B2F307E6E6CE6B594D8D73C997ADCC78158B49854211
Candidate main.js 4DC7ADDAFAED71C6961B81B9E024744214815F1B134A8F087CC15EA294B61BD6
```

The final bundle is installed and hash-matches the reviewed candidate above.
The final audit passes over all 994 baseline files, preserves all 208 initial
Git-status entries, verifies nine original backups and finds exactly eight
approved existing-file changes and sixteen new phase files. Installation and
the final installed hash are recorded in `installation.json` and `safety-final.json`
in the durable backup. The installed plugin passes the safe parse/require smoke
check without invoking onload. No automatic
Obsidian reload/restart or plugin disable/enable is performed. **A manual reload
is needed when the user is ready.**

## Handoff and stop

[Phase 2B-2D handoff](../services/TASK-SERVICE-PHASE-2B-2D.md) identifies actual
Home loaders, active-Project/all-registered-Resource policy, Resource-first and
explicit page-Project ownership, grouping, Oath display, actions, cache/lifecycle
hazards, required Home policy/evidence and tests. Separate remaining History,
Statistics and Oath read consumers are documented without changing them.

**STOP AFTER PHASE 2B-2C-2.** Home, History/Statistics, Oath resolution, writers,
native activation, Git synchronization and the new location model remain deferred.
