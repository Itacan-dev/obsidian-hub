# Milestone 1B-B — Native History and Statistics verification

Implemented as an inactive genuine-Obsidian rehearsal. Stop for user review. This is consumer integration, not production readiness, migration or a change to retained-request recovery.

## Delivered behavior and private contract

The existing authoritative repository queue accepts the fixed private request `{version:4, selection:"history", authorityId, owners}`. The host keeps original registry/identity context across its existing bounded capture attempts, verifies global owner/partition admission, root/lease/head and final observation acceptance, and returns an accepted stamp. The N0 general History capability remains unsupported.

The projection contains selected physical partitions, event/task/Step UUIDs, recorded titles, nullable completion time, owner-at-event and available recorded attribution, counting/reopening state, event origin, bounded creation-receipt reference/digest/index, import row representation/suppression evidence and current navigation availability. It validates creation-command targets and receipt snapshots; atomic events use the existing validated selected effect. Reopening needs the actual later reopening receipt/effect. It exposes no full receipt, command, original source envelope, continuation/body, Oath/device data or unrestricted repository state. Unproven historical appends fail closed.

No generation/manifest/codec, command, domain, completion-effect, receipt, publication or recovery format changed. All existing Statistics domain calculation bytes remain unchanged, including `prepareStatistics`, `aggregateStatistics` and `seriesFor`. Retention records remain unchanged and native receipts remain task-outcome authority.

## Provenance and accounting

- Legacy rows retain their observed order and original primitive ID types through the unchanged `queryHistory`, recorded-field adapter and `statisticsCompletions`. The supplier neither namespaces IDs nor performs its own ID deduplication. Existing truthy-ID deduplication therefore still precedes timestamp/date filtering.
- Published import evidence supplies exact capture row keys, full portable-value SHA256 digests and duplicate occurrence counts. Current legacy rows must match those counts. Raw legacy evidence is retained once; represented imported canonical events are not appended. Only the exact validated native suppression removes a represented raw occurrence from compatible inputs.
- Fresh counted native events contribute once, in the existing descending receipt-publication/index order. Recorded title/owner evidence supplies compatible inputs. Current registry names, note coordinates and task titles do not manufacture historical attribution. An absent recorded label stays absent; native presentation uses an explicit owner identity rather than inventing an old name.
- Native reopening excludes the exact uncounted activity according to existing E2/legacy semantics. Recompletion contributes its new event. Initial checked creation contributes its existing native event. Replay produces no event. Task/Step deletion retains counted activity and disables its native navigation.
- A fresh native UUID colliding with a legacy recorded event identity is unavailable rather than silently shadowed or rekeyed. Missing/changed/extra-identical import overlap is unavailable. There is no title/path matching, corrective History write, origin database or persistent mapping.

All 47 established compatibility vectors were exercised against actual published imports and accepted host reads. Observable complete prepared/range/workspace models match the actual existing legacy pipeline and durable E2 projection. The two unsupported relevant ID/owner vectors retain the existing recorded-reader unavailable disposition. Unsupported non-countable timestamp fields and malformed rows follow the unchanged recorded-input adapter; this does not claim that every malformed raw value is a valid Statistics input. Existing malformed-raw mutation limitations and frozen assertions were not changed.

## Read consistency, presentation and navigation

The completion supplier subscribes before capture and brackets native evidence with exact legacy observations and a generation counter. Relevant instability retries at most three times. This is an accepted pair of observations, not an atomic cross-store snapshot or a lease on future state.

Real commits, legacy changes and first unavailable/context notifications revoke consumers even during another demand. Read-generated storage bursts and repeated identical demand failures are coalesced while a capture is active, avoiding recursive refresh loops. Reads still revalidate and reject instability; missed advisory delivery is recovered by explicit refresh. Disposal prevents late acceptance and unsubscribes owned ports.

