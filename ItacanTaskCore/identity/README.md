# N1-B inactive private identity planning

2026-10-17. D01, D02, D03, D17 and D18 are **approved for inactive synthetic/disposable implementation** by the N1-B request. This directory is not imported by the native task entry point or plugin. It creates no task/Step records, completion events/bindings, Oath outcomes, source writes or production authority. No live migration or public alias transport exists.

See [verification](../../.obsidian/plugins/hub-project-menu/lib/tests/native-identity-plan-verification.md), [N1-C handoff](../../.obsidian/plugins/hub-project-menu/lib/services/TASK-SERVICE-PHASE-N1-C.md), [N1-A specification](../../.obsidian/plugins/hub-project-menu/lib/tests/native-migration-compatibility-spec.md) and [frozen vectors](../../.obsidian/plugins/hub-project-menu/lib/tests/native-migration-compatibility-v1.json). N1-A decisions/observations remain frozen; this document records the subsequent five approvals, rather than rewriting the prior review sheet.

## Entry points and boundaries

| File | Responsibility |
|---|---|
| `domain.js` | Deterministic evidence analysis, canonical SHA-256, format/state invariants; no filesystem or plugin imports |
| `repository.js` | Memory adapter, serialized operations, approval, allocation, publication and receipts |
| `node-store.js` | Explicit OS Temp directory adapter and forensic lock inspection/preservation |
| `contracts.d.ts`, `repository.d.ts`, `node-store.d.ts` | Typed records and actual runtime entry points |
| `tests/` | Synthetic owners/captures, memory/directory behavior, faults/corruption/crashes and strict types |

Use `require('./repository')` for memory and `require('./node-store')` for disposable directory persistence. The domain uses Node SHA-256 for deterministic computation; it is not advertised as a browser-portable entry point. Existing `../src` remains unchanged and portable. No new module enters production bundle factories. New stores never infer a vault path. Directory creation/opening is rejected outside an existing ordinary OS Temp subdirectory, including resolved symlink escapes. There is no production storage configuration.

`IdentityRepository` exposes detached `snapshot()`, `getPlan(id)`, allocation-free `analyze(sourceSnapshot)`, `resolveAlias(exactId, expectedOwner?)`, serialized `execute(command)` and `close()`. Snapshots are **private**, not export payloads. `publicProjection()` always throws `UNSUPPORTED`; there is no shared export method. `resolveAlias` returns identity evidence only, never a task/readiness DTO or production Oath result.

## Independent versions and strict records

Every record field listed below is required unless explicitly described as an optional constructor option. Nullable fields must be present as null. Unknown record fields are rejected; arbitrary preserved evidence is confined to validated portable `privateEvidence` JSON and captured source strings. JSON arrays must be dense; nonfinite numbers, accessors, unsafe keys and non-JSON values are rejected through existing core value helpers. Raw nested evidence preserves scalar types, null/absence and array order.

| Version key / record | Supported reader and writer version |
|---|---:|
| Published planning snapshot (`versions.snapshot`) | 1 |
| Source snapshot and captured evidence (`versions.evidence`) | 1 |
| Identity plan (`versions.plan`) | 1 |
| Alias (`versions.aliases`) | 1 |
| Reservation (`versions.reservations`) | 1 |
| Quarantine (`versions.quarantine`) | 1 |
| Operation receipt (`versions.receipts`) | 1 |

Keys are independent even though each currently supports only version 1. This compatibility map is explicit; none inherits native repository schema 1, N1-A fixture version 1 or Task Service versions. Pointer format version 1 is also independently checked. Current evidence parser version is 1; other versions fail before allocation. Unknown/newer versions return `UNSUPPORTED_VERSION`; unrecognized decision revisions return `UNSUPPORTED_DECISION`; unknown fields/capabilities fail closed. No downgrade, field stripping, format upgrade or schema migration is implemented.

The exact supported decision revision is `N1-B-D01-D02-D03-D17-D18-r1`. The sole required capability is `private-identity-planning-v1`; an unknown capability is rejected. A version failure cannot be recovered by loading an older empty state.

