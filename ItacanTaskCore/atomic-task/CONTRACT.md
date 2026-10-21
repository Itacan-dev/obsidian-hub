# N3-B2-A: frozen atomic-task proposal

Decision revision: `N3-B2-A-r1`. This package contains declarations, evidence and tests only. `task.save`, `task.createRich`, effects, enabled-root creation and proof v2 are not implemented. The production Legacy Adapter remains authoritative. Stop for review after A; B requires separate authorization.

## Selected boundary

Use two task-specific native-local commands, one detached candidate, the existing repository queue, one CURRENT publication and one authoritative normal receipt. No generic batch, callback, new store, journal, replacement authority or cross-store outcome. Full Save uses a hybrid complete metadata/content/tree draft and explicit completion/deletion intentions. Rich creation uses the existing constructor plus N1-C current content and the shared initial-event machinery.

The user selected: contracts/evidence before implementation; defer rich editor reads; allow prepared-occurrence reopening with edits; reject prepared-occurrence completion through Save; capability only at explicit new disposable-root creation; no existing-root upgrade; all writes and mutation replay blocked after known fallback in enabled roots, including standalone handles. Older roots retain their existing rules. Digest fields identify trusted local evidence; they do not authenticate a hostile writer.

`contracts.d.ts` is the normative proposed shape. It is deliberately absent from every runtime entry point. Type acceptance establishes a proposed contract, not core dispatcher support.

## Guards, omission and identities

Commands require a stable operation ID and repository revision. Save also requires task revision, authority/store ID, exact physical owner/partition and partition revision, content revision, complete old-tree digest, every current parent/Step binding and recurrence membership evidence. Native writer registry/identity/inventory/Phase pins remain bound through its existing coordination evidence. Application v2 binds the entire stable intent through its deterministic reason. Transport signal and opaque capability are volatile; no stable requested effect is discarded.

Hash definitions use the existing portable SHA256 and canonical JSON, preserving array order:

- Task digest: SHA256(canonical exact NativeTask snapshot), used privately.
- Tree digest: SHA256(canonical exact `task.steps` array), including identities, ancestry, order, state and native clocks. Bodies have their separate content revision guard.
- Content revision: `contentOf(task)?.revisions.length ?? 0`.
- Expected bindings: parent first (`stepId:null`), then every old Step in canonical depth-first/sibling order; event ID is null for an open target and the exact bound event for a completed target. `bindingsDigest` hashes that ordered array.
- Membership digest: canonical exact membership record. Ledger digest: canonical stored-order generation-ledger records for that series. Member guard also names namespace 1/2, series ID/revision, rule revision and nullable template revision. Explicit `{kind:"none"}` rejects any membership.
- Inventory pin: existing writer SHA256(canonical captured ExternalReservations).
- Effects digest: SHA256(canonical descriptor with `digest:null`), following existing content/import checksum conventions.

Metadata fields are all required. Null deliberately clears an allowed reference/endpoint/importance; absence is invalid. Description and continuation are separate strings. No coercion, date repair, new scheduling fields or numeric priority. Use existing Gregorian date/time and Start/Due-pair validation. Necessity maps Must/Should/Unassigned to `must`/`should`/null.

Every old Step is explicitly retained or covered by one confirmed subtree deletion; omission is not deletion. Deleted descendant sets match the pre-Save tree exactly. No overlapping cascades. Retained IDs remain stable. Inserted Save Steps have explicit fresh UUIDs. Validate complete final ancestry, contiguous sibling order, cycles and foreign-task/owner references through N1-C. Reparenting is within one task only. IDs never come from text/position.

Rich creation may omit task or Step IDs; allocation occurs only in the native candidate. Any referenced parent Step must already have an explicit UUID. There is no temporary-ID scheme. Future atomic allocation checks live/deleted tasks, live/retired Steps, History, recurrence/import reservations, protected recovery identities and external inventory. Sixteen valid colliding draws maximum per allocated UUID; invalid UUIDs reject immediately. This is a proposed atomic-command rule, not a claim that every older constructor currently retries collisions.

## Completion and deterministic effects

