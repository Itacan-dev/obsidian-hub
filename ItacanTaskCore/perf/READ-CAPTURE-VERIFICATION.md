# Performance P1 ? single authoritative scoped read capture

2026-10-20. **Completed for review.** The stable list/editor/create-context path now uses one authoritative capture. Each remaining JSON capture retains five full-state validations and the existing root, lease, pointer, capability, fence and final-observation checks. No P2 or production integration was performed.

## Final contract and source boundary

| Existing file | Authorized change |
| --- | --- |
| `host/repository-host.js` | Private v2 `readScoped`; one queued data capture plus fresh status/context; global owner/partition admission and exact head correlation. Editor context remains pinned across retries. |
| `host/index.d.ts` | Fixed tasks/editor request union, explicit v2 success/failure and accepted status/stamp; no repository or writer escape. |
| `host/editor-read.js` | Consume the combined read; retain complete private draft, physical-owner and immutable policy/Phase/inventory guards; preserve v1 editor result. |
| `demo/runtime.cjs` | List/create-context use the combined read; editor delegates to its private port. Mutation dispatch/replay/uncertainty handling unchanged. |
| `editor/tests/coherence.test.cjs` | Only the approved registry race test: inject on first actual capture; prove execution before final storage observation; retain original rejection assertion. |

Six new files: `host/tests/scoped-capture.test.cjs`, `host/tests/scoped-capture-types.fixture.ts`, `host/tests/scoped-capture-typecheck.cjs`, `editor/tests/single-capture.test.cjs`, `demo/tests/single-capture.test.cjs`, and this report. All paths are under `ItacanTaskCore/`.

The combined operation acquires validated registry/optional identity evidence before and after the existing queued repository read. Every registered owner must remain available with dashboard evidence. Internal partition headers are correlated with the authoritative snapshot?s exact store ID, repository revision, revision UUID and logical schema, before and after capture. The full partition inventory must remain identical and match registry ownership; selected partition revisions/heads must match those same headers. No unrelated task or partition data is returned. Cached headers supply correlated inventory checks, never task authority or a substituted status capture.

For one logical combined editor request, the first observed owner/identity pins survive every internal attempt. An in-flight context change returns bounded `OWNER_CONTEXT_MISMATCH` or `IDENTITY_CONTEXT_MISMATCH`; it cannot silently accept a new context. A separate new request may acquire new pins. Stable-context transient instability can retry, up to the unchanged three-attempt bound. Existing v1 APIs and task-list retry semantics retain their behavior. Closing, disposal, cancellation, epoch/generation changes and storage observation rejection still revoke acceptance.

The editor retains metadata, Necessity, endpoint precision, continuation, every Step title/body/UUID/ancestry/order, current completion/bindings, task/content/tree/partition guards and recurrence evidence. Tasks require no source note. Original envelopes, aliases, quarantine ledgers, receipts, unrestricted History, Oaths and Strict/device state remain excluded. Core repository, codec/domain/commands, completion/structure/content/recurrence/import algorithms, writer receipts and application intent semantics are byte-preserved. No cache or additional authority was introduced.

## Correctness and regression evidence

| Selection | Final result |
| --- | --- |
| N2 saved explicit selection | 127 passed |
| N3-A writer saved selection | 136 passed |
| N3-B1 application saved selection | 138 passed |
| Atomic-task runtime saved selection | 220 passed |
| Native core saved selection | 66 passed |
| F2 saved selection | 124 passed |
| Demo API/isolation/model/persistence | 33 passed |
| Affected editor contract/coherence/privacy | 31 passed |
| New P1 scoped/editor/demo checks | 46 passed |
| Total current checks | **921 passed; zero failed/skipped** |
| Declaration runners | **8 passed**, zero diagnostics |
| Changed/new JavaScript syntax checks | **8 passed** |
| Actual unchanged browser workflow | **17 checks passed**, plus fresh routed reload with four Steps and exact continuation |