## Source snapshot and occurrence evidence

`SourceSnapshot` has `version`, `id`, `revision`, `registryRevision`, `parserVersion`, `scope`, `files`, `occurrences`. Scope must be `global-synthetic`. This is an explicitly supplied corpus, **not** a vault scanner or proof that the caller included every vault file. Within that corpus, every recognized checkbox line outside fenced examples must have exactly one occurrence. Missing checkbox candidates fail `INCOMPLETE_CAPTURE`; duplicate positions fail before allocation. Global collision analysis never applies a selected-workspace filter.

Files carry `id`, `path`, `revision`, `content`. File IDs are caller-owned source-lineage evidence and must remain stable across moves; they are not native task identities. Source path and file ID both participate in re-planning conflict checks. Full captured strings remain private identity/review evidence; this is not the deferred native D06 content schema, editor or Search representation. No source file is opened by the analyzer.

Occurrences carry `entryId`, `kind` (task/step), `fileId`, `line`, exclusive `end`, `ordinal`, `parentEntryId`, `parentStepEntryId`, `order`, nullable `owner`, `folder`, `blockers`, `privateEvidence`. Source positions and ordinals distinguish identical-looking occurrences in a frozen snapshot, not permanent native identity. Parent/Step relations are captured and checked for obvious missing/foreign/range inconsistencies; native Step mutation semantics remain N1-C.

Folder evidence has `path`, nullable `locationId`, and `state` resolved/unresolved. The path must be the source note's parent folder. Resolved IDs are explicit **synthetic caller evidence**, not an N2 registry lookup; unresolved folders are retained, never substituted with root or source-note association. An unresolved context may allow UUID planning while leaving its alias unavailable for automatic use.

Identity extraction matches current Hub grammar exactly: `<!-- hub-task:([a-zA-Z0-9-]+) -->`. No case folding or whitespace expansion. Canonical lowercase UUIDs can be reused only when unique/unreserved with valid owner/structure evidence. Accepted non-UUID, uppercase and compact tokens remain exact aliases with separately allocated canonical UUIDs. Unrecognized comments remain raw evidence and are quarantined. Quoted/fenced example entries and invalid ranges remain unavailable. This narrow identity recognizer is not a full Markdown/Tasks recurrence parser.

Captured evidence records contain `version`, `fileId`, nullable `path`, nullable `fileRevision`, nullable `sourceDigest`, `line`, `end`, `ordinal`, `rawLine`, `rawBlock`, nullable `legacyId`. `sourceDigest` hashes exact source content. `rawBlock` is a line-based projection using the file's detected EOL style; mixed-EOL byte recovery must use retained file content, not assume that projection is a D06 lossless envelope. Nothing is copied into a native title/description.

## Owner registry and existing reservations

Create options require `storeId` (canonical UUID), `registryRevision`, `registry` and `idFactory`. Optional `reservations`, `clock`, `fault` and memory `storage` are explicit injected dependencies. Open requires the existing backing store/directory and allocator; it never constructs a missing ledger. Clock defaults to null planning metadata; no task creation/completion timestamp is invented.

Registry entries contain `owner`, `root`, `shared`. Owner is exactly `{type:'project'|'resource', id}`; roots are distinct, nonoverlapping physical roots. Resource IDs are study/literature/references/inspiration, not display names. Resources cannot be shared. Tests include both shared Projects (Itacan, Obsidian Hub), a private Project and all four Resources. Mount/presentation evidence is private JSON and never alters the physical owner.

External reservations supplied at creation contain `id`, `kind`, `owner`, `status` existing/deleted/retired. They represent a **captured** existing-native inventory, not automatic discovery or atomic coordination with another native store. Future host work must refresh/coordinate that inventory before real migration. N1-B makes no live cross-store guarantee.

