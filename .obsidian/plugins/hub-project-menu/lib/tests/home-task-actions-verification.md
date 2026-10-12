# Home task actions verification (2026-10-12)

Production changes:

- `System/Dashboards/Home/view.js`: remove Home's header Clear, pass its existing
  visible-completed scope and confirmation through the completed-group menu,
  guard duplicate operations, and supply the complete Today/Edit/+ Task content
  to the shared intrinsic sizing rule.
- `lib/ui/tasks.js`: optional native Obsidian Menu on completed-group headings,
  Context Menu key and Shift+F10 entry, keyboard focus restoration, stale-menu
  cleanup, visible write failures, and the existing creator behind Lucide + Task.
- `styles.css`: Task icon/gap and Home right alignment; overlaid intrinsic sizing
  labels preserve the icon's 15px size when copied to the other buttons.
- `main.js`: rebuild the distributed plugin. No clearing-service, dashboard-grid
  or heatmap-geometry production changes.

Tests changed/added: `home-task-actions.html`, `home-task-actions-browser.js`,
`task-history.test.js`, `run-browser-test.js` (native modifier/function/menu keys),
and `workspace-controls-browser.js` (labelled Task expectations).

Passing checks:

- `home-task-actions`: 48 width/font/zoom scenarios per primary DPR (1.5 and 2).
  Widths: 360, 600, 900, 1040, 1366, 1800 CSS px. Zoom: 80%, 100%, 125%, 150%.
  Root fonts: 17px and 21px. Window sizes: 1707x960 at DPR 1.5 and 960x540 at DPR 2.
  Equal widths are checked against unsized intrinsic content including padding,
  while height stays 23px, with header content alignment and equal panel tracks.
  The test also covers right-click, native Tab/Shift+F10/ContextMenu/Enter/Escape,
  accessible names without sizing-copy text, cancel/confirm, duplicate prevention,
  project/resource request metadata, error/retry, disclosure/edit/checkbox,
  rerender/teardown cleanup and Task creation options in all five panel variants.
- `task-history.test.js`: actual plugin clearing with pending/cancelled/accepted
  confirmation; cancellation performs no writes, unrelated open/completed tasks
  survive, History persists, and report/rating/activity data is retained.
- `task-progress.test.js`: actual mutation/clear paths preserve parent/Step History,
  report snapshots, timestamps, ownership, reload and midnight behavior.
- `task-mutations.test.js`, `task-editor` browser fixture and `clear-buttons`
  (both primary DPRs): existing task mutation/editing and retained workspace Clear
  styling/centering/disabled state.
- `desktop-progress`: 695 layouts per primary DPR, including equal panel tracks,
  heatmap top position, weekday/grid alignment, responsiveness and History scroll.
- `run-heatmap-pixels.js --quick`: 10 raster cases per primary DPR, both palette
  checks and two DPR transitions. Full-width squares remain 12x12 physical pixels
  at DPR 1.5 and 16x16 at DPR 2, with one-pixel gaps.
- Plugin build/load, Home view parsing and changed JavaScript syntax checks.

Known older fixture failures also reproduced with the prior Home/task UI sources
in temporary pages; they are not counted as passes:

- `workspace-controls`: stops before its control checks at the Files/mode divider
  alignment assertion in `task-workspace-browser.js`.
- `task-planning`: hardcoded `Sep 21` future-date label expectation.
- `task-checkboxes`: missing `window.hubCreateTaskRow` test bridge.

All browser checks use isolated Chromium with production code/styles and mocked
Obsidian host APIs. The native menu implementation and a live Obsidian reload were
not exercised. Test note writes are in memory; no vault tasks were cleared.

## Workspace and contextual Note-view completion (2026-10-12)

`System/Dashboards/Project/view.js` is the canonical task-panel renderer for
Project Full-view, Resource Full-view and both contextual Note-view rails.
`lib/ui/prepared-note-rail.js` loads that exact path. The unused OneDrive conflict
copies named `view-DESKTOP-70KBT1F.js` have no live renderer references.

The canonical renderer now removes its header Clear and passes the former
visible-completed scope to the existing shared `createTaskUi.group` menu, with
the same confirmation and pending-operation guard as Home. Its task request
builder and clearing bridge are unchanged. One `styles.css` selector keeps the
existing + Task button right-aligned after removal of Clear's auto margin.
Home rendering, shared button sizing, task UI/menu code, clearing services and
all other Clear actions were preserved.

Tests added/updated:

- `workspace-task-actions-browser.js` extends `home-task-actions.html` using the
  existing Home fixture's Obsidian mocks and UI loader. It runs the production
  workspace header, task renderer, scope builder and clear handler for all four
  contexts. The original Home tests still run in the same fixture.
- `home-task-actions-browser.js` invokes the workspace checks.
- `workspace-controls-browser.js` and `project-full-polish-browser.js` stop
  constructing the removed header Clear in their panel samples; utility
  centerlines now use + Task.

Passing follow-up checks:

- 48 Home layouts plus 36 workspace/Note layouts at each DPR (1.5 and 2): **168
  total**. Full-view widths 900/1040/1560px, rail widths 280/320/460px, zoom
  100%/125%, open/half rail states, right alignment, 23px button height, 245px
  Full-view task-panel height and task-body scrolling.
- All four contexts: right-click, native Shift+F10/ContextMenu/Enter/Escape,
  focus restoration, confirmation/cancellation, duplicate prevention, error/retry,
  empty-group guards, scoped root and nested-note completed tasks, project/resource
  ownership metadata, existing add/edit/checkbox/disclosure and stale-menu cleanup.
- `task-history.test.js`, `task-progress.test.js`, `task-editor`, plugin load,
  Project view parsing and changed test-script syntax checks.
- `desktop-host`: 16 cases at DPR 1.5 and 8 at DPR 2, retaining native/prepared
  host parity, canvas cap, equal panel tracks, insets and no horizontal overflow.

The broader `workspace-controls` and `project-full-polish` fixtures both stop
before their header checks at the previously reproduced shared Files/mode divider
assertion in `task-workspace-browser.js`; they are not counted as passing.
These follow-up browser checks are isolated fixtures, not a live Obsidian reload.
