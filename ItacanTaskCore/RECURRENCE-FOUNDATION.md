# Native recurrence definition foundation — B1

2026-10-17, contract revision B1-r1. **Inactive fresh-native implementation only. No recurrence execution, successor creation or Step instantiation.** The B1 request approves D10-01/02/04/05/07/10/11/12–16/18–20 and the safe spent-key principle of 17, restricted to this foundation. `when done` is explicitly deferred. Historical B0 recommendations/evidence remain unchanged.

## Versions and backward compatibility

Ordinary task-only stores remain repository schema **1**, byte-compatible until an explicit definition command commits. Tasks and Steps keep their existing schema/semantics; `SCHEMA_VERSION` still means task schema 1. The first successful `recurrence.defineSeries` atomically publishes repository schema **2**, adding one required `recurrence` namespace. JSON manifests use schema 2 as the old-reader capability barrier. Existing schema-1 receipts and N1-C private-content revisions are retained, not converted.

The namespace is `{version:1,format:'itacan-recurrence-foundation',requiredCapabilities:['recurrence-foundation-v1'],externalInventory,series,ruleRevisions,templates,templateRevisions,memberships,reservations,generationLedger:[]}`. Every collection is validated by `validateState`; unknown namespace versions/mandatory capabilities fail `UNSUPPORTED_SCHEMA`, including when checksums match. Missing namespace under schema 2 is unsupported, not permission to fall back. Schema 1 carrying recurrence fields or receipts is rejected. Unknown versions do not get stripped or silently downgraded. Old task-only readers reject schema-2 manifests before considering ancestry.

No real repository has been upgraded. This API is exposed through the existing portable core entry; production continues using the Legacy Adapter. It imports no filesystem, Obsidian, Dataview, DOM or native identity-plan store. JSON remains a separate explicit entry point. No new dispatcher or receipt authority exists.

## Records and invariants

Runtime declarations are in [recurrence.d.ts](src/recurrence.d.ts); implementation is [recurrence.js](src/recurrence.js).

| Record | Stored contract |
|---|---|
| Series | Version, canonical UUID, existing `{type,id}` owner, partition ID, revision, lifecycle vocabulary, rule UUID/revision, Gregorian/IANA calendar policy, optional template UUID/revision, initial/frontier occurrence UUIDs, committed occurrence count, known created/modified clocks. |
| Rule revision | Stable rule UUID/series UUID, immutable revision/previous digest, strict canonical rule, explicit original Start/Due, origin ordinal 1, Due-else-Start anchor and civil-day offsets, initial-task effective boundary, reason/operation/time, genuine original evidence reference (null in B1), digest. |
| Template definition | Stable template UUID, owning series/owner/partition, latest revision. Ownership cannot be changed through a mount. |
| Template revision | Version, template/series UUIDs, immutable revision/parent/previous digest, future boundary, reason/operation/time, description string (empty allowed), complete node tree, digest. |
| Template node | Stable independent UUID, parent node/null, zero-based contiguous sibling order, single-line nonempty title and lossless body string. No completion, binding, event, Oath or live Step fields. |
| Initial membership | Existing task UUID, series/owner/partition, ordinal 1, null predecessor/successor/generation operation/key, captured initial rule UUID/revision 1, captured original endpoints, null template capture because the existing task was not instantiated from a template. |
| Reservation | UUID, kind series/rule/template/node, owning series, optional template UUID, retired flag. Referenced records and complete revision history must justify every reservation. |
| Future generation ledger | Typed structural record and pure graph validator only. Live B1 ledger must stay empty. It cannot be written through a command. |

Lifecycle vocabulary is active/paused/exhausted/stopped/quarantined/conflicted; **only active initial definitions are persisted by B1**. Frontier stays the initial task and occurrence count stays one. No pause/resume/cancel/replace/exhaustion transition is implemented. Deleting or transferring the owner of a recurrence-member task rejects `UNSUPPORTED_OPERATION`; that lifecycle is deferred. Ordinary task edits, Step completion, task completion/reopen and same-owner location edits retain existing semantics and never instantiate anything.

The existing initial task must already exist, have matching owner/partition and expected task revision, be live/unarchived and fresh-native, with a supported date-only anchor at definition time. B1 never creates that task implicitly. Genuine legacy provenance/capture is rejected. N1-C native-only private content (`private-native-content-v1`, no originals/prior external evidence) is compatible and stays intact. Existing checked Steps, History and bindings survive definition unchanged. Later occurrence edits do not change captured original endpoints or immutable templates; a future generator must independently revalidate current compatibility.

## Rule subset and origin

