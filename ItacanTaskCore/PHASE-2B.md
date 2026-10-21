# Phase 2B handoff — compatibility boundary, legacy authority

Phase 2A is inactive. Do not enable the JSON repository, migrate data, change UI,
introduce a location registry, synchronize Git packets or install a build as part
of the next compatibility pass unless separately authorized.

## Recommended next scope

Introduce a task application facade and a legacy Markdown adapter. Move producers
and consumers through that facade while preserving all current Markdown, shared
metadata, history and editing behavior. The native core is a tested destination;
it does not become active during facade adoption.

### API behavior to expose

- Get/query tasks by owner or visible workspace; stable opaque handles.
- Read an editable snapshot and save with conflict validation.
- Create, edit, associate, complete/reopen, archive/delete and clear completed tasks.
- Add/edit/reorder/delete/complete Steps with the parent snapshot/revision boundary.
- Query completion/history facts separately from current task lists.
- Subscribe to committed changes and resynchronize canonical data.
- Caller-owned operation IDs and deterministic retry/error results where the legacy
  backend can prove them; do not claim new crash atomicity for Markdown + metadata.

The native command contract is in `src/contracts.d.ts`. Do not force an exact UUID
wire contract onto legacy tasks lacking IDs by fabricating UUIDs from paths. Use
an explicit discriminated legacy handle/locator at the compatibility edge; native
handles contain canonical IDs. Preserve existing hidden IDs. Persistent allocation
and alias mapping for unidentified/noncanonical legacy tasks belongs to the reviewed
migration. Never fabricate native note paths to satisfy older consumers.

## Producer inventory

Paths below are relative to `.obsidian/plugins/hub-project-menu/` unless stated.
Line references were inspected during Phase 1 and rechecked for relevant 2A conventions.

| Producer | Entry points |
| --- | --- |
| Global and workspace Add/Edit | `lib/ui/task-editor.js:7`, `lib/services/task-editor.js:97,201` |
| Panel/task checkbox and inline above/below actions | `lib/ui/tasks.js:25,100,173`, `plugin.js:14094` |
| Step editing/completion | `lib/ui/task-form.js:98`, `lib/ui/task-steps.js:8` |
| Completed-task clearing | `plugin.js:14129` |
| Phase assignment/removal | `lib/services/project-planning.js:28,51,94` |
| Quick Add and Inbox promotion | `lib/ui/quick-add.js:160`, `lib/services/inbox.js:647` |
| Oath enrollment identity writes | `lib/services/oath.js:296` |
| Insert Markdown task command | `plugin.js:12775` — retain ordinary Markdown behavior while legacy is authoritative; decide later native command treatment |

## Consumer inventory

| Consumer | Current direct dependency to remove behind the facade |
| --- | --- |
| Home | `System/Dashboards/Home/view.js:5441` page tasks and physical owner paths |
| Project/Resource Tasks | `System/Dashboards/Project/view.js:2815` Dataview/root query |
| Schedule | `lib/ui/task-workspace.js:102` paths, workspace reads and source opening |
| Roadmap | `lib/services/project-planning.js:15,20` paths/identity metadata |
| Standard/Strict Oath | `lib/services/oath.js:72,88,190` index readiness and note rereads |
| Search | `lib/services/context-search.js:32,126` indexed task path and note opening |
| Daily Brief | `lib/services/daily-brief.js:119,187` source existence/rereads |
| History/Statistics | `lib/services/statistics.js:8`, `lib/domain/statistics.js:54` completion facts |
| Reports | `lib/domain/report-context.js:16` immutable recorded evidence |

Keep Today's Focus's existing text/workspace semantics. Do not silently replace
it with mandatory native task links. Preserve the existing live form/card and
pending draft boundaries; no location UI redesign belongs to this facade pass.

## Preserve Git-shared Projects during compatibility work

