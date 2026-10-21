# N1-D handoff — Local Date/Time Compatibility and Recurrence Semantics

2026-10-17. **Proposed next phase; N1-D is not implemented or authorized by completion of N1-C. STOP FOR REVIEW.** Read [N1-C verification](../tests/native-step-content-verification.md), [Step/content API](../../../../../ItacanTaskCore/STEP-CONTENT.md), [N1-A frozen vectors](../tests/native-migration-compatibility-v1.json), [compatibility specification](../tests/native-migration-compatibility-spec.md), [historical decision sheet](TASK-SERVICE-N1-DECISIONS.md) and [N1-B identity API](../../../../../ItacanTaskCore/identity/README.md).

N1-C's request approves D05 and D06 only for inactive synthetic/disposable work. Its explicit ancestry/order drafts, atomic full-tree command and private byte-exact source/content revisions are now available. The historical N1-A decision sheet is retained verbatim; approval recorded by N1-C does not retroactively rewrite observations or that sheet. Native schema 1 still has no recurrence engine or series model. Production remains Task Service → one shared Legacy Adapter → Markdown/metadata authority.

## Entry review and approval gates

1. Explicitly authorize the N1-D scope and approve **D07**: what to do with established same-day reversed clock ranges. Legacy validation accepts Start `18:00` / Due `09:00` on one date; native validation rejects it. Both reject reversed calendar dates. Choose reviewed quarantine, a compatibility representation/grandfather rule or an explicitly approved normalization with coherent editing/query/sort semantics. Current recommendation remains quarantine unchanged. Do not swap clocks, advance a day or drop times silently.
2. Preserve **D08** established precision: local date-only differs from explicit `00:00`; null unknown completion timestamps stay null. Import/current time is not completion time. Keep Necessity's must/should/null meaning and uninterpreted raw values. Do not change dates in another phase to make tests pass.
3. Approve **D09** recurrence rollout: verified native execution, retained-intent quarantine, per-series review or separately reviewed exclusive legacy authority. Recommendation remains quarantine plus retained original rule/source until supported. A stored string is not a functioning recurrence engine, and N1-C's source-envelope quarantine does not establish a date/recurrence migration policy.
4. Resolve **D10** with additional configured Tasks evidence and policy approval before implementing occurrence generation/identity. Separate stable series, task occurrence and completion-event identities. Title/date similarity cannot supply lineage. Do not implement a guessed engine to unblock migration.

If a contract/schema/host change is required, produce its exact backward-compatibility and recovery design for review before activating anything. No earlier phase approves production migration, mixed authorities, live aliases or Git transport.

## Date/time evidence and required tests

Preserve the unchanged `DATE-*` observations: same-day reversed clocks, calendar reversal, date-only, explicit midnight, valid/invalid dates/times, leap/year transitions, orphan time and grouping/order. Native endpoint acceptance is not proof that a local clock maps to a unique instant. Test Europe/Stockholm DST gaps and overlaps, wall-clock interpretation, sorting/day grouping and Schedule rendering explicitly in synthetic fixtures. Do not convert date-only values into UTC midnight or infer zone/offset from a completion/import timestamp.

Compare existing pure task validator, date presentation, Schedule grouping/query and native endpoint validation using explicit tests. Keep current unmigrated legacy Schedule/edit behavior intact. State whether ambiguous DST times remain wall-clock evidence, quarantine or require explicit reviewed zone/offset. Distinguish required end-user semantics from current JS/Moment implementation behavior. Unknown endpoint/precision/metadata values must retain evidence rather than becoming root/default/null silently.

## Installed Tasks evidence and its limits

N1-A inspected the local installed **Tasks 8.4.0** bundle; verify its hash/version/settings again before using that evidence. Itacan delegates parent-line completion to `apiV1.executeToggleTaskDoneCommand(line,path)` when available and otherwise uses checkbox fallback; Step toggling is local. No real toggle or Standard/Strict Oath is authorized as a probe.

Source evidence shows `Cb` parsing one line, calling `toggleWithRecurrenceInUsersOrder` and serializing returned lines. Completion can produce a next and completed occurrence; reopen/already-completed transitions do not take that generation branch. Configured occurrence ordering and `onCompletion:delete` may change returned lines. `createNextOccurrence` clears Tasks' own ID/block/dependencies/done/cancel dates. **Tasks' ID is distinct from the hidden Hub comment/native UUID.** Exact hidden-comment carryover and configured serialization remain unverified.

The installed parser has `when done`, RRULE/Moment reference-date logic and month/year/DST branches. Those branches are source evidence, not a successful replay of configured runtime behavior. Four N1-A controlled callback vectors demonstrate Itacan multiline splice/returned identities/state/surviving Step text; four explicit unverified recurrence records preserve missing evidence. Do not relabel callback results as real plugin recurrence execution.

