# Files explorer — Stage 1 checkpoint and retained Stage 2 plan

Status: Stage 1 was implemented, manually tested, and approved. This document
preserves that intermediate checkpoint and the complete approved Stage 2 plan.
Stage 2 implementation and current boundaries are recorded in
[the Stage 2 report](Hub-files-explorer-stage2.md). The temporary risks below
refer to the Stage 1 checkpoint.

## Stage 1 behavior

- Full view has an explicit physical workspace root, initially expanded, with
  folders only in its navigation tree. Linked Resources remain separate labeled
  references to their original paths. The dashboard note remains excluded;
  ordinary legacy root files remain visible in the right pane.
- Tree clicks navigate without toggling disclosure. Disclosure changes only
  expansion. Right-pane clicks select; double-clicks activate. Breadcrumbs,
  folder selection, focus, and existing file-opening callbacks stay synchronized.
- The Files heading is retained. Three evenly spaced icon buttons sit opposite
  the breadcrumbs above one continuous divider. The internal split supports
  pointer and keyboard resizing, independently of the Note rail.
- Both creation buttons target the opened directory. Draft names are edited in
  temporary right-pane rows. Enter creates and selects without opening; Escape
  and unconfirmed blur cancel without creating a filesystem object. Duplicate
  names retain an inline error. New folders are revealed in the sorted tree.
- Actual workspace roots accept folders, not new notes or imported/moved files.
  Existing root files can still be opened, renamed in place, moved out, or
  deleted. An attached Resource subfolder is not treated as a physical root.
- One workspace setting controls sorting from headers and the Sort by menu.
  Name ascending is the new default; valid legacy preferences are read once.
  Folders precede files, and use alphabetical ascending fallback for date sorts.
  All local sibling folders, including Meta, participate in Full-view sorting.
- Plain/modifier/range selection, pane-scoped select-all, right-click selection,
  navigation keys, and Ctrl/Cmd+Shift+N are supported. Switching panes clears the
  previous operation selection. Editing controls keep normal text shortcuts.
- Full-view menus use Itacan-owned native Menu instances without file-menu
  contributions. They retain supported opening, rename, move, trash, reveal,
  path-copy, and detach callbacks. Existing immediate file duplication remains
  as “Make a copy” during Stage 1; it cannot create another root-level file.
- Note view retains its mixed tree, search, single-click file opening,
  row/disclosure expansion, active-file indication, legacy menus/creation,
  manual ordering with Meta first, and full/half/closed sidebar layout.

Full-view state uses `fullExplorer.sort` and `fullExplorer.treeWidth` in the
existing workspace-root UI record. Existing `currentPath`, expansion, legacy
fields, snapshots, and separate manual ordering remain compatible.

## Temporary limitations and data-integrity boundary

**Rename, move, and delete still use their previous filesystem semantics. They
can invalidate path-derived native task associations. Stage 1 does not repair
those associations, transfer task ownership, or reassign tasks after deletion.**

Rename retains the existing optional QuickAdd prompt dependency. F2 and file
Cut/Copy/Paste await Stage 2. Full view consumes those deferred shortcuts and
points to available context-menu actions so they cannot accidentally invoke
commands for an unrelated active Obsidian note. Text-input shortcuts are intact.

Clipboard commands are absent from the menus until implemented. Folder copying
is not added in Stage 1. “Make a copy” retains immediate file duplication and
will be superseded by the agreed clipboard behavior in Stage 2.

The user’s pre-existing capture/task-location edits were preserved. No task
schema, task engine, synchronization implementation, or Git sharing protocol was
changed for Stage 1. Destructive acceptance operations use synthetic notes in
temporary vaults, never live user data. The live application is not reloaded by
the tests.

## Validation

New or extended checks:

- `workspace-explorer.test.js`: legacy model compatibility, complete explicit
  Full root, dashboard exclusion, canonical linked Resources, sorting and paths.
- `workspace-explorer-menu.test.js`: menu/submenu dismissal, capabilities,
  existing operation callbacks, error reporting, and no inherited hook.
- `workspace-explorer` browser fixture: Full/Note transitions, selection,
  navigation, creation/cancellation/errors, root import/drop rejection, sorting,
  presets, splitter, linked Resource edits/detach, narrow layouts, and preserved
  Note manual ordering.
- `note-rail-geometry`: all Workspace file/Last File/Preset/startup routes in
  full/half/closed states at 900×600, 1100×850, and 1600×1000. The standalone
  fixture now explicitly requests its intended Note presentation.
- `run-workspace-explorer-obsidian-test.cjs`: current-source build in a hidden
  installed-Obsidian runtime with a disposable vault, profile, and task-storage
  directory. It exercises genuine pointer/keyboard events, native menus and
  submenus, creation, cancellation, select-all, synthetic trash, Ctrl+Shift+N,
  splitter dragging, mode transitions, cleanup, two themes, two palette states,
  case-collision byte preservation, and 100%/125% zoom. Before writing anything,
  it asserts that the active vault is the launcher's disposable directory.
  The outer test surface is a native Modal; its close action
  is guarded so Escape can be tested without dismissing the test harness.

Additional passing regressions: presets, workspace-state integration, Project
deletion guard, icon resolution, 56 capture-workflow cases, the Inbox browser
fixture, 4,752 Default/Light color checks, and 540 palette geometry comparisons.
The rebuilt source and shipped bundle also pass all eight plugin load/shutdown
checks. The existing installed bundle is rebuilt; reload Obsidian to load it.

Known validation limits:

- Legacy `full-view-layout` and `project-full-polish` HTML fixtures reference a
  missing `task-workspace-browser.js`. The legacy `workspace-navigation` fixture
  also does not complete with the current checkout. Those obsolete full-page
  fixtures were not rewritten as part of this explorer change.
- The independent `task-location-polish` fixture fails its listener-cleanup
  assertion. Its picker source and fixture were not changed by this task.
- Desktop reveal is capability-checked and its bridge invocation is spied in
  native acceptance. Tests intentionally do not launch an external file-manager
  window. Opening callbacks are exercised without replacing the test surface
  with a real note tab; the existing navigation implementation is reused.
- Whole-page Schedule/Roadmap behavior is not newly certified by the missing
  legacy fixtures. Workspace persistence/navigation contracts and the explorer’s
  Full/Note presentation transitions are covered separately.

Run from the vault root:

```powershell
node .obsidian/plugins/hub-project-menu/lib/tests/workspace-explorer.test.js
node .obsidian/plugins/hub-project-menu/lib/tests/workspace-explorer-menu.test.js
node .obsidian/plugins/hub-project-menu/lib/tests/run-browser-test.js workspace-explorer
node .obsidian/plugins/hub-project-menu/lib/tests/run-browser-test.js note-rail-geometry
node .obsidian/plugins/hub-project-menu/lib/tests/run-workspace-explorer-obsidian-test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/run-color-system.cjs color-system
node .obsidian/plugins/hub-project-menu/lib/tests/run-color-system.cjs color-palettes
```

## Retained Stage 2 architecture and requirements

Stage 2 was subsequently authorized and implemented. The approved architecture
and requirements are retained below as the acceptance reference; internal
checkpoints do not require separate approvals.

1. **Fix local outbox paging.** Never split owner rows with the same operation
   sequence. Add explicit continuation and verify both owner panels catch up.
2. **Introduce one explicit Itacan operation service** for rename, move, trash,
   and recursive copy. Dashboard, Full/Note menu, keyboard, drag/drop, Project /
   Resource rename, and Inbox forward/compensation callers use it. Reuse Obsidian
   APIs, deletion protection, and top-level bookkeeping. No global API wrapping.
3. **Persist only the required coordination intent.** Add one small local
   pending-operation table beside the existing task database, with immutable IDs,
   paths/owners/reference mappings, evidence, progress, and unresolved outcome.
   This covers crashes between filesystem success and task commit; existing
   operation receipts cover database replay. Reuse the host, queue, and receipts;
   do not build a generic scheduler or repurpose Git synchronization tables.
4. **Coordinate each normalized subtree.** Preflight the whole batch, persist
   intent, perform and verify the filesystem change, atomically reconcile tasks
   and series, then acknowledge completion. No SQL transaction spans filesystem
   waits. Serialize admission across Itacan windows and gate only conflicting
   tasks/contexts/series. Incoming reconciliation must not overwrite pending work.
5. **Migrate authoritative stored references.** Handle canonical and compatibility
   Resource IDs, all affected descendants, completed tasks and tombstones.
   Cross-workspace moves transfer only associated tasks to the destination owner.
   Preserve task/step IDs, content, dates, completion, creation metadata and
   original history attribution; clear only incompatible phases. Whole-workspace
   renames retain workspace identity. Emit no completion events during migration.
6. **Preserve recurrence.** Keep series identity, rules, ordinals, successor
   markers, template content and template step IDs. Repair context/owner/phase
   fields only. The latest occurrence controls future ownership; past-only moves
   do not transfer unrelated current occurrences. Retained template locations
   leaving their owner use its nearest surviving ancestor. Retries, reopening,
   and completion must not duplicate successors.
7. **Reassign after deletion.** Notes move to their surviving parent; folders and
   descendants move to the nearest surviving ancestor in the same workspace,
   falling back to `null` workspace-root context. Preserve owners, tasks, steps,
   recurrence and history. Restoring/recreating the path does not reattach tasks.
   Project-level workspace removal preserves its unavailable task owner.
8. **Recover conservatively.** Abort pre-filesystem cancellations without task
   changes. After filesystem success, prefer forward reconciliation. Retry the
   original receipt; never repeat uncertain destructive operations or infer
   identity from path existence alone. Preserve competing/partial data and report
   unresolved operations. Do not restore trash automatically. Inbox compensation
   also reconciles references and must refuse unsafe stale reversals.
9. **Complete conventional operations.** Add coordinated F2 and internal per-vault
   Cut/Copy/Paste for files/folders. Preserve binary bytes; never duplicate native
   tasks. Reject collisions, traversal, self-moves and protected identities.
   Finish each disjoint subtree before the next and report completed/pending/
   untouched items on failure. Retain partial copies rather than deleting them.
10. **Preserve Git boundaries.** Keep the existing sharing implementation and
    protocol. Incompatible private/shared recurring series remain locally valid
    while the existing privacy guard blocks publication, possibly for the wider
    Project stream. Show that limitation without altering ownership or history.

Validate SQLite upgrade/reopen, mapping completeness, recurrence invariants,
single execution through every Itacan caller, lost replies, interruption at each
boundary, partial batches, competing windows/data, restart and duplicate replay
in isolated fixtures/disposable vaults. Re-run Full/Note, capture, palette,
navigation, and synchronization regressions before final release acceptance.

Operations outside Itacan’s service remain outside its coordination guarantee.
Vault listeners refresh availability but must not guess migrations from partial
evidence. OS file clipboard integration, external directory import, arbitrary
offline filesystem reconciliation, general undo/stable-filesystem-identity
infrastructure, and Git protocol redesign remain outside the approved scope.