Accepted canonical input is exactly:

```json
{"version":1,"frequency":"DAILY","interval":1,"referencePolicy":"fixed-origin","calendar":{"calendar":"gregory","zone":"Europe/Stockholm"}}
```

Frequency may also be WEEKLY; interval is a positive safe integer. Gregorian dates use existing domain validators. Due is the anchor if present, otherwise Start; at least one is required. Civil-day offsets are validated arithmetically, including leap years, **without calculating a next occurrence**. Date-only precision is explicit `time:null`. Timed values, including `00:00`, are rejected for definitions rather than stripped. Local zone information is captured explicitly and validated with Intl; it never defaults to the current device.

Monthly/yearly, bounds/count/until, when-done, elapsed intervals, scheduled-only/date-free rules, natural language and unknown extra parameters are unsupported. No Tasks parser is invoked by these commands. Positive interval acceptance establishes a definition contract, not proof that a future date calculation fits the supported calendar range. B2 must reject arithmetic/range failure explicitly, never call it successful exhaustion or one-off fallback.

Rule revision stores an explicit new origin and future boundary, while preserving every earlier revision. B1 permits only the initial-occurrence boundary, ordinal 1; it does not claim reanchoring after successors. Manual current-task date edits leave rule origin untouched. The immutable origin/ordinal is sufficient for separately approved B2 fixed-calendar calculation; no such calculation exists here.

## Four commands inside the existing repository

Every command uses `repo.execute`, unique `operationId`, `taskId`, `expectedRevision`, **required** `expectedRepositoryRevision`, and a versioned payload containing `expectedInventoryRevision`, matching owner/partition and a nonempty reason.

| Type | Additional payload / effect |
|---|---|
| `recurrence.defineSeries` | Optional fresh series/rule UUIDs, strict rule input. Captures existing task endpoints and initial membership. Allocates missing series/rule UUIDs through the injected factory. No task/Step/event/binding creation. |
| `recurrence.reviseRule` | Series UUID, expected series/rule revisions, explicit new rule/origin, `effectiveAfterOccurrenceId` equal to initial task. Appends immutable rule revision; changes active pointer/series revision only. |
| `recurrence.defineTemplate` | Series UUID/expected revision, optional fresh template UUID, description and full explicit node draft. Every node is `state:'new'` with caller-supplied fresh canonical UUID. Defines revision 1. |
| `recurrence.reviseTemplate` | Series UUID, expected series/template revisions, initial-task future boundary, description/full node draft and explicit deletion confirmations. Appends one atomic structural/content revision. |

Node drafts are `{state:'new'|'existing',id,parentNodeId,order,title,body}`. Existing nodes must be present in the current template. New identities must be globally available. Every prior node needs an explicit disposition: retained in the draft or removed by a confirmed deletion `{nodeId,cascade,descendantIds}`. Omission is not deletion. Descendant sets must match current tree exactly; parent removal needs explicit cascade. Overlapping removals reject. No self/cross-template/missing parent, cycle, duplicate identity, gapped/duplicate sibling order or completion fields are accepted. Core `validateSteps` is reused on temporary validation views, without allocating/persisting occurrence Steps. Explicit parent/order fields define the hierarchy; input-array position is not identity. Four-level trees are covered.

Retained nodes keep IDs through rename/body/reorder/reparent revisions. Removed nodes retire permanently; identical new text never revives them. Future-template edits leave all current task/Step state and bodies untouched. Ordinary occurrence edits use current N1-C/core commands and never change templates. No UI scope-choice controls are added.

`getRecurrenceSeries(id)` returns a detached versioned snapshot of current definition/rule/template plus initial membership, or null. `recurrenceReadiness()` returns a snapshot with `definitionWritesAllowed`, recovery evidence and **`generationSupported:false`**. It is not a reservation lease, external-inventory freshness check or B2 generation-eligibility proof. No generator method is advertised.

## Identity authority and external reservations

Fresh-native allocation checks the same native state: live/deleted task IDs, live/retired Step IDs, History event IDs, series/rule/template/node reservations and explicit external inventory IDs. Future task/Step/event creation in schema 2 checks recurrence reservations too. Node UUIDs are not Step UUIDs. Store/revision/partition-head UUIDs remain infrastructure identity, not occurrence identities; they are not silently reinterpreted as business reservations.

Existing schema-1 History IDs historically had their own namespace; previously legal task/event overlaps are not rewritten. New recurrence identities cannot overlap either set, and future schema-2 allocations enforce the combined boundary. This preserves old records while strengthening new allocations. An injected invalid UUID rejects. Missing series/rule/template identities use the existing factory, bounded to sixteen collision attempts; exhaustion rejects. No failed detached draft publishes a reservation or receipt. Uncommitted, unacknowledged allocations are not published identities; committed/retired IDs remain unavailable.

