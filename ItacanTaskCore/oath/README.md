# N1-F1 — Private Oath compatibility evidence

Inactive implementation of the reviewed F1 gate. This separate Node-only entry point does not enter `src/index.js`, the Task Service host or production bundles. It performs no filesystem access, allocation, subscription, mutation, authority discovery or persistence. F2 requires separate review.

## API and evidence boundary

`require('./index')` exports `DECISION`, `READINESS`, `PRIVATE_CLASSES` and five pure functions. Declarations are in `contracts.d.ts`; import types from that explicit file. The decision revision is `N1-F1-F01-F10-r1`. Unknown versions, decisions and mandatory fields reject. Inputs must be ordinary finite JSON; input state is never normalized or modified.

| Function | Result and limit |
| --- | --- |
| `analyzeOathEvidence(capture)` | Private accounting, candidate-overlap groups and blockers. Accounting is not Statistics, readiness, imported activity or an Oath outcome. |
| `resolveCommitmentTarget(target,capture)` | Exact target disposition, detached current task and separate navigation intent. Does not acquire a lease or change authority. |
| `assessCompletionEligibility(target,capture)` | Genuine current native completion eligibility. Legacy returns `unsupported` so its existing state-based consumer remains authoritative. |
| `assessMigrationProtection(oaths,capture)` | Whole-tree protection for scheduled/active sessions; unresolved or competing sessions yield `protection-unknown`. Always `migrationAuthorized:false`. |
| `classifyTaskSharing(task,owners)` | Private/blocked/canonical-fields-only classification. Always `packet:null`; it is not a serializer or export authorization. |

`OathEvidenceV1` requires the format/version/decision, `privacy:'local-private'`, `scope:'closed-synthetic'`, a complete pinned synthetic owner registry, and explicit nullable legacy/native/identity observations. Native logical snapshots run the existing full domain validator, including schema-4 imports and B1/B2 recurrence. Identity snapshots run the unchanged N1-B validator. No store is opened. Supplied readiness and recovery observations are closed-input attestations, not discovered storage health or live freshness guarantees.

The registry separates physical owner, physical root, partition, status, availability and reviewed sharing approval. N1-B registry validation retains global owner/root uniqueness and private Resource restrictions. Sharing approval must name the exact owning Project/root and review digest within Itacan or Obsidian Hub. A mount/presentation field is not accepted as another owner.

Legacy read evidence must originate from the existing `resolveOathWork` contract. A JSON shape check cannot independently prove a fresh source read; callers must retain the pinned capture boundary. There is no generic untrusted-input authorization API.

## Minimal target contract

`CommitmentTargetV1` retains the existing `(deviceId,oath.id)` session identity, original reference, enrollment owner and explicit authority. Legacy originals remain exact `{id,path,text}`; native originals contain task UUID and display-text snapshot. No new commitment or outcome UUID is allocated.

Native authority carries store UUID, partition, task UUID and enrollment repository revision/revision ID/task revision. A legacy-origin native target additionally requires the exact alias token, identity-store UUID, ledger revision, published plan ID/digest and source snapshot digest. `snapshotDigest` is N1-B's source snapshot digest, not a newly invented ledger digest. An alias proves identity only; task publication and enrollment still require native evidence.

Resolution never interprets a UUID-looking legacy token as permission to search another authority. It does not case-fold, trim, title-match, prefer a local owner, follow a series/template node or repair a missing alias. Published-but-uninstantiated targets are pending; import reservations distinguish eligible preparation from whole-tree quarantine. Deleted tasks, retired Step IDs, kind conflicts, owner/partition changes, stale alias pins and recovery uncertainty cannot become another task.

Only parent tasks can be committed in version 1. Step identities/ancestry are verified through their parent task and actual N1-C/core validators. A Step alias cannot become a parent. Independent Step enrollment remains outside F1/F2.

