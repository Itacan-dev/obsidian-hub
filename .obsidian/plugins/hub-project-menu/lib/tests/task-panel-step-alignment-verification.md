# Tasks panel Steps alignment — 2026-11-06

Implemented and installed. The running Obsidian session was not reloaded.

## Cause and change

Panel Steps remained nested in the title/information column, placing their guide one checkbox column plus the card gap to the right of the parent checkbox. Add/Edit already mounted its checklist across the task grid.

The shared panel binding now opts into the same grid-spanning relationship for Home, Project and Resource Tasks bodies. It mounts the existing checklist directly in the task row and marks it `hub-task-panel-steps`. Its guide and chevron centers derive from the existing checkbox-size token. Child padding preserves the original guide-to-checkbox/text spacing. No negative margins or transforms were added.

Normal tasks retain the original title/location block in row 1 and use row 2 for Steps. Workspace-root tasks retain their existing title/metadata subgrid tracks and use row 3 for Steps. The information subgrid ends after metadata so it cannot intercept checklist pointer events. Removing the otherwise newly introduced outer row gap preserves the original vertical spacing.

All parent content stays in its original columns. Step typography, checkbox sizes, compact row heights, guide style and extent, progress color, disclosure state and completion callbacks remain unchanged. Empty tasks retain their original layout. Schedule cards and Oath selection rows do not opt in. Add/Edit and Capture source and styling were not changed.

## Verification

- New `task-panel-step-alignment.html`: **4,559 checks passed** at panel widths 480, 280 and 190px. Before/after use the same production modules; the baseline disables only the new alignment opt-in. Coverage includes all three panel contexts, root/folder/note locations, bare roots, importance, dates, information icons, Phase metadata, wrapped titles/descriptions, completed/incomplete Steps, empty tasks, collapsed/expanded state, exact guide/checkbox centers, parent element rectangles, child spacing, typography, guide appearance/extent and compact row heights. Trusted pointer/keyboard checks cover root-task disclosure, completion/uncompletion, progress refresh and parent editing. Schedule/Oath exclusions are checked.
- Existing Add/Edit `task-editor-step-context.cjs`: **281 checks passed**, including alignment, contextual controls, wrapping, drag/reorder, touch access, editing, completion, deletion, pending drafts, saving, reopening and cancellation.
- **42 Node tests passed**, zero failures/skips: native engine, application, presentation, location formatting and date presentation. Includes atomic Step persistence, stable IDs/order, completion, deletion, restart and Oath behavior.
- Strict/noEmit TypeScript check of `ItacanTaskCore/vnext/tests/types.fixture.ts` passed using the installed TypeScript compiler.
- Production build passed: **177 main modules / 27 native modules**. Changed JavaScript syntax checks and CRLF-aware whitespace checks passed.

Browser verification uses actual UI modules, dashboard styles and native Obsidian CSS with a **mocked Obsidian API/Markdown host**, not the running application. Home, Project and Resource comparison screenshots were visually inspected. Long step descriptions naturally use the newly available width; no row-height or font rules were changed.

Run from the plugin directory with `HUB_TEST_PREVIEW` set to the file URL of extracted native Obsidian CSS:

```text
node lib/tests/run-browser-test.js task-panel-step-alignment 1100x900
node lib/tests/task-editor-step-context.cjs
```

Evidence: `%TEMP%/hub-task-panel-step-alignment-frames.json`, `%TEMP%/hub-panel-step-alignment-{home,project,resource}.png`; Add/Edit evidence: `%TEMP%/itacan-step-context-nP6qJ5/`.

Only `main.js` was installed from the disposable build. Exact normalized comparison confirmed that its changes from the previous installed bundle consist solely of the three reviewed panel-binding edits. Previous bundle/staging: `%TEMP%/itacan-panel-step-alignment-56e0491b0bc446dc892506b65613b128/`. Installed SHA-256: `c952f548b389875f6c98030333599622db547d1bfd2475d6e057854daec47f35`.

Changed source: `ui/tasks.js`, `ui/task-steps.js`, `styles.css`. Added this report and the browser fixture; rebuilt `main.js`. Earlier checkout edits were preserved; no native task data was changed.