`keep` preserves completion, time and binding exactly. `complete` requires open state; `reopen` requires completed state. Redundant transition intentions reject, rather than silently retimestamp. An unchanged checked target uses `keep` and creates no event. Default completion time is the action clock; explicit null/backdated time retains native semantics. New task/Step creation/modification clocks are fresh; arbitrary historical source clocks, migration carriers, aliases, imported events or original envelopes are forbidden.

Save stages a completion-preserving structural payload: retained booleans come from authoritative state, inserted Steps stage open, `appendOriginals:[]`. Do not weaken `applyStructuralEdit`. After final metadata/structure are staged, delete bindings for removed Steps while retaining their counted History, apply reopenings, then completions/checked insertions using unchanged `completionTransition`. Reopenings are parent first then retained Steps in final depth-first order; new events are parent first then final Step depth-first order. Deletion effects use the original tree's depth-first order. Descriptor indexes are contiguous: deletions, reopenings, then initial/genuine creations. `change.eventIds` contains reopened/new event IDs in actual transition order; detach-only events remain unchanged and are not added to that change list.

New checked Steps inserted by Save have initial-Step provenance even though shared transition code can create their event. They did not exist open in an earlier committed state. Rich checked parent/Steps similarly retain initial provenance. Retained open-to-completed parent/Steps are genuine transitions. Parent and Step completion remain independent.

One task revision and one final content revision are produced per changed Save. Original envelopes and previous evidence remain byte/digest continuous. For a semantic no-op, discard staged content-carrier changes and emit no task/content revision or event. Still publish the normal operation receipt and existing repository/partition receipt effects. When a changed Save first introduces native current content, initialize its content revision once. Rich creation always establishes current-content revision 1, including explicit empty content, at task revision 1.

`result.atomicTask` is mandatory only for the two new commands; other commands must not carry it. Validate kind, before/after revisions/digests, exact retained/inserted/retired sets and each effect against the canonical command, prior receipt-backed task state, authoritative original bindings, resulting receipt task snapshot and actual event relationships. Do not trust caller-supplied expected bindings as proof. Resolve their receipt/event lineage and compare with the transaction's authoritative before-state. A single receipt can prove several events only with exact distinct effect membership. Later legitimate lifecycle changes do not rewrite creation evidence.

Every effect names the exact task/Step and old/new binding. Complete effects have before open, after completed/countable event. Initial effects have no committed before target. Reopen effects retain the event, uncount it/remove current binding, and clear completion time. Detach effects remove the Step/current binding but leave historical activity counted. No effect is emitted for an unchanged retained target. Descriptor checksum is not a substitute for these relations.

## Import, Statistics and Oath

E2's import plan/outcome, captured raw rows, original source bytes and owner attribution remain immutable. Keep checked imported targets unchanged without extra events. Save reopening suppresses the exact imported raw group only after a validated reopen effect matches its original binding/event; multiple target reopenings each need a separate effect. Recompletion is a later genuine event. Step/task deletion detaches bindings without suppressing activity. Null original completion time stays null. The import namespace/projection version remains 1; the new storage capability is mandatory whenever new effect meanings occur, so an older reader cannot misinterpret its extended reopening evidence.

Statistics keeps its actual existing pipeline and raw stored order. New events are ordered by repository revision and deterministic event index; imported canonical events are not appended again. Preserve typed truthy-ID dedup before timestamp/range/workspace filters, all five local-calendar ranges, historical labels/cohorts and complete aggregates. UI All time and internal aggregate `3m` remain unchanged. No new calculator or general N0 History operation.

F1 source/observations and proof v1 remain unchanged in meaning. Version-1 proof cannot qualify a new Save receipt by pretending it is `task.complete`. Proposed v2 explicitly returns `task-save-completion`, truthful command type and one validated atomic-effect excerpt (index/digest/target/event/origin). Initial rich creation/checked insertion, historical import, History append and independent Step work cannot qualify a parent commitment. Existing ordinary/recurrence creation excerpts use their established verified relationships and `atomicEffect:null`.

V2 still requires current counted parent binding, matching event/creation operation and snapshot, same authority/owner/partition, intact coherent read and exact cut in receipt lineage. Preserve the volatile closed-synthetic save-ack -> open cut -> later completion witness; ordinary/restored order, failed/lost save acknowledgement, epoch discontinuity and uncertain recovery cannot newly qualify work. Native revisions do not prove independent Oath save order. No persisted commitment/latch extension or production Oath change.