Resolved native navigation is `{kind:'native-task',id}`. A native task needs no source note. Historical paths and optional location remain separate evidence; no fallback note is fabricated. The existing N0 task/location/provenance contract remains unchanged and no UI navigation is installed.

## Source-backed behavior preserved

Production remains `TaskService -> LegacyTaskAdapter -> Markdown/effective metadata`. See plugin `lib/services/task-service-host.js::createLegacyTaskService`, `services/oath.js::take/resolveWork/readNewWork`, `services/task-service-legacy-oath-committed.js::legacyOathCommitted`, and `domain/oath.js::oathProgress/fulfilmentTime`.

| Concern | Observed legacy behavior | F1 disposition |
| --- | --- | --- |
| Enrollment | Open physical parent tasks from an available Active Project or Resource; Steps are displayed only | Preserve parent selection; no independent Step commitment |
| Stable identity | Exact parent ID plus fresh source/owner checks; saved path/text are snapshots | Native UUID or exact published alias under explicitly pinned authority |
| Rename/move | Same-owner unique ID can resolve after title, line or note changes | Identity stays pinned; owner changes reject |
| Copies | Global parent/Step identity conflicts; no same-title rescue | Existing N1-B quarantine and native reservations remain authoritative |
| Steps | Completion is independent; parent can complete with open Steps | No parent completion inferred from Step events |
| Progress | Current checked parents; may decrease before fulfillment | Separate display state from native fulfillment eligibility |
| Fulfillment | Deadline or all selected parents; latch does not automatically end Oath | Reuse actual helpers; do not count notifications |
| Outcomes | Existing Oath service saves terminal current/history before release | No second outcome store or per-event outcome counter |
| Standard/Strict | Shared reads/helpers/persistence, different activation/exit/recovery | Fake hosts only; enforcement unchanged |
| Strict recovery | Lost host session records interruption, never automatic lockdown | Preserve; no host is prepared by analysis |
| History | Recorded ownership and snapshots independent of current location | No historical owner or timestamp rewrite |
| Recurrence | Commitment refers to A, never its successor | Distinct occurrence, Step, node, series and event identities |
| Navigation | Status rows are presentation; task panels retain legacy actions | Native intent only, no production opener |

The frozen corpus has 30 actual legacy observations: 28 source scenarios and two bridge histories. `oath-source-graph-v1.json` captures the actual 175-file source closure with origins, byte lengths, base64 bytes and SHA256. Tests materialize that graph only in OS Temp and execute its real helpers independently of current source. The legacy observations and 12 reviewed native policy expectations occupy separate arrays; no historical phase observations are recaptured.

### Both awaitingIndex histories

`take` validates/writes through the existing queue, persists `{id,path,text}`, then `readNewWork` seeds the operation-local map from fresh source. It supports both a newly allocated ID awaiting Dataview and an existing source ID whose older index snapshot is ID-less. Both retain fresh ID, parent-kind and physical-owner checks. Canonical indexed recognition retires the bridge on a current result batch. No timer expires it; the map is not persisted and restart does not recreate it from title/path. Missing/copy/foreign-owner/source-kind conflicts do not authorize rescue. Native publication pending is a separate disposition.

## Completion, enrollment and recovery

F02/F03/F04 are selected for this inactive gate: defer committed trees, preserve parent enrollment and require genuine native receipt proof after enrollment.

The enrollment anchor must identify a retained receipt and the most recent task snapshot at or before that repository revision. That snapshot must be open/live/unarchived, with matching task revision, owner and partition. An imported already-completed target cannot manufacture such an enrollment. A source/identity plan alone cannot establish it.

When exact live identity/owner are known but enrollment proof is unavailable, the private result can retain detached task display state with `state:'unavailable'` and no navigation authorization. Thus an imported checked task remains visibly checked without qualifying for fulfillment or enrollment.

