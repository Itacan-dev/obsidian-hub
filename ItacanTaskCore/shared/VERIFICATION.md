# N4 receipt provenance and synchronization verification

Implemented and verified the inactive Git-shared core protocol. This is not an
ordinary-Itacan deployment or either shared-Project cutover.

## Result

- The exact predecessor counterexample was reproduced before editing: original
  receipt union, receipt renumbering, command rewriting and stale original
  reapplication all failed as previously recorded. Nine diagnostic checks passed.
- The replacement actual-repository test starts both branches at revision 2;
  independent atomic Saves produce their original revision-3 receipts. Both
  original canonical receipts remain identical in their immutable origin frames.
  Each receiver publishes its own valid revision-4 application receipt. Tasks
  converge and repeat reception produces no publication.
- Actual bidirectional Git exchanges use two independent clones and a disposable
  local bare repository. Creation, edit, Step identity/content, civil dates,
  offline creation, independent edits, completion, replay, reopening/recompletion,
  stale packets, deletion and persistent same-task conflicts passed.
- Third-replica conflict propagation was separately tested: both heads remain
  visible, the last accepted local task survives and edits stay blocked. Its
  original failing output is retained. A stale registry replay admission gap was
  also corrected within the Git-specific mode; final publication still checks
  registry, revocation and cancellation.
- The last complete Git workflow took **410.827 seconds**. This is test duration,
  not a primary operation benchmark. Full-view evidence and repeated validation
  are expensive; no interactive-performance or large-population claim is made.
- Final-source reconstruction revalidated both actual Git test repositories:
  revisions 13/14, 24 immutable frames each, 13 accepted native origins each,
  one preserved conflict each and the same two completion-event UUIDs. Exact
  repeated reception remained a no-op. All test writers closed cleanly.

## Contracts

Packet version 2 and namespace/frame version 1 use an explicit version-3
private-v4 capability barrier. Original command/receipt/clock/allocation evidence
is immutable. A new local `git.receive` publication has its own linear receipt;
accepted-origin and conflict relationships are authoritative generation data.
Unique local receipt revisions and receipt coverage were not relaxed.

Actual generation verification and receive replay every source command through
the native interpreter. Rehashed forged effects, receipts, guards and allocation
proofs reject. Private/Resource barriers retain their original interpretation;
they cannot silently upgrade. The actual unchanged frozen older reader refuses
new version-3 codec output without fallback.

History exposes the original event provenance plus its first local application
reference. Operation reconciliation likewise distinguishes source evidence from
local publication. Original events/titles/owners/times remain stable. Valid null
completion time, reopening suppression, recompletion and deleted-target History
were checked. The existing completion feed, typed legacy IDs, deduplication and
all five full Statistics models were reused unchanged.

Git transports immutable, content-addressed files only. No real Git operation is
performed by the transport module. A committed receive with conflicts acknowledges
preservation of evidence, not full application of the conflicting branch.
`session.shared.status` exposes bounded conflict/readiness information after
restart. Invalid, fenced, stale-context or contradictory evidence stays blocked.

## Focused execution

| Selection | Result |
| --- | --- |
| New N4 tests: eight focused files plus actual Git round trip | 24 passed |
| Existing affected core/content/atomic/editor/host/writer/History/codec selections | 410 passed |
| Existing retained-request and practical recovery selections | 38 passed |
| Relevant declaration runners, including new N4 fixture | 7 passed; zero diagnostics |
| Baseline/candidate staged production builds | Both passed |

The 410 selection explicitly ran: `tests/contract.test.cjs`,
`tests/source-content.test.cjs`, `atomic-task/tests/{atomic-save,rich-create,
completion-effects,admission-replay}.test.cjs`,
`integration/tests/{history-read,history-accounting,history-statistics}.test.cjs`,
`host/tests/scoped-capture.test.cjs`,
`editor/tests/{single-capture,coherence}.test.cjs`,
`writer/tests/{admission,replay-lifecycle}.test.cjs`, and
`tests/storage-compatibility-repair.test.cjs`, all beneath `ItacanTaskCore/`.
The additional 38 are `integration/tests/pending-recovery.test.cjs` and
`integration/tests/request-recovery.test.cjs`.

Declarations: new `shared/tests/typecheck.cjs`, core `tests/typecheck.cjs`,
`host/tests/typecheck.cjs`, `writer/tests/typecheck.cjs`,
`atomic-task/tests/runtime-typecheck.cjs`,
`integration/tests/history-typecheck.cjs`, and
`tests/storage-compatibility-repair-typecheck.cjs` (TypeScript 6.0.3).
Mutable execution used the established OS-Temp isolation guard and the local
VS Code Electron executable in Node mode. No existing tests or frozen assertions
were edited. The full historical archive and its known current-source byte-hash
assertion were not rerun; this report does not claim that archive is green.

