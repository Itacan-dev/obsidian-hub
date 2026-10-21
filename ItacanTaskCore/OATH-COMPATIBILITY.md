# N1-F2 — Inactive Oath compatibility adapter

Private, explicitly imported, storage-free code. No existing entry point, production Oath reader, writer, startup or enforcement source imports this package. Import `oath/adapter` and its private sibling proof contract directly. F1 observations and source graph remain unchanged.

## Evidence and ordering

N0 task DTOs establish display state, not a current binding or creation receipt. `CompletionEvidencePortV1` is a private contract for a future trusted host. F2 includes only a test provider. That provider validates actual logical state, invokes unchanged F1 resolution and completion assessment, and projects the exact current parent binding, canonical event and committed creation receipt. It uses the actual N0 Task Service dispatch and task projection. It never derives current bindings from History ordering.

Receipt excerpts omit raw canonical payloads, source envelopes, capture contents, identity ledgers, unrelated receipts, Oath context and Strict/device secrets. Their digest identifies the actual full stored receipt. It is not a signature, hostile-writer defense or a separate storage authority.

F1 proves completion after an open native preparation snapshot. An independent Oath save can still be in progress when that completion commits. In that sequence F1's native comparison can be true while F2 returns `ENROLLMENT_ORDER_UNPROVEN` and retains checked display state. No timestamp or comparison between plugin-data and native revision numbers is used.

Positive eligibility is explicitly `CLOSED_SYNTHETIC_POST_ENROLLMENT_COMPLETION`: a controlled fake host first acknowledges the exact Oath save, then observes an open native cut, then commits genuine completion. The cut, session, physical owner, target set and authority are pinned. The provider verifies the cut's exact committed receipt remains in validated current lineage. Completion must be strictly after that cut and remain the currently counted binding. Null/backdated completion timestamps do not disqualify such work.

The witness is volatile. Ordinary preparation, lost acknowledgement, reconstruction, provider epoch change, outage or uncertain recovery cannot restore it. Completion during the save or before the post-save cut remains unqualified. This can conservatively reject genuine work. There is no production durability guarantee, live enrollment mechanism, persisted native Oath reference or cross-authority atomic commit.

## Adapter lifetime

`createOathAdapter` receives immutable session/target/owner/authority scope, N0 reads and the private proof port. It allocates no identities, opens no storage, starts no host and persists nothing. Construction is dormant; first refresh acquires both subscriptions before reading. Providers remain caller-owned.

Invalidations immediately revoke cached qualification and coalesce. Each capture checks N0 readiness, reads task DTOs and one proof batch, matches every target/revision/owner/partition/Step hierarchy/state, and rechecks readiness. An unstable capture gets three attempts, then `recovering/SNAPSHOT_UNSTABLE`. Generations discard superseded responses. Exceptions yield coded private unavailable results. Observers cannot change evidence. Refresh is safe from observer callbacks.

Snapshots are deeply frozen. Raw proof excerpts are not published in callbacks. Dispose cancels accepted read lifetimes, releases only owned subscriptions and clears snapshots; late results cannot publish. Changing commitment/owner/authority requires a new instance. A reconnect never silently reanchors enrollment.

These are as-of-snapshot guarantees, not leases. N0 notifications are ephemeral. The future host must establish authoritative freshness, coherent capture and recovery invalidations; F2 cannot prove a missing production provider delivered external changes.

## Existing Oath behavior

Display progress uses actual checked parent state with independent nested Steps. A separate qualified projection supplies actual `fulfilmentTime` and actual `HubOathService.captureFulfilment/markFulfilled` in a test-only wrapper. The wrapper temporarily changes the work input during that synchronous capture and restores display input; it does not copy fulfillment or outcome logic.

Actual activation, save, break/cancel, terminal writer and Strict recovery methods are exercised with controlled fake hosts. Existing persisted `{id,path,text}` references remain unchanged and explicitly mapped in these tests. Pure-native task-without-note cases use source-independent DTO/navigation/helper seams. Native DTOs are never disguised as legacy source DTOs. Production `resolveWork` cannot yet accept these native projections; future adoption needs a separately reviewed integration.

Scheduled work can qualify before activation but cannot fulfill until active. Reopening decreases current progress until a latch exists. Recompletion uses its new current event. Deadline and existing latch semantics continue even when task evidence is unavailable. The adapter creates no event, latch, outcome counter or outcome store. Actual terminal records retain session identity `(deviceId,oath.id)` and repeated accepted termination sees terminal state.

The existing in-process latch survives a failed save and subsequent reopening. Its survival after interruption before publication is not established; reconstruction tests demonstrate its loss. No repair is included.

Historical import, `history.record`, completed creation and Step completion are not genuine newly performed parent work. Imported checked state remains visible. B2 commitments stay on occurrence A; successor B and its fresh Steps are never inherited. A's recompletion uses current E2, independently of original generation trigger E1. Missing/contradictory successor evidence or recovery uncertainty cannot grant completion.

## Ownership, privacy and recovery

One physical owner is required. Both shared Projects, a private Project and all four Resources are covered. Mounts do not change ownership or permit Resource enrollment as a Project task. Owner/partition mismatches, ambiguity, pending publication, quarantine, deletion and retirement retain explicit dispositions. Parent-only commitments protect the whole tree until terminal state; no active commitment is migrated.

Navigation returns native-task, owner-qualified location or explicit provenance intent. It never searches by title or manufactures a Markdown note. All adapter/evidence output is private. Public native transport remains N4 work. Existing direct/repository import-dependent export guards and repository recurrence guards remain unchanged.

Legacy sharing has broader existing behavior: tracked Hub ID comments, ID-selected metadata without an inner field allowlist, and observed captureSource paths outside approved shared roots. These are documented findings, not permission to export native aliases, receipts, source envelopes, Oath outcomes or Strict/device state.

Runtime F2 opens no authority. Disposable tests explicitly create private-v4 only in verified empty Temp directories and reopen the same authority. E2-R stopped-flat forensic-only rules, old-reader rejection, monotonic barriers and scoped fences remain intact. No fence-clearing operation is added. Affected or unknown recovery evidence cannot newly qualify; unrelated evidence requires independently validated scope.

## Verification and limits

The five explicit F2 test files cover proof joins and corruption; unsafe/synthetic order; exact identity and ownership; independent Steps; actual imports and recurrence; races/disposal/epochs; actual Oath lifecycle; private export sentinels; and actual parent-terminated children at existing save/native boundaries. See the verification report for executed counts and raw-log archive.

Real interruption tests delegate actual `HubDataStore.atomicWrite`, pausing child-local wrappers after flush or around rename, plus existing native acknowledgement hooks. Synthetic shared saving is disabled in that harness, so no cross-file shared-save atomicity is claimed. Dead native locks are verified by PID/host/token and process death, then preserved inside the same disposable root. Raw state and lock evidence is copied into the Temp audit before cleanup.

Claims are limited to tested cooperative local persistence and process interruption. Exclusions: power loss, cloud/directory rollback, hostile writers, distributed uniqueness, atomic N1-B consumption, durable enrollment coordination, native authority restoration for an Oath, and unsaved-latch recovery.

N2 owns hosting and the authoritative proof reader; N3 owns durable enrollment and writer coordination; N4 transport/privacy; N5 rehearsals/committed-tree protection; N6 separately approved activation. Stop for review after F2.
