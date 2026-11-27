# Product and source map

Itacan opens on Home. Workspaces own folders and notes. The document desk shows tabs and resizable nested splits. Quick Add and Inbox open over the current view. Home presents the daily Plan and opens its editor.

| Location | Responsibility |
| --- | --- |
| `renderer/app.js` | Application composition root. Selects and loads the library, routes Home, Workspace and document requests, preserves the desk and guards window close. |
| `renderer/shell/` | Owns the navigation bar, library selector, global tools, notices and scrolling viewport. The router supplies actions and the current screen. |
| `renderer/workspace/` | Folder management, contextual tree, tabs, split views and layout controls. The tree reads one expanded directory at a time. Tab switches preserve the other pane's editor. |
| `renderer/document/` | Markdown source, Live Preview and Read share one text buffer and undo history per open path. Selections and scroll offsets belong to the pane. Local PDF and image tabs use the same desk and store page, zoom or pan in the layout. |
| `renderer/home/` | Dashboard greeting, offline task agenda, project status selectors, resource cards and panels from Tasks, Plan and Progress. |
| `renderer/tasks/`, `renderer/capture/`, `renderer/plan/` | Task editor and lists, Quick Add and Inbox destinations, and the ordered daily Plan and history. Each directory owns its window composition and layout. |
| `renderer/progress/panel.js` | Scoped Home/workspace calendar, multi-workspace daily intensity and paged history. Opens reports, live sources and Statistics. |
| `renderer/progress/report.js`, `statistics.js` | Report editor, daily viewer, evidence, workspace selection and Statistics. Reports use Plan’s existing presentation. Statistics reads current note metadata on opening and applies filters to that snapshot. |
| `renderer/workspace/desk.js`, `splits.js`, `divider.js`, `presets.js` | Desk composition, a tree of split proportions, resizing and preset commands. The desk delegates tab placement and transfer to `desk-tabs.js` and contextual controls to `desk-rail.js`. The desk snapshots view positions from the document component. |
| `renderer/ui/` | Buttons, icons, fields, filters, hierarchical destination picker, native dialogs, feedback and shared CSS. |
| `main/preload.cjs`, `main/app.cjs` | Electron bootstrap and the narrow renderer bridge. `library-ipc.cjs` registers IPC, validates sessions and dispatches library operations. `protocol.cjs` serves app assets and scoped local media. `window.cjs` owns native menus, close handling, bounds and Oath fullscreen. |
| `main/library.cjs`, `main/files.cjs` | Validated paths, UTF-8 Markdown, atomic saves, ordinary folder operations, move reference updates, staged captures and filing. |
| `main/tasks.cjs`, `main/plan.cjs` | Task dates, steps and recurrence, and Plan entry validation, ordering and history snapshots. |
| `main/progress.cjs` | Stores reports by local day and workspace, records file activity and task/step transitions, and reads surviving note metadata for Statistics. File operations and the shared task command call these functions. |
| `renderer/work-operations.js`, `contracts/work-commands.d.ts` | Named feature operations and their input contracts. The renderer calls the relevant domain when changing tasks, Plans, Oaths, workspaces, presets, progress or settings. |
| `main/work.cjs`, `main/work-format.cjs` | Validate persisted records and serialize changes for one library. A task completion, Oath outcome and progress evidence can share one commit. Each replacement checks for intervening changes. Managed moves call reference-rewrite operations in the owning domain modules in one ordered transaction. |
| `main/workspaces.cjs`, `main/presets.cjs`, `main/capture-state.cjs` | Workspace context and Resource attachments, mixed layouts and Last File, and the Quick Add and Inbox lifecycle. |
| `main/oath.cjs`, `main/project-planning.cjs` | Regular Oath scheduling, rest, terminal outcomes, scope and history, plus Project phases and milestones. |
| `main/recovery.cjs`, `main/library-format.cjs`, `main/drafts.cjs` | Recover interrupted moves and filing, protect old metadata during an upgrade, and store unsaved drafts in the device profile. |
| `main/search.cjs`, `renderer/ui/context-search.js` | Search filenames and Markdown within the selected scope, stream matching lines from bounded reads, overlay dirty buffers, and cancel superseded queries. |
| `main/settings.cjs`, `main/music.cjs` | Portable preferences and playlist order, device-specific shortcuts and window bounds, and local audio paths. |
| `scripts/`, `test/` | Source bundling, filesystem tests and native workflows. `test/desktop.mjs` runs one integrated workday across restarts. Its fixture, window helpers and workflow steps live in `test/desktop/`. |

