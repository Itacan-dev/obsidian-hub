# D10 versioned record and transaction contracts

**Unimplemented proposals — 2026-10-17. D10 remains unapproved.** These are review examples, not native declarations, persisted records, exported APIs or migration authorization. Version `1` below is a proposed contract version in a separate recurrence namespace; it does not silently increment or reinterpret the existing native store schema. Decisions are in [D10 decisions](TASK-SERVICE-D10-DECISIONS.md); static scenarios are in `ItacanTaskCore/temporal/b0/specification-vectors.json`.

## Common rules

Every record carries `contractVersion:1` and a record kind. Unknown versions reject without writes and retain original evidence. Native UUIDs are canonical and globally reserved within the coordinated allocation boundary; examples use UUID-shaped constants, never an allocator. Series, task occurrence, Step, template, template node, rule and event identities are different namespaces semantically and cannot share an allocated UUID. Revision is a nonnegative integer; immutable records cannot be overwritten. Owner is exactly `{kind:'project'|'resource',id}`; partition must match owner at all references. A mount does not change it. Raw external aliases are evidence, never native identities.

Local endpoints remain `{date:'YYYY-MM-DD',time:null|'HH:mm'}`. Null time is date-only; `00:00` is explicit midnight. Completed/created/modified timestamps are known UTC epoch milliseconds or null according to existing contracts; they cannot be inferred from a due date, template or local midnight. Existing D07 reversed-range quarantine and D08 Necessity semantics apply before proposed generation. No Schedule adapter is implemented here.

## Series and immutable rule revision

Proposed series fields: `seriesId`, `owner`, `revision`, `state` (active/paused/exhausted/stopped/quarantined/conflicted), `stateReason`, `activeRule:{ruleId,revision}`, `calendarPolicy`, optional `activeTemplate:{templateId,revision}`, `initialOccurrenceId`, `frontierOccurrenceId`, `committedOccurrenceCount`, and immutable generation-ledger references. A recovery fence is a repository-level safety condition, not a normal business-state transition. Series deletion must not erase ledger/tombstones or historical attribution.

Rule revision fields: `ruleId`, `revision`, `seriesId`, exact `originalEvidenceRef` or null for fresh-native authoring, structured `canonical`, `referencePolicy`, `originAnchor`, `endpointOffsets`, `effectiveAfterOccurrenceId`, `createdAt` and canonical digest. `canonical` specifies frequency DAILY/WEEKLY and positive integer interval for initial B; later bounds/monthly/timed fields are unsupported until separately versioned/approved. No best-effort Tasks text parser is implied. Fixed schedule selects next ordinal from immutable origin. when-done requires a known completion instant and captured series zone. Endpoint offsets are validated calendar-day differences from selected Due else Start; scheduled-only legacy fields remain quarantine evidence. A fixed rule edit explicitly specifies new origin/ordinal mapping at its future boundary; no implicit carry-over of a changed interval.

Synthetic example (all IDs illustrative):

```json
{
  "contractVersion": 1,
  "kind": "recurrenceSeries",
  "seriesId": "30000000-0000-4000-8000-000000000001",
  "owner": {"kind": "project", "id": "synthetic-project"},
  "revision": 3,
  "state": "active",
  "stateReason": null,
  "activeRule": {"ruleId": "30000000-0000-4000-8000-000000000002", "revision": 1},
  "calendarPolicy": {"calendar": "gregory", "zone": "Europe/Stockholm", "basis": "local-calendar", "gap": "review", "overlap": "review"},
  "activeTemplate": {"templateId": "30000000-0000-4000-8000-000000000003", "revision": 1},
  "initialOccurrenceId": "30000000-0000-4000-8000-000000000004",
  "frontierOccurrenceId": "30000000-0000-4000-8000-000000000005",
  "committedOccurrenceCount": 2
}
```

