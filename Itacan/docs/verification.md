# Itacan verification

## Development checkout ? 27 November 2026

The restored source passed all 12 filesystem and domain tests and the native desktop workflow. All 98 runtime files matched the previously verified 0.3.2 application after accounting for text line endings and JSON formatting. The renderer bundles matched byte for byte. The entries below record historical release checks. Current development uses the source launchers.

## 0.3.2 on Windows x64

Verification used the installed Obsidian with an isolated synthetic Hub vault, plus standalone Electron with disposable libraries and profiles. In the running Hub, dragging reversed the order of two Project cards and two document tabs. Dropping a note tab at a pane edge produced two document groups. Dropping the Reviews tree row on Papers changed the actual vault path to Papers/Reviews. Hub also contains a separate ordering handler for root descriptors. Standalone exposes that distinction with a reorder handle beside each top-level folder and a folder-name drag for physical moves. Hub's project menu, task editor, Quick Add and Inbox supplied the other interaction references.

| Interaction | Standalone result |
| --- | --- |
| Window and focus | Native maximized startup, restore, minimize and F11 toggle worked. The search input had a 1 px inset indicator and keyboard tabbing to a button showed a 2 px indicator. Focusing the input preserved its dimensions. Pressing Enter while a new search was pending left the previous match closed. |
| Documents | Verified tab insertion, transfer, rail-to-edge splits, bottom-to-left rearrangement and cancelling a tab drag. Moving an unsaved editor preserved its draft. Cancelling a divider drag returned its pane to 682 × 365.25 CSS px. A note scrolled to 350 px stayed at 350 px when moved into a new split. The suite also restores named layouts and checks shared-buffer edits and save/discard/cancel. |
| Ordering and files | Reordered Home Project cards and workspace tree folders. Dropping a folder name into another created the corresponding nested directory. Dragged two selected notes into a folder and checked their source and destination paths and contents. Verified a browser File drop and two Chromium drag inputs carrying a disk-backed Windows path. The latter produced Incoming.md and Incoming (2).md with identical bytes and preserved the original. Domain tests cover exclusive copies, numbered collisions and rollback. |
| Tasks, capture and plans | Reordered task steps and cancelled the edit. Quick Add retained a draft through Escape and shortcut reopening. Pointer and keyboard reordered named presets. The desktop suite also exercises compatible Inbox selection and filing, task properties, Plan ordering and history. |
| Calendar and Progress | Scrolling to the end appended seven days without changing the panel bounds. Today returned to the current date. After saving a report from the heatmap, focus returned to the original day. The desktop suite checks reports, Statistics, and results after restart. |

All 12 domain and filesystem tests passed. The native workflow passed from source and twice from a fresh extraction of the Windows ZIP. Both packaged runs completed with zero renderer exceptions and zero HTTP requests.

| Packaged workflow, milliseconds | First run | Second run |
| --- | ---: | ---: |
| Launch to Home's library chooser | 376 | 166 |
| Open workspace | 65 | 60 |
| Open and render the sample note | 86 | 69 |
| Switch tabs | 61 | 62 |
| Open Quick Add | 29 | 17 |
| Restore two panes | 60 | 50 |

Each figure measures a Playwright action through its visible result on this machine. Each launch used a new profile. The second run followed the first on the same installation. Windows x64 ZIP SHA-256 `a16be5f6a8b6f98387828d0db06661eecf6d180c6671fa350a81635f0a2f402a`.

File pickers in the repeatable suite receive disposable paths. External drop checks exercised the Chromium file-drop boundary. A physical mouse drag from Explorer was outside the test. Dragging out to Explorer, detaching panes into separate windows and macOS behavior were outside this Windows verification. The standalone agenda continues to use local task dates.

## 0.3.1 on Windows x64