The [visual editing map](ui.md) pairs each screen with its composition and CSS. Feature modules import their styles. The build checks the loaded stylesheet against the renderer source tree.

## Dependencies

Electron supplies the shell, native dialogs, local protocol and sandboxed preload. CodeMirror 6 and its Markdown language package provide the editor. Markdown-it, markdown-it-texmath and KaTeX render previews. The build bundles PDF.js, its worker and fonts for offline papers. Fontsource supplies local interface fonts. esbuild bundles the renderer, Playwright drives the desktop tests and Node's test runner exercises the filesystem and domain operations. Dashboard and dialog sizing use CSS Grid, Flexbox and container queries. The offline agenda reads task dates from the current library.

## Storage decisions

Documents keep their file identity. Structured records use library-relative paths for file and workspace references, and UUIDs for tasks, captures and Plan entries. A managed move updates these references together. An active Plan looks up the current task when displayed. Manual finish snapshots titles, routes and completion state. A day-end snapshot records the Plan’s original midnight and leaves an unobserved task outcome unknown. Managed moves update the live navigation target while preserving the captured route. Recurrence advances a civil date by a daily or weekly interval when a task is completed. Each occurrence can create one successor.

Project display order is saved per status in `projectOrder`. Each workspace can save its top-level folder order in `explorers[path].order`. Both use library-relative paths and share the existing managed move updates. The file listing keeps its own sort order.

The library work file uses ordinary JSON and the same atomic replacement helper as note saves. Managed moves and Inbox filing record the pending change before touching the destination. On reopening, matching file identity or content allows the operation to finish. Divergent copies remain available for recovery. If a note save succeeds but activity logging fails, the note stays saved and the editor reports the logging issue. One active writer per library is the intended operating model. The [library guide](../README.md) describes the on-disk layout.

New libraries have a version 2 marker. Before the first structured change to a version 1 library, Itacan saves its original marker and work file together under `.itacan-recovery/`. The work file retains its version 1 record format and gains optional domain fields. A separate device profile keeps recovery drafts, window geometry, local application bindings and audio volume. A closed library can move independently of that profile.


## Fields introduced in 0.3.0

| Field in `itacan-work.json` | Meaning |
| --- | --- |
| `reports[]` | One authored rating and/or reflection per workspace and civil day, with creation/update times and the evidence captured on save. An explicit zero is a rating. An empty unrated record is removed. |
| `activity[]` | Note and project operations plus task and step completions, with the time, original workspace and current navigation target. Saves of a note in the same workspace and day within ten minutes of its previous edit coalesce. Reopening a task or step marks its previous completion. |
| `tasks[].steps[].id` | Stable step identity for recording completion even after editing its text or moving it in a list. |
| `plan.endsAt`, `timeZone` and historical entry routes | The intended local day boundary and readable historical references. Task entries in an active plan still refer to the live task by ID. |
| `lastLayout` and `presets[].layout` | Each pane has an ID, ordered tabs and per-file reading/editing positions. Internal split nodes hold a direction, two children and a fraction. Existing flat layouts open side by side. Document text stays in Markdown and live drafts stay in the shared buffer. |

Visits and reading interactions keep one timestamp per workspace in memory for the close prompt. Statistics requests a metadata listing on demand.
