# Quick Add and Inbox UI polish

Implemented and installed on 2026-11-10.

## Result

Quick Add presents Task, New note, and Add text to note as equal horizontal secondary actions, with icons above labels. Empty and whitespace-only captures disable them. Specify and the footer status area are removed. Draft persistence is silent; genuine errors remain visible and successful Inbox persistence uses the existing Notice.

File captures show their attachment list, Add a file, and File location. Consecutive selections append files without duplicating an already attached file. Individual removal restores the empty state after the final file.

Inbox text actions are three full-width secondary rows with matching labels and icons. Ordinary file captures show only File location; legacy mixed and explicitly typed file-note/recovery records retain their note route. Native tasks, picker designs, storage format, ownership rules, recovery receipts, and mixed-capture validation are preserved.

## Modified files

Paths are relative to `.obsidian/plugins/hub-project-menu/`.

| Files | Change |
|---|---|
| `lib/ui/quick-add.js` | Direct contextual actions, consecutive file entry, compact footer, silent checkpoints, success Notice. |
| `lib/ui/inbox.js` | Shared labels/icons and stacked secondary processing rows; legacy routes retained. |
| `lib/ui/capture-actions.js` (new) | Shared action definitions and ordinary action buttons without selected/toggled state. |
| `lib/ui/icons.js` | Reusable notebook-plus fallback on the Lucide grid with a prominent plus. |
| `lib/services/quick-add-draft.js`, `lib/services/inbox.js` | Narrow optional draft-import duplicate filter; journaling, ownership, collisions, rollback, and cleanup retained. |
| `styles.css` | Equal-width action grid, compact file row, stacked Inbox actions, readable disabled opacity; obsolete Specify/status rules removed. |
| `main.js` | Rebuilt and installed bundle, 178 modules. |
| `lib/tests/capture-workflows.test.cjs`, `lib/tests/icons.test.js` | Consecutive additions, restart, identity/content deduplication, collisions, and icon checks. |
| `lib/tests/inbox-browser.js` | Fast browser fixture updated for direct actions. |
| `lib/tests/capture-obsidian-fixture.cjs`, `lib/tests/capture-obsidian-host.cjs` | Genuine Obsidian direct-button, multi-file, restart, geometry, hover, theme, and narrow-window checks. |
| `lib/tests/capture-polish-verification.md` (new) | This report. |

## Duplicate identity

An already attached vault file retains one live reference. Known external paths with matching contents suppress duplicates; distinct known paths and changed contents are retained. When no original path is exposed, matching filename and exact contents suppress a duplicate. No stored hash field or data migration is introduced.

The filter runs inside the existing serialized import operation. Planned paths are still persisted before new bytes are copied, and existing captures/references remain intact.

## Verification and limitations

- 74/74 Node runner entries passed: capture workflows, icons, atomic storage, shared/private isolation, note insertion, location formatting, native SQLite application/default/editor behavior, and source/bundle loading.
- Existing Inbox browser fixture passed in hidden Electron.
- 84 genuine Obsidian UI/vault checks passed across three processes: 76 workflow/visual checks, 4 text/action/file persistence checks, and 4 multi-file restart checks.
- Light/dark screenshots inspected for Quick Add empty/text/file states and Inbox text/file states. Quick Add was also verified at a 380px window width. Equal dimensions, readable labels, normal hover, and absence of selected styling passed.
- Consecutive file-input selections, duplicate selection, individual/final removal, one-capture multi-file Inbox submission, placement, cancellation, badges, and attachment bytes after restart passed.
- Legacy mixed content, saved heading positions, unavailable workspaces, task-editor reuse, and failed-save preservation passed.
- Inbox/settings `data.json` and shared-project metadata hashes match their pre-change values. No user-data migration, push, or merge occurred.
- The candidate changes only the five intended existing capture/icon factories and the new shared action factory. Atlas and native task/location editor factories are unchanged.

UI checks use real Obsidian Modals and vault APIs in a disposable vault, with deterministic task replies; SQLite behavior is tested separately. File-input tests use synthetic FileLists and intercept the picker click. The operating-system file dialog itself was not manually driven. Existing import/save/recovery locks remain in force.

Final genuine evidence: `C:/Users/EL_BAR~1/AppData/Local/Temp/hub-capture-runtime-ZLV6zE`.

Source/build backup and candidate: `C:/Users/EL_BAR~1/AppData/Local/Temp/itacan-capture-polish-b78a549e-a7a5-49ac-9669-d91697ddd4e4`.

Restart Obsidian to load the installed JavaScript. The live application was not restarted or reloaded for testing.