All 11 domain and filesystem tests passed. The native desktop workflow passed from source and twice from the extracted ZIP with disposable offline profiles and libraries. The two packaged runs reached Home in 401 and 166 ms, opened the sample document in 87 and 86 ms, and switched tabs in 48 and 63 ms. Tests exercised the native F11 menu shortcut in both directions. See the [measured Hub comparisons and screenshots](comparisons/0.3.1/README.md).

Windows x64 archive SHA-256 `293d65e9ab54aca809137d664d49d68546d995cf8cc02ccb75ce469b8d8543ec`.

## 0.3.0 on Windows x64 · 25 November 2026

All 11 filesystem/domain tests passed. The native Electron workflow passed from source and twice from a fresh extraction of the Windows ZIP. Each packaged run used a new profile and disposable libraries, with native picker results supplied by the test. Both runs finished with zero renderer exceptions and zero HTTP requests.

| Workflow | Observed result |
| --- | --- |
| Daily Plan | Selected a task, a nested file by path search, and a project in one picker. Reordered by keyboard, edited the note, completed the task from Home, relinked a missing file, finished the plan, opened it from a daily report and reopened its history after restart. A separate timed Windows check advanced an open editor across its stored boundary and read the preserved note from both the historical view and JSON. |
| Progress | Rated a Project, wrote a reflection, opened it from the heatmap, edited it and verified it after restart. Added and edited a Resource report on an earlier day. Checked Reports, Activity and Tasks history, filtered Statistics and the report prompt after a reading visit. Domain tests distinguish an explicit zero from an unrated reflection, reject stale or duplicate writes, preserve saved evidence and handle reopening and recompleting work. |
| Document desk | Edited one note from two panes, saved from either view, resized the divider, split only the right pane vertically, moved a tab between panes and closed the nested pane. Restoring a named preset retained a shared unsaved draft and the resized width. A second preset restored the reading offset after scrolling away. Managed rename and restart kept documents addressable. |
| Reference | Compared the Hub Plan presentation, picker and lifecycle, dashboard composition, daily report, progress editor and Statistics calculations against the local implementation. Hub’s synthetic Plan domain test and workspace-explorer browser fixture passed. Its historical daily-report browser fixture stopped on an activity-count assertion. Its Statistics fixture encountered a missing test dependency and a modal helper error. Comparisons for those two used the current Hub source and separate standalone runtime checks. |
| Layout | At 1140 × 740, empty and 120-report Home states both placed Progress at (571, 582) with size 498 × 385 CSS pixels. The Plan/Tasks region stayed at (57, 336), 1011 × 222. History scrolled 3,698 pixels of content within 138 pixels. At 740 × 530 the Statistics footer stayed at y=450, within the window, and its cards scrolled within 278 pixels. |

### Representative interaction times

Elapsed milliseconds from the Windows test, including automated input and waiting for the visible result. Startup ends at the first Home control in a fresh profile. The document measurement ends at rendered math in the sample note.

| Interaction | 0.3.0 first packaged run | 0.3.0 repeat | Previous 0.2.0 alignment build |
| --- | ---: | ---: | ---: |
| Launch to Home | 419 | 178 | 431 first, 163–166 repeat |
| Open workspace | 51 | 54 | 35–41 |
| Open sample document | 72 | 71 | 55–56 |
| Switch tabs | 47 | 31 | 30–47 |
| Open Plan | 65 | 66 | — |
| Complete task from Home Plan | 43 | 38 | — |
| Restore resized two-pane preset | 43 | 44 | — |
| Open progress editor | 42 | 44 | — |
| Open Statistics with notes counted | 50 | 46 | — |

These small-library observations show similar startup and tab-switch times. Opening the sample workspace and document took longer. They do not characterize a large research library, cold filesystem caches or cloud hydration. Statistics reads note metadata on opening its window.

### Delivery and boundaries

The unsigned Windows archive is `release/Itacan-0.3.0-win32-x64.zip` (SHA-256 `2ef298e80487c52f3273390f5f311590657aaa831351e802a489cd37414e41dd`). Mac packaging and runtime verification for 0.3.0 remain outstanding. The Mac results below apply to 0.2.0.

