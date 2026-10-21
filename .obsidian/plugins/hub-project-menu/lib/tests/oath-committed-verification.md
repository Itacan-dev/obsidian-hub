# Phase 2B-2F-2 — committed Oath resolution and hydration

## Corrected blocker resolution

The earlier specification incorrectly limited awaitingIndex to IDs allocated by
take(). Six actual-original tests proved that a newly allocated ID and an ID
already present in source with a stale ID-less index can produce identical
post-enrollment evidence. The user's resume request explicitly corrected that
invariant. Both are now positive bridge cases; no allocation provenance is inferred.
The proposed enrollment-provenance patch was not applied.

The new shared-facade resolveOathWork operation consumes the existing current
enrollment/readNewWork map. It preserves path/line/normalized-text fallback, fresh
source ID proof, physical workspace validation and canonical retirement. It never
creates temporary evidence for recovered or arbitrary missing refs. Copies remain
unavailable; an indexed Step collision also blocks pending fallback.

take(), readNewWork(), map creation, enrollment validation, ID allocation,
source/metadata writers, fulfillment latches, persistence and Strict host methods
remain byte-identical. Normal identity/source decisions and both supported bridge
histories retain original behavior. The explicit read-safety improvements below
are disclosed separately.

## Audit and implementation inventory

Paths are relative to `.obsidian/plugins/hub-project-menu/`; original line numbers
and field/consumer responsibilities are in [the field audit](oath-committed-field-audit.md).

| Current source | Responsibility |
| --- | --- |
| lib/services/task-service.js:7 | One new read operation on the existing injected facade; no new backend |
| lib/services/task-service-contract.d.ts:84,86,92,98,101,162 | Saved refs, existing enrollment evidence, detached current parent/Step/metadata projection, diagnostics and typed operation |
| lib/services/task-service-legacy.js:124 | Input validation/copy, one existing global index read, dedicated legacy projection; every previous adapter API remains identical |
| lib/services/task-service-legacy-oath-committed.js:25,34,47 | Current committed registry/dashboard/root and global parent/Step identity context; includes completed parents and inactive Projects |
| Same helper :7,69,76,78 | Per-note source snapshot and parent/fence proof using existing recognizers/block boundaries; current stable ID selects current text/line |
| Same helper :81,88 | Physical dashboard/root ownership and original metadata overlay/current ordered Step hydration |
| Same helper :49,55,61 | Canonical acknowledgment, existing enrollment fallback and ambiguity diagnostics |
| lib/services/oath.js:190,197 | Lazy owned facade subscription after construction; independent cleanup without closing facade |
| Oath :202,212,229 | Facade-backed resolveWork, commitment/revision/sequence/scope publication guards, original serialized refresh queue with invalidation revision |
| Oath :241 | Original reconcile/activation/fulfillment sequence remains unchanged |
| Oath :280,348 | Original take/readNewWork and map creation remain authoritative and unchanged |
| Oath :255,260,359,373 | Original fulfillment latch, persistent fulfillment, outcomes/history and exit guards remain unchanged |
| Oath :397,404,422,432 | Local projection and Standard/Strict policies unchanged; destruction additionally releases only the owned read subscription |
| lib/ui/oath.js, lib/ui/oath-tasks.js | Entire original production UI factories unchanged |

Original source and six active/pinned/status DOM states were frozen before
production integration. The 32-test separation gate passed before switching
resolveWork. Raw Dataview children/links, TFile, source blocks and editor tokens
are excluded from the portable projection. Existing UI/action consumers receive
the necessary primitive legacy source/Step/metadata fields. Optional enrollment
metadata overlay behavior is compared explicitly, including metadata removal.

Intentionally retained direct legacy operations are tasks/workspaceTasks/setup
requirements/validateDraft for final enrollment validation, take's queued source
writes and IDs, readNewWork's immediate post-write hydration, all task completion
and Oath writers, and Strict host/recovery. No native write/storage implementation
was added. The new committed read itself is explicitly legacy-backed.

## Original/new behavior

