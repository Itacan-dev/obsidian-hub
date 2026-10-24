# Git-shared origin/application protocol

Current deployment: **all eleven primary workspace owners are native**, including Itacan and Obsidian Hub with separate committed shared genesis identities. Ordinary startup, temporary task/Step persistence, all consumers and two eleven-writer graceful shutdowns passed. Shared lists are empty after smoke cleanup; the original Pulsed task and all182 Legacy History remain. Local handoff commit ac909287f196495f2ff0e57d3b7e92393bf89e6d is not pushed. Jinhao has not joined. See [final migration verification](FINAL-MIGRATION-VERIFICATION.md), [secondary onboarding](SECONDARY-ONBOARDING.md) and [CHECKPOINT.md](CHECKPOINT.md). Earlier implementation/performance results remain in DEPLOYMENT-VERIFICATION.md and COMPACT-VERIFICATION.md.

## Version boundary

| Contract | Current version |
| --- | --- |
| Portable `itacan-git-native` packet | 3 |
| Authoritative `itacan-git-origin-state` namespace | 2 |
| Immutable publication frame | 2 |
| Mandatory Git capability / creation option | `git-shared-compact-proofs-v2` / `gitSharedVersion: 2` |
| Receive command payload | 2 |
| Private-v4 Git barrier/lineage/envelope | 3, with the new mandatory capability |
| Reservation witness / retention marker | 2 / 2 (unchanged) |
| Project binding | 1; explicit protocol `{packet:3,originFrame:2,reservationWitness:2,transport:3}` |

Packet v2, frame/namespace v1 and unknown capabilities reject explicitly. No implicit upgrade is performed. The two real shared authorities use this version; no legacy native proof upgrade was performed. Private/Resource barriers, storage and receipt meanings remain unchanged. Authority derivation, Project namespace and reviewed genesis identities are unchanged.

## Compact evidence and validation

A frame retains its complete original canonical command and receipt, parent, replica, clock, allocation tape and inventory witness. Tasks already appear in the original receipt; the frame no longer embeds a complete repository view. Its sparse delta contains changed History records, exact binding removals/additions and new permanent Step retirements. A receive frame binds the original incoming packet head and canonical frame references.

Validation checks live portable bytes, frame hashes, exact fields, canonical order, complete causal closure, original guards, partition lineage, operation uniqueness and local receipt coverage. It reconstructs state by sharing unchanged immutable records internally. Native origins are replayed through the actual command interpreter with original clocks and allocation tapes. Result, delta and original receipt must agree exactly. Receive publications are checked against causal reconciliation, including persistent conflicting branches. A plausible final task snapshot alone proves nothing.

Two private bounded memos reduce repeated work: exact canonical namespace bytes may reuse a detached internal structural graph; a genesis/frame-hash proof fact may reuse previously successful native execution verification. Neither cache is persistent or caller-populated, and neither exposes mutable graph aliases. Every use checks live bytes/context; cold processes reconstruct and verify independently. No checkpoint authority is introduced. Synchronous domain/codec validation alone remains insufficient for origin execution proof.

Origin receipts remain immutable and never enter another replica's local receipt array. Receive has its own guarded local publication receipt. Operation reads/replay distinguish original receipt lineage from local application. Completion History proves the original event against that origin and its first local application. Null times, reopening, recompletion and deletion retain existing semantics and calculations.

## Git transport and ordinary runtime

Portable files live under:

```text
.itacan-native/v3/<authorityId>/objects/<frameId>.json
.itacan-native/v3/<authorityId>/heads/<declarationDigest>.json
```

Each object is stored once. Immutable head declarations bind genesis and head. Fully flushed objects are exclusively linked from private Temp staging; the head is published last. A crash leaves either unreferenced immutable objects or a complete verifiable head. No object becomes an accepted task outcome merely because it exists. Every declared head must bind the genesis of a maximal causal proof containing it; historical declarations cannot hide inconsistent genesis evidence. Only maximal heads need separate native reception. Missing, changed, truncated, foreign or incompatible evidence rejects. Nonempty old v2 transport is explicitly incompatible.

The existing 1,024-frame and 64 MiB packet bounds remain. The collection has at most 1,024 objects and 1,024 head declarations and a combined 64 MiB bound. Capacity failure is explicit; no automatic pruning or receipt rewriting occurs. Git is transport only: production code does not commit, fetch, merge or push.

Existing `session.shared` status/export/prepare/receive/reconcile and runtime synchronization remain in use. Exact retained requests precede dispatch; native receipts remain the only outcome authority. A committed unpublished operation exports from authoritative state after restart. Operator-reviewed uncertain replay keeps its original identities and guards. Actual disk/memory inventory and Phase observations still pin Project-salted reservation witness v2; nothing substitutes empty evidence. File notification watches head publication, while explicit processing/startup handles incoming Git data. Local publication is not proof another device has received it.

Independent-task changes converge. Concurrent same-task changes retain both branches and last accepted local state; conflicts survive and propagate. No conflict resolution UI or silent last-writer-wins behavior is added. Stale packets cannot resurrect deleted tasks, and repeated exchange creates no new events/receipts.

Production admission still requires verified Git-root/Project/genesis binding and coordinated compatible clients. Old clients must be excluded before real shared retirement/activation. Oath, Inbox, unsupported Phase/recurrence/nested editing and clear-completed guards remain. No real cutover or installation is authorized in this gate.
