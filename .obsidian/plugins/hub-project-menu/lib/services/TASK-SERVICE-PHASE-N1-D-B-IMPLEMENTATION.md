# Proposed Gate B implementation handoff

**D10 remains unapproved. This document grants no implementation authorization. Gate B0 stops here.** Read the [decision sheet](TASK-SERVICE-D10-DECISIONS.md), [proposed contracts](TASK-SERVICE-D10-CONTRACTS.md) and [B0 evidence](../tests/native-recurrence-b0-evidence.md) before requesting a future implementation phase. Existing D07/D08/D09 classifiers and frozen observations must remain unchanged.

## Recommended subdivision

Do not implement the entire recurrence system in one phase. Identity, templates, completion bindings and acknowledged-receipt recovery are sufficiently coupled to need two independently reviewed inactive stages. Neither stage activates production or installs assets.

| Stage | Exact purpose | Exit gate |
|---|---|---|
| B1: approved contract and transaction foundation | After explicit D10 approval, version schema/validation for series, immutable rules/templates, node mapping, lineage, generation ledger and operation receipts in the existing transaction authority. Establish common reservations and recovery fence; support explicit synthetic fresh-native series/template creation and revision only. No automatic successor generation. | Memory/JSON validation, identity, revision, failure and rollback tests; declarations; regressions/source/build/protected-state checks. STOP FOR REVIEW. |
| B2: minimal inactive fresh-native generator | Separately authorize daily/weekly date-only advancement and atomic completion+generation using B1 records, including replay/recompletion/deletion/terminal distinctions. when-done only if its policy has been approved. | Calendar/atomicity/receipt/fault/process-crash tests and explicit exclusions; all earlier suites; no production integration. STOP FOR REVIEW. |
| Later separately scoped work | Bounds, monthly/yearly, timed/elapsed/advanced rules, pause/resume/replacement actions, legacy adoption and cross-device transport. | Further policy/evidence review; no implied authorization from B1/B2. |

B1 must not add a second coordinator or create production stores. If schema evolution/recovery fencing cannot be safely separated from generation, narrow B1 to pure validators/contracts and require a new reviewed B2 plan; do not ship a partially durable command surface. Existing store versions must reject unsupported recurrence versions without fallback/downcast. Migration remains blocked until an explicit supported upgrade path is approved.

## Required approval record

Obtain explicit choices for D10-01/02/04/05/07/10/11/12/13/14/15/16/18/19/20, plus D10-17's spent-key/deletion boundary. Record exclusions and calculation-vs-exhaustion distinctions from 06/08/09. Do not ask to reapprove owner/privacy, D07/D08/D09, Oath occurrence identity, Statistics or no-ID-reuse invariants. If user chooses a different product model, revise contracts and proposal vectors first and retain B0 observations unchanged.

Initial approved scope should be structured DAILY/WEEKLY positive integer intervals, unbounded date-only recurrence, explicit Due else Start anchor, valid local Start/Due offsets, immutable fixed-origin ordinal reference. Optionally include known-instant when-done using an explicit series IANA zone and completion-local-day reference. No current-device default, natural-language guessing, scheduled-only anchor, date-free rule, recurrence import, monthly/yearly clamp, count/until, timed recurrence, elapsed 24-hour rules, advanced RRule grammar, custom status loop, catch-up batch or implicit replacement. Unsupported fields/version/rules reject without mutation and preserve quarantine evidence.

Until count/end support is separately implemented, even recognized bounded rules stay unsupported. Never strip limits to pass initial validators. A native calculator failure rejects the dependent transaction; it does not silently turn the task into one-off work. Later count/until work needs independent validated termination proofs, initial-inclusive occurrence counts, no refunds and inclusive local-anchor end dates.

## Existing capabilities to reuse

Review current source, not just this handoff:

- `NativeTaskRepository.execute` in `ItacanTaskCore/src/repository.js`: detached drafts, canonical operation receipt replay before expected-revision rejection, conflict rejection, one storage commit and acknowledgement fault hook.
- `applyCommand` in `src/commands.js`: independent task/Step completion, current binding, reopen/un-count semantics, live/retired identity checks and N1-C lossless structure/content commands.
- `domain.js` validators and local endpoint/timestamp contracts; temporal Gate A classifiers remain compatibility evidence, not a recurrence engine.
- Memory/JSON storage adapters and existing fault/process harnesses; `json-repository.js` ancestry fallback is a known limitation to fence, not proof of surviving every acknowledged receipt.
- N1-B immutable identity plans and reservation evidence. No changes to old plans or implicit cross-store consumption.

New approved schema/commands must extend the same authority. Proposed conceptual commands are create series from explicit fresh-native input, explicitly revise future rule/template, complete occurrence atomically with permitted generation, and replay an existing operation. Names/DTOs/declarations must be reviewed during B1. Existing plain-task commands must not silently bypass recurrence invariants: either route recurrence tasks through the approved atomic handler or reject unsupported bypasses. No source parser or production Task Service dispatch changes are allowed in these inactive stages.

Deletion semantics must be enforced even if deletion UX is deferred: retain generation ledger/tombstones and retired task/Step IDs, never recreate B on retry, preserve B if A is deleted, and keep historical attribution. If cancel/pause/resume/stop/replace commands are deferred, reject them for recurrence records rather than expose an incomplete workflow. An eventual resume/advance must reuse the current completion binding and create no second event.

## Template integration and reference rules