Selections come from Track B?s saved explicit argument records (indices 32/34/36/40/14/30 and declaration indices 33/35/37/41/31), plus the explicitly named affected editor/demo/P1 files. Test order and assertions were preserved. No historical archive-wide rerun or new source-hash exclusion was introduced. Exact commands, explicit lists, exits, stdout and stderr are retained in `targeted-selection.json`, `targeted-results.json` and the named `.run.json` / `.out.log` / `.err.log` records. Runner success and assertions are separately recorded.

Tests cover same-state equivalence, actual capture/domain counts, full rich editor guards, all seven physical owners/eight mounts, private sentinels, wrong authority/owner/partition/kind/deleted/missing targets, global unrelated owner/dashboard/partition failure, stale pins/inventory, invalid identity evidence, writes around acceptance, live CURRENT/RECOVERY/generation damage, missing CURRENT, altered capability/schema evidence, recovery fencing, root/lease loss, close/dispose/abort/late results, and bounded instability. Actual validated identity snapshots test identity-pin discontinuity. The updated existing race test proves its injection ran before the actual delegated final observation and retains `assert.notEqual(r.status, "ok")`. Other existing editor tests are byte-identical.

Saved persistence selections execute actual parent-terminated children and exact replay/recovery cases. Their PID/host/token/lock-byte/death evidence remains under the retained per-suite process directories. No power-loss or atomic cross-authority guarantee is added. Fixture teardown retains disposable repository roots; normal owned lifecycle release and existing generation housekeeping still run.

Two earlier failed editor checkpoints remain preserved. The first test injected only at the removed second capture. The approved first-capture correction then exposed automatic retry under a fresh pin. The separately approved runtime correction pins the logical editor context and resolves that failure. Final editor execution is 31/31; no failed assertion was relabelled as passing. Original test bytes are preserved, SHA256 `41edfac489cd8e03a459c370b1435f6e762418019d43f74806ea0d3ae0921c66`.

## Comparable measurements

Runtime: VS Code?s Node **24.21.0**, `ELECTRON_RUN_AS_NODE=1`, Windows x64, Intel i5-13600KF. Benchmarks ran sequentially after regression execution. Background applications, CPU placement/frequency and OS disk cache were not controlled. Both variants use the same executable, isolation guard, fixture code and repository bytes. The old variant hash-verifies and compiles the exact saved pre-P1 runtime files at their original module locations; the new variant loads current files. Frozen profiling sources (all eleven) remain byte-identical.

Each fixed-state sample copies a closed synthetic baseline into a distinct verified Temp root and separate process, retaining its authority/identities. No held root is copied and no process-local authority admission guard is cleared. Four read-only source baselines were hashed before/after and remain unchanged. There are no original Markdown envelopes or live user tasks in these populations.

| Population | Tasks / Steps | Events / receipts / content revisions | Generation bytes |
| --- | --- | --- | --- |
| 100 | 100 / 14 | 1 / 2 / 1 | 157,772 |
| 1000 | 1,000 / 104 | 1 / 2 / 1 | 1,440,752 |
| 10000 | 10,000 / 1,004 | 1 / 2 / 1 | 14,270,552 |
| Aged 1,000 | 1,000 / 104 | 1 / 22 / 21 | 1,965,121 |

Fixed reads warm list/editor three times, then measure twenty interleaved backend list/editor samples. HTTP warms each route twice, then measures twenty requests including body decoding. Two additional alternating paired processes at 1,000 tasks investigated the initial process/HTTP variation; **all initial and repeated samples are retained**, yielding sixty samples per variant there. The main tables pool all sixty at 1,000 tasks. p95 is an empirical upper order statistic, not a tail guarantee. There is one process per variant at 100 and 10,000 tasks, and three at 1,000; process variation limits causal precision. Instrumented timings are kept separate from these plain latency results; no overhead correction is applied.

### Warm backend reads
Milliseconds: median / p95, old ? P1.

