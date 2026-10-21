# N3-B2-B verification — atomic task Save and rich creation

Completed 2026-10-19. **Restricted inactive gate complete; STOP FOR USER REVIEW.**
Production remains on the Legacy Task Service. No N3-C work, migration,
installation, repository conversion, Obsidian reload/restart or enforcement
startup was performed.

## Implemented behavior

`task.save` and `task.createRich` are implemented through the existing repository
queue, detached candidate, opaque writer admission, normal receipt and one
publication. Save accepts the complete hybrid draft and authoritative
repository/task/partition/content/tree/binding/recurrence/inventory guards.
Structural/content primitives and `completionTransition` are unchanged. Parent
and Step state remain independent. Deterministic effects cover deletion,
reopening and completion; no-op Save creates no task/content revision or event.
Rich initialization uses fresh clocks, exact private bodies, combined identity
reservations and initial-completion provenance without create-then-edit.

Both commands require validated `result.atomicTask` version 1. Portable
validation recomputes complete effects from receipt-backed prior/result task
snapshots, command guards, actual events, binding relationships and content.
Later legitimate mutation does not invalidate immutable creation evidence.
Historical receipts retain their shape and meaning; old `createMany` generated-ID
receipts are recognized without rewriting them. A digest alone is insufficient.

The creation-only `atomic-task-mutations-v1` capability uses private
barrier/lineage/state envelopes version 2. Private wire 4, logical schemas 1–4,
task schema 1 and recurrence/import namespace versions are preserved. JSON opt-in
requires a verified existing physical OS Temp child and emptiness before and
under lock. Opening cannot enable it. Memory backing retains equivalent opt-in.
All writes and mutation replay, including retained core handles and direct final
publication, are blocked after known fallback in enabled roots. Existing roots
retain their earlier rules. No upgrade, replacement authority or fence-clear
operation exists.

Imported reopenings require verified Save effects before exact raw-group
suppression. Raw capture, owner attribution, originals, import plan/outcome and
null completion times remain immutable. Mixed reopening/completion uses actual
receipt event ordering. Unchanged checked state and deletion do not invent
activity or suppression. The durable projection and legacy Statistics algorithms
remain unchanged.

Private coherent proof v2 exposes only the selected verified effect excerpt and
truthful command. Genuine parent Save completion may qualify through the current
binding and exact creation receipt; initial completion, inserted checked Steps,
History append and import cannot. V1 stays conservative for new commands. F1
sources/observations are unchanged. Actual F2 v2 tests retain the closed synthetic
save acknowledgement → open cut → later completion requirement. Ordinary/restored
enrollment remains `ENROLLMENT_ORDER_UNPROVEN`.

Prepared recurrence members support local edits/reopening while preserving the
successor, template and spent outcome. Compound completion rejects with
`RECURRENCE_COMMAND_REQUIRED`; standalone B2 generation retains authority.
Application v2 full-save/rich-create compiles one stable intent into exactly one
writer request. V1 behavior/hashing is preserved. Identical replay returns original
IDs/effects; changed stable evidence conflicts. Known commitment survives a failed
refresh. Uncertainty retains the original operation and requires authoritative
reconciliation and identical replay.

Hosted rich-editor reads remain deferred. Supplied complete drafts are executable
fixtures, not production editor loading. No Inbox acknowledgement, planning save,
Oath outcome or transport follows task commitment.

## Fresh foundation and scope

Before edits, the sequential baseline completed at 10:30:32 UTC: 1,621 exact
originals, 612 Git-status entries, 178 History rows and six checks. No live native
artifacts existed outside backups. Gate A's ZIP, 4,211 inventoried files, eleven
reviewed outputs and 654-file current source graph verified; seven predecessor
ZIP seals verified. All dirty work was preserved. The complete 1,887-line Agent
request is retained privately as `user-request.txt`.

Exactly 26 existing files changed and 20 new files were created. There were no
source-allowlist deviations. Existing tests, fixtures, frozen graphs and historical
reports remain byte-preserved. Existing production/configuration/UI code,
completion/structural/content primitives, recurrence engine and serializers are
unchanged. Exact before/after SHA256 values and reviewed bytes are retained in
`source-change-verification.json` and `reviewed-outputs/` in the sealed archive.

### Existing files changed

