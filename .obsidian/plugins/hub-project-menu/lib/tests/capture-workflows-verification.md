# Compact capture and shared location verification

Implemented 2026-11-10. Existing user notes, task storage, Inbox records, and settings were not migrated. The installed JavaScript bundle was rebuilt from the existing working tree with only the scoped capture factory changes. Unrelated working-tree changes were preserved.

## Behavior and boundaries

- Quick Add automatically chooses text or file capture. There is no mode selector and mixed captures remain rejected. Specify offers Task / New note / Add to existing note for text, and File location for files.
- Task opens the existing Add Task modal. Its design, native ownership, task location references, creation defaults, and hidden recurrence entry point remain intact.
- Task, Note, Text, and File Location share the existing breadcrumb modal implementation. Capture browsing does not depend on SQLite readiness.
- Note Location has one editable title field. Text Location appends to the bottom of an existing Markdown note. Ordinary file placement creates files only. Existing vault references are moved; external originals are untouched.
- Send to Inbox keeps Quick Add open, clears only after persistence, restores focus, announces success, and updates the badge. Transfer uses one metadata save and a stable capture ID.
- Escape, backdrop, and close preserve drafts. Clear explicitly discards unfinished input. A source with an unresolved operation must be retried/reviewed or sent to Inbox before it can be cleared.
- Inbox uses the same editor/picker flow, retains source edits on cancellation, and resumes selection for consecutive processing. Legacy mixed items and saved structural insertion operations remain readable; merely cancelling a picker preserves a legacy heading-position draft.
- Undo is deferred.

## Storage and integration

The optional `inbox.quickAddDraft` is a private, versioned sibling of `captures`. It contains an ID, monotonically increasing revision, original text or attachment references, source, per-action drafts, and an operation when needed. It is excluded from the visible Inbox count. No new top-level managed-storage scope is introduced.

`quick-add-draft.js` supplies serialized checkpoints, stale-save protection, atomic Inbox promotion, and draft-aware attachment lifetime. Each planned import path is persisted before bytes are copied. An interrupted copy can therefore leave a visible missing-file reference; it cannot create an undiscoverable draft copy. Missing references can be removed. Normal dismissal awaits a successful checkpoint; abrupt termination before the latest text checkpoint completes remains a bounded persistence window.

The existing creation service resolves either an Inbox capture or the private draft by ID. It retains native operation/task IDs, file plans and hashes, and insertion before/after hashes. Source cleanup completes inside the awaited operation. Ambiguous outcomes preserve source evidence instead of creating another item. The missing note-insertion retry validator is restored.

`capture-flow.js` supplies the common UI handoff and capture eligibility adapter. `openLocationPicker` is the configurable modal; `openTaskLocationPicker` remains its task-compatible wrapper. The existing task editor adds optional `onDraftChange`, `beforeClose`, `submit`, and `onDismiss` hooks. Its terminal result distinguishes created, cancelled, and failed opening. Unavailable saved owners/locations are preserved until explicit replacement.

The old capture forms remain available as source compatibility modules but are absent from the installed bundle. Their note-title helper now comes from the shared Inbox domain utility.

## Validation

- 70 passing Node runner entries covering capture operations, atomic storage, shared/private isolation, Markdown insertion, native SQLite application behavior, task defaults/ownership/replay, editor initialization, and source/bundle loading.
- Updated Inbox browser fixture passes in hidden Electron.
- 41 passing genuine Obsidian UI/vault checks across three separate processes using a disposable vault/profile. Native command replies are deterministic in this UI fixture; real SQLite semantics are covered separately by the native application/default-location tests.
- Genuine checks include Task Location compatibility, Escape/backdrop dismissal, Enter submission, failed-save preservation, successful save focus, direct note/append/file output, unsupported task-runtime availability, Inbox continuation, global controls/badge updates, invalid saved owners, legacy positions, text/action restart persistence, and attachment bytes after a second restart.
- Screenshots inspected for the shared pickers, existing task editor, Inbox, and compact Quick Add in light/dark palettes. No live user-vault creation or conversion was performed for testing.

Reproduce from the vault root:

```powershell
node --test .obsidian/plugins/hub-project-menu/lib/tests/capture-workflows.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/note-insertion.test.js .obsidian/plugins/hub-project-menu/lib/tests/task-location-formatting.test.js ItacanTaskCore/vnext/tests/application.test.cjs ItacanTaskCore/vnext/tests/location-defaults.test.cjs ItacanTaskCore/vnext/tests/location-editor.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/data-store.integration.test.js .obsidian/plugins/hub-project-menu/lib/tests/shared-projects.integration.test.js .obsidian/plugins/hub-project-menu/lib/tests/plugin-load.test.js
node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/browser-launch.cjs inbox
node .obsidian/plugins/hub-project-menu/lib/tests/run-capture-obsidian-test.cjs
```

The genuine runner requires the existing development Electron installation and local Obsidian archive. It never opens the Work vault. To validate a candidate build before installation, pass the build output directory as its argument.

Final genuine evidence: `C:/Users/EL_BAR~1/AppData/Local/Temp/hub-capture-runtime-JQRSRM`.
Pre-change source/build backups: `C:/Users/EL_BAR~1/AppData/Local/Temp/itacan-capture-implementation-b5b28316-8696-473e-9485-fd4717434911`.

Restart Obsidian to load the installed JavaScript. No live plugin reload or application restart was performed as part of installation.
