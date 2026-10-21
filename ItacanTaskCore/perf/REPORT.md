# Native task performance ? diagnostic results and review recommendation

2026-10-19, Europe/Stockholm. Profiling only; no optimization implemented.

## Finding

The scaling cost is chiefly repeated whole-generation validation and canonical
JSON work, amplified by repeated authoritative captures. A list/editor interaction
performs two captures and ten complete state validations. A fresh full completion
interaction performs five captures and 34 validations. The actual completion,
event creation and binding transition is below 1 ms in the measured sparse-history
cases; it is not a miniature rich Save. Both operations pay the larger repository
verification, cloning, receipt and publication costs around their transformations.

Content history is a second independent dimension. Repeated rich-task edits retain
content revision chains in task/receipt snapshots and revalidate them. Task count
alone therefore cannot explain all timings in the original benchmark.

The recommended first change is a **single authoritative scoped capture combining
status/context acquisition with the requested data**, preserving all existing
storage checks. Estimated warm list/editor reduction: about 45?55%. This is a
review proposal, not an implemented fast path. It will not alone meet every write
target. The exact proposed allowlist and safeguards appear below.

## Evidence, environment and boundaries

Track B's review ZIP seal `b92949afd0551d3616b4717654ed11a522e4126397080dc2cacc7aefa5146cd2`
and all 38 reviewed current files verified before this gate. Its original benchmark
and archived measurements were preserved unchanged. The fresh baseline hashed
1,697 workspace files before diagnostic implementation.

Environment: VS Code's Node runtime v24.21.0 (`ELECTRON_RUN_AS_NODE=1`), Windows 11
Enterprise build 26200, Intel i5-13600KF, 14 cores/20 logical processors, approximately
31.8 GiB visible physical memory. Exact versions, initial process memory, CPU/load
and free-memory observations are retained. The initial sampled machine CPU load
was 22%. Our benchmarks ran sequentially without concurrent regression suites;
other applications were not stopped and CPU affinity/frequency were not pinned.
This is not a completely idle or hardware-isolated laboratory measurement.

`README.md` records operation boundaries frozen before collection. The original
mutation timer includes the preceding editor read, draft preparation, authorization,
application/writer dispatch, actual transaction and coherent read-after-write. It
excludes a final browser list refresh and rendering. Its read timer includes a host
status refresh followed by another authoritative data capture. Process-cold open
starts after module loading; it is not total launch or physical disk-cache-cold time.

New probes independently measure actual native writer calls (capability already
granted; no editor fetch/application refresh), application calls (draft/capability
already supplied), complete backend interactions, HTTP, browser paint and startup.
No store, command, validator or publication algorithm was edited. External wrappers
run only in diagnostic children, preserving argument/receiver/result/error identities
and promise outcomes; they add chained promises and can affect scheduling. All
actual checks execute. Inclusive stage times overlap and must not be added.

## Reproduced unchanged benchmark

Historical Track B medians, preserved unchanged (milliseconds):

| Tasks | List | Editor | Save | Complete/reopen | Step insertion |
|---:|---:|---:|---:|---:|---:|
| 100 | 71 | 115 | 782 | 1,568 | 1,962 |
| 1,000 | 380 | 353 | 1,789 | 2,531 | 2,854 |
| 10,000 | 3,060 | 2,943 | 12,781 | 13,897 | 14,351 |

The following is the newly executed reproduction. Differences are run/workload
variation, not improvements from a code change.

Median / p95 milliseconds, original sample definition: list 20, editor/Save/
complete-reopen 10, Step insertion 5. The last p95 is only a five-sample upper-order
statistic. No new thresholds were used to declare success.