- `ItacanTaskCore/src/commands.js`
- `ItacanTaskCore/src/domain.js`
- `ItacanTaskCore/src/repository.js`
- `ItacanTaskCore/src/json-repository.js`
- `ItacanTaskCore/src/private-storage-codec.js`
- `ItacanTaskCore/src/private-storage-codec.d.ts`
- `ItacanTaskCore/src/json-repository.d.ts`
- `ItacanTaskCore/src/memory-repository.js`
- `ItacanTaskCore/src/contracts.d.ts`
- `ItacanTaskCore/src/history-import.js`
- `ItacanTaskCore/src/snapshot-read.js`
- `ItacanTaskCore/src/snapshot-read.d.ts`
- `ItacanTaskCore/host/repository-host.js`
- `ItacanTaskCore/host/index.d.ts`
- `ItacanTaskCore/host/completion-proof.js`
- `ItacanTaskCore/writer/policy.js`
- `ItacanTaskCore/writer/admission.js`
- `ItacanTaskCore/writer/repository-writer.js`
- `ItacanTaskCore/writer/index.d.ts`
- `ItacanTaskCore/oath/completion-proof.js`
- `ItacanTaskCore/oath/completion-proof.d.ts`
- `ItacanTaskCore/oath/adapter.js`
- `ItacanTaskCore/oath/adapter.d.ts`
- `ItacanTaskCore/application/intents.js`
- `ItacanTaskCore/application/contracts.d.ts`
- `ItacanTaskCore/application/native-adapter.js`

### New files

- `ItacanTaskCore/src/atomic-task.js`
- `ItacanTaskCore/src/atomic-task.d.ts`
- `ItacanTaskCore/src/completion-effects.js`
- `ItacanTaskCore/src/completion-effects.d.ts`
- `ItacanTaskCore/atomic-task/tests/runtime-support.cjs`
- `ItacanTaskCore/atomic-task/tests/atomic-save.test.cjs`
- `ItacanTaskCore/atomic-task/tests/rich-create.test.cjs`
- `ItacanTaskCore/atomic-task/tests/completion-effects.test.cjs`
- `ItacanTaskCore/atomic-task/tests/import-statistics.test.cjs`
- `ItacanTaskCore/atomic-task/tests/recurrence.test.cjs`
- `ItacanTaskCore/atomic-task/tests/admission-replay.test.cjs`
- `ItacanTaskCore/atomic-task/tests/application.test.cjs`
- `ItacanTaskCore/atomic-task/tests/privacy-ownership.test.cjs`
- `ItacanTaskCore/atomic-task/tests/persistence.test.cjs`
- `ItacanTaskCore/atomic-task/tests/crash-worker.cjs`
- `ItacanTaskCore/atomic-task/tests/runtime-types.fixture.ts`
- `ItacanTaskCore/atomic-task/tests/runtime-typecheck.cjs`
- `ItacanTaskCore/ATOMIC-TASKS.md`
- `.obsidian/plugins/hub-project-menu/lib/tests/native-atomic-task-n3-b2-b-verification.md`
- `.obsidian/plugins/hub-project-menu/lib/services/TASK-SERVICE-PHASE-N3-C.md`

## Executed acceptance

The final explicit nine-file B suite passed **220/220**, zero failures,
cancellations or skips (`accepted-final-new`). Its new declaration runner passed
with TypeScript 6.0.3 and zero diagnostics. Sixteen prior declaration runners also
passed: **17 total**, with the Gate A contract check separate from B runtime.

The exact saved 40 prior selections (24 behavioral, sixteen declarations) ran
unchanged and passed. Their behavioral summaries total 3,028 checks. The seven
storage/admission-dependent selections ran again after the final creation guard:
E2-R 102, E2 persistence 124, recurrence B2 189, core 66, N2 127, N3-A 136 and
N3-B1 138, all passing. Repeated runs are not additional distinct cases.

