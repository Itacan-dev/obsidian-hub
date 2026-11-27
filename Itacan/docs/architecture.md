# Product and source map

Itacan opens on Home. Workspaces own folders and notes. The document desk shows tabs and resizable nested splits. Quick Add and Inbox open over the current view. Home presents the daily Plan and opens its editor.

| Location | Responsibility |
| --- | --- |
| `renderer/app.js` and `index.html` | Library session, navigation, document desk, app bar and quit guard. After a task or capture write, only the current feature panels refresh. |
| `renderer/workspace/` | Folder management, contextual tree, tabs, split views and layout controls. The tree reads one expanded directory at a time. Tab switches preserve the other pane's editor. |
| `renderer/document/` | One in-memory buffer per open Markdown path. Editors and previews subscribe to that buffer. Explicit saves, conflict copies, relative links and research math all use the same document implementation. |
| `renderer/home/` | Dashboard greeting, offline task agenda, project status selectors, resource cards and panels from Tasks, Plan and Progress. |
| `renderer/tasks/`, `renderer/capture/`, `renderer/plan/` | Task editor and lists, Quick Add and Inbox destinations, and the ordered daily Plan and history. Each directory owns its window composition and layout. |
| `renderer/progress/panel.js` | Scoped Home/workspace calendar, multi-workspace daily intensity and paged history. Opens reports, live sources and Statistics. |
| `renderer/progress/report.js`, `statistics.js` | Report editor, daily viewer, evidence, workspace selection and Statistics. Reports use Plan’s existing presentation. Statistics reads current note metadata on opening and applies filters to that snapshot. |
| `renderer/workspace/desk.js`, `splits.js`, `divider.js`, `presets.js` | Tab placement and transfer, a tree of horizontal/vertical split proportions, keyboard and pointer resizing, and preset commands. The desk snapshots view positions from the document component. |
| `renderer/ui/` | Buttons, icons, fields, filters, hierarchical destination picker, native dialogs, feedback and shared CSS. |
| `main/preload.cjs`, `main/app.cjs` | Named IPC operations, session checks, native file picker, OS Trash and app lifecycle. |
| `main/library.cjs`, `main/files.cjs` | Validated paths, UTF-8 Markdown, atomic saves, ordinary folder operations, move reference updates, staged captures and filing. |
| `main/tasks.cjs`, `main/plan.cjs` | Task dates, steps and recurrence, and Plan entry validation, ordering and history snapshots. |
| `main/progress.cjs` | Stores reports by local day and workspace, records file activity and task/step transitions, and reads surviving note metadata for Statistics. File operations and the shared task command call these functions. |
| `main/work.cjs` | Per-library JSON reads and serialized updates, reference repair and saved layouts. Each update reads the current file and checks for intervening external changes before replacing it. |
| `scripts/`, `test/` | Source bundling, filesystem tests and the offline desktop workflow. |

## Dependencies

Electron supplies the shell, native dialogs, local protocol and sandboxed preload. CodeMirror 6 and its Markdown language package provide the editor. Markdown-it, markdown-it-texmath and KaTeX render previews. Fontsource supplies local fonts. esbuild bundles the renderer, Playwright drives the desktop test and Node's test runner exercises the filesystem and domain operations. Dashboard and dialog sizing use CSS Grid, Flexbox and container queries. The offline agenda reads task dates from the current library.

## Storage decisions

Documents keep their file identity. Structured records use library-relative paths for file and workspace references, and UUIDs for tasks, captures and Plan entries. A managed move updates these references together. An active Plan looks up the current task when displayed. Manual finish snapshots titles, routes and completion state. A day-end snapshot records the Plan’s original midnight and leaves an unobserved task outcome unknown. Managed moves update the live navigation target while preserving the captured route. Recurrence advances a civil date by a daily or weekly interval when a task is completed. Each occurrence can create one successor.

Project display order is saved per status in `projectOrder`. Each workspace can save its top-level folder order in `explorers[path].order`. Both use library-relative paths and share the existing managed move updates. The file listing keeps its own sort order.

The library work file uses ordinary JSON and the same atomic replacement helper as note saves. A capture stays in Inbox until the destination write succeeds. File operations that also update JSON can undo their file change if the JSON write fails. One active writer per library is the intended operating model. The [library guide](../README.md) describes the on-disk layout.


## Fields introduced in 0.3.0

| Field in `itacan-work.json` | Meaning |
| --- | --- |
| `reports[]` | One authored rating and/or reflection per workspace and civil day, with creation/update times and the evidence captured on save. An explicit zero is a rating. An empty unrated record is removed. |
| `activity[]` | Note and project operations plus task and step completions, with the time, original workspace and current navigation target. Saves of a note in the same workspace and day within ten minutes of its previous edit coalesce. Reopening a task or step marks its previous completion. |
| `tasks[].steps[].id` | Stable step identity for recording completion even after editing its text or moving it in a list. |
| `plan.endsAt`, `timeZone` and historical entry routes | The intended local day boundary and readable historical references. Task entries in an active plan still refer to the live task by ID. |
| `lastLayout` and `presets[].layout` | Each pane has an ID, ordered tabs and per-file reading/editing positions. Internal split nodes hold a direction, two children and a fraction. Existing flat layouts open side by side. Document text stays in Markdown and live drafts stay in the shared buffer. |

Visits and reading interactions keep one timestamp per workspace in memory for the close prompt. They contribute no activity rows or Statistics counts. The format stays at version 1. The renderer uses the existing preload operations and requests a metadata listing for Statistics on demand. The package uses the pinned 0.2.0 dependencies.