Reservation records add `version`, nullable `planId`, nullable `entryId`; statuses also include planned/published/abandoned. All task/Step UUIDs share one global reservation set. Deleted/retired/external/planned/abandoned IDs cannot be reused. The allocator avoids every accepted canonical candidate ID, even later or ambiguous candidates, plus all existing reservations/allocations. An invalid allocator UUID fails validation; 64 colliding draws fail `ALLOCATION_CONFLICT` before commit. No source-derived UUID algorithm exists.

## Plan stages and commands

Commands require `version:1`, `decisionRevision`, `type`, stable `operationId`, `expectedRevision` and `payload`. The discriminated payloads are:

| Type | Payload | Committed effect |
|---|---|---|
| prepare | `planId`, `snapshot`, `publishOperationId` | Frozen plan, UUID reservations, private quarantine and original-result receipt; no usable aliases |
| approve | `planId`, current `snapshot`, `reviewer`, `syntheticOnly:true` | Snapshot-specific approval appended with resulting ledger revision and receipt |
| publish | `planId`, current `snapshot` | Approved plan status, alias dispositions, reservation statuses and receipt published together |
| abandon | `planId`, `reason` | Unpublished plan becomes abandoned; reservations remain unavailable and receipt preserves reason |

Read-only analysis never calls the UUID factory or publishes anything. A durable prepare result owns its UUIDs. No draft/candidate UUID is exposed before a successful prepare commit; an interrupted **uncommitted candidate** is not a published allocation and can be redrawn. Once prepare is committed, publication/review/restart/retry cannot change those UUIDs. Precommit staging is not an identity acknowledgement.

Plans contain `version`, `id`, `decisionRevision`, `capturedLedgerRevision`, `registryDigest`, original `snapshot`, `snapshotDigest`, `entries`, nullable `createdAt`, `prepareOperationId`, `publishOperationId`, immutable `digest`, `status`, `approvals`, nullable `publicationOperationId`. Status may be prepared/approved/published/abandoned. Digest covers the immutable core: version/ID/decision, captured ledger/registry/source, allocations/entries, planning timestamp and prepare/publication operation identities. Review and publication status are separate transitions and do not rewrite that core.

Each planned entry contains captured `entryId`, `kind`, `owner`, parent IDs, `order`, `evidence`, `folder`, `privateEvidence`, `reasons`, `disposition`, `identityBlocked`, nullable `nativeId`, `processing:'planned-only'`. Pure analysis has null IDs; committed plans allocate for safely identifiable occurrences. A safely planned UUID with deferred semantics is not a task import or readiness claim.

Approvals contain `operationId`, `reviewer`, `planDigest`, `sourceDigest`, `registryDigest`, `ledgerRevision`, `syntheticOnly:true`. General policy approval is never substituted for this snapshot-specific step. Source/owner changes reject with `SOURCE_CONFLICT`/`OWNER_CONFLICT`; a ledger change after review rejects publication with `REVISION_CONFLICT`, requiring an explicit appended re-review. Earlier approvals remain retained.

A different operation/plan/snapshot label cannot re-plan an already captured file lineage or path. N1-B conservatively rejects overlap, including adding more occurrences from an already planned file. Moves/edits/replacement cannot be accepted through title matching. A reviewed rebase/new-source lineage reconciliation operation is **unsupported**. Caller-supplied lineages and global-corpus completeness are preconditions; N1-B cannot discover an undisclosed move masquerading as an unrelated new file. That is one reason this API is synthetic/disposable only.

## Aliases, quarantine and occurrence accounting

Aliases carry `version`, exact `legacyId`, nullable `nativeId`, nullable `kind`, nullable `owner`, `planId`, ordered `entryIds`, `status`, `ledgerRevision`. Active aliases require one verified, unblocked planned target. Ambiguous/unavailable/retired entries carry **no target, owner or kind**. Lookup is exact/case-sensitive and can require matching owner. Missing aliases have no title/path fallback. There is no retarget operation. A newly supplied collision with an already captured/published alias rejects the entire new operation; it does not silently invalidate or retarget old published records. The caller must stop using that conflicted new proposal and seek later review.

