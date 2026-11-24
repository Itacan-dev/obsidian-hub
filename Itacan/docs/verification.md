# Itacan 0.2.0 verification

Verified on 24 November 2026 with Node 24.22.3, Electron 45.4.1 and macOS 26.5.2 on Apple silicon.

| Check | Result |
| --- | --- |
| Filesystem and domain tests | All eight passed. These cover library initialization, nested creation, UTF-8 and line endings, path boundaries, overlapping and external edits, cleanup of an interrupted first write, recurrence, reference updates, Inbox filing failures, finished history and saving a Plan across midnight. |
| Documents and folders | Created and saved a note, retained a draft across Home and Resume, saved a conflict copy and preserved the external edit. Switched tabs, edited one document from both panes, saved from the second pane and restored a named layout after renaming its document. Moved and deleted a note through the workspace controls. |
| Tasks, capture and Plan | Created a workspace task with a step and a note reference. Completed it from Home and observed its completion in Plan. Converted Inbox text into a task and a note, appended to a moved note, and filed a captured PDF while preserving the original. Reordered a Plan with task, note and workspace entries. Reopened the renamed note from Plan and verified finished notes in history after restart. |
| Offline desktop | Exercised disposable profiles with the renderer offline after each window opened. Rendered local math and an image, followed Markdown and wiki links, cancelled a close with a draft, then saved during close. The final packaged run observed zero HTTP requests or renderer exceptions. Native picker results were supplied by the test. |
| macOS development and package | The one-click development launcher and the extracted release app both completed the workflow. The extracted release passed deep, strict code-signature verification. |
| Windows package | The archive extracted successfully. It contains a Windows x64 GUI executable. Its application payload matched the tested Mac package byte for byte. Native launch, file picker, Recycle Bin and keyboard interactions still require a Windows machine. |

## Observed timings

Milliseconds on the same Mac with a small temporary library and a fresh profile per run. These wall-clock measurements include Playwright input and its wait for the visible result. The two packaged runs used the same extracted binary.

| Interaction | First packaged run | Repeat packaged run | Development launcher |
| --- | ---: | ---: | ---: |
| Launch to first Home control | 3,771 | 641 | 924 |
| Open a workspace | 313 | 33 | 33 |
| Switch document tabs | 57 | 51 | 62 |
| Open Quick Add | 28 | 27 | 27 |
| Complete a task and refresh its Home row | 58 | 56 | 55 |

The sample size and library size limit these figures to a responsiveness check. The [README](../README.md) contains reproduction commands and the [source map](architecture.md) identifies the implementation behind each workflow.