| Tasks | List | Editor | Save incl. editor | Complete/reopen incl. editor | Step insertion incl. editor |
|---:|---:|---:|---:|---:|---:|
| 100 | 51 / 53 | 49 / 52 | 769 / 956 | 1,315 / 1,699 | 1,765 / 2,057 |
| 1,000 | 353 / 365 | 337 / 340 | 1,804 / 2,332 | 2,230 / 2,452 | 2,703 / 2,994 |
| 10,000 | 3,054 / 3,418 | 3,060 / 3,244 | 12,323 / 13,590 | 6,648 / 9,624 | 13,754 / 14,584 |

The ~3-second 10,000-task read and multi-second write problem reproduces. These
writes progressively add receipts, events and content revisions; their samples
are not fixed-size repetitions. The complete/reopen series also shows substantial
variation. Original raw samples and repository locations are retained.

## Fixed-state probes

Every detailed sample copies a closed synthetic baseline into a separate verified
Temp child and opens it in a fresh process. Authority IDs are never replaced;
writer locks are never copied. Distinct children prevent the process-local
same-authority/different-root guard from being weakened. Each sample uses identical
initial identities/counts within its population. One rich four-level target is
added to the standard bulk distribution; this differs from the unchanged benchmark
and is not represented as a directly interchangeable experiment.

| Tasks | Steps | Events / receipts before sample | Current generation MiB | Repository MiB |
|---:|---:|---:|---:|---:|
| 100 | 14 | 1 / 2 | 0.15 | 0.29 |
| 1,000 | 104 | 1 / 2 | 1.37 | 2.74 |
| 10,000 | 1004 | 1 / 2 | 13.61 | 27.21 |

Each has one current content revision, seven synthetic registry owners, one physical
task owner, no recurrence/import namespace and no original Markdown envelopes.
Counts, sizes, memory and after-state growth accompany every sample. Rich creation
adds one task; the tree initializer creates its true initial parent/Step events.
Reopening uses an explicitly prepared completed state whose extra event/receipt
is recorded. No unrelated receipt/history is erased to accelerate a measured action.

### Independent native and application boundaries

Uninstrumented observations, milliseconds, **one sample per cell**. Native includes
writer admission/preflight and actual repository execution/publication. Application
adds intent translation/result handling and coherent refresh. Neither includes the
preceding editor fetch or capability grant. Rich-simple means actual `createRich`,
not bulk setup or ordinary `task.create`.

| Tasks | Complete native | Complete application | Save native | Save application | Rich-simple native | Rich-simple application |
|---:|---:|---:|---:|---:|---:|---:|
| 100 | 146 | 182 | 161 | 184 | 149 | 204 |
| 1000 | 384 | 489 | 377 | 471 | 376 | 469 |
| 10000 | 2,698 | 3,398 | 2,652 | 3,413 | 2,676 | 3,440 |

The original ~2.5-second 1,000-task completion is not 2.5 seconds inside its
transition helper. A fixed fresh full interaction was 822 ms uninstrumented;
standalone writer/application observations were 384/489 ms. Earlier benchmark
samples include different history/content growth and process lifetime. With 20
prior rich-task edits, a profiled full completion was 1,564 ms and Save 1,603 ms.
These explain contributing costs, not a precisely isolated causal decomposition
of every older observation.

### Atomic Save variants

Instrumented full interaction milliseconds. Three fresh-process samples at 100
and 1,000 tasks use the middle observation. Each 10,000-task cell is **one observation**,
not a median or p95 estimate. Detailed min/max/raw samples are in `summary.md`.

| Variant | 100 | 1,000 | 10,000 |
|---|---:|---:|---:|
| noop | 378 | 839 | 12,048 |
| necessity | 319 | 838 | 12,579 |
| title | 334 | 836 | 12,530 |
| description | 322 | 822 | 8,327 |
| date | 326 | 851 | 5,711 |
| content | 322 | 807 | 5,808 |
| step-title | 336 | 850 | 5,704 |
| step-add | 321 | 825 | 5,693 |
| step-delete | 308 | 833 | 5,772 |
| nested | 309 | 824 | 5,707 |
| parent-complete | 332 | 840 | 5,781 |

