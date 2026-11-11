# Quick Add layout and per-file Inbox promotion

Verified 2026-11-10. This report covers the follow-up layout and batch-promotion changes; earlier capture and polish work remains intact.

## Behavior

- Add a file stays visible, is disabled for meaningful text, and is enabled for empty/file captures. Mixed captures remain rejected.
- The initial empty layout determines the dialog and capture-region height. File rows replace the text region, scroll internally, and display newest first without reordering persisted attachments. New additions reveal the top row.
- Empty/text footers contain Clear and Send to Inbox. File footers add the neutral Add files to... action immediately before Send to Inbox, opening the existing shared File Location picker.
- Every newly promoted file has its own Inbox capture, retaining source and attachment metadata. Stable IDs derive from draft and attachment identities. All entries and draft removal share one atomic metadata save. Failed saves preserve the complete draft; replay does not recreate processed items or clear a newer draft.
- Existing grouped/mixed captures are unchanged. An unresolved multi-file placement retains its original operation and must be retried before splitting into Inbox entries. Send is disabled with an explanatory tooltip in that state. Single-file pending operations remain transferable with their recovery identity.
- Successful submission keeps Quick Add open, clears the submitted attachments, restores text focus, shows the existing confirmation, and updates the badge by the file count.

## Files changed in this follow-up

| File | Change |
| --- | --- |
| lib/ui/quick-add.js | Fixed capture region, visible disabled file input, newest-first rows, file footer action. |
| lib/services/quick-add-draft.js | Atomic per-file promotion, deterministic identities, retry and pending-operation protection. |
| styles.css | Scoped fixed dialog/capture sizing, internal scrolling, responsive footer and disabled styling. |
| lib/tests/capture-workflows.test.cjs | Eight additional batch, failure, replay, independent processing, and compatibility cases. |
| lib/tests/inbox-browser.js | Updated file-input and file-footer expectations. |
| lib/tests/capture-obsidian-fixture.cjs | Geometry, overflow, batch failure/retry, independent items, themes, and restart checks. |
| lib/tests/run-capture-obsidian-test.cjs | Fourth process checks promoted entries after restart. |
| main.js | Rebuilt and installed production bundle. |
| lib/tests/capture-layout-batch-verification.md | This report. |

## Verification

- 82/82 Node runner entries passed: 34 focused capture cases plus icons, atomic storage, shared/private isolation, note insertion, location formatting, native SQLite application/default/editor behavior, and source/bundle loading.
- The fast Inbox browser fixture passed in hidden Electron.
- 131 genuine Obsidian UI/vault assertions passed across four fresh processes: 117 workflow/visual assertions, 4 initial restart assertions, 5 file recovery/promotion assertions, and 5 post-promotion restart assertions.
- Normal-window measurements stayed identical across empty, text, one file, multiple files, overflow, and reopened file states: dialog height 429.703125px, Add a file top 294.703125px relative to dialog, footer top 359.703125px. At a 380x480 window, empty/file states both measured 408px high, with Add a file at 273px and footer at 338px.
- Light/dark screenshots were inspected for empty/text/file/overflow states and the small window. Footer labels, internal scrolling, readable disabled controls, and unchanged three-button design passed.
- Genuine batch-save failure preserved all files; retry reused the same identities. Items could be organized independently. Three single-file entries, their bytes, ownership, and IDs survived a subsequent process restart; replay added no duplicates.
- Direct placement handled all 13 attached files through the shared picker without a companion note. Focused cases also verify vault moves, collision numbering, original bytes, partial failures, cleanup, and recovery.
- Candidate bundle comparison: 178 factories before and after; only lib/ui/quick-add.js and lib/services/quick-add-draft.js changed. No factories were added or removed. Native task and location factories are unchanged.
- Plugin data.json and System/Hub-shared-projects.json SHA-256 hashes match their pre-change values. No migration, commit, push, or merge occurred.

UI verification uses real Obsidian Modals and vault APIs in a disposable vault, with deterministic task replies. Native SQLite behavior is tested separately. File-input checks use synthetic FileLists and intercept the picker click; the operating-system file dialog was not manually driven. The live user vault was not reloaded or used for write tests.

Evidence: C:/Users/EL_BAR~1/AppData/Local/Temp/hub-capture-runtime-6KAF0O (four JSON reports and screenshots).

Pre-change backups, candidate, data hashes, and complete Obsidian log: C:/Users/EL_BAR~1/AppData/Local/Temp/itacan-fixed-capture-ba8fb3da-5ae0-4d41-87a9-31595d557eba.

Restart Obsidian to load the installed JavaScript.
