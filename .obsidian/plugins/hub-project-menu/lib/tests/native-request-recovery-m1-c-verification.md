# Milestone 1C — Practical native request recovery

Implemented and verified in disposable storage only. Stop for user review. Ordinary production startup, archiving, Markdown retirement and native activation remain unchanged and unauthorized.

## Cause and narrow correction

`host/pending-requests.js::requireResolved` deliberately required a matching receipt for every retained operation found at reconstruction, including the operation explicitly being retried. A request retained before dispatch could therefore block its own identical replay forever. Separately, `writer/repository-writer.js` retained a process-local uncertain-operation blocker even after the retained-request reconciliation port confirmed its receipt.

Default behavior remains conservative. The new explicit operator path admits one exact retained operation under a one-use, instance-bound review. Matching receipt reconciliation clears only the matching process-local blocker; normal admission still checks every other retained request. No retained evidence is removed or rewritten.

## Private operator interface

The existing runtime exposes:

```js
const review = await runtime.recovery.inspect(operationId);
const reconciliation = await runtime.recovery.reconcile(operationId);
// Only after explicit operator review, when review.canReplay is true:
const outcome = await runtime.recovery.replay(review);
```

`inspect` returns bounded codes, authority/context, operation identity, record/command digests, owner/partition, accepted observation, receipt reference and task/event IDs. It classifies confirmed commitment, confirmed commitment with failed presentation refresh, missing receipt/execution uncertainty, conflicting evidence, damaged retention and unavailable authority/lease/recovery. It exposes no command body, task text, original intent, lock token or physical path. Inspection does not execute an operation; tests compare the actual repository files before and after inspection.

`reconcile` uses the existing authoritative operation projection. A validated matching receipt confirms the original outcome and clears its matching in-process writer blocker. Current presentation is refreshed separately and returned with its own stamp. Failed presentation refresh remains known commitment, not mutation failure. A missing receipt remains uncertain. No receipt, task or event is produced by reconciliation.

`replay` requires the original issued review object from this runtime. Cloned, forged, consumed and reconstructed reports are not authorization. A new process requires a fresh inspection and explicit review. The lower retained-request port supplies equivalent inspect/replay methods under a current writer capability. There is no automatic replay loop.

## Conditions and safety argument

For a missing receipt, replay requires:

1. The immutable original request and marker validate, including complete intent, writer request, command digest and checksum.
2. An accepted, intact observation from the same authority, original registry/identity context and current lease is available.
3. The root already has the existing atomic-task capability. Such roots block all writes and mutation replay after known fallback. No capability is enabled or root upgraded here.
4. The original repository and partition revision guards still match the accepted head. Task/content/tree/binding and all other original guards remain enforced by the existing execution boundary. A guard failure leaves the request unresolved; nothing is rebased.
5. Every other retained request is already confirmed.

For an existing matching receipt, replay retrieves that original result; it does not recreate deleted targets or apply stale mutation guards as new effects.

The actual unchanged `TaskRepository.execute` loads and validates authoritative state, checks writable/fence restrictions and writer admission, then compares the complete canonical command against the immutable receipt before applying any command. A different payload under the same operation ID conflicts. Without a receipt it still enforces original repository/task/content/partition guards, constructs one candidate and publishes effects with the receipt. Receipt history is not pruned from logical state. Thus the permission does not infer nonexecution from absence: it permits the same guarded, idempotent operation through the existing boundary on the exact reviewed head. If it previously committed, the original receipt wins; if its original guards are stale, it cannot create effects.

The permission lives only in private WeakMaps and the existing admission ticket's in-memory authorization. It binds the retained checksum, accepted head/revision ID, host epoch, original context pins and current writer grant. The immutable request is rechecked at admission and final publication; actual context is re-observed at both boundaries. The permission is consumed, revoked on completion/cancellation and invalidated on close. No public execution signature, retained repository handle or forged object can supply it. The ordinary writer methods still ignore additional arguments and reject unreviewed reconstructed requests.

No generation, serialization, codec, receipt, command, domain or recovery format changed. `REQUEST-RETENTION-v1` bytes and native receipt meanings are unchanged. No durable bypass flag, second journal, application-store outcome authority, fence reset or lock-breaking API was added. This retains the existing cooperative-local persistence assumptions and does not add detection of complete-directory rollback or hostile copied authorities.

## Executed verification

| Final selection | Result |
|---|---:|
| New operator recovery, scope/integrity and interruption tests | 20/20 |
| Unchanged M1A controller/retention selection | 30/30 |
| Focused writer admission/replay, host lifecycle/scoped reads and application replay/privacy | 118/118 |
| Total Node test-runner cases | 168/168 |
| New and relevant existing declarations | 7 runners, zero diagnostics |
| Existing genuine-Obsidian Project rehearsal plus operator recovery | 12/12 |

