# Task location polish verification

2026-11-04. Implemented in the Work workspace; no commit or push.

## Result

- Shared native header: Task location, map-pin, and the requested organizational-location subtitle.
- Workspace row reuses the canonical thumbnail renderer and its image/category/Resource/icon fallbacks. The shared task popover preserves modal focus scope, scrolling, outside-click dismissal and Escape behavior. Projects and Resources stay grouped; the selected workspace is purple; long names ellipsize.
- Browsing a folder proposes it immediately. Breadcrumb navigation proposes the destination folder or workspace root. Selecting a note appends its name to the breadcrumb and highlights only that note in purple. Clicking it again restores the browsed folder. Folder/workspace changes clear note selection.
- The breadcrumb is the only selected-location text, keeps parent navigation, bounds long segments and scrolls to its current selection. Removed the folder-selection button, bottom summary, and obsolete footer separator. Confirmation is Select location.
- New Add editors resolve their defaults before opening. Home uses the latest persisted native createdAt across tasks; a workspace uses only its currently owned tasks. Completed tasks remain eligible. Missing latest contexts use the specified root fallback without searching older tasks. Workspace-root entry points supply scope; explicit note/subfolder paths and explicit native contexts win. Existing-task edits continue using read snapshots.
- Native ownership, mutually exclusive context representation, atomic Save, Phase handling, persistence and transport formats are unchanged.

## Checks

- `npm.cmd test --prefix ItacanTaskCore`: 105/105 passed, zero failures/skips. Includes 14 new focused cases for defaults, invalid contexts/owners, completed tasks, creation recency, scoped entry points, pagination, restart persistence, explicit contexts, edit initialization and no visible incorrect initial modal.
- `node .obsidian/plugins/hub-project-menu/lib/tests/task-location-polish-browser.cjs`: 56 assertions per viewport at 1024x900, 600x780, 390x720 (dark) and 560x900 (light), plus two real CDP hover-color checks per viewport. Covers folder/note toggling, breadcrumb updates, confirmation contexts, workspace switching/grouping, keyboard/focus, stale locations, long names/deep routes, scrolling and bounds. Screenshots inspected at narrow dark and light sizes.
- Existing workspace-thumbnail test passed, including broken-image fallback and unchanged metadata.
- TaskCore declaration fixture: TypeScript 6.0.3, strict/noEmit, zero diagnostics.
- Changed production JavaScript and generated bundle passed `node --check`.
- Production build passed: main.js (177 modules), atlas-native.cjs (27 modules). Installed only the rebuilt main.js; styles.css is updated directly. Other generated sidecars were not replaced.
- Whitespace verified with CRLF-aware Git checking, consistent with the existing bundle builder.

## Limits and preservation

Creation timestamps have millisecond precision; equal timestamps use a stable task-ID tie-break. If the required fallback workspace/root itself is unavailable, creation reports an error instead of guessing another location. Defaults read existing paginated repository data, without a separate preference/history store.

Browser verification uses actual picker/header/popover/thumbnail source with a synthetic Obsidian Modal/vault fixture. The running live Obsidian session was not reloaded or used to create tasks. Reload the plugin or restart Obsidian to load the rebuilt bundle. All native tests use disposable databases and fixtures; no live task data was modified and no live migrations were run.

Installed main.js SHA-256: `dbd2f5b5f96dfbc61271dfd893a22d2a4eb1415617d8f09fdff4593a2eca2631`.
Prior bundle backup: `%TEMP%/itacan-task-location-polish-build/main.before-polish.js`.
Final browser screenshots: `%TEMP%/itacan-location-browser-YyUty1/`.
