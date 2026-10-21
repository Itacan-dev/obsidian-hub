# N3-B1: inactive application mutation compatibility

Import this package explicitly from `ItacanTaskCore/application`. It adds no production construction, backend discovery, task store, queue, root opening, identity allocation, subscriptions at construction, writer gate or coordinator. All existing files remain unchanged. STOP FOR USER REVIEW after this gate; B2, N3-C and later phases require separate authorization.

## Composition and contracts

Create the existing disposable N3-A writer session separately, explicitly create/open its exact private-v4 authority, and authorize the approved owner/command subset. Compose its N2 read adapter with the actual `TaskService`, then inject the same authority's host, writer and opaque capability into `createNativeApplicationAdapter`. Pass that adapter and Task Service to `createApplicationMutationService`. The public surface is `capabilities(intent)`, `mutate(intent, signal?)`, `dispose()`; see `contracts.d.ts` and the declaration fixture. The wrapper checks backend agreement; native authority/application context and the existing writer enforce exact scope. No repository executor or lifecycle handle escapes from the application service.

The version-1 intent carries a stable operation ID and reason, explicit authority and physical owner, expected repository and partition revisions, registry/identity/inventory/Phase pins, and an action from a closed vocabulary. Existing tasks require their current parent revision, including Step actions. A Step has no separate revision. Legacy authority reports `legacy-only`; its existing methods and result semantics are untouched, and this sibling does not implement a new legacy writer.

Supported native actions compile to exactly one existing command. Cross-authority, full-save/rich-create and source-only actions dispatch zero commands. Unknown fields and malformed envelopes raise a bounded `APPLICATION_CONTRACT` error. Domain-invalid combinations are rejected by the existing atomic native validator; capability support is not a promise that a particular draft is valid or admitted.

The complete stable intent is canonicalized and SHA256-bound in a deterministic version-1 writer reason envelope. The existing N3-A request digest and receipt retain that reason, exact command and scope. No new receipt namespace/schema exists. Identical replay uses original evidence, not rebased guards; changed supported intent/reason/action kind/pins conflicts even if the native effect would look identical. A locally unsupported action is not admitted and reports `priorOutcome:not-checked`; it makes no assertion that its operation ID was never used previously.

## Current state versus commitment

A committed/replayed outcome contains only authority, IDs, receipt head, optional narrow recurrence outcome, and read-after-write. One N2 capture asks for exact affected/original targets and verifies the receipt cut, same authority, registry/identity pins and coherent head. A later state can be current while the original receipt remains historical. No-op commands still refresh their explicit target. Task/Step projection is allowlisted and excludes migration, envelopes, continuation, Step bodies, raw receipt and import evidence. Navigation is a native-task intent; no note is invented.

Read failure, subscription failure, disposal or a superseded capture after known commitment leaves the mutation committed/replayed with unavailable/superseded refresh. It never triggers a replacement write. Read subscriptions register before capture, invalidate acceptance generations, contain listener failures through the host and are removed by idempotent disposal. Disposing the sibling neither closes its host nor revokes/rolls back accepted native work.

Uncertain publication/acknowledgement stays uncertain, including unexpected delegated exceptions where publication cannot be disproved. N3-A owns reconciliation and blocks another intent while pending. An uncertain response retains that original operation ID; a different blocked request is identified separately by requestedOperationId. Reobserve the exact authority and replay the identical retained operation; never allocate replacement task/Step/event IDs or successors. B1 persists no intent, so a restart test retains its exact input externally only in its disposable harness. An unavailable receipt, fallback or cancellation does not prove failure. Recovered/fenced stores retain all existing restrictions.

## Read limitations and synthetic drafts

N2 exposes metadata, lifecycle and Step hierarchy, not current continuation/Step bodies or recurrence definitions. `edit-structure` therefore requires a complete caller-supplied, revision-pinned N1-C draft, explicit subtree dispositions and `appendOriginals:[]`. Existing Step completion cannot change; new structural Steps are open. Metadata-only Step operations preserve private bodies through the existing content helper. Recurrence intents require complete current B1/B2 values and revisions supplied by the synthetic caller. This package does not offer an interactive editor loader or recover missing content from a receipt. No empty body is inferred for an existing task by the runtime.

## Source-backed workflow evidence

