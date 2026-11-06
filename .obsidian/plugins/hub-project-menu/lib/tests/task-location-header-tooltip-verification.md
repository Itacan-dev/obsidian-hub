# Task location header alignment and tooltip correction

## Overflow-only tooltip follow-up (2026-11-04)

- Cause: the informational name was the first `tabindex="0"` element, and every focus event opened its tooltip, including modal autofocus. Neither focus nor pointer activation checked overflow. The popup inherited the shared detail tooltip's fixed 360px width.
- The name starts outside the tab order. A fresh Tab gesture inside the dialog makes it keyboard-reachable only when its inner text has `scrollWidth > clientWidth`. Focus disclosure also requires that fresh keyboard gesture; programmatic focus and insertion under a stationary pointer do not open it.
- Pointer movement is handled only on the existing name span, whose natural width, right alignment, visible quotation spans and 45% maximum remain unchanged. Header whitespace, heading and subtitle cannot trigger it. Existing leave/blur/Escape behavior is retained.
- `ResizeObserver` measures the rendered text when its available width changes. A text-only `MutationObserver` updates overflow, the accessible label and active tooltip content when draft text changes. Observers and event listeners are disposed on close; no polling, artificial opening delay or measurement/render loop was added.
- The existing native/Itacan tooltip surface now uses content-sized width, zero minimum width and a 300px maximum. Existing theme padding, colors, border, radius and typography remain; long words wrap and exceptional content scrolls. Placement and size respect viewport bounds. Tooltip content contains the original title without added quotation marks.
- Real Edge CDP checks passed at 1024x900, 600x780 and 390x720 in dark theme and 560x900 in light theme: 1,003 browser-fixture assertions plus real pointer/keyboard checks. Coverage includes initial/programmatic focus, stationary-pointer insertion, short/fitting/truncated titles, exact trigger region, leave/blur/Escape, content-driven width, unbroken wrapping, viewport bounds, window/container resizing, changed drafts, Add/Edit unsaved input, unchanged header geometry and location selection. A short title that actually truncates on a narrow viewport correctly remains eligible.
- Existing task-location-display browser regression: 436 assertions plus real keyboard/hover checks, all passed. Focused task location/default/editor/application/presentation/formatting/thumbnail regressions: 38 tests passed, zero failures/skips.
- TaskCore `vnext/tests/types.fixture.ts`: TypeScript 6.0.3, strict/noEmit, zero diagnostics. The legacy `native-cutover-typecheck.cjs` points to a removed fixture, so the current TaskCore fixture was checked directly.
- Production build passed (177 main modules, 27 native modules); rebuilt main bundle syntax and changed-file whitespace checks passed. Only `main.js` is installed from the disposable build; unrelated generated assets are left in place. No live task data was modified, and no commit or push was made.

Browser evidence: `%TEMP%/itacan-location-browser-P0pEAw/`. Display regression evidence: `%TEMP%/itacan-location-browser-puEAnV/`. Prior bundle and disposable build: `%TEMP%/itacan-task-title-tooltip-00481f37eb044071a7c218663bb930bf/`. Installed `main.js` SHA-256: `9f0676d762a047c6bc52421e8019120c725e0f0153632ccb31744dd72b34c0bf`.

The browser fixtures run the actual picker source with a Modal/vault adapter and shared stylesheet. The running Obsidian session was not reloaded; reload the plugin or restart Obsidian to use the rebuilt bundle.

## Earlier header-alignment pass

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