```json
{
  "contractVersion": 1,
  "kind": "recurrenceRuleRevision",
  "ruleId": "30000000-0000-4000-8000-000000000002",
  "revision": 1,
  "seriesId": "30000000-0000-4000-8000-000000000001",
  "originalEvidenceRef": null,
  "canonical": {"frequency": "DAILY", "interval": 1, "bounds": null},
  "referencePolicy": "fixed-origin-ordinal",
  "originAnchor": {"date": "2026-10-17", "time": null},
  "endpointOffsets": {"anchor": "due", "startDays": -1, "dueDays": 0},
  "effectiveAfterOccurrenceId": "30000000-0000-4000-8000-000000000004",
  "createdAt": 1792224000000
}
```

The example omits serialization digest values deliberately: canonical encoding/version, digest algorithm (proposed SHA256) and length-delimited tuple encoding must be specified and tested in the approved implementation. A display string or locale sort is not a canonical hash input.

## Occurrence and lineage

Each occurrence is an ordinary task with a unique task UUID plus proposed metadata: series UUID; owner; monotonic ordinal; predecessor UUID/null; successor UUID/null; captured rule identity/revision; captured template identity/revision/null; `generationOperationId` and `generationKey` (initial authored occurrence has neither); generation-original endpoints; current endpoints remain on the task; and captured reference evidence. Reference evidence includes policy, origin/ordinal or known completion instant/local day/zone, endpoint offsets, calculator/policy version, original raw evidence reference and resulting local endpoints. Keep “original at generation” distinct from later manual edits; fixed-origin policy does not silently follow edited dates.

If A-to-B is committed, A's successor must be B and B's predecessor A in the same partition. A task cannot be in two series. A's deletion preserves a lineage tombstone; B's deletion preserves its retired UUID and A-to-B ledger. Reopening or repeating A completion never changes B's current endpoints or Step tree. A non-frontier occurrence can have a new completion event without advancing frontier. Explicit future-rule/template edits affect the next ungenerated boundary, not already generated B.

Synthetic B metadata (abbreviated references use the UUIDs above; abbreviations are documentation only):

```json
{
  "contractVersion": 1,
  "kind": "occurrenceLineage",
  "taskId": "30000000-0000-4000-8000-000000000005",
  "seriesId": "30000000-0000-4000-8000-000000000001",
  "owner": {"kind": "project", "id": "synthetic-project"},
  "ordinal": 2,
  "predecessorId": "30000000-0000-4000-8000-000000000004",
  "successorId": null,
  "rule": {"ruleId": "30000000-0000-4000-8000-000000000002", "revision": 1},
  "template": {"templateId": "30000000-0000-4000-8000-000000000003", "revision": 1},
  "generationOperationId": "synthetic-complete-A-attempt-1",
  "generationKey": ["native-generation", 1, "project", "synthetic-project", "30000000-0000-4000-8000-000000000001", "30000000-0000-4000-8000-000000000004"],
  "originalEndpoints": {"from": {"date": "2026-10-17", "time": null}, "due": {"date": "2026-10-18", "time": null}},
  "referenceEvidence": {"policy": "fixed-origin-ordinal", "anchorDate": "2026-10-17", "nextOrdinal": 2, "zone": "Europe/Stockholm", "knownCompletionInstant": 1792224000000}
}
```

## Step template, revision and node lineage

Proposed template identity record: `templateId`, `seriesId`, `owner`, `latestRevision`, `retiredNodeIds`. Each immutable revision has `templateId`, `revision`, `parentRevision`/null, `effectiveAfterOccurrenceId`, `createdAt`, optional `description`, content/structure digest and ordered node records. Node fields are `templateNodeId`, parent node/null, sibling position and full N1-C lossless Step content. Nodes have no task completion flag, event binding or completion timestamp. Versioned task title/body content may be captured alongside the Step template; an explicit future-template action is required to change it. No legacy Markdown ownership is inferred.