| Saved behavioral inventory | Passed | Raw run prefix |
|---|---:|---|
| E2-R | 102 | `accepted-prior-00` |
| E2 persistence | 124 | `accepted-prior-01` |
| E2 behavior | 43 | `accepted-prior-02` |
| E2 Statistics | 53 | `accepted-prior-03` |
| E1 frozen graph | 138 | `accepted-prior-04` |
| E1 current behavioral | 137 | `accepted-prior-05` |
| Recurrence B2 | 189 | `accepted-prior-06` |
| Recurrence B1 | 207 | `accepted-prior-07` |
| Recurrence B0 | 22 | `accepted-prior-08` |
| Gate A | 145 | `accepted-prior-09` |
| N1-C | 180 | `accepted-prior-10` |
| N1-B | 158 | `accepted-prior-11` |
| N1-A | 158 | `accepted-prior-12` |
| N0 | 51 | `accepted-prior-13` |
| Native core | 66 | `accepted-prior-14` |
| Focused legacy | 452 | `accepted-prior-15` |
| Regression (34 explicit files) | 34 | `accepted-prior-16` |
| Safe Strict/recovery | 48 | `accepted-prior-17` |
| F1 | 160 | `accepted-prior-28` |
| F2 | 124 | `accepted-prior-30` |
| N2 | 127 | `accepted-prior-32` |
| N3-A | 136 | `accepted-prior-34` |
| N3-B1 | 138 | `accepted-prior-36` |
| N3-B2-A frozen graph | 36 | `accepted-prior-38` |

E1 executes all 138 unchanged assertions against its frozen graph. Current-core
behavioral execution retains its sole established historical source-hash
exclusion (137). Gate A's 36 assertions and declaration check run unchanged in
the complete frozen pre-B graph: they intentionally assert command/runtime
absence and the old Command union. This preserves historical observation, rather
than rewriting it to describe B. Current B source and allowed changes are checked
separately. No new F1/F2 exclusions were introduced. Every runner's exact arguments,
order, guard/materialization paths, stdout/stderr, scalar exit and summary are
saved immediately. Runner success is separate from assertion success.

### Statistics and actual readers

All 47 frozen cases execute through actual production History conversion,
`statisticsCompletions`, `prepareStatistics` and `aggregateStatistics`, comparing
whole aggregates in UTC, Europe/Stockholm and America/New_York. Applicable
post-Save reopen/recomplete/delete states are compared at captured clocks that
include the newly committed work. In each zone one malformed-raw case makes the
actual legacy mutation helper throw; that post-mutation comparison is explicitly
unavailable, retained as such, and never called a successful empty total. Its
base projection is still included. Separate tests retain unavailable-evidence
behavior. Typed ordering/dedup, dates, owners and unrelated metrics are preserved.

The four exact original older-reader assertions remain unchanged and pass through
actual frozen-reader execution; all six inherited schema-1/B1/B2 reader cases also
pass. `accepted-reader-results.json` records their original labels and raw runs.
Eight additional executions use actual newly encoded version-2 output against
frozen schema-1, B1, B2 and pre-B2-private readers: each rejects normal and
lowered-manifest fixtures without fallback or writes. The twelve unchanged A
proposed-golden executions remain historical contract evidence, distinguished
from B's implemented codec outputs. No mocked replacement reader was used.

### Process interruption and faults

There are **26 distinct new parent-terminated child scenarios** in the final B
run. Each delegates actual private-v4 publication or actual HubDataStore save,
retains executable/arguments/stage, PID/host/token, exit/signal and exact lock
bytes/hash, and proves death/lock identity before guarded movement inside Temp.
The complete index is `accepted-interruptions.json`; raw process evidence is
retained. These are separate from injected exceptions, cancellation,
reconstruction and acknowledgement-loss tests.

| # | Mode | Parent-termination boundary |
|---:|---|---|
| 1 | `fence` | `fence:afterFlush` |
| 2 | `fence` | `beforeRecurrenceFenceWrite` |
| 3 | `import` | `atomic:afterImportReconciliation` |
| 4 | `save` | `atomic:afterStructure` |
| 5 | `save` | `atomic:beforeGuards` |
| 6 | `save` | `beforeAcknowledgement` |
| 7 | `save` | `atomic:afterCompletion` |
| 8 | `save` | `beforeManifestReplace` |
| 9 | `save` | `afterContentStaging` |
| 10 | `save` | `afterGenerationPublish` |
| 11 | `rich` | `beforeAcknowledgement` |
| 12 | `reopen` | `afterManifestCommit` |
| 13 | `save` | `beforeReceiptPersistence` |
| 14 | `rich` | `afterManifestCommit` |
| 15 | `save` | `before-coherent-return` |
| 16 | `reopen` | `beforeAcknowledgement` |
| 17 | `reopen` | `atomic:afterContent` |
| 18 | `save` | `afterManifestCommit` |
| 19 | `save` | `atomic:afterRetirement` |
| 20 | `rich` | `atomic:afterContent` |
| 21 | `save` | `atomic:afterContent` |
| 22 | `save` | `atomic:afterReceiptValidation` |
| 23 | `save` | `atomic:beforeEffects` |
| 24 | `oath-failure` | `after-failed-save-reopen` |
| 25 | `oath-save` | `before-oath-publication` |
| 26 | `oath-save` | `after-oath-publication` |

