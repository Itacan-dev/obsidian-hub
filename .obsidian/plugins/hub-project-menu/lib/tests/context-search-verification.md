# Phase 2B-2A completion and verification — 2026-10-16

Search task enumeration and task reveal now use one explicitly legacy-backed
Task Service. The verified `main.js` is installed. Obsidian was not reloaded or
restarted; a manual plugin/app reload is needed to load this build. Native
authority remains inactive. Phase 2B-2B has not been implemented.

The request was read as Sections 1–12 in attachment `c46cbdf9-5aa5-4d4f-b74d-12705468db3a`
plus the complete Sections 13–31 in `dc77d681-e325-41f8-b8ce-2e694193a458`, ending
with **STOP FOR REVIEW**. Completed work was retained when execution resumed.

## Implementation and file inventory

Paths below are relative to `.obsidian/plugins/hub-project-menu/`. Line references
refer to source, not generated bundle offsets. No existing task writer or native
core file was changed in this phase.

| Modified pre-existing file | Change and source reference |
| --- | --- |
| [`plugin.js:12750`](../../plugin.js#L12750) | One lifecycle insertion creates the legacy service immediately before the existing Search service. |
| [`lib/services/task-service-contract.d.ts:33`](../services/task-service-contract.d.ts#L33) | Adds `TaskDisplayView`, per-row/query diagnostics, row states and `TaskDisplayQuery`; `queryDisplay():78` is separate from strict DTO queries. |
| [`lib/services/task-service.js:7`](../services/task-service.js#L7) | Adds dispatch for `queryDisplay`; single-backend selection and all mutation dispatch remain unchanged. |
| [`lib/services/task-service-legacy.js:49`](../services/task-service-legacy.js#L49) | Lazy Dataview resolution/readiness errors and tolerant display enumeration. Existing strict query, source validation, reveal and write implementations remain intact. |
| [`lib/services/task-data.js:11`](../services/task-data.js#L11) | Opt-in row-error hook for normalization, malformed children/cycles and metadata failures; `readPages():86` retains the default strict path for every other caller. |
| [`lib/services/context-search.js:17`](../services/context-search.js#L17) | Shared facade injection, facade subscription, async generation cache (`:75`), explicit legacy display mapping (`:99`), preserved ranking/scopes (`:136`), validated reveal (`:206`). |
| [`lib/ui/context-search.js:7`](../ui/context-search.js#L7) | Normalized due/completion rendering, disabled-row feedback, async loading/selection preservation (`:78`), generation/scope/focus/close/disposal guards; existing markup/classes/icons and 100 ms input debounce retained. |
| [`lib/tests/context-search.test.js:44`](context-search.test.js#L44) | Injects the facade rather than raw task data. Retains existing ranking/scope/navigation assertions; replaces raw task-object identity with portable handle identity. |
| [`lib/tests/task-service-boundary.test.js:6`](task-service-boundary.test.js#L6) | Updates the inactive-facade assertion to Search-only integration; checks actual source graph, installed bundle and untouched consumers. Native core/platform isolation assertions retained. |
| [`lib/tests/task-service-types.fixture.ts:8`](task-service-types.fixture.ts#L8) | Checks typed display queries, readonly service result and absence of source/UI file objects. |
| [`lib/services/TASK-SERVICE.md:3`](../services/TASK-SERVICE.md#L3) | Adds current-phase pointer; preserves the historical Phase 2B-1 record. |
| [`lib/services/TASK-SERVICE-PHASE-2B-2.md:3`](../services/TASK-SERVICE-PHASE-2B-2.md#L3) | Marks the old handoff historical and links this report and the unimplemented next scope. |
| [`main.js:1`](../../main.js#L1) | Installs the reviewed generated bundle only; no other installed asset replaced. |

| New file | Purpose |
| --- | --- |
| [`lib/services/task-service-host.js:5`](../services/task-service-host.js#L5) | Explicit `TaskService(new LegacyTaskAdapter(...))`, lazy plugin Dataview API and owned shutdown. |
| [`lib/services/task-service-legacy-display.js:8`](../services/task-service-legacy-display.js#L8) | Detached, query-scoped display projection and identity/locator diagnostics, with no source reads or writes. |
| [`lib/tests/context-search-fixture.cjs:13`](context-search-fixture.cjs#L13) | Synthetic actual task-data/editor/adapter/facade environment, counters, state snapshots, all four Resources and both shared Projects. |
| [`lib/tests/context-search-record-baseline.cjs:1`](context-search-record-baseline.cjs#L1) | Explicit one-shot old Search baseline capture; refuses overwrite. |
| [`lib/tests/context-search-parity.json:1`](context-search-parity.json#L1) | 18 captured result sets from actual Search before production edits, including original reveal call. |
| [`lib/tests/context-search-extra-baseline.cjs:1`](context-search-extra-baseline.cjs#L1) | Compiles the backed-up original Search source for supplemental identical-fixture captures; refuses overwrite. |
| [`lib/tests/context-search-extra-parity.json:1`](context-search-extra-parity.json#L1) | Seven supplemental old-source captures for mixed categories, copies, importance/Phase and moved/deleted notes. |
| [`lib/tests/context-search-facade.test.js:21`](context-search-facade.test.js#L21) | 23 focused tests for exact baseline parity, diagnostics, read-only safety, source reveal and lifecycle/races. |
| [`lib/tests/context-search.html:1`](context-search.html#L1) | Supported browser fixture loading actual production Search UI/service and the legacy facade; synthetic app boundary only. |
| [`lib/tests/context-search-benchmark.cjs:19`](context-search-benchmark.cjs#L19) | Original-source/new-source enumeration, caching, invalidation and search measurements at 100/1,000/5,000 tasks. |
| [`lib/tests/context-search-build-check.cjs:1`](context-search-build-check.cjs#L1) | Compares every module factory with the baseline bundle without running plugin startup; verifies the precise change allowlist and other generated assets. |
| [`lib/services/TASK-SERVICE-PHASE-2B-2B.md:1`](../services/TASK-SERVICE-PHASE-2B-2B.md#L1) | Exact Daily Brief/read-only Schedule handoff, evidence gaps, legacy writer bridges and verification gates. |
| [`lib/tests/context-search-verification.md:1`](context-search-verification.md#L1) | This completion report. |

### Read contract, diagnostics and text

The existing strict `TaskDTO`, edit tokens and operations retain their semantics.
The new readonly display query is explicitly `legacy-index` consistency, not a
source-validated edit or committed native record. `TaskDisplayView` contains a
nullable handle, canonical first-line title, completion, stable physical owner,
due endpoint, metadata description and explicitly tagged indexed source/text
evidence. It contains no Dataview/file/DOM objects or source blocks.

`compatibility.displayText/searchText` preserve the task-data service's full
normalized Dataview `task.text`, including continuations. The canonical title
stays first-line; metadata description stays separate. Step and nested-Step text
are not appended to parent matches; surrounding Markdown still matches through
the unchanged note-content path. No title or description is rewritten.

Rows distinguish indexed, ambiguous, unresolved and invalid data (`resolved` is
reserved by the type). Copied parent/Step IDs and duplicate ID-less source titles
remain displayable when trustworthy text exists, but `edit:false` and
`attemptReveal:false` block unsafe action. Parent identity conflicts do not expose
another task's metadata. A missing source or failed metadata record retains
safe indexed text with diagnostics. A record with no trustworthy text/locator
can have a null view and an explicit conversion/index failure. Query-level index
failures reject with typed errors; non-task Search results remain available.

Diagnostics carry row/query level, code, optional source path, row index and
logging-only detail. The UI maps failures to friendly messages rather than
showing technical exceptions. Query-local ID/title maps supplement existing
task-data conflict accounting; there is no persistent second task index.

### Async, subscriptions and navigation

One cached promise/projection per task generation coalesces concurrent searches.
Invalidation increments the generation, so an outstanding old read is retried
or discarded before publication. Mapped Search rows are cached for that
projection and file-registry identity; keystrokes do not rebuild all rows.
Failures are handled and can be retried by later requests. Search UI tokens
also guard query, scope, focus, close and component disposal. Note workers check
generation between reads. The previous synchronous `snapshot(dv)` had no other
production caller; Search and its tests now await it explicitly.

The plugin owns one legacy facade. Search owns one facade subscription, backed
by the existing task-data subscription machinery. UI surfaces subscribe to the
Search service and dispose their own callbacks. File/note/folder/label/planning
listeners remain on their existing services. A facade-only invalidation leaves
file/note caches intact. No raw filesystem watcher was added. Notifications mean
invalidation requiring a requery, not an atomic task/history commit.

Task activation passes only the portable handle to `resolveReveal`. The existing
adapter rechecks the current global index and source snapshot, including Step
identity ambiguity, before returning a `legacy-source` target. Search then uses
the existing `openProjectNote(path, "replace", source)` route. The baseline
opened the note without line positioning; that behavior is preserved. Denied
navigation remains denied. Missing/stale/copied references fail safely; no
title fallback or synthetic note is created. Native reveal variants remain
explicitly unsupported in Search. Disposal during reveal prevents late opening.

## Behavioral comparison

| Area | Previous behavior | New behavior | Verified? |
| --- | --- | --- | --- |
| Search result inclusion | Raw normalized indexed parent tasks plus established non-task categories | Same safe display inclusion | Exact equality against 18 initial + seven supplemental original-source result sets (`context-search-facade.test.js:21`, `:260`) |
| Searchable text | Full normalized Dataview text, including continuations; metadata description and separate Steps not concatenated | Same compatibility text, separate canonical title/description | Exact text/rank captures, continuation/description test `:34`, nested Steps `:274`, browser |
| Ranking | Existing name/context scores, task offset, category/order rules | Same scoring/grouping functions | Baselines compare score, rank and final order; original Search test retained |
| Workspace scopes | Physical owner, all four Resources, inactive Projects, both shared Projects; no mount expansion | Stable normalized owner checked against unchanged registry/policy | Scoped/global/alias captures; simultaneous Project/Resource searches `:287` |
| Task reveal | Open result source path through established note navigation | Resolve and validate handle first, then same note route | Original valid reveal call equals new call; copied/stale/moved/deleted/denied/native/close tests `:146`, `:158`, `:169` |
| Invalid records | Indexed copies could display; malformed indexing could suppress a whole read; task path open did not validate identity | Safe display retained, bad rows isolated, unsafe action blocked, friendly query status | Copied parent/Step/no-ID, broken locator/getter, missing source, malformed raw child/cycle and metadata tests `:46`, `:67`, `:75`, `:193`, `:209` |
| Cache invalidation | Direct task-data subscription plus file/note/planning listeners | Shared facade invalidation; task generation guards; existing non-task listeners retained | Cache reuse `:103`, A/B `:113`, scope/disposal `:127`, note race `:137`, rename/delete `:245`; browser close/debounce |
| File/folder/planning search | Established aliases, note contents, categories, scopes and navigation | Same mechanisms and handlers | Original assertions and mixed file/folder/task/Phase/milestone captures; task-query failure still returns non-task results (`:92`, `:220`) |

Intentional safety improvements: ambiguous/stale results cannot open an
arbitrary source; metadata/read failures are isolated where possible; async
queries cannot publish stale UI. These restrictions are tested separately from
display parity. There is no intentional scope, rank, title or layout redesign.

## Executed verification

All final checks below passed; no final failing, cancelled or skipped tests.
Counts overlap where an existing file appears in more than one run.

| Check | Final result | Evidence log in backup directory |
| --- | --- | --- |
| New Search facade tests | 23/23 | `focused-final.out.log` |
| Existing Search behavior and task-data indexing | Both files pass with behavioral assertions retained | `focused-final.out.log`, `regressions.out.log` |
| Phase 2B-1 focused suite | 42/42, including source/installed-bundle boundary tests | `installed-facade-final.out.log` (43 including plugin-load) |
| Existing plugin regressions | 24/24 test files | `regressions.out.log` |
| Installed plugin-load smoke | Pass | `installed-facade-final.out.log` |
| Phase 2A core | 66/66, memory and disposable JSON/process-failure tests | `core-final.out.log` |
| Facade declaration check | TypeScript 6.0.3, zero diagnostics | `facade-types-final.out.log` |
| Core declaration check | TypeScript 6.0.3, zero diagnostics | `core-types-final.out.log` |
| Supported Chrome browser harness | 21 checks pass at 1100×850 | `browser-final.out.log`, `context-search-verified.png` |
| Staged build/source comparison | 156 modules; 146 old modules unchanged, four old modules changed, six facade modules added, none removed | `candidate-build.out.log`, `candidate-check.out.log` |

The 24 regression files were: `tasks`, `task-mutations`, `task-data`,
`task-planning`, `task-progress`, `task-history`, `task-creation-retry`,
`task-created-completion`, `task-association-removal`, `task-composer-routing`,
`task-form`, `task-date-presentation`, `project-planning`, `roadmap-milestones`,
`shared-projects.integration`, `data-store.integration`, `inbox`, `oath`,
`oath-workspace`, `oath-shared-resources`, `workspace-state.integration`,
`statistics`, `context-search` and `daily-brief`, each with `.test.js` suffix.
The workspace persistence suite intentionally logs its simulated conflict
rejection and passes; it did not modify the user's plugin data.

Browser verification executes the actual production Search UI/service/facade
against an in-memory app boundary: continuation/date/completion rendering,
input focus, keyboard reveal, ambiguous feedback, out-of-order A/B reads,
scope changes, close/Escape, rapid debounce, failure messages and disposal.
Promise completion/DOM observation control races; sleeps do not establish
correctness. The final screenshot was inspected. Node tests also cover raw
malformed rows/children/cycles, metadata failure, rename/delete during a read,
index-import invalidation, throwing subscribers, service closure, concurrent
scopes and 20 subscribe/dispose cycles without extra watchers.

Runtime: installed VS Code Node 24.21.0 using `ELECTRON_RUN_AS_NODE=1`; compiler
already installed with VS Code. No dependencies were installed. The normal
`build.js --output-dir <disposable directory>` and
`run-browser-test.js context-search 1100x850` tools were used. The original
150-module disposable build matched the pre-install bundle exactly, protecting
existing local bundled work. The candidate comparison proves that removing the
one facade lifecycle insertion makes `plugin.js` identical to the original;
all task writer module factories remain identical. `atlas-native.cjs` and
`strict-oath-assets.json` match the original generated assets and were not copied
over the installed versions.

A repository-wide whitespace check reported existing whitespace and Windows
line-ending diagnostics. A separate before/after check of this phase's 26 files,
using disposable LF-normalized copies, found zero introduced whitespace issues
(`whitespace-final.json`). Existing unrelated files were not reformatted.

### Performance

Identical synthetic fixtures use ten tasks per note and the backed-up original
Search source versus current Search. Single-run wall times in ms, rounded to
three decimals; warm enumeration is the mean of 20 reads. Note data is in
memory. This is comparative synthetic evidence, not production latency.

| Tasks | Cold enumeration old/new | Cached enumeration old/new | Enumeration after invalidation old/new | Three cached full searches old/new |
| --- | --- | --- | --- | --- |
| 100 | 1.684 / 2.676 | 0.002 / 0.001 | 0.407 / 0.922 | 2.073 / 2.042 |
| 1,000 | 2.757 / 5.295 | <0.001 / <0.001 | 2.225 / 3.998 | 17.825 / 15.816 |
| 5,000 | 11.831 / 33.901 | <0.001 / 0.002 | 11.284 / 25.546 | 86.383 / 82.337 |

For both versions, each cold enumeration used one file registry read, one
Dataview index scan, zero task-source reads and zero writes. Invalidation added
one index scan. Cached queries added zero index scans and zero note reads.
The first full search after task-cache refresh (note cache cold) took old/new
5.752/1.166, 7.686/7.767 and 46.119/42.818 ms respectively. Treat small timings
as noisy, not evidence that the facade is faster. The new query performs more
normalization/diagnostic work during cold enumeration (about 22 ms extra at
5,000 tasks); repeated full searches remain comparable and reuse projections.

For comparison, unchanged strict facade `queryOwned` took 18.860 ms at 100 tasks
with 100 source reads/101 index scans, and 1,432.581 ms at 1,000 tasks with
1,000 source reads/1,001 scans. Search uses the display query, avoiding this
per-task source-validation loop. Final reveal still performs strong validation.
See `benchmark-final.out.log` for counts and all raw measurements.

### Limits and tests not executed

The new build has not been loaded inside the user's running Obsidian session.
The browser smoke uses real production modules with synthetic vault/Dataview
data, not the user's live vault. No real-vault navigation or edits were triggered.
Other screen sizes, mobile Obsidian and unrelated browser layout suites were
not run. Historical unrelated task-workspace layout failures were not rerun,
changed or counted as passing. No native/Search handler, migration, mounted task
visibility or next-phase consumer was implemented. Display evidence can be stale
until existing index invalidation arrives; `attemptReveal` is permission to try
fresh validation, not proof of current source validity. An entirely unavailable
index cannot supply task matches; non-task search remains usable. Untrustworthy
raw rows without usable text are diagnostic-only rather than fabricated results.

## Safety, backup and installation

Durable backup/evidence directory, relative to the vault:
`System/Backups/itacan-phase2b2a-20261016-f2ea9b83/`.
It contains `before/` originals, `baseline.json`, installation hashes, test/build/
performance logs, the screenshot and the final safety comparison. Original
working copies and staged builds are also retained in the uniquely named temp
directory recorded in `installation.json`. Do not restore application-managed
state over current user state; only the code/bundle backups are rollback inputs.

The baseline recorded 174 existing Git-status entries and 1,500 hash entries
(1,376 distinct normalized file paths). It included existing modified/untracked
work, task Markdown, plugin data/settings, `.obsidian/workspace.json`,
`System/Hub-shared-projects.json` and all Phase 2A files. Original contents of
every changed pre-existing source/test/doc and installed bundle were copied
before editing/replacement. Final comparison permits only the 13 pre-existing
files listed above, preserves all 174 initial Git-status entries and reports
new phase files separately. Git status uses `--untracked-files=all`, matching
the baseline rather than grouping the untracked core directory. Backup files are additional files under the existing
ignored `System/Backups` convention, not task-data changes.

Existing task Markdown, local task metadata/history, shared Project manifest/
task data and plugin settings remain hash-identical. The two
architecture notes were changed only to add current-status links; no existing
task note was changed. Every Phase 2A file remains hash-identical. No native
`CURRENT.json`, `WRITER.lock`, `RECOVERY.json` or generation file was created in
the vault. JSON persistence tests used disposable OS-temp directories only.
Search fixture snapshots/counters verify zero Markdown/metadata/history/task
state writes and no ID allocation or create/edit action. Shared partition,
conflict and ownership tests pass. No other task consumer was redirected.
An unrelated change to application-managed `.obsidian/workspace.json` was
detected during final comparison (original SHA-256
`6ECF92844CFBC0E2A636B5FE67C6C3AF4279BA4819FA41F5A8C83B7575F8919E`,
observed SHA-256 `771A72BF69BA60068436D27729479F8B17914D1285BC8C6C7E197B882AB03A71`).
This agent did not write or restore that file. Its current hash/timestamp are
recorded separately in `safety-final.json`; it is excluded from implementation
changes and code-backup requirements. No other unrelated baseline file changed.

Only `main.js` was installed after source, browser, regression, core, types and
candidate checks passed, with the original installed hash rechecked immediately
before replacement and its durable backup verified. Installed hash equals the
reviewed candidate:

```text
Original main.js  2B8424E1EC98478986FE00A79172B920525E4A4F07A9833C37AEB3BA48345812
Installed main.js EC222A54DB38383CCBDFF76A228E110E80493C805F77E393FDCD8045DCB135DE
```

No Git reset, clean, rebase or commit was issued. Obsidian was left running;
no reload, restart or plugin-disable/enable command was issued. **Manual reload
is needed when the user is ready to activate the installed build.**

## Next phase and stop

The precise proposed next scope is **Daily Brief task reads and read-only
Schedule data**, documented in [`TASK-SERVICE-PHASE-2B-2B.md`](../services/TASK-SERVICE-PHASE-2B-2B.md).
It identifies current reads, DTO/history gaps, safe navigation, async/lifecycle
requirements, legacy action bridges that remain unchanged and regression gates.
It does not authorize or implement that work.

**STOP FOR REVIEW — Phase 2B-2A only.**