Generated Step mapping: `(occurrenceId, templateId, templateRevision, templateNodeId) -> freshStepId`. The Step preserves full body, nested parent/order and content, but receives a new canonical UUID, `completed:false`, `completedAt:null`, `completionBinding:null`, fresh creation/modification timestamps and independent current state. A four-level tree is not flattened; duplicate visible text does not merge nodes. Retained template nodes keep node identity across revisions; deleted nodes retire, and a later identical-looking new node gets a new ID. Occurrence-only edits need not have a template node mapping for locally added Steps; they never mutate an old immutable revision.

Synthetic template revision:

```json
{
  "contractVersion": 1,
  "kind": "stepTemplateRevision",
  "templateId": "30000000-0000-4000-8000-000000000003",
  "revision": 1,
  "parentRevision": null,
  "effectiveAfterOccurrenceId": "30000000-0000-4000-8000-000000000004",
  "createdAt": 1792224000000,
  "nodes": [
    {"templateNodeId": "30000000-0000-4000-8000-000000000006", "parentNodeId": null, "position": 0, "content": {"title": "Inspect", "body": "Keep **this** body\n\nSecond paragraph."}},
    {"templateNodeId": "30000000-0000-4000-8000-000000000007", "parentNodeId": "30000000-0000-4000-8000-000000000006", "position": 0, "content": {"title": "Verify", "body": ""}}
  ]
}
```

For B, node `...006` maps to new Step `...008`, node `...007` to `...009`; neither reuses A's Step IDs or the node UUIDs. The new child Step's parent is `...008`, not the template node ID. These constants illustrate disjointness, not existing production records. Creation, explicit future-template update, retention/removal of nodes and occurrence-local edits require approved commands later.

Template revision timing is explicit: before generation the selected future revision applies; after B exists a new revision affects C, not B. Past-occurrence edits and completion checks stay local. While paused, an explicit template edit may create a new future revision; resuming captures that revision only for the next ungenerated occurrence. Rename, body edit, reorder and subtree reparent retain node identities in the new revision; deletion retires a node and descendants as explicitly selected. Independently customized B is never overwritten. Occurrence-only defaults avoid repeated prompts, while an explicit future-template action makes propagation intentional; future N3 UI must show that scope clearly without being added now.

Generated native content is derived from a rule/template, not a fresh capture of the original Markdown note. Keep an immutable original source-envelope reference and original rule evidence when available, plus separate native generated content/template lineage/parent/receipt. Do not duplicate the old envelope under a fabricated generated source path. Fresh-native authoring has no invented legacy source envelope.

## Proposed lifecycle transitions

| Trigger/state | Occurrence effect | Series/generation effect |
|---|---|---|
| Open frontier A completes | New completion event/current binding E1. | Atomically create B and spend A key, or commit proven terminal exhaustion. |
| Complete A already complete | Existing completion remains; no new event. | No new successor. |
| Reopen completed A | Existing reopen/counting semantics; E1 no longer current/countable. | B remains; key remains spent. |
| Recomplete reopened A | New E2/current binding. | Reuse A-to-B outcome; B unchanged; no branch. |
| B already generated/customized | B current state/content independent. | Future template/rule edits do not rewrite it. |
| Delete frontier B | Retire B/Step identities, preserve History/lineage evidence. | Pause frontier; key spent forever, no retry resurrection. |
| Delete historical A | A lineage tombstone remains; B stays. | No backward cascade or Oath relink. |
| Cancel current A | Cancel without counted completion event. | Pause; stopping entire series is a separate action. |
| Valid exhaustion | Last occurrence completes normally. | exhausted count/until/both; no successor allocation. |
| Pause series | Current occurrence may complete with existing approved completion semantics. | Defer generation without consuming key; no hidden next task. |
| Resume | Existing completed binding may be used by explicit advance; no new completion event. | Generate once from selected current future rule/template, or remain open awaiting completion. |
| Explicit future rule/template edit | Existing occurrence captured revisions retained. | New immutable revision and explicit future boundary; no retroactive History rewrite. |
| Invalid/unsupported/calculation ambiguity | Preserve evidence and reject dependent mutation. | Quarantine/review; never implicit one-off fallback. |