Primary dispositions are eligible-planned, exact-alias-required, id-allocation-required, ambiguous-identity, unsupported-semantic, invalid-source-identity and unresolved-owner-context. Reasons remain distinct: ambiguous/reserved identity, invalid source/evidence, unresolved/conflicting owner/folder/context, unsupported structure, unsafe parent identity, or `DEFERRED:<decision>`. Source/revision conflicts are rejected operations retaining the old plan, not newly committed success entries.

Collision sets include all accepted matching IDs across parent/Step kinds, files and owners, including outside roots/private mounted Resource candidates. No candidate wins automatically. All colliding candidates have null native IDs. Other unresolved semantic/context records may retain a planned UUID, but their aliases remain unavailable and quarantine prevents automatic import.

Quarantine contains `version`, `id`, `planId`, `decisionRevision`, all `entryIds`, exact `reason`, nullable `legacyId`, original private `evidence`, `candidateNativeIds`, `reviews:[]`, `status:'quarantined'`, `privacy:'local-private'`. Evidence includes occurrence identity, physical owner, captured source, private evidence and all reasons. Collisions group every candidate; other reasons remain separately retained. Review resolution is not implemented: no operation erases reasons or simulates approved resolution. Future review requires an appended versioned operation, preserving old evidence.

Accounting's primary disposition counts sum to `captured` exactly once per occurrence. Additional diagnostic dimensions (`uniquelyIdentifiable`, `plannedIdentities`, `exactAliasCases`, `quarantined`) overlap intentionally and must not be summed as primary totals. `importedTasks` is always **0**. No task count can be inferred from an alias plus UUID or a prepared plan.

## Receipts, publication and recovery

Receipts contain `version`, `operationId`, canonical command `payload`, `payloadDigest`, committed `revision`, exact original `result`, `resultDigest`. Result contains operation/revision, detached plan snapshot, accounting and `replayed:false`. Every revision has exactly one receipt; plan prepare/approval/publication references must resolve to matching committed receipts. Missing/corrupt receipts fail validation rather than trigger allocation.

Canonicalization recursively sorts object keys, preserving arrays, string case, numbers versus strings, null/absence and exact source strings. SHA-256 is lowercase hex over UTF-8 canonical JSON (or exact UTF-8 source/file strings as appropriate). Identical operation ID and canonical payload returns the original result with `replayed:true` **before** stale revision checking, even if later state changed. Changed payload gives `OPERATION_CONFLICT`. A new operation ID cannot evade plan/source/alias/reservation conflicts. Publication operation IDs are reserved at prepare, so another command cannot consume them.

The private snapshot contains `format`, `versions`, `decisionRevision`, `requiredCapabilities`, `storeId`, `revision`, registry revision/entries, plans, aliases, reservations, quarantines and receipts. There are no task/Step/event/binding/Oath collections. A serialized queue builds/validates a detached candidate before committing. Concurrent retries share one receipt; competing stale plans fail. Reads return a whole prior or current committed snapshot, never a candidate's half-applied alias set.

The directory adapter writes an exclusive staging file, flushes and verifies it, publishes an immutable `identity-gen-<revision>-<uuid>.json`, then flushes/verifies a temporary pointer and atomically renames it to `CURRENT.json`. The pointer wrapper has checksummed `payload` with format, version, store UUID, revision, generation filename and exact file checksum. **Pointer rename is the commit boundary.** Plan, alias, reservation, quarantine and receipt reside in that one generation. They are not sequential independent JSON commits.

Before rename, faults leave the previous complete snapshot authoritative. After rename, lost acknowledgement is `ACKNOWLEDGEMENT_LOST`; reopen/retry finds the original receipt/IDs. A cached local snapshot may still reflect the preceding coherent state if the storage adapter lost its acknowledgement; reopen or the next operation revalidates disk before use. Do not interpret that cached snapshot as a new allocation authority.

