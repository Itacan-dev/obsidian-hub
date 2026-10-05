# Obsidian Hub modules

The Hub source is split into small CommonJS modules. Obsidian loads the
self-contained `main.js` artifact generated from `plugin.js` and `lib/` by
`build.js`.

- `config.js` owns stable registries and paths.
- `domain/` contains pure rules for activity, auditing, contexts, dates, files,
  focus, naming, progress, and tasks.
- `services/` contains schema-versioned atomic persistence and transition
  behavior behind narrow interfaces.
- `ui/` contains shared dashboard primitives used by Home and Project/Resource.

Keep vault and Obsidian API calls at the service boundary. Domain modules should
remain deterministic and independently testable. Add new behavior to the
smallest relevant module instead of expanding `main.js` or copying helpers into
dashboard views.

After changing `plugin.js` or a file under `lib/`, run `build.js` with Node and
reload the plugin in Obsidian. The builder has no package dependencies and only
bundles local modules reachable from `plugin.js`; built-in and `obsidian`
imports remain external.

`atlas/obsidian/` adapts the unchanged `AtlasCore/packages/core` engine. Its main
entry `native.js` owns one controller and exclusive repository per vault; it is
bundled as `atlas-native.cjs` for `electron.remote.require`. `webviewer.js` holds
native Document requests, `runtime.js` supplies trusted Core operations and
executes saved decisions, and `integration.js`/`ui.js` hold only descriptions,
drafts and native view associations. Core's CommonJS/declaration copy is generated
by `build-atlas.js`; source/artifact hashes prevent stale copies. Adapter/native
tests live under `atlas/tests`. See `System/Hub-atlas-architecture.md` and
`System/Hub-atlas-security.md` for the ownership and threat maps.

`tests/domain.test.js` covers pure rules, audit repairs, and persistence
ordering. `tests/data-store.integration.test.js` exercises atomic replacement,
external-write detection, and conflict-file discovery on the filesystem.
`tests/plugin-load.test.js` verifies the plugin entry point and both dashboard
scripts can still be loaded after a module change.

Navigation history is owned by services/navigation-history.js and its pure
domain/navigation-history.js helpers. Version 4 workspace state stores
workspaceHistory (canonical workspace IDs) and fileHistory (file path plus
canonical workspace ID) in the existing plugin data.json. Each MRU is bounded
to 500 entries. An entry without a file path represents the existing browser
Note-view association; restoration still uses the workspace's native layout.
Array presence marks the one-time migration from legacy last-file/workspace and
per-workspace note snapshots, including when the arrays become empty.

History resolution keeps dashboard context, filters Project state and delegates
Oath eligibility to oath.canOpen(reference, false). Only missing objects are
pruned; temporary access changes retain recency. Rename/delete hooks update all
contexts of a file. Run node lib/tests/navigation-history.test.js from the
plugin directory for the focused MRU regressions, alongside workspace-state,
Presets and Oath suites.

Daily reports use domain/report-context.js to select existing completion History,
Activity and daily focus by recorded workspace ID and local date. Each newly
saved workspace work-log entry adds a version-1 context snapshot with task
titles/completion timestamps, compact activity fields and that workspace's
focus. Past report edits retain this context; saving today's report refreshes it.
Workspace names come from the stored log. No source file is read to reconstruct
a historical task. Legacy entries fall back to available persisted History and
focus without a migration or writes on read.

The shared next-focus editor and pending-focus activation keep their existing
semantics. reportFocusByDate stores one copy of its items per report date so
activation/replacement cannot erase them. The daily renderer assigns items by
workspace ID and shows targets without a displayed report separately.

ui/daily-report.js owns reusable evidence and daily-report renderers plus a thin
native modal wrapper, using Hub Markdown and its lifecycle for historical text.
Report-bearing heatmap days open this view; its Edit progress action opens the
existing editor. Empty days keep their existing editor behavior. Run
lib/tests/daily-report.test.js and the daily-report browser fixture for snapshot,
legacy, scope, input and interaction coverage.

