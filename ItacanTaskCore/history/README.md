# N1-E1 — Private History evidence and compatibility projection

This separate CommonJS entry point analyzes closed synthetic captures. It creates no task, Step, completion event, binding, reservation, receipt or store. All event UUIDs in analysis remain null. `proposeImportBundle` returns a digested **evidence-only proposal** with `canExecute:false`; it is not an E2 prepared import plan.

No existing source was changed. The portable core, repository schema, production read graph and production Statistics remain unchanged. This package reuses the actual N1-B validator (including Node crypto), N1-C source verification and native value validators. It is a Node-only private analysis entry; it is not advertised as portable or shared transport.

```js
const history = require("./ItacanTaskCore/history");
const analysis = history.analyzeHistoryCapture(capture);
const proposal = history.proposeImportBundle(capture, review);
const recordedInput = history.projectRecordedHistory(proposal);
const statisticsInput = history.projectStatisticsCompletions(proposal);
// Pass .records through the existing production pure read/Statistics helpers.
// No execute/import/prepare/store operation exists at this entry point.
```

Declarations are in `contracts.d.ts`. Captures, review pins and proposals are strict version-1 JSON contracts; unknown versions, fields or digest mismatches reject. Digests detect changes; they are not signatures, leases or evidence of external freshness.

## Evidence contract

`HistoryCaptureV1` explicitly pins capture/source lineage and revision, registry, ordered History/check arrays, published N1-B snapshot/plan and verified N1-C envelopes. Every identity-plan occurrence must have a target-state disposition. Original envelope bytes, nested ancestry, physical ownership and date/reference metadata are checked using the established validators; target omission cannot imply deletion.

Raw History values preserve absence versus null, numeric/string/boolean IDs, falsey IDs and ordered duplicate rows. Stable row keys are canonical tuples of capture lineage, capture ID and ordinal. They never use a title, timestamp or guessed event UUID. A byte envelope optionally preserves exact UTF-8 or opaque bytes as hex, checksum and length. UTF-8 wrappers contain exactly `history` and `checks`; parsed disagreement rejects. Opaque/unparseable evidence remains retained with `RAW_SOURCE_UNAVAILABLE`, and projection throws `HISTORY_UNAVAILABLE` instead of yielding empty totals. `rawSource:null` claims preservation of portable values only, not original byte fidelity.

The public four functions allocate no identities. Tests construct their synthetic pinned plans separately through actual N1-B memory planning; that fixture construction is not an allocation by analysis or projection. E1 does not consume, modify or publish an N1-B plan.

## Decision sheet

The approved E1 contract revision is `N1-E1-E01-E09-r1`. These decisions specify analysis and future requirements; E2 persistence remains unimplemented.

| Policy | E1 behavior | E2 boundary |
|---|---|---|
| E01 | Any blocked completed task/Step quarantines its whole tree; checked state survives as evidence | Enforce publication eligibility |
| E02 | Exact published alias, one current check and surviving event group; parent/kind/owner/source/time consistency; no title/line/latest inference | Establish proven native binding atomically |
| E03 | Typed truthy IDs group identical rows; falsey/missing IDs are separate occurrences; contradictory payloads have no canonical winner | Allocate stable canonical event UUIDs |
| E04 | Raw quarantine does not remove compatibility input or change legacy dedup | Persist immutable evidence and projection metadata |
| E05 | Chart timestamps retained unchanged; current-check proof may establish a canonical time; otherwise null | Persist time quality and separate importedAt |
| E06 | Every analyzed event UUID is null; proposal is unexecutable | Prepare IDs inside the existing native repository |
| E07 | Exact pinned published N1-B and verified N1-C synthetic evidence only | No live cross-store consumption; N3 coordination required |
| E08 | Review names prior captures; same lineage or overlapping file ID/path rejects | Durable single-capture uniqueness |
| E09 | No import/fence writer exposed | Reuse persistent fallback fence before replay/publication/binding writes |

Checks without event identity or task/Step aliases never acquire a binding via locator fallback. An unresolved old check in the same source is a blocker, not a match. A check with an exact alias but contradictory current path, owner or Step parent also blocks. Historical event paths may differ after moves: their recorded owner remains authoritative. A cross-owner event may remain historical-only but cannot bind the live target.

