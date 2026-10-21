# Phase 2B-2F-2 — committed Oath resolution complete

Active resolution now uses the shared facade's separate resolveOathWork operation.
See the [implementation/verification report](../tests/oath-committed-verification.md)
and [next consolidated-audit handoff](TASK-SERVICE-PHASE-2B-CONSOLIDATED-AUDIT.md).
Enrollment, readNewWork, bridge creation and fulfillment/outcome writers remain
unchanged. Candidate discovery retains its independent indexed policy.

The user's resume specification corrected the historical handoff below:
awaitingIndex originates in the current enrollment/readNewWork flow and supports
both newly allocated IDs and source-existing IDs with a stale ID-less index.
It is not limited to newly allocated IDs. The proposed allocation-provenance
patch was rejected and was not applied. No new provenance/schema was introduced.

The original pre-implementation handoff is retained below as historical evidence;
its allocation-only descriptions are superseded by that explicit correction.

## Historical pre-implementation handoff

Proposed future work only. Phase 2B-2F-1 migrated setup candidates and selection;
it deliberately left the complete services/oath.js file and all writers unchanged.
No implementation of active commitment resolution is authorized by this handoff.

## Current boundaries to inspect

Paths are plugin-relative; recheck line numbers before implementation.

| Source | Actual authority / future boundary |
| --- | --- |
| services/oath.js:74 tasks | Global indexed parents; used by both take() and active resolveWork(), never replace indiscriminately |
| :81 resolveWorkspace / :89 ownsTask | Stable workspace identity/dashboard existence; active resolution passes eligible:false to preserve inactive-workspace semantics; physical root/dashboard ownership |
| :92 workspaceTasks / :100 setupRequirements / :111 validateDraft | Original synchronous setup/enrollment validation, intentionally still legacy-backed |
| :167 start | Startup hydration/recovery, independent task-data invalidation and timestamp-only display clock |
| :190 resolveWork | Persisted parent IDs matched globally; uniqueness and identityConflict checks; current indexed locator then fresh source read/ID lookup/snapshot/metadata |
| :199 awaitingIndex bridge | Only freshly enrolled IDs from this writer can bridge a delayed Dataview import; do not extend to arbitrary missing/copied IDs |
| :221 refresh / :232 reconcile | Serialized/coalesced reads, activation, fulfillment and Strict ownership checks; refresh(false) does not enumerate tasks on ordinary countdown ticks |
| :247 captureFulfilment / :252 markFulfilled | Pending fulfillment latch survives failed persistence and later reopen; recorded fulfillment is monotonic |
| :271 take | Existing final validation, global copied-parent-ID check, source mutation queue, ID allocation and persisted commitment |
| :339 readNewWork | Fresh post-enrollment source hydration and original selected-task metadata; feeds awaitingIndex |
| :351 finish / :365 end | Current/history persistence, outcome guard, fullscreen release and Standard/Strict exit restrictions |
| :397 activation / :416 recovery / :423 destroy | Strict host ownership, interrupted restart handling, wake behavior, timers and listeners |
| ui/oath-tasks.js | Active/pinned/missing task presentation and reused display clock, unchanged |
| plugin.js / services/task-editor.js / data-store.js | Existing task/Oath notifications, metadata/persistence and unload ownership, unchanged |

Persistent commitments remain `{id,path,text}`. ID is authoritative; path/text are
historical snapshots. ResolveWork uses the current unique indexed ID and source
path/title; a renamed task is not rejected solely because its committed text is old.
Source moves within the committed physical workspace may resolve; moves to another
owner fail ownsTask. Missing/ambiguous sources remain explicit unavailable work,
not replacement tasks selected by title. Include completed parents in resolution.

## Reuse guarantees, not candidate authority