The confirmed requirement is continuing native sharing for the existing Itacan and
Obsidian Hub Projects. While legacy remains authoritative, retain the existing
`lib/services/shared-projects.js` allowlist, local/shared effective metadata,
Markdown identity discovery, conflict detection and writes unchanged behind the
legacy adapter. Never replace that workflow with a device-private native file.

The eventual native sharing adapter should:

1. Resolve those two approved Projects to stable Project IDs and trusted
   `git-project` partition IDs; do not infer eligibility from a task view.
2. Exchange only explicit owner-scoped packets, not private local generations.
3. Persist common partition lineage so independent devices retain meaningful
   parent heads. Local store IDs/revisions are not collaboration clocks.
4. Validate packets against the trusted expected partition, schema and future
   Project location/Phase registry before applying any native command.
5. Preserve task/Step IDs and opaque completion event identities, with deduplication
   receipts at the future transport/application boundary.
6. Detect divergence and require an approved reconciliation policy. A Git textual
   merge of generation snapshots is never accepted as an automatic domain merge.

Pure packet decoding currently performs no writes. There is no native sync adapter,
merge engine, remote import, live allowlist discovery or automatic packet activation.
Resource-owned tasks are never exported through a shared Project mount. Private
Oath/session/history/capture data remains outside shared packets.

## Decisions before sharing implementation/native activation

- Canonical per-Project transport files, publication checkpoints and how remote
  partition heads enter a local transaction without duplicate local mutations.
- Concurrent edits/completions, delete-vs-edit, Step reorder and owner-transfer
  conflict policy; missing snapshot records alone must not resolve divergent deletes.
- Shared-to-private/resource transfer tombstones and revocation semantics; past
  collaborator copies cannot be retroactively made private by changing ownership.
- Portable Project folder/note identities and Phase resolution across collaborators.
- Whether any historical progress is approved for sharing beyond current completion
  IDs/state; private contextual history is excluded by default.
- Backups, receipt/history compaction and recovery diagnostics for production hosts.

These do not block a legacy-only compatibility facade. They must be resolved before
native sharing or cutover. Mounted Resource tasks may support Project Oath work
through optional context fields, but no fulfillment/attribution policy is implemented.

## Packaging and identity concerns

The existing custom plugin builder resolves local modules inside its own directory
and rejects escaping imports. The new package intentionally lives outside it and
was not bundled. A later packaging change must explicitly include the portable core
through a reviewed package/artifact boundary. Do not copy diverging implementations
or make a live absolute-path require as a shortcut. Phase 2B can adopt the facade
around current legacy code before native runtime packaging is needed.

Partition definitions are fixed when creating a foundation store. Future workspace
registration/deletion and atomic ownership-transfer protocols must be implemented
and tested before native activation. The current repository permits relocation
only among registered workspaces; it implements no filesystem lifecycle graph.

Measured 10,000-task JSON commits are hundreds of milliseconds. Do not put native
snapshot serialization on an interactive renderer path without measuring the host
integration. SQLite remains a future adapter option; 2A does not benchmark or
package it. The portable engine can be hosted in an Electron main/worker service.

## Regression gates before native activation

- Every producer goes through the selected facade; no mixed backend authority.
- Same live card, title autofocus, date behavior, Steps, Save/Cancel, failures/retry.
- Home/workspace/Schedule/Roadmap/Search/Oath/Inbox behavior and history counts agree.
- Legacy-only compatibility preserves current mounted task eligibility; changing
  it is a separate reviewed Phase 3/policy change, not a silent facade side effect.
- Shared local/Git metadata remains complete and private resources stay private.
- Future native mode removes Dataview/source-note requirements without fabricated paths.
- Migration inventory, backup/restore, field verification, commitment handoff and
  rollback are rehearsed before a single authority switch.
- Native failures never trigger fallback to active Markdown writers.

Stop Phase 2B for review after facade parity. Do not migrate or activate native
tasks merely because the compatibility boundary is complete.
