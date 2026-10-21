# Atomic date accordion closing — 2026-10-15

Reproduced with trusted pointer input, corrected, staged and installed for user review. Obsidian was not reloaded or restarted.

## Confirmed cause

The accordion already hid the section synchronously before endpoint cleanup, native-input destruction and focus restoration. No exit animation, timeout or delayed collapse caused the observed intermediate frame. The date blur handler only removed its typing class; it did not rerender the section.

The failure occurred **before the click handler ran**. Chromium's default `mousedown` focus transfer moved focus from the segmented date input to the pressed dismissal control. The section was still expanded until release produced `click`. Any render during that press displayed the unfocused date field, including the lost blue year selection.

The original pointer fixture checked that the old placeholder did not reappear and that the final DOM was collapsed. It did not assert retention of native focus while the section remained visible. The new tests reproduce and inspect that missing stage.

Observed event sequence:

| Before | After |
| --- | --- |
| pointerdown: date focused, section visible | pointerdown: date focused, section visible |
| mousedown default transfers focus | scoped mousedown guard preserves date focus |
| blur/focusout: **section still visible** | pointerup/mouseup: date still focused |
| rendered held-press frames lack selected year | rendered held-press frames retain selected year |
| pointerup → mouseup → click | click runs the existing activation handler |
| click hides section and cleans up | section hidden **before blur/focusout** and cleanup |
| final collapsed frame | first post-activation frame already collapsed |

The exposure window depends on the interval between press and release. These tests deliberately separate trusted press/release and capture three rendered frames during the press; the implementation adds no timing delay.

## Lifecycle correction

`task-accordion.js` now registers one modal-scoped `mousedown` listener, removed on destruction. It acts only when an active date endpoint owns the focused native Date or Time input and the target is an enabled existing dismissal/activation control: specification heading, endpoint footer, Add step action, parent Save/Cancel or modal close control.

The listener prevents the press's **default focus transfer**, while preserving event propagation, normal release/click/submit activation and canceled-drag behavior. The existing click handlers still perform validation, Apply/Cancel, switching or modal dismissal. Their existing close path hides the section before any blur-producing cleanup or focus restoration.

There is no early activation on pointerdown, retained stale draft, fade, overlay or year-selection styling workaround. Native fields, picker/clear targets, unrelated outside interactions, keyboard navigation and non-date sections are excluded. Open native pickers are excluded from the guard, and the existing native-picker Escape priority remains unchanged.

No styles or native date/time, live-form, modal-editor, shared-card or Step implementations were modified. Existing thin focus borders, native blue segment selection, `flag`, 34px symmetric margins, 16px section separation, equal columns/stacking, sticky card and bounded modal regions remain.

## Rendered evidence

Each primary route has real PNG captures before press, during the held press and after activation. Date-crop pixel counts independently confirm the selected native segment's appearance. The counts include blue-classified glyph/antialias pixels as well as selection fill, so desktop blur does not necessarily produce zero.

Representative empty Start heading-toggle measurements; Add and Edit agree:

| Layout | Before fix: focused → pressed | After fix: focused → pressed | First blur while section visible? |
| --- | ---: | ---: | --- |
| Desktop 1100×850 | 541 → 137 blue pixels | **541 → 541** | Before yes; after no |
| Narrow 360×640 at 1.5 scale | 1,106 → 0 | **1,106 → 1,106** | Before yes; after no |

Every fixed held-press sample retains focus while the original section is visible. Every first and subsequent sampled post-activation frame has the old section hidden, **0px height and zero children**. Blur/focusout events occur only when the old section is no longer visible. Before/after screenshots were visually inspected, including the blue year selection during Cancel and the immediately collapsed following frame.

## Dismissal and behavior results

All routes pass for Start and Due, empty and previously configured values, in both Add and Edit and both layouts.

