# Phase N1 — Domain, Identity and Migration-Semantic Gap Closure

Prepared 2026-10-17 after [Phase N0](../tests/native-read-verification.md). **Proposal only. N1 has not begun. STOP FOR REVIEW.**

## Entry boundary and exact objective

N0 supplies an opt-in Task Service read/readiness protocol and tested memory-only native variants. Production remains one Legacy Adapter; no native repository, writer routing or migration exists. The native fixture demonstrates read representations, not production consumer support or historical counting equivalence.

N1 should close the **inactive domain/import semantics** prerequisites H3/H4. It must not activate storage, migrate real data, change legacy writers/UI, implement Git transport, install bundles or reload/restart Obsidian. Keep all work in the isolated native core, pure contracts/mappers and synthetic/disposable tests.

Before editing: read the N0 report and consolidated audit/field matrix, re-establish source/build/status/protected-data hashes, verify fresh originals and an exact change allowlist. Retain U3 provenance uncertainty; a stable healthy current baseline is sufficient, not impossible historical reconstruction. Workspace state remains independently app-managed. If protected test-associated writes occur, stop.

## Established architecture versus decisions still requiring approval

| Topic | Already established; preserve | Decision N1 must obtain or make explicitly reviewable |
|---|---|---|
| Task owner | Exactly one Project OR Resource, physical authority; no Resource-to-Project task association | Cross-owner legacy ambiguity and unsupported-owner quarantine resolution |
| Resource identities | Knowledge/study, Research/literature, Explorations/references, Inspiration/inspiration | Alias handling only if a real older identity requires it; never map by label |
| Shared Projects | Both Itacan and Obsidian Hub retain Git sharing; mounts don't authorize export | Which identity/content fields are portable versus private; transport remains N4 |
| Native task/Step IDs | Canonical lowercase UUIDs, globally unique and reserved after deletion | Noncanonical legacy aliases, copied-ID disposition and ledger format/version |
| ID-less tasks | Reads never persist IDs; migration must allocate once under a durable reviewed plan | Binding a source occurrence to a planned ID across approved source edits/reruns |
| Context migration | Source note's **parent folder** becomes folder context; note remains provenance, not automatic permanent note association | Missing/renamed/deleted folder resolution; actual registry is later N2 |
| Necessity | must / should / null; UI label Necessity | No new ranking/classification redesign |
| Dates | Local calendar endpoints, explicit midnight distinct from date-only; no silent UTC conversion | Legacy accepts reversed same-day times; native rejects. Preserve/grandfather/reject policy needs approval before changing rules |
| Steps | Nested parentStepId/taskId/order read model, no flattening | Native StepDraft create/edit/reparent/reorder semantics and conflict boundaries |
| Source text | Explicit description is distinct from Markdown continuations/full task block | Lossless content/provenance schema and shared searchable text policy |
| Recurrence | Existing Tasks-plugin toggle may create/rewrite occurrences; native has no engine | Implement equivalent inactive occurrence semantics or explicitly quarantine/retire unsupported recurrence with approval; storing text alone is insufficient |
| Completion History | Events, bindings, task IDs and recorded raw IDs are distinct | Import-current-binding command and counted/retained mapping; avoid duplicate native completion generation |
| Oath | Existing persisted {id,path,text} and both legitimate awaitingIndex histories remain unchanged | Versioned alias interpretation for future native commitments; no blind rewrite now |
| Persistence/versioning | Inactive explicit-directory core, receipts, immutable generations; no default live path | Versioned new schema/commands, backward compatibility and receipt/ledger replay behavior |
| Current U3 | Original writer remains unidentified; no exact old private-field snapshot exists | Do not repair it. Recheck current health/isolation and record normal application drift |

Do not silently choose a destructive default for unresolved rows. N1 may first deliver a concrete schema/decision specification for approval if these policy choices cannot be inferred safely. That is preferable to implementing contradictory migration rules.

## Recommended N1 implementation sequence

### N1-A — Versioned compatibility vectors and decision sheet

Inspect actual legacy parsers, metadata, task-progress/history semantics, Oath enrollment and native validators. Freeze synthetic examples with expected meaning, not current output substituted for originals.