Statistics is opened only by the small Lucide `chart-no-axes-column` action in
Home's Progress header (verified in installed Obsidian 1.13.7's icon registry).
`ui/statistics.js` uses the native Modal and shared report-card/Hub controls;
`ui/statistics-charts.js` draws bounded SVG bins with hover/focus value tooltips and a screen-reader-only
data table. The compact modal is capped at 980px / 85vh; short lists size naturally,
and long lists scroll. Methodology help uses the verified Lucide circle-help icon
only for Oaths and Notes. Unassigned bars are muted without changing totals. Resize observers are disposed on rerender and close.

`services/statistics.js` reads one metadata/history snapshot per opening.
`domain/statistics.js` owns identities, local-calendar ranges and aggregation:
- Distribution and the donut sum raw Progress Report evaluations (0?4) by stable
  workspace ID and local report date. No Home Momentum normalization or Oath
  weighting applies. Reports are read through the canonical historical API.
- Project time and the Oath section use elapsed time from ended, actually
  started Oaths across devices, deduplicated by session ID. Broken sessions retain
  elapsed time. No time is inferred from edits. Active/scheduled sessions are not
  historical completed sessions. Durations are split at local range/bin boundaries.
- Oaths taken/fulfilled are the ended-session cohort whose start falls in the
  selected period; fulfillment follows the persisted fulfilled/broken state.
- Activity counts recorded Markdown creations/edits and task/Step completions;
  navigation, renames, project lifecycle events and attachments are excluded.
- Task/Step charts query the existing completion History, never current checkboxes
  or report snapshots. Unchecking removes the recorded completion; clearing does
  not add one.
- Notes are surviving workspace Markdown files, excluding dashboards, Meta,
  hidden paths and implementation metadata. Creation dates use file ctime, so
  deleted notes are not reconstructed. Total notes is current; average includes
  zero-creation calendar days and largest day remains daily even in weekly bins.
- Project activity includes Active, Future, Shelved and historically deleted
  projects, with state labels. Last active is all-time; time uses the range.
  Stable IDs resolve current names; unidentified legacy records stay Unassigned.

Ranges share local-calendar bins, capped at 105 bars (80 for long histories).
Three months is the default. Range results are cached within the modal; changing
filters does not reread the vault. All-time begins at the earliest available
work, Progress Report, ended Oath or surviving note creation record.

Run `node lib/tests/statistics.test.js` and
`node lib/tests/run-browser-test.js statistics` from the plugin folder, then
`node build.js`. The aggregation tests cover real check/uncheck/delete semantics,
cross-midnight and DST sessions, duplicate sessions, renamed/deleted workspaces,
all ranges, empty datasets and 100,000 records. The browser fixture covers the
real Progress action, all eight sections, range/local controls, chart keyboard
details, native close/Escape, long names/lists and 310–1000px modal widths.

Workspace Tasks uses `ui/task-workspace.js` with separate Upcoming, Calendar,
Timeline, All tasks and Resource hierarchy renderers. View state lives with the
Dataview container and survives warm frame rebuilds. The Files tree and sidebar
stay mounted; task navigation is hidden in the existing note rail. Searches,
filters, calendar ranges and sort order never write task metadata.

`domain/task-views.js` defines deterministic Project/Resource views and shared
date buckets. `task-data.readWorkspace` adds Resource tasks whose optional
`linkedProjectId` matches the Project without copying tasks or changing panel
queries. This optional metadata field preserves legacy task records. Project
selection permits active Projects; existing shelved links remain readable.

The shared Add/Edit form scopes Location to real workspace notes/folders.
Folder destinations create Tasks.md only when saving. Moves preserve the whole
Markdown task block and stable parent/Step IDs, rebind live completion checks,
and leave historical snapshots/timestamps untouched. Writes roll back only
while their exact content is still current. Search/filter rendering uses one
indexed task snapshot per refresh, not repeated Markdown parsing.