The 10,000-task cells show two broad execution regimes, including different times
in pre-command captures against identical before-state. Do not conclude that a
title edit intrinsically costs twice a Step insertion. Scheduling, JIT/tiering,
GC and machine variability are unresolved contributors; affinity/frequency traces
were not collected. The 1,000-task variants are close because shared global work
dominates. `task.update` is separately measured through its approved facade; simply
switching one-field intents does not remove those shared costs. Full Save semantics
must not be split or silently narrowed to obtain a faster number.

## Where the time goes

Representative full ordinary completion, milliseconds. At 1,000 tasks the table
uses medians of three stage measurements; 10,000 is a single instrumented observation.
Status + data + execute approximately partition the interaction; advisory callbacks
and async scheduling can overlap slightly. Commit is inside execute. Validation
and filesystem rows overlap those larger stages.

| Tasks | Total | Three status captures | Editor + refresh captures | Execute | Commit subset | All domain validation | FS self-wall |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 792 | 288 | 203 | 304 | 186 | 366 | 190 |
| 10,000 | 5,736 | 2,246 | 1,506 | 1,979 | 1,041 | 3,411 | 290 |

At 1,000 tasks domain validation is about 46% of the representative interaction;
at 10,000 about 59%. FS self-wall is about 24% and 5%, respectively. These are
inclusive diagnostic wall measurements, not additive CPU attribution.

Source-backed call accounting:

- `TaskRepository.readSnapshot` loads and validates authoritative state; it also
  checks the instance head, fixed scope, projection and final observation.
- Each JSON capture validates five times: codec decode and storage verify at load,
  repository validation, then codec decode and storage verify at final observation.
  It reads the full generation twice. Two captures therefore mean ten validations.
- `runtime.list` and the editor port currently refresh status before requesting
  data. Full mutation additionally authorizes, preflights the writer, executes and
  performs scoped read-after-write: three status plus two data captures.
- The fresh write adds nine validations to those 25 capture validations: authoritative
  load, candidate, commit, encoding/round-trip decode and published-generation verify.
  Retention cleanup can add more: the grown write probes performed 36 validations
  and spent approximately 64?69 ms verifying/removing an old retained generation.
- `validateState` visits all live/deleted tasks, Steps, events, bindings, receipts,
  reservations and content continuity. Bulk creation receipts contain the entire
  affected task set, so many tasks are checked again as immutable receipt snapshots.
  Recurrence/import validators run when their namespaces exist; they are absent in
  the primary population probes, not proved cheap by these measurements.
- `value.clone` calls canonical JSON validation, recursive key sorting, stringify
  and parse. `decodePrivateGeneration` validates then deep-clones the full state;
  candidate creation and repository publication also clone full state. These are
  actual measured calls, not assumptions about JSON serialization alone.
- The exact editor target uses an array scan. In the ordinary completion probe,
  scoped projection is roughly 1 ms at 10,000 tasks. An index for that lookup alone
  would not solve a multi-second capture. Existing cached getters/indexes are not
  equivalent to the coherent read contract.

Primary sources: [repository](../src/repository.js),
[JSON storage](../src/json-repository.js), [codec](../src/private-storage-codec.js),
[domain](../src/domain.js), [value](../src/value.js),
[host](../host/repository-host.js), [writer](../writer/repository-writer.js),
[editor port](../host/editor-read.js), [demo runtime](../demo/runtime.cjs),
[atomic participant](../src/atomic-task.js),
[completion helper](../src/completion-transition.js),
[content continuity](../src/source-content.js),
[read-after-write](../application/read-after-write.js).

### CPU and allocations

Twelve CPU profiles (including startup) and eleven heap-sampling profiles are
retained. Profiled times are separate from non-profiled wall samples.

In the 10,000-task completion CPU profile, exclusive samples attributed 33.9% to
`value.jsonValue`, 12.6% to its recursive canonical sort, 5.4% to `canonical` itself,
5.4% to GC and 3.6% to `clone` itself. Those self samples are nonoverlapping;
inclusive call-stack percentages would overlap. CPU samples corroborate repeated
portable record/array checks and canonical object reconstruction as major work.

