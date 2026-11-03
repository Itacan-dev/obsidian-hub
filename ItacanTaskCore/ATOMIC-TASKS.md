# N3-B2-B — inactive atomic task mutations

`task.save` and `task.createRich` execute inside the existing repository queue,
detached candidate, admission seal, receipt and storage publication. They are
available only when `taskMutationVersion:1` was explicitly selected at creation
of a new disposable memory or private-v4 repository. Opening an existing root
does not enable the feature. Production construction and routing remain legacy.

The frozen [Gate A contract](atomic-task/CONTRACT.md) and
[value declarations](atomic-task/contracts.d.ts) remain unchanged. Runtime
declarations are in [src/atomic-task.d.ts](src/atomic-task.d.ts).

## Creation and storage

Direct JSON creation accepts the feature only with `storageFormat:"private-v4"`,
an existing physical directory beneath OS Temp, an explicit authority UUID and
verified emptiness before and under the lock. The Temp root itself, junctions,
network roots and non-disposable destinations reject before allocation. Inactive
host creation uses `version:2`, `taskMutationVersion:1` and the existing synthetic
approval. Memory creation retains the equivalent feature in its reusable backing.
There is no upgrade, conversion, replacement-root or fence-clear operation.

Outer private wire version 4, logical schemas 1–4, task schema 1, recurrence
namespaces 1/2 and import namespace 1 are preserved. Enabled roots use version-2
private barrier, lineage and state envelopes carrying
`atomic-task-mutations-v1` from revision zero. The barrier remains in CURRENT,
RECOVERY, saved verified barriers and generations. Old roots retain v1 encoding.

Known fallback in an enabled root blocks every mutation and mutation replay,
including ordinary commands and direct storage publication. This check applies
before replay and again at final publication. Reconstructed handles rediscover
the persisted capability and fence. Existing protected-scope rules still apply;
an unprovable recovery scope fails closed. Earlier roots retain their scoped
recovery behavior. A missing receipt never authorizes replacement identities.

## Complete drafts and guards

Save requires complete editable metadata, continuation, every retained/new Step,
explicit individual Step deletions, and a parent completion intention. Every
existing Step must be retained or deleted explicitly. Each retained target uses
`keep`, `complete` or `reopen`; inserted Steps use explicit initial state.
`complete` requires open state and `reopen` requires checked state. `keep`
preserves the original completion timestamp and binding.

Guards pin repository, task, partition, current-content revision, exact old-tree
digest, the parent/all-old-Steps binding table, recurrence membership/ledger and
captured external inventory. Ownership cannot change. Location/Phase references
still use the existing validators and closed evidence. Native endpoint validation
and timestamp rules are unchanged. Omitted completion time uses the command
clock; explicit null and backdated native times retain their meaning.

Save reuses the unchanged structural/content functions and shared completion
transition. Deleted bindings detach without uncounting retained History. Effects
are ordered as old-tree deletions, then reopenings, then new completion events;
target order is parent followed by the final flat Step order. A changed Save
advances task revision once and finalizes one current-content revision. A no-op
does neither and creates no event; its ordinary repository/partition receipt
still commits.

Rich creation uses the pure native constructor, one initial content revision and
one initial event per checked target. It does not call ordinary creation followed
by editing. Task/Step creation and modification clocks are fresh; archive and
deletion fields start null. Callers cannot supply clocks or provenance. Missing
identities allocate through the native factory, with sixteen valid colliding
draws at most and immediate rejection of invalid UUIDs. Referenced Step parents
must have explicit UUIDs. Live, deleted, retired, event, recurrence, import,
recovery and external reservations are checked.

## Truthful effects and private proof

Only the two commands require `result.atomicTask` version 1. Its digest identifies
the complete ordered effect descriptor. Portable validation recomputes the
descriptor from receipt-backed before/after snapshots, exact guards, actual
events, original bindings, current content and immutable creation evidence.
Deletion, reopening, genuine completion and initial checked-state origins remain
distinct. Old receipts are not rewritten. Later legitimate edits, reopening or
deletion do not invalidate the original creation receipt.

The private scoped snapshot and completion port negotiate request/result v2.
They return a selected effect excerpt, index and effects digest, never a full
receipt/draft. Save retains command type `task.save`. Genuine parent Save
completion has origin `task-save-completion`; initial checked creation/insertion,
Step completion and historical import cannot qualify as parent Oath work.
V1 remains conservative about both new command types. F1 is unchanged.

The F2 adapter explicitly selects `completionProofVersion:2`. Current binding,
creation receipt, coherent head and exact cut remain mandatory. Qualification
still requires the closed synthetic save-acknowledgement → open cut → later
completion sequence. Ordinary/restored enrollment remains
`ENROLLMENT_ORDER_UNPROVEN`. Native commits and Oath saves remain separate
authorities. No durable enrollment, Oath format or latch repair was added.

## Import, recurrence and application boundaries

Imported Save reopenings require their own verified effects and suppress the
exact original raw groups. Deletion alone does not suppress activity. Mixed
reopening/completion publication indexes include reopening entries in receipt
order. Original captures, source bytes, plans, outcomes, null times and recorded
ownership remain immutable. Existing compatibility projection and actual legacy
Statistics algorithms remain unchanged.

Prepared recurrence members may be edited or reopened through Save. Save cannot
complete/generate them: `RECURRENCE_COMMAND_REQUIRED` rejects the whole action.
Standalone `recurrence.complete` owns recompletion and successor generation.
Templates, successors and spent generation outcomes remain unchanged by Save.
Imported tasks do not acquire recurrence eligibility merely by being edited.

Application v2 `full-save` and `rich-create` intents compile deterministically to
one task-family writer request. Their complete stable envelope digest and reason
participate in existing N3-A receipt evidence. V1 compilation/rejection is
unchanged. Changed stable intent under a committed operation conflicts; identical
replay returns original identities/effects. Bounded results contain IDs, receipt
references and effects digest. Known commitment survives unavailable refresh;
uncertainty retains the original operation and requires identical replay after
authoritative reconciliation.

Rich editor reads remain deferred: complete supplied synthetic drafts are not
an interactive editor-loading capability. No Inbox acknowledgement, planning save,
Oath outcome, shared transport or source migration follows automatically.
Current bodies, source evidence, aliases, receipts and effects stay private;
existing import/recurrence export restrictions remain enforced.

## Verification scope

The new explicit tests live under `atomic-task/tests/`. They use actual native
primitives, frozen readers, legacy Statistics helpers, the F2 adapter, Oath methods
and guarded HubDataStore writes. Fault injection, cancellation, reconstruction,
acknowledgement loss and parent-terminated children are reported separately.
Bounded performance observations record measured command phases without invented
acceptance thresholds. The sealed verification report records exact arguments,
counts, failed development attempts, protected comparisons and staged assets.

Claims cover tested cooperative local persistence and process interruption.
They exclude universal power-loss/cloud rollback safety, hostile writers,
distributed uniqueness, whole-directory rollback detection, atomic N1-B
consumption and atomic task/Oath persistence. Stop after N3-B2-B for user review.