Reopen verifies pointer/checksum/version, generation/checksum/full state, reservations, alias targets, quarantine evidence and all receipt links. Missing/corrupt pointer/generation/receipt or unsupported versions fail without reinitialization, ancestry guessing or destructive cleanup. Orphan/partial staging files are retained; unreferenced generations never become usable by filename inference. `inspectIdentityDirectory` provides private read-only inventory/state/error/lock evidence.

The existing narrow `NodeDirectory` port supplies an exclusive advisory `WRITER.lock`. A live/abandoned lock blocks open; there is no automatic expiry/removal. For tested dead child writers only, `preserveAbandonedIdentityLock` requires exact inspected bytes, explicit `confirmDeadWriter:true`, recognized lock format, same host and a PID proven dead; it renames the lock into retained `abandoned-lock-*.json` evidence. A live, foreign/unknown or changed lock fails untouched. This is disposable recovery, not an N2 production host.

Guarantees tested: serialized single-writer operations, cooperating exclusive leases, actual flushed JSON reopen, nine child-process interruptions, whole-state visibility, stable allocations/receipts and fail-closed corruption. Directory fsync is best effort through the existing port. Power-loss/filesystem/cloud guarantees, hostile external writers, distributed/multi-device transactions and portable alias transport are **not proven or claimed**. No automatic production recovery exists.

## Synthetic usage

```js
const { randomUUID } = require('node:crypto');
const { createMemoryIdentity } = require('./repository');
const { DECISION_REVISION } = require('./domain');
async function example() {
const store = await createMemoryIdentity({
  storeId: randomUUID(), registryRevision: 'synthetic-r1', idFactory: randomUUID,
  registry: [{ owner: { type: 'project', id: 'synthetic' }, root: 'Projects/Synthetic', shared: false }]
});
const snapshot = {
  version: 1, id: 'capture-demo', revision: 'capture-r1', registryRevision: 'synthetic-r1',
  parserVersion: 1, scope: 'global-synthetic',
  files: [{ id: 'source-demo', path: 'Projects/Synthetic/Tasks.md', revision: 'file-r1',
    content: '- [ ] Example <!-- hub-task:legacy-demo -->\n' }],
  occurrences: [{ entryId: 'entry-demo', kind: 'task', fileId: 'source-demo',
    line: 0, end: 1, ordinal: 0, parentEntryId: null, parentStepEntryId: null, order: 0,
    owner: { type: 'project', id: 'synthetic' },
    folder: { path: 'Projects/Synthetic', locationId: 'folder-demo', state: 'resolved' },
    blockers: [], privateEvidence: null }]
};
const prepared = await store.execute({ version: 1, decisionRevision: DECISION_REVISION,
  type: 'prepare', operationId: 'prepare-once', expectedRevision: 0,
  payload: { planId: 'synthetic-plan', snapshot, publishOperationId: 'publish-once' } });
const reviewed = await store.execute({ version: 1, decisionRevision: DECISION_REVISION,
  type: 'approve', operationId: 'approve-once', expectedRevision: prepared.revision,
  payload: { planId: 'synthetic-plan', snapshot, reviewer: 'synthetic-reviewer', syntheticOnly: true } });
await store.execute({ version: 1, decisionRevision: DECISION_REVISION,
  type: 'publish', operationId: 'publish-once', expectedRevision: reviewed.revision,
  payload: { planId: 'synthetic-plan', snapshot } });
// Reuse each original command unchanged after a lost reply. This resolves an
// identity only; no task exists and no real Oath reference is routed here.
const identity = store.resolveAlias('legacy-demo');
await store.close();
return identity;
}
```

Run explicit test files `tests/identity.test.cjs`, `tests/persistence.test.cjs` and `tests/typecheck.cjs` using the guarded launcher described in the verification report. Never recursively discover backup copies. Keep all directory tests under verified OS Temp. N1-C, date/recurrence/content migration, completion import, production Oath aliases, Git sharing and native authority remain deferred. **STOP FOR REVIEW after N1-B.**
