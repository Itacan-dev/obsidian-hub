# Task location picker: UI polish pass 4

2026-11-04. Implemented and rebuilt in Work; no commit or push.

## Requested refinements

- Picker receives the current title directly from the Add/Edit title input, including unsaved changes. The native capture form also forwards its current title. Opening or cancelling the picker does not change or persist the title.
- Reuses the Progress report's `hub-window-title-row` convention alongside the existing shared icon/title/subtitle. The task name is right-aligned, uses the heading's theme typography with muted coloring, and is informational rather than editable/focusable. Separate quote spans keep quotation marks visible while only the name text ellipsizes. The shared row's right padding reserves close-button space. Empty/whitespace-only titles create neither a name nor a contextual row.
- Full-title hover tooltip reuses Itacan's native tooltip/detail-tooltip styling, wraps the complete title, fits within viewport margins and is capped at the existing 280px preview height with internal scrolling for exceptionally long titles. It uses the existing 1-second tooltip timing convention, preserves accessible full text, and removes its timer/listeners/tooltip on close. Resize/outer scrolling dismisses it; scrolling inside it remains possible.
- Desktop width is 680px, retaining the existing viewport width cap and vertical limits. Workspace selector, breadcrumb and navigator naturally use the available width.
- Removed the Location-specific heading-gap override. Workspace and Location both inherit the same 14px Oath heading/control gap. The breadcrumb-to-navigator gap stays 8px.
- Dropdown category headings now use the shared heading token (16px at normal base size), semibold, above the unchanged smaller option text. Padding increases from 8px/6px to 12px/8px with an 8px gap beneath the heading divider. Resources-first ordering, all three separators, 32px borderless option rows, active/hover states, overlay geometry, scrolling, chevrons and dismissal remain intact.

No design deviations were required. Selection, breadcrumb navigation/highlighting, default locations, native ownership/storage and footer actions are unchanged. Shared header/tooltip implementations and unrelated dialogs were not modified.

## Verification

- Browser harness passed 136 assertions at 1024x900 dark and 135 each at 600x780 dark, 390x720 dark and 560x900 light: 541 assertions total. Includes existing picker interactions plus named/blank/long title cases, quoted/truncated text, unchanged header height/title/subtitle alignment, close-button clearance, informational semantics, responsive bounds, equal section gaps and larger semibold category headings.
- Actual Add/Edit editor callbacks were exercised with a minimal form renderer: the title input deliberately differed from the saved/state title, and each picker received the current unsaved input. Opening/cancelling preserved that input and performed no task write.
- Additional Chrome CDP pointer/keyboard checks passed in all four configurations, including full-title tooltip content, wrapping, viewport bounds, internal scrolling and close cleanup. Existing breadcrumb and dropdown pointer/keyboard checks passed as well.
- Focused default/editor/application/presentation/workspace-thumbnail regression selection: 29/29 passed, zero failures/skips.
- TaskCore strict/noEmit declarations: TypeScript 6.0.3, zero diagnostics.
- Production build passed: main.js 177 modules; atlas-native.cjs 27 modules. Generated main.js and changed native-capture source passed syntax checks. Only the tested main.js was installed; other generated sidecars were not replaced.
- CRLF-aware Git whitespace check passed. Named-header screenshots at desktop/narrow sizes and wrapped tooltip captures were inspected.

Browser checks use actual picker/header source with synthetic Modal/vault adapters; Add/Edit callback integration uses a minimal live-form renderer. The live Obsidian session was not reloaded. Reload the plugin or restart Obsidian to activate the JavaScript changes. All native regression data was disposable; live tasks and pre-existing workspace edits were left intact.

## Changed in this pass

- lib/ui/task-location-picker.js
- lib/ui/task-editor.js (forward current input title)
- lib/ui/native-capture-task.js (forward current input title)
- styles.css
- main.js (generated)
- lib/tests/task-location-polish-browser.js
- lib/tests/task-location-polish-browser.cjs
- lib/tests/task-location-polish.html (tooltip fixture styling)
- lib/tests/task-location-polish-pass4-verification.md

Installed main.js SHA-256: `4c8b14692017f9a4d05c9aa6b02a3edcfba790c4d9d213585ab8de04ba046a1d`.
Prior bundle backup: `%TEMP%/itacan-task-location-polish-pass4-build/main.before-pass4.js`.
Final browser screenshots: `%TEMP%/itacan-location-browser-ThPRl1/`.