Recurrence commands require `options.externalReservations={version:1,revision,ids}` and a matching payload revision. The options snapshot is cloned privately; the committed inventory is immutable. A new captured inventory differing from persisted evidence rejects, even after reopen. This proves conflicts with the captured inventory only. **Concurrent changing N1-B planning remains unsupported**; callers must provide an exclusive synthetic fresh-native authority. B1 has no live cross-store lease, plan consumption or alias mutation and makes no atomic cross-store claim. N1-B immutable plans remain unchanged.

## Canonical integrity, receipts and atomicity

Canonical JSON uses the existing portable `value.canonical`: sorted record keys, preserved array order, strict portable JSON. Rule/template digests use the existing portable N1-C SHA256 over canonical records with `digest:null`; previous digests chain revisions. Namespace validation verifies ownership, reservations, contiguous immutable revision chains, active pointers and receipt snapshots. An attacker merely recomputing a modified revision digest cannot bypass comparison to its retained committed receipt. This is accidental-corruption detection under the local model, not hostile-writer authentication.

The existing `TaskRepository.execute` performs canonical operation receipt replay before stale revision rejection; mismatched payload rejects. Series/template commands add a versioned `result.recurrence` snapshot to the same existing receipt. Other receipts retain their old shape. `result.tasks`/event changes are empty for definitions; task snapshots returned for the command target remain unchanged. Store and relevant partition revisions advance once, while task revision does not change for definition-only mutations.

A single detached state contains series/rule/template/node reservations, membership and operation receipt. Existing validation, JSON generation write/verify, CURRENT replacement and publication provide the one commit boundary. No recurrence database or second receipt dispatcher exists. Before publication any failure leaves the old whole state. After publication/lost acknowledgement an identical operation returns the original definition identities/revision after reopen. Existing notification isolation remains unchanged.

## Future generation contracts, not execution

`generationKey(owner,seriesId,predecessorId)` returns canonical JSON text for `['native-generation',1,owner.type,owner.id,seriesId,predecessorId]`. Event, device, rule/template revision, operation time/path/title and retry count are absent. Operation receipt and predecessor generation outcome are different identities. Future recompletion can create E2 while retaining A-to-B's outcome/E1 generation relationship; it must not replay E1 as a new event or produce another B.

`validateGenerationGraph` validates **static synthetic records only**: unique membership/ordinals/root, reciprocal same-owner/partition/series/rule links, canonical key, one outcome per key, retained deleted-successor outcome, distinct completion-event identity/operation receipt, captured reference version, Step-node disjointness and fresh-open mapping state. Typed ledger records retain triggering event, first operation/receipt, rule/template/reference versions, committed revision, original successor/Step mapping or explicit terminal proof. The validator does not calculate dates, verify terminal arithmetic, allocate IDs or commit records.

Future Step mapping is `(occurrenceId,templateId,templateRevision,templateNodeId) -> freshStepId`, with copied lossless hierarchy/content, open state, null completion binding/time, no historical event and legitimate fresh timestamps. B1 does not perform this mapping. The live namespace rejects any generated membership or nonempty ledger. B2 must introduce an explicit reviewed version/capability extension; relaxing B1 cardinality checks without a reader barrier would be unsafe.

## Persistent recurrence recovery fence

The JSON repository still allows known-corrupt generation recovery to a verified recorded ancestor; N1-B's separate identity store still has its different fail-closed policy. They are not equivalent guarantees. B1 adds a conservative **`RECURRENCE-FENCE.json`** safety marker before exposing any fallback, including a task-only ancestor preceding acknowledged recurrence state. The marker is private recovery evidence, not separately committed business state or a second transaction authority.

The marker is written exclusively, file-flushed and read back before open returns. A crash before writing repeats recovery on restart; a partial/malformed marker remains blocking; a complete marker remains blocking. If the marker cannot be persisted/verified, opening fails. Unknown marker versions fail rather than downcast. JSON opens/loads observe the marker; recurrence mutations check it before replay and again before commit. No B1 clear/reconciliation operation exists.

Read-only recovered definitions may be inspected. Ordinary valid task operations remain available under a known fence, but recurrence definition writes and replay are blocked `RECURRENCE_RECOVERY_FENCED`. A normal task write/restart does not erase the fence. A schema-2 manifest is never downgraded to schema 1 merely because fallback chose an older task-only generation; any later ordinary commit under a known fence also publishes the schema-2 manifest barrier, including recovery through an older backup manifest. Task-only state itself can remain schema 1. Absence of a lost receipt is not permission to recreate acknowledged recurrence work. Current-instance generation corruption continues to fail closed until reopen, as before.