The immutable `tests/source-graph-v1.json` records actual bytes, origins and SHA256 values from the completed pre-edit baseline. It retains 524 production/helper/fixture files. `action-vectors-v1.json` records 49 proposed compatibility rows separately from executed observations. The harness invokes actual `HubTaskEditor`, actual compiled plugin mutation/History methods without onload, actual Inbox/ProjectPlanning services, actual calendar rendering with an inert DOM/icon host, and established safe Oath fixtures. Exact outputs/failure states are private archive evidence. Fixture Maps are synthetic; no actual user Inbox, Markdown or plugin data is a test corpus.

Legacy UI Save commits draft parent/Step checkbox changes with metadata. It writes source then metadata, with guarded rollback; History follows separately and may fail without undoing the saved task. Inline add-above/below writes an empty placeholder before text commit. Inline deletion can promote children, unlike modal tree deletion. Home/panel/Schedule actions re-resolve legacy identity/physical ownership before their unchanged writers. Calendar creation supplies an ordinary Due-date draft. Phase Save can update planning and assignments in plugin data plus optional source-ID writes. Inbox persists capture/prepared operation, creates a task, then records/removes or retains its item. HubDataStore also publishes selected shared data separately. These sequences are not one native transaction.

## Complete action matrix

A = one existing atomic native command; B = atomic extension required; C = external authority coordination; D = unsupported/deferred. All A entries are inactive synthetic capabilities, not production routing.

| Action | Legacy path | Native equivalent/class | B1 boundary / later gate |
|---|---|---|---|
| Simple creation | Editor source + metadata + History | A: task.create | Entire supported draft once |
| Title-only Steps at creation | Editor whole block | A: task.create | Exact hierarchy/IDs/checked state |
| Creation metadata/dates/Necessity/location/Phase | Source + metadata | A: task.create | Closed Phase evidence only |
| Initially checked creation | Source/check/History | A: task.create | Initial creation provenance, not Oath work |
| Rich creation | Rich source content | B | Reject; B2 initializer |
| Title | Editor/inline source | A: task.update | Single metadata intent |
| Description | Identity-keyed metadata | A: task.update | Separate from continuation |
| Continuation | Inline source; modal preserves it | A: task.editStructure | Full supplied draft; no hosted loader |
| Necessity | necessity metadata | A: task.update | must/should/null, no numeric priority |
| Start | Date metadata | A: task.update | Exact local endpoint |
| Due | Date metadata | A: task.update | Validate complete resulting pair |
| Several metadata fields | Editor Save | A: one task.update | Already atomic |
| Content + structure/title/description | Source block | A: one task.editStructure | Retain completion; supplied draft |
| Metadata + completion | Editor Save | B | Reject all; B2 |
| Metadata + content/structure | Editor Save | B | Reject all; B2 |
| Full Save | Combined legacy draft | B | No sequential native commits |
| Add Step | Editor append | A: step.add | Checked insertion has independent event |
| Add Step with body | Rich structure | A: task.editStructure | New Step open; checked+body needs B2 |
| Step title | Editor/source | A: step.update | Parent revision guard |
| Step body | Rich source | A: task.editStructure | Complete supplied content |
| Step reorder | Facade rejects; Markdown can reorder | A: step.reorder/structural draft | Exact siblings/final hierarchy |
| Step reparent | Facade rejects | A: step.update/structural draft | Same parent task only |
| Reorder + deletion | Structural edit | A: one task.editStructure | Explicit descendant deletion |
| Step deletion | Editor subtree removal | A: step.delete | Cascade confirmation, retired IDs |
| Step complete/reopen | Independent checkbox | A: step.complete | Never completes parent |
| Parent complete | Source then History | A: task.complete | Atomic state/event/binding/receipt |
| Parent reopen/recomplete | Legacy check/History changes | A: task.complete | Shared helper/E2 projection |
| Modal tree deletion | Remove block/metadata | A: task.delete | Logical deletion; recurring members reject |
| Inline promotion deletion | Promote surviving children | D | No equivalent tree deletion |
| Archive/unarchive | No dedicated legacy facade action | A: task.archive | Not clear-completed |
| Clear completed | Per-note archive/remove/tidy | D | Product review; no native bulk command |
| Same-owner move | Guarded two-note movement | A: task.relocate | Reference only; no file creation |
| Cross-owner move | Source move may change owner | D | Preserve N3-A prohibition |
| Frozen Phase reference | Editor metadata | A: task.relocate | Explicit location and frozen Phase pin |
| Live Phase association | Current planning evidence + task save | C | Reference A; live consistency N3-C |
| Planning object lifecycle | Plugin planning state | D | No native planning command |
| Phase Save + assignments | Planning/metadata/source-ID writes | C | N3-C; no combined persistence |
| Schedule date edit | Ordinary editor | A: task.update | Full mixed Save remains B |
| Schedule creation | Due-date creation draft | A: task.create | No scheduling schema |
| Quick Add to Inbox | Capture persistence | D at native boundary | Existing draft authority |
| Quick Add Task | Capture/task/result/removal | C | Creation translation only; N3-C publication |
| Inbox Send | Prepared operation/task/result/removal | C | Never remove on native-only success |
| Completion during Oath | Task plus Oath observation/save | C | Native completion A; Oath outcome N3-C |
| Recurrence completion | Explicit B2 native behavior | A: recurrence.complete | Exact supplied guards; one successor |
| Recurrence reopening/recompletion | Occurrence lifecycle | A: task.complete/recurrence.complete | Keep B/spent key; current E2 |
| Rule/template operations | Explicit B1/B2 definitions | A: recurrence commands | Supplied drafts; established edit limits |
| Unsupported recurrence/status | Tasks syntax/source rules | D | No policy expansion/coercion |
| Add above/below/source position | Empty Markdown placeholder | D | No native positional placeholder |
| Direct Markdown edits | Source/index authority | D for native | No translation/fallback/migration |