Create an explicit versioned template at reviewed series creation; preserve N1-C bodies, nested order and node relationships. Model D requires stable template node identities separate from occurrence Step UUIDs. Each successor gets new open Steps with null completion bindings/timestamps. Default occurrence edits stay local. Explicit future template or rule revision uses a recorded boundary after the existing frontier; B never changes merely because revision 2 exists. Retire removed node identities. Keep generation-original endpoints apart from current manually edited endpoints.

Fixed schedule calculates the next canonical calendar ordinal from captured origin; a late completion may generate one past-due successor. Do not skip/catch up silently. when-done uses a known completion instant converted to the captured zone's day, then applies canonical interval and retained endpoint offsets. Date-only remains date-only across DST. Timed rules are unsupported initially; future gap/overlap cases must retain original local fields and candidate evidence rather than use JavaScript date normalization. Monthly/yearly needs an explicit original-anchor/clamp/skip choice and full leap/month vectors before inclusion.

## Transaction acceptance criteria

Implement the contracts' full logical sequence under one repository write boundary: receipt identity lookup, owner/partition/revision validation, existing generation key lookup, supported date/rule/template checks, next/exhausted determination, coordinated identities, current task/event/binding transition, successor and fresh Steps, reciprocal lineage/frontier, then one commit containing ledger and command receipt. No partially visible B, Step tree, event or key reservation.

Operation receipt and stable predecessor generation entry are distinct. Identical operation replay returns original IDs/event even after caller revisions become stale. Payload conflict rejects. A reopened/recompleted A creates a new E2/current binding with its own operation receipt, while retaining original A-to-B generation outcome and untouched B. Repeated completion when already complete must not create another event. A non-frontier historical A cannot create another branch. Deletion never unspends a key. Oath commitments to A do not move to B.

Keep generation clock, known completion instant, endpoints and receipt time evidence separate. Imported timestamps/current bindings are not solved here: N1-E must reconcile historical events and bindings before any legacy adoption. Templates, new occurrences and generation receipts are never counted Statistics input. N1-F owns native Oath adoption; preserve all existing `{id,path,text}` alias and awaitingIndex behavior meanwhile.

## Identity and recovery prerequisites

Use a common reservation authority in the same future transaction state for live/retired native identities and all allocations; validate explicit external reservation evidence. N1-B plans remain separate. Until coordinated plan adoption exists, initial tests use fresh-native synthetic fixtures, exclusive authority and immutable reservation snapshots. Concurrent or unknown plan reservations block allocation. Do not infer atomic cross-store consumption from two receipts or random UUID collision probability.

Require a recurrence write recovery fence after any verified-ancestor fallback. Test loss of an acknowledged A-to-B receipt when external B survives, then prove no B2 can be allocated before explicit reconciliation. Revalidate recovery signal across reopen/restart. A separate watermark or journal needs proof of ordered durability and cannot silently become a second transaction authority. Keep current core recovery unchanged until separately authorized changes are reviewed; production host integration is N3. Stronger OS durability claims require actual process-crash evidence.

## Required future tests

No new generator durability tests were run in B0 because there is no generator. These are acceptance requirements for approved B1/B2:

- Pure schema/version/owner/lineage/template/ordinal validation; malformed/cyclic/cross-owner nodes; disjoint UUIDs across live/retired/external reservations; unsupported rules do not mutate state.
- Memory and JSON parity on create/revise/complete/reopen/recomplete, existing B edits, deleted B and old A, non-frontier completion, identical receipt replay, payload conflict, optimistic conflicts and immutable revision capture.
- Exact initial canonical daily/weekly calendar results through winter/summer/year/DST boundaries; reference priority and early/late when-done; null time versus explicit midnight rejection/preservation; valid offsets. Later bounded tests must separately prove terminal exhaustion and invalid calculation rejection.
- Fault injection before allocation publication, event mutation, lineage creation, receipt commit, before/after storage commit and before acknowledgement. No leaked IDs, partial Step trees, double events or duplicate successors. Preserve existing non-recurrence semantics.
- JSON process-crash tests at actual durable write/rename/pointer/acknowledgement boundaries, single-writer lease behavior and interrupted reopen/replay. Test recovery-fenced ancestor fallback with lost acknowledged receipt and external B; do not call ordinary exception tests process-crash tests.
- Template revision/node retention/removal, deep lossless content, checked source Steps yielding open successor Steps, local edits versus future-template changes, rule boundary after B and no retroactive rewrite.
- Imported History/current binding and Oath cases stay explicitly blocked pending N1-E/N1-F. Test both shared Projects and all four Resource privacy boundaries; mounts preserve owner. Distributed conflict handling is N4, not proven by local single-writer tests.

Run explicit lists for Gate A, N1-C, N1-B, N1-A, N0, native core, focused legacy, 34 regression files, safe Strict/recovery and declaration checks, then new approved tests. Preserve all frozen older vectors/assertions. Build only into OS Temp, compare production factories/assets, record current staged versus installed difference, verify protected Markdown/data/History/Oath/Strict/shared state and independent workspace drift. No installation, Obsidian restart/reload, migration, real store construction or native Task Service selection.

## Deferred integrations and final gate

N1-E owns historical event/current binding import. N1-F owns Oath task/Step alias adoption. N3 owns production host persistence, activation, projections, real cancellation/resume UX and recovery reconciliation. N4 owns Git transport, owner exports and distributed conflicting successors; retain both branches/events until explicit resolution. Both Itacan and Obsidian Hub shared Projects remain eligible; all four Resources remain private. No Resource-to-Project linked-task ownership is reintroduced.

At each stage publish exact changed files/hashes, new tests versus prior regressions, frozen evidence and protected-state comparisons, known durability limits, untouched production authority/build and updated review decisions. Stop after the specifically approved stage. **STOP FOR REVIEW.**