The current dedicated `queryStructured({policy:"oath-candidates",workspace,
validation:"indexed"})` provides only open parents in an eligible setup workspace.
It preserves original physical root scope, full indexed text, temporary source
keys, dates/times and parent/Step evidence. Global parent IDs copied anywhere,
including on a Step, are excluded; duplicated Step IDs alone do not change the
existing parent commitment policy. Generic display rules for ID-less same-title
tasks are intentionally stronger and are not reused for setup enrollment.

This candidate policy is **unsuitable for committed hydration**: it excludes
completed/unavailable/ambiguous parents, has no fresh source proof and requires
Active Projects. Candidate UI's exact path/line/title reference checks preserve
uncommitted selection intent; they must not become frozen-title matching for a
stable active commitment. Do not treat a candidate DTO as an authoritative active
task, or reuse ephemeral taskServiceHandle/selection keys as commitment IDs.

Audit a separate portable committed-resolution boundary accepting stable parent
IDs plus committed WorkspaceRef and returning explicit resolved/missing/ambiguous/
awaiting-index evidence. It needs global parent+Step identity context, fresh source
checks, physical-owner validation, current metadata and completed/nested-Step
evidence. Existing resolveSavedTarget/resolveLegacyAction may reject title drift or
unassigned locators more strictly than the original active resolver; compare their
actual source before selecting/reusing either. No title-only or History fallback.

Preserve enrollment's separate original tasks()/source-validation path until an
explicit future writer/read boundary is authorized. Do not broaden mounted Resource
eligibility: navigation allowance through current Resource folder IDs does not make
a Resource task a Project commitment. Preserve private/Itacan/Hub sharing policy.

## Coupled writer and lifecycle invariants

- ID-less parent IDs are allocated only by explicit take() inside the original
  task mutation queue. Candidate reads allocate none. Commitments remain ordered
  and deduplicated as before; accepted source/persistence work outlives read disposal.
- awaitingIndex is populated only from readNewWork for those just-allocated IDs.
  Match its existing path/line/title evidence against an ID-less indexed parent;
  copied, nested or otherwise missing IDs receive no fabricated bridge.
- Fulfillment observes parent completion and existing time/Step semantics. Preserve
  the latch, failed-save retry, exactly-once Oath outcomes and cross-device histories.
- Standard/Strict opt-in, preflight, whitelist/Resource permissions, scheduled
  activation, fullscreen/dock/host watchdog and exit restrictions remain separate.
- Startup/wake, interruption, workspace deletion and missing Strict host ownership
  must retain existing recovery semantics. Do not silently relock a desktop.
- Keep one shared facade, owned sessions, no raw per-consumer global watchers and
  no source scan on display ticks. Active service disposal and candidate disposal
  must remain independent, including multiple windows/devices.

## Required original/current evidence before implementation

Freeze current resolveWork/readNewWork outputs and source/metadata/current/history
state. Compare active and scheduled Standard/Strict Oaths across stable IDs,
changed titles, renamed/moved/deleted notes, same-title tasks, parent/Step ID copies,
ID-less enrollment and delayed imports, completed/reopened parents/nested Steps,
workspace status/root/removal, missing dashboards and Resource mount boundaries.

Use deterministic promises for startup hydration, fresh-source races, late imports,
refresh coalescing, close/unload, multiple consumers/windows/devices and accepted
setup writes. Verify exactly-once fulfillment/outcome persistence, failed saves,
reopen after a latched fulfillment and interruption/wake recovery. Compare actual
active/pinned/missing UI, focus, timers and source actions separately from setup.

Rerun 333 focused checks (51 candidate + prior 282), 34 regression files, 48 safe
Strict/recovery checks, both declarations, 66 inactive-core tests and targeted
Oath/setup/History/Statistics/previous-consumer browsers. Preserve inherited divider
and heading-icon assertions. Use a fresh baseline, verified original backups,
exact factory allowlist and disposable build. Do not lock the user's desktop or
activate a live Strict session; mocked safe host tests do not prove native enforcement.

**STOP FOR REVIEW. Do not implement Phase 2B-2F-2, writers, native activation,
Git synchronization or task locations under this handoff.**
