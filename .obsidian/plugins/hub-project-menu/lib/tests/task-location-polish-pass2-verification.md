# Task location picker: UI polish pass 2

2026-11-04. Implemented and rebuilt in Work; no commit or push.

## Changes and shared conventions

- Shortened subtitle to Choose where this task belongs. Title, map-pin icon, shared header typography and native close chrome remain intact.
- Added Workspace and Location sections using the actual `hub-oath-section` h3 typography and 14px heading-to-control gap. Reused Oath's 20px post-divider and 24px inter-section spacing. There is no separator between sections.
- Kept the workspace cover/title/type row. Its Lucide chevron is right when collapsed and down when expanded, including selection, toggle, outside click and Escape dismissal.
- Reused `openTaskPopover` for its anchored top-layer overlay, viewport fitting, modal focus scope, outside-click/Escape handling and focus restoration. Removed its visible heading/close chrome locally in this picker; no shared popover implementation was changed. Menu width matches the selector, maximum height is 320px with internal scrolling, and the current option is scrolled into view when reopening long menus.
- Used `hub-button-plain` and scoped component styles so shared raised-button rules cannot reintroduce borders or shadows on workspace/folder/note rows. Rows are 32px high, with subtle corner rounding, neutral hover and the existing purple selection background. The navigator retains its outer border and icons.
- Breadcrumb ancestors are muted, the selected destination is emphasized, hover brightens/underlines text without a filled background, and keyboard focus has a restrained outline.
- The navigator can shrink within the bounded dialog on smaller screens, avoiding a second body scrollbar in the tested sizes. Header/footer and the underlying layout remain stable when opening the menu.

No design deviations were necessary. This pass does not change location-selection semantics, context-aware defaults, creation-order metadata, task storage, ownership, Phase behavior, or native task service logic. Existing cover/fallback rendering is unchanged.

## Verification

- Browser harness: 85 assertions at each of 1024x900, 600x780, 390x720 (dark), and 560x900 (light), all passed. Verifies Oath heading parity and spacing, chevrons, overlay alignment/size/no layout movement, compact borderless rows, long-name/path bounds, section alignment, empty/short/long folder layout, selection/navigation/persistence callbacks and dismissal.
- Additional actual Chrome CDP pointer and keyboard checks passed in all four configurations: selected-note hover stays purple; unselected hover differs; breadcrumb hover is transparent/underlined/brighter; breadcrumb keyboard focus is visible without a fill; Enter opens/selects workspaces; End/ArrowDown navigation works; a selected option is visible after reopening long menus; Escape and an outside pointer click dismiss without changing the selection. Collapsed and expanded screenshots were inspected, including narrow dark and light layouts.
- Focused regressions: 29/29 passed, zero failures/skips. Suites: location-defaults, location-editor, application, presentation and existing workspace-thumbnail fallback checks. Covers Home/workspace defaults, invalid locations/owners, creation recency, explicit contexts, restart/edit behavior, atomic operations and presentation.
- TaskCore strict/noEmit declaration fixture: TypeScript 6.0.3, zero diagnostics.
- Disposable production build: main.js 177 modules; atlas-native.cjs 27 modules. Generated main.js passed syntax checking. Only the tested main.js was installed; other built sidecars were not replaced.
- CRLF-aware Git whitespace check passed.

Browser fixtures use the actual picker/header/popover/thumbnail source with synthetic Modal/vault adapters. The live Obsidian session was not reloaded. Reload the plugin or restart Obsidian to load the rebuilt JavaScript. No live task data was modified; native tests used disposable fixtures. Pre-existing workspace edits and the user's task stream were left intact.

## Files changed in this pass

- lib/ui/task-location-picker.js
- styles.css
- main.js (generated)
- lib/tests/task-location-polish-browser.js
- lib/tests/task-location-polish-browser.cjs
- lib/tests/task-location-polish-pass2-verification.md

Installed main.js SHA-256: `572b7c5c6f835fbfb63a528a37badb95c27cf15c7eba2c3c1146d756b66a4560`.
Prior main.js backup: `%TEMP%/itacan-task-location-polish-pass2-build/main.before-pass2.js`.
Final collapsed/expanded browser screenshots: `%TEMP%/itacan-location-browser-BRkVmQ/`.
