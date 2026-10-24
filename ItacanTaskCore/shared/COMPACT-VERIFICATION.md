# N4 compact Git proofs - verification

**Result:** implemented, benchmarked and staged; **not installed**. Real shared Projects remain Legacy. No real authority, History, Markdown, activation or Git state was changed.

## Representation and integrity

The old frame embedded every task/event after each publication. Domain receipt checks also rebuilt the historical graph repeatedly. Thus task populations produced quadratic portable data and expensive repeated reconstruction.

Current packet **v3**, namespace/frame **v2**, receive payload **v2** and mandatory capability `git-shared-compact-proofs-v2` are explicit. Git private-v4 barrier/lineage/envelope remains 3 with the new required capability. Host creation requests remain API version 3 with `gitSharedVersion: 2`. Reservation witness and request retention remain v2. Project identity/authority derivation and genesis are unchanged. Packet-v2/frame-v1/capability-v1 roots are incompatible, with no automatic conversion; no real Git-native roots have been activated.

Each immutable frame preserves the complete original command, receipt, original guards, clock, allocation tape and inventory. Tasks already in that receipt are reused; sparse deltas preserve changed History records, binding removals/additions and append-only Step retirements. No complete post-publication view remains in each frame. Local receive receipts retain their own unique revisions and original publication guards; foreign receipts are never renumbered into local receipts.

The validator checks exact fields/versions, canonical IDs/order, hashes, complete causal closure, original guards, partition ancestry, original operation uniqueness and receipt coverage. It reconstructs immutable state by sharing unchanged records and replays actual native commands with original clocks/allocations. Replayed result and delta must equal the original receipt. Receive materialization must equal validated causal reconciliation, including both conflict branches. No plausible snapshot/hash alone proves execution.

Private bounded execution-proof facts bind exact frame hashes and genesis. A separate two-entry structural memo matches live canonical namespace bytes and retains only detached internal graphs. Public evidence is detached; callers cannot populate either cache. Changed bytes/bindings/ancestry invalidate reuse. Fresh child processes independently validate cold evidence. No persistent cache, checkpoint authority, new ledger, receipt semantics or private/Resource interpretation was introduced.

## Transport, consumers and recovery

Git stores one immutable frame per `objects/<frameId>.json` plus small immutable `heads/<digest>.json` under `.itacan-native/v3/<authorityId>/`. Fully flushed objects are exclusively linked before the head; death cannot publish a partial object. Historical head declarations must bind the exact genesis of a maximal causal proof containing them. Complete branch closure is retained, and only maximal heads need separate receive. Missing/corrupt/substituted objects and incompatible old transport reject. Collection and packet remain bounded to 64 MiB; the original 1,024-frame limit remains. The object/head collections each have a 1,024-entry limit; there is no pruning.

Existing retained requests, origin/local receipt reconciliation, authoritative inventory provider, watcher coalescing, status/recovery and UI consumers remain. Notification now watches head publication. No user operation is replayed merely to recover an unpublished export. Native receipts alone decide commitment. History uses one scoped graph per selected event batch and validates original event, origin receipt and first local application. Reopening/recompletion/deletion and existing Statistics calculations are unchanged.

## Measurements

Node 24.21.0, Windows x64; `performance.now()` wall-clock samples, not percentile claims. Cold workers are separate processes with no inherited caches and include **D.validateState + G.validateState**. Fixture construction uses the actual interpreter/publication result, but is not presented as a disk-write timing. Reconstruction and operation measurements use the actual codec and JSON repository.

| Tasks / Steps / origins | Old portable bytes | Compact bytes | Old cold observation | Compact cold total |
| --- | ---: | ---: | --- | ---: |
| 60 / 120 / 60 | 3,879,003 | 404,994 | 12.78 s original structural sample | 125.01 ms |
| 250 / 500 / 250 | 61,275,580 | 1,687,937 | exceeded 305 CPU s | 411.29 ms |
| 500 / 1,000 / 500 | 241,296,830 | 3,376,437 | not completed | 805.70 ms |

The old 60-task graph was reproduced from the exact preserved pre-change source: same 3,879,003 bytes, 14,518.49 ms structural + 467.56 ms proof = 14,986.05 ms. The expensive old 250 timeout and 500 size-only observations were retained, not unnecessarily repeated. Old and new timing stages are stated explicitly rather than mixing CPU and wall time. The 500-task packet uses about **5.0%** of the unchanged 64 MiB bound.