Prepublication exceptions cover guards, structure, content, retirement,
events/bindings, effects, import reconciliation, receipts, serialization,
temporary writes/flush, generation and pointer publication. Postpublication
uncertainty is reconciled against authoritative state and exact replay. Tests
cover direct/retained-handle admission, forged/revoked tickets, lost scope/lease,
all-write fallback across restart, exact replay/conflict, original successor
retention, actual Oath failed-save/reopen/reconstruction and unavailable refresh.
No absent receipt authorizes replacement identities or successor regeneration.

### Development failures retained

Five failed development run records are retained, followed by passing corrected
runs: (1) 72 checks/12 failures from synchronous-throw assertion wrappers;
(2) nine checks/seven failures from synthetic Step-parent fields, an actual legacy
malformed-row mutation and missing reopen authority; (3) 77 checks/16 failures
from the new test request builder not recognizing rich creation; (4) twelve
checks/two failures from a child registry seam and an invalid recurrence-on-import
fixture; (5) a declaration rerun omitted the explicit compiler path and failed
module resolution before compilation. The corrected compiler invocation reports
zero diagnostics. An earlier console Unicode reporting exception is recorded
separately from its already-saved child exit/log. Patch-context/PowerShell parsing
errors made no source edits. A mixed import publication-index defect and old
createMany classification issue found during review were fixed within the approved
sources and covered by passing tests. No old assertion was lowered, skipped or
replaced to obtain a pass. See `development-failures.json` and raw logs.

### Bounded performance

Observed 0/8/32-Step timings compare ordinary creation, rich creation and Save,
recording authoritative load/admission, candidate/validation, serialization and
publication. A separate controlled hold measures actual shared-queue wait to
native load (1.2593 ms in this run). These are bounded synthetic observations,
not production benchmarks or acceptance thresholds; validation was not weakened.

## Protected state and production comparisons

Final sequential comparisons retain two independent protected-file drifts:
`.obsidian/plugins/hub-project-menu/data.json` and `.obsidian/workspace.json`.
Both before/current exact bytes and hashes are saved privately. No restoration
or actor attribution was performed. Plugin changes are confined to four
focus/workspace-state keys; 27 of 31 top-level components, including all 178
History rows, six checks, task/Oath/Strict/device/planning state, remain unchanged.
All baseline protected Markdown and all nonallowlisted source/fixture/report bytes
remain unchanged. No file was missing and no live native pointer/generation/
fence/lock artifact appeared outside backups. The detailed scan records prevent
a claim of full protected-byte identity despite concurrent drift.

Baseline and final builds ran only beneath guarded OS Temp. All **twelve staged
assets match byte for byte**, including Oath/Strict assets. Main/Atlas factory IDs
and counts remain **168/24**. Installed twelve asset bytes are unchanged. There
is exactly one Legacy Task Service construction and no native/atomic package
reference in production startup. No bundle installation or host reload occurred.

## Sealing and limits

The private evidence package includes the request, exact allowlists/originals,
predecessor verification, frozen graphs/vectors, 107-row coverage index, reviewed
outputs/hashes, all commands/logs/exits including failures, actual child/lock
records, source/protected comparisons and staged builds. Assembly and per-member
SHA256/ZIP verification occur in Temp, followed by copying to the new backup and
re-verifying the full ZIP and internal inventory. The outer `SEAL.json` records
the final ZIP hash/counts; historical archives are not overwritten.

Claims cover tested cooperative local transactions and process interruption.
They do not establish real-vault native authority, production Task Editor adoption,
hosted rich reads, Inbox/Quick Add coordination, live Phase consistency, durable
Oath enrollment/outcome atomicity, automatic unsaved-latch recovery, existing-root
upgrade, compound recurrence generation, migration, Git synchronization,
whole-directory rollback detection, power-loss/cloud rollback safety, hostile
writer protection, distributed uniqueness or atomic N1-B consumption.

The [N3-C handoff](../services/TASK-SERVICE-PHASE-N3-C.md) records remaining
coordination and private editor-read work. It does not authorize that phase.
**STOP FOR USER REVIEW. Do not begin N3-C.**
