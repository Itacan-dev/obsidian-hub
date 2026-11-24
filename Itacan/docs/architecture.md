# Product and source map

The source is self-contained. Hub informed the Home imagery and the Project/Resource workflow. All runtime code and assets live in this directory.

```text
Home → Project or Resource → folder → Markdown document
  renderer features → named preload calls → Electron main → library files
```

| Location | Responsibility |
| --- | --- |
| `renderer/app.js`, `index.html` | One window shell, breadcrumb routes, library switching and the transition away from a dirty document. A failed navigation leaves the current screen available. |
| `renderer/home/` | Greeting, cover, Project and Resource cards, project creation and the first-run library prompt. |
| `renderer/workspace/` | Folder contents, creation of notes and subfolders, and opening supported attachments. |
| `renderer/document/` | One open document, source editing, preview, save state and conflict-copy workflow. CodeMirror loads when editing begins. Markdown-it and KaTeX render note text locally. |
| `renderer/ui/` | Shared controls, icons, native HTML dialogs, styles and feedback. |
| `main/app.cjs`, `main/preload.cjs` | Electron window and lifecycle, native picker, protocol, last-library preference and the named IPC boundary. The sandboxed renderer receives plain values and specific operations. |
| `main/library.cjs` | Filesystem authority for initialization, listing, validated creation, attachment lookup, reading and revision-checked saving. This module also runs directly under Node in the filesystem tests. |
| `scripts/`, `test/`, `examples/` | Renderer bundling and packaging, filesystem and desktop verification, and a portable sample library. |

Main serves bundled application resources and permitted local images through the Itacan protocol. File operations receive a library session identifier and a relative path. They validate path components and reject symlinks. A note save is serialized, checked against its prior byte revision, flushed to a sibling temporary file, then renamed into place. The original stays available if a normal write fails. External sync clients operate independently of this process.

The renderer owns unsaved editor state. Main asks the renderer before closing, so a recent edit can veto the close. Feature code calls the same document or library operations regardless of which button initiated them. Home reads its two collection directories. Workspace navigation reads the current folder. Neither needs a recursive startup scan.

## Incremental product direction

| Next workflow | Natural owner and shared behavior |
| --- | --- |
| Multi-note reading, tabs, splits and named layouts | Extend the document feature with one buffer per open path. Store meaningful named layouts in the library and reuse workspace breadcrumbs and the same save operation. |
| Tasks, Schedule and Roadmap | Introduce task creation, mutation and persistence with the first live task surface. Schedule can read dates from that owner. Project Roadmaps own phases and milestones. Choose a readable storage format against the actual requirements at that milestone. |
| Daily Plan, Inbox and Quick Add | Give each feature its own composition. Reuse task and document writes, common dialogs and inputs. Keep Plan ordering and capture destination choices local to their features. |
| Progress, history, reports and statistics | Store authored reports with the library. Build summaries from committed activity and completion records once those inputs exist. |

Each row describes a future increment. The current implementation ends at the editable local library.
