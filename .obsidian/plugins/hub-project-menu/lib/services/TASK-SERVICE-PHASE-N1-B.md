# N1-B handoff — inactive identity foundation only

2026-10-17, proposed handoff revision 1. **Not authorization to implement.** N1-A ends with review. Use the [N1-A decisions](TASK-SERVICE-N1-DECISIONS.md), [specification](../tests/native-migration-compatibility-spec.md), [frozen format-1 vectors](../tests/native-migration-compatibility-v1.json), [verification report](../tests/native-migration-compatibility-verification.md) and existing [N0/N1 handoff](TASK-SERVICE-PHASE-N1.md).

## Entry gate and exact scope

Obtain explicit authorization for N1-B and approval of D01 exact aliases, D02 allocate-once plans, D03 quarantine-first copied identities, D17 versioned retry/recovery and D18 explicit dispositions. Established one-owner/folder-context/privacy/date/Statistics/Oath rules are constraints, not new product choices. If any approval differs from these recommendations, record the decision revision and revise this handoff before implementation. A user approving the document's existence has not approved migration.

The recommended limited scope is a backend-neutral, inactive identity/plan/alias/reservation/quarantine foundation, using synthetic records and disposable storage. No production construction, plugin startup, host, service routing, real migration, writer changes, persistent live native storage, installation or reload. N1-B must not implement Step mutation APIs, source-content import, recurrence, date validation changes, completion/event/binding import, Oath commitment rewriting/resolution routing, or portable Git alias transport.

N0's staged/installed distinction must remain intact. Re-establish the current baseline rather than restoring an old audit snapshot. Preserve all N0 source and existing dirty work. The prior U3 observation remains unexplained historical evidence; do not claim that an earlier private data snapshot is recoverable. Read-only current health and exact current hashes are the safety basis.

## Proposed contracts, without choosing code now

Specify separate independently versioned contracts for identity ledger, migration plan, source evidence/quarantine and operation receipt. Format numbers, minimum reader/writer versions and decision revisions must be explicit. Native schema version 1 is not automatically their version. Unsupported newer versions produce explicit no-write results. Never discard unknown fields then serialize an older version.

Conceptual entries should cover:

| Record | Required evidence / invariants |
|---|---|
| Plan header | Plan ID/version, decision revision, parser/source fingerprints, fixture revision, captured store/ledger revision, status and review authorization |
| Occurrence entry | Stable plan-entry ID, original exact legacy ID if accepted, parent/Step kind and captured ancestry/order, source block/range/ordinal/checksum, physical owner, folder-context evidence, allocated canonical UUID, disposition and reason |
| Alias | Exact case-sensitive source ID, native UUID, kind, verified owner, evidence/plan revision and active/ambiguous/retired state; no automatic case folding |
| Reservation | Global parent/Step UUID, live/retired/abandoned disposition and allocation operation; no reassignment |
| Quarantine | All raw candidates, original source/error, owner/privacy, source/plan/decision versions, reason and append-only review/resolution history |
| Receipt | Stable operation ID, canonical payload/evidence digest, committed revision/result, retry identity and recovery relationship |

These are proposed requirements, not newly added native fields. Choose a concrete interface/storage boundary in the authorized N1-B plan. Do not promise transactional durability until the adapter's commit/recovery semantics are executable and tested.

Canonical unique legacy UUIDs may be retained as native IDs if globally safe, with explicit exact-alias/provenance evidence. Valid noncanonical legacy tokens require a canonical allocation and exact alias. An unrecognized hidden-comment spelling is raw source evidence, not a valid legacy ID by assumption. A UUID-like token must not be lowercased or reformatted to create identity. Event IDs are a different namespace of raw evidence; never treat them as task IDs.

## Identity and collision rules

Scan task and Step occurrences globally, including outside selected owner roots and private/shared contexts. A mounted Resource remains Resource-owned. A private copy that collides with a shared task is relevant to ambiguity without becoming shared evidence. Detect parent-parent, parent-Step, Step-Step, live-retired and intra/inter-owner collisions before publishing aliases or allocations as usable.

Do not choose first/latest/local-owner candidates. Preserve all candidates and mark ambiguous; explicit per-occurrence review can later allocate new identities with recorded authority. Retired native task/Step IDs remain reserved. Full Step tombstone content is not currently guaranteed by the native core; retain original private evidence and do not claim automatic undo.

ID-less tasks require frozen occurrence entries before allocation is acknowledged. Identical titles/blocks are still distinct occurrences in one snapshot, distinguished by captured occurrence evidence rather than permanent path-derived IDs. Source moves, changed blocks or ambiguous locator recovery require explicit conflict/review. If a stable alias proves movement, retain the identity while recording new evidence; do not infer such an alias from title alone.

An alias must not silently change owner or target on a later scan. Native relocation and recorded historical owner are separate concepts; N1-B does not implement relocation. Keep an explicit unavailable/foreign-owner result for future readers rather than remapping an Oath.

## Plan, commit and recovery sequence

