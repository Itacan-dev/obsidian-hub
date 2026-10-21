# Performance P2 ? canonical decoded-state copy

2026-10-20. Completed for user review. No P3, application-storage work or production adoption.

## Change and ownership contract

Only `src/private-storage-codec.js` changes existing source. A private synchronous `copyValidatedGeneration` retains the same sorted reconstruction and JSON stringify/parse normalization as `value.clone`, including key order and signed zero. It omits only the root portable-value traversal already completed at the end of `validateState` on that same unchanged object. Subsequent barrier checks are synchronous and nonmutating. The helper is not exported.

The barrier/manifest copies, five complete domain validations per stable JSON capture, repository constructor/publication copies, detached candidate, task/result receipt snapshots and public projection copies remain. No cache, schema, capability, receipt, admission, command, recovery or DTO contract changes. The result remains plain, mutable and detached.

The source graph preserves the exact pre-P2 decoder and 35 native source/declaration files with origins, bytes and SHA256. Differential execution compiles that decoder at its original module location against unchanged dependencies. Historical reader assertions execute their actual frozen graphs independently.

## Correctness evidence

- Saved targeted regressions: 2013 checks, zero failed/skipped; 14 declaration runners.
- New differential/isolation/persistence checks: 39 passed, including seven actual parent-terminated children.
- Unchanged browser workflow: 17 checks, routed reload with four Steps and exact continuation.

The new checks cover schema/envelope versions, actual import and recurrence states, normalization and recursive key order, malformed/unsafe/deep inputs, disjoint descendants, retained/frozen validator inputs, detached candidate rejection, receipts/content continuity, public mutation attempts and exact replay. Existing selected suites supply full admission, recovery, namespace, owner/mount, privacy, Statistics, recurrence and current proof compatibility.

Interrupted children use actual private-v4 storage at reconstruction, before CURRENT publication and after publication/before acknowledgement for completion, rich creation and Save. PID/host/token/raw-lock/hash evidence and death checks precede the exact Temp-only lock movement. Injected exceptions remain distinguished from real termination. No power-loss, distributed or cross-authority atomicity claim is made.

The first new checkpoint failed because its expected task aliased the deliberately mutated returned task. The new test was corrected to preserve an independent expectation. That failure and the passing rerun are both retained; no existing assertion changed.

## Measurement definitions

Accepted P1 is the baseline; only its exact saved codec is overlaid. Candidate loads the current codec. Four hash-verified closed synthetic sources are copied into new Temp roots. Each worker has its own root/process; native clock and both Node/WebCrypto UUID streams are controlled identically per pair. Other applications, affinity/frequency and OS disk cache are uncontrolled. The same source-overlay module loader runs in both variants; its resolution overhead is included in absolute latencies. It does not time or wrap native functions in primary runs.

Three alternating paired blocks collect 60 backend/HTTP samples per route/variant/population, 21 fresh-process samples per mutation boundary, and 15 fresh browser documents. p95 is the empirical upper order statistic with limited precision, not a tail guarantee. Every initial and repeated sample remains available. No threshold was used to force acceptance.

Native completion includes writer admission and publication; application completion/prepared Save add translation and coherent refresh. Full Save/Step insertion additionally include editor fetch, draft preparation and authorization. Host open excludes module loading and includes N2 lifecycle/registry work. These definitions are not interchangeable with physical disk-cache-cold launch or final UI render.

The first four read process launches were successful no-ops because the preloaded entry was cached before main-module assignment. They supplied no measurements and are separately marked invalid. The corrected path-admitted entry reran the missing pairs. Initial Step-insertion attempts without the WebCrypto override are retained separately as superseded, and rerun with identical streams. Runner success is never substituted for measurement success.

### Backend, HTTP and lifecycle/write results

Milliseconds, baseline ? P2. Negative change means faster.

