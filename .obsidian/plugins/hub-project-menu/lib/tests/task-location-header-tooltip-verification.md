# Task location header alignment and tooltip correction

2026-11-04. Implemented and rebuilt in Work; no commit or push.

## Focused correction

- Reused the actual Progress report `hub-window-header-date` class for the task-name context. This supplies the existing maximum 45% width, shrinking behavior and right alignment. Removed the capture heading's duplicate right margin while keeping the shared title row's close-button padding. No arbitrary placement offsets were introduced. The title/subtitle/icon positions, task-name typography/quotes, 680px modal width and vertical geometry remain unchanged.
- Short, medium and long task names share a fixed right edge. Long text ellipsizes inside the constrained right-side region; separate quotation spans remain visible and do not collide with the heading or close-button area.
- Repaired the tooltip to show on actual pointer movement and on keyboard focus, following the existing immediate Itacan preview convention. The task name is a focusable informational span with no click/edit action. Pointer departure and focus loss dismiss the tooltip; Escape hides it without closing the picker. Tooltip text is the complete original draft title, not the truncated display.
- Tooltip remains within its owning modal and enters the native popover top layer. Uses installed Obsidian/Itacan `--tooltip-background`, `--tooltip-color`, `--tooltip-shadow`, `--tooltip-radius` and `--tooltip-padding` tokens, with a dark/light-text fallback. It wraps within viewport bounds, supports scrolling beyond its 280px maximum height and cleans up on close. Installed Obsidian 1.15.0 app.css tooltip rules/tokens were inspected directly to check compatibility.

No task/default/persistence services, editor data flow, body controls, footer actions, shared header implementation or unrelated dialogs were changed. Existing task-location-display edits and user task streams were preserved. No design deviations were required.

## Verification

- Picker/browser fixture: 151 assertions at 1024x900 dark; 150 each at 600x780 dark, 390x720 dark and 560x900 light: 601 total, all passed. Added short/medium/exceptionally long title checks; actual Progress report date right-edge comparison; maximum 45% width and right-half containment; quote/close-button clearance; uniform header height and title/subtitle placement; focusable noneditable/nonclickable semantics.
- Additional real Chrome CDP pointer/keyboard checks passed in every configuration: complete draft tooltip on long-name and short-name hover, keyboard Shift+Tab focus disclosure, dismissal on pointer leave/Tab blur, wrapping, viewport bounds, scrolling and close cleanup. Existing folder/note/breadcrumb/menu pointer and keyboard checks remain passing. Desktop header and light-theme tooltip screenshots were inspected.
- Existing task-location-display browser regression: 25 assertions per viewport/theme, 100 total, plus real keyboard/hover checks, all passed.
- Focused default/editor/application/presentation/thumbnail tests: 29/29 passed, zero failures/skips.
- Strict/noEmit TaskCore declaration fixture: TypeScript 6.0.3, zero diagnostics.
- Production build: main.js 177 modules; atlas-native.cjs 27 modules. Bundle syntax and CRLF-aware whitespace checks passed. Git emitted only line-ending advisories for pre-existing task-card/task-live-form edits, which were not modified here.

Browser tests use actual source with isolated Modal/vault adapters and a minimal form renderer for Add/Edit callbacks. Native installed tooltip CSS was inspected, but the running Obsidian session was not reloaded. Reload the plugin or restart Obsidian to load the rebuilt bundle. No live task data was modified; native tests use disposable fixtures.

## Changed in this correction

- lib/ui/task-location-picker.js
- styles.css
- main.js (generated)
- lib/tests/task-location-polish-browser.js
- lib/tests/task-location-polish-browser.cjs
- lib/tests/task-location-header-tooltip-verification.md

Installed main.js SHA-256: `b67ef4929c0871cb34caf2d960821ff005542be8ad7873a0b032d5538ae19d8b`.
Prior bundle: `%TEMP%/itacan-task-location-header-fix-build/main.before-header-fix.js`.
Header/tooltip browser captures: `%TEMP%/itacan-location-browser-v6Lu8a/`.
Location-display regression captures: `%TEMP%/itacan-location-browser-70O7Of/`.