Heap sampling (64 KiB interval, collected allocations included) estimated roughly
2.14 GB under `jsonValue`, 2.02 GB under property-descriptor allocation, 1.01 GB
under key-array creation and 0.85 GB under canonical reconstruction in that profiled
10,000-task operation. These are sampled allocation estimates over the operation,
not retained heap sizes or exact byte counts. Inspector bookends/wrappers also
allocate; their frames remain visible in raw profiles.

Representative full completion memory, MiB. RSS is process high-water; heaps are
boundary observations. Explicit GC occurs after close and outside timing. A result
may remain held by the harness, so this is not a formal leak test.

| Tasks | Peak RSS | Heap before | Heap after | After close + explicit GC | Observed GC count / ms |
|---:|---:|---:|---:|---:|---:|
| 100 | 149 | 11.42 | 12.43 | 5.07 | 18 / 4 |
| 1,000 | 227 | 38.24 | 12.12 | 5.35 | 30 / 15 |
| 10,000 | 465 | 120.11 | 110.27 | 5.41 | 271 / 264 |

The large temporary allocation volume and numerous observed collections explain
memory pressure; no new persistent cache was introduced. Boundary sampling can
miss synchronous peaks, and GC callbacks may be delivered late. Cache growth or
absence of leaks cannot be proved from these probes alone.

### Storage publication

A fresh completion wrote approximately 1.45 MB at 1,000 tasks, plus a 1.45 MB exclusive
generation copy; at 10,000, 14.28 MB plus a 14.28 MB copy. It read approximately
18.86 MB / 185.64 MB across its full interaction. This includes checks/re-reads,
not unique logical data. File writes, exclusive copy, readback verification, flush,
manifest replacements, recovery barrier mirroring and retained-generation cleanup
all remain actual native operations.

Measured sync calls totaled about 8 ms / 25 ms in those representative operations.
Commit inclusive time was 186 ms / 1,041 ms; it includes validators and codec work,
so it must not be labelled pure disk or stringify time. Generation encode alone
was 38 / 360 ms and itself includes validation and round-trip decode. CPU samples
separate some JSON/native work, but exact standalone stringify/receipt-serialization
cost was not isolated. No runtime edits were made to manufacture finer stage timers.

Full-generation rewriting is real, but it does not by itself explain the scaling
latency. At small populations fixed filesystem/root/lease work is material; at
large populations CPU verification/cloning dominates. Directory sync remains the
existing best-effort implementation, not a new power-loss guarantee.

## History, receipt and content growth

Matched 1,000-task probes, three samples per read; all have 104 Steps, one rich
four-level target and the same metadata/content recipe. The event-dense variant
changes initial checked states while retaining the two-receipt recipe. IDs/clocks
are freshly allocated for that variant and retained within its sample clones.

| Variant | Events / receipts | Current content revisions | List ms | Editor ms |
|---|---:|---:|---:|---:|
| Fresh reference | 1 / 2 | 1 | 216 | 198 |
| metadata-receipts | 1 / 22 | 21 | 371 | 397 |
| metadata-noop-receipts | 1 / 22 | 1 | 216 | 210 |
| atomic-receipts | 1 / 22 | 1 | 288 | 274 |
| event-dense | 1000 / 2 | 1 | 250 | 240 |

Twenty metadata no-ops retain one content revision and add receipts without new
content. Twenty actual edits produce 21 current revisions and **483 stored revision
occurrences** across current task and receipt task snapshots, versus 23 in the
22-receipt no-op cases. This is an explicit workload dimension, not task growth.
The metadata-edit list profile attributes 21.1% of CPU self samples to portable
`source-content.sha256`; the grown completion attributes 17.7%. Hashing/continuity
work becomes more important with retained rich evidence.

