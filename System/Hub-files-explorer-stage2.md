# Files explorer — Stage 2 implementation and validation

Stage 1 was manually accepted before Stage 2 began. Stage 2 is implemented and
the plugin bundle and native utility package have been rebuilt. The full
[approved staged plan](Hub-files-explorer-stage1.md) remains the acceptance
reference. Restart Obsidian fully after installing this build: reloading a
renderer alone can leave another window using the previous main-process utility.

## Delivered behavior

- Full-view F2 and Rename use an inline editor. Navigation survives confirmation,
  cancellation, sorting and Full/Note transitions. Existing Note actions remain.
- Cut/Copy/Paste uses an internal clipboard shared by Itacan instances and windows
  for the same vault. Text-input shortcuts stay native. Recursive copies include
  binary files and never duplicate native tasks. Collisions do not overwrite.
- Files uses physical workspace inventory for root restrictions, including nested
  workspaces. Existing root files retain rename-in-place, move-out and deletion.
  Workspace identities, linked reference roots and internal stores are protected.
- One explicit service coordinates Itacan rename, move, trash and recursive copy.
  Dashboard menus, keyboard deletion, drag/drop, Move-to, plugin note actions,
  Project/Resource renaming and migration, and Inbox movement/compensation use it.
  The existing strong Project deletion guard and top-level folder bookkeeping
  remain. A partially renamed Project card points to its surviving file.
- Atomic task migration queries stored tasks, including completed tasks and
  tombstones. Canonical and compatibility Resource references and descendants
  migrate. Physical destination ownership determines cross-workspace transfers;
  only associated tasks move. Destination-compatible phases survive.
- Task/step identities, content, dates, creation metadata, completion and original
  History attribution survive. Migration creates no completion or successor events.
  Whole-workspace renames retain workspace identity.
- Recurrence rules, series/occurrence identities, ordinals, spent-successor markers
  and template step identities survive. Only required template owner/location/phase
  fields change. The latest occurrence controls future tasks. Past-only transfers
  retain unrelated current occurrences; retained templates use surviving ancestors.
- Trashed notes/folders reassign linked tasks and recurrence templates to surviving
  parents in their original workspace, or `null` root context. Tasks are preserved.
  Recreating/restoring the old path does not reattach them. Project deletion keeps
  its unavailable owner and tasks.
- Batches normalize overlapping selections, preflight destinations, and finish each
  subtree's filesystem/task pair before the next. Failures identify completed,
  pending and untouched entries. Cut clears only successful entries.
- Outbox pages count operation sequences, retaining all owner rows at a transfer
  boundary. The explicit continuation flag is consumed by the task presentation
  model. Both old and destination panels receive complete bulk snapshots.

## Durable coordination and recovery

The additive SQLite version 5 migration introduces one device-local
`pending_file_operations` table. Its single active record stores immutable intent,
reference mappings, content hashes, filesystem progress and reconciliation status.
Raw paths stay out of synchronized task payloads and receipts. Completed database
migrations use the existing idempotent operation receipts and notifications.

Preparation, progress and task migration use short transactions in the existing
task queue. No SQL transaction spans a filesystem await. The existing shared host
admits one Itacan filesystem actor across windows. Affected task/location/series
edits are blocked while pending; unrelated edits remain available. Incoming sync
transactions that would change affected state are deferred without overwriting it;
unrelated incoming changes and the existing synchronization protocol remain intact.

Restart recovery prefers completing verified task reconciliation. Lost replies use
the original operation ID. Copies resume only against recorded matching evidence.
Uncertain trash calls are never repeated, and competing data is never overwritten
or removed. Partial deletion migrates removed contexts while preserving survivors.
Operations cannot report success before their task migration commits.

An unknown operation with unchanged source evidence remains unresolved until review;
path existence alone does not prove an API call settled. The **File operation
recovery** command displays retained paths and status. It can recheck evidence,
retain a verified original source, explicitly accept an inspected moved destination,
or retain a partial copy and end that attempt. These review choices never remove
files. Changed destination contents require an explicit review choice. Trash is
never automatically restored.

Inbox keeps its capture identity and hash checks. Forward/reverse attempts derive
stable filesystem IDs from that identity. Compensation verifies original task and
series revisions and rejects intervening assignments or edits that make reversal
unsafe, preserving current files and metadata for review.

## Validation evidence

All destructive, interruption and recovery tests used virtual fixtures, temporary
SQLite databases, synthetic repositories or fresh disposable Obsidian vaults.
No destructive test or recovery experiment ran against the user's live data.
The running user application was not reloaded by the tests.