## Preserved semantics and deferred authorities

Dates remain Gregorian civil dates 0001?9999 with explicit null or HH:mm time; Start/Due validation remains core-owned. No timestamp conversion or invalid legacy normalization occurs. Location and Phase are references under one physical owner/partition. All Resources, including every mount into either shared Project, remain Resource-owned/private. Rename/status/root evidence cannot grant ownership or sharing. Existing broad legacy metadata sharing and out-of-root captureSource exposure are documented historical findings, not a native packet contract.

Completion uses the unchanged shared helper. Imported checked state, initial checked creation and historical append remain distinct from genuine new completion. N0 general History stays unsupported; actual E2 durable compatibility projection and legacy Statistics helpers remain unchanged, including full aggregates, typed dedup/order, timestamps, ranges and All-time UI/3m internal defaults. A missing valid open enrollment anchor stays unavailable to F2 even when an initially completed task has a canonical creation event.

Oath progress/display and qualified work remain separate. Actual Standard/fake Strict methods retain parent-only progress, scheduled activation, deadline, latch and terminal outcome behavior. An ordinary/restored enrollment does not gain causal order from a native revision. Only the explicit closed synthetic save-acknowledgement/open-cut/later-completion sequence can qualify in these tests. The unsaved-latch durability gap and committed-tree deferral remain unchanged.

Inbox capture/operation/task IDs remain distinct. Their legacy identity mapping is evidence only; N3-C must review a native mapping, durable request/receipt linkage, acknowledgment/removal and restart reconciliation. A task commit can coexist with a failed app save; the inverse can also occur. Live Phase changes need an independent freshness/deletion contract. No full-workflow success is returned by this package for either case.

## B2 handoff and approval boundary

The reviewed preference is a task-specific compound Save and a separate rich initializer, not a generic transaction batch or silently split Save. B2 must review complete metadata/content/tree/completion drafts, all revision/reference guards, retired identities, original-source continuity, event/binding effects and one receipt/replay result. E2 suppression, F2/N2 origin/receipt recognition and B2 lineage validation currently recognize specific command types. Reusing the helper alone is insufficient; do not relabel a new receipt as task.complete. A capability/version/schema barrier, if needed, requires explicit review with actual older readers. Prepared-recurring compound completion stays deferred. Clear-completed semantics also remain unselected.

## Verification and limits

Use the eight explicit new test files and declaration runner, then N3-A's saved exact inventories and actual frozen readers. Keep source-inspected facts, executed legacy methods, actual native commands, exceptions/cancellation and real child termination separate. Preserve dead-child lock bytes/PID/host/token before guarded movement. Stage builds only into OS Temp; compare twelve assets, 168/24 factories and one Legacy construction. Preserve independent protected-state drift without restoration.

Claims are limited to tested cooperative local execution, coherent observations and process interruption. No power-loss, cloud rollback, hostile-writer, distributed uniqueness, complete-directory rollback, durable invalidation, atomic identity-plan consumption, task/Oath atomicity or production adoption is established.