Every original content/event/receipt remains required evidence. These observations
are not permission to prune history, change receipts or omit checks. A repeated
rich-edit pattern duplicates increasingly long revision chains into receipt
snapshots; the representation can grow quadratically with edit count for that
pattern. This does not establish a universal wall-time complexity class.

## Startup, HTTP and browser

Diagnostic startup milliseconds, one cold and one warm observation per population:

| Tasks | Process-cold open | Same-process reopen | Domain validation calls |
|---:|---:|---:|---:|
| 100 | 111 | 69 | 8 / 8 |
| 1,000 | 249 | 185 | 8 / 8 |
| 10,000 | 1,479 | 1,364 | 8 / 8 |

Opening verifies explicit authority/lease, inspects retained generation headers,
selects/validates the current generation, builds repository state/indexes and
performs the host's ready capture. The private-root mixed-format guard parses
retained generation files even when only current state is selected. There is no
OS disk-cache flush, and the process-cold timer excludes already loaded modules.
The browser runner separately measures fresh Node launch through HTTP readiness.

Actual Chrome headless, fresh Temp user profile, 1280?900, unchanged Task Lab UI.
Each navigation proves a new document loader; ready/long-task probes assert that
injection succeeded. Three navigations per population include the first and warm
navigation cases. All servers close gracefully with owned lock absence verified.

| Tasks | Server launch ms (one) | UI ready median ms | List response median ms | Response-end to ready ms | Warm editor median ms |
|---:|---:|---:|---:|---:|---:|
| 100 | 230 | 73 | 63 | 1 | 93 |
| 1,000 | 327 | 222 | 207 | 3 | 211 |
| 10,000 | 1,548 | 1,580 | 1,555 | 16 | 1,480 |

Only 100 rows are rendered. Responses contain approximately 47 KB / 458 KB / 4.57 MB
for 100 / 1,000 / 10,000 tasks. The accepted browser windows observed no >50 ms long
tasks; filtering-to-paint is roughly 15?16 ms median, with 30 samples per population.
This is evidence for these windows, not a guarantee of main-thread input latency.
The browser's backend is a warmed persistent process, unlike fresh-process mutation
samples. Browser/server variability therefore must not be credited to a code change.
HTTP editor/Save probes also delegate to the actual server/runtime and record its
backend boundary separately; transport/encoding did not explain the multi-second
backend waits. No optimistic rendering or persistence semantics were implemented.

## Scaling, ranked alternatives and goals

The unchanged read medians fit roughly `35 + 0.302 ? tasks` ms for list and
`25 + 0.304 ? tasks` ms for editor (three-point descriptive R? >0.999). This supports
an approximately linear trend for these sparse-history populations. It is not a
complexity proof. Receipts/content, retained generations, GC and process execution
regime are additional dimensions. Individual 10,000-task variant rankings are not
reliable from one sample.

| Rank | Source/cost | Smallest plausible response | Risk, difficulty and estimated benefit |
|---:|---|---|---|
| 1 | Repeated scoped/status captures: two full captures per read; each performs five validations | Co-capture fresh context/readiness and scoped data once | Moderate host-contract work; about 45?55% list/editor reduction estimated from within-operation timings. Preserve every remaining capture check, global owner/partition admission and stamp acceptance. |
| 2 | `value` checking/canonical cloning plus repeated validation: ~46?59% domain wall share, major CPU/allocation samples | Audit provably redundant copies first; then consider validation reuse only for exact immutable evidence | Codec/state trust work needs separate correctness review. A fresh parse already owns its state, so its subsequent defensive clone deserves investigation (~16?21% of representative complete wall under codec clones). No global replacement of strict `value.clone` or trusted-by-ID cache. |
| 3 | Repeated private content hashing with retained revision snapshots: 17?21% CPU in grown probes | Consider bounded, per-validation pure digest reuse keyed by exact complete input bytes | Moderate content-validator work; never trust a claimed digest alone, never skip per-target/chain checks. Benefit bounded by the measured share; canonical checking still costs time. No cross-store authority/cache. |
| 4 | Full generation/copy and guarded FS operations; ~5% large-population FS self-wall, material fixed small-population cost | Only after CPU/read work, examine redundant encoding and safely deferred housekeeping | Publication/ack/recovery-sensitive. Preserve write/flush/readback, monotonic barriers and exact retained-generation verification. Faster disk alone cannot remove the measured CPU cost. |

