# Explicit resolution: protocol review required

Historical v1 boundary record. The subsequent approved versioned implementation is complete in isolation; see [README-V2.md](README-V2.md) and [VERIFICATION-V2.md](VERIFICATION-V2.md). The original v1 candidate and this earlier review remain preserved in the durable v1 audit.

Disposition: **stopped at the requested compatibility boundary; no resolution implementation**. The attached request explicitly says: “If a complete resolution implementation requires a new protocol version or a material change to immutable evidence semantics, document that requirement and stop for review rather than forcing compatibility.”

## Demonstrated incompatibility

The current personal v1 proof grammar is closed:

- `src/personal-shared.js:6-7,70`: only five ordinary task commands and personal.enroll/bootstrap/receive are admitted as origins. `src/commands.js:8-17` rejects an unknown resolution command.
- `personal/binding.js:8`: the entire capability tuple is exactly packet/frame/enrollment/member v1, retention v3, personal-sync-proofs-v1. It cannot declare resolution support.
- `src/personal-shared.js:94`: an ordinary task command targeting an existing conflict rejects. Relaxing this would make task.save an implicit resolver, expressly forbidden by the request.
- `src/replication-graph.js:13-38`: conflict evidence is accumulated, including unaccepted branches. A later single task head does not remove a recorded conflict. Acceptance and supersession are not separate relations. Removing a conflict from serialized state would fail reconstruction/receipt validation, and a stale packet would otherwise reintroduce it.
- `src/private-storage-codec.js:7-24`: the enrolled repository barrier exposes only personal-sync-proofs-v1. Reusing that capability would let an older client open/write an authority without knowing resolution semantics until it encountered an incompatible frame.

Therefore this cannot be implemented as a backward-compatible recovery-modal change or a new interpretation of task.save/personal.receive. It needs explicit personal-only proof/capability negotiation and new causal resolution semantics. No existing frame, signature, receipt or seed should be rewritten. Git/N4 and ordinary private/Resource behavior need not change.

## Required next contract

Subject to review, the minimal extension would introduce a separately admitted `personal.resolve` origin and a new personal protocol/capability version. Its retained command would commit to the exact reviewed conflict digest, complete sorted maximal competing origins, current authority/task/local publication guards, intentionally selected result, and explicit completion/deletion consequences. The new proof must verify those branches and their causal closure, preserve them, and record a distinct supersession relation. A resolution is a new command/receipt, never replacement evidence.

Only the explicitly reviewed conflicting branches may be superseded. A newly received third branch requires renewed conflict review. Concurrent competing resolutions must remain independent conflicting task origins. Repeated delivery/restart must not create extra effects. An upgraded reader may validate existing v1 origins unchanged, but old v1 writers must fail closed against a resolution-enabled authority, including interrupted capability transition. The precise new version tuple/barrier has intentionally **not** been implemented or assigned here.

Two additional effect contracts require explicit treatment:

1. **Completion counting.** The current merge replaces a task's materialized History/bindings with the selected branch's view. That is insufficient for resolution: concurrent genuine completions may contain two immutable event identities, and completion/reopening branches differ in active bindings and counted state. Selecting a task snapshot must not silently drop an event or fabricate a reopening. Resolution needs separately proven event preservation and an explicit, user-reviewed accounting decision, while retaining original creation provenance and local-application receipts. There is no current conflict-superseded counting transition to reuse.
2. **Deletion and Step retirement.** `atomic-task.js` and `commands.js` reject writes to deleted tasks. Retired Step IDs remain reserved. Selecting a live branch against a deletion, or selecting a Step version whose identity another accepted branch retired, cannot be treated as an ordinary save. The extension must either define and validate these explicit effects or keep those choices unsupported. No resurrection/reuse exception was introduced.

A small branch-choice modal can be built in the existing recovery workflow after these contracts exist. It should show branch content, Step changes, completion evidence and deletion consequences, prepare the guarded resolution, confirm it explicitly, and report success only from the admitted receipt. No such controls were added to the current v1 candidate.

## Checks performed in this investigation

Thirteen existing focused checks passed (replication, History/location and corruption suites), including two-replica conflicts, third-replica propagation, retained original branch receipts, read-only conflict guards, completion/reopening/deletion provenance, duplicate receive and forged evidence rejection. These are **v1 regression results, not resolution acceptance**. No new two-client resolution test or new genuine-Obsidian run is claimed, because no resolution command was implemented.

No source logic, installed bundle, live native repository, activation, Legacy History or Git index/history was modified. Only this review document and a checkpoint link were added. The installed main.js remains SHA-256 `1803388fc661b5560492ffeb7080f53c5be01d93c2caf00bf530389f5991dd5b`.

## Durable preservation

Device-private nonsynchronized staging:

`%LOCALAPPDATA%/Itacan/DevelopmentEvidence/PersonalSync/v1/pre-resolution-bea8dfc0ace4/`

It contains 307 hash-verified files (9,225,588 bytes): the previous candidate/audit, current implementation source snapshot, captured private test evidence, and selected genuine-application command/results/reports. Full application profiles and disposable signing-key contexts were not added to the selected application evidence. It is outside the vault and Git; do not publish it, because the prior audit contains private captured task state.

`PRESERVATION-v1.json` records each copied file's size and SHA-256. Candidate path within this root: `prior-audit/candidate/main.js`; SHA-256 `ade4edd44bbb553cb996ccb26beaddd329a4f0497632796229649bb34c82ee41`. `prior-audit/resolution-contract-investigation.log` contains the 13 passing checks. The original Temp candidate and audit remain intact.

The inactive candidate is **not yet functionally complete for everyday personal synchronization**: conflicts remain blocked. Review/authorize the personal-only versioned resolution extension and its completion/deletion contract before resuming implementation. Existing performance and actual-OneDrive validation remain separate subsequent gates.
