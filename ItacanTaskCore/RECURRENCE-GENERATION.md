# Inactive native recurrence — Gate B2

2026-10-17. B2 adds an opt-in generator inside the standalone core. The production plugin still uses the Legacy Adapter. Opening a store never prepares a series or generates a task. This document supersedes B1's generation limitations only for the explicit B2 contracts below; historical evidence and B1 contracts remain unchanged.

## Supported calculation

`calculateRecurrenceEndpoints(ruleRevision, nextOrdinal)` is a portable pure export. It accepts an immutable validated B1 rule revision: structured DAILY/WEEKLY, positive safe-integer interval, `fixed-origin`, Gregorian calendar, explicit supported IANA zone, and date-only Due or Start. Due is the anchor when present. Both endpoint offsets come from the rule's original captured dates.

The calculator uses civil days: `origin + (nextOrdinal - 1) * interval * (daily ? 1 : 7)`. The inverse uses bounded year/month lookup. It checks integer precision and dates 0001-01-01 through 9999-12-31 before constructing endpoints. Absent endpoints stay null; present endpoints keep `time:null`. It uses no device-local Date or elapsed-millisecond arithmetic. Missed dates can remain past due. Editing an occurrence never reanchors this calculation.

The version-1 `fixed-origin-civil-day-v1` evidence includes rule UUID/revision/digest, frequency, interval, origin, ordinal, calculated anchor, captured offsets, zone and complete endpoints. Invalid arithmetic, range, schema, precision or endpoints rejects the dependent transaction. Failure is never exhaustion or permission to complete without advancing.

## Storage and versions

| Layer | B1 compatibility | B2 extension |
|---|---|---|
| Task | Native schema 1 | Unchanged, including N1-C private content |
| Repository / manifest | Schema 1 task-only; schema 2 definition-only | Explicit preparation commits schema 3 |
| Recurrence namespace | Version 1, empty ledger, initial definitions | Version 2; same `itacan-recurrence-foundation` format name |
| Mandatory capabilities | `recurrence-foundation-v1` | Exact ordered pair `recurrence-foundation-v1`, `recurrence-generation-v2` |
| Series, rule, membership, template identity | Existing version 1 | Existing vocabulary retained; validated generated lineage/count |
| Template revision | Version 1 Step tree | Append version 2 complete task-and-Step revision |
| Read/result snapshot | Version 1 | Version 2 adds `frontierMembership` and nullable `completion` |
| Committed generation outcome | Empty live B1 ledger | Version 2 immutable outcome with creation evidence |

Only series whose active template revision is version 2 are prepared. Schema-3 stores may also contain unprepared B1 series, preserving their behavior. No opening-time rewrite occurs. A namespace/store version mismatch, missing namespace or unknown mandatory capability rejects with `UNSUPPORTED_SCHEMA`; recovery cannot downcast it. Tests execute the actual frozen B1 source graph against B2 manifests and generations with schema-2 ancestry and prove rejection without fallback.

Preparation is a **separate commit before generation**. A generation's prior/recovery manifest therefore already carries schema 3. Ordinary commits after fallback preserve the highest known manifest barrier. A lost preparation can recover B1 state, but the persistent recurrence fence still blocks generation; no successor was committed by preparation.

## Complete future content

Every version-2 template revision requires `taskContent:{title,description,continuation,importance,location,phase}`. Strings are explicit; importance/location/phase require intentional values or null. The template's administrative `description` remains separate from task prose. Dates come only from the selected rule/calculator. Owner and partition come only from the series.

The full explicit node draft uses B1 `state:'existing'|'new'` intent, stable template-node UUIDs, parent-node/null, contiguous sibling order, title and lossless body. Deletion requires exact subtree/cascade confirmation; removed node IDs retire permanently. A future revision applies after the **current frontier**, never rewrites an existing occurrence and never infers content from it. After preparation a version-1 template edit rejects. Rule revisions retain B1's explicit initial boundary before first generation; after any successor exists they reject pending separately reviewed reanchoring.

Generated tasks and Steps receive fresh UUIDs and known creation/modification clocks, open state, null completedAt, null archive/deletion and no bindings. Capture source is null. N1-C `private-native-content-v1` stores native continuation/Step bodies with an empty originals list, null previous evidence and null importedAt. Its migration-schema slot is a native content container, not fabricated import provenance. Predecessor content, checks, events and incidental edits are not copied.

## Commands and reads

The B1 four-entry `RECURRENCE_COMMANDS` export is unchanged. The separate frozen `RECURRENCE_GENERATION_COMMANDS` catalogue has `version:2` and `commands:['recurrence.prepareGeneration','recurrence.complete']`. All operations use the existing `TaskRepository.execute`; there is no second dispatcher/storage authority.