| Area | Result |
| --- | --- |
| Native task, recurrence, presentation, process and sync regressions | 125/125 passed in the final complete run, including cross-Project phases and two-device filesystem migration/recurrence. |
| Filesystem coordinator | 18 passed: ownership/aliases, nested/binary copy, identity/root protection, reopen/replay, partial deletion/batches, competing data, cut retention, workspace rename/deletion, Inbox compensation, explicit review, and post-commit refresh failure. |
| Database migration and admission | Version 4 → 5 preserves existing rows/receipts; reopen, stable IDs, single active admission, and shared-window clipboard/actor checks pass. |
| Process interruption | Owned utility processes killed after intent/progress persistence and before/after task commit recover with one outcome, no extra History, intact SQLite integrity and foreign keys. |
| Real Obsidian | Actual native Menu/submenu and keyboard handling; creation/collision/Escape; F2; Copy/Cut/Paste; task-safe trash; cross-owner completed-task transfer and History; whole-workspace rename; recovery review and cleanup; partial Project rename; Full/Note transitions; two themes, two palettes and two zooms pass. |
| Capture | 56 workflow tests, 13 browser checks and four genuine Obsidian capture/restart/file/promotion phases pass. Capture fixtures retain their isolated task adapters; coordinator/native-task interaction is tested separately. |
| Compatibility | Presets, workspace-state integration, Project deletion guard, explorer model/menus, icons and all 10 source/bundle lifecycle checks pass. Note rail geometry passes at three viewport sizes and all rail states. |
| Appearance | 4,752 Default/Light computed-value checks and 540 palette geometry comparisons pass. |
| Packaging | `build.js` ships both new coordination files with the existing explicit native utility closure. Bundle syntax/load and whitespace checks pass. |

Primary commands, run from the vault root:

```powershell
node --test ItacanTaskCore/vnext/tests/*.test.cjs
node --test .obsidian/plugins/hub-project-menu/lib/tests/file-operations.test.cjs
node --test .obsidian/plugins/hub-project-menu/lib/tests/capture-workflows.test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/run-workspace-explorer-obsidian-test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/run-capture-obsidian-test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/run-browser-test.js workspace-explorer
node .obsidian/plugins/hub-project-menu/lib/tests/run-browser-test.js inbox
node .obsidian/plugins/hub-project-menu/lib/tests/run-browser-test.js note-rail-geometry
node .obsidian/plugins/hub-project-menu/lib/tests/run-color-system.cjs color-system
node .obsidian/plugins/hub-project-menu/lib/tests/run-color-system.cjs color-palettes
node .obsidian/plugins/hub-project-menu/build.js
```

The final native explorer evidence is retained in temporary
`hub-explorer-runtime-PYPjSG`; capture evidence uses `hub-capture-runtime-CCOLmG`.
Those artifacts contain only synthetic vault/profile data.

## Boundaries and remaining validation limits

- Native Obsidian commands and third-party plugins bypassing the explicit service
  do not receive these task-coordination guarantees. Existing listeners refresh
  views/availability; they do not infer ownership transfers or deletion mappings.
  No new global FileManager/Vault interception was introduced. The pre-existing
  Project deletion guard still protects its native trash entry point.
- Git sharing transport and protocol are unchanged. A private/shared recurring
  series can commit locally while the existing privacy guard blocks publication,
  including a wider Project stream. The status UI reports that limitation and
  retains local ownership, recurrence and History.
- Filesystem-wide batch atomicity, general undo, stable filesystem identities,
  OS file clipboard integration and external-directory import remain outside the
  approved scope. Date sorting still uses alphabetical folder fallback.
- Ambiguous recovery can require inspecting retained source/destination data.
  A deliberately unresolved record blocks conflicting Itacan filesystem work;
  it is never presented as a completed operation.
- Native validation ran on Windows. Physical macOS acceptance remains separate.
  Desktop reveal was verified through a spied capability-checked bridge without
  launching an external file-manager window. File-opening routes retain their
  existing callbacks; tests do not replace their surface with a real note tab.
- Stage 1's legacy full-page layout/navigation fixture gaps and independent
  task-location-picker cleanup assertion remain documented in its checkpoint.
  Schedule/Roadmap whole-page behavior is not newly certified by those fixtures;
  workspace persistence, explorer transitions and Note geometry are covered above.

Pre-existing unrelated capture/task-location work and user edits were preserved.
No commit, push or Git sharing configuration change was made.
