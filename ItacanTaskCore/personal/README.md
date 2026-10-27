# Personal synchronization v1

This document preserves the v1 contracts. The separate v2 profile and explicit conflict resolver are documented in [README-V2.md](README-V2.md). V1 is not silently upgraded.

Status: implemented, isolated acceptance verified; **inactive and uninstalled in Work**. See [VERIFICATION.md](VERIFICATION.md), [ACTIVATION.md](ACTIVATION.md) and [CHECKPOINT.md](CHECKPOINT.md). This profile does not change N4 packet/frame versions or reinterpret private owners as Git Projects.

## Identity and trust

A pinned `itacan-personal-binding` v1 identifies one sync-space UUID, its initial signing public key, and exact owner/authority/private-partition/physical-root/seed mappings. Existing source authority UUIDs, repository paths and task/Step IDs survive. Each device has a different replica UUID, Ed25519 key, local writer and local receipt sequence. `binding.fingerprint()` / `binding.confirm()` require an explicitly compared fingerprint. `membership.certify()` admits a paired public key; a file merely appearing in OneDrive grants no membership. Certified members can admit later devices without keeping the original device online. Membership v1 has no revocation or key-rotation operation.

`local-identity.js` stores only encrypted private-key material through Electron safeStorage outside the vault. It rejects unavailable protection and plaintext backends, and never regenerates a damaged existing identity. The genuine application tests exercise safeStorage encryption and readback. Test fixtures export disposable signing keys to their private Temp profiles; those files are not an activation procedure.

## Enrollment and version barrier

`enrollment.prepare()` validates and signs the complete existing schema-1 private logical state: source head and capability, tasks including tombstones, Steps/order/retired IDs, native events/bindings and original durable receipts. It is an explicit enrollment attestation of a structurally validated checkpoint, not fabricated replay provenance for historical private commands. It excludes Legacy application History, locks, permissions, activation and secrets. Unsupported source capabilities, recurrence/import namespaces and foreign owner partitions reject.

The source `personal.enroll` admitted writer transition preserves its historical receipt prefix. A joining `personal.bootstrap` creates its own first local application receipt; original source receipts remain immutable seed evidence and are never appended to the joining receipt array. The source and join operations have distinct retained command types and fixed operation IDs.

Storage remains private-v4 with mandatory `personal-sync-proofs-v1` capability, personal barrier v4, and exact personal recovery scope. Before CURRENT publication, stronger RECOVERY evidence prevents an older reader from selecting an earlier writable generation. An interrupted enrollment admits only the originally retained enrollment command, not ordinary private writes. Old-client rejection is tested against the captured pre-change codec/repository source.

## Proofs, receive and History

`src/personal-shared.js` provides separate personal namespace/frame/packet v1. A signed origin frame binds the original command/receipt, parent, replica, allocations, inventory and Phase evidence, sparse completion effects and receive references. Validation reconstructs the causal graph and executes the original native command interpreter; a plausible resulting snapshot alone is insufficient. Canonical hashes identify bytes, signatures identify admitted members, and causal/command validation establishes authorized effects. There are no new proof caches.

The minimal extracted `src/replication-graph.js` retains N4's conservative whole-task merge. Independent-task changes reconcile. Concurrent same-task changes (including Steps and edit/delete races) retain both origins, preserve the accepted local view and block mutation of that task. `personal.inspectConflict(taskId)` returns bounded branch content, deletion and completion evidence. Conflicts propagate to another replica and survive restart. **No writable conflict resolver is implemented.**

Completion identities and original receipt provenance remain immutable. Each replica records the first local application relationship separately. Reopening and recompletion retain native semantics; repeated receives create no extra receipts or events. Personal conflict detection is inside the authoritative History projection, so aggregate Statistics cannot present a conflicted owner as converged. Existing Legacy History and calculation functions remain unchanged.

The writer personal port exposes `export`, `status`, `prepare`, `prepareEnrollment`, `receive`, `confirmAccepted` and `inspectConflict`. Existing public task APIs are unchanged. Personal requests use retention v3 through the existing pending-request store and operator recovery. `personal/recovery.js` supplies a recovery-only facade before initial enrollment/bootstrap is acknowledged; it never allocates a replacement operation. The existing recovery modal can inspect/reconcile/review identical replay and then reopen that authority.

## Transport and application lifecycle

The vault transport is `.itacan-personal-sync/v1/spaces/<spaceId>/`, with `bindings`, `members`, and `owners/<authorityId>/{seeds,objects,heads,acknowledgements}`. Records are canonical and immutable. Publication stages and flushes on the same volume, exclusively links the final file, verifies readback and publishes heads after dependencies. Existing different bytes are never overwritten. A committed origin is recoverably exportable after process death without repeating its user operation.

Reception verifies pinned identities, membership/signatures, versions, complete ancestry and native execution before retained atomic apply. Missing dependencies, hydration errors and absent physical locations remain waiting states; missing locations produce no retained receive permission and never relocate tasks. Stable malformed files become invalid after repeated identical observations. Conflict-copy aliases are validated by content; timestamps do not select a winner. Signed acknowledgements require an authoritative matching local-application proof, not merely a peer file.

Before publication, path/junction checks and read-only Git checks verify the actual paired vault and untracked, effectively ignored evidence. The root ignore rule is `/.itacan-personal-sync/`. The personal exporter cannot produce collaborative Git packets. Already-tracked evidence blocks publication; it is never untracked automatically. OneDrive transports readable task content; this version provides signatures, **not extra end-to-end encryption** or proof of cloud upload.

The production host reads an explicit device-local sealed activation overlay; imports create no authority, key or space. Ordinary local readiness is independent of background sync. A bounded queue and coalesced known-directory/metadata notifications drive publication and receive after readiness; no full-vault scan or remote-ack wait is required. Closing stops new work and drains accepted local work; no live locks or recovery fences are bypassed. `synchronization().status()` distinguishes checking, published, waiting evidence/location, acknowledged, conflict, capacity and error. The existing recovery modal exposes status/retry without a separate task UI.

Limits: 1,024 origins/transport records per collection, 64 MiB transport budget, 32 member records; approaching capacity is reported. No compaction/pruning, owner-set extension, key recovery/revocation or conflict-resolution write operation is provided. Full validation remains enabled and measured small-fixture sync cycles take seconds; review that latency before everyday activation.
