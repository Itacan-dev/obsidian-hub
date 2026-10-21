# N1-D Gate A — inactive temporal compatibility

2026-10-17. **D07/D09 approved for synthetic/disposable implementation only. D08 preserved. D10 not implemented. STOP FOR USER REVIEW.** [Verification](../../.obsidian/plugins/hub-project-menu/lib/tests/native-temporal-recurrence-verification.md), [configured evidence](../../.obsidian/plugins/hub-project-menu/lib/tests/native-recurrence-evidence.md), [D10 proposal](../../.obsidian/plugins/hub-project-menu/lib/tests/native-recurrence-d10-proposal.md), [Gate B handoff](../../.obsidian/plugins/hub-project-menu/lib/services/TASK-SERVICE-PHASE-N1-D-B.md).

## Boundary and existing capabilities

This independent entry point exports `classifyTemporal`, `TEMPORAL_DECISION` and an always-denied `publicTemporalProjection`. It is not re-exported from native core or imported into production. There is no command, store, migration, reservation allocator, recurrence engine, event writer, UI or plugin startup hook.

The classifier calls existing `task-planning.validateTaskMetadata` and native `domain.validateTask`; it does not duplicate their date parsers/order validation. A constant internal validation-only UUID builds a throwaway validation record through `commands.newTask`; no factory is called, nothing is created/persisted, and that probe is never returned as a native task/planned ID. Original identity evidence is carried without claiming that identity planning/import is complete.

Production Task Service, date validation, Schedule, Tasks delegation, Markdown writers, History, Statistics, Oath and sharing remain unchanged. N1-B and N1-C code/formats/original receipts are unchanged. This code uses a pure existing legacy domain dependency and Intl, not an Obsidian host. It does not alter the standalone native core's dependency graph.

## Versioned private input

See [declarations](contracts.d.ts). All top-level fields are required:

```js
const {classifyTemporal,TEMPORAL_DECISION} = require('./index');
const input = {
    format:'itacan-temporal-candidate',version:1,policyVersion:1,
    decisionRevision:TEMPORAL_DECISION,
    identity:{legacyId:'synthetic',nativeId:null},
    owner:{type:'project',id:'itacan'},timezone:'Europe/Stockholm',
    metadata:{fromDate:'2026-10-17',fromTime:'18:00',
              dueDate:'2026-10-17',dueTime:'09:00',necessity:'must'},
    completion:{completed:false,timestamp:null,evidence:null},source:null,
    recurrence:{kind:'none',line:null,rule:null,syntax:null,parser:null}
};
const result = classifyTemporal(input);
// result.status === 'quarantined'; input's dates/times remain exact.
```

Input format/version, policy version and decision revision `N1-D-A-D07-D09-r1` are checked independently of N1-A vectors, N1-B ledgers, N1-C envelopes, native schema and read protocol. The version-1 contract is intentionally narrow. Unknown/missing/newer versions or mandatory fields produce an explicit unsupported-format result retaining the original JSON. Non-JSON/accessor/cyclic/deep invalid inputs reject through the existing JSON validator rather than being serialized lossily.

`identity` contains supplied legacy/native labels, not an allocation request or identity proof. Owner is exactly one Project/Resource. `metadata` retains the entire supplied JSON record, including unknown fields. Classification reads legacy from/due dates/times and Necessity without overwriting raw values. `completion` carries explicit current state, nullable known instant and original evidence separately; no event is imported.

`source` is null or an existing N1-C envelope. Its checksum/version/owner and supplied native identity association are validated. Original envelope bytes/revisions are never edited. If supplied, `recurrence.line` must match the original envelope's first normalized line. N1-C quarantine remains an independent blocker, including its uninterpreted Tasks syntax diagnostic. An explicit absence assertion cannot hide recurrence markers elsewhere in the retained block. Source changed/corrupt/foreign-owner/identity conflicts block analysis; full-document recapture/revision validation remains N1-C's separate `verifySourceEnvelope` responsibility. The helper has no vault from which to refresh evidence and does not claim a stale external source is current.

## Results and migration gate

Result format `itacan-temporal-compatibility` version/policy 1 is local/private. It includes a detached exact `original`, typed diagnostics with decision/field, separate legacy/native/wall-clock/completion/recurrence assessments, overall status and `temporalGate`.