The standalone desk holds Markdown views in a single window. Supported images and PDFs use the OS viewer. Progress records work observed by Itacan. Statistics can count externally created notes from current filesystem metadata, but external edits and operations on the contents of a bulk-copied folder have no individual activity records. Historical Hub Focus records, Oath time and third-party views are outside this release.

## Earlier 0.2.0 checks

## Interface alignment on Windows x64 · 25 November 2026

The rebuilt development launcher reached Home from an unrelated working directory. The nine domain and filesystem tests passed. The desktop workflow passed from source and three times from the final extracted ZIP. Each run used an empty profile, disposable libraries, offline renderer networking and checks for renderer exceptions and HTTP requests.

| Reference interaction | Checked in standalone |
| --- | --- |
| Home and workspace navigation | Cover followed by navigation, Plan alongside Tasks, project status selectors and Resources in the same section. Moving a project between Active and Future changed the counts. Searching note content opened its document. Home and Last File retained an unsaved edit. |
| Explorer, documents and presets | A root allows folder creation. Creating a nested note selects its name inline. Single click selects, double-click opens in place, and contextual New tab and Right split preserve other views. Checked Ctrl-selection, keyboard copy/paste, rename, move, deletion, shared edits, conflict copies, preset naming and restoration after a rename. |
| Tasks | The same task card opens from workspace and capture. Checked location, steps, a date popover, importance and recurrence. Completing from Plan updated the task and left its successor available. |
| Quick Add and Inbox | Checked keyboard submission, child-dialog cancellation, draft restoration, and separate text/file states. Native-picked and dropped attachments retained their bytes. Checked editable Inbox details, type filters, sort, compatible range selection, bulk insertion into a note and insertion at the start of a note. |
| Plan | Selected a task, document and workspace across picker tabs, reviewed the combined selection, reordered entries and relinked an externally removed file. Finishing produced a read-only Home preview and history that survived restart. |

The Hub explorer, presets and Quick Add/Inbox browser fixtures ran against their own synthetic content. The Plan editor and picker ran with the installed Obsidian Modal extracted from the application archive. Two additional Hub fixtures had stale test dependencies. The Hub task-form fixture requested the absent `services/task-service-host` module, and its navigation fixture encountered an unbound `require`. Task and navigation comparisons also used the reference source, the functioning capture and explorer fixtures, and the standalone desktop suite.

| Final packaged interaction (ms) | First launch after extraction | Repeat 1 | Repeat 2 |
| --- | ---: | ---: | ---: |
| Launch to visible Home | 431 | 163 | 166 |
| Open workspace | 41 | 38 | 35 |
| Open sample note to rendered math | 56 | 55 | 55 |
| Switch between open tabs | 47 | 30 | 44 |
| Open Quick Add | 12 | 16 | 16 |

These are elapsed times including automated input and waiting for the visible result. Each repeat started a new process and profile. They describe a small local library. The Windows build is unsigned. Document splits live in one application window. PDFs and supported images use the system viewer. Shared Resource-folder mounts, project phases and the Calendar, Schedule, Roadmap and Progress surfaces remain outside this build.

## Earlier Windows baseline · 25 November 2026

Verified on Windows build 26300 with Node 24.19.0 and Electron 45.4.1. The source checkout was in OneDrive. All test libraries and profiles were disposable and on local disk.

| Check | Result |
| --- | --- |
| Installation and launcher | Installed the locked dependencies and Windows Electron runtime, built the renderer and launched via **Open Itacan.cmd** from a different working directory. Confirmed the rebuild, single-window reuse and reconnection to the selected library after quitting and relaunching. |
| Native folder picker and deletion | Windows UI Automation opened the real picker, cancelled it, reopened it and selected an empty folder. Itacan initialized the library. A separate deletion through the workspace UI placed the test note in the Windows Recycle Bin, confirmed through the Windows shell. |
| Automated workflows | All nine filesystem and domain tests passed. The Electron desktop suite passed against the development build and the extracted x64 release. It exercised file creation, reads, saves, conflicts, moves and deletion, tabs and splits, Quick Add focus and Escape, task steps, Inbox, Plan and closing with a draft. Packaged runs observed zero HTTP requests after the window opened and zero renderer exceptions. |
| Document identity | Restored an older two-pane layout with duplicate spellings. Opened another note from the tree and followed a mixed-case link back to the unsaved draft. Confirmed a single tab for that document in each pane, closed one pane, saved with Ctrl+S and checked the file contents on disk. |

