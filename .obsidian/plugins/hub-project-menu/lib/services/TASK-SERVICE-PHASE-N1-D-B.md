# N1-D Gate B handoff — Native Recurrence Series, Occurrence Generation and Transactional Identity

2026-10-17. **Handoff/proposal only. Gate B has not started and D10 is not approved. STOP FOR USER REVIEW.** [Gate A verification](../tests/native-temporal-recurrence-verification.md), [configured recurrence evidence](../tests/native-recurrence-evidence.md), [D10 decision proposal](../tests/native-recurrence-d10-proposal.md), [temporal API](../../../../../ItacanTaskCore/temporal/README.md), [N1-C API](../../../../../ItacanTaskCore/STEP-CONTENT.md), [N1-B API](../../../../../ItacanTaskCore/identity/README.md).

## Current state and narrower next step

Gate A implements pure private preserve-and-quarantine classification under D07/D09, preserves D08 and leaves all original native/production code unchanged. All recurring tasks remain blocked from automatic native import. A clear temporal check never authorizes overall task import. No series schema, occurrence generator, Step template or durable generation receipt was added.

The actual installed Tasks 8.4.0 bundle and installed Moment 2.29.4 were run safely under 39 explicit synthetic settings/input fixtures, three complete/reopen/recomplete transitions, two full-block Step splice fixtures and six Map-host mutation/failure scenarios. Exact hash/settings/input/output/provenance are frozen separately; this is more evidence than the older controlled callback vectors, which remain labelled as such.

**Readiness is partial.** Prefer an explicitly approved **Gate B0 evidence/specification completion stage** before an equivalence-claiming generator. Required unresolved evidence: exhausted/count/end-date rules returning `Invalid date` or changed end text, native timed/midnight/DST/reference-date behavior, supported rule subset and unsupported fallback policy, and a deliberate Step/template/reset decision. Do not infer a native engine from plain time text in Tasks descriptions, accept permissive partial parsing as intent, or silently fix installed outputs. If execution would require unsafe real settings/plugin startup/vault access, stop that part and document the gap.

## Explicit D10 approvals needed

- Stable separate series UUID; distinct native Task UUID per occurrence; completion events distinct from both.
- Predecessor/successor and rule-revision/reference model, including explicit end-of-series state.
- Unique generation key and at-most-one successor per predecessor, especially after reopen/recompletion/rule change/deletion. Actual pure Tasks re-execution supplies no durable exactly-once policy.
- Supported recurrence-rule/calendar advancement semantics and precision/zone/DST policy; fail/quarantine unresolved output without one-off/null fallback.
- Step copying versus original-only or explicit series-template model, full nested ancestry/order, fresh per-occurrence IDs, completion reset, deleted-Step handling and lineage.
- Captured generation clock versus local endpoints/reference dates/completion instants, preserving unknown historical time.
- Schema versions/backward compatibility, reservation coordination, private provenance, sharing and receipt/recovery boundaries.

The detailed alternatives/evidence/risks in the D10 proposal are proposals rather than implemented policy. Choosing a Step template/reset model is a product decision; configured Tasks only leaves existing Step lines attached by indentation to the last returned parent. Copied Hub IDs must never be reused as a new globally reserved native UUID.

## Required future architecture

Before implementation, review exact series/rule-revision/occurrence-lineage/template/generation-receipt contracts and their supported readers/writers. Prefer a single native transactional state containing all dependent records, transitions/events, reciprocal links and original-result receipt. Existing native task schema 1 and N1-C private carrier do not implicitly supply a series model. Unknown newer contracts must fail without downgrade; no old store or evidence is upgraded silently.

A future transaction validates occurrence/series/rule/source/owner/native revisions; handles exact replay/conflict; transitions current completion with the correct event relationship; derives only supported next calendar values; reserves fresh task/Step IDs; materializes approved current content/lineage; and commits all records plus receipt together. Native task/Step/event/series identities must not be conflated. Reopen/retry after commit cannot create a second successor.

N1-B plans/aliases/quarantine/reservations/receipts remain immutable. Its external reservation inventory is captured, not atomically coordinated with another store. A reviewed common reservation/transaction authority is required before claiming plan consumption; otherwise defer cross-store migration. No relabelled source/plan/reallocation bypass. N1-C original bytes/envelopes/previous content revisions stay immutable; generated current text must be explicit new canonical content linked to evidence, not replacement original captures.

N1-E remains responsible for historical completion/current-binding import and the existing double-counting hazard. N3 remains responsible for production mutation orchestration. A later approved fresh-native synthetic engine does not authorize import of old events. Completion/reopen/recomplete must preserve original snapshots/counting and null historical timestamps. Future Oath targets one occurrence/its Steps and never automatically follows a successor; current legacy commitments/awaitingIndex/fulfillment/Strict/exactly-once outcomes remain unchanged. Statistics counts actual events/occurrences, not templates or planned IDs.

## Ownership, sharing and tests

Exactly one physical Project/Resource owns every task/series. Itacan and Obsidian Hub remain separate eligible shared Projects. Knowledge/study, Research/literature, Explorations/references and Inspiration/inspiration remain private through mounts. Future public canonical lineage/rules require an allowlisted owning-Project schema; raw source, aliases/plans/quarantine/receipts/full History/Oath/device state stay local. No Git transport, offline conflict resolution or multi-device generation guarantee exists. Local receipts alone cannot prevent two offline devices creating successor branches.

Start with a fresh dirty-tree/protected-file/installed/source baseline, verify every prior archive and final Gate A source/evidence hash, narrow allowlist and verified originals. Preserve healthy current data and independently changed workspace; do not restore old snapshots. Use deterministic clocks, explicit Stockholm and other reviewed timezone fixtures, fake hosts, guarded OS Temp storage and explicit test lists. Never open a real native repository or run a real Oath/Strict/recurrence probe.

Future persistence tests must cover validation/rule/source/stale revision failures, ID collision/exhaustion, template ancestry/completion constraints, pre/post-generation publication, receipt persistence, partial writes, commit/reply loss, process restart/replay, concurrent same/different operations, changed payload, unknown versions and corrupt/missing lineage/receipt/evidence. Verify one complete old or new state and original stable IDs/receipt; no intermediate chain, orphan exposed successor, duplicate events or reused retired IDs.

Native JSON known-corruption fallback may recover an earlier committed revision and lose the last revision/receipt; do not promise latest acknowledged exactly-once recovery after arbitrary corruption. N1-B identity store is stricter fail-closed. Review this limitation before any generation safety guarantee. Power-loss/OneDrive/distributed durability and production storage host are unproven. Rollback must affect only reviewed phase files after comparing final hashes and later edits; preserve evidence, never restore a whole vault or historical task/History/Oath/workspace data.

Required prior checks: Gate A **145**, N1-C **180**, N1-B **158**, N1-A **158**, N0 **51**, core **66**, focused **452**, **34 regression files**, Strict **48**, **five** declaration checks; add focused new evidence/engine/type/fault tests only for explicitly approved scope. Do not recapture earlier observations or count historical browser tails as current. Unexpected production factory changes are a scope issue first; inherited divider/History heading-icon failures remain separate.

No production routing/writer/UI/date changes, recurrence authority, real migration, completion/History/Oath rewrite, native activation, Git transport, installed bundle replacement or Obsidian reload/restart is authorized. **Obtain explicit Gate B/B0 scope and D10 decisions; stop after that authorized gate for user review. Do not enter N1-E or live migration automatically.**