| Area | Original behavior | New behavior | Verification |
| --- | --- | --- | --- |
| Persisted identity | Stable parent ID | Preserved | Frozen refs and actual writer comparisons |
| Saved path/text | Historical snapshots | Preserved | Rename/title/line/source move tests |
| Current title/source | Unique current ID | Preserved | Frozen source cases and actual UI |
| Global copied IDs | Global parent/Step conflicts | Preserved | Same-note/outside/Project/Resource/Step copies; copy removal |
| Fresh source proof | Required | Preserved, with stricter parent/fence proof | Source missing/changed/copied tests |
| Physical workspace | Dashboard or committed recursive root | Preserved | All owner families, status/root changes and mount boundaries |
| Completed parents | Resolvable | Preserved | Completion/reopen/fulfilled UI and source tests |
| Nested Steps | Current ordered source evidence | Preserved | Original projection, progress and full workflow |
| Missing work | Retained ref/null task | Preserved | Ordering, query failure/recovery and UI |
| New-ID bridge | Current enrollment map | Preserved | Actual original/current take/readNewWork/import |
| Source-existing stale-index ID | Current enrollment map | Preserved | Actual original/current two-history tests |
| Arbitrary recovered missing ID | No bridge | Unsupported | Six original tests and committed API tests |
| take/readNewWork | Existing writer/hydration | Byte-identical | Entire protected-method comparison and bundle gate |
| Exactly-once fulfillment | Existing pending latch/outcome guard | Unchanged | Failed save/reopen/retry/end and deferred completion |
| Standard/Strict lifecycle | Existing policy/recovery | Unchanged | Full workflow, lifecycle parity and safe mock-host suites |
| Clock/read separation | Ordinary ticks do not scan | Preserved | 100-tick assertions and benchmarks |
| Active/pinned UI | Existing renderer | Identical for equivalent valid data | Actual DOM/attributes/rectangles, focus/scroll and deferred UI |
| Oath candidates | Separate indexed setup policy | Byte-identical | 116 browser checks and prior focused tests |
| Previous consumers | Existing facade integrations | Byte-identical factories | All previous focused checks and consumer browsers |

## Explicit read-safety improvements

- A stale indexed parent whose current source is now a Step or fenced example is
  unavailable. The old ID-line lookup could hydrate it. The new check reuses
  taskLineDetails/taskBlockEnd and analyzes each source note once per batch.
- A pending parent ID already present on an indexed Step cannot use fallback.
  The old fallback could overlook that conflict when no indexed parent had the ID.
- Source movement during validation and obsolete commitment/scope/generation
  results cannot publish; late read failures after disposal are ignored.
- Repeated start owns one clock/subscription. Candidate and active listeners share
  the facade's one backend watcher, and dispose independently.

These checks do not allocate IDs, modify source, change persisted commitment
formats, change candidate eligibility or alter fulfillment/recovery writers.
The guarded async publication preserves immediate local completion and its latch.

## Executed verification

- Six original-source separation tests reran unchanged before production edits.
- 119 new focused checks: 32 separation comparisons, 66 committed contract/source/
  writer/owner checks and 21 lifecycle/race comparisons. Together with all 333
  previous facade-focused checks: **452 checks**.
- All 34 previous regression files; safe Strict/recovery suites contain 48 checks.
  Both TypeScript 6.0.3 declaration checks report zero diagnostics. All 66 inactive
  native-core tests executed. Hosts, windows and native recovery APIs are mocked;
  physical desktop enforcement was not activated or claimed.
- 88 actual active Oath browser checks: original/current Standard/scheduled/Strict
  display/fulfilled/title-change/missing states; pinned rows, source text, Steps,
  counts, read-only status rows, DOM/attributes/rectangles, keyboard focus, scroll,
  timer separation, listener cleanup and immutable original capture comparison.
  Deferred completion remains visible while an old incomplete read is pending;
  fulfillment persists once; query failure/recovery and late disposal are covered.
- The previous 116 candidate browser checks, full Oath workflow and Oath focus/
  picker tests executed. The workflow covers setup/review, actual task/Step
  completion, pinned feedback, task/time fulfillment, schedules and exit behavior.
- Previous consumer browsers executed: History read 79, Statistics read 99, Home
  read 27, Search 21, Schedule 22, eight Project/Resource Tasks panels, Phase editor
  38, shared task workflows 64, Daily Brief control, Statistics, Progress navigation,
  Step progress, Home/workspace task actions, History pagination/Markdown/metadata
  93 Phase C interactions and 591 configured-feedback/tooltip checks using the
  retained native CSS fixture. No historical passes substitute for these runs.
- Candidate bundle factory comparison: 166 to 167 modules; exactly Oath, facade
  dispatch and legacy adapter changed; one committed helper added; 163 existing
  factories identical. Native/Strict auxiliary artifacts identical. Existing adapter
  queries/writers and every protected Oath method are compared byte-for-byte.

Final pass counts and installation status are recorded in the durable logs and
manifests. No test that stopped early is represented as passing later assertions.

## Performance

Node 24.21.0, Windows, Europe/Stockholm; Map-backed synthetic workloads with nested
Steps, completed parents, copied IDs, moved source and missing commitments. Counts
are 101/1,001/5,001 indexed parents (including the intentional outside copy), with
1/10/50 commitments. Seven-sample medians; cold/startup use fresh fixture lifetimes.
Both implementations reread fresh source for every batch; there is no misleading
cached-facade versus cold-original comparison.

Initial unforced runs showed allocation/GC variation, including a 5,000/10 cold
outlier. A retained controlled run uses --expose-gc with collection before each
timed sample, outside the measured interval, for both implementations. It shows
comparable growth and no unresolved material regression. These synthetic timings
do not establish live Obsidian latency.