| Overall status | Meaning |
|---|---|
| `representable` | This temporal check is clear; no recurrence/source blocker found |
| `quarantined` | Retained evidence needs review, including D07 mismatch or unsupported native recurrence |
| `invalid-legacy` | Actual current legacy validator rejects the supplied dates/times |
| `ambiguous-evidence` | Incomplete/conflicting values, unknown Necessity, unresolved clocks or recurrence interpretation |
| `unsupported-format` | Unknown/incompatible version/decision/required contract or parser witness |

`automaticImportAllowed` is **always false**. A clear temporal gate does not establish identity/content/completion/Oath/host/import readiness. Blocked records remain under existing legacy authority, with original dates/rule/content/History/Oath untouched; nothing is hidden/deleted from active Itacan. No task is counted as migrated. No N1-B disposition or receipt is rewritten. Future migration must attach a new separately reviewed analysis to a captured plan/source digest, compose all readiness gates, and revalidate revisions before any write; this phase implements none of that orchestration.

## D07/D08 date, clock and completion rules

Actual legacy validation checks calendar order but accepts Start `18:00` / Due `09:00` on one date. Actual native validation rejects it. Gate A preserves both values and records `LEGACY_NATIVE_DATE_ORDER_MISMATCH` / D07. It does not swap clocks, advance a date, drop a time, relax validation or invalidate a currently valid legacy task. Both existing validators still reject reversed calendar dates.

For accepted evidence, `native.endpoints` is a **non-persisted representability assessment**, not rewritten source: legacy date fields correspond to `{date,time:null|HH:mm}`, missing endpoints to null, Necessity to must/should/null. Raw missing/null/empty values remain distinguishable in `original`. Nonstring values or unknown Necessity are flagged rather than silently accepting a normalizer's defaults. Invalid legacy input is not repaired or mapped through dropped orphan time.

Date-only fields are local calendar dates, not UTC midnight events. Explicit `00:00` is minute precision, distinct from missing time. Known completion timestamps remain exact nonnegative integer epoch milliseconds; unknown completed timestamps remain null. Open records cannot have a completion instant. Invalid evidence is retained/flagged; import time, due date, recurrence reference or current time never supplies a historical completion. Necessity remains the user-facing name; no UI/filter/color behavior changes.

Wall-clock evidence is derived **only after existing validators accept the endpoint**, using explicit timezone and Intl zone rules. It samples offsets around that local calendar day and round-trips candidate instants through Intl; it does not create another calendar parser or use host timezone/completion time to choose an offset. Tested target is modern Europe/Stockholm. No claim covers every historical timezone transition/ICU version; unsupported zone/value resolution remains blocked.

The result separates precision from zone status: missing endpoint, date-only/not-an-instant, unique timed clock, nonexistent clock, repeated/ambiguous clock or unresolved zone. Candidate instants are evidence, never a selected new completion/start timestamp. On 2026-03-29 `02:30` has no candidate; on 2026-10-25 `02:30` has two candidates. Both domains accept those wall-clock fields, but Gate A blocks automatic temporal readiness. Existing JS display may normalize a gap or choose one overlap offset; the classifier retains the original clock and reports the distinction instead of adopting that normalization.

## Schedule findings and limits

Existing pure `task-planning` and `task-views` helpers are tested directly. Untimed Start becomes local midnight for future eligibility; untimed Due is local end-of-day for overdue display. Upcoming bucket labels are calendar-based: an overdue midnight task today remains in Today, while a preceding due calendar date is Past due. Due dominates Start when both exist. Future/completed eligibility and Necessity grouping remain separate from sorting.

Due sorting places explicit midnight before later time, date-only after timed tasks, missing endpoints last, preserving stable ties. Upcoming groups additionally sort Necessity within buckets. Week/Month grids use local calendar arithmetic/day ordinals across DST rather than fixed 24-hour geometry; tests cover winter/summer, both transitions, leap/month/year and midnight boundaries. Itacan's 06:00 work-day boundary remains distinct from Schedule's local calendar day.

These are existing consumer helper observations. No native Schedule routing, full task eligibility/owner/location/invalidation integration or browser parity is implemented or claimed.

## D09 recurrence evidence