The optional supplier is consumed by the existing History reader, Statistics service and Statistics modal. Without injection, ordinary legacy behavior remains the default. Actual Home/Project History refresh/render functions retain their filters, pager, row activation and styling. Native rows navigate through owner-qualified UUIDs and a freshly revalidated existing Edit modal; no native path, line or legacy task ID is fabricated. Deleted, retired, nested, Phase-bound and recurrence targets have unavailable editing navigation under the existing rehearsal restrictions. Legacy note navigation is unchanged.

Valid explicit-null native completion times remain visible in an undated presentation labelled **Completion time unavailable**, without a clock or invented date. The unchanged Statistics calculations exclude invalid/null times. Native failure retains labelled previous History rows and revokes complete Statistics totals using the existing loading/error/Retry UI. It never returns an empty native feed as success or falls back to a legacy-only total.

## Executed acceptance

| Final selection | Result |
|---|---:|
| New projection, import accounting, Statistics, navigation, reconstruction/race checks | 74/74 |
| Existing History readers/writers, Statistics, import behavior/Statistics, snapshot/host/P1 read checks | 238/238 |
| Existing Home/panel plus M1B-A Home/Schedule/isolation selections | 36/36 |
| Focused existing import acknowledgement, validation, compatibility/fence reconstruction selection | 18/18 |
| Existing task-History and History status scripts | 2/2 test-runner file cases |
| Total final Node test-runner cases | 368/368 |
| New private History declaration runner | Zero diagnostics |
| Eight affected existing declaration runners | Zero diagnostics |
| Genuine Obsidian Home/Project History and Statistics | 12/12 |
| Unchanged genuine Obsidian Home/Schedule workflow | 15/15 |

The 74-case selection uses real repositories, native publication and import evidence. It covers initial checked creation; ordinary and atomic parent/Step completion; independent reopening/recompletion; mixed atomic import reopen/Step completion with exact publication index; deletion; null times; original attribution; typed IDs; all five complete range models; ambiguous overlap; wrong/missing creation receipts; context changes; unavailable authority; concurrent commit delivery; disposal; exact replay and bounded refresh notifications.

One focused actual child-process interruption pauses at `snapshot:beforeAcceptance`. The parent saves the exact original retained intent, command/arguments, PID, host, token, raw root files and lock bytes/hash; terminates and awaits the child; proves process death and identical lock/root bytes; then moves only that exact disposable lock inside its verified Temp root. Reconstruction confirms the original receipt, retains the original request, replays identically and produces no extra completion. Repeated test executions preserve their separate evidence. No broad historical crash archive was repeated.

The isolated Electron process obtains genuine Obsidian APIs through the existing minimal fixture bootstrap. It executes actual Home/Project History refresh/render functions and the actual StatisticsModal, including source-independent keyboard navigation to Edit, all five ranges/workspace filtering, invalidation/retry and outage behavior. It does not execute normal Itacan onload or install/load the production Itacan bundle. Synthetic non-task providers stay inert; no Oath/Inbox service runs. The Statistics screenshot was inspected for established dark/purple presentation. Hidden-window captures are not treated as proof of full pixel parity.

The immutable historical source-hash assertion has not been weakened, excluded differently or declared green against current source. Its known failure against changed current source versus success in its original verified frozen graph remains distinct. That unrelated historical runner was not rerun in this targeted gate.

## Failures retained

Early new-test failures used a nonexistent bindings getter and a copied closed runtime handle; fixtures now use authoritative bindings and the reconstructed runtime. Additional new vector assertions initially compared unrestricted raw carriers with allowlisted consumer inputs rather than the actual recorded-reader pipeline; complete model comparisons now use that unchanged pipeline. Each logical editor action gets its own form service, preserving the existing immutable pending-action rule.

A final-host timeout exposed redundant refresh work when read-generated storage notifications were forwarded immediately during other demands. Bounded coalescing was corrected in the new supplier, with targeted checks proving real commit delivery and repeated-failure suppression. Diagnostic host runs then completed all assertions but failed IPC serialization because the diagnostic array had an own function property; the report now returns a plain array copy. Failed outputs and disposable roots remain preserved. The final actual-host run has scalar exit zero and all 12 workflow assertions. No historical assertion was altered to obtain a pass.

