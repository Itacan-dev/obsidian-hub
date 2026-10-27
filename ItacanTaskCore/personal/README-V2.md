# Personal sync v2: explicit conflict resolution

Implemented and verified in disposable repositories and genuine Obsidian client pairs; subsequently deployed and enrolled on the stationary Work installation under explicit authorization. See [CHECKPOINT.md](CHECKPOINT.md) for the current build, actual verification and private laptop handoff. The laptop is not yet paired/joined. V1 remains a separate interpreter. Git/N4 and ordinary unenrolled private repositories retain their existing contracts.

## Versions and identity

| Contract | Version |
| --- | --- |
| Capability | `personal-sync-proofs-v2` |
| Binding envelope / signed profile | 2 / 2 |
| Packet / namespace / new frames / command payloads | 2 |
| Prepared evidence | 2 |
| Retained personal record / marker | 4 |
| Enrollment / membership | Original 1, unchanged |
| Private storage / barrier / personal scope | `private-v4` / 5 / 2 |
| Transport heads / acknowledgements | 2 |

The envelope is `{format:"itacan-personal-binding",version:2,base,profile}`. `base` is the original validated v1 binding, including owner, authority, partition, seed and root identities. Membership certificates still bind its digest. `profile.create(base, rootSigner, legacyCuts)` signs the exact protocol tuple and one canonical cutoff per owner. The confirmed fingerprint pins the whole envelope; receiving another profile never updates that pin.

Fresh enrollment creates this envelope first, with empty legacy cuts, and directly executes `personal.enroll` under v2. There is no intervening v1 personal repository. Existing isolated v1 replicas require explicit `personal.upgrade`, after their original unresolved requests are reconciled. Only the complete validated ancestry of signed cutoff heads may contain v1 frames. Those frames, original receipts and signatures remain byte-preserved and pass the v1 interpreter before adoption. Later v1 origins outside the cutoff reject.

Barrier 5 requires `private-native-storage-v1`, `atomic-task-mutations-v1` and `personal-sync-proofs-v2`. Scope 2 pins the profile, original enrollment scope and exact transition command/operation/predecessor. Stronger RECOVERY evidence is durable before CURRENT moves. Older readers reject even when CURRENT still selects the predecessor; only the identical retained transition can finish that fence. Preparation alone does not fence an old writer. A changed predecessor makes the prepared transition stale.

## Task origin graph and resolution

`src/personal-shared-v2.js` reconstructs validated immutable origins separately from effective task heads and the displayed accepted view. Ordinary mutations derive a single task predecessor from their original before-state; they cannot write a conflicted task. Receive carries evidence, not a task-writing edge. A resolution supersedes exactly its reviewed maximal heads, preserving all branches.

The conflict digest commits to profile, authority, partition, task and sorted maximal origin IDs. Reviews with missing, extra, duplicate or dominated heads reject. Concurrent resolutions remain incomparable, even with identical chosen content. Late unknown branches create a new conflict. Repeated older delivery cannot revive a superseded conflict.

`src/personal-resolution.js` reconstructs a selected branch, its accounting and retirement consequences. No arbitrary replacement task, event or timestamp is accepted. The preview digest excludes fresh publication allocations and commit time. Native validation recomputes it before publication; receipts and sparse effects are independently replay-checked against the original command, guards, ancestry, allocation tape, inventory and signature. Resolution increments the task revision above the reviewed cut, uses the commit clock for modification and extends the selected content chain. It creates no completion event.

The personal port exposes:

```text
inspectConflict(taskId)
reviewResolution(taskId, selectedOriginId)
prepareResolution(review, operationId)
resolve(prepared)
inspectResolution(operationId)
```

The read-only review binds local head, task digest, full conflict, profile and admission/inventory/location observation. Changed evidence requires another review before retention. Ordinary public Save is unchanged. A coherent status export retries at most three changing snapshots; mutations and previews are never rebased by that retry.

## Completion accounting and retirement

Every genuine completion identity and its original creation proof stays in the audit catalog. Selecting a branch selects its accounting projection, including genuine reopening and previous resolution decisions. Events unique to losing branches become superseded and `counted:false`; resolution does not invent reopening times. The projection exposes accounting decisions and distinguishes original creation from first local application receipts. Resolution, receive and replay create no completion events. Existing History row fields and Statistics calculations are retained.

While a conflict remains, local Tasks and recovery stay usable, unrelated tasks stay writable, and owner History/Statistics remains explicitly incomplete. A typed History-conflict result does not revoke healthy host admission. The recovery modal previews changed counts, prior-date implications, event decisions, retired Steps and deletion consequences before one confirmation. Receipt confirmation means saved locally, not peer convergence.

Any known genuine deletion in the reviewed proof cut forbids a live result. Tombstone selection is supported. A live branch containing a retired Step is ineligible. IDs from losing branches remain reserved; discarded Steps retire. Already retired Steps are deterministically removed from a selected tombstone, with original content retained in branch evidence. Incompatible Step-retirement branches can have no eligible choice and remain blocked. There is no resurrection, constructed-result, field-level merge or per-event counting control.

## Recovery and transport

V4 retained requests use the existing store and writer. Original v1 personal and ordinary UI requests are read under their original contracts. A committed unresolved request is confirmed from its authoritative receipt, never recompiled. Uncertain publication preserves exact replay and recovery fences.

A terminal rejection is allowed only with a one-use native writer proof that publication was never attempted. The signed local record binds request checksum, command, authority, head and outcome; contradictory receipts/origins/fences reject. The original operation remains permanently non-executable. A new attempt needs a new reviewed operation. Receipt absence after a crash is insufficient. Git's existing rejection mechanism is unchanged.

V2 publication uses `.itacan-personal-sync/v2/spaces/<spaceId>/`, including `profiles/`, immutable objects, dependency-first heads and receipt-confirmed acknowledgements. Signatures bind v2 profile identity. V1 files are not overwritten. Missing dependencies or locations wait; corrupted evidence rejects. Membership, privacy/Git exclusion, exclusive final creation and readback verification retain their existing protections. Local state readiness is independent of transport freshness. Locally published does not prove cloud upload or peer receipt.

## Scope and next boundary

Functional tests include two separately registered vaults, independent local stores and keys, modal resolution, completion accounting, process death and actual application restart/shutdown. See [VERIFICATION-V2.md](VERIFICATION-V2.md) and [FILES-V2.txt](FILES-V2.txt).

Performance/scale acceptance and actual OneDrive cloud-delivery validation are not established. The user explicitly accepted prototype deployment without those earlier gates; actual peer joining and bidirectional cloud verification remain pending. No key rotation/revocation, owner-set extension, pruning, automatic downgrade, resurrection or constructed conflict results are supplied. Existing finite limits remain. OneDrive contents are not additionally end-to-end encrypted by this implementation.

The original review procedure is preserved in [ACTIVATION-V2.md](ACTIVATION-V2.md). Stationary enrollment has already completed; do not repeat it or regenerate the space. Use the current private handoff for secondary pairing and joining, with actual peer verification. Publication has crossed the rollback boundary; recover forward using existing proofs and retained identities.