## Recurrence and references

Occurrence metadata/content/Step edits never update future templates, generated successors or immutable generation outcomes. For prepared members, Save can preserve parent state or reopen with edits under the recurrence fence. It cannot complete an open occurrence, including a historical reopened predecessor: reject whole Save with `RECURRENCE_COMMAND_REQUIRED`. Standalone `recurrence.complete` owns first generation/recompletion and current E2 binding, while its original outcome may still name E1. Unprepared B1 definitions retain existing ordinary semantics. Guard series/rule/template/membership/ledger revisions. Missing successor or contradictory lineage is integrity/recovery failure, never permission to generate another.

Same-owner location and Phase are complete explicit references, validated under pinned closed evidence. No source note is required or created. Mounts affect presentation only. All Resources remain private physical owners. No live Roadmap consistency, Inbox Send acknowledgement, cross-owner transfer, clear-completed, source promotion/position, shared transport, Oath outcome or task-location UI is authorized.

## Version and storage contract

Retain task schema 1, logical schemas 1-4, event shape, private outer wire 4, recurrence namespaces absent/1/2 and import namespace 1. New commands add mandatory result effects version 1. A version-2 private barrier, private-lineage envelope and private-state envelope carry `atomic-task-mutations-v1`. Capability list order is base `private-native-storage-v1`, then `private-history-import-v1` iff the minimum logical schema is 4, then `atomic-task-mutations-v1`. Minimum logical schema and capability meaning are independent. Version-2 envelopes require barrier version 2 and the atomic capability; unknown versions/capabilities are terminal before ancestry selection.

Explicit host creation version 2 requires `taskMutationVersion:1` and an existing verified empty disposable Temp child, exact authority UUID and synthetic approval. Direct JSON/memory creation offers the same creation-only feature flag. Opening discovers persisted capability; it never upgrades. Existing v1 roots remain readable and reject either new command with `ATOMIC_TASK_CAPABILITY_REQUIRED`. No conversion, upgrade/preparation command, implicit directory creation or replacement authority.

The capability exists from revision zero in CURRENT and each generation, then every RECOVERY/saved verified barrier. B2 must persist and recheck it in reusable memory backing as well. Merely constructing another TaskRepository around the same backing cannot lose it. An uncommitted/unreferenced prospective generation is not a new publication authority. Preserve the existing barrier-selection algorithm, terminal unknown-contract checks and CURRENT as the only publication authority.

Known fallback in an enabled root blocks ALL mutations and mutation receipt replay, ordinary or atomic, through core execution and direct storage publication, even when imported scope would formerly permit unrelated work. Check before replay, before candidate acceptance and at final publication. Do not expand the import identity scope or add another journal. Existing root barriers and read permissions remain intact; readable recovered snapshots are labelled recovering and cannot newly qualify Oath work. If protected scope cannot be proven, opening fails closed. Markers are never cleared/replaced to regain writability.

Pre-B2 private readers must refuse both v2 manifests and v2 generations behind lowered manifests rather than choose older ancestry. Actual schema1/B1/B2 readers still refuse private wire 4. A tests proposed goldens through those actual frozen readers and labels them goldens, not output of an implemented codec. B must repeat with actual new codec output, corrupt pointers, acknowledgement loss and process interruption. Preserve four original E2-R assertions and earlier fixtures unchanged.

## Application and editor boundary

Version-1 intents retain exact prior compilation/rejection and digest meaning. Version-2 native-only envelopes add typed full-save/rich-create actions. One complete stable intent maps deterministically to one task-family request; reason binds application version, intent digest and original reason through existing N3-A receipt coordination. No new queue, store or fallback. Preserve capability checks at execution/publication, exact replay before stale guards subject to fences, changed-evidence conflict, uncertainty's original operation ID and known commitment when refresh is unavailable. Return bounded original Step/event identities/effect digest, never raw receipt/content/provenance.

The deferred private editor draft is specified in the declarations but unimplemented. It requires complete editable metadata/content/tree, an explicit current parent/Step completion-and-time table for display, content/task/partition/binding/recurrence guards plus authority/registry/identity/inventory/Phase pins from one accepted capture. A `keep` intention is not itself a checked-state display snapshot. It excludes raw receipts/originals/aliases. Existing N0 DTO cannot be used as a complete draft. Source-less native editing remains possible in principle, not a product-readiness claim.

