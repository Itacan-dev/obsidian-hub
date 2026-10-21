# N1-A semantic decisions — revision 1, 2026-10-17

**Review sheet, not implementation authorization.** [Specification](../tests/native-migration-compatibility-spec.md), [147 vectors](../tests/native-migration-compatibility-v1.json), [verification](../tests/native-migration-compatibility-verification.md), [N1-B handoff](TASK-SERVICE-PHASE-N1-B.md).

“Established—Preserve” means existing requirements need no new semantic approval. “Recommended—Awaiting approval” means a future policy is proposed. “Unresolved—Additional evidence required” means neither a passing boundary test nor a recommendation establishes compatibility. Referencing an established ID in a vector does not reopen that decision.

| ID | Practical issue | Status | Recommendation / approval gate | Earliest phase |
|---|---|---|---|---|
| D01 | Legacy IDs are not all native UUIDs | Recommended—Awaiting approval | Exact aliases + canonical UUIDs; no source rewrite | N1-B |
| D02 | ID-less occurrences need repeatable identities | Recommended—Awaiting approval | Allocate once in a frozen evidence plan | N1-B |
| D03 | Copied parent/Step IDs are ambiguous | Recommended—Awaiting approval | Quarantine all ambiguous candidates; no automatic winner | N1-B |
| D04 | Owner, folder context and note evidence differ | Established—Preserve | One physical owner; parent-folder context; note provenance | N1-B/C |
| D05 | Step hierarchy and deletion contract gaps | Recommended—Awaiting approval | Explicit ancestry/order; reject unsafe deletion; explicit cascade | N1-C |
| D06 | Native title/description omit source meaning | Recommended—Awaiting approval | Private lossless source envelope plus explicit description | N1-C |
| D07 | Same-day reversed clocks pass legacy validation | Recommended—Awaiting approval | Quarantine unchanged initially; review compatibility alternative | N1-D |
| D08 | Dates, nulls and Necessity have existing meanings | Established—Preserve | Preserve precision/local calendar/unknown time; must/should/null | N1-C/D |
| D09 | Native recurrence execution is absent | Recommended—Awaiting approval | Retain intent/source; quarantine affected tasks until supported | N1-D |
| D10 | Exact occurrence identity behavior is unproven | Unresolved—Additional evidence required | Separate series/occurrence/event; obtain safe Tasks evidence | N1-D |
| D11 | Completed create plus old event can double count | Recommended—Awaiting approval | Future atomic state/event/binding import for proven links | N1-E |
| D12 | Unlinked History must survive without invented links | Recommended—Awaiting approval | Versioned hybrid; historical-only raw evidence when uncertain | N1-E |
| D13 | Retained native events differ from legacy counted input | Recommended—Awaiting approval | Explicit count mapping; preserve raw legacy order/duplicates | N1-E |
| D14 | Statistics has exact historical semantics | Established—Preserve | Truthy-ID dedup before time filter; five ranges; All time UI default | N1-E |
| D15 | Existing Oaths use legacy IDs | Recommended—Awaiting approval | Exact unique alias resolution without commitment rewriting | N1-F |
| D16 | Both shared Projects and private Resources must persist | Established—Preserve | Owner-based export; private provenance; conditional alias transport | N1-B/F |
| D17 | Retries/source changes/version drift can create new work | Recommended—Awaiting approval | Versioned immutable plans, receipts and conflict stops | N1-B |
| D18 | Unsupported/invalid/ambiguous records need review outcomes | Recommended—Awaiting approval | Explicit lossless quarantine/dispositions and versioned review | N1-B |

For **limited inactive N1-B**, the approval set is D01, D02, D03, D17 and D18, with D04/D08/D14/D16 preserved as constraints. D05–D07, D09–D13 and D15 may be deferred only because N1-B will not import those domains or route live tasks. D10 requires evidence before recurrence implementation. Portable alias export is separately deferred under D16. Approving an identity plan never approves a data migration or native activation.

## D01 — Exact legacy aliases

**Problem/current behavior:** alphanumeric/hyphen Hub IDs include non-UUID and uppercase values; native UUIDs must be canonical lowercase. `ID-*` freezes accepted comments, unrecognized forms and native rejection. Unrecognized comments are source evidence, not valid aliases by assumption.

