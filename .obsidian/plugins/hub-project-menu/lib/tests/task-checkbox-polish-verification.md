# Add/Edit checkbox, title, description and Necessity polish — 2026-10-13

The subsequent [Task → Location → Planning layout polish](task-step-hierarchy-verification.md)
adds the checklist guide and circle-plus action, with updated screenshots.

This focused pass implements the attached checkbox/title/spacing request and the
additional Necessity menu alignment request. It supersedes the Add checkbox,
title focus and description-gap details in [the previous report](task-final-polish-verification.md).

## Changes

- Description uses the established **16px** spacing token after Add step (previously
  8px). The Task section has an additional **8px** margin after its description,
  giving Location a **24px** section gap. These gaps apply to collapsed, expanded
  and populated descriptions, including multiple Steps and long multiline content.
  No separators or empty description surfaces were added.
- Add and Edit use the same square completion checkbox inside the same **42px**
  title surface. Add defaults unchecked. The checkbox and editable title retain
  independent focus/click behavior; Steps remain circular. Checkbox changes remain
  pending until the parent Add/Save action, and Cancel discards them.
- The existing creation service now honors an explicitly true `completed` value
  rather than forcing false. It reuses `saveTaskSnapshot`, ordinary Markdown `[x]`
  markers, task IDs and progress transitions. The checkbox's existing `completedAt`
  action timestamp flows through the normal History/check records and statistics.
  Callers without an explicit completed value retain incomplete creation. No task
  storage schema or description representation changed.
- Completed creation retains the checked state and its exact timestamp after a
  failed save. Existing rollback/retry handling prevents a failed task write from
  recording progress. Stable-ID retries preserve their existing deduplication.
  Reopening in Edit restores completion; unchanged Save preserves its History
  timestamp, and unchecking uses the ordinary progress reversal behavior.
- Title fields have one outer background and border with **no shadow**. The inner
  input is transparent, borderless and shadowless in all focus states. Scoped
  input shadow/border tokens prevent later shared CSS from reinstating an inset
  rectangle. Focus does not change dimensions or padding.
- Pointer interaction and autofocus retain a neutral title border. Existing
  `trackTextFieldFocus` / `hub-keyboard-focus` navigation tracking gives keyboard
  title focus a single subtle gray border; it avoids Chromium treating every
  pointer-focused text input as keyboard focus. Checkbox keyboard focus uses a
  thin neutral outline. These overrides apply only to ordinary task title fields.
- Necessity menu rows explicitly start at the left, with existing horizontal
  padding and a **9px** marker-to-text gap. None/Clear reserves an invisible marker
  slot, so all three labels have the same left edge. Row font, colors, heights,
  selection/hover behavior and full-width purple selection remain unchanged.
  The compact Necessity button is unchanged; the alignment rule is scoped to the
  Necessity popover, leaving Phase unaffected.

The current 560px width, headings, header/footer conventions, Step editing,
description editing/storage, Location hierarchy and date semantics are preserved.
Quick Add, Inbox and other task interfaces were not redesigned.

## Verification

- **402 desktop browser checks passed at 1480 × 1058**. Empty Add measures
  **560 × 529**; the populated Markdown/Steps Edit fixture measures **560 × 735**.
- **399 browser checks passed at 360 × 640 and 150% scaling**. Empty Add measures
  **328 × 527**; populated Edit remains bounded at **328 × 544** with scrolling.
- New visual checks compare all three Necessity label positions, adjacent marker
  gaps, horizontal padding and row/background widths. They repeat after changing
  selection to verify selected/unselected alignment. None's indicator slot is
  verified invisible and free of colored markers.
- Add/Edit title checks cover unfocused, pointer and real Tab/Shift-Tab focus,
  shadow-bearing theme tokens, absent inner borders/background/shadows/outlines,
  one outer border, subtle keyboard indication, independent checkbox interaction,
  unchanged geometry and very long titles. Measurements account for Chromium's
  physical-pixel rounding at 150% scaling.
- Description gaps are measured with no Steps, expanded Description, populated
  Description, existing Steps and long multiline text. Existing exact Markdown /
  whitespace, Save/Cancel, native keyboard, viewport resizing and fixed-region
  checks remain.
- Completed Add checks cover defaults, check/uncheck, checked Cancel, editable title,
  failed creation/rollback and retry, reopen, exact check-time retention, one History
  event and one statistical completion. The new service suite covers Project and
  Resource creation, queued timestamps, CRLF/native IDs, incomplete Step isolation,
  stable-ID deduplication, unchanged Edit and completion reversal.
- **18 Node suites passed:** task-created-completion, task-layout-polish,
  task-compact-form, task-form, task-planning, task-progress, task-history,
  task-mutations, task-workspace, task-data, task-creation-retry, project-planning,
  inbox, data-store.integration, shared-projects.integration, completion-audio,
  typography and statistics.
- Existing browser regressions passed: task-form-workflows **65**,
  task-location-picker **103**, modal-regions **176**, task-form-polish **85**,
  form-consistency **76**, row-focus, and **2,099 Quick Add/Inbox checks**.
- Staged/installed bundle syntax, plugin loading and plugin whitespace checks
  passed. Installed main/native/asset-manifest hashes match staging; Atlas's native
  artifact is unchanged.

The previous forced-incomplete creation assertion was replaced with the newly
requested completed-creation behavior plus an explicit incomplete-default check.
Existing persistence, relocation, synchronization and history assertions remain.

## Safe build and review

Pre-change source, styles and installed artifacts are preserved under
`System/Backups/task-checkbox-polish-20261013/source/`. That ignored backup directory
also contains staged builds, logs, hashes and desktop/150% screenshots. The established
`build.js --output-dir` workflow staged first, followed by normal installation after
verification. Unrelated workspace changes were preserved. Tests used isolated data;
no live vault task was edited and Obsidian was not automatically restarted.

Installed `main.js` SHA-256:
`692dafb73a4c7d99c26e2921ecae2801fdb49315bc42d13bdedba6c2773eef13`

Updated desktop screenshots:

- [Add task](../../../../../System/Backups/task-checkbox-polish-20261013/review/desktop-add.png)
- [Edit task](../../../../../System/Backups/task-checkbox-polish-20261013/review/desktop-edit.png)
- [Necessity menu](../../../../../System/Backups/task-checkbox-polish-20261013/review/desktop-necessity.png)

Reload Hub Project Menu for visual review. Screenshots use a simulated Modal and
synthetic tasks with the native Obsidian stylesheet; live theme/window review remains.
No new functional issue was found in the focused checks. Previously recorded broader
Files-divider and legacy date-fixture issues remain outside this pass.

Stop after this polish pass for review.