Each new command requires top-level `operationId`, `taskId`, `expectedRevision`, `expectedRepositoryRevision`. Its payload requires `version:2`, `seriesId`, `owner`, `partitionId`, `expectedPartitionRevision`, `expectedSeriesRevision`, `expectedRuleRevision`, `expectedTemplateRevision`, `expectedInventoryRevision`, and `reason`.

| Operation | Additional payload and behavior |
|---|---|
| `recurrence.prepareGeneration` | Full `description`, `taskContent`, `nodes`, `deletions`, `effectiveAfterOccurrenceId`. Requires an existing explicitly approved Step template, including empty, and an open live date-only initial occurrence with no outcome. Appends a complete revision under the existing UUID/digest chain. No task, Step, event or binding is created. |
| `recurrence.reviseTemplate`, version 2 | Same complete draft. Requires a prepared series and current-frontier boundary. Old occurrences retain their captured definitions/current content. |
| `recurrence.complete` | Optional `completedAt`, preserving native known timestamp/null/default-clock semantics. Completes an open frontier and generates one successor; an open historical member with an outcome reuses it. |

Currently completed B1 initial tasks reject preparation with `RECURRENCE_RECONCILIATION_REQUIRED`; B2 never reopens, retimestamps or implicitly advances them. Unprepared generation attempts reject. Already-completed prepared tasks reject `RECURRENCE_ALREADY_COMPLETED`, producing no event or new success receipt.

`recurrenceReadiness()` retains version 1 and literal `generationSupported:false`. Use `recurrenceReadiness({version:2,seriesId})` for B2 capability, eligibility/blockers and captured inventory revision. It is a read snapshot, not a lease, disk-fence refresh or external inventory freshness guarantee. Mutation rechecks authority.

`getRecurrenceSeries(id,{version:2})` returns current definitions, initial membership, frontier membership and `completion:null`. The old form serves unprepared B1 definitions; it rejects prepared definitions with `UNSUPPORTED_SCHEMA`. Completion command snapshots instead select the targeted occurrence as `membership`; `frontierMembership` remains explicit.

## One commit and one spent key

The stable key remains the canonical B1 tuple `["native-generation",1,owner.type,owner.id,seriesId,predecessorTaskId]`. It excludes dates, revisions, devices, command IDs and completion events. One transaction-local reservation set spans live/deleted tasks, live/retired Steps, History events, recurrence identities, immutable external inventory and staged new identities. Allocation retries at most sixteen candidates per missing UUID; explicit conflicts reject. External inventory is captured/revision-guarded, not a cross-store lease or plan-consumption protocol.

`completion-transition.js` contains the original native event/binding/reopen behavior shared by ordinary and recurrence commands. The detached candidate calculates and stages the successor/Steps/content, applies E1/current binding, records reciprocal membership, advances frontier/count once, appends the immutable outcome and normal operation receipt, validates, rechecks the fence, and commits once through the existing repository/JSON publication boundary. A dependent failure leaves the prior whole state. Publication acknowledgement loss returns the existing `ACKNOWLEDGEMENT_LOST` contract and requires identical retry.

A version-2 ledger outcome contains the stable key, series/predecessor, original operation/receipt, original completion event, committed repository revision, rule/template revisions and digests, calculation evidence, generation clock, successor/Step-node mappings, the complete fresh-open creation task snapshot and canonical digest. The original receipt carries identical outcome/creation evidence. The mapping inherits no checks/events/bindings. Series revision equals rule revision plus template revision plus generated successor count.

Later edits, Step completion/deletion and native content revisions are allowed. Validation compares immutable creation evidence to its selected template and original receipt; it does not demand that the current task/Steps remain unchanged or open. Missing original Steps must retain native retirement evidence. Historical membership snapshots preserve original fields; their null successor may advance only to the ledger-backed successor. Missing successor records, contradictory lineage, lost ledger or receipts are validation/recovery failures, never instructions to allocate another B.

## Replay, reopening and ordinary guards

An identical command replays its original result before stale revision checks, subject to the persistent fence. A changed payload under the same operation ID rejects `OPERATION_CONFLICT`. Distinct competing commands cannot both commit the same open frontier. A new operation targeting a completed occurrence rejects without a receipt.

Reopening A uses native semantics: E1 becomes uncounted/reopened, its current binding disappears, and B plus A's spent key stay unchanged. Recompletion creates E2/current binding and a new receipt, while `completion.outcome.completionEventId` still identifies E1. `completion.completionEventId` identifies E2 and `reused:true` identifies outcome reuse. B, its Step content and the current frontier remain unchanged, including after a later template revision. Replaying the original E1 command returns historical E1 evidence; it does not re-count E1.

New ordinary `task.complete` attempts with `completed:true` on prepared members reject `RECURRENCE_COMMAND_REQUIRED`. Verified identical historical receipts can replay without mutation. Ordinary reopening is allowed subject to the fence. Task update/structure commands retain strict patches and cannot set parent completion; Step completion remains independent. Local archive/relocation/content edits never modify future templates. Archived or incompatible timed frontiers cannot generate. Member deletion/owner transfer stay unsupported. Historical-only append cannot establish a current binding.