`recurrence.kind` is `none` (explicit supplied absence), `source` or `unknown`. Original line/rule and syntax `tasksPluginEmoji`, `dataview`, `unknown` or null remain exact. Marker detection is deliberately conservative (Tasks recurrence emoji or repeat metadata delimiters), not a new natural-language parser. An explicit rule is retained even if no marker is recognized. Contradictory absence/incomplete evidence is ambiguous and blocked.

Without an actual parser witness, syntax present is `present-unverified`; empty explicit rules are malformed. Unknown evidence is ambiguous. Optional version-1 `TasksParserWitness` carries exact input line, syntax/settings, installed version/hash, parser outcome and its derived rule. This phase accepts only the reviewed Tasks 8.4.0 bundle SHA-256. Unknown versions/hashes/capabilities/required fields cannot downgrade. Conflicting input/format/empty recognized rule blocks. A supplied witness is externally gathered evidence, not authenticated execution performed by the classifier; its settings/source capture must remain part of later review.

With a matching witness, status distinguishes recognized-but-native-unimplemented from unsupported/ineligible. **Every recurring case remains blocked**, including recognized syntax, known daily advancement and apparent natural-language parse success. The exact original line/rule is retained separately from Tasks' normalized rule. In one executed example, `every frobnication` is interpreted as weekly Friday; that is not permission to rewrite original intent or mark native equivalence verified. Bounded rule failures remain evidence requiring policy review.

The N1-C envelope is not a recurrence engine. Classification does not execute the installed bundle. Only [test-only harness](tests/tasks-harness.cjs) runs actual installed parsing/status/recurrence/serialization under controlled settings and fake hosts; it is absent from native/core/plugin entries.

## Evidence harness and privacy

The harness reads the hash-pinned installed Tasks bundle and Moment 2.29.4 from installed Obsidian's `obsidian.asar/lib/moment.min.js`. `ITACAN_TEST_MOMENT_PATH` can supply an exact same-byte local copy for reproduction; provenance hashes must still match frozen evidence. Appended accessors expose existing bundled functions; algorithm bodies are unmodified. Settings and required filter-singleton setters are explicitly synthetic; no actual Tasks `data.json` is loaded. Fake Obsidian classes throw if constructed; no plugin instance/onload, DOM, timers, process, filesystem or network API enters either VM. Both VMs share an injected fixed Date constructor to avoid a cross-realm Date/instanceof artifact; Moment's clock is fixed too.

The frozen [Gate A evidence JSON](tests/gate-a-evidence.json) records 39 installed configured cases, three status transitions, two nested-block splice cases and six Map-host writer/failure scenarios. Each installed case records exact input/settings/output/IDs/dates/evidence level and library hashes. Tests reproduce outputs rather than asserting every observed behavior is correct or native-compatible. The Map writer invokes current Itacan methods without onload; all note/History state is synthetic and memory-only.

All candidate/source/recurrence/identity/History/Oath/provenance evidence is private. `publicTemporalProjection()` throws `PRIVATE_EVIDENCE` and returns no packet. Neither shared Project can acquire Resource evidence through classification or a mount. Existing allowlisted public serializer and transport are unchanged; no temporal record is attached to a shareable task. Both shared Projects, private Project and all four Resources have source-preservation/privacy checks.

## Failure, recovery and next gate

The classifier is deterministic/read-only and introduces no persisted compatibility state, command receipt or generation writer. Repeated calls preserve exact inputs; changed source/witness and unknown contracts fail explicitly. No new persistence/crash tests are claimed for it. Existing native JSON may report recovery to an earlier verified committed state, losing the last revision/receipt; N1-B identity recovery remains stricter fail-closed. Neither policy is modified.

Configured pure Tasks calls are not durable exactly-once generation operations. Map-host experiments distinguish API/write failure, source acknowledgement loss and History save failure. No guarantee of latest acknowledged recovery, OneDrive/power-loss durability, cross-device generation or atomic identity-plan consumption follows.

D10 series/occurrence/Step/event/receipt models are proposals only. Gate B requires explicit approval plus resolution of unsupported bounded-rule/timed-clock/Step policy gaps; see the separate handoff. No recurrence schema, native occurrence writer, N1-E import, production activation, bundle installation or Obsidian reload/restart is authorized by Gate A completion.