These are proposals. Pause/resume/cancel/replace commands can be deferred initially only if the unsupported transitions are rejected; they must not be partly exposed.

## Timezone and Schedule policy comparison

| Choice | Consequence | Proposed treatment |
|---|---|---|
| Fixed series zone at creation | Completion instant converts to the same local reference day on each device. | Recommend explicit captured IANA zone for when-done; no new production setting. |
| Current device zone | Travelling/offline devices can generate different next local dates. | Reject as implicit policy. |
| Owner/workspace zone | Could centralize behavior but no established production owner-zone contract exists. | Do not invent one; defer until explicitly configured/approved. |
| Explicit per-rule zone | Allows intentional future scheduling-zone changes. | Later immutable rule revision with explicit boundary, never silent mutation. |
| Date-only fixed schedule with no instant zone requirement | A calendar date remains useful without UTC conversion. | Keep date-only fields; any captured zone is provenance, not fabricated endpoint instant. |

For future timed rules, Start/Due retain exact local values and precision. Unique candidate instants may be recorded separately; zero/two candidate instants block generation for review, retaining all evidence. Rejecting nonexistent times is safe but less recoverable; shifting gaps or picking earlier/later overlap offset requires an explicit later policy, never JS defaults. Generation clock is a known captured instant; completion event time is its own known instant or null; neither is derived from an endpoint. Future Schedule representation should display preserved local dates/times and an unresolved-zone indicator when necessary, without manufacturing an offset or hiding the task. This is a display recommendation only; no Schedule code changes are authorized. Calendar recurrence preserves wall-clock fields; elapsed-duration recurrence must be a separate later capability.

## Two different receipts

**generationKey** is the versioned canonical tuple `['native-generation',1,owner.kind,owner.id,seriesId,predecessorOccurrenceId]`. It excludes completion event ID, attempt ID, device, rule revision and template revision so reopening, edits and retries cannot evade at-most-one successor. A key can have one immutable committed result: successor, exhausted, or an explicitly defined retired disposition retaining the original successor identity. Do not use an unescaped concatenated display string as the key.

**Command operation receipt** records operation ID, canonical input digest, captured caller-supplied clock, expected store/partition/series/task/rule/template revisions, original result identities, completionEventId/current-binding relationship, generation key/result, new task/Step IDs, committed revision and exact response. Existing operation ID + identical payload returns the original response before rejecting stale expected revisions. Same operation ID + different payload rejects. Retry must not allocate again or create an event. The receipt itself is not counted History.

**Generation ledger entry** is keyed by generationKey, not command ID. It records the first committing operation, predecessor, original successor/null, all original Step IDs/node mappings, captured rule/template/reference/calculator versions, completionEventId that triggered generation, committed revision and terminal proof if any. Later completion attempts can point to the same generation entry, but must have their own operation receipt and new event when the state transition is genuinely a new completion. They never replay E1 as E2.

Synthetic logical result:

```json
{
  "contractVersion": 1,
  "kind": "generationLedgerEntry",
  "generationKey": ["native-generation", 1, "project", "synthetic-project", "30000000-0000-4000-8000-000000000001", "30000000-0000-4000-8000-000000000004"],
  "operationId": "synthetic-complete-A-attempt-1",
  "completionEventId": "30000000-0000-4000-8000-000000000010",
  "result": {"kind": "successor", "taskId": "30000000-0000-4000-8000-000000000005", "stepIds": ["30000000-0000-4000-8000-000000000008", "30000000-0000-4000-8000-000000000009"]},
  "committedRevision": 12
}
```

