# Phase 2B-2F — candidate discovery complete, active resolution deferred

Phase 2B-2F-1 now connects uncommitted setup candidates to the existing shared
facade. See the [candidate implementation report](../tests/oath-candidate-verification.md)
and the precise [Phase 2B-2F-2 handoff](TASK-SERVICE-PHASE-2B-2F-2.md). The entire
Oath service remains byte-identical, including workspaceTasks/setupRequirements,
validateDraft/take, tasks/resolveWork/readNewWork, fulfillment, clocks and recovery.
The new indexed policy is for setup parent selection only. Native storage stays
inactive. The pre-implementation audit below is retained as historical context.

No Oath enumeration, enrollment, source resolution, fulfillment, history, locks
or writers changed in the recorded History or Statistics phases. This is a proposed future
audit; no implementation is authorized here.

Keep the detailed [existing Oath audit](TASK-SERVICE-PHASE-2B-2E-2F.md) as context.
Actual plugin-relative entry points remain `lib/services/oath.js:74 tasks()`,
`:92 workspaceTasks()`, `:100 setupRequirements()`, subscription/clock startup
around `:178`, `:192 resolveWork()` and setup around `:290`. Reinspect source lines.

Candidate eligibility differs from Home Tasks presentation. Preserve physical
workspace ownership, Standard/Strict restrictions, Resource mount permissions,
source-independent committed IDs, missing/copied references and the explicit
`awaitingIndex` evidence for IDs assigned by Oath's own existing setup writer.
Do not make mounted Resource tasks eligible for Project Oaths. Keep task reads
off countdown display ticks and preserve interruption/wake/navigation behavior.

Possible reviewable subdivisions: candidate discovery/evidence first; committed
task hydration/lifecycle second. Do not partially switch authority within an
active commitment or use recorded History as a substitute for live committed-task
validation. History events and persistent Oath commitments have different IDs and
retention. Completion/reopen/clear writers and fulfillment persistence remain
unchanged until separately authorized.

Required original/current fixtures: Standard/Strict setup, copied parent/Step IDs,
ID-less enrollment, delayed imports, title/source changes, cross-owner moves,
deleted/missing tasks, completion/reopen/nested Steps, exactly-once fulfillment,
Resource permissions, multiple windows/device state, plugin close and accepted
cleanup writes. Capture source, metadata, Oath history and UI/lock state. Use fresh
baselines/backups and deterministic promise races, then all existing regressions.

The new `queryHistory({projection:"recorded"})` is a source-independent historical
read API. It does **not** resolve Oath tasks or alter Oath's live task authority.
Statistics input migration is complete in [Phase 2B-2E-2](TASK-SERVICE-PHASE-2B-2E-2.md).

## Recommended Phase 2B-2F-1 — candidate discovery only

Reinspect actual source lines before implementation. Current service boundaries:

| Source | Existing behavior to preserve |
| --- | --- |
| oath.js:73 api/ready, :75 tasks | Dataview readiness; global parent-task enumeration, not History |
| :76 workspaces, :81 resolveWorkspace | Active Projects only for setup; all available Resources; current workspace identity/dashboard existence |
| :89 ownsTask, :93 workspaceTasks | Physical root/dashboard ownership, open nonconflicting parents; active and future task groups |
| :101 setupRequirements, :111 validateDraft | Selected candidates still available; index-not-ready feedback; same Standard/Strict setup eligibility |
| ui/oath.js:142 picker, :378 setup rendering | Existing taskKey selection, grouping, keyboard focus and retained selections |
| domain/oath-workspace.js:13 taskKey | Existing hidden ID or temporary path:line:text selection key; not a persistent commitment ID |
| oath.js:118 projectWorkspaceForPath | Navigation allowance for current shared Resource folder IDs; NOT task eligibility in a Project Oath |

Audit all four Resources, private/Itacan/Hub Projects, source moves, missing
dashboards, status changes, delayed imports, copied parent/Step IDs and ID-less
selections. Inspect taskGroups' parent/Step treatment and candidate display before
mapping it: do not introduce separately committable Steps merely because the facade
supports Step handles. Preserve current nested-Step progress and parent commitment.

Use one shared facade with a narrow read projection/policy if existing structured
queries cannot exactly reproduce physical eligibility. Current queryVisible oath
policy is deliberately unsupported; Home's presentation projection is unsuitable.
No setup ID allocation occurs during candidate reading. The unchanged take() writer
still performs fresh source validation and all enrollment writes.

## Recommended Phase 2B-2F-2 — committed resolution and hydration

| Source | Existing behavior to preserve |
| --- | --- |
| oath.js:167 start | Startup/fullscreen/Strict recovery, existing task-data notification and one display clock |
| :192 resolveWork | Global ID uniqueness, copied-ID rejection, source reread per note, physical ownership and current metadata hydration |
| :201 awaitingIndex bridge | Only IDs freshly assigned by THIS setup writer may temporarily bridge delayed imports; missing/copied/nested IDs otherwise unavailable |
| :221 refresh / :232 reconcile | Serialized/coalesced needsRead, no whole-vault query on ordinary countdown ticks |
| :247 captureFulfilment / :252 markFulfilled | Fulfillment latch survives failed save and subsequent uncheck; no duplicate fulfillment |
| :275 take / :297 mutation queue | Existing source validation, ID-less parent ID allocation, copied IDs, dedup, commitment persistence and error recovery |
| :339 readNewWork | Post-enrollment source hydration, awaited IDs, metadata and unavailable entries |
| :351 finish / :365 outcome | Recorded outcomes, current/history persistence and Standard/Strict restrictions |
| :397 activation / :416 recovery / :423 destroy | Strict host ownership, wake/interruption handling, no silent relock on startup, timers/listeners cleanup |

Committed refs persist {id,path,text}; path/title are snapshots, stable IDs drive
resolution. Do not replace that with History event IDs or title-only matching.
Audit source rename/move/delete, changed title, copied/missing IDs, parent/nested
Step completion/reopen, startup hydration, workspace deletion, Standard/Strict
time/task fulfillment, interrupted/wake recovery, persistence failure, multiple
windows and per-device buckets. Preserve exactly-once outcomes and cross-device
Oath History. Keep clock display independent of source reads; dispose only owned
sessions, never the shared facade or accepted setup mutations.

## Can these phases safely be separated?

Provisionally yes, only at the uncommitted selection boundary. F-1 can replace
candidate reads while take(), setupRequirements' eligibility meaning, global
copied-ID checks and source-validation/enrollment remain authoritative. F-2 can
then change committed reads without changing writers. Both must use identical
physical eligibility/identity rules; prove that using shared original-source
fixtures across the enrollment boundary before installing F-1.

Do not migrate global tasks() indiscriminately in F-1: take() and resolveWork()
both use it. A candidate-only projection must not partially change active Oath
authority. If a portable selection cannot safely reach the unchanged enrollment
writer, or eligibility parity cannot be proven, stop and recommend one combined
candidate-to-commitment read boundary for review. Do not implement a silent mix
of contradictory policies within an active commitment.

Fresh future gates: freeze original candidate/hydration outputs and UI, deterministic
read/import/source races, source/metadata/Oath-history hashes, exactly-once writer
regressions, Standard/Strict/Resource browser checks, all previous consumers,
both declarations, inactive core, precise factory allowlist, verified backups
and staged installation without automatic reload. No implementation is authorized
by this handoff.

**STOP FOR REVIEW — Phase 2B-2F-1 is complete; committed resolution is not migrated.**
