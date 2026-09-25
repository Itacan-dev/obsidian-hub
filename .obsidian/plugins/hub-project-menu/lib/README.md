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