| Population | Boundary | n/variant | Median ms | Change | p95 ms | Change |
|---|---|---:|---:|---:|---:|---:|
| aged-1000 | complete/application | 21 | 916.0 ? 882.9 | -3.6% | 959.2 ? 935.1 | -2.5% |
| aged-1000 | complete/native | 21 | 735.3 ? 708.0 | -3.7% | 777.7 ? 737.6 | -5.2% |
| aged-1000 | editor | 60 | 369.0 ? 348.2 | -5.6% | 491.7 ? 454.4 | -7.6% |
| aged-1000 | hostOpen | 21 | 659.3 ? 642.7 | -2.5% | 690.2 ? 675.3 | -2.2% |
| aged-1000 | httpEditor | 60 | 364.9 ? 349.9 | -4.1% | 473.1 ? 505.6 | +6.9% |
| aged-1000 | httpList | 60 | 380.7 ? 374.7 | -1.6% | 525.1 ? 478.0 | -9.0% |
| aged-1000 | list | 60 | 379.4 ? 357.6 | -5.8% | 513.4 ? 477.6 | -7.0% |
| aged-1000 | save-step-add/full | 21 | 1334.0 ? 1279.7 | -4.1% | 1417.0 ? 1369.6 | -3.3% |
| aged-1000 | save-title/application | 21 | 951.1 ? 915.3 | -3.8% | 992.8 ? 961.0 | -3.2% |
| aged-1000 | save-title/full | 21 | 1320.1 ? 1299.6 | -1.6% | 1379.9 ? 1341.4 | -2.8% |
| fresh-100 | complete/application | 21 | 187.0 ? 184.3 | -1.5% | 205.2 ? 207.0 | +0.9% |
| fresh-100 | complete/native | 21 | 152.0 ? 154.6 | +1.7% | 168.9 ? 178.2 | +5.5% |
| fresh-100 | editor | 60 | 30.0 ? 29.6 | -1.4% | 36.6 ? 35.9 | -1.8% |
| fresh-100 | hostOpen | 21 | 148.9 ? 146.8 | -1.4% | 167.9 ? 159.6 | -5.0% |
| fresh-100 | httpEditor | 60 | 29.1 ? 28.7 | -1.4% | 33.5 ? 35.4 | +5.8% |
| fresh-100 | httpList | 60 | 30.0 ? 29.5 | -1.6% | 34.8 ? 35.0 | +0.7% |
| fresh-100 | list | 60 | 30.6 ? 30.8 | +0.6% | 38.3 ? 37.5 | -2.0% |
| fresh-100 | save-step-add/full | 21 | 263.2 ? 263.5 | +0.1% | 285.1 ? 297.7 | +4.4% |
| fresh-100 | save-title/application | 21 | 200.3 ? 192.4 | -3.9% | 225.8 ? 214.8 | -4.9% |
| fresh-100 | save-title/full | 21 | 263.2 ? 260.6 | -1.0% | 288.9 ? 282.4 | -2.3% |
| fresh-1000 | complete/application | 21 | 500.4 ? 489.6 | -2.1% | 633.0 ? 539.5 | -14.8% |
| fresh-1000 | complete/native | 21 | 411.1 ? 387.7 | -5.7% | 455.4 ? 422.8 | -7.2% |
| fresh-1000 | editor | 60 | 165.2 ? 98.7 | -40.3% | 304.8 ? 275.0 | -9.8% |
| fresh-1000 | hostOpen | 21 | 366.4 ? 372.9 | +1.8% | 409.6 ? 398.7 | -2.7% |
| fresh-1000 | httpEditor | 60 | 214.8 ? 215.1 | +0.1% | 297.7 ? 289.4 | -2.8% |
| fresh-1000 | httpList | 60 | 244.9 ? 231.8 | -5.4% | 318.0 ? 292.1 | -8.1% |
| fresh-1000 | list | 60 | 160.3 ? 102.1 | -36.3% | 295.7 ? 295.0 | -0.2% |
| fresh-1000 | save-step-add/full | 21 | 712.7 ? 675.8 | -5.2% | 756.3 ? 771.1 | +2.0% |
| fresh-1000 | save-title/application | 21 | 515.0 ? 498.2 | -3.3% | 566.0 ? 558.8 | -1.3% |
| fresh-1000 | save-title/full | 21 | 702.1 ? 675.3 | -3.8% | 726.1 ? 690.2 | -4.9% |
| fresh-10000 | complete/application | 21 | 7240.2 ? 6923.0 | -4.4% | 9233.5 ? 8573.3 | -7.1% |
| fresh-10000 | complete/native | 21 | 5760.7 ? 5471.5 | -5.0% | 7327.3 ? 7094.9 | -3.2% |
| fresh-10000 | editor | 60 | 1712.4 ? 1593.9 | -6.9% | 1959.7 ? 1818.2 | -7.2% |
| fresh-10000 | hostOpen | 21 | 2415.1 ? 2302.5 | -4.7% | 2511.6 ? 2446.9 | -2.6% |
| fresh-10000 | httpEditor | 60 | 1866.9 ? 1713.1 | -8.2% | 2079.0 ? 1971.5 | -5.2% |
| fresh-10000 | httpList | 60 | 2114.5 ? 1913.5 | -9.5% | 2381.9 ? 2097.1 | -12.0% |
| fresh-10000 | list | 60 | 1869.3 ? 1764.3 | -5.6% | 2163.0 ? 2100.8 | -2.9% |
| fresh-10000 | save-step-add/full | 21 | 10708.7 ? 10206.7 | -4.7% | 13156.5 ? 12604.0 | -4.2% |
| fresh-10000 | save-title/application | 21 | 7232.9 ? 6880.0 | -4.9% | 8967.2 ? 8639.8 | -3.7% |
| fresh-10000 | save-title/full | 21 | 11387.8 ? 10627.0 | -6.7% | 12697.5 ? 12395.2 | -2.4% |