Identical repeated truthy-ID rows share one evidence group with all source-row references. Differing payloads quarantine that group regardless of stored order; legacy Statistics still receives the original order and applies its own established first-truthy-ID behavior. Analysis does not choose a canonical winner from that legacy counting rule.

Open targets may retain historical events without a current binding or invented reopening. Completed targets require explicit proof, including all known consistent integral timestamps. All-null times can prove an unknown-time binding; null is never replaced by analysis time. Fractional timestamps remain valid compatibility input where the actual legacy helper accepts them, but cannot prove native integral completion time. `archivedAt` presence is conservatively archive-time uncertainty and blocks current binding pending provenance review. It does not erase the raw chart timestamp.

Only `analysis.bindings` contains bindings of fully eligible trees. An individual target may retain a proven candidate under `.binding` while a sibling quarantines the tree; that candidate is diagnostic evidence and is not publication eligibility. Groups/ordinals and `accounting.groupedRows` account for every input row, including malformed and unbound rows.

Unresolved folder/Phase references, legacy recurrence, copied IDs, unsupported content, owner ambiguity, stale checks and missing events remain blockers. E1 does not repair them. D07/D08/D09, N1-B identities, N1-C lossless content and D10 recurrence remain established.

## Projection and fidelity

Projection returns detached **inputs**, not a new History renderer or Statistics calculator. Production helpers are deliberately absent from this package's runtime dependencies. The test-only harness invokes the actual pipeline:

`queryHistory → recordedHistoryQuery → statisticsCompletions → prepareStatistics → aggregateStatistics`

It also calls actual `historyRecords` separately for History display eligibility/order. Raw inputs receive no deduplication, owner prefilter, timestamp coercion or repair. The actual Statistics helper owns global typed truthy-ID dedup before timestamp filtering, historical attribution, local-calendar range selection and bounded bins. UI All time and internal aggregate default `3m` are preserved.

The frozen E1 corpus contains 47 synthetic input cases, 15 actual-source hashes and complete-aggregate/preparation/display digests. Tests additionally compare full objects at runtime, including every workspace/range, activity, last-active ordering, historical cohorts, earliest time, bins, reports, notes, Oath sessions and derived metrics. The fixture stores observations separately from policy decisions. Three child processes verify calendar observations in UTC, Europe/Stockholm and America/New_York. Earlier N1-A observations are not recaptured.

`VisibilitySpecimen` simulates reopening only a currently proven eligible binding. It suppresses that entire raw event group without modifying evidence. It is neither a receipt nor proof of a committed native reopening. Deletion does not suppress retained History. Future E2 must derive such metadata inside genuine commits, never accept arbitrary visibility overrides.

`CanonicalEventSpecimen` is likewise test/review input, not publication authority. A represented import must match its evidence group, private provenance reference, ownership, time and proven targets; it adds no second input row. Genuine native events require native targets, registered physical ownership and no imported legacy override. Counted events are prepended in descending committed revision/index; timestamps do not determine publication order. Duplicate native IDs, ambiguous publication positions and raw/native ID collisions reject. Minimal genuine-native records contain no fabricated source navigation or owner label: callers supply current Statistics workspaces through the existing pipeline. Preserving a departed native owner's display label requires separately reviewed evidence; no current-path/name inference is introduced here.

## Verification and limits

Run the two `.test.cjs` files with Node's test runner and the isolated Temp filesystem guard used by the phase archive. Run `tests/typecheck.cjs <existing typescript.js>` for strict no-emit declarations. Tests never instantiate plugin startup. The existing isolated host seam demonstrates Markdown completion surviving a History-save failure; actual legacy transition tests cover reopen/recomplete and deletion retention.

There is no E1 durable import, schema change, import replay, event allocation, recovery marker operation or crash protocol. Those claims require E2 tests after separate review. No real data was captured into the synthetic vectors or analyzed for eligibility. Private evidence/proposals must not be exported into shared partitions; no export path or transport is provided. Production graph/build and protected-data comparisons are recorded in `lib/tests/native-history-e1-verification.md`.

**STOP after N1-E1 for user review. E2 requires separate authorization and a freshly frozen allowlist/baseline.**