## Exact files

Fourteen existing files changed:

```text
ItacanTaskCore/src/snapshot-read.js
ItacanTaskCore/src/snapshot-read.d.ts
ItacanTaskCore/src/contracts.d.ts
ItacanTaskCore/host/repository-host.js
ItacanTaskCore/host/index.d.ts
ItacanTaskCore/integration/project-runtime.js
ItacanTaskCore/integration/project-runtime.d.ts
ItacanTaskCore/integration/tests/run-obsidian.cjs
ItacanTaskCore/integration/tests/obsidian-host.cjs
.obsidian/plugins/hub-project-menu/lib/services/task-history-read.js
.obsidian/plugins/hub-project-menu/lib/services/statistics.js
.obsidian/plugins/hub-project-menu/lib/ui/statistics.js
System/Dashboards/Home/view.js
System/Dashboards/Project/view.js
```

Seventeen files added:

```text
ItacanTaskCore/src/history-read.js
ItacanTaskCore/src/history-read.d.ts
ItacanTaskCore/host/history-read.js
ItacanTaskCore/host/history-read.d.ts
ItacanTaskCore/integration/completion-feed.js
ItacanTaskCore/integration/completion-feed.d.ts
ItacanTaskCore/integration/tests/history-support.cjs
ItacanTaskCore/integration/tests/history-read.test.cjs
ItacanTaskCore/integration/tests/history-accounting.test.cjs
ItacanTaskCore/integration/tests/history-statistics.test.cjs
ItacanTaskCore/integration/tests/history-navigation.test.cjs
ItacanTaskCore/integration/tests/history-reconstruction.test.cjs
ItacanTaskCore/integration/tests/history-crash-worker.cjs
ItacanTaskCore/integration/tests/history-obsidian.cjs
ItacanTaskCore/integration/tests/history-types.fixture.ts
ItacanTaskCore/integration/tests/history-typecheck.cjs
.obsidian/plugins/hub-project-menu/lib/tests/native-history-statistics-m1-b-b-verification.md
```

## Preservation and staged build

The fresh baseline saved 14 exact originals, 781 dirty-status entries and 1,789 source/protected/installed hashes. Mutable execution, process profiles, native roots and builds remained under guarded OS Temp. No live native pointer/generation/lock/retention artifacts were found in the workspace outside backups.

All twelve installed production assets match their baseline hashes. Baseline/candidate builds have identical factory IDs and counts: main 171, Atlas 24. Exactly `lib/services/task-history-read.js`, `lib/services/statistics.js` and `lib/ui/statistics.js` differ as staged plugin factories; all other staged assets match. The startup factory is unchanged, retains one Legacy Task Service construction and imports no native integration package. Dashboard changes are limited to the two approved History presentation sources. No installed bundle was replaced.

Observed drift in `.obsidian/plugins/hub-project-menu/data.json`, `.obsidian/workspace.json` and `Projects/Itacan/Itacan.md` is preserved privately without restoration or actor attribution. Application-field comparison shows unchanged completedTaskHistory (182 rows), completedTaskChecks, taskMetadata, Inbox, Oath/device and planning values; the observed application changes are hubState and workspaceMode. Other inventoried nonallowlisted files match. Full protected-byte identity is therefore not claimed. No live task/History writer or real native authority was opened by this gate.

Raw arguments, stdout/stderr, scalar exits, test failures, exact originals, child death/lock evidence, build/factory comparison, protected hashes and observed drift are retained in:

`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-m1bb-rq9t2z28`

Final genuine History/Statistics evidence:

`C:\Users\El_Baraka 2025\AppData\Local\Temp\itacan-real-host-SdtRAX\evidence`

No large verification ZIP was created. The implementation remains explicitly injected and inactive. Operator recovery, migration, source retirement, production activation and C2/C3/C4 remain outside this gate. No unresolved counted-evidence contradiction remains within the tested scope; ambiguous or unsupported evidence remains unavailable. Stop for user review after 1B-B.
