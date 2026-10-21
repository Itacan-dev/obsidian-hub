# Task editor Step polish — 2026-10-15

Implemented and installed for user review. Obsidian was not reloaded or restarted.

## Ownership and implementation

- `ui/task-editor.js` owns ordinary Add/Edit modals, snapshot copying, opening/focus and Save/Cancel. It now passes `initialStepsOpen` only for Edit snapshots containing saved Steps.
- `ui/task-live-form.js` is the editor adapter over `createTaskRow`, `mountTaskCardPresentation` and `createTaskChecklist` in `ui/task-card.js`. Previously its local `openSteps` always started `false`. It now seeds that local value once from the construction option, guarded by a nonempty saved checklist. Refreshes, title edits, specification changes and progress updates continue using the same local disclosure controller. No timers, synthetic clicks, animation or persisted preference were added.
- `ui/task-form.js` still owns confirmed and pending Step editing, validation/readiness, the native disabled Add button, its pointer focus guard, keyboard/IME behavior and Step persistence boundaries. It is unchanged.
- `ui/task-steps.js` still owns panel-local disclosure, initially collapsed, and panel completion behavior. It and the shared renderer are unchanged. Add continues to default to an empty Add steps action and creates/focuses its first pending Step only on activation.
- `styles.css` now compensates for the Lucide circle-plus viewBox inset, using the existing checkbox column token. The common enabled/disabled SVG rule is `column * 24 / 22` with stroke width 2; a fixed-height wrapper centers it without changing the row or label. No disabled transform, opacity reduction or additional Step CSS component was introduced.

## Measured cause and result

The baseline reproduced collapsed Edit checklists. It did **not** reproduce a disabled-only text or SVG CSS reduction: both readiness states already had identical geometry. The apparent icon undersizing was real: a 16px SVG with Lucide's `r=10` circle and 2-unit stroke paints an outer circle of only 14.67px. Faint color also makes the smaller circle less prominent. Existing text conventions were already correct and were retained.

Actual Chromium measurements in both Add and Edit, desktop and 360×640 at DPR 1.5 (CSS pixels):

| Measurement | Before | After |
| --- | ---: | ---: |
| Step checkbox outer box | 16 × 16 | 16 × 16 |
| circle-plus SVG bounding box | 16 × 16 | 17.453 × 17.453 |
| Circle outer diameter, including stroke | 14.667 | 15.999 |
| Lucide stroke in SVG coordinates | 2 | 2 |
| Step input and Add label font size | 12.48 | 12.48 |
| Step input and Add label line height | 17.472 | 17.472 |
| Step input and Add label font weight | 400 | 400 |
| Add row height | 23.469 | 23.469 |
| Icon column / column-to-label gap | 16 / 8 | 16 / 8 |

Enabled and disabled SVG, label and row positions/dimensions match. The SVG extends symmetrically beyond its 16px wrapper; its painted circle now fills that column. Thus the SVG-box-edge gap becomes 7.266px while the painted-circle-to-label gap is approximately 8px. Label placement is unchanged. Disabled icon/label resolve to `--text-faint`; enabled to `--text-normal`. Stroke, opacity and transforms do not change with readiness.

## Verification

Evidence and backups: `System/Backups/task-editor-step-polish-20261015/` relative to the vault.

- New actual-editor fixture `task-editor-step-polish.html`: **109 checks per layout**, both passing. Covers zero/one/multiple saved Steps, first pre-paint state and subsequent frame stability, ordering/completion, empty Add, manual collapse through specification/title/live refresh, trusted disabled pointer no-op, exact geometry across readiness, short/wrapped text, exactly-once next-Step creation, native focus, draft isolation, Save/reopen and no persisted disclosure preference.
- **14 existing browser fixtures pass at both desktop and narrow/150%**: `task-step-alignment`, `task-card-step-correction`, `task-step-disclosure-refinement`, `task-live-card`, `task-opening`, `task-autofocus`, `task-surfaces-integrated-steps`, `task-step-progress`, `task-inline-accordion`, `task-configuration-layouts`, `task-date-dismissal-pointer`, `task-specification-indicators`, `task-symmetric-content`, `task-title-strikethrough`.
- Only three existing fixtures changed: alignment, card correction and live-card parity. Their old opening click/expectation assumed collapsed Edit. They now assert initial expansion and exercise visible controls directly. Other assertions, including raster border checks, are retained. The first card-correction run also encountered a one-channel corner-pixel mismatch after its outdated collapse click; the corrected visible-control run passes all 480 checks in both layouts.
- **15 Node/domain suites pass**: task form, compact form, layout polish, created completion, progress, history, mutations, workspace, data, creation retry, planning, typography, project planning, inbox and icons. Coverage includes Markdown synchronization, IDs, timestamps, nested Steps, rollback/retry and history.
- An additional legacy `task-editor.html` fixture fails before editor interaction with `window.hubCreateTaskRow is not a function`. Its older hand-built module loader does not supply the shared renderer dependency. This fixture was left unchanged; modern actual-editor, shared-panel parity and persistence fixtures above pass. This remains a test-harness limitation.
- Screenshots were inspected at normal scale and in 3× nearest-neighbor crops. Desktop and narrow captures cover initial Edit, disabled/enabled Add, the next pending Step, wrapping and confirmed Steps. Baseline traces remain in the backup root; final traces are in `evidence/`.

## Staging and installation

`build.js --output-dir` generated staged `main.js` (150 modules) and `atlas-native.cjs` (24 modules). The staged plugin passes the isolated CommonJS/module-load check with an Obsidian API stub. Installation asserts that the generated JavaScript differs from the backed-up installed bundle only by the exact initial-disclosure edits. Installed bundle and stylesheet hashes match staging; native and strict assets are unchanged. See `staged-load.log`, `install.log` and `installed-hashes.json`.

This verifies packaging and isolated loading, not a fresh load in the running Obsidian process. Live application review remains for the user, since automatic reload/restart was prohibited.

## Files changed

- `lib/ui/task-editor.js`
- `lib/ui/task-live-form.js`
- `styles.css`
- `lib/tests/task-editor-step-polish.html` (new)
- `lib/tests/task-step-alignment.html`
- `lib/tests/task-card-step-correction.html`
- `lib/tests/task-live-card.html`
- This verification report (new)
- Generated installed `main.js`

All source/test changes are relative to the session's starting contents. Earlier repository edits were preserved, with no commit, reset or application restart.