List/editor indexing or client pagination can reduce lookup/network/output costs,
but cannot eliminate full-state verification by itself. A validated immutable
session view might later reuse exact-generation work, only with fresh root/lease,
CURRENT/RECOVERY/capability/fence evidence and generation-byte integrity. Such a
cache must be derivative and bounded, never a second authority.

Per-owner generations/partitions, copy-on-write, append/checkpoint stores and
indexed transactional backends are longer-term alternatives. They add cross-owner
identity/receipt, compatibility, recovery, backup and migration obligations. The
current evidence does not justify starting that redesign before narrower changes.

The proposed 1,000-task objectives remain engineering goals, not passing standards.
A fixed uninstrumented list was ~201 ms and the instrumented editor ~198 ms; combined capture may
bring those toward ~100?130 ms. Native completion was 384 ms (goal ~300), application
Save 471 ms with supplied draft/capability, and full Save 808 ms including preceding
editor work (goal ~500 depends on the agreed boundary). Grown content makes these
worse. Co-capture alone will not meet all write or 10,000-task goals; remeasure before
choosing subsequent work. Pending-state UI can stay responsive, but an unconfirmed
operation must remain visibly unconfirmed and use original-authority reconciliation.

## One recommended next gate ? scoped read co-capture

Recommend **High** reasoning for this narrow host/read contract change. Escalate to
**XHigh and a separate Level 3 review** if it requires changes to storage validation,
receipt/publication/recovery behavior or authoritative caching. No storage format,
schema or durable contract change is proposed for this first gate.

Proposed existing-source allowlist (not an edit authorization):

1. `ItacanTaskCore/host/repository-host.js` ? one private versioned operation that
   obtains fresh context/status and requested data through the existing queued
   capture. Preserve v1 callers, all owner/partition availability checks, root/lease,
   pre/post registry/identity pins, recovery permission and generation acceptance.
2. `ItacanTaskCore/host/index.d.ts` ? explicit private request/result contract and
   accepted stamp; no command or generic selector surface.
3. `ItacanTaskCore/host/editor-read.js` ? consume the combined capture while retaining
   complete draft/privacy/policy guards.
4. `ItacanTaskCore/demo/runtime.cjs` ? use it for list/create-context reads; leave
   mutation dispatch, capability/replay/uncertainty handling unchanged.

Proposed new verification files:

- `host/tests/scoped-capture.test.cjs`
- `editor/tests/single-capture.test.cjs`
- `demo/tests/single-capture.test.cjs`
- `host/tests/scoped-capture-types.fixture.ts`
- `host/tests/scoped-capture-typecheck.cjs`
- `perf/READ-CAPTURE-VERIFICATION.md`

All are under `ItacanTaskCore`. No core repository/codec/domain/command edit belongs
to that allowlist. All-partition/owner admission must remain equivalent to the
previous status preflight; any head-correlated internal header use needs exact
before/after head checks and must not relabel cached task data coherent. If the
four-file boundary cannot retain those guarantees, stop for review before expansion.

Acceptance: one authoritative capture on the stable read path, identical scoped
content and guards, unchanged mutation/event/receipt deltas; stale/changed registry,
missing unrelated owner/dashboard, alias/partition conflicts, read/write races,
root/lease/head/barrier/fence loss, reopen/disposal and late results still fail closed.
Run focused host/editor/privacy, writer admission/replay, application read-after-write
and declarations; compare unchanged production builds. Reuse the present benchmark,
fixed-count controls and aged-content probes. Expected improvement is an estimate,
not a promised threshold. No production routing or UI integration is included.

