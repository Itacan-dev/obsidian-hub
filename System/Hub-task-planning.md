# Tasks to Do expansion — 19 September 2026

## Usage

- Reload the Hub plugin once after this update.
- Click a task description or badge to open **Edit task**. The checkbox still checks/unchecks the Markdown source directly. The breadcrumb opens the source note.
- **Should** and **Must** are optional. Click the selected choice again, or **Clear**, to remove the classification. An unclassified task displays a neutral gray **TO DO** badge.
- **Start (From)** and **Due** use native date inputs. Due cannot precede From. Dates are optional; no Until, Planned, or Oath fields were added.
- Steps are indented Markdown checkboxes. The editor can add, change, check, and remove them. The list shows their progress under the parent; Steps never appear as separate scheduled tasks.
- Use **+ Add task** on either dashboard for text plus a destination note. The native **Hub Project Menu: Insert task at cursor** command converts the current Markdown line to a task (preserving its text/list indentation). Assign a hotkey through Obsidian's normal Hotkeys settings. The **Add task** command also opens the lightweight creator.
- Future and completed tasks are collapsed into counts at the bottom of the panel. Expand them to reveal their rows. Clear applies to completed tasks even while collapsed.

## Persistence and source safety

Markdown remains authoritative for task text, completion, Steps, and location. Unannotated tasks are neither migrated nor assigned metadata. Quick creation writes an ordinary `- [ ] Task` with no marker or metadata.

When optional metadata is first saved, the parent line receives a hidden HTML comment: `<!-- hub-task:UUID -->`. This links to a small `taskMetadata[UUID]` record in the existing Hub plugin `data.json`, saved through `HubDataStore` and included in normal Hub backups. Each record contains only `necessity: null | "should" | "must"`, `fromDate`, and `dueDate`. There is no task database or separate Step store. Removing every metadata value removes the record; the invisible ID remains stable. Existing native Obsidian block IDs are preserved.

The shared Dataview discovery service strips Hub IDs from display text, normalizes current note paths, recognizes subordinate checkboxes, and joins parent tasks with metadata. Both dashboards use the same temporal sorting: overdue first, then ascending Due, then undated; ties use Must, Should, unclassified, and existing source order. Future tasks are partitioned out before sorting. Local-day changes refresh the panels while they remain mounted.

The editor reads the current source, retains the source file object across renames, and checks the entire task block before writing with `vault.process`. Source edits, changed Steps, and another modal's newer metadata are protected from stale saves. If metadata persistence fails, the source write is reverted only if the note still exactly matches that write. Checkboxes continue to use the installed Tasks plugin API when available, with ordinary Markdown checkbox toggling as a fallback.

Delete and Clear remove the parent and its indented Steps/content together. Completion history remains; its surviving source positions account for removed Step lines. Parent completion is independent of Step completion.

## Movement and other limits

- **Location is read-only in this editor.** Move tasks using Obsidian/Markdown. Moving the complete marked task preserves its metadata across notes; note/folder renames work without changing IDs.
- A copied annotated task also copies its ID. Discovery detects duplicates across the vault and withholds shared metadata. The editor asks you to remove the hidden `hub-task` comment from the **copy** in source mode, then reopen it. A fresh ID is generated if you assign metadata to that copy. Unannotated copies work normally.
- Preserve the hidden comment when manually rewriting a task if you want its metadata to follow. Removing it disconnects the old metadata. External Markdown deletion may leave a harmless unused metadata record; this pass intentionally does not add a vault-wide cleanup/migration system.
- The editor changes the main task line and recognized Steps, preserving other indented Markdown content. Edit prose continuations, nesting, and task movement in the source note. Removing a Step also removes its nested descendants. Existing identical unannotated task descriptions still depend on their source line until metadata gives them IDs; uncertain lookups are rejected.
- Dataview remains the discovery/indexing dependency. New or changed source content appears in other mounted views after its Dataview import. No arbitrary indexing delay is used.
- Basic task creation rejects a destination with an unfinished code fence or Properties block so the new checkbox is not silently inserted inside it.

## Modified files

Paths below are relative to `.obsidian/plugins/hub-project-menu/`, except the dashboard/report paths:

| File | Purpose |
| --- | --- |
| `lib/domain/task-planning.js` (new) | Metadata validation, ordering, safe task/Step block edits, creation |
| `lib/domain/tasks.js` | Hidden identity handling and source mutation compatibility |
| `lib/services/task-data.js` | Shared parent/Step discovery, metadata joins, duplicate IDs, date refresh |
| `lib/services/task-editor.js` (new) | Source/metadata persistence and failure recovery |
| `lib/ui/task-editor.js` (new) | Native Edit task and lightweight Add task modals |
| `lib/ui/tasks.js` | Badges, explicit dates, Step progress, edit access, collapsed groups, Add task |
| `plugin.js` | Shared service bridges, commands, checkbox fallback, Step-aware Clear |
| `styles.css` | Shared rows, compact rail layout, modal styling using Hub tokens |
| `main.js` | Rebuilt distributable, 38 bundled modules |
| `lib/tests/task-planning.test.js` (new) | Scheduling, Steps, identities, persistence, rollback, source safety |
| `lib/tests/task-planning.html` (new) | Actual row/modal interaction and responsive layout checks |
| `lib/tests/task-history.test.js` | Fallback completion, Step-aware Clear, history offsets, metadata cleanup |
| `System/Dashboards/Home/view.js` | Shared grouping, creation, active count, task identities |
| `System/Dashboards/Project/view.js` | Same integration for Workspace and Resource views |
| `System/Hub-task-planning.md` (this file) | Usage, design, checks, and remaining limits |

## Verification

Build succeeded. Node checks passed for tasks, task mutations, task planning, task history, task discovery/data subscriptions, plugin/dashboard loading, shared domain rules, and atomic data-store integration.

Isolated headless Edge checks passed for:

- Existing checkbox regression: top/middle/bottom across Home, Project, Resource; source writes, repeat toggles, and a refreshed model during a pending write.
- Existing inline task regression: add above/below, source editing/deletion, cancellation, Markdown rendering, and component disposal.
- New planning/editor fixture: actual Home/Workspace/Resource row functions and shared UI modules; date-first ordering, equal badge widths, aligned text, future/completed expansion, explicit overdue dates, Step progress, independent checkbox/editor/source actions, a 330px rail without horizontal overflow, modal Save/Cancel/Escape, classification clearing, date inputs, Steps, deletion, and quick creation.

The broader test run also reported three failures in unaffected areas: the backlog fixture lacks `preparedNoteRails.prepare`; the card-image fixture's root mock lacks `contains`; and the typography audit rejects existing `font-size: inherit` in heatmap navigation. These were not changed as part of task planning. New task CSS uses the existing semantic font tokens.

Browser fixtures exercise real Hub code with mocked Obsidian host APIs. This does not claim live testing in the user's running Obsidian session; the plugin was not forcibly reloaded.