The tests use actual native repositories, writer admission, application mutation adapters and receipt observations. They cover ordinary create/Save; lost acknowledgement; transient refresh failure; reconstructed missing receipt; default replay rejection; explicit safe replay; identical committed replay; unchanged original request/task/Step IDs; no duplicate events; resumption of normal writes; conflicting digest; corrupt retention; stale guards; changed context; invalid lease; closed writer; forged/transferred/consumed reviews; revoked grants; other unresolved requests; cancellation; final-publication retention/context changes; known fallback; and committed creation followed by deletion.

Two new actual parent-terminated scenarios interrupt permitted replay immediately before CURRENT replacement for checked rich creation and immediately after replacement for atomic Save completing parent and Steps. Each retains the exact command/arguments, original record, review, raw files, PID/host/token, exit/signal and lock bytes/hash. The parent proves death and unchanged lock identity before moving that exact lock inside its verified disposable root. Before publication, reconstruction remains missing/default-blocked until a new explicit review. After publication, reconstruction confirms the original receipt. Exact replays retain task/Step IDs and original committed event IDs, add no effects and permit subsequent normal operations. The unchanged M1A suite also ran its existing five process interruptions.

The genuine-Obsidian check extends the existing isolated Project rehearsal through a test-only loader; its launcher, preload and ordinary UI fixtures remain unmodified. It obtains genuine APIs, retains and reconstructs a request, inspects uncertainty, verifies default replay remains blocked, explicitly replays the original request, reconciles its receipt, verifies no duplicate completion, and performs a subsequent ordinary action. No production Itacan onload or installed bundle is loaded. No new recovery window or browser prototype was built.

Initial failures are retained: one new lease-loss test intentionally changed its own lock token and initially failed fixture cleanup; cleanup now verifies the exact test-authored bytes/live PID/Temp root before restoring only its own injected token change. Another new test initially constructed an inconsistent second synthetic record operation ID; the fixture now binds that record's correct original ID. Safety assertions and all existing tests are unchanged. No historical source-byte assertion was weakened or reclassified; unrelated historical archives were not rerun.

## Exact source boundary

Six existing files changed:

```text
ItacanTaskCore/host/pending-requests.js
ItacanTaskCore/host/pending-requests.d.ts
ItacanTaskCore/host/repository-host.js
ItacanTaskCore/writer/repository-writer.js
ItacanTaskCore/integration/project-runtime.js
ItacanTaskCore/integration/project-runtime.d.ts
```

The authorized maximum's `writer/index.d.ts` remains unchanged; the retained port declarations are supplied through its existing imported interface.

Seven new files:

```text
ItacanTaskCore/integration/tests/request-recovery.test.cjs
ItacanTaskCore/integration/tests/request-recovery-interruption.test.cjs
ItacanTaskCore/integration/tests/request-recovery-crash-worker.cjs
ItacanTaskCore/integration/tests/request-recovery-types.fixture.ts
ItacanTaskCore/integration/tests/request-recovery-typecheck.cjs
ItacanTaskCore/integration/tests/request-recovery-obsidian.cjs
.obsidian/plugins/hub-project-menu/lib/tests/native-request-recovery-m1-c-verification.md
```

## Preservation and remaining limits

The fresh baseline saved seven authorized originals, 798 dirty-status entries and 1,806 existing source/protected/installed hashes. All mutable fixtures, native authorities, owned Obsidian profiles, logs and builds are in verified guarded OS Temp. All twelve installed production assets remain byte-identical. Baseline/final staged assets also match exactly: main 171 and Atlas 24 factory IDs/counts are unchanged, with one ordinary Legacy Task Service construction and no native production import.

Application data, including History/checks, task metadata, Oath, Inbox, planning and Music, matches the baseline. Observed `.obsidian/workspace.json` drift was saved privately without restoration or attribution. Other inventoried nonallowlisted files match. No live native pointer/generation/lock/retention artifacts were found in the workspace outside backups. Existing dirty work was preserved.

Corrupt/unknown retention that prevents opening still prevents an authority from opening; this gate does not repair it. Corruption discovered in an open session is classified against an accepted native observation. Changed original context, stale guards, conflicting/missing unsafe evidence, another unresolved request, unsupported older-root safety, unknown ownership and existing recovery fences remain blocked and require a separate evidence-based decision. A failed or uncertain operation is never replaced with a new identity, and a deleted committed target is never recreated.

Ordinary startup still needs separately reviewed native host construction/routing and an operator entry point for this private recovery interface. Archiving old tasks, preserving Markdown backups, retiring active checkbox sources, manual native recreation and real activation remain deferred. No automated conversion or legacy History import work was performed or added as a prerequisite.

Exact arguments, stdout/stderr, scalar exits, failures, originals, interruption evidence and comparisons:

`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-m1c-4e3llyqr`

Genuine Obsidian evidence:

`C:\Users\El_Baraka 2025\AppData\Local\Temp\itacan-real-host-GzY7uk\evidence`

No large archive was assembled. Milestone 1C is complete within the tested disposable scope. Stop for user review before production startup integration or any real task retirement/activation.