| Tasks | List median / p95 | Median reduction | Editor median / p95 | Median reduction |
| --- | --- | --- | --- | --- |
| 100 | 54.1 / 57.0 ? 27.8 / 28.8 | 48.6% (26.3 ms) | 52.9 / 56.2 ? 27.3 / 29.2 | 48.3% (25.6 ms) |
| 1,000 | 187.2 / 568.1 ? 96.4 / 298.5 | 48.5% (90.8 ms) | 181.2 / 531.0 ? 90.0 / 207.9 | 50.3% (91.2 ms) |
| 10,000 | 3,288.4 / 3,415.0 ? 1,931.4 / 2,498.1 | 41.3% (1357.0 ms) | 3,125.3 / 3,271.0 ? 1,731.5 / 2,171.2 | 44.6% (1393.8 ms) |

The predicted 45?55% warm read reduction is broadly supported at 100/1,000 tasks. Fixed 10,000-task backend medians improve 41.3% / 44.6%, slightly below the estimate, while the original demo and browser workloads below are near 48?50%. The optimization establishes a substantial reduction, not a universal 50% latency guarantee.

### HTTP and tail regressions
Milliseconds: median / p95, old ? P1.

| Tasks | HTTP list | Median reduction | HTTP editor | Median reduction |
| --- | --- | --- | --- | --- |
| 100 | 135.2 / 164.3 ? 28.2 / 29.6 | 79.1% | 140.4 / 195.3 ? 27.1 / 28.3 | 80.7% |
| 1,000 | 188.3 / 214.0 ? 100.1 / 350.4 | 46.8% | 180.7 / 200.2 ? 90.8 / 348.8 | 49.8% |
| 10,000 | 4,002.6 / 4,357.9 ? 2,113.4 / 2,349.8 | 47.2% | 3,806.8 / 4,227.5 ? 1,838.1 / 2,203.5 | 51.7% |

**Observed regression:** pooled 1,000-task HTTP p95 rises from 214.0 to 350.4 ms (63.7%) for list and 200.2 to 348.8 ms (74.2%) for editor, despite lower medians. The initial paired HTTP medians also regress (190.7 ? 276.6 ms list; 184.0 ? 248.8 ms editor), whereas later paired processes are faster. These samples were not removed or corrected. Backend/HTTP ordering, JIT/GC and uncontrolled scheduling remain possible contributors; no precise cause is established. P1 does not establish universally improved tail latency.

### Aged content

| Boundary | Old median / p95 ? P1 | Median reduction |
| --- | --- | --- |
| list | 1,027.5 / 1,162.3 ? 417.9 / 577.5 | 59.3% |
| editor | 989.5 / 1,203.8 ? 411.3 / 559.7 | 58.4% |
| httpList | 968.4 / 1,228.4 ? 470.6 / 611.5 | 51.4% |
| httpEditor | 957.4 / 1,168.0 ? 463.7 / 618.8 | 51.6% |

The aged baseline retains 21 current content revisions, 22 receipts and 483 content-revision occurrences across current/receipt task snapshots. Counts and generation bytes remain unchanged after read measurements. Savings remain substantial with continuity hashing present; no receipt/content history was pruned.

### Original demo benchmark, unchanged definition

The preserved `demo/benchmark.cjs` runs list n=20, editor/Save/completion-reopening n=10 and Step insertion n=5. It warms list three times. Save, completion and insertion include editor fetch, draft preparation, authorization, actual application/writer transaction and coherent refresh; a final UI list/render is excluded. Repeated mutations grow receipts, events and content history identically by recipe, so these are not fixed-state repeats. Its historical median convention (upper middle for even n) is preserved. Its p95 at n=10/5 is the observed maximum and has limited tail meaning.

**Original read results**

| Tasks | Boundary | Old median / p95 ? P1 | Median reduction |
| --- | --- | --- | --- |
| 100 | list | 49.6 / 52.5 ? 27.2 / 31.7 | 45.2% |
| 100 | editor | 47.6 / 49.2 ? 30.6 / 33.7 | 35.7% |
| 1,000 | list | 288.6 / 567.4 ? 93.0 / 95.4 | 67.8% |
| 1,000 | editor | 180.9 / 198.6 ? 86.5 / 98.8 | 52.2% |
| 10,000 | list | 1,510.7 / 1,522.4 ? 787.1 / 805.2 | 47.9% |
| 10,000 | editor | 1,457.8 / 1,473.3 ? 729.7 / 738.2 | 49.9% |

