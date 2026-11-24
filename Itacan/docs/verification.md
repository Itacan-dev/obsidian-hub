# Foundation verification

Verified on 24 November 2026 using Node 24.22.3, Electron 45.4.1 and an Apple silicon Mac running macOS 26.5.2.

| Check | Result |
| --- | --- |
| `npm test` | Three filesystem tests passed. They cover initialization and reopen, nested creation, duplicate names, concurrent stale saves, an external edit, BOM/CRLF preservation, invalid UTF-8, traversal, symlinks and permitted attachment types. |
| Renderer build and packaging | Built the renderer from the lockfile-installed libraries. Packaged both release ZIPs with network access restricted and the verified Electron runtime archives cached. |
| Extracted macOS archive | The extracted app passed `codesign --verify --deep --strict`. Launched the executable from a temporary local directory with a disposable profile, then relaunched it to check the remembered library. |
| Packaged desktop workflow | With the renderer network offline, opened a fresh library, created a project, folder and note, edited and saved it, cancelled navigation and preserved an external edit using Save a copy. Rendered a real local image and display equation and followed a cross-workspace note link to a heading. Cancelled a close after editing, then saved during close and checked the bytes on disk. The workflow completed without renderer exceptions or observed HTTP requests. |
| Windows archive | Extracted successfully. The launcher is a Windows x86-64 GUI executable. Its packaged application archive was byte-identical to the tested Mac application archive. Native Windows launch and interaction remain unverified. |

The desktop test supplies the native folder picker's answer so it can operate only on temporary libraries. It covers the resulting application flow. Manual acceptance on Windows should include choosing a folder in Explorer, editing a note, saving with Ctrl+S, opening a local image or PDF and quitting with a dirty document.

This milestone opens one note at a time and saves explicitly. External filesystem changes appear when the folder or note is reopened. File revision checks catch observed changes before replacement. Two machines writing at the same time through a sync provider are outside the single-user storage model. Startup and interaction latency have not been benchmarked.