| Population | Codec reconstruction* | Actual reopen | Edit | Export | Small receive/apply | No-op receive | No-op Git discovery/validation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 60 | 164 ms | 151 ms | 333 ms | 57 ms | 387 ms | 112 ms | 58 ms |
| 250 | 639 ms | 618 ms | 1,153 ms | 219 ms | 1,442 ms | 463 ms | 231 ms |
| 500 mixed | 1,346 ms* | 1,375 ms | 2,606 ms | 511 ms | 3,334 ms | 1,068 ms | 516 ms |

*Codec samples are the create-only populations, including encode/decode and proof validation; actual reopen/operations at 500 include 551 original publications, edits, Step completion/reopening and deletions. Its packet after the small edit is 3,859,872 bytes. Receive accepts exactly one new origin and persists across reopen. First bulk object publication at 500 took 5,714 ms; repeated publication took 547 ms. These are synchronous disk work measurements, not claims that every UI action is instant.

Before final exact structural reuse, the same compact 500 mixed operation sample was edit 3,951 ms, receive 5,759 ms, no-op receive 1,939 ms. After: 2,606 / 3,334 / 1,068 ms. These before/after incremental figures compare compact optimization stages; no comparable old-v2 large incremental latency was successfully recorded. Full generation encoding/publication still costs time, while already verified origin commands are not reinterpreted: a focused test proves N initial commands, zero for identical replay, one for one new origin.

Fixed-population mixed History also validates: initial 60 tasks at 60/180/360/720 origins produced 404,994 / 1,416,896 / 3,843,709 / 14,554,852 bytes and cold totals 141 / 360 / 923 / 3,690 ms. The final sample has 188 completion events and 20 live tasks after deliberate deletions. Original per-task content revisions/receipts remain preserved. Cold 500 peak RSS was 224 MiB; sequential actual-operation stress peaked at 716 MiB; 720-origin cold verification peaked at 355 MiB. These are process high-water observations, not retained-heap guarantees.

## Acceptance actually executed

- **212 combined focused checks passed**: all existing N4 tests, new compact/adversarial tests, selected host/scoped-read/P1 race, writer replay, atomic Save/completion and private/Resource checks. A subsequent added during-proof death case passed together with the existing post-publication case: **213 unique cases** across these selections (the repeated post-publication case is not counted twice).
- Adversarial tests independently rehash altered commands, receipts, guards, plausible task effects, completion provenance, local application memberships/digests/revisions. Missing/duplicate/reordered ancestry, Project/genesis substitution, unknown checkpoint fields, incompatible versions, absent/truncated/substituted objects and historical-head identity conflicts reject. Alias/cache tests prove detached public evidence and changed current state rejection.
- Actual bidirectional Git clones pass create/edit, independent changes, same-task conflicts and third-replica propagation, stable UUIDs, completion/reopening/recompletion, deletion, idempotent reception and restart. The actual Project runtime two-working-copy test also passes retained operations and committed-unpublished reconstruction. All Git commands are confined to disposable clones/local bare remotes.
- Five distinct process-death boundaries pass: during proof, after receive CURRENT publication, retained receive at CURRENT, export before head link, export after head link. Exact original operations/events survive once. Raw PID/host/token, exit/death and lock evidence is retained; only proven dead disposable child locks are moved. No real lock is touched.
- **Seven declaration runners**, TypeScript 6.0.3: zero diagnostics (shared, host, writer, application, atomic runtime, integration, History).
- **11 genuine-Obsidian checks** on the exact staged build: actual plugin onload/unload, both shared Project configurations, Add/Edit/completion/publication, Home, Schedule views/calendar, History/Statistics, recovery controls and authority/UUID reconstruction.
- **3 genuine-Obsidian nine-owner graceful-quit checks** pass; all nine synthetic writer locks released. This is disposable application verification, not an ordinary installed production run or two simultaneous full application clients exchanging Git.
- The actual preserved pre-compact N4 client rejects the new repository capability with `UNSUPPORTED_SCHEMA`; disposable repository hashes remain identical. Older frozen-reader rejection and private/Resource receipt/codec checks pass. No frozen assertion was edited. No claim is made about unrelated historical suites not selected here.

Raw corrected failures are preserved: a test encoding conversion, fixture History query filters, and a public-graph alias test initially mutating its own input. Fixtures were corrected to the actual APIs; no integrity assertion was weakened.

## Staged build and production protection

Final main SHA-256: `41438afcc398f14ffa66c00aad75da8ba6df956e458af7b9d44e40a1c11e8bec`. Rebuilding final source is byte-identical to the candidate exercised in genuine Obsidian. Factory IDs/counts remain **246**, no additions/removals; 14 authorized Git-related factory bodies change. The plugin startup factory is unchanged. All other staged production assets match the prior candidate.