`ui/app-shortcuts.js` mounts existing launchers in the bottom shell and retains
Home/category shortcut selection and ordering. The group contracts within the
free span between the global controls and native status items.

Run `node lib/tests/task-workspace.test.js` for query/date/link/move/rollback
coverage and `node lib/tests/run-browser-test.js task-workspace` for the full
Project/Resource navigation, shared editor and checkbox flows, shortcut behavior,
and 1040/760/420px layouts. The browser fixture uses isolated in-memory notes;
it does not modify the live vault.

Workspace Files uses `ui/workspace-explorer.js` in both Full-view and the native
Note-view rail. `domain/workspace-explorer.js` projects existing vault objects
and root descriptors into one tree; shared roots retain their original Resource
paths. Search includes descendants and their ancestors without changing saved
disclosures. Only expanded branches mount rows, with group-scoped guide lines.
The Full-view contents pane uses the same nodes and existing file sort semantics;
folder timestamps remain unavailable rather than being inferred from children.

Explorer presentation lives in `System/Dashboards/Project/view.css`. The existing
rail still controls full/half/closed widths; both visible states retain search.
The dashboard retains native opening/split, multi-selection, menus, workspace
folder ordering, creation, import, moves, trash, and shared-resource detachment.

Note-view geometry is owned by the shared rail rules in `styles.css`. The full
width retains its responsive clamp, reduced by one `size-4-3` spacing unit; half
remains half of that width and closed remains a 32px handle. `mountNoteRail`
commits the initial canonical size without animating from native split sizes.
Native Markdown and prepared ItemViews share a zero-padding content wrapper;
otherwise Obsidian adds padding only to restored rails. The preview supplies one
`size-4-3` outer inset on each side and at the bottom. The existing flexible 7:3
grid divides the remaining height after navigation and the panel gap, with tree
and task lists scrolling independently. Guides use one uniform, neutral border.

Run `node lib/tests/run-browser-test.js note-rail-geometry` for native/prepared
entry-route parity, startup restoration, stale native dimensions, all rail states,
live resizing, equal bottom/side insets and panel geometry at multiple window sizes.

The existing per-workspace `folderUi` path map stores disclosures in `collapsed`,
sort settings per selected folder, and workspace search/selection in the workspace
root's existing `search`/`currentPath` fields. Preset capture/restore and path
rewriting use those same fields. Legacy panel entries remain readable, with no
schema change or migration. Selection is separate from expansion and the active
file; changing rail width does not rebuild either tree or state. `currentPath`
remembers the Full-view folder; Note-view highlights only its active file and
never overwrites that folder. Without a remembered folder, its contextual fallback
is the active file's parent. Remounts read scoped Last File history without opening
files or changing restored expansion. Both folder rows and disclosures toggle once.
`ui/icons.js` resolves canonical Lucide names before Obsidian's legacy aliases
(e.g. unprefixed `folder` otherwise resolves to `folder-open`); selected icons
retain their neutral color while the row carries the purple-tinted background,
without a left selection marker. Branch containers are transparent; only the
uniform guide border is painted. The shared search input stays transparent even
under native input-hover rules, with focus indicated by its enclosing field.

Run `node lib/tests/workspace-explorer.test.js` and
`node lib/tests/run-browser-test.js workspace-explorer`, then `node build.js`.
The browser fixture executes the actual dashboard folder integration against an
isolated vault. It covers local/shared/empty workspaces, canonical shared edits,
detachment, recursive filtering, keyboard and middle-click opening, sorting,
creation/rename/move/import/trash, presets, hierarchy guides, long/deep names,
and explorer/Tasks alignment across the three existing rail states. Native
Obsidian adoption and vault timing should still be checked after a reload.