### Actual browser measurements

Same owned headless Chrome and unchanged engineering UI; only 100 task rows render. No product UI feature is approved by this prototype.

| Population | Boundary | n/variant | Median ms | Change | p95 ms | Change |
|---|---|---:|---:|---:|---:|---:|
| aged-1000 | browser/editorMs | 15 | 229.6 ? 217.8 | -5.1% | 548.3 ? 416.9 | -24.0% |
| aged-1000 | browser/initialPaintMs | 15 | 258.5 ? 252.7 | -2.2% | 551.8 ? 419.7 | -23.9% |
| aged-1000 | browser/listResponseMs | 15 | 198.6 ? 192.5 | -3.1% | 500.3 ? 378.8 | -24.3% |
| aged-1000 | browser/readyMs | 15 | 231.3 ? 215.6 | -6.8% | 529.2 ? 401.2 | -24.2% |
| fresh-100 | browser/editorMs | 15 | 62.4 ? 62.4 | -0.0% | 106.0 ? 62.7 | -40.8% |
| fresh-100 | browser/initialPaintMs | 15 | 94.6 ? 95.3 | +0.7% | 141.3 ? 111.5 | -21.1% |
| fresh-100 | browser/listResponseMs | 15 | 42.0 ? 40.6 | -3.3% | 77.9 ? 50.7 | -34.9% |
| fresh-100 | browser/readyMs | 15 | 57.4 ? 54.9 | -4.4% | 113.4 ? 83.0 | -26.8% |
| fresh-1000 | browser/editorMs | 15 | 131.9 ? 138.6 | +5.1% | 144.5 ? 193.7 | +34.0% |
| fresh-1000 | browser/initialPaintMs | 15 | 156.2 ? 162.6 | +4.1% | 192.2 ? 295.6 | +53.8% |
| fresh-1000 | browser/listResponseMs | 15 | 121.2 ? 121.8 | +0.5% | 145.2 ? 229.3 | +57.9% |
| fresh-1000 | browser/readyMs | 15 | 139.2 ? 138.6 | -0.4% | 167.9 ? 271.2 | +61.5% |
| fresh-10000 | browser/editorMs | 15 | 1702.5 ? 1507.2 | -11.5% | 2111.7 ? 1604.4 | -24.0% |
| fresh-10000 | browser/initialPaintMs | 15 | 1969.0 ? 1698.1 | -13.8% | 2246.8 ? 1863.1 | -17.1% |
| fresh-10000 | browser/listResponseMs | 15 | 1899.3 ? 1631.0 | -14.1% | 2181.4 ? 1801.8 | -17.4% |
| fresh-10000 | browser/readyMs | 15 | 1959.2 ? 1683.7 | -14.1% | 2236.1 ? 1851.8 | -17.2% |

