# Refined Add/Edit experience — 2026-10-13

The subsequent [final visual and interaction polish](task-final-polish-verification.md)
supersedes this phase's width and new-Step blur behavior.

The ordinary Add task and Edit task windows now use a quiet checklist and
description display within the existing Task → Location → Properties layout.
The generated reference guided density and alignment; existing Itacan controls,
icons, typography and primary/selection colors remain in use.

## UI and interaction changes

- Desktop width is **780 CSS pixels**, bounded by the existing viewport-width
  rule. Height follows content; no blank area is reserved. In the native-style
  desktop fixture, empty Add measures **780 × 503** and populated Edit with two
  Steps and a multiline description measures **780 × 680**. The existing maximum
  remains `min(900px, 85vh, 100dvh - 48px)`, with fixed header/footer and internal
  body scrolling.
- The main completion checkbox uses the existing native task checkbox treatment
  with a small squared radius and 18px size. Step checkboxes are circular and
  16px, making the parent distinguishable. Completion still changes only the
  pending draft; Save/Cancel and existing progress/history semantics are retained.
- Existing Steps are compact 30px checklist rows. Their text inputs have
  transparent backgrounds/borders when inactive; only the active row gains a
  subtle editing surface. Completed text is muted and struck through, with the
  strike removed while editing. Delete controls are small neutral X actions.
- **+ Add step** opens an ordinary checklist row with its own functional circular
  checkbox, text input and cancel control. Enter validates/confirms it into the
  draft, restores the Add step action below the list, and focuses that action.
  Enter again can immediately begin the next row. Newly confirmed Steps always
  appear above the Add action.
- New-row text and its pending completion survive focus changes. Escape/cancel
  discards only the new row. Save also confirms a valid pending row. Existing
  Step Enter finishes row editing without implicitly submitting the parent task;
  Escape exits that row while retaining its pending text. Empty and copied-ID
  text still use the existing validation rules. IME composition is respected.
- Empty descriptions use the existing **align-left / Add a description** action.
  Editing begins at one line and grows naturally, bounded at `min(280px, 36vh)`.
  Leaving the editor shows a compact readable area containing the complete exact
  text, with a subtle pencil affordance. Click or keyboard Enter returns to
  editing. Escape finishes editing without closing the task window or discarding
  pending text. Clearing the text restores the Add a description action.
- Description display preserves Markdown, whitespace and line breaks using plain
  text with `white-space: pre-wrap`. It has no height cap or truncation; long
  content grows the modal body and remains accessible by scrolling. There is no
  formatting toolbar or permanent empty textarea.
- Location retains its existing full-width two-line selector, hierarchy, search,
  context defaults and relocation. Long selected paths now wrap in the first line
  rather than hiding their content behind an ellipsis.
- Properties retains natural-width neutral Dates, Necessity and applicable Phase
  buttons. No Step button, secondary Not set row or Resource phase was introduced.
  The property popover implementations were not redesigned.
- Add retains only Cancel/Add task; Edit retains Delete/Cancel/Save and the existing
  confirmation and save/error handling. Header/subtitle/close conventions remain.

## Reuse and persistence

This phase modifies the compact description renderer, the existing shared Step
renderer's opt-in `inlineAdd` path, and Add/Edit-scoped styles. Capture forms keep
their original Step layout and behavior. Task completion and description storage,
Markdown writes, identities, nested-Step anchors, metadata validation, history,
rollback and relocation use the previously established implementations.

No task-model or metadata-schema change was made. Pending new-row completion is
confirmed into the existing Step object with its normal completion timestamp.
Descriptions continue to live in task-ID metadata; they are not embedded into
Markdown task blocks. Direct text display does not parse description checkboxes
or identity-looking text as tasks. Cancel/close discards the entire task draft.

## Verification

Browser fixtures use isolated in-memory vaults and native Chromium keyboard
events. The native-style runs load the stylesheet extracted from the currently
installed Obsidian 1.14.4 archive; no production task data is used.

- **254 refined task-window checks** passed at 1480 × 1058. Includes intended
  width/content-driven height, title focus, visible checklist styles, parent/Step
  checkbox distinction, existing-row Enter, repeated new-row Enter, new-row
  checkbox completion, blur preservation, Escape/cancel, exact description
  display/edit/clear/reopen, completion/history, nested deletion, metadata,
  relocation, rollback/retry, full date ranges, necessity/phases, long paths,
  keyboard focus, fixed regions, scrolling and popover bounds.
- **252 checks** passed at 360 × 640 and 150% scaling. Empty Add measured
  **328 × 501**; populated Edit reached its bounded **328 × 544** height.
  An earlier 251-check run passed at 420 × 850 and 150% scaling, with measurements
  **388 × 501** and **388 × 720** respectively. Counts differ only for
  desktop-specific geometry checks and the later existing-row Enter assertion.
- **16 Node suites passed:** task-layout-polish, task-compact-form, task-form,
  task-planning, task-progress, task-history, task-mutations, task-workspace,
  task-data, task-creation-retry, project-planning, inbox, data-store.integration,
  shared-projects.integration, completion-audio and typography.
- Existing browser regressions passed: **task-form-workflows 65**,
  **task-location-picker 103**, **modal-regions 176**, **task-form-polish 85**,
  **form-consistency 76**, and **row-focus**.
- **2,099 Quick Add/Inbox browser checks passed**, followed by a clean runner
  exit. Quick Add, Inbox and other task surfaces were not redesigned.
- Installed bundle syntax and plugin loading passed. Plugin-only whitespace
  checks passed. The installed main/native/asset-manifest artifacts match the
  disposable staged build byte for byte.

Tests were updated for the intentional description display mode and modal width,
and extended for the new checklist interactions. Persistence/history/Markdown
expectations were retained rather than weakened.

## Build, backup and review

The pre-change plugin source, stylesheet and installed artifacts are preserved
under `System/Backups/task-refinement-20261013/source/` (ignored by Git). The same
directory contains staged output, test logs, installed hashes and desktop/small
review screenshots under `review/`. The established `build.js --output-dir`
workflow prepared staging, followed by the normal installed build. The pinned
development Electron Node runtime was used because Node is absent from PATH.
Atlas's native artifact is unchanged. Existing unrelated work was preserved.

Installed `main.js` SHA-256:
`a89bf9c27bc31330297333308ab6b6e49cbc4e6d8ff17aa1a8d3f83d10fbac5c`

Reload Hub Project Menu in Obsidian for visual review. The tests use the native
stylesheet with a simulated Obsidian Modal and in-memory data; live theme/window
review remains the final visual check. Description text is displayed as editable
Markdown source rather than rendered rich text. No known new functional issue
remains in the focused checks. Previously documented broader Files-divider and
legacy date-fixture issues remain outside this task-window phase.

Implementation is complete and stopped for review. Further task interfaces and
property-popover redesign are deferred.