## Gate B exact proposed existing-source allowlist

All paths are under `ItacanTaskCore/`. No existing tests/reports/graphs are editable.

| Files | Authorized responsibility |
|---|---|
| `src/commands.js` | Two command discriminants and routing |
| `src/domain.js` | Exact receipt/effect relationships |
| `src/repository.js` | Result effects, capability/fallback guards and recurring Save classification |
| `src/json-repository.js` | Persist v2 capability, monotonic barriers and final all-write fence |
| `src/private-storage-codec.js`, `.d.ts` | Versioned envelope/capability validation |
| `src/json-repository.d.ts` | Creation-only feature options |
| `src/memory-repository.js` | Equivalent persistent backing capability |
| `src/contracts.d.ts` | Command/results/options and proof-read references |
| `src/history-import.js` | Effect-backed reopen/suppression and binding-write guard |
| `src/snapshot-read.js`, `.d.ts` | Coherent v2 effect excerpts |
| `host/repository-host.js`, `host/index.d.ts` | Explicit creation option and proof-version capture |
| `host/completion-proof.js` | Actual authoritative v2 proof provider |
| `writer/policy.js`, `writer/admission.js` | Task family, creation partitions and reserved fields |
| `writer/repository-writer.js`, `writer/index.d.ts` | Bounded effects/result command types |
| `oath/completion-proof.js`, `.d.ts` | Pure v2 checks preserving v1 meaning/import closure |
| `oath/adapter.js`, `.d.ts` | Explicit v2 selection, unchanged lifecycle/causal gate |
| `application/intents.js`, `application/contracts.d.ts` | Closed v2 intents/stable compiler |
| `application/native-adapter.js` | Bounded atomic summaries/coded failures |

New B runtime: `src/atomic-task.js`, `.d.ts`, `src/completion-effects.js`, `.d.ts`. New B tests under `atomic-task/tests/`: `runtime-support.cjs`, `atomic-save.test.cjs`, `rich-create.test.cjs`, `completion-effects.test.cjs`, `import-statistics.test.cjs`, `recurrence.test.cjs`, `admission-replay.test.cjs`, `application.test.cjs`, `privacy-ownership.test.cjs`, `persistence.test.cjs`, `crash-worker.cjs`, `runtime-types.fixture.ts`, `runtime-typecheck.cjs`. New docs: `ATOMIC-TASKS.md`, plugin `lib/tests/native-atomic-task-n3-b2-b-verification.md` and `lib/services/TASK-SERVICE-PHASE-N3-C.md`.

Freeze this allowlist again after A review. Preserve completion-transition, structural/content primitives, recurrence engine, serializers, all entry points and production UI/build bytes. If a wider edit, altered semantics, new scope, storage authority or cross-store coordination is needed, stop for review.

## Acceptance and limits

A executes existing primitives, actual frozen readers and declaration checks; it does not execute proposed commands or v2 proof/codec. Every vector is labelled proposed, current-source-executable or explicit-limit. B must prove all-or-none Save/create effects, stale guards, provenance, import/actual Statistics parity, recurrence, private proof v2, root admission, exact replay/uncertainty and full physical-owner/mount/privacy matrix. Assert old/new state and no replacement identities/successors.

Preserve exact B1 saved regression/declaration arguments and all earlier original assertions; E1 keeps its 138 frozen versus 137 current behavioral split. No new source-hash exclusions. Stage baseline/final builds in guarded Temp, compare twelve assets, 168/24 factories, one Legacy Task Service construction and absence of native startup. Await every child and retain raw logs, commands, exits and actual dead-child lock evidence. A reuses earlier interruption tests but introduces no persistence boundary or new interruption claim; B requires actual new enabled-root interruptions through staging/publication/acknowledgement and fallback.

Complete fresh sequential baselines before editing, preserve all exact originals and independent drift, scan live artifacts, compare protected data and seal in Temp before private backup copy/verification. No real data/root/Markdown/History/Inbox/planning/Oath/Strict mutation, migration, install, reload, production routing or N3-C/N4/N8 work. Claims exclude universal power-loss/cloud rollback, hostile writers, distributed uniqueness, complete-directory rollback detection, atomic N1-B consumption and atomic task/Oath saves.
