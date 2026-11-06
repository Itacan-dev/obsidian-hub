# Add/Edit Steps alignment and contextual controls — 2026-11-05

Implemented in `ui/task-live-form.js` and `styles.css`; rebuilt and installed `main.js`. Existing checkout edits were preserved. The running Obsidian session was not reloaded.

## Implementation

- Ordinary Add/Edit mounts the existing checklist directly in the task card's grid, spanning its checkbox and content tracks. Other composers still mount it under the task information column. The heading, expanded rows, and Add step action move together.
- The guide's center derives from the existing `--hub-task-card-checkbox-size` token. The heading chevron uses the same checkbox width. Existing child spacing, 1px guide, color, list-owned top/bottom extent, card padding, and muted progress count remain intact. No negative margins or transforms were introduced.
- On devices with a fine pointer and hover, confirmed rows hide only their drag/delete buttons using opacity and disabled pointer hit testing. `:hover`, `:focus-within`, and the reorder library's `.is-pointer-dragging` reveal them without transitions. Dragged controls retain the library's pointer isolation.
- Buttons retain their layout boxes, native Tab access, and existing focus indicators. No-hover devices keep the controls visible. Add step and the pending draft's controls retain their existing behavior.
- No panel renderer, persistence code, task operations, or other editor actions changed.

## Verification

`node lib/tests/task-editor-step-context.cjs`: **281 checks passed**. This uses the actual editor/checklist/reorder modules and native Obsidian stylesheet in headless Chromium, with a **mocked Obsidian Modal and in-memory service**, not the running application. `HUB_TEST_NATIVE_CSS` can specify an extracted native stylesheet; the default is `%TEMP%/itacan-native-app.css`.

Coverage includes Add/Edit; empty, one, and five Steps; collapsed/expanded headings; short/wrapped titles and descriptions; native root/note locations and Phase/date metadata; exact guide/checkbox centers; unchanged guide extent and child/Add columns; hidden hit testing; row-local hover and focus; unchanged control/text/row geometry; completed rows; keyboard reorder; pointer drag and drop cleanup; pointer, keyboard, and touch deletion; edit/completion changes; pending-step Save/reopen; Cancel isolation; unchanged Tasks panel geometry and Capture composer hierarchy. Desktop is 1024×900; narrow is 390×720 at DPR 1.5. Screenshots were visually inspected.

Additional checks passed:

- **56 Node tests** across native application, engine/Step persistence, location defaults/editor, presentation, location formatting, and date presentation suites. Engine coverage includes Step IDs, ordering, editing, completion, deletion, atomic saving, and database reopening.
- Existing location-focus browser regression across Add/Edit, root/folder/note, light/dark, pointer and keyboard; location-polish browser regression: **1,003 assertions**, plus trusted input checks.
- Strict/noEmit TypeScript check of `ItacanTaskCore/vnext/tests/types.fixture.ts` using the installed TypeScript compiler.
- Production build: **177 main modules / 27 native modules**; changed JavaScript syntax checks and whitespace check with Git's `cr-at-eol` setting (generated bundle embeds CRLF source).

Only `main.js` was copied from the disposable build. An exact normalized comparison verified that its difference from the pre-session installed bundle was solely the reviewed checklist host change and its comment. Native/generated ancillary assets were not installed.

Evidence: `%TEMP%/itacan-step-context-GSvgTB/`. Previous bundle and staged build: `%TEMP%/itacan-step-polish-eea35a44cba045f8b3e21d6d54e0c86e/`. Installed `main.js` SHA-256: `962eee17d572bb87e5584ab6d9e399aa73f0c1406c5370003354ec523ffcb649`.