| Route | Verified result |
| --- | --- |
| Heading toggle | Focus retained during press; click collapses; unapplied edit discarded; heading focus restored |
| Cancel | Same atomic close; original parent draft retained |
| Apply | Valid endpoint and midnight update parent draft/live card; immediate collapse and focus restoration |
| Importance, Description, other date | Old controls removed without intermediate blur frame; destination opens exclusively; unapplied endpoint discarded |
| Escape | Immediate section collapse and heading focus restoration; native picker priority preserved |
| Add step | Existing dismissal/Step activation remains; no intermediate unfocused date frame |
| Parent Cancel / close chrome | Modal and endpoint close; no draft date or Step persistence |
| Parent Save | Native click still submits; saves applied parent values and discards the local unapplied endpoint |
| Invalid Apply | Error remains visible in the open endpoint; parent values unchanged |
| Time-focused Cancel | Time retains native focus during press; endpoint then closes atomically |
| Canceled press/drag | No premature dismissal or application; native date remains focused |
| Ordinary header/outside interaction | Existing normal blur remains; no new outside-dismiss behavior |
| Description footer and keyboard Tab | Existing pointer focus and keyboard navigation behavior preserved |

Actual native calendar/clock activation, indicators, clearing, optional time, range validation, Enter, Escape and Alt+Down also pass in the existing native configuration and inline-accordion regressions.

## Tests and installation

- **278 baseline checks per Add/Edit/layout run**, reproducing the unfocused visible field before the production edit.
- **330 fixed checks per Add/Edit/layout run**: four runs, covering 160 primary route/value/endpoint cases plus validation, time focus, drag cancellation, outside interactions and parent Save.
- Existing trusted-pointer fixture strengthened with a focus-during-press assertion: **73/layout**. No unrelated assertion was weakened.
- **37 browser fixture/layout runs pass**, including the focused tests, native configuration controls, accordion, layout/symmetry, indicators, opening/autofocus, shared-card parity, first-click/card/Step correction, integrated Steps, actual title strikethrough pixels, workflows, Step progress, prior configuration polish and desktop modal regions.
- **15 Node suites pass:** task-form, task-compact-form, task-layout-polish, task-created-completion, task-progress, task-history, task-mutations, task-workspace, task-data, task-creation-retry, task-planning, typography, project-planning, inbox and icons.
- Staged build: **150 main / 24 native modules**. Syntax, stubbed Obsidian plugin loading and scoped whitespace checks pass.
- Installed/staged SHA-256 hashes match. Installation explicitly verifies that **only the accordion factory changes in main.js**. CSS, native/strict artifacts and the date/live-form/editor/compact-form implementations are byte-identical to their backups. Unrelated repository changes were preserved.

Tests use isolated Chromium (Microsoft Edge), installed Obsidian CSS/fonts, native editable controls and synthetic vault/services. The described intermediate rendered state was reproduced and eliminated there; the user's running Obsidian instance was not reloaded for live review. Windows sandbox account-lockout error 1909 was handled with the approved execution fallback.

## Modified files

Production: `lib/ui/task-accordion.js`, generated `main.js`.

Verification: strengthened `lib/tests/task-date-dismissal-pointer.html`; new `task-date-closing-atomic-add.html`, `task-date-closing-atomic-edit.html`, shared `task-date-closing-atomic.js`; this report.

## Backups and evidence locations

Vault-relative root: **`System/Backups/task-date-closing-atomic-20261015/`**.

- `source/`, `installed/`: original affected source/tests and installed artifacts.
- `staged/`, `staged-load.log`, `install.log`, `installed-hashes.json`: staging/loading/installation evidence.
- `baseline-*.log`, per-suite logs and Node results: full test outcomes.
- `evidence/lifecycle-summary.csv`: before/after route summaries, first-blur visibility, first post-activation geometry and native selection pixel counts.
- `evidence/before-desktop-add.json`, `before-desktop-edit.json`, `before-small-150-add.json`, `before-small-150-edit.json`: baseline event/frame traces.
- `evidence/desktop-task-date-closing-atomic-add-frames.json` and equivalent Edit/narrow files: final event/frame traces.

Representative PNG triplets inside `evidence/`:

- Before: `hub-date-atomic-before-desktop-add-start-empty-heading-focused.png`, `...-pressed.png`, `...-collapsed.png`.
- After: `hub-date-atomic-after-desktop-add-start-empty-heading-focused.png`, `...-pressed.png`, `...-collapsed.png`.
- After Due/Cancel in Edit: `hub-date-atomic-after-small-150-edit-due-empty-cancel-focused.png`, `...-pressed.png`, `...-collapsed.png`.

Matching Start/Due, Add/Edit, desktop/narrow captures for heading, Cancel, Apply and switching are retained alongside these representative sequences.
