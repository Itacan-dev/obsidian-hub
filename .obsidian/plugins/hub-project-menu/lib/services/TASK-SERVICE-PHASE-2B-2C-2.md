# Phase 2B-2C-2 handoff: Roadmap-associated task reads and Phase selection

Proposed work only. Phase 2B-2C-1 stops after Project/Resource Tasks panels.
Markdown remains authoritative; reuse the one existing `plugin.taskService` and
explicit legacy bridge. Do not activate native storage, migrate writers, change
Home or expand mounted Resource visibility.

## Exact entry points and current behavior

- `lib/services/project-planning.js:20`: `tasks(dv,id)` resolves an existing
  Project, calls `taskData.readWorkspace(dv,project)` and additionally filters
  by actual physical owner Project ID. Use structured **workspace** policy plus
  that owner check. The broader **panel** policy is inappropriate here.
- `lib/ui/planning-editor.js:35`: the Phase modal reads candidates synchronously.
  `key(task)` uses existing ID or `path:line`; current assignments initialize
  `selected`. The Add tasks fuzzy picker excludes conflicts and selected keys,
  labels candidates with current Phase names, and inserts the actual task reference.
- `planning-editor.js:40`: selected rows own Remove actions and keyboard focus
  restoration. Picker choice checks whether the owning Add button remains connected.
- `planning-editor.js:79`: Save derives assignments by comparing selected keys
  with each candidate's original Phase membership; it supplies the captured
  planning revision to `savePhase`. Modal controls lock while saving; errors
  retain the modal and draft; close is prevented while saving.
- `lib/ui/project-roadmap.js:273`: Roadmap subscribes to planning changes. Its
  main renderer draws planning records; the task enumeration dependency is the
  Phase editor, not an independent general Tasks list. Preserve timeline ranges,
  lanes, drag/reorder, labels, Milestone operations and geometry.

## Transaction and source boundaries: preserve these writers

`ProjectPlanningService.transaction():28` enters the existing task mutation
queue, resolves the Project again and checks the captured planning revision.
It retains original planning/metadata objects and a source-write rollback list,
runs the update, increments revision and saves planning plus task metadata.
Failure restores both original objects and calls `taskEditor.rollback(writes)`;
successful persistence alone triggers `changed(id)` and existing invalidation.

`link():51` rejects copied identities, reads a fresh existing editor snapshot,
checks actual Project ownership and checks that the task's Phase still matches
the reference supplied by the caller. It assigns a hidden ID only during this
explicit existing write when needed. Identity-only source changes validate the
entire source block, preserve line endings and use the normal attributed writer.
Current metadata is copied and Phase is changed without completion/history events.

`savePhase():74` validates values, preserves Phase identity/order and applies
explicit assignment deltas in that same transaction. `remove():98` handles its
own existing metadata cleanup. Do not replace these transactions or route them
through facade mutation APIs as part of read integration.

## Selection invariant

**Missing, stale, failed or ambiguous reads are never a Remove decision.**

Keep a separate baseline of existing assignments, current selected references,
explicit user additions/removals and refreshed candidate availability. Do not
reinitialize `selected` or compute implicit unassignments from a shortened query.
Retain unavailable selected rows with their original identity/evidence and a
restrained explanation; make explicit removal distinct from resolution failure.
If a selected source cannot be safely resolved, retain the draft and reject or
defer that affected save with a clear error. Do not silently omit the assignment,
pick a same-title replacement, or turn an uncertain refresh into a successful
destructive transaction. Existing title/Step/copy/source guards remain required.

## Available read capabilities and async design gates

`queryStructured({workspace,policy:"workspace",validation:"indexed"})` provides
full indexed display text separate from canonical title, physical owner, nullable
start/due times, Phase, Steps/ancestry and primitive legacy source references.
`legacyReadTask`, `legacyActionTask`, `legacyActionRequest` and `handleFor` provide
explicit legacy compatibility; source validation is performed at action time.
An index projection is not a revision, editable snapshot or transaction receipt.
Never pass a generic DTO, native handle or manufactured Markdown path into `link`.

Use consumer-owned `TaskReadSession` with cancellation for modal close, Project
switch, picker close and superseded invalidations. Do not share a panel's session
or close the shared facade. Preserve title/date/description drafts, picker text,
selection, focus and scroll during refresh. Protect a save from refresh replacing
its selected evidence; validate revision and actual source again inside the
existing writer. Facade invalidations are notifications of legacy refresh, not
native committed transactions. The panel-specific `task-panel-read.js` retains
immediate note edits for Tasks UI; do not import its broader policy or use its
temporary note reconciliation as planning authority.

## Required evidence before the next implementation

Capture actual old candidate identities, Phase memberships, labels/order and
modal DOM for private/inactive/shared Projects, including no-ID tasks, duplicate
IDs, nested Steps and Resource mounts. Verify System/Templates/hidden exclusions
match the existing planning policy and Resource tasks remain ineligible.

Exercise selected-task disappearance, rename, title change, copied identity,
Phase reassignment, unresolved index, failed query and recovery while selected;
late modal/picker reads; A/B Project switching; pending edits; explicit Remove
versus unavailable selection; simultaneous Phase editors and revision conflicts;
save during refresh; source/metadata failures and rollback failure. Compare actual
Markdown, metadata, revision and history with the existing transaction for the
same explicit user intent. No read may allocate an ID or write metadata.

Retain and run `project-planning.test.js`, `roadmap-milestones.test.js`,
task association/removal, form/workflow, shared-store, Oath and previous facade /
Search / Daily Brief / Schedule / Tasks panel regressions. Use an independent
actual Phase-modal browser fixture and existing workflow fixture. Keep the broad
task-workspace inherited divider-alignment assertion unchanged; its later checks
do not execute when that assertion stops the runner. Benchmark large candidate
sets, verify source/bundle/data backups, stage and inspect exact factory changes,
install only verified artifacts and never reload Obsidian automatically.

**STOP: Roadmap/Phase-editor integration is not implemented.**