One new real process-death boundary was exercised: after receive CURRENT
publication, before acknowledgement. Exact request/packet, command, PID, host,
exit status and lock bytes/hash were preserved. The parent proved death and
exact lock identity before moving only that disposable child's lock. Reopening
confirmed the local receipt; identical replay changed no state and duplicated no
event. Corrupt acknowledged generations remain closed; existing recovery fences
also reject export, receive and replay. No production lock was moved.

## Production preservation and builds

All **115 protected files** match the fresh baseline, including `data.json`,
shared-Project Markdown, all twelve installed assets and all nine real native
roots. There are no new files or writer locks in those nine roots. The **182
legacy History records** remain byte-preserved with application data. No real
repository was opened and no Markdown was retired in this gate. Dirty Git state
was retained; there was no real commit, fetch, push, merge, reset or cleanup.

The baseline build, reconstructed from exact pre-edit source bytes without
restoring the workspace, exactly matches installed `main.js`:
`f863129c004dfcb73f7d8bc7f2e78593207fafca388106f1ee436857503220a5`.
Candidate `main.js` is staged only:
`03326fee30c95c1e2803d0ca8797ace2938471be05bbe08c1f3195d5d300a199`.
Factory count changes 238 → 239: one added `src/git-shared.js` factory and changes
only to the fourteen authorized core/host/writer JavaScript factories listed
below. `plugin.js`, ordinary startup, all plugin UI/service factories and the
25-factory `atlas-native.cjs` output are unchanged. No assets were installed.

## Exact file inventory

Existing files (20):

```text
ItacanTaskCore/host/authority.js
ItacanTaskCore/host/index.d.ts
ItacanTaskCore/host/repository-host.js
ItacanTaskCore/src/commands.js
ItacanTaskCore/src/completion-effects.js
ItacanTaskCore/src/contracts.d.ts
ItacanTaskCore/src/domain.js
ItacanTaskCore/src/history-read.d.ts
ItacanTaskCore/src/history-read.js
ItacanTaskCore/src/json-repository.d.ts
ItacanTaskCore/src/json-repository.js
ItacanTaskCore/src/private-storage-codec.js
ItacanTaskCore/src/repository.js
ItacanTaskCore/src/serialization.js
ItacanTaskCore/src/snapshot-read.d.ts
ItacanTaskCore/src/snapshot-read.js
ItacanTaskCore/writer/admission.js
ItacanTaskCore/writer/index.d.ts
ItacanTaskCore/writer/policy.js
ItacanTaskCore/writer/repository-writer.js
```

New files (21):

```text
ItacanTaskCore/shared/CHECKPOINT.md
ItacanTaskCore/shared/README.md
ItacanTaskCore/shared/VERIFICATION.md
ItacanTaskCore/shared/git-transport.d.ts
ItacanTaskCore/shared/git-transport.js
ItacanTaskCore/shared/tests/bootstrap.test.cjs
ItacanTaskCore/shared/tests/crash-worker.cjs
ItacanTaskCore/shared/tests/git-roundtrip.test.cjs
ItacanTaskCore/shared/tests/history-conflicts.test.cjs
ItacanTaskCore/shared/tests/interruption.test.cjs
ItacanTaskCore/shared/tests/origins.test.cjs
ItacanTaskCore/shared/tests/statistics.test.cjs
ItacanTaskCore/shared/tests/support.cjs
ItacanTaskCore/shared/tests/transport-compatibility.test.cjs
ItacanTaskCore/shared/tests/typecheck.cjs
ItacanTaskCore/shared/tests/types.fixture.ts
ItacanTaskCore/shared/tests/validation.test.cjs
ItacanTaskCore/shared/tests/writer-support.cjs
ItacanTaskCore/shared/tests/writer.test.cjs
ItacanTaskCore/src/git-shared.d.ts
ItacanTaskCore/src/git-shared.js
```

## Remaining ordinary-Itacan boundary

Both real Git-shared Projects remain Legacy. The nine existing native owners
remain unchanged. No client compatibility or real shared activation is claimed.

The production caller still needs reviewed Git-root/genesis binding and explicit
receive/export integration with existing retained-request recovery. This first
proof grammar requires an empty external-reservation ID witness and no Phase
inventory; a nonempty production inventory must not be silently discarded or
exported. Retention-enabled Git preparation currently rejects with
`SHARED_RETENTION_ADOPTION_REQUIRED`. There is no second request/outcome store,
automatic uncertain retry, production Git watcher or conflict-resolution UI.
Packet/frame capacity and performance limits are explicit in `README.md`.
Participating-client compatibility and archive-and-switch authorization remain
necessary before either real shared-Project cutover. No old tasks or History
will be automatically imported.

## Reproduction evidence

Raw outputs, exact originals, counterexample transcript, protected/source/build
comparisons, command logs and failure evidence:
`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-n4-proof-rit0dbje`.
Actual Git copies/transport: `C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-n4-origin-yDhktk`.
Final process-death evidence: `C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-n4-origin-1N6i8P`.
The source checkpoint is `CHECKPOINT.md`; no large ZIP archive was created.