Fresh exact originals/dirty inventory precede edits. **115 protected files match their original hashes**, including all **12 installed assets**, real native authority/activation/recovery evidence, shared Markdown and application data. All **182 Legacy History records** remain unchanged. Nine real native owners remain untouched; Itacan (57 meaningful rows) and Obsidian Hub (2) remain Legacy, with the earlier ambiguous empty row unconverted. No installation, remote Git operation, real source retirement or activation occurred. Independent drift would be preserved; none was observed in these protected hashes.

Evidence and staged build: `C:/Users/EL_BAR~1/AppData/Local/Temp/itacan-n4-compact-libtw2f2/compact-candidate/`. Session pointer: `%TEMP%/itacan-n4-compact-session.json`. Raw benchmarks, unique test logs, preserved old source, process evidence references, source inventory and build/protected comparisons are under that audit root. The predecessor production candidate remains available unchanged.

## Boundaries remaining

The measured packet/cold-proof blockers are removed for the required populations. This is a staged candidate, not a claim of unlimited capacity or subsecond writes at 500 tasks. Existing frame/byte bounds remain, conflicts are preserved rather than automatically resolved, and no checkpoints/pruning are introduced. Production installation remains unperformed by authorization. Shared activation additionally requires coordinated clients supporting packet3/frame2/capability2/transport3 and an agreed Project genesis/Git baseline. No collaborator compatibility or real shared cutover is claimed.

## Exact changes relative to the compact gate baseline

Runtime/declarations:

```text
ItacanTaskCore/host/authority.js
ItacanTaskCore/host/index.d.ts
ItacanTaskCore/host/repository-host.js
ItacanTaskCore/integration/project-runtime.d.ts
ItacanTaskCore/integration/project-runtime.js
ItacanTaskCore/shared/git-transport.d.ts
ItacanTaskCore/shared/git-transport.js
ItacanTaskCore/shared/project-binding.d.ts
ItacanTaskCore/shared/project-binding.js
ItacanTaskCore/src/contracts.d.ts
ItacanTaskCore/src/domain.js
ItacanTaskCore/src/git-shared.d.ts
ItacanTaskCore/src/git-shared.js
ItacanTaskCore/src/history-read.js
ItacanTaskCore/src/json-repository.d.ts
ItacanTaskCore/src/json-repository.js
ItacanTaskCore/src/private-storage-codec.js
ItacanTaskCore/src/repository.js
ItacanTaskCore/src/serialization.js
ItacanTaskCore/writer/index.d.ts
ItacanTaskCore/writer/repository-writer.js
.obsidian/plugins/hub-project-menu/lib/services/native-task-host.js
```

Existing fixtures updated for explicit versions, sparse evidence and object publication:

```text
ItacanTaskCore/integration/tests/git-production-obsidian.cjs
ItacanTaskCore/shared/tests/bootstrap.test.cjs
ItacanTaskCore/shared/tests/crash-worker.cjs
ItacanTaskCore/shared/tests/export-crash-worker.cjs
ItacanTaskCore/shared/tests/export-interruption.test.cjs
ItacanTaskCore/shared/tests/history-conflicts.test.cjs
ItacanTaskCore/shared/tests/interruption.test.cjs
ItacanTaskCore/shared/tests/production-admission.test.cjs
ItacanTaskCore/shared/tests/production-inventory.test.cjs
ItacanTaskCore/shared/tests/production-retention.test.cjs
ItacanTaskCore/shared/tests/project-binding.test.cjs
ItacanTaskCore/shared/tests/support.cjs
ItacanTaskCore/shared/tests/transport-compatibility.test.cjs
ItacanTaskCore/shared/tests/types.fixture.ts
ItacanTaskCore/shared/tests/validation.test.cjs
```

New files:

```text
ItacanTaskCore/shared/tests/compact-population.cjs
ItacanTaskCore/shared/tests/compact-proofs.test.cjs
ItacanTaskCore/shared/tests/compact-transport.test.cjs
ItacanTaskCore/shared/tests/compact-benchmark.cjs
ItacanTaskCore/shared/tests/compact-operations-benchmark.cjs
ItacanTaskCore/shared/tests/compact-history-benchmark.cjs
ItacanTaskCore/shared/COMPACT-VERIFICATION.md
```

Documentation updated: `shared/README.md`, `shared/CHECKPOINT.md`, this report. Original core and preceding production verification reports are preserved.