Eligibility follows the current binding to its counted task event and immutable creation operation. Supported genuine parent operations are `task.complete(completed:true)` and `recurrence.complete`. The creation receipt must be after the enrollment anchor, name that event and contain the matching completed parent snapshot. Import references, historical append, Step events, creation receipts and no-op completions are not substitutes. Explicit null or backdated completion times remain valid; repository publication order determines eligibility. Optional Oath context is audit metadata, not proof or a required enrollment match.

Reopening makes the old event uncounted and clears the current binding through the unchanged shared helper. Recompletion can qualify through E2 while recurrence retains the original A-to-B outcome triggered by E1. B never inherits A's commitment. Template/rule identity cannot redirect the target.

F06 remains an inactive reviewed proposal: exclude archives from new enrollment while retaining an existing archived target and genuine completion evidence. Workspace shelving affects new enrollment, not an existing commitment's identity. Every scheduled/active target protects its complete task tree, including fulfilled-but-still-active sessions. Invalid targets or competing session snapshots yield unknown protection and never authorize migration.

Recovery observations use existing N0 readiness states. Known affected task/descendant IDs, unknown scope, empty fence scope or unmappable protected Steps block new task-based fulfillment. Proven unrelated scope can leave independent reads available. No legacy fallback, marker clearing, store opening, high-water reset or root substitution is exposed. The supplied captured observation does not replace E2-R's persistent private-v4 checks.

Actual service tests demonstrate the existing unsaved-latch limit: failed persistence retains a latch in the same process; after source reopening and service reconstruction, that unpersisted latch is absent. This is observed behavior, not a durability repair. F1 adds no persistence boundary or interruption protocol. Task commits, identity plans and Oath saves remain separate. Durable intent, active handoff and complete offline-device coordination belong to N3/N5.

## Ownership and privacy

Both shared Projects are tested independently, alongside a private Project and Knowledge/study, Research/literature, Explorations/references and Inspiration/inspiration. Resource ownership is physical; mounting it in either Project permits navigation only. There is no `linkedProjectId`. Labels, source paths, mount placement and current UI context do not rewrite enrollment or historical owner snapshots.

Canonical task fields and supported completion references are only potentially shareable under an owning Project's explicit approval. Original bytes/paths, alias ledgers, plans, quarantine, receipts, recovery evidence, raw History, Oaths/outcomes/focus, Strict/device configuration and all Resource data remain private. N1-C continuation/Step bodies stay private pending a reviewed public content contract. Existing direct/repository import-dependent and recurrence export restrictions remain in force.

Source-backed legacy exceptions are recorded separately: tracked shared Markdown contains Hub ID comments; `selectShared` copies selected task metadata without an inner field allowlist. The read-only implementation baseline contains one shared `captureSource` with an origin/path outside both shared Project roots. No actual path is reproduced in public specimens. Legacy Resource-root migration can update recorded paths/labels. These behaviors are not adopted as native policy or changed by F1. N4 must review concrete transport and inherited exposure before claiming a clean native sharing boundary.

## Verification and next gate

Run the four explicit `.test.cjs` files with the phase's OS Temp write guard, then `tests/typecheck.cjs <existing typescript.js>`. New tests use actual production Oath helpers/fake-host methods, N1-B published plans, N1-C/core Step operations, E2 memory imports, B2 generation/recompletion and the actual serializers. They test current and frozen graph execution, exact aliases, negative evidence, receipt order, overlap, quarantine, owner/mount privacy, restart/latch limits and cold-process dependency denial.

No real Obsidian startup, Strict launcher/watchdog, focus/window control or global input test is run. Process-interruption checks in the earlier acceptance inventory exercise only their existing guarded disposable storage. The F1 tests do not claim new crash durability.

See `lib/tests/native-oath-f1-verification.md` for executed counts, prior regression inventories, protected comparisons, attempts and evidence seal. F2 is a separately authorized inactive adapter through N0 ports and private receipt evidence; it cannot route production, add another authority or infer cross-store atomicity. **STOP FOR REVIEW AFTER F1.**
