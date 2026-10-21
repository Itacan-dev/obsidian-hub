# Phase 2B-2B completion report — 2026-10-16

Daily Brief discovery/target validation and Project Schedule enumeration now
use the existing shared legacy-backed Task Service. The reviewed bundle is
installed and its hash verified. Obsidian was not reloaded or restarted;
manual reload is needed to activate it. Native task storage remains inactive.
Phase 2B-2C has not been implemented.

## Files and integration points

Paths in these tables are relative to `.obsidian/plugins/hub-project-menu/`.
Links give individual source lines. All pre-existing files were backed up before
editing; earlier modified/untracked work was retained.

| Modified file | Change |
| --- | --- |
| [`lib/services/task-service-contract.d.ts:52`](../services/task-service-contract.d.ts#L52) | Typed structured task/Step views, explicit primitive legacy evidence, row validation grade and saved-v1 target compatibility; three new read operations at `:98`. Existing strict DTOs/mutations stay unchanged. |
| [`lib/services/task-service.js:7`](../services/task-service.js#L7) | Adds dispatch for `queryStructured`, `resolveLegacyAction`, `resolveSavedTarget` only. |
| [`lib/services/task-service-legacy.js:70`](../services/task-service-legacy.js#L70) | One indexed/identity context for structured reads, explicit workspace policy, fresh legacy action resolution (`:99`) and saved target interpretation (`:106`). All existing strict/reveal/history/write methods remain identical. |
| [`lib/services/daily-brief.js:32`](../services/daily-brief.js#L32) | Lazy consumer-owned read session, asynchronous availability (`:50`), checked candidate context (`:139`), guarded provider/snapshot loading (`:160`) and facade-backed saved task validation (`:216`). |
| [`lib/ui/task-workspace.js:73`](../ui/task-workspace.js#L73) | Shared-facade read session, legacy action bridge (`:110`), async Project Schedule refresh (`:129`), validated source opening, component/mode/rail generation guards. Resource early return, renderers and creator remain unchanged. |
| [`lib/tests/daily-brief-navigation.test.js:35`](daily-brief-navigation.test.js#L35) | Injects actual legacy facade into the existing fixture and awaits context; retains all target/Oath/fallback assertions. |
| [`lib/tests/daily-brief-snapshot.test.js:33`](daily-brief-snapshot.test.js#L33) | Same actual facade injection; availability assertions now await reads. Existing artifact/restart/boundary/provider/persistence assertions retained. |
| [`lib/tests/daily-brief-configuration.test.js:84`](daily-brief-configuration.test.js#L84) | Same injection and explicit await; preserves configuration/history/real legacy task-write assertions. |
| [`lib/tests/task-workspace-browser.js:34`](task-workspace-browser.js#L34) | Repairs dependency discovery, supplies faithful Component methods and the shared host. Adds an independent targeted fixture branch and original-renderer comparison; no existing assertion removed. |
| [`lib/tests/daily-brief-control.html:15`](daily-brief-control.html#L15) | Repairs loader dependencies/process stub, injects actual host and source fixture, awaits availability. Existing UI/visibility/Oath/snapshot assertions retained. |
| [`lib/tests/task-service-boundary.test.js:6`](task-service-boundary.test.js#L6) | Checks the three approved read consumers, unchanged writers and unreachable native core. |
| [`lib/tests/task-service-types.fixture.ts:8`](task-service-types.fixture.ts#L8) | Checks structured read types, source evidence and rejection of an incorrect panel policy/platform file access. |
| [`lib/services/TASK-SERVICE.md:3`](../services/TASK-SERVICE.md#L3) | Current status pointer; preserves Phase 2B-1 historical record. |
| [`lib/services/TASK-SERVICE-PHASE-2B-2B.md:3`](../services/TASK-SERVICE-PHASE-2B-2B.md#L3) | Marks the pre-implementation handoff historical and links completion/next scope. |
| [`main.js:1`](../../main.js#L1) | Installs the generated, staged/verified bundle only. |

| New file | Purpose |
| --- | --- |
| [`lib/services/task-service-legacy-read.js:10`](../services/task-service-legacy-read.js#L10) | Portable structured projection and batched source checking (`:53`), using existing source parser/metadata semantics. |
| [`lib/services/task-service-legacy-bridge.js:6`](../services/task-service-legacy-bridge.js#L6) | Explicit legacy render/source references; fresh task/Step request validation before unchanged writers. Handles immediate legacy reconciliation before Dataview imports. |
| [`lib/services/task-read-session.js:4`](../services/task-read-session.js#L4) | Consumer-owned, generation-invalidated promise cache and owned subscription cleanup. |
| [`lib/tests/task-read-fixture.cjs:1`](task-read-fixture.cjs#L1) | In-memory task/metadata/history/owner fixtures and semantic comparison helpers. |
| [`lib/tests/task-read-record-baseline.cjs:1`](task-read-record-baseline.cjs#L1) | Explicit, overwrite-refusing capture from the original backed-up Daily Brief source. |
| [`lib/tests/task-read-parity.json:1`](task-read-parity.json#L1) | Actual original Daily Brief evidence/recommendations at five local day/DST boundaries and old Schedule task/group/calendar inputs. |
| [`lib/tests/task-read-test-host.cjs:1`](task-read-test-host.cjs#L1) | Actual facade/adapter injection for older synthetic service fixtures; supplies their missing synthetic Step positions and canonical metadata boundary. |
| [`lib/tests/task-structured-read.test.js:1`](task-structured-read.test.js#L1) | Nine structured read/identity/Step/source/session/shutdown tests. |
| [`lib/tests/daily-brief-facade.test.js:1`](daily-brief-facade.test.js#L1) | Eight candidate/history/availability/provider/day/Oath/disposal tests. |
| [`lib/tests/schedule-facade.test.js:1`](schedule-facade.test.js#L1) | Four exact legacy parent/Step/edit effect and indexed refresh/subscription tests. |
| [`lib/tests/schedule-read.html:1`](schedule-read.html#L1), [`schedule-read-browser.js:1`](schedule-read-browser.js#L1) | Supported actual Schedule UI smoke and deterministic lifecycle/race fixture. |
| [`lib/tests/task-workspace-original.cjs:1`](task-workspace-original.cjs#L1) | Exact test-only original renderer copy, hash-matched to the pre-edit backup. |
| [`lib/tests/task-workspace-before.html:1`](task-workspace-before.html#L1) | Executes original renderer with the same existing workspace assertions to classify the inherited layout failure. |
| [`lib/tests/task-read-benchmark.cjs:1`](task-read-benchmark.cjs#L1) | Original/new discovery, cache, invalidation and view-change measurements at 100/1,000/5,000 tasks. |
| [`lib/tests/task-read-build-check.cjs:1`](task-read-build-check.cjs#L1) | Module-by-module comparison without running plugin startup; verifies writer/schema/Search/native boundaries. |
| [`lib/services/TASK-SERVICE-PHASE-2B-2C.md:1`](../services/TASK-SERVICE-PHASE-2B-2C.md#L1) | Proposed Tasks panel/Roadmap scope, visibility/action gaps and recommended subdivisions. |
| [`lib/tests/task-read-verification.md:1`](task-read-verification.md#L1) | This completion report. |

### Read, identity and compatibility design

`queryStructured({validation:"source"})` discovers indexed candidates once,
counts parent/Step identities globally and reads each selected source note at
most once with four workers. It reuses `readTaskSnapshot` and canonical metadata
normalization. A validated row retains canonical title, full indexed compatibility
text, dates with nullable optional times, importance, owning Phase, ordered
Steps/ancestry and explicit primitive legacy references. It does not expose a
file object, source block, edit token or fabricated revision. Indexed Step
ancestry follows actual parents through ordinary intervening list items; checked
ancestry uses existing source-block ranges. Every legacy locator is validated.

Daily Brief retains safe indexed evidence for unresolved rows so historical
task/Step matching still works, but marks those records unavailable. Eligibility
requires a source-checked row; displayability alone never authorizes selection.
Otherwise a missing task could incorrectly turn recorded task focus into general
workspace focus. Invalid rows with no trustworthy reference are diagnostic-only.
Query failures remain typed; row failures do not suppress healthy candidates.

Schedule requests `{policy:"workspace",validation:"indexed"}` for the actual
Project reference. It retains existing physical `validLocation` exclusions and
global identity-conflict accounting. Date/view changes use the current rendered
task set, without index or source reads. Its explicit legacy compatibility
bridge feeds existing task-card/render inputs, never a generic DTO masquerading
as a Markdown task. Fresh facade resolution precedes task/Step mutations and
editing; the resulting reference goes to the same `plugin.mutateTask` or
`openTaskEditor`. Creation still calls `openTaskCreator`. Source opening resolves
the handle and uses the existing note callback; unsupported native targets fail
explicitly. No mutation is redirected through facade write operations.

Saved Daily Brief v1 task IDs or full path/text/line locators, plus optional
Step ID/text, are interpreted by `resolveSavedTarget`. Existing IDs follow indexed
moves; source/Step validation prevents arbitrary title fallback. Completion,
future-start, active Project/Resource eligibility and Oath `canOpen` checks remain
in their original consumer/domain paths. Saved artifacts are returned before
live discovery and are not recalculated or migrated. Wizard reports/completion
history, activity and historical configurations remain authoritative; the narrower
facade history DTO is not substituted for that evidence.

### Async and lifecycle design

`TaskReadSession` caches only transient read promises/results per consumer and
generation. It owns one facade subscription and retries invalidated pending
generations. It is not task authority or a second persistent index. All consumers
share the existing facade/adapter, which keeps one underlying task-data watcher.
Daily Brief creates its session lazily; production developer-only visibility and
startup guards in `plugin.js` remain byte-identical. Availability tokens discard
old/day/disposed reads. Provider loading checks index generation, local 06:00 day,
Oath/readiness, activation and disposal before saving. An additional check after
the existing store queue await prevents stale work from starting a snapshot save.
The existing snapshot/shown-day save/rollback code and schema are unchanged.

Schedule has per-component generations for refresh, mode/rail changes, disposal
and immediate writer reconciliation. A pending read cannot undo a newer legacy
edit while waiting for Dataview import. Mode/date changes retain current controls,
focus and render state; loading adds only `aria-busy`. Closed/disconnected roots
ignore results/rejections. Existing non-task layout/label/planning listeners stay
in place. All sessions close only owned resources. Legacy notifications retain
invalidation semantics, without claiming atomic task/history commits.

No approved enumeration/target read was deferred. Existing editor/creator reads
inside writer flows, non-task folder/location lookup, rename/history navigation,
Wizard historical evidence, Oath's own task reads and Tasks panel/Roadmap reads
remain on their established services. Those are preserved boundaries, not hidden
fallbacks for the migrated reads.

## Behavioral comparison

| Area | Previous behavior | New behavior | Verification evidence |
| --- | --- | --- | --- |
| Daily Brief candidates | Global indexed candidates; active Projects/all four Resources subject to existing availability and permissions | Same semantic evidence for healthy sources; source-checked eligibility | Five original context/recommendation captures; `daily-brief-facade.test.js`; shared/ownership regressions |
| Daily Brief target resolution | Oath raw enumeration plus source snapshot and Step checks | Facade saved-v1 compatibility and fresh source/Step checks, same consumer restrictions/fallback | Existing navigation, snapshot and configuration tests; moved/missing/ambiguous/ID-less structured tests |
| Daily Brief date boundaries | Local 06:00 day, Stockholm DST, date-only/midnight/future rules | Same domain selectors, unchanged date data | Original boundary captures, controlled 05:59→06:00 pending-provider test, existing day/DST suites |
| Daily Brief saved snapshots | Version-1 bounded facts and persisted target; manual/auto separation | Unchanged schema/data interpretation; live read bypass on saved artifact | Existing snapshot/restart/persistence tests, new no-query/no-rewrite assertion, footer browser |
| Schedule task inclusion | Project-only recursive workspace filter; Resource early return; System/Templates/hidden exclusions | Same workspace policy/owner semantics, no mounts | Exact original task/group/calendar fixture; actual old/new renderer comparison; Resource browser check |
| Schedule grouping/order | Existing Overview buckets and Month/Week day grouping, counts/tie-breaks | Same functions/renderers/controls | Exact DOM/date/control snapshots across views and previous/next/today navigation |
| Schedule date/time behavior | Start/due/combined/ranges, optional time, explicit midnight, overdue/completed/unscheduled, Phase labels | Same metadata/endpoints and presentation | Fixture has start-only, due-only, same-day, month/year ranges and Phase; domain/date/task-workspace regressions |
| Schedule navigation | Existing source callback/workspace route | Fresh validated legacy reveal then same callback | Actual location click, source/identity tests, unsupported/missing/ambiguous guards |
| Schedule task writes | Legacy task/Step/edit/create services | Same writers with explicit fresh legacy references | Exact direct-vs-bridged source/history/check effects, actual completion/create-dialog browser, writer regressions |
| Search | Phase 2B-2A facade/display/reveal integration | Source/UI modules unchanged | All 23 integration tests, existing Search test, 21 browser checks; identical generated Search factories |

Intentional safety differences are restricted to problematic data and races:
unvalidated candidates cannot become actionable recommendations; ambiguous/stale
actions fail safely; obsolete async reads cannot save/publish old state. Healthy
selection, ranking, visibility, labels and UI are preserved. Daily Brief retains
its existing broad global discovery, including locations that Schedule excludes;
this migration does not silently harmonize those different policies.

## Executed checks

| Check | Result | Preserved evidence log |
| --- | --- | --- |
| New read-consumer tests | 21 pass: eight Daily Brief, four Schedule, nine structured/session/source tests | `focused-complete.out.log`, `structured-shutdown-final.out.log` |
| Phase 2B-1 facade suite | 42 pass | `focused-complete.out.log` |
| Search integration suite | 23 pass | `focused-complete.out.log` |
| Combined focused run | 89 pass, including three existing Daily Brief compatibility files; no failures/skips/cancellations | `focused-complete.out.log` |
| Existing regressions | 28 test files pass | `regressions.out.log`; last source-boundary changes also rerun the affected compatibility files in focused run |
| Phase 2A | 66 pass, including transactional JSON/process interruption in disposable OS-temp directories | `core.out.log` |
| TypeScript declarations | Both checks pass, TypeScript 6.0.3, zero diagnostics | `facade-types-final.out.log`, `core-types-final.out.log` |
| Actual Schedule browser | 22 checks pass, 1280×1000 | `schedule-browser-verified.out.log` |
| Daily Brief footer/service/browser | Pass: modal/artifact consistency, geometry, keyboard/focus, Oath, manual/auto/history/day behavior | `daily-browser-verified.out.log` |
| Search browser | 21 checks pass, 1100×850 | `search-browser.out.log` |
| Installed bundle | Plugin-load plus two boundary/import tests pass, without onload/reload | `installed-load.out.log` |
| Source/build comparison | 159 modules: four old modules changed, three helpers added, 152 old modules identical | `candidate-final-build.out.log`, `candidate-final-check.out.log` |

The 28 regression files were `tasks`, `task-mutations`, `task-data`, `task-planning`,
`task-progress`, `task-history`, `task-creation-retry`, `task-created-completion`,
`task-association-removal`, `task-composer-routing`, `task-form`,
`task-date-presentation`, `project-planning`, `roadmap-milestones`,
`shared-projects.integration`, `data-store.integration`, `inbox`, `oath`,
`oath-workspace`, `oath-shared-resources`, `workspace-state.integration`,
`statistics`, `context-search`, `daily-brief`, `daily-brief-navigation`,
`daily-brief-snapshot`, `daily-brief-configuration` and `task-workspace`, each
with `.test.js` suffix. Simulated store-conflict and missing navigation-method
messages also occurred in the pre-edit baseline and are expected fixture output.

Browser race tests use deferred promises, mutation observation and the existing
Markdown/frame lifecycle, not assumed time delays. They cover Project A/B,
view/date changes during reads, indexed invalidation, an unchanged writer while
a read is pending, rename/delete, rejected work after close and repeated disposal.
Snapshots/counters cover zero writes during reading/rendering; separate action
tests deliberately mutate isolated Maps and verify exactly-once effects.
Screenshots were inspected. Runtime was installed VS Code Node 24.21.0;
controlled date suites/benchmarks used `TZ=Europe/Stockholm`. No dependency install.

### Failed and unexecuted checks

The full existing `task-workspace.html` fixture **does not pass**. Initially its
old static loader failed on missing `ui/task-live-form`; after dependency repair,
it fails “Mode separator aligns with Files divider”. The exact same assertion
fails with the captured original renderer in `task-workspace-before.html` at the
same viewport. This is an inherited layout failure, not a read-integration
regression. The assertion was retained; its later assertions are not counted as
executed. Targeted actual Schedule coverage passes independently beyond that
failure. No unrelated layout/style fix was made.

The installed build has not been loaded in the user's running Obsidian session.
No real-vault task action/navigation was used for testing. Mobile and other
viewports, the standalone Daily Brief presentation fixture and full unrelated
browser suites were not run. No native backend, Tasks panel or Roadmap migration
was executed. Earlier failing development runs are retained with their logs;
final scoped checks above pass.

## Performance

Single comparative synthetic runs, milliseconds, ten tasks per note. Old Daily
Brief executes the captured pre-edit source; Schedule compares the actual old
workspace reader with the new structured/session path. Cached Daily Brief means
three complete context builds; cached Schedule means 20 retained-result reads.
These are in-memory source fixtures, not production disk/Obsidian latency claims.

| Daily Brief tasks | Initial old/new | Cached mean old/new | After invalidation old/new |
| --- | --- | --- | --- |
| 100 | 2.705 / 6.104 | 0.786 / 0.284 | 0.537 / 2.023 |
| 1,000 | 5.030 / 16.637 | 3.981 / 1.169 | 3.624 / 14.456 |
| 5,000 | 22.696 / 73.180 | 20.041 / 6.259 | 16.778 / 66.928 |

| Schedule tasks | Initial old/new | Cached mean old/new | After invalidation old/new | Three view changes old/new |
| --- | --- | --- | --- | --- |
| 100 | 0.471 / 1.085 | 0.001 / <0.001 | 0.355 / 1.046 | 4.919 / 0.535 |
| 1,000 | 2.724 / 6.837 | <0.001 / 0.001 | 2.991 / 8.645 | 4.650 / 3.460 |
| 5,000 | 12.774 / 33.459 | <0.001 / 0.001 | 11.102 / 29.962 | 18.088 / 17.874 |

All cold paths use one global index scan. Source-checked Daily Brief reads
10/100/500 source notes respectively, once each, versus zero for the old indexed
discovery. Cached new discovery adds zero source reads/index scans; old Daily
Brief scans again on each context refresh. Schedule cold/invalidation paths
read zero task sources, and cached view/date changes add no reads/scans. Writes
are zero throughout. One invalidation adds one new index scan per active read
session, rather than one scan per task. Raw counters are in
`read-benchmark-final.out.log`.

Cold enumeration is slower: at 5,000 tasks about 20.7 ms extra for Schedule and
50.5 ms extra for Daily Brief's new source checks. That cost is explicit and
cached; Schedule navigation remains comparable, and no strict per-task global
scan loop was introduced. Disk latency is unmeasured. Source text is reused per
note, but the existing parser still checks each parent separately; unusually
dense single-note datasets were not benchmarked. No source/index/history read
claims transactionally atomic freshness; actions perform fresh validation and
accepted legacy writes/persistence keep their existing commit behavior.

## Safety and installation

Durable originals/evidence:
`System/Backups/itacan-phase2b2b-20261016-af9cd477/` relative to the vault.
It contains `before/` originals, baseline/hash/status records, staged/original
builds, installation record, logs, screenshots and final safety results. A
separate uniquely named OS-temp working audit is recorded in `installation.json`.
Backups are code rollback inputs; never restore old application-managed data
over current user state.

The initial baseline captured 789 targeted existing files and 190 Git-status
entries. A supplemental no-ignore scan covered 169 private Markdown files;
every one also matched the independently preserved Phase 2B-2A pre-edit hash.
The combined safety comparison covers 958 files. The implementation allowlist
contains only the 15 modified pre-existing files above and 18 new phase files.
Real task Markdown, local/shared task metadata, history, saved Daily Brief data,
settings, Project/Resource definitions, Oath state and Phase 2A code were not
written. Their recorded hashes are checked; no native manifest, generation,
recovery or writer-lock file was created in the vault. All initial Git-status
entries are retained. No reset, clean, rebase or commit was issued.

`plugin.js`, Search source/UI, all date/recommendation/task-card/domain modules,
the existing editor/mutation/planning/Oath/Inbox/shared-store writers and the
facade's old strict methods are unchanged. New code only adds the documented
read/compatibility guards. Existing Git allowlists, partitions/conflict rules and
private Resource ownership were not changed. `.obsidian/workspace.json` was only
observed, never written/restored; any application-managed change is listed
separately in `safety-final.json` and excluded from implementation changes.

The final audit passed across all 958 files: exactly 15 expected pre-existing
implementation files changed, all 190 initial Git-status entries remain, all
original backups match, no unexpected file/status change occurred, and no
native storage file exists. No unrelated application-managed change was detected
in this phase, including `.obsidian/workspace.json`.

The initial 156-module source build exactly matched the installed Phase 2B-2A
bundle. Before replacement, the installed hash was rechecked and its durable
backup verified. Only `main.js` was replaced after the scoped checks passed.
The final candidate contains four changed existing factories and three new read
helpers; 152 existing factories, including `plugin.js` and Search, are identical.
Strict legacy writes and snapshot/shown-day save/rollback fragments were compared
directly. Staged `atlas-native.cjs` and `strict-oath-assets.json` match baseline
and were not copied over installed assets.

```text
Original main.js  EC222A54DB38383CCBDFF76A228E110E80493C805F77E393FDCD8045DCB135DE
Installed main.js 197F008B40F13FF48435F59C78451D15D566099C327EFBA24167EFDF84295428
```

Installed hash matches the verified candidate. No plugin disable/enable, reload
or restart command was issued. **Manual reload is needed when the user is ready.**

## Handoff and stop

The precise proposed next scope is [Project/Resource Tasks panel reads and
Roadmap task reads](../services/TASK-SERVICE-PHASE-2B-2C.md). It identifies actual
read dependencies, panel/workspace policy differences, task-card evidence gaps,
legacy action/Phase assignment bridges, identity/async gates and browser tests,
and recommends separate panel and planning-picker passes.

**STOP AFTER PHASE 2B-2B — Phase 2B-2C is not implemented.**