**Alternatives:** A, canonical UUID plus exact durable alias; B, require canonical source IDs and quarantine the rest; C, rewrite/normalize source identities. **Recommend A**, retaining an already canonical unique ID where safe, with an exact alias entry recording provenance; reserve both namespaces explicitly. This avoids breaking recorded commitments and ID-keyed metadata. B blocks legitimate old tasks; C risks unapproved identity loss.

**Existing-data effect/risk/reversibility:** future native UUIDs may differ, old IDs/comments remain exact and real data stays untouched during N1-B. A ledger can conflict or leak if poorly scoped; owner/classification/version checks are mandatory. Allocations can be retired, not reassigned; removing an unconsumed draft plan is reversible, published aliases require tombstone/history.

**Oath/History/Statistics:** Oath needs old-ID resolution; raw event IDs are separate and never canonicalized to task UUIDs; counts must not change. **Both shared Projects/privacy:** identical policy for Itacan and Obsidian Hub; begin private/local; no source paths in future portable alias packets. **Phase/vectors/approval:** N1-B; `ID-*`, `OATH-unique`, `PRIVATE-*`; approve A before ledger implementation. Deferral blocks meaningful N1-B alias work.

## D02 — ID-less occurrence allocation

**Problem/current behavior:** legacy read handles may lack an ID; locators are unstable and same-title fallback can be ambiguous. Native create allocates when omitted, which is unsafe if rerun as a fresh command. `LOC-*`, `STEP-missing-id` and `RETRY-replay` expose the boundaries.

**Alternatives:** A, freeze occurrence evidence and allocate once in a durable reviewed plan; B, require source ID insertion before migration; C, derive permanent IDs from path/title/line; D, allocate anew each scan. **Recommend A**. B requires source changes; C changes identity on moves and can merge duplicates; D duplicates tasks.

**Effect/risk/reversibility:** source remains untouched; distinct captured occurrences receive distinct UUIDs even with identical titles. Changed source blocks stop for review rather than allocate replacements. Full snapshot/ordinal/hash evidence is needed; a checksum is not a permanent identity. Abandoned allocations become retired reservations where already durable.

**Oath/History/Statistics:** do not create retroactive commitments or link raw History by title; allocation alone creates no completion/count. **Both shared Projects/privacy:** same allocation process, separate owner partition and private evidence for each Project and Resource. **Phase/vectors/approval:** N1-B; `ID-missing`, `LOC-idless-*`, `STEP-missing-id`, `TEXT-extra-same-title-block-*`; approve frozen-plan allocation. Deferral blocks ID-less planning.

## D03 — Copies and retired identities

**Problem/current behavior:** copied IDs can occur within/across notes, owners, Resources or parent/Step kinds. Current global index guards and native reservation differ. Deleted tasks retain records; deleted Steps retain reserved IDs and events but no complete Step tombstone.

**Alternatives:** A, quarantine ambiguous sets with all candidate evidence; B, select first/newest/local-owner winner; C, automatically re-ID copies; D, explicit per-occurrence user resolution with documented old-ID disposition. **Recommend A initially, D for later resolution**. B/C can change the original identity or redirect an Oath silently.

**Effect/risk/reversibility:** no candidate silently migrates or disappears. Review may delay imports; preserve every original candidate and retired ID so a later decision is explainable. Resolution is append-only; never free a consumed/reserved ID for unrelated work.

**Oath/History/Statistics:** ambiguous aliases resolve unavailable, never completed; historical snapshots remain independent, counts unchanged. **Both shared Projects/privacy:** scan globally, including private/outside notes; do not expose private candidate blocks to either shared Project. **Phase/vectors/approval:** N1-B; `COPY-*`, `OATH-copy-*`, `STEP-cascade-*`, `RETRY-deleted-id`; approve quarantine-first and explicit resolution. Deferral blocks collision handling.

## D04 — Owner and folder context

**Problem/current behavior:** page presentation, Resource mounts, source note and physical owner are different. Native validators reject foreign locations and Resource Phase ownership. Legacy normalized location is currently null.

**Alternatives:** preserve physical owner + source parent-folder context; infer owner from page Project/mount; auto-associate the source note. **Preserve the first**, as already required. No `linkedProjectId`; note provenance becomes note association only by explicit intent.

**Effect/risk/reversibility:** no ownership reassignment or export expansion. A missing folder resolver is an explicit gap, not root fallback. Context mapping can be revised with evidence while preserving task identity/owner.

