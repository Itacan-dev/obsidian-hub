# N1-E2 handoff — Historical import, awaiting separate review

N1-E1 adds only `ItacanTaskCore/history/` analysis/projection and phase documentation. It does not modify production consumers, core commands, native schema or existing tests. The E1 proposal format is unexecutable; it must never be accepted directly as a prepared import or a source of arbitrary task/event/binding overrides.

Review `ItacanTaskCore/history/README.md`, `contracts.d.ts`, the frozen `decision-vectors-v1.json`, and `lib/tests/native-history-e1-verification.md` before authorizing E2. E1 freezes the selected whole-tree quarantine and E02–E05 mapping/identity/time/Statistics contracts; E06–E09 establish later obligations, not implemented persistence.

## Restricted future architecture

Use only the existing native `TaskRepository.execute` transaction/queue/receipt/publication authority. Prepare via `history.prepareImport`, then publish via `history.importBundle`. Separate preparation must durably commit schema/manifest **4** and the required private import namespace/capability before publication. Task schema stays 1. Schema 4 recurrence independently permits absent, namespace 1 or namespace 2; preserve all B1/B2 commands, catalogs, receipts, complete templates, lineage and recovery behavior without downgrade.

Freeze canonical event UUIDs and shared native reservations in the native prepared plan. Preparation creates no task/event/binding. Publication atomically constructs eligible tasks/Steps with explicit timestamps and completion state, verifies N1-C original envelopes, inserts only supported prepared historical events, establishes proven bindings, retains raw ordered/quarantined evidence once, and appends outcome/receipt. Do not call ordinary completed creation or completion transitions to reconstruct history: both can fabricate additional activity. Genuine later completion/reopening must continue through the existing shared helper.

Require stable operation IDs, exact expected repository/partition/plan revisions and all reviewed registry/source/History/check/identity digests, explicit synthetic approval and captured reservation evidence. Reject changed/repeated/overlapping capture lineage and conflicting operation reuse. Planned whole-tree quarantine is explicit; unexpected runtime failures reject the entire publication rather than shrink its task set. Identical committed retries return frozen allocations/outcomes before stale checks, subject to the persistent fence.

Use the existing fallback marker before replay and known imported binding-changing writes. Preserve the highest manifest barrier after recovery, including fallback ancestors lacking import plans/receipts. Do not expose fence clear/rename/replacement. Unrelated ordinary work stays available. The E1 review inventory is closed synthetic evidence, not an external freshness lease or live cross-store consumed plan. Any requirement for live coordination blocks E2 expansion and belongs to N3.

## Fidelity obligations

Retain raw ID presence/type, row order, duplicates, association and owner/time evidence privately; canonical UUIDs are distinct from aliases, operation/plan IDs and source IDs. Record original `recordedAt:null` when unknown and separate `importedAt`. Archive time is not proven completion time. Missing surviving History cannot be repaired by new events or timestamps. Preserve open-with-History without inventing reopening, and historical-only deleted/missing targets without fabricated parents.

Current bindings require exact published aliases, one explicit check, surviving noncontradictory event group, correct Step parent/hierarchy, physical owner, current source and consistent times. Candidate evidence in a quarantined tree cannot be published. Unresolved copied IDs, missing events/chains, owner ambiguities, old locator-only checks, Phase references, legacy recurrence, stale source revisions and archive-time provenance remain explicit blockers.

Compatibility projections remain opt-in; canonical `queryHistory` stays the native event API. Persist genuine reopen suppression within the same candidate, retain raw evidence, and add genuine recompletion once. Deletion retains activity. Imported canonical events already represented by raw rows are not appended again. Native publication order must be deterministic, and native/source ID collisions reject. Preserve complete actual-helper aggregate parity, including owner cohorts, labels, last-active order, earliest contributions and unrelated metrics. E1 minimal genuine-event specimens rely on existing current workspace inputs; departed-owner display labels need explicit evidence rather than inference.

Block export of any import-dependent partition pending N4. Neither private capture/proposal/plan nor provenance may leak through shared exports; sentinel tests are required. Both shared Projects, private Project, all four Resources and mounted context must preserve physical ownership.

## Next execution boundaries

Freeze the exact E2 allowlist in a separately approved execution prompt. Expected existing edits are core `domain.js`, `commands.js`, `repository.js`, `json-repository.js`, `contracts.d.ts`, `index.js`, plus narrowly scoped `recurrence.js`/`recurrence-generation.js` for schema coexistence and shared reservations. Reuse completion/content/structural helpers. No earlier tests/reports, frozen observations or production files may be edited.

Complete and await a fresh baseline before any edit; preserve dirty work and exact originals, and capture the actual B2 reader graph with hashes before source changes. New import modules/tests/old-reader fixture/docs must remain isolated. Required proof includes ordinary-creation double-count prevention, stable IDs and reservations, whole-tree blocking, full parity, lifecycle, replay/conflicts/revisions, schema compatibility/old-reader rejection, memory/JSON failures, actual interrupted child writes, persistent fallback loss fencing and private export sentinels. E1's pure tests do not prove these future behaviors.

Rerun explicit prior inventories: B2 189, B1 207, B0 22, Gate A 145, N1-C 180, N1-B 158, N1-A 158, N0 51, core 66, focused 452, 34 regression files, Safe Strict 48; all eight declaration checks including E1; plus new E2 checks. Complete protected-data/frozen-evidence/build comparisons and sealed archive before reporting completion. No production activation, migration, installation, reload/restart, Oath rewrite, shared transport, N1-F or live native storage.

**N1-E2 is unimplemented and unauthorized by this handoff. STOP FOR REVIEW AFTER E1.**