**Original mutation results**

| Tasks | Boundary | Old median / p95 ? P1 | Median reduction |
| --- | --- | --- | --- |
| 100 | save | 871.9 / 1,083.1 ? 677.9 / 848.4 | 22.3% |
| 100 | completionAndReopening | 1,515.1 / 1,787.4 ? 1,275.4 / 1,658.2 | 15.8% |
| 100 | stepOperation | 2,199.8 / 2,973.5 ? 1,771.3 / 2,452.7 | 19.5% |
| 1,000 | save | 1,810.5 / 2,107.3 ? 741.4 / 841.6 | 59.1% |
| 1,000 | completionAndReopening | 2,856.7 / 3,384.5 ? 976.3 / 1,104.9 | 65.8% |
| 1,000 | stepOperation | 1,462.1 / 1,620.2 ? 1,298.7 / 1,408.7 | 11.2% |
| 10,000 | save | 6,164.1 / 6,252.1 ? 5,473.6 / 5,645.2 | 11.2% |
| 10,000 | completionAndReopening | 6,524.4 / 6,661.1 ? 5,775.7 / 5,932.5 | 11.5% |
| 10,000 | stepOperation | 6,840.6 / 6,913.8 ? 6,063.5 / 6,125.0 | 11.4% |

Large differences in some original 1,000-task mutation runs exceed the isolated read saving; process/workload variation prevents attributing all of that change to P1. The controlled probes below give the cleaner mutation comparison.

### Fixed-state mutation boundaries

Three separate fresh-process samples per variant/cell; medians only, **no p95 estimate**. Full includes the preceding editor read and demo authorization/application/write/refresh. Application Save uses an already supplied complete draft and granted capability, including application dispatch, writer preflight, transaction and read-after-write, but excludes editor fetch and demo authorization. Read warm-up remains the unchanged profiling-worker definition.

| Tasks | Scenario / boundary | Old median ms | P1 median ms | Reduction |
| --- | --- | --- | --- | --- |
| 100 | complete / full | 267.6 | 237.2 | 11.3% |
| 100 | reopen / full | 270.2 | 254.7 | 5.7% |
| 100 | save-step-add / full | 278.2 | 240.0 | 13.7% |
| 100 | save-title / application | 193.5 | 195.8 | -1.2% |
| 100 | save-title / full | 276.6 | 264.7 | 4.3% |
| 1,000 | complete / full | 742.8 | 642.4 | 13.5% |
| 1,000 | reopen / full | 758.0 | 646.2 | 14.7% |
| 1,000 | save-step-add / full | 749.1 | 663.7 | 11.4% |
| 1,000 | save-title / application | 481.1 | 489.0 | -1.6% |
| 1,000 | save-title / full | 747.4 | 667.1 | 10.7% |
| 10,000 | complete / full | 5,611.9 | 4,845.4 | 13.7% |
| 10,000 | reopen / full | 5,607.6 | 4,916.1 | 12.3% |
| 10,000 | save-step-add / full | 5,666.5 | 4,917.4 | 13.2% |
| 10,000 | save-title / application | 3,430.2 | 3,404.4 | 0.8% |
| 10,000 | save-title / full | 5,621.4 | 4,894.5 | 12.9% |

Prepared application Save is 1.2% slower at 100 tasks and 1.6% slower at 1,000, with a 0.8% improvement at 10,000. These small-n controls do not establish a native write speedup. Full 10,000-task operations improve roughly 12?14%; native publication still performs its original work.

## Capture accounting, CPU and remaining cost