Verified limits: local cooperative single writer, ordinary filesystem persistence, retained fence/evidence and explicit process interruption. No universal power-loss, directory-fsync/cloud/OneDrive, hostile deletion, arbitrary complete-directory rollback, distributed uniqueness or production-host recovery guarantee. Losing/restoring the entire directory including its fence requires later N3 reconciliation. B1 never automatically clears a known fence or claims to recover a lost acknowledgement's latest state. There is no B2 generator to authorize while fenced.

## Privacy and sharing

One physical Project or Resource owner/partition is immutable for series/template records. Both Itacan and Obsidian Hub retain git-project eligibility; Knowledge/study, Research/literature, Explorations/references and Inspiration/inspiration remain private, even through a mount/context. Source-parent folders do not become permanent note associations.

Existing ordinary task-only exports remain unchanged. Exporting a partition containing a recurrence member explicitly rejects pending N4's reviewed transport contract, preventing silent loss of recurrence identity or accidental export of private definition/provenance/receipts. Other eligible Project partitions still export their own task-only content. Full generations, aliases, source envelopes, recovery diagnostics, local receipts, complete History and Oath/Strict/device state have no new export path. No production Git transport or Task Service routing changes occur.

History counts, current bindings, Statistics' five ranges/All time default, original attribution and Oath `{id,path,text}`/awaitingIndex/fulfillment/recovery remain unchanged. An Oath remains occurrence-specific. N1-E History import, N1-F native Oath adoption and N3/N4 integration are deferred.

## Runnable synthetic example

Save as a `.cjs` file inside `ItacanTaskCore` and run using an existing Node runtime. It creates only a memory store. No file/vault/plugin is opened. The task is explicitly created first; the definition commands create no task, Step or event.

```js
const core = require("./src");
async function example() {
    let counter = 0;
    const id = () => "40000000-0000-4000-8000-" + String(++counter).padStart(12, "0");
    const owner = {type: "project", id: "synthetic-project"};
    const repo = await core.createMemoryRepository({
        idFactory: id, clock: () => 1792224000000,
        partitions: [{id: "synthetic", kind: "private-project", owner}],
        externalReservations: {version: 1, revision: "exclusive-demo-1", ids: []}
    });
    try {
        const task = (await repo.execute({operationId: "author-task", type: "task.create", payload: {
            task: {owner, title: "Synthetic checklist", due: {date: "2026-10-17", time: null}}
        }})).task;
        const common = () => ({taskId: task.id, expectedRevision: task.revision, expectedRepositoryRevision: repo.info().revision});
        const base = {version: 1, expectedInventoryRevision: "exclusive-demo-1", owner, partitionId: "synthetic", reason: "Explicit synthetic definition"};
        const defined = await repo.execute({...common(), operationId: "define-series", type: "recurrence.defineSeries", payload: {
            ...base, rule: {version: 1, frequency: "DAILY", interval: 1, referencePolicy: "fixed-origin", calendar: {calendar: "gregory", zone: "Europe/Stockholm"}}
        }});
        const request = {...common(), operationId: "define-template", type: "recurrence.defineTemplate", payload: {
            ...base, seriesId: defined.recurrence.series.id, expectedSeriesRevision: 1, description: "Future checklist",
            nodes: [{state: "new", id: id(), parentNodeId: null, order: 0, title: "Inspect", body: "Keep **this** body."}]
        }};
        const template = await repo.execute(request), replay = await repo.execute(request);
        return {seriesRevision: template.recurrence.series.revision, templateRevision: template.recurrence.template.revision.revision,
            tasks: repo.queryTasks().length, actualSteps: repo.getTask(task.id).steps.length, events: repo.queryHistory().length,
            replayed: replay.replayed, generationSupported: repo.recurrenceReadiness().generationSupported};
    } finally { await repo.close(); }
}
module.exports = example;
if (require.main === module) example().then(console.log);
```

Expected: series revision 2, template revision 1, one pre-authored task, zero actual Steps/events, replayed true and generationSupported false.

Run the three explicit `tests/recurrence-*.test.cjs` suites listed in the B1 verification report and `tests/recurrence-typecheck.cjs` with an existing TypeScript compiler. Persistent tests use unique OS Temp directories and actual child processes; they never infer a vault storage path. **B1 ONLY. STOP FOR USER REVIEW.**
