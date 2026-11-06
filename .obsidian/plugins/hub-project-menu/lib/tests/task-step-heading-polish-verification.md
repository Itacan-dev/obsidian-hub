# Steps chevron and progress wording — 2026-11-06

Implemented and installed. The running Obsidian session was not reloaded.

## Changes

- The shared `createTaskChecklist` heading now renders `0 of 1 step`, `1 of 2 steps`, etc. Singular/plural depends only on the total count. Existing completion and pending-draft calculations are unchanged.
- Numeric progress remains in its existing `--text-muted`, polite-live span. That span and the trailing `step`/`steps` wording now share one nonwrapping label, preserving the original label origin and chevron gap without the old sibling-span negative margin. Font size, weight and line height remain inherited as before. Accessible expand/collapse labels use the same phrase.
- Nonempty headings use `--background-modifier-border-hover` for the chevron, exactly matching the guideline. Hover and keyboard focus use `--text-muted`. Existing 16×16 SVG dimensions and 1.5 stroke remain unchanged. The empty Add steps/list-tree action retains its styling and behavior.
- Shared headings now have the same 1px muted keyboard outline already used by the dialogs; this supplies visible focus in Tasks panels without adding default borders/backgrounds or animations.
- Home, Project, Resource, Add and Edit all use this component. The established horizontal alignment, vertical spacing, step rows, guideline and contextual controls are unchanged. No task operations, storage, locations or picker code changed.

## Validation

`task-step-heading-polish.html` passed in desktop dark theme (1100×900) and narrow light theme (390×720 at DPR 1.5). The final narrow run passed **730 checks**. It covers all five surfaces; singular/plural examples including 3 of 5; computed chevron/guide color equality; expanded/collapsed direction; hover and trusted keyboard focus/activation; muted numeric text; original SVG geometry; guide/checkbox alignment; unchanged icon-to-label spacing; panel widths 480 and 190px; up to 99 of 100 steps without label overflow; immediate completion/Add/Delete counts; pending drafts; and restoring Add steps after the last deletion. Screenshots were inspected.

Existing browser regressions passed:

- Add/Edit interactions and contextual controls: **281 checks**.
- Panel alignment, compact styling and parent geometry: **4,559 checks**. Only its old `2/2` assertion changed to expect `2 of 2 steps`.
- Add/Edit vertical spacing and internal geometry: **3,037 checks**.

**42 Node tests passed**, zero failures/skips, covering native task engine/application/presentation, locations and dates. Strict/noEmit TypeScript task-contract checking passed. Production build passed (**177 main / 27 native modules**), along with JavaScript syntax and CRLF-aware whitespace checks.

Browser validation uses actual UI modules, native Obsidian CSS and dashboard styles with a **mocked Obsidian API/Markdown host**, not the running application.

Run from the plugin directory, with `HUB_TEST_PREVIEW` set to the file URL of extracted native CSS:

```text
node lib/tests/run-browser-test.js task-step-heading-polish 1100x900
node lib/tests/task-editor-step-context.cjs
node lib/tests/run-browser-test.js task-panel-step-alignment 1100x900
node lib/tests/run-browser-test.js task-editor-step-spacing 1100x900
```

Use `HUB_TEST_DPR=1.5`, `HUB_TEST_HOME_SOURCE=light` and viewport `390x720` for the light/narrow case. Evidence: `%TEMP%/hub-step-heading-{home,project,resource,add,edit}.png`; interaction evidence: `%TEMP%/itacan-step-context-gmrhfw/`.

Only `main.js` was installed from the disposable build. Exact normalized comparison confirmed it differs from the previous installed bundle solely by the reviewed shared heading edits. Previous bundle/staging: `%TEMP%/itacan-step-heading-cd52a83e63994feba859e31c3928d619/`. Installed SHA-256: `e17dd75c199f873f2b9c42d40c29aae6bd5d9364f31bb9d547cfefbae6a8d85e`.

Changed source: `ui/task-card.js`, `styles.css`; rebuilt `main.js`. Added this report and the heading browser fixture; updated one wording assertion in the existing panel fixture. Earlier checkout edits and native task data were preserved.