| Probe | Old captures / validations | P1 captures / validations | FS read bytes old ? P1 |
| --- | --- | --- | --- |
| 100 fresh list | 2 / 10 | 1 / 5 | 650,174 ? 325,092 |
| 1000 fresh editor | 2 / 10 | 1 / 5 | 5,782,104 ? 2,891,052 |
| 10000 fresh complete | 5 / 34 | 4 / 29 | 185,643,234 ? 157,092,582 |
| 10000 fresh list | 2 / 10 | 1 / 5 | 57,101,294 ? 28,550,647 |
| 1000 metadata-receipts list | 2 / 10 | 1 / 5 | 7,886,444 ? 3,943,222 |

The remaining JSON capture executes all five validations and reads the full generation twice. List/editor eliminate one complete status capture; filesystem read volume falls approximately in half. Substantial clone calls fall from 20 to 12, retaining the new small header copies. In the 10,000-task list diagnostic, clone time falls 347 ? 179 ms and validation time 1,086 ? 553 ms; these inclusive stages overlap. Diagnostic elapsed time is not substituted for plain medians.

Full 10,000-task completion falls from five captures/34 validations to four/29. Its unchanged target read-after-write capture is about 820 ? 816 ms in the paired diagnostic; this single observation establishes no refresh optimization. Validation still occupies 3,125 of 5,371 ms (~58%) and substantial clones about 1,131 ms (~21%, overlapping validation). The actual completion transition is 0.181 ms in that sparse fixture. CPU use falls in the large paired diagnostics, but small probes can have noisy CPU accounting. Peak process RSS is not uniformly lower (e.g. list 407 ? 415 MiB), so no blanket memory reduction/leak claim is made.

Fresh 10,000-task P1 CPU self samples attribute about 34% to `jsonValue`, 12?13% to canonical sorting, 5?6% to canonical conversion and ~5% to GC. The aged list attributes ~21% to SHA256 and ~21% to `jsonValue`; it has only 149 samples. Fresh completion has 3,538 samples. Whole-state validation/canonical cloning remains the main general bottleneck; retained content hashing remains an additional aged-workload cost. These are sampled observations, not additive wall stages or publication guarantees.

## Actual browser observations

Unchanged Task Lab, actual owned headless Chrome profiles at 1280?900, three fresh-document navigations per population/variant. Each proves a new loader and successful ready/long-task timing injection. Medians only; no p95 from three samples.

| Tasks | Ready old ? P1 ms | List response old ? P1 ms | Editor-ready old ? P1 ms |
| --- | --- | --- | --- |
| 100 | 80.6 ? 51.7 | 66.4 ? 39.5 | 90.1 ? 62.4 |
| 1,000 | 222.7 ? 115.8 | 206.5 ? 101.5 | 215.2 ? 111.0 |
| 10,000 | 1,612.0 ? 847.2 | 1,582.7 ? 821.2 | 1,493.3 ? 756.9 |

P1 UI-ready/editor-ready medians improve 48%/48% at 1,000 and 47%/49% at 10,000; small-population reductions are 36%/31%, where fixed browser costs matter more. Only 100 task rows render. The accepted P1 browser timing windows contain no observed >50 ms long tasks; this is not a universal input-latency claim. The separate seventeen-check browser workflow and routed reload pass, and `browser-actions.png` was visually inspected. The layout and controls are unchanged engineering UI; the production Itacan Add/Edit modal remains authoritative. Save still awaits real acknowledgement, and 10,000-task mutations remain multi-second.

## Protected state, assets and evidence

The fresh baseline covers 1,708 existing files and records 699 Git-status entries. Profiling ZIP seal and all 1,546 inventoried members verified, and eleven frozen profiling outputs still match. Final comparison finds exactly five authorized existing-file changes and **1,703 unchanged files**, with no observed protected drift in this gate. Plugin data, real Markdown, History/checks, Inbox/Oath/Strict/planning carriers, installed assets and all other nonallowlisted baseline bytes match. Independent changes would have been retained without restoration or attribution.

All twelve staged assets match baseline/final builds byte-for-byte; main/Atlas remain 168/24 factories with one Legacy Task Service construction. No native package enters production startup; editor/Inbox/Oath/Strict routing is unchanged. No live native generation/pointer/fence/lock artifact was found in the workspace outside backups. All 125 benchmark roots are beneath the separate audit root and have no owned writer lock after closure. The running interactive profile was never selected or opened for this work. All four closed source baseline inventories are unchanged.