After reopen E1 remains immutable historical evidence with the existing reopen/counting state represented by current core contracts. A new complete attempt makes E2/current binding and another operation receipt, but still references this generation entry. A repeated identical first operation still returns its original E1 response; it does not describe the current state as if E1 were newly counted.

## Terminal and quarantine outcomes

Proposed later terminal record: `{kind:'exhausted',reason:'count'|'until'|'both',seriesId,generationKey,ruleRevision,lastOrdinal,validatedBoundEvidence,nextCandidateLocalDate,completionEventId,committedRevision}`. Count includes the initial occurrence; only committed occurrence ordinals consume it. No allocation on terminal outcomes. Reopen, deletion and event retries never refund a count. Inclusive until compares validated local anchor dates. For both bounds, keep all applicable reasons. Terminal result and current successful completion commit together; replay returns the same outcome. Exhaustion is not series deletion and does not alter historical dates.

Proposed unsupported/quarantine result: `{kind:'quarantine',code,rawEvidenceRef,rawRule,originalEndpoints,zoneContext,parserVersion,diagnostics,requiredReview,automaticImportAllowed:false}`. Invalid grammar, partial parsing, invalid calendar date, unsupported version, unknown completion reference, ambiguous identity and DST gap/overlap are distinct codes. Preserve exact original strings/local values and all available evidence. Quarantine is not a success generation receipt, does not create a native series/task/event and cannot silently become one-off work. Explicit corrected canonical input creates a new reviewed reprocessing proposal; it never edits an immutable old plan.

For native calculation failure under otherwise accepted input, reject the dependent completion-and-generation transaction atomically and preserve diagnostic evidence. Do not classify an unexplained `null`/invalid result as valid exhaustion. A future “complete without advancing” user action requires its own approved policy/command, not an error fallback. Date-free and scheduled-only legacy rules remain unsupported initially.

## One future transaction authority

Current reusable facilities are `NativeTaskRepository.execute` (receipt lookup, detached draft, revision checks and single commit), domain validation, `applyCommand` event/current binding transitions, existing task/Step identity checks and memory/JSON storage fault hooks. None currently validates or persists the proposed records. A later approved schema version must add them to the same committed state. Independent N1-B plans stay immutable; two stores with receipts are not one transaction.

Exact future logical sequence:

1. Load latest verified state under the native writer authority; inspect recovery fence before allowing recurrence writes. Resolve owner/partition and operation identity. Look up an identical canonical operation receipt before stale expected-revision rejection; conflicting payload rejects.
2. Resolve current occurrence/series and lineage; validate owner/partition, lifecycle, expected store/partition/series/task and selected rule/template revisions. Read generationKey and existing generation result before deciding whether a successor is needed.
3. Validate all date/recurrence evidence and supported canonical semantics. Resolve captured fixed-origin ordinal or known completion-local-day reference. Check valid explicit bounds; distinguish proof of exhaustion from invalid calculation.
4. Determine valid next local endpoints and selected immutable Step-template content. If a generation entry already exists, reuse its original successor/terminal result and do not recalculate or rewrite B. If paused with a permitted deferred completion, record that explicitly without spending the key.
5. Allocate/reserve all new task/Step/event/record IDs against one reservation authority. Validate existing native IDs, retired IDs and captured external reservations. Allocation conflicts abort; abandoned drafts never publish partial identities. IDs acknowledged or exported can never be reused.
6. Apply current task completion, correct new event/current binding, and reopen/counting semantics as appropriate. An identical replay has already returned. A genuinely new recompletion creates a new event even when generation was already spent.
7. If allowed, create B and fresh open Steps, mapping node lineage; retain lossless content. Link A-to-B reciprocally, update series frontier/count/lifecycle, or record validated terminal outcome. No task allocation on exhaustion.
8. Write new records, identity reservations/tombstones, event/binding transitions, generation ledger and operation receipt in one detached draft. Validate full state, serialize with the same storage authority and commit once. Publish/acknowledge only after commit. Failure before commit exposes no partial state; lost acknowledgement retries recover original identities if latest state survives.