**Oath/History/Statistics:** committed owner stays authoritative; historical owner/context never follows a current move; cohorts stay historical. **Both shared Projects/privacy:** mounted private Resources remain private in both. Resource IDs stay study/literature/references/inspiration. **Phase/vectors/approval:** N1-B/C; `OWNER-*`, `CTX-*`, `PRIVATE-*`; **no new semantic approval**, implementation still requires a separately authorized phase. No decision to defer.

## D05 — Step edits and structural deletion

**Problem/current behavior:** legacy parser/normalizer handles nested Steps; facade draft edits lack parent/order fields. Native core already supports explicit ancestry, reorder and reparent with parent revision checks. Both paths protect subtree deletion.

**Alternatives:** explicit ancestry/order drafts with guarded changes; flatten Steps; silently reparent survivors; cascade by default; reject deletion unless cascade requested; add full deleted-Step tombstones. **Recommend explicit ancestry/order and reject unsafe deletion by default, with explicit cascade**, retaining events/reservations and source evidence. Full Step tombstones need a separate reviewed storage design; current core has none.

**Effect/risk/reversibility:** future edits retain hierarchy; no silent flattening/removal. Cascade can destroy current content, so retained raw evidence and an explicit preview are needed; raw evidence is not automatic undo. Stale revision must fail before publication.

**Oath/History/Statistics:** Step completion remains independent; Oath parent progress semantics stay unchanged; old Step event/parent-title snapshots survive deletion and must not double count. **Both shared Projects/privacy:** same structure in both Projects; private provenance not exported. **Phase/vectors/approval:** N1-C; `STEP-*`; approve draft/deletion design before implementation. Safely deferred outside N1-B identity reservations.

## D06 — Full content and Search

**Problem/current behavior:** native title/description do not cover continuation, status marker, EOL, unknown syntax or block references. Snapshot block normalizes EOL. Explicit description is separate metadata.

**Alternatives:** private versioned raw-source envelope alongside canonical fields; normalized block alone; concatenate everything into description; retain only current note dependency. **Recommend the envelope**, optionally retaining normalized/search projections too. The other choices lose bytes/meaning or permanent source independence.

**Effect/risk/reversibility:** original block and checksum survive; existing descriptions remain explicit. Storage/privacy costs increase. Rendering and Search must avoid resurrecting historical content as live tasks. An envelope supports review/reparse; it does not guarantee lossless native editing without further tests.

**Oath/History/Statistics:** title snapshots stay original; current Search title changes never rewrite commitments/history; counts unaffected. **Both shared Projects/privacy:** share canonical allowed content, keep generic raw provenance local for both; do not export Resource source blocks. **Phase/vectors/approval:** N1-C; `TEXT-*`, `OATH-between-notes`; approve envelope/schema and future Search semantics. Can defer while N1-B stores only minimum private identity evidence.

## D07 — Reversed clocks on one date

**Problem/current behavior:** actual legacy validator accepts Start 18:00 / Due 09:00 on one date; native rejects. This is established evidence, not permission to alter either validator.

**Alternatives:** A, grandfather native validation globally; B, reject/quarantine unchanged for review; C, approved swap/drop/day-roll normalization; D, imported compatibility representation distinct from stricter new tasks. **Recommend B for initial migration gating**, considering D only after concrete query/edit/sort design. A broadens new-task semantics; C invents intent; D needs explicit compatibility rules.

**Effect/risk/reversibility:** existing legacy Schedule and editing remain as they are; affected records are not coerced. Quarantine delays native availability. D may later preserve ranges unchanged, but must define rendering/sorting/editing and future validator upgrades. No proposed normalization is applied.

**Oath/History/Statistics:** do not lose committed targets or invent completion timestamps; counts/cohorts unaffected. **Both shared Projects/privacy:** same gate for both Projects, private reason/evidence local. **Phase/vectors/approval:** N1-D; `DATE-same-day-reversed`, `DATE-group-order`; approve gating/compatibility policy before date import. Safe to defer for N1-B.

## D08 — Calendar precision and Necessity

**Problem/current behavior:** date-only differs from midnight; endpoints are local wall-clock values; completion timestamps are instants; unknown can be null. DST can produce 23/25-hour calendar bins. Legacy metadata may omit optional fields. Necessity maps must/should/null.

**Alternatives:** preserve these distinctions; normalize absent values to times/UTC; fill unknown completion time with import time; rename user-facing Necessity. **Preserve existing semantics**. Retain raw absent/null input independently even where a read projection defaults fields.