## Accounting, limitations and safety

Copy count and copied volume must include the new helper. The optimization retains canonical reconstruction and JSON round trips; it does not eliminate a deep copy. Detailed root-scan/copy counters and separate CPU/heap profiles are retained in performance-analysis.json and named profile/count records. Inclusive CPU/validation/clone stages overlap and are never added. Sampled heap/GC observations do not establish that copying ceased or that all memory metrics improved.

The historical P1 1,000-task HTTP tail anomaly remains an open cause. This gate reports new paired tails without attributing them automatically to GC, JIT or this scan. Per-block raw samples and all regressions remain in the analysis.

Protected/source comparisons and all twelve Temp-staged production assets are recorded in final-comparison.json. Installed bundles, production startup, real Markdown, plugin data, Inbox/Oath/Strict/planning and the active Task Lab are outside the mutation boundary. Independent drift is preserved rather than restored.

Evidence root: `C:\Users\El_Baraka 2025\AppData\Local\Temp\itacan-p2-4yn1od3a`. Exact selections, command/environment records, raw stdout/stderr/exits, invalid/superseded attempts, process evidence, source originals, baselines, samples and comparisons are retained. Fresh reproduction requires a new verified Temp audit and rebased paths; resuming this audit is not a new experiment.

Stop for user review after P2.

## Measured outcome and regressions

At 10,000 tasks, pooled backend list/editor medians improve 5.6% / 6.9%; native completion, prepared application Save and full Save improve 5.0% / 4.9% / 6.7%. Aged list/editor medians improve 5.8% / 5.6%. These are measured paired-harness results, not a universal guarantee or the earlier P1 prediction. Large writes remain multi-second.

The 1,000-task backend median reductions (36.3% list, 40.3% editor) are much larger than the targeted scan share and occur amid substantial process/tail variation. Do not attribute their full magnitude solely to this scan. HTTP editor median at that population is effectively unchanged. The historical tail anomaly has no established cause.

The following observed slowdowns are retained. Small differences are not declared statistically significant. Browser p95 at n=15 is the maximum observation; its precision is especially limited.

| Population | Boundary | Median change | p95 change |
|---|---|---:|---:|
| aged-1000 | httpEditor | -4.1% | +6.9% |
| fresh-100 | browser/initialPaintMs | +0.7% | -21.1% |
| fresh-100 | complete/application | -1.5% | +0.9% |
| fresh-100 | complete/native | +1.7% | +5.5% |
| fresh-100 | httpEditor | -1.4% | +5.8% |
| fresh-100 | httpList | -1.6% | +0.7% |
| fresh-100 | list | +0.6% | -2.0% |
| fresh-100 | save-step-add/full | +0.1% | +4.4% |
| fresh-1000 | browser/editorMs | +5.1% | +34.0% |
| fresh-1000 | browser/initialPaintMs | +4.1% | +53.8% |
| fresh-1000 | browser/listResponseMs | +0.5% | +57.9% |
| fresh-1000 | browser/readyMs | -0.4% | +61.5% |
| fresh-1000 | hostOpen | +1.8% | -2.7% |
| fresh-1000 | httpEditor | +0.1% | -2.8% |
| fresh-1000 | save-step-add/full | -5.2% | +2.0% |