Required additional evidence, gathered only in safe synthetic/disposable hosts:

- Exact plugin version/hash and relevant status/order/delete/recurrence settings, with private configuration kept local.
- Actual configured next/completed line ordering, zero/one/multiple returned lines and serialization of Hub comments, Tasks IDs, block links, dependencies and unknown metadata.
- Reference-date selection for fixed schedules versus `when done`, date-only/explicit time/midnight, missed occurrences, month-end/leap/year and DST cases.
- Complete → reopen → recomplete transitions, cancellation/delete/no-next-occurrence branches, API failure/fallback and retry after source-write acknowledgement loss.
- Nested Step retention/ownership/reassociation when the API receives only a parent line, and behavior when next/completed source lines share hidden IDs.
- Itacan task metadata, source identity and History outcomes around recurrence, without guessing successful event import from line text.

If safely executing configured Tasks internals requires Obsidian globals/onload or real settings/storage, stop and design a fake host or report the evidence gap; do not launch the installed plugin against the real vault.

## Occurrence/History/identity requirements

Design immutable series identity, occurrence identity, predecessor/next links, rule/source revision, reference date, generation operation/receipt and distinct completion-event identity. A next occurrence must not reuse a globally reserved task/Step UUID. Existing occurrences retain identity across complete/reopen/recomplete; native current core creates a new event on recompletion rather than a new series. That is existing native behavior, not verified Tasks parity or approval to import old events.

Specify whether Steps persist across occurrences, are copied with new identities, are reset or remain tied to a completed occurrence, based on safe evidence and review. Do not flatten the N1-C hierarchy or copy completed Step IDs/events to the next occurrence. A commitment targets a particular occurrence; later work must not silently resolve it to its successor. Historical snapshots, unknown timestamps and counted/reopened event relationships remain unchanged until N1-E/N1-F review.

N1-B plans/aliases/reservations/receipts and N1-C original bytes/revision chains are immutable. Source move/edit/replacement/ancestry conflict cannot be bypassed with new labels or reallocated IDs. No reviewed rebase exists. Cross-store identity-plan consumption is still unsupported and must not be described as atomic without a reviewed single boundary/coordinator.

## Privacy, storage and verification

Every task has one physical Project/Resource owner. Itacan and Obsidian Hub remain separate eligible shared Projects; Knowledge/study, Research/literature, Explorations/references and Inspiration/inspiration remain private even through mounts. Source parent folder is retained context; source note/path/range is provenance rather than required native identity/navigation. N2 location/host resolution is still deferred.

N1-C private originals, normalized interpretations, old/current private bodies, previous generic evidence and receipts must stay private. Recurrence/rule/identity/History/Oath/device evidence does not become a public Git packet or current Search result. Any future approved canonical sharing projection must respect the owning partition and exclude Resource evidence in both Projects.

Before work: reconcile dirty Git status, fresh file/protected data/shared-state hashes and all N0/N1-A/N1-B/N1-C archives; back up exact originals; define a narrow allowlist; compare current staged and installed builds without installing. Preserve independent workspace drift and existing user changes. Use deterministic clocks, explicit timezone fixtures, fake hosts, memory and verified OS Temp persistence guarded against real-vault writes. Never recursively discover archived tests.

Required regression gate: all existing N1-B 158, N1-A 158, N0 51, native core 66, N1-C 180, focused 452, 34 regression files and safe Strict 48, plus all four existing declaration checks and any new N1-D tests. N1-C has seven real process-crash stages; existing native JSON known-corruption recovery reports an older verified committed ancestor, while unknown private versions fail without downgrade. Do not substitute N1-B's stricter identity-store recovery claim for the native task adapter's actual behavior. Universal power-loss/OneDrive/distributed durability and production retention remain unproven.

Unsupported recurrence cases must remain explicit and evidence-preserving. Do not add a plain one-shot task as a fallback for unsupported recurrence. Test stale edits, duplicate completion/generation attempts, changed payload replay, unknown versions, corrupt/missing evidence, concurrent operations, pre/post-commit faults, reopening and source conflicts through actual inactive repository boundaries.

No production consumer/writer/UI/authority/storage activation, real task/History/Oath migration, alias transport, bundle installation or Obsidian reload/restart. Any unexpected production factory change is a scope issue. Inherited divider/History heading-icon browser failures stay outside scope. Prepare exact implementation/decision/verification/safety evidence and the next-phase handoff, then **STOP FOR REVIEW after N1-D**. Do not enter N1-E or live migration automatically.

**Readiness:** N1-D can begin after N1-C review and explicit D07/D09 authorization; D10 implementation additionally requires configured recurrence evidence and identity-policy review. No date/recurrence blocker has been waived by N1-C.