**Effect/risk/reversibility:** no date/time fabrication; local gap/overlap instant resolution remains a later evidence obligation. Once timestamps are invented, original uncertainty cannot be recovered, so never do so.

**Oath/History/Statistics:** no future filtering changes for committed work; unknown History remains unknown; calendar ranges remain local. **Both shared Projects/privacy:** same endpoint meaning and Necessity label in both, no timezone-derived owner changes. **Phase/vectors/approval:** N1-C/D/E; `DATE-*`, `HIST-raw-null-absent-time`; **no new semantic approval**. Later implementation must prove parity.

## D09 — Recurrence rollout policy

**Problem/current behavior:** Itacan delegates a line toggle to installed Tasks; that implementation has recurrence/status/order/delete branches. Native has no recurrence engine. Controlled callback tests do not execute configured Tasks behavior.

**Alternatives:** A, build a verified equivalent native engine; B, preserve intent and quarantine until supported; C, per-series manual migration review; D, reviewed exclusive legacy recurrence authority during transition. **Recommend B now, A plus C later**. D has substantial routing/recovery/double-authority risks and requires separate authorization.

**Effect/risk/reversibility:** old recurrence continues under existing authority; no task becomes a plain one-shot task silently. A future migration may be delayed, with source/rule retained for reprocessing. A stored rule alone cannot recreate dates or identities.

**Oath/History/Statistics:** no generated completions/occurrences from an unsupported rule; existing commitments/events stay unchanged. **Both shared Projects/privacy:** same quarantine gate for both; do not export private rule provenance or mounted Resource tasks. **Phase/vectors/approval:** N1-D; `RECUR-*`; approve quarantine rollout before recurrence import. Can defer; N1-B must mark unsupported.

## D10 — Series and occurrence semantics

**Problem/current behavior:** Tasks source resets its own ID/blockLink/dependencies for a next occurrence, but that is not proof of hidden Hub-ID allocation, Step reassociation or configured serialization/date results. Exact live-config parity remains unverified.

**Alternatives:** series ID equals task ID; separate stable series/occurrence/event IDs; infer linkage from text/date; postpone recurrence import. **Recommend separate identities and postpone implementation until safe runtime evidence**. A recurring completion event is not a series identity; title/date inference can merge unrelated work.

**Effect/risk/reversibility:** preserve rule/reference/source evidence without generating new work. Need safe synthetic third-party harness/settings matrix and explicit lineage evidence for complete/reopen/recomplete/delete/next occurrence. A lineage guess is hard to reverse once used by Oath or counters.

**Oath/History/Statistics:** commitments identify occurrences, completion events identify attempts; no silent substitution by the next task; counts require occurrence/event mapping. **Both shared Projects/privacy:** future portable lineage only within eligible owning Project; private evidence remains local in both. **Phase/vectors/approval:** N1-D; `RECUR-unverified-*`, `RECUR-transport-*`; **unresolved, evidence and policy approval required**. Safely deferred outside recurrence migration.

## D11 — Current completion binding import

**Problem/current behavior:** completed native create emits a fresh event/binding; `history.record` only appends historical-only evidence. Their combination reproduces two counted events. Legacy source/history can also partially succeed.

**Alternatives:** A, atomic current task/event/binding import; B, append History then reconstruct binding separately; C, quarantine uncertain links; D, versioned hybrid of A and historical-only retention. **Recommend D: A only for confidently evidenced links, C otherwise**. B exposes partial/double counting unless a new atomic boundary exists.

**Effect/risk/reversibility:** no synthetic recompletion to import current state; unknown time stays null. One original current event must bind once. Requires reviewed command/schema, raw-event identity, operation receipt and fault/retry proof; undo must not erase historical evidence.

**Oath/History/Statistics:** completed Oath targets stay completed without duplicate fulfillment; reopen uses the original mapped current event; all ranges retain original totals. **Both shared Projects/privacy:** shared completion references may be portable; full events/receipts/source private in both Projects. **Phase/vectors/approval:** N1-E; `HIST-import-double-count-risk`, `HIST-progress-*`, `HIST-source-commits-history-fails`, `RETRY-*`; approve atomic import policy before implementing it. Safe to defer for identity-only N1-B.

## D12 — Historical-only evidence

**Problem/current behavior:** raw History includes deleted/missing tasks/owners, noncanonical IDs, unknown timestamps and presentation attribution. Recorded reads do not reconstruct current ownership. Native historical-only records can retain JSON evidence but do not bind a live task.