## Reservation coordination

Fresh-native allocation must use the native transaction's common reservation authority, covering task/Step/series/rule/template/node/event IDs as required by the approved schema, including retired identities. For synthetic tests, supply an explicit immutable external-reservation inventory and exclusive writer boundary. Migration-planned IDs remain owned by immutable N1-B plans. Their reservation cannot be consumed atomically by merely committing a native receipt.

Later integration must either bring reservation/plan-consumption state under one approved transaction authority, or use a fenced exclusive coordinator that blocks concurrent plan changes/allocation and records a verifiable plan revision before adoption. A crash-safe lease/consumption protocol needs its own proof; until then, conflicting or changing planned inventories block allocation. Never run independent “best effort” UUID allocators and claim cross-store atomicity. Pure abandoned uncommitted allocations need not be published, but any identity that escaped acknowledgement/export is conservatively reserved pending reconciliation. Shared/offline IDs need N4 conflict evidence in addition to local uniqueness checks.

## Recovery limitation and proposed fence

The existing JSON repository can use a verified ancestor after known corruption. That may lose an acknowledged successor, completion event and receipt while another device retains B. On such fallback, absence of the generation entry does not authorize generating B2. Proposed strategy: a **recovery fence** blocks all recurrence-critical writes and replay-as-new after any ancestry recovery; retain recovered evidence for read/review, reconcile against verified latest generation/receipts and independent copies, then explicitly clear the fence under the same authority. No automatic regeneration from an ancestor. Unsupported future schema remains an error, not a fallback trigger.

| Strategy | Value | Limitation | Recommendation |
|---|---|---|---|
| Fail closed after fallback | Prevents duplicate regeneration when acknowledged ledger may be missing. | Availability cost; needs durable/revalidated recovery signal. | Required initial safety boundary. |
| Stronger append-only receipt journal | Can retain generation evidence across state loss. | Needs ordered atomic commit/integrity/retention proof; two files alone do not solve acknowledgement. | Evaluate later, no implementation claim. |
| Durable acknowledgement watermark | Can detect rollback beyond acknowledged revision. | Watermark can also be lost; separate-store atomicity is unresolved. | Not a substitute for fence. |
| Explicit reconciliation | Can preserve external B and immutable history before resuming. | Requires reviewed identity/event reconciliation and user-visible conflict handling. | Required before clearing fence. |
| Host-integrated recovery | Can coordinate real file durability, restart and fences. | Production host is N3; synthetic memory tests cannot establish OS durability. | Later integration and process-crash proof. |

A local retry guarantee is conditional on surviving latest committed state or verified reconciliation. Gate B tests must explicitly expose that condition rather than assert durability of lost receipts. Do not modify existing core ancestor recovery in B0.

## Sharing, History and Oath boundaries

Both Itacan and Obsidian Hub shared Project series remain Project-owned. Knowledge (`study`), Research (`literature`), Explorations (`references`) and Inspiration (`inspiration`) remain private Resource owners, even through mounts. No private source, identity aliases, event, Oath or receipt evidence may flow into a Project export. N4 must transport canonical owner-partitioned lineage and detect two successors for the same generationKey. Preserve both branches and their completed work/events, pause and quarantine conflict, then reconcile explicitly. Local exactly-once receipts prove no distributed uniqueness.

N1-E must solve historical event/current-binding import before adopting legacy completed occurrences; new tasks, templates and generation entries are never counted History. N1-F retains occurrence-specific Oath commitments and existing `{id,path,text}` resolution; no automatic relinking to B, including after deletion or reconciliation. Statistics' five ranges, All time default, original attribution and reopened-event handling remain unchanged. No N1-E/N1-F/N3/N4 capability is implemented by these proposed records.