Vectors must cover valid canonical/non-UUID/missing/copied IDs, parent/Step collisions across private/shared/Resource owners, nested lists/prose/CRLF/continuations, explicit description, inline Tasks syntax, date-only/midnight/reversed same-day times/DST, completed-with-unknown-time, reopened/recompleted/cleared/deleted, duplicate/falsey/raw scalar History IDs and existing Oath snapshots.

Deliver policy decisions and unsupported-record reasons. No automatic source rewrite or ID allocation in the real vault. **Review before implementing semantic rule changes.**

### N1-B — Identity, aliases, occurrence ledger and quarantine

Design a versioned migration-plan/identity ledger as inactive data, with source authority/snapshot identity, exact source evidence digest, original parent/Step identity where present, occurrence evidence, canonical planned UUID, owner and status/reason.

- Reuse an existing ID only when it is already a valid globally unique canonical native UUID and the reviewed policy permits reuse.
- Preserve valid non-UUID legacy IDs verbatim as aliases; never case-fold or replace persisted Oath IDs silently.
- Allocate ID-less task/Step UUIDs once in the plan/receipt. Source path/line/title is evidence, not a permanent native identity or deterministic UUID substitute.
- Copied IDs are not a single task merely because titles agree. Quarantine collisions with per-occurrence evidence; do not select a winner or collapse records automatically.
- A repeated plan/application with the same source snapshot must return the same IDs and outcomes. Changed source evidence must conflict or require a reviewed plan update.
- Parent/Step identities share the global collision domain; retired IDs must not be reused.
- Alias resolution must distinguish unresolved, ambiguous, unsupported and deleted. Never infer a relationship from title alone.

Private provenance/operation receipts stay private. Shared task/Step UUIDs must remain portable for both Projects. Do not export aliases containing private note paths/Resource evidence through Project mounts. This ledger is a proposed migration artifact, not a production authority manifest or activated importer.

### N1-C — Nested Step drafts and content fidelity

Extend inactive native draft/command contracts to carry explicit Step parent and sibling ordering, with stable IDs for existing Steps and clear identity rules for new Steps. Preserve ancestry through intervening non-task Markdown list items. Require parent task revision; validate missing parents, cycles, duplicate order/IDs and explicit cascade.

Specify property edit versus reparent/reorder/delete semantics. Existing read DTOs do not solve this mutation contract. No changes to production legacy Step forms/writers.

Preserve explicit description separately from full source/continuation text. Define a lossless evidence envelope or approved native content extension; include original EOL/marker/block provenance if needed for recovery. Do not place private full-note content indiscriminately in shared records. Source evidence retention is not a recurrence engine or a source-note location association.

### N1-D — Local date/time and recurrence semantics

Keep null/date-only/time/midnight and completion-instant distinctions. Reproduce the same-day discrepancy with both current validators before any rule change. An unsupported row must retain its original evidence and reason; no trimming times or substituting a "valid" due date.

Choose the approved approach to recurrence. If domain support is added, model occurrence identity and completion/reopen/next-occurrence lineage using explicit inactive commands/tests, including interaction with existing completed/check/history evidence. If deferred, identify/quarantine such records explicitly; do not claim lossless migration readiness. Do not call the real Tasks plugin or create real occurrences.

### N1-E — Current completion binding and historical-only import

The current core creates a fresh completion event when creating a completed task/Step. Its historical-only command cannot attach that event to a live target. N1 needs a reviewed atomic import/seed contract that can preserve an existing event/binding relationship without creating a second counted completion.

Specify:

- Current task/Step completion + event + binding + operation receipt committed together in disposable core tests.
- Original legacy event ID/raw supported scalars, occurrence/order, absent/null distinction, owner/snapshot/timestamp retained as evidence.
- Unknown timestamps stay null; migration time is not original task creation/completion time.
- Reopened/retained events remain retained with explicit counted state; recompletion has distinct occurrence identity.
- Historical-only events without reliable live relationships retain null task/Step IDs and explicit legacy evidence.
- Clear/deletion retains History and reserved identities; current binding existence is not inferred from a completed tombstone.
- A repeated import operation cannot allocate new events or re-count old events.
- Native counted flags and legacy Statistics dedup/count semantics require a complete mapping specification. No numerical parity claim from event shape alone.
- Same-title records or current task owner do not repair old historical attribution.