Existing-source SHA256 values (full values also in `final-comparison-accepted.json`):

| Path | Original SHA256 | Final SHA256 |
| --- | --- | --- |
| ItacanTaskCore/demo/runtime.cjs | b5e1489c583732a1417979b35da5fa9dc1b103e21300e3082566bb9fd82fe398 | 2caaa0f16aa38ca109b025bf075b773bdb4ce13c4fa29221964b801422ddaf7c |
| ItacanTaskCore/editor/tests/coherence.test.cjs | 41edfac489cd8e03a459c370b1435f6e762418019d43f74806ea0d3ae0921c66 | 881bdeb0b5346067069d46234ee4b2436c3c895fe574e8ff9a6790ee1589e2a1 |
| ItacanTaskCore/host/editor-read.js | 95630ae71ab6d90d69898bd42588e05f98f5bb439949172b93fda62f6ecd7e7d | 52670925655d644d22a6e99c7679f560d2fb0b565d8e94e301c663020856db25 |
| ItacanTaskCore/host/index.d.ts | 6ac57ebaa85f0fb560c739124daeb18aceff03277ccf36123246137e5a804717 | c33db474b00ab90df83e9cd2ad68b19536db30a1a2ba3af8a62390819c557667 |
| ItacanTaskCore/host/repository-host.js | 9c923060a0c6d19b7a542057e1f5cfb36ac9b6fc230f1727b8d44b264df372e4 | 7a598ca4ef34febe7b1b41165c4a865523d5f550a24aa25f6df67e5be9f0d9ac |

Evidence root: `C:/Users/EL_BAR~1/AppData/Local/Temp/itacan-p1-n_6rpecg`. It retains requests/allowlists, exact originals (including the original race test), initial failed checkpoints, source/protected baselines, raw commands/lists/stdout/stderr/exits, current acceptance records, actual child interruption evidence, all benchmark inputs/samples, CPU/heap profiles, screenshots and build comparisons. Disposable stores are retained. No production installation, migration, conversion, app reload or application-storage implementation was performed. Claims remain limited to tested cooperative local observations/persistence and the exercised existing interruption cases.

Reproduction uses `python <audit>/remaining-tests.py`, `<audit>/benchmark-driver.py`, `<audit>/post-benchmark.py`; each executed child?s complete command is retained. The main benchmark driver delegates unchanged `demo/benchmark.cjs`, `perf/worker.cjs` and `perf/browser.cjs`. The labelled fixed-state read/HTTP boundary is `<audit>/read-bench.cjs`. `benchmark-selection.json`, `benchmark-runs.json`, `repeat-read-runs.json`, `performance-analysis.json`, `root-isolation-final.json`, `final-comparison-accepted.json` and named `.run.json` records provide scalar/raw evidence. Initial checkpoint ZIPs remain historical, not the final acceptance package.

The recorded main driver can resume successful samples in this evidence directory; that is not a fresh run. Fresh reproduction requires a distinct verified Temp audit with rebased paths, preserved original source bytes and verified current-source hashes. Do not overwrite this gate?s evidence or present resumed results as newly measured.

## Recommended next gate ? proposal only

Recommend one narrow **P2 review of fresh-decoder ownership and defensive cloning**, beginning with the full-state clone returned by `decodePrivateGeneration`. Establish whether that exact freshly parsed, fully validated state can be handed to its existing owner without one redundant canonical copy. Preserve strict JSON checks, every domain/receipt/content validation, root/lease/pointer/capability/fence observations and detached public results. Do not replace `value.clone` globally, reuse validation across captures, trust claimed digests, or add a long-lived authority cache. The present profiles justify investigating this copy; they do not prove a safe removal or a promised percentage gain. Codec/ownership changes require separate authorization. Content hashing and full-generation publication remain later candidates.

**Stop for user review after P1. P2, N3-C1-A, production integration and migration remain unimplemented.**