Retained-deletion behavior has a static tombstone fixture followed by executed historical recompletion: the original outcome stays spent and B is not resurrected. This does **not** implement deletion/cancellation/pause/resume/replacement commands.

## Recovery and boundaries

The existing `RECURRENCE-FENCE.json` is the only persistent recurrence marker. Known fallback writes/verifies it before returning recovered state. Recurrence commands and known-member parent completion/reopening check it before receipt replay and before commit. Unrelated ordinary work remains available. Partial/invalid markers block; unknown marker versions reject. No marker clear/rename/replacement API exists.

Actual child-process tests exercise generation, recompletion, preparation and existing fence stages. Tests verify dead PID, host/token and lock refusal before moving that child's exact lock within its disposable directory. Tests also cover CURRENT replacement errors before and after actual publication, lost acknowledgements, corrupted acknowledged successors/receipts, ordinary writes and repeated restart while fenced.

Guarantees are limited to tested cooperative local persistence and process interruption with intact evidence. No power-loss, OneDrive/cloud rollback, hostile-writer, distributed uniqueness or cross-store transaction guarantee is claimed. Recurrence-bearing partition exports remain blocked pending N4. Mounted Resources remain privately owned. B2 adds no production host, UI, migration, Oath routing, historical import, installation or reload.

## Runnable synthetic memory example

Run this JavaScript from the workspace root with an existing Node runtime. It opens only synthetic memory storage.

```js
const {randomUUID}=require("node:crypto");
const {createMemoryRepository}=require(process.cwd()+"/ItacanTaskCore/src");
(async()=>{
 const owner={type:"resource",id:"synthetic-study"},partitionId="synthetic-memory";
 const repo=await createMemoryRepository({partitions:[{id:partitionId,kind:"resource",owner}],idFactory:randomUUID,clock:()=>1800000000000,externalReservations:{version:1,revision:"exclusive-synthetic-1",ids:[]}});
 const initial=(await repo.execute({operationId:"create",type:"task.create",payload:{task:{owner,title:"Authored A",due:{date:"2026-10-17",time:null}}}})).task;
 const command=(operationId,type,payload)=>({operationId,type,taskId:initial.id,expectedRevision:repo.getTask(initial.id).revision,expectedRepositoryRevision:repo.info().revision,payload});
 const base={version:1,owner,partitionId,expectedInventoryRevision:"exclusive-synthetic-1",reason:"Explicit synthetic definition"};
 const definition=(await repo.execute(command("define","recurrence.defineSeries",{...base,rule:{version:1,frequency:"DAILY",interval:1,referencePolicy:"fixed-origin",calendar:{calendar:"gregory",zone:"Europe/Stockholm"}}}))).recurrence;
 const sid=definition.series.id;
 await repo.execute(command("steps","recurrence.defineTemplate",{...base,seriesId:sid,expectedSeriesRevision:definition.series.revision,description:"Approved empty checklist",nodes:[]}));
 const guards=()=>{const s=repo.getRecurrenceSeries(sid,{version:2}).series;return{version:2,seriesId:sid,owner,partitionId,expectedPartitionRevision:repo.info().partitions[0].revision,expectedSeriesRevision:s.revision,expectedRuleRevision:s.ruleRevision,expectedTemplateRevision:s.templateRevision,expectedInventoryRevision:"exclusive-synthetic-1",reason:"Explicit synthetic B2 operation"};};
 await repo.execute(command("prepare","recurrence.prepareGeneration",{...guards(),description:"Administrative template",taskContent:{title:"Future task",description:"Task description",continuation:"Native body",importance:null,location:null,phase:null},nodes:[],deletions:[],effectiveAfterOccurrenceId:initial.id}));
 const completion=command("complete","recurrence.complete",guards());
 const result=await repo.execute(completion);
 const b=repo.getTask(result.recurrence.completion.outcome.result.taskId);
 if(b.due.date!=="2026-10-18"||b.completed)throw Error("Unexpected successor");
 if(!(await repo.execute(completion)).replayed)throw Error("Receipt missing");
 console.log("Synthetic B2: one open successor on "+b.due.date);
 await repo.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
```

Run the three explicit B2 test files with `--test`; include the existing OS Temp mutation guard in this workspace's verification workflow. Supply the existing TypeScript compiler to `tests/recurrence-generation-typecheck.cjs`. No package installation is required.

Deferred: when-done, count/until/exhaustion execution, monthly/yearly/clamp/skip, timed/elapsed recurrence, catch-up batches, natural-language parsing/adoption, rule edits after generation, deletion/cancellation/pause/resume/replacement, N1-E historical binding/import, N1-F Oath integration, N3 hosting/activation and N4 transport/conflict reconciliation. **STOP AFTER B2 FOR USER REVIEW.**