Any new command/schema must reject an invalid batch before publication and retain durable retry/conflict guarantees in inactive tests. Do not read/write the live task History store.

### N1-F — Oath alias, owner/privacy and version compatibility fixtures

Resolve synthetic existing legacy commitment references only through the explicit ledger. Preserve original snapshots; completed native parents can resolve, deleted/missing/wrong-owner/ambiguous remain explicit. No automatic live commitment rewrite or enrollment.

Preserve both legacy awaitingIndex histories; do not restore the rejected fresh-allocation-only provenance restriction. Native records do not wait for Dataview.

Verify two shared Projects plus private Project/four Resource partitions, event original owner versus current owner/working context, mounted Resource visibility without ownership transfer, sanitized export exclusions and explicit Phase owner invariants. Git import/transport stays later work.

Define schema readers/writers for new records, migrations of **disposable old native fixtures only**, unsupported newer schema behavior and canonical command receipt payload compatibility. Never open a real native store.

## Exact scope and affected modules

Expected candidates: \`ItacanTaskCore/src/contracts.d.ts\`, \`domain.js\`, \`commands.js\`, \`serialization.js\`, inactive repository validation only where a new atomic import command requires it; native tests/type fixtures; new pure migration-plan/alias/semantic fixtures; minimal Task Service declarations that reflect approved new domain semantics.

Do not edit production \`plugin.js\`, legacy task/Oath/History writers, dashboard/UI consumers, shared transport, startup/backend host or settings. A schema decision needing one of those paths is a later integration dependency, not authority to expand N1.

N0's \`NativeReadTask\`, \`NativeReadEvent\`, explicit unsupported current-bindings/legacy-statistics requests, navigation result and readiness states remain valid boundaries. Update their fixtures only to reflect reviewed domain capabilities; do not remove negative tests merely to advertise support.

## Verification gates

1. Versioned vectors capture every approved semantic decision and every unsupported/quarantined case.
2. Memory and JSON adapters run equivalent command/receipt/recovery invariants against disposable OS Temp stores only.
3. Idempotent identity/event mapping across rerun/restart and lost acknowledgement; conflicting reused operation IDs fail.
4. Global parent/Step/copy/retired ID tests; nested Step edits/cascade/order and no flattening.
5. Original explicit metadata, source evidence, recurrence policy, null/midnight/DST and reversed-time behavior verified without silent coercion.
6. Current completion import, reopened/recompleted/cleared/deleted/historical-only events avoid duplicates and preserve recorded attribution.
7. Existing Oath references resolve only with explicit aliases; both legacy enrollment bridges unchanged; no real Standard/Strict host.
8. Private/shared exports preserve both Projects and exclude Resource mounts/private provenance/receipts.
9. All existing core/N0 declarations and tests remain; relevant 452 legacy-focused/34 regression/48 safe Strict checks retained if contracts/build are affected. Target browser work only if actual runtime boundaries change.
10. Exact source/build/allowlist/protected-data comparison, verified fresh originals and reproducible evidence. No installed artifact copy, automatic reload or real native store.

## Failure, rollback and completion

Before implementation: stop for unresolved destructive policy choices. Before commit/publication in a disposable import: failure leaves records/history/bindings/receipt/revisions unchanged. After committed acknowledgement loss: replay the same intent; do not issue new UUIDs/timestamps. Keep rejected/unsupported record evidence, never drop it to make counts agree.

Rollback only N1's exact changed code from fresh verified originals after checking concurrent edits. No real data rollback should exist because N1 stays inactive. Never restore old entire trees, plugin data or workspace state.

N1 exit requires reviewed decisions, versioned domain/import/alias contracts and tests, explicit remaining unsupported records, private/shared boundary evidence and a precise later N2 host handoff. It does **not** require or authorize live migration, production storage, writer orchestration, consumer switching, Git synchronization or task-location UI.

**STOP FOR REVIEW after N1. Do not begin N1 from the N0 execution.**