**Alternatives:** infer links by title/path/current owner; drop malformed/unlinked records; retain all raw evidence independently; hybrid confident links plus unlinked evidence. **Recommend the hybrid**, with no guessed link and no destructive deduplication.

**Effect/risk/reversibility:** ordered originals and raw scalar ID types survive, including absent/null/empty values. More evidence may remain unlinked; later linkage requires an appended evidence-based decision, not rewritten originals. Private retention/version format still needs review.

**Oath/History/Statistics:** historical snapshots stay snapshots; no fabricated commitments; Statistics uses a reviewed raw-event projection, not arbitrary native envelope fields. **Both shared Projects/privacy:** historical private context never flows into either Project packet. **Phase/vectors/approval:** N1-E; `HIST-raw-*`, `HIST-empty-ids-archive`, `HIST-clear-recorded`; approve retention/import format. Deferrable for N1-B.

## D13 — Counted versus retained events

**Problem/current behavior:** legacy reopen removes the current-linked recorded event; native reopen retains an uncounted event. Deletion/clear retain snapshots. Array similarity does not establish consumer parity.

**Alternatives:** feed all retained native History into Statistics; feed counted native events only; explicit versioned legacy-compatible projection plus separate native audit evidence. **Recommend the explicit projection**, tested against original consumer inputs. Counted-only is necessary for ordinary native reopen but insufficient for raw legacy dedup/order/unknown-time semantics.

**Effect/risk/reversibility:** preserve originals and audit retention without changing historical totals. Count mapping needs versioned provenance and confidence. Recomputing from a reviewed mapping can be reversible; losing original order/duplicate evidence cannot.

**Oath/History/Statistics:** event retention never implies fulfilled work; reopening/recompletion and Step/parent counts remain distinct; old owner snapshots persist. **Both shared Projects/privacy:** counting remains local, portable references do not export full private audit history in either Project. **Phase/vectors/approval:** N1-E; `HIST-progress-check-reopen-recheck`, `HIST-raw-duplicate-*`, `HIST-import-double-count-risk`; approve mapping before History/Statistics import. Defer for N1-B.

## D14 — Statistics contract

**Problem/current behavior:** truthy raw IDs are deduplicated before timestamp validity/future filtering. Falsey/absent IDs repeat; numeric/string IDs differ. Five ranges, local bins and stable historical owner cohorts are observable behavior. All time is the UI default; aggregate helper's default is separate.

**Alternatives:** preserve exact behavior; deduplicate after validation; canonicalize IDs; regroup under current owner/name; count retained native events. **Preserve exact behavior** and compare every range/cohort in later consumer tests. “Cleaner” counts would be a new product decision, not migration parity.

**Effect/risk/reversibility:** totals and deleted/inactive/unassigned cohorts remain unchanged. Retain raw input so future deliberate analytics changes remain assessable.

**Oath/History/Statistics:** event facts and Oath outcome/session history remain independent; no recovered work by live title matching. **Both shared Projects/privacy:** both Project cohorts stay stable without leaking Resource or Oath evidence. **Phase/vectors/approval:** N1-E; `HIST-raw-*`, `DATE-local-*`; **no new semantic approval**. Consumer proof is still required before activation.

## D15 — Committed Oath aliases

**Problem/current behavior:** `{id,path,text}` commits old IDs; current title/path may differ. Native fixture reports unsupported aliases. Both enrollment stale-index histories are valid and remain frozen.

**Alternatives:** exact unique alias resolution; rewrite commitments to UUIDs; title/path fallback; force unresolved for every old ID. **Recommend exact aliases**, leaving commitment ID/workspace/snapshots untouched. Ambiguous, deleted, foreign-owner or unavailable aliases remain explicit unresolved; completed valid targets remain completed. Do not fabricate aliases for formerly ID-less past work.

**Effect/risk/reversibility:** existing records are not rewritten. A resolver must protect exactly-once fulfillment/recovery/device history and Standard/Strict behavior. Wrong aliases can fulfill unrelated work; require approved mapping revision and fail closed. Correcting a mapping must preserve prior outcomes/evidence.

**Oath/History/Statistics:** no double fulfillment or retroactive outcome repair; old event ownership/counts unchanged. **Both shared Projects/privacy:** local Oath and private provenance stay local; cross-device alias transport needs a separate owner-safe design for both Projects. **Phase/vectors/approval:** N1-F; `OATH-*`, `ID-*`; approve alias interpretation before routing. Defer for N1-B; preserve both awaitingIndex cases without further approval.