| Indexed parents / commitments | Cold old/new ms | Repeated fresh old/new ms | Invalidated old/new ms | Startup old/new ms |
| --- | --- | --- | --- | --- |
| ~100 / 1 | 0.465 / 0.521 | 0.479 / 0.552 | 0.479 / 0.549 | 0.592 / 0.625 |
| ~100 / 10 | 0.571 / 0.637 | 0.504 / 0.544 | 0.535 / 0.584 | 0.684 / 0.708 |
| ~100 / 50 | 1.145 / 1.050 | 0.983 / 0.997 | 1.021 / 1.055 | 1.192 / 1.198 |
| ~1,000 / 1 | 2.619 / 2.910 | 2.715 / 2.748 | 2.711 / 2.802 | 2.782 / 2.920 |
| ~1,000 / 10 | 2.763 / 3.016 | 2.752 / 2.997 | 2.786 / 3.035 | 3.018 / 3.168 |
| ~1,000 / 50 | 3.679 / 3.534 | 3.459 / 3.537 | 3.585 / 3.479 | 3.839 / 3.670 |
| ~5,000 / 1 | 23.347 / 25.603 | 23.997 / 26.008 | 24.108 / 25.612 | 24.288 / 27.188 |
| ~5,000 / 10 | 26.802 / 26.707 | 24.401 / 27.284 | 25.765 / 27.389 | 25.614 / 27.277 |
| ~5,000 / 50 | 30.374 / 29.297 | 30.354 / 30.423 | 29.488 / 29.233 | 33.281 / 30.760 |

One Dataview enumeration per batch for both; one TaskData global identity pass
plus one committed lookup pass for current. Source reads are 1/1/5 for the three
commitment counts, once per affected note. Workspace checks preserve original
per-resolved-parent checks plus two consumer publication-scope checks. Ordinary
countdown adds zero index/source reads. Due scheduled activation retains its
original read behavior. Invalidated-read and exact counter measurements are in
benchmark-reviewed.json. Both bridge histories use one scan/one source read;
new-ID old/new medians 0.238/0.415ms and source-existing 0.164/0.411ms.

## Failures, limits and verification boundaries

The inherited divider assertion still fails in task-workspace-before and
task-workspace; standalone history-heading still fails its existing icon-size
assertion. All three were rerun unchanged; subsequent assertions in those fixtures
are not counted. No unrelated visual repair was made.

During fixture development, the new browser host first had a duplicate declaration
and an inappropriate initial-clock assumption; those host errors were corrected.
An intermediate frozen JSON serialization used PowerShell's default encoding and
was regenerated directly from the retained original UTF-8 capture. No original
DOM evidence or assertion was replaced with current production output. The first
regression run exposed a legacy Oath without workspace data; nullable unavailable
workspace evidence restored the original invalidation path, with a regression test.

No live Obsidian test, real Strict lock, reload, restart, plugin toggle or native
authority activation occurred. The legacy backend has no atomic repository
revision; generation guards cover received invalidations/local changes and source
movement, not an invented cross-vault atomic snapshot. Source/cold timing is
synthetic. Portable work excludes unused raw Dataview/source-block details.

## Safety and installation

Installation status: INSTALLED AND VERIFIED. Only main.js was copied. Candidate,
independent final source build, durable reviewed copy and installed bundle match:

`318CD234980489C514E1C1085DF2D95FEBFEF64284D0293BC566493B4B28DB20`

Installed smoke and the plugin-load check pass without invoking onload or reading
the live vault. The final inventory verifies 16 original backups, 11 approved
existing-file changes (including main.js), 19 new phase files, all 308 original
Git entries retained, no introduced whitespace errors and no native persistence
artifacts. All 1,083 baseline files are accounted for; the only additional changed
file is application-managed .obsidian/workspace.json, recorded separately without
restoration. No real task/Oath data or settings were changed.

Durable originals, reviewed bundle, request, builds, frozen facts, logs, screenshots,
performance output and manifests are retained in
`System/Backups/itacan-phase2b2f2-resume-20261016-71ab9dda/`.

Fresh baseline: 1,083 files and 308 initial Git status entries; original backups
are independently SHA256-verified. Real task Markdown, task metadata, current/
historical Oaths, Strict settings/whitelists, shared Projects, Resources/mounts,
Progress/Statistics providers and saved Brief data are protected by hash checks.
Application-managed workspace changes are recorded separately and never restored.

Only reviewed main.js is eligible for installation. Unchanged native/Strict assets,
data and dashboards are not copied. The final manifest records exact candidate,
source-build and installed hashes, reviewed inputs and verified originals. Native
storage remains inactive. No ID is allocated by committed reads.

Manual reload is required to activate the installed bundle and is left entirely
to the user. No automatic reload, restart, disable/enable, real Oath activation or
live hydration was performed.

The [consolidated Phase 2B audit handoff](../services/TASK-SERVICE-PHASE-2B-CONSOLIDATED-AUDIT.md)
is prepared for a separate review. That audit, native writers/persistence, Git
synchronization, History migration and task-location work have not begun.

**STOP FOR REVIEW — Phase 2B-2F-2 only.**