**Packaged timings in milliseconds.** Each run used the same extracted executable and a fresh profile. Startup ends at the first visible Home control. Document opening measures the file-row click through visible rendered math in the sample note. The sample workspace contained two notes and a local image. The tab measurement switches between two already-open documents in a separate test workspace. Measurements include Playwright input and waiting for the visible result.

| Interaction | First run | Repeat 1 | Repeat 2 |
| --- | ---: | ---: | ---: |
| Launch to Home | 415 | 183 | 168 |
| Open existing document | 116 | 116 | 115 |
| Switch tabs | 47 | 46 | 48 |

Temporary counters on the main-process layout command and work-file replacement showed one transaction and one replacement for each document open, tab switch and active-pane change measured. Selecting Edit again on an already-editing pane previously issued one transaction and zero replacements. After the change it issued neither. Changes that affect Home Resume still persist immediately.

The Windows release is an unsigned personal build. These results cover a small, locally available library. Large libraries and OneDrive Files On-Demand behavior remain unmeasured.

## macOS · 24 November 2026

Verified with Node 24.22.3, Electron 45.4.1 and macOS 26.5.2 on Apple silicon.

| Check | Result |
| --- | --- |
| Filesystem and domain tests | All eight passed. These cover library initialization, nested creation, UTF-8 and line endings, path boundaries, overlapping and external edits, cleanup of an interrupted first write, recurrence, reference updates, Inbox filing failures, finished history and saving a Plan across midnight. |
| Documents and folders | Created and saved a note, retained a draft across Home and Resume, saved a conflict copy and preserved the external edit. Switched tabs, edited one document from both panes, saved from the second pane and restored a named layout after renaming its document. Moved and deleted a note through the workspace controls. |
| Tasks, capture and Plan | Created a workspace task with a step and a note reference. Completed it from Home and observed its completion in Plan. Converted Inbox text into a task and a note, appended to a moved note, and filed a captured PDF while preserving the original. Reordered a Plan with task, note and workspace entries. Reopened the renamed note from Plan and verified finished notes in history after restart. |
| Offline desktop | Exercised disposable profiles with the renderer offline after each window opened. Rendered local math and an image, followed Markdown and wiki links, cancelled a close with a draft, then saved during close. The final packaged run observed zero HTTP requests or renderer exceptions. Native picker results were supplied by the test. |
| macOS development and package | The one-click development launcher and the extracted release app both completed the workflow. The extracted release passed deep, strict code-signature verification. |
| Windows package built on macOS | The archive extracted successfully and contained a Windows x64 GUI executable. Its application payload matched the Mac package tested on this date byte for byte. |

### Observed timings on macOS

Milliseconds on the same Mac with a small temporary library and a fresh profile per run. These wall-clock measurements include Playwright input and its wait for the visible result. The two packaged runs used the same extracted binary.

| Interaction | First packaged run | Repeat packaged run | Development launcher |
| --- | ---: | ---: | ---: |
| Launch to first Home control | 3,771 | 641 | 924 |
| Open a workspace | 313 | 33 | 33 |
| Switch document tabs | 57 | 51 | 62 |
| Open Quick Add | 28 | 27 | 27 |
| Complete a task and refresh its Home row | 58 | 56 | 55 |

The sample size and library size limit these figures to a responsiveness check. The [README](../README.md) contains reproduction commands and the [source map](architecture.md) identifies the implementation behind each workflow.