## Product and safety boundary

The existing [Add/Edit modal](../../.obsidian/plugins/hub-project-menu/lib/ui/task-editor.js)
and its compact live form are authoritative: established dark/accent treatment,
flat Steps, Necessity/Start/Due, progressive optional fields, modal header/footer
and spacing. Task Lab is engineering UI. Child Steps, parent/top-level selectors,
Step notes, continuation and a separate parent-completion field are not approved
product features. Future compact editors must preserve unsupported native structures,
content, originals and bindings or restrict incompatible edits. Neither UI changed.

Six new harness checks, 133 focused existing host/writer/application/editor/isolation
checks, two declaration runners and CJS syntax checks passed. Actual writer-backed
mutation samples also validate their native committed states. No historical archive
was rerun or repackaged, and no new process-interruption guarantee is claimed.
Track B's earlier interruption evidence remains historical sealed execution evidence.

All existing runtime/UI/source bytes and all twelve staged/installed production
assets compare equal to the fresh baseline. Main/Atlas factory IDs remain 168/24,
with one Legacy Task Service construction and no native/perf startup dependency.
Of 1,697 baseline files, only `.obsidian/workspace.json` drifted during this gate;
its exact current bytes were preserved without restoration or attribution. Plugin
data, Markdown, History/Oath/Inbox carriers and all other baseline files compare
byte-equal. No native artifact was created in the workspace outside backups.

New files are confined to `ItacanTaskCore/perf/` (eleven files including this report).
New profiling authorities are separate verified Temp children. The active Task Lab
profile was neither opened by the profiler nor removed. Diagnostic output admission
also rejects repository/profile roots. There is no install, conversion, migration,
Obsidian launch/reload or Track A/C1-A work.

## Raw evidence and limitations

Evidence root: `C:/Users/EL_BAR~1/AppData/Local/Temp/itacan-native-perf-w_mzmv92`.
Compact review package: `C:/Users/EL_BAR~1/AppData/Local/Temp/itacan-native-perf-w_mzmv92/native-perf-review.zip`.
Primary indexes: `analysis.json`, `summary.md`, `baselines.json`,
`sensitivity-baselines.json`, `browser-results.json`, `startup-*.json`,
`verification-runs.json` and final source/build/inventory records. Exact child commands,
PIDs, stdout/stderr, scalar exits, counts and process memory are retained. Raw stores
remain at their recorded paths; CPU/heap files and a compact checked review package
are retained in Temp. The previous migration archive was not repacked.

Accepted results use instrumentation v2. Calibration at 1,000 tasks: list
216 ms instrumented vs 201 ms plain; full Save 836 vs 808 ms; completion 792 vs 822 ms.
That last difference shows run variability, not negative overhead. No numerical
correction was subtracted. Three/one expensive-write samples do not establish p95.
CPU/heap profiling adds its own overhead; those samples are labelled separately.
Absolute benefit estimates need controlled repeated confirmation.

Provisional timing wrappers, an invalid synthetic rich draft, a demo-only unsupported
metadata pilot, the duplicate-authority preparation rejection, initial missing
browser timing injection and an unmatched event-density recipe are retained as
setup/provisional evidence, not passing claims. Affected accepted measurements were
rerun with explicit checks. Reporting helper errors did not establish success.

Inner stringify/receipt preparation and event-versus-binding substeps are not all
independently timed; export/method timing, source inspection and sampling provide
the available breakdown. No existing source was instrumented to invent precision.
Unknown large import/recurrence/original-envelope workloads remain unprofiled.
Claims cover tested cooperative local observations only; they do not establish
power-loss/cloud rollback, hostile-writer, distributed uniqueness or cross-authority
atomicity. No safeguard was disabled and no optimization was implemented.

**STOP FOR USER REVIEW. Do not start the proposed optimization, C1-A, production
integration or migration without separate authorization.**