## D16 — Privacy and sharing constraints

**Problem/current behavior:** existing sharing allows Itacan and Obsidian Hub; Resources remain private even when mounted. Native serializer strips migration/capture evidence, permits only git-project packets and shares completion references rather than full History.

**Alternatives:** owner-based public allowlist/private evidence; export full generations; infer eligibility from presentation/mount; add a narrowly specified portable alias packet later. **Preserve the owner-based boundary**; any portable alias packet is conditional and needs separate review.

**Effect/risk/reversibility:** existing sharing remains intact. Local aliases/source/quarantine/receipts are private by default. Private path/block leakage cannot be undone by later deletion, so fail before serialization. No broad export of complete native generations.

**Oath/History/Statistics:** all full Oath/History/device state remains local; public completion identity does not authorize private context export. **Both shared Projects/privacy:** equal coverage for both; all four Resources and private Projects explicitly excluded. **Phase/vectors/approval:** N1-B/F; `PRIVATE-*`, `OWNER-*`; **no new approval for established privacy**, but portable alias export requires a later concrete review. Safe to defer portability while N1-B remains local/inactive.

## D17 — Plans, versions and retries

**Problem/current behavior:** current native receipts replay identical commands across memory reopen, reject changed payload, and protect lost acknowledgement/precommit faults. No migration plan/ledger exists. These receipt guarantees cannot be claimed for future source planning yet.

**Alternatives:** immutable versioned source plan with persisted allocations/receipts; rescan/reallocate on restart; last-write-wins over changed source; recreate missing receipts. **Recommend immutable plans**, independent versions and explicit source-conflict outcomes. Newer formats must stop rather than drop fields.

**Effect/risk/reversibility:** retries reuse identities/operations, never create another task/event. Changed source requires new review/version linked to the prior plan; no silent overwrite. N1-B must demonstrate atomic consistency between plan/alias/reservation publication or a safe recovery boundary. Receipts and reservations remain private. Unconsumed plans can be abandoned explicitly; consumed IDs cannot be reused.

**Oath/History/Statistics:** no alias drift, duplicate History or duplicate fulfillment/counts across retries. **Both shared Projects/privacy:** separate owner partitions, local plan evidence and same semantics for both; no whole-generation Git export. **Phase/vectors/approval:** N1-B; `RETRY-*`, `LOC-idless-stale`; approve plan/retry/version design. Deferral blocks N1-B durability claims.

## D18 — Dispositions and review

**Problem/current behavior:** strict native schemas reject some legacy content; no migration quarantine persistence/UI exists. Unsupported capability differs from invalid source or ambiguous identity.

**Alternatives:** silently drop/merge/coerce; block the entire batch without retained evidence; explicit per-occurrence dispositions and private lossless review records. **Recommend explicit dispositions**, stopping global publication where a batch consistency invariant cannot be guaranteed. “Quarantined” must not count as migrated.

**Effect/risk/reversibility:** preserve original input, candidate IDs, owner/privacy, versions/checksum, reason, decision and append-only review outcome. Reprocessing requires recorded approval/evidence revision; never silently erase quarantine or allocate fresh replacement work. Retention increases private storage; versioning and scoped rollback are necessary.

**Oath/History/Statistics:** unavailable targets stay unresolved, not completed; raw events survive independently with unchanged counts until a reviewed projection exists. **Both shared Projects/privacy:** quarantine is local/private for both; private collision candidates never leak through a shared task's review report. **Phase/vectors/approval:** N1-B onward; `COPY-*`, `CTX-missing`, `DATE-same-day-reversed`, `RECUR-unverified-*`, `HIST-source-commits-history-fails`; approve disposition/recovery workflow. Deferral blocks quarantine implementation.

## Review verdict

**Ready for a limited N1-B subset; other decisions remain deferred.** Identity/plan/private-quarantine implementation can be made concrete after approval of D01–D03 and D17–D18. It must remain inactive and cannot migrate content/completion/Oath, alter dates/recurrence, publish aliases, install or activate storage. Recurrence evidence and completion import remain substantive blockers for broader migration. The sequence remains N1-B identity → N1-C Steps/content → N1-D dates/recurrence → N1-E bindings/History → N1-F Oath/portability, with privacy/version constraints applied from N1-B.

**STOP FOR REVIEW. No decision in this sheet authorizes N1-B automatically.**
