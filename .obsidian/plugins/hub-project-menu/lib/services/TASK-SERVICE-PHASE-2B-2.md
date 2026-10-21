# Phase 2B-2 handoff — read consumers only

Historical handoff from Phase 2B-1. Its Search gates have been completed in
Phase 2B-2A; see the [completion report](../tests/context-search-verification.md).
The remaining proposed scope is [Daily Brief reads and read-only Schedule
data](TASK-SERVICE-PHASE-2B-2B.md). It has not been implemented or authorized here.

Phase 2B-1 added an inactive application boundary. No current caller is connected.
The next authorized scope should select one **legacy-only** facade instance in the
host, adapt read consumers incrementally and preserve every current writer. Native
core packaging/activation, Add/Edit integration, Inbox/Oath writes, clear completed,
locations, mounted task policy and Git transport remain outside that scope.

## Safest first consumer

Start with **ContextSearchService task enumeration and task reveal** in
`lib/services/context-search.js`, keeping file/folder/planning search unchanged.
It is isolated from task mutation, already has task cache invalidation and has a
focused ranking/scope/navigation suite. Do not start with the Roadmap assignment
UI: its read results also feed `ProjectPlanningService.link` writes using old paths
and line-keyed source structures. Do not start with Home's combined task/Oath actions.

Before connecting Search, complete these contract gates:

1. Preserve per-row diagnostics. Current facade queries fail closed if any indexed
   task is ambiguous or unresolved; current Search can still show valid rows and
   copied rows. Design/test a typed diagnostic result retaining safe display data
   and blocked reveal/edit for the invalid row. Avoid dropping all other results.
2. Preserve legacy continuation text as explicit display/search evidence if the
   current Dataview `task.text` includes it. DTO title currently uses the editor's
   first line. Do not turn that prose into task description or rename a task.
3. Change the task snapshot path to await application reads and handle cancellation
   without stale results winning. Current `snapshot(dv)` is synchronous; `search`
   is already asynchronous. Measure duplicate source reads/global ID scans with
   real host-sized synthetic fixtures before generalizing to dashboards.
4. Keep `taskWorkspaces`, `ownerOf`, `inScope`, ranking and `contextLabel` behavior
   exact, including all four Resources, global/project scope, aliases and paths.
   Use the existing workspace registry for labels and owner refs for identity.
   Owner queries must not filter inactive Projects merely because Home does.
5. Replace universal task `result.path` navigation with `resolveReveal(handle)`.
   Only the legacy branch may call `openProjectNote` for the resolved source.
   Preserve missing/stale source guards. A future native result uses `native-task`,
   with no fabricated source path. Folder/planning reveal remains unchanged.

Use one facade subscription for the task cache, replacing only Search's direct
task-data subscription. Invalidation means clear the task cache and requery after
the completed import; it is not a transaction acknowledgment. Retain file/note cache
vault events and Phase/planning subscriptions. Register disposal with the current
component lifecycle and release the adapter on host shutdown. Add no second backend
watcher per Search surface. Keep labels and registry changes refreshing context.

Search gates: existing `context-search.test.js` plus duplicate/no-ID/continuation
fixtures, moved/deleted notes, private/shared/Resource ownership, mount non-expansion,
all Resource scopes, same ranking/order, stale async cancellation, reveal failures,
single watcher and disposal. No task metadata/note write may occur while searching.

## Subsequent order and gates

| Order / consumer | Preserve and adapt | Required regression gate |
| --- | --- | --- |
| 2. Daily Brief candidate reads / target validation | Existing active-Project/Resource availability, 06:00/DST boundary, future/completed filtering, saved target locators, Step references, snapshot immutability and Oath `canOpen` checks. Keep saved artifacts unchanged. Explicitly convert old target handles without allocating IDs. | `daily-brief*.test.js`, saved target reload/rename/delete, no-ID/Step ambiguity and identical recommendation evidence; no task writes |
| 3. Read-only Schedule data | Use `workspace` query policy and Project-only rendering; preserve current dates/grouping/order and exclusions. Existing actions stay on their current writer bridge. Keep legacy source mapping at that action boundary until Phase 2B-3. | Task views/workspace fixtures, date presentation, Resource early-return, physical root and System/Templates exclusions, keyboard/reveal behavior |
| 4. Project/Resource Tasks read layer | Use `panel` policy, not Schedule's stricter `validLocation`. Preserve recursive physical-root tasks, dates, Steps, completion/Oath partitioning and existing render structure. Do not expand Resource mounts. Do not feed native DTOs into old writers. | `task-data.test.js` actual dashboard loaders, task grouping/Steps, renamed/deleted notes, visibility and read-to-existing-action compatibility fixtures; targeted browser smoke before connecting |
| 5. Roadmap reads only | Physical Project tasks with matching owner; owner-qualified Phase identity. Preserve the legacy source reference needed by current assignment writes outside DTO display. A reviewed temporary conversion seam must not allocate IDs or duplicate records. | `project-planning.test.js`, Phase link/unlink rollback/revisions, `roadmap-milestones.test.js`, copied IDs and no new progress events |
| 6. Home task enumeration | Preserve existing Resource-first owner resolution, mutable owner objects/root renames, active Project selection, selected Resource filters and task/Oath partition. Define explicit tested Home policy before replacing the loader. | Actual Home loader tests, status changes, global/selected scopes, ordering, no-ID rows, mounted task eligibility unchanged; task-only refresh preserves other Home sections |
| 7. History/Statistics read projections | Extend history DTO evidence before connection: existing project name/status/path/root and immutable recorded context may be required. Current normalized facts intentionally do not reproduce every historical display field. Never recompute past ownership from a live view. | `task-history`, `task-progress`, `statistics`, report snapshot tests; event dedup/counts, reopen removal, Step/task separation, cleared/deleted history and unchanged past reports |
| 8. Oath task resolution reads | Audit separately even though read-only: source resolution affects eligibility, locks and fulfillment. Preserve Project-only task selection and current Resource behavior, shared-folder navigation policy, continued/strict mode and parent completion. Do not derive eligibility from a mount. | All `oath*.test.js`, `oath-shared-resources.test.js`, saved task handles after reload, ambiguous/no-ID targets, locks and exact fulfillment behavior |

Some read/render consumers immediately invoke old task mutations. Phase 2B-2 must
preserve that existing bridge without pretending normalized DTOs are raw Dataview
tasks. Any new conversion seam needs explicit tests and scope review; defer a
consumer if a clean read-only change would also require replacing its writes.

## Phase 2B-3 concerns retained

The ordinary editor stays unchanged until its live card, focus, dates, pending Step
drafts, exact action timestamps and explicit Save/Cancel semantics can use opaque
tokens. ID-less saves need an inside-the-mutation source guard or an explicitly
reviewed identity strategy. General checkbox completion must preserve the optional
Tasks-plugin toggle/recurrence bridge; this adapter currently delegates editor-save
completion only. Step reordering needs actual verified legacy support or remains
unsupported. Relocation and clear completed need their complete existing workflows.

Inbox must keep its persisted creation identity and receipt coordination. The
facade's current create returns a source result rather than guessing the created
task. A reviewed result seam is needed before changing Inbox expectations. Native
operation receipts, backend authority cutover, source-free UI navigation, core
packaging and shared native sync require later explicit implementation approvals.

No work described in this handoff was connected during Phase 2B-1.