1. Read and verify formats, current source/ledger revisions and required approvals. Collect a read-only synthetic source snapshot with exact owner/privacy.
2. Analyze global collisions, accepted/missing IDs and reserved identities. Produce explicit per-entry dispositions and pending evidence gaps.
3. Persist a reviewed allocation plan once, with canonical UUIDs, stable operation IDs and source fingerprints. Publishing that plan must not imply importing a task or initializing production storage.
4. Validate all candidate alias/reservation/quarantine invariants. Resolve no lossy policy implicitly.
5. Commit through one atomic boundary, or demonstrate a versioned staged protocol whose recovery cannot expose half-published aliases. Define which state is authoritative after every interrupted step before implementing persistence.
6. On retry, read the same plan and receipt. Same operation/payload returns the original result; changed payload/source/owner/revision produces a typed conflict. Do not regenerate UUIDs or receipt IDs.
7. On restart, either prove committed publication or recover the existing staged plan explicitly. Missing/corrupt receipts, unknown versions or contradictory reservations stop with retained evidence. Never repair by creating another task or alias.
8. Reconcile counts of captured occurrences versus all dispositions; nothing may vanish. Quarantined/unsupported records are not migrated successes. Reprocessing creates a linked review/plan revision and preserves prior evidence.

Current native command receipts demonstrate identical-payload replay, changed-input rejection, precommit failure and lost acknowledgement in memory. They do **not** establish future migration-plan atomicity. N1-B must test its own boundary; it must not repurpose `task.create(completed:true)` as identity allocation or import History.

## Owner, context and privacy gates

Owner is exactly Project OR Resource; no `linkedProjectId`. Resource IDs remain study/literature/references/inspiration. Both Itacan and Obsidian Hub remain Git-shared, private Projects and all Resources remain private, and mounted visibility never expands sharing. The source note's parent folder is context; the source note is provenance unless explicitly associated. Missing folder identities are recorded unresolved, not guessed.

Keep the initial ledger, plans, raw blocks/paths, checksums, receipts and quarantine local/private. Full History, Oath, Strict/device state, mount configuration and full native repository generations are excluded from Project export. A portable alias packet is a separate N1-F design requiring an explicit public-field allowlist, owner partition validation, cross-device conflict/recovery rules and review. N1-B may define that boundary but must not export it.

## Required N1-B tests

Re-use N1-A format-1 observations unchanged. Add implementation tests tagged by approved decision ID; no proposal becomes an expected old observation. At minimum verify:

- Canonical/non-UUID/uppercase/unrecognized/missing IDs; identical-title independent occurrences; parent/Step identity allocation and preserved original aliases.
- Global parent-parent, parent-Step and repeated-Step collisions across both shared Projects, private Projects, all Resources and outside roots; no private candidate leakage.
- Retired IDs, repeated scans, stable allocation across reopen, no alias retarget/reuse, and explicit unresolved owner/context.
- Identical retry before/after restart; changed input/owner/source checksum/revision; concurrent same-operation retry and conflicting operation; one result/reservation and no task/History effects.
- Interrupted plan creation, allocation publication, alias/reservation/quarantine publication and acknowledgement. Assert state, receipts, notifications and exposure at every boundary.
- Corrupt/truncated plans, missing receipt, duplicate IDs, unsupported newer ledger/plan/quarantine/fixture versions; no partial write or silent downgrade.
- Every occurrence accounted for, raw evidence/types/order/absence preserved, quarantine reason and append-only resolution retained; reprocessing cannot silently clear an old disposition.
- Privacy/export negative tests for each eligible Project and all private owners, mounts, absolute/local paths, raw provenance, Oath/History and whole generations.
- Test-only construction is absent from production bundles/startup; generic readiness cannot claim migrated/import-ready or durable capability without the corresponding tested implementation.

Keep completion import, recurrence execution, native Step edits and Oath routing explicitly unsupported. Future N1-C/D/E/F tests must cover the deferred decisions; do not mark those gaps closed because identity tests pass.

## Verification, rollback and STOP

Before N1-B edits: read current AGENTS, preserve fresh originals/hashes for exact authorized files, snapshot protected data/installed bundles/shared state/all Markdown, record dirty Git state and validate current data read-only. Test writes must stay within verified OS Temp; no live plugin startup, real Oath/Strict, native production directory, unscoped test discovery or app reload. Run explicit relevant N0/legacy/core/type checks and preserve their evidence. Browser regressions are required only if consumer behavior changes; inherited browser failures remain distinct.

Rollback is limited to authorized N1-B files after verifying their current hashes still equal N1-B outputs. Never restore the repository, old `data.json`, old History/Oath or an independently changed workspace. An app workspace change must be recorded, not overwritten. Do not mix archive tests into discovery.

Stop on unproven isolation, test-caused protected changes, irreconcilable baseline, unknown format or corrupt recovery state, unsatisfied semantic approval, identity ambiguity without retained evidence, silent loss/merge/coercion, inability to prove a single allocation on retry, or a requirement to alter production domain/authority beyond scope. Document the issue and preserve the partial evidence.

N1-B completion report must show exact changed files/backups, approvals/decision revision, schema/format/readiness boundary, vector outcomes, fault/retry tests, protected hashes, source/staged/installed status, remaining deferred decisions and next review gate. No automatic activation, installation, migration or N1-C continuation.

**STOP FOR REVIEW. N1-A has not started N1-B.**