Notable regressions include aged HTTP-editor p95 473.1 ? 505.6 ms (+6.9%), 1,000-task browser editor median 131.9 ? 138.6 ms (+5.1%) and browser-ready p95 167.9 ? 271.2 ms (+61.5%, n=15). At 100 tasks native completion median rises 152.0 ? 154.6 ms (+1.7%).

### Independent copy and validation accounting

Counts cover one backend list and one editor request per variant, excluding warm-up and HTTP. Every copy includes the new private helper.

| Population | Full-state copies, before/after | Serialized copy bytes, before/after | Root portable scans, before/after |
|---|---:|---:|---:|
| fresh | 4 / 4 | 57,080,860 / 57,080,860 | 14 / 10 |
| metadata-receipts | 4 / 4 | 7,859,136 / 7,859,136 | 14 / 10 |

All-copy counts also match (160,108 at 10,000 tasks; 16,108 for aged content). Stable list captures retain five domain validations; profiled full completion retains 29 in both variants. No full-state copy or readback validation was eliminated.

### Separate sampled profiles

Single instrumented pairs; these are not plain latency medians or causal allocation/GC guarantees. Sampled allocation bytes are inspector estimates, not exact bytes copied or retained heap.

| Probe | CPU samples | Decoder-copy subtree samples | Portable scan under that copy | GC ms | Peak RSS KiB | Sampled allocation bytes |
|---|---:|---:|---:|---:|---:|---:|
| profile-1000-metadata-receipts-list-baseline | 177 | 16 | 6 | 6.2 | 240,512 | 274,858,596 |
| profile-1000-metadata-receipts-list-candidate | 161 | 10 | 0 | 4.6 | 237,240 | 254,419,180 |
| profile-10000-fresh-complete-baseline | 8950 | 1481 | 473 | 523.3 | 515,296 | 8,012,878,468 |
| profile-10000-fresh-complete-candidate | 7703 | 1021 | 0 | 463.8 | 497,780 | 7,386,545,268 |
| profile-10000-fresh-list-baseline | 1380 | 273 | 107 | 84.8 | 418,280 | 1,326,761,276 |
| profile-10000-fresh-list-candidate | 1340 | 167 | 0 | 105.2 | 414,384 | 1,228,532,656 |

The targeted portable scan disappears from the decoder-copy subtree, while domain validation remains. GC is not uniformly lower: the fresh-list diagnostic rises 84.8 ? 105.2 ms. Aged-list measured CPU usage also rises in its single diagnostic despite lower wall time. These sparse observations do not support a blanket GC, allocation, RSS or CPU improvement claim.

### Final protected-state disposition

The 1,714-file baseline comparison finds 1,712 identical files, the single authorized codec edit, and observed `.obsidian/workspace.json` drift confined to `lastOpenFiles`. No actor is inferred. Both exact workspace byte versions are preserved privately; the original was recovered from P1?s sealed protected-original after matching the fresh baseline SHA256. Nothing was restored to the workspace.

All twelve staged assets are byte-identical. Main/Atlas remain 168/24 modules, with the unchanged Legacy Task Service construction/startup graph. Installed assets, plugin data, real Markdown, History/checks and other protected baseline bytes match. No native artifacts were found in the workspace scan. The 898 accepted benchmark roots are verified beneath this audit, with all owned writer locks absent; 420 mutation pairs have matching task/event/Step identities and generation sizes. All four closed source inventories remain unchanged.

Original codec SHA256: `78b59d81f67a9d12ef37e53f7da2e365a791dcc181f0b5a600262c97519aa595`. P2 codec SHA256: `5f8e37e520ed724bc2307dc44a4a224827dd4600e9cc44225e8751457005ed2b`.

Recommendation: retain this narrow candidate for review. The measured large/aged workloads support a modest benefit while exact copy/validation invariants pass. Small-population and browser/HTTP tail regressions remain explicit. No broader optimization or production integration is justified by this gate alone.
