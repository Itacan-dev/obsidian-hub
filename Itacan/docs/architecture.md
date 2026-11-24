# Product and source map

Itacan opens on Home. Workspaces own folders and notes. The document desk can show two panes, each with tabs. Quick Add, Inbox and Daily Plan open over the current view.

| Location | Responsibility |
| --- | --- |
| `renderer/app.js` and `index.html` | Library session, navigation, document desk, app bar and quit guard. After a task or capture write, only the current feature panels refresh. |
| `renderer/workspace/` | Folder management, contextual tree, tabs, split views and layout controls. The tree reads one expanded directory at a time. Tab switches preserve the other pane's editor. |
| `renderer/document/` | One in-memory buffer per open Markdown path. Editors and previews subscribe to that buffer. Explicit saves, conflict copies, relative links and research math all use the same document implementation. |
| `renderer/home/` | Library picker, project and resource cards, resume, named layouts and summaries from the task and Plan features. |
| `renderer/tasks/`, `renderer/capture/`, `renderer/plan/` | Task editor and lists, Quick Add and Inbox destinations, and the ordered daily Plan and history. Each directory owns its window composition and layout. |
| `renderer/ui/` | Buttons, icons, fields, filters, hierarchical destination picker, native dialogs, feedback and shared CSS. |
| `main/preload.cjs`, `main/app.cjs` | Named IPC operations, session checks, native file picker, OS Trash and app lifecycle. |
| `main/library.cjs`, `main/files.cjs` | Validated paths, UTF-8 Markdown, atomic saves, ordinary folder operations, move reference updates, staged captures and filing. |
| `main/tasks.cjs`, `main/plan.cjs` | Task dates, steps and recurrence, and Plan entry validation, ordering and history snapshots. |
| `main/work.cjs` | Per-library JSON reads and serialized updates, reference repair and saved layouts. Each update reads the current file and checks for intervening external changes before replacing it. |
| `scripts/`, `test/` | Source bundling, release packaging, filesystem tests and the offline desktop workflow. |

## Dependencies

Electron supplies the shell, native dialogs, local protocol and sandboxed preload. CodeMirror 6 and its Markdown language package provide the editor. Markdown-it, markdown-it-texmath and KaTeX render previews. Fontsource supplies local fonts. esbuild bundles the renderer, Electron Packager creates release applications, Playwright drives the desktop test and Node's test runner exercises the filesystem and domain operations. The increment adds zero dependencies.

## Storage decisions

Documents keep their file identity. Structured records use library-relative paths for file and workspace references, and UUIDs for tasks, captures and Plan entries. A managed move updates these references together. An active Plan looks up the current task when displayed. Finishing records the displayed title and completion state, so later edits preserve the historical reading. Recurrence advances a civil date by a daily or weekly interval when a task is completed. Each occurrence can create one successor.

The library work file uses ordinary JSON and the same atomic replacement helper as note saves. A capture stays in Inbox until the destination write succeeds. File operations that also update JSON can undo their file change if the JSON write fails. One active writer per library is the intended operating model. The [library guide](../README.md) describes the on-disk layout.
