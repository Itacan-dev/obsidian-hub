# Add/Edit title hierarchy and wrapping — 2026-10-13

This pass supersedes the title presentation in
[the previous polish report](task-step-focus-verification.md). It changes only
ordinary Add/Edit title hierarchy and the layout needed for visual wrapping.

## Implementation

The ordinary composer presentation in this report is superseded by
[the shared live Task card phase](task-live-card-verification.md).

- Removed the standalone Task heading from both windows. The title surface is
  the first body content, with the established 16px content padding below the
  header. Location, Planning and contextual Description headings remain.
- Title and placeholder reuse the former heading's typography: the existing
  heading size token and native h3 weight, family, variant, style, line height and
  letter spacing. Placeholder color remains subdued. The title has one outer
  surface, no inner border/background/shadow, and unchanged restrained keyboard
  and pointer focus behavior.
- The shared `mountTaskText` has an explicit `wrapTitle` option, enabled only by
  Add/Edit's `mountWrappingTaskTitle` adapter in `mountCompactTaskForm`. It uses a
  native textarea with `wrap="soft"`, preserving native selection and navigation.
  Visual lines do not introduce newlines into the value. Pasted/dropped CR/LF are
  removed with the same semantics as the former text input; selection offsets are
  adjusted accordingly. Existing trimming and domain validation remain in force.
- Enter invokes the existing parent form submission/validation, rather than
  inserting a newline. Native editing commands that request a line break use the
  same submit path. IME composition/confirmation is not prematurely submitted.
  Existing Save/Cancel, invalid input and pending-save behavior remain.
- Title height follows its full content, including long unbroken words. Resizing
  remeasures at the available width. Measurement holds that width while briefly
  resetting height and repeats if the body's scrollbar changes it. Width-observer
  updates run in the next animation frame to avoid ResizeObserver delivery loops;
  destruction disconnects the observer and cancels any pending frame.
- The existing 18px square parent checkbox aligns with the first text line,
  independently of title length. Its existing size is applied explicitly, and its
  click/focus/completion behavior is preserved. Step checkboxes remain circular.
  Completed inactive titles are muted and struck; focused text remains readable.
- The permanent guide, neutral circle-plus action, Steps, Description, Location,
  Planning controls/popovers, 560px width and fixed header/footer remain. Long
  content scrolls in the body; the title itself does not scroll or truncate.

No task storage, schema, identifier, synchronization, metadata, history, statistics,
progress or destination rule was changed. Descriptions retain their existing exact
task-ID-backed metadata representation. Quick Add, Inbox and other task interfaces
retain their existing text controls and layout.

## Verification

- **945 browser checks passed at 1480 × 1058** with native Obsidian styling and an
  isolated in-memory vault. Empty Add is **560 × 485**; the established populated
  Edit fixture is **560 × 690**.
- **942 checks passed at 360 × 640 and 150% scaling**. Empty Add is **328 × 483**;
  populated Edit stays bounded at **328 × 544**, with the body scrolling.
- New checks compare title and placeholder typography with preserved headings;
  verify absent Task headings and first-content position; exercise short, long
  natural-word and 1,500-character unbroken titles; measure height growth/shrinkage,
  first-line checkbox alignment, lack of internal horizontal/vertical overflow,
  Step separation and fixed-footer bounds. Real viewport changes verify reflow.
- Native keyboard checks cover selection replacement, Shift+ArrowDown selection
  over a wrapped line, Tab/Shift-Tab focus, required-title Enter validation, valid
  Add submission and Edit Save through Enter, and IME guards. CR/LF sanitization
  checks retain the old single-line input semantics.
- Integration checks save/reopen long and unbroken titles exactly, retain the task
  ID and one Markdown task line, preserve three Steps and exact multiline Markdown
  Description, retain completion/history on renaming, and discard title edits on
  Cancel. Existing completion creation, retry/rollback, History/statistics,
  relocation, Resource/phase, nested-Step, Delete, date and focus checks remain.
- **18 Node suites passed:** task-created-completion, task-layout-polish,
  task-compact-form, task-form, task-planning, task-progress, task-history,
  task-mutations, task-workspace, task-data, task-creation-retry, project-planning,
  inbox, data-store.integration, shared-projects.integration, completion-audio,
  typography and statistics.
- Browser regressions passed: task-form-workflows **65**, task-location-picker
  **103**, modal-regions **176**, task-form-polish **85**, form-consistency **76**,
  row-focus, and **2,099 Quick Add/Inbox checks**.
- Staged/installed syntax, plugin loading and plugin whitespace checks passed.
  Installed bundle/native/asset-manifest hashes match staging. Atlas's native
  artifact is unchanged.

## Screenshots and visual inspection

These are actual browser renders of the established isolated Modal fixtures with
native Obsidian CSS. Desktop and 150% screenshots were personally inspected for
title prominence, wrapping, first-line checkbox alignment, guide/action proportions,
heading hierarchy and spacing. The narrow long-content views show normal body
scrolling with anchored header/footer. No remaining obvious discrepancy was found.

- [Empty Add](../../../../../System/Backups/task-title-wrapping-20261013/review/desktop-empty-add.png)
- [Short completed Edit](../../../../../System/Backups/task-title-wrapping-20261013/review/desktop-short-edit.png)
- [Long wrapped Edit](../../../../../System/Backups/task-title-wrapping-20261013/review/desktop-long-edit.png)
- [Long title with multiple Steps and Description](../../../../../System/Backups/task-title-wrapping-20261013/review/desktop-long-steps.png)
- [Narrow wrapped title](../../../../../System/Backups/task-title-wrapping-20261013/review/desktop-narrow.png)
- [Narrow empty Add at 150%](../../../../../System/Backups/task-title-wrapping-20261013/review/small-150-empty-add.png)
- [Narrow long title at 150%](../../../../../System/Backups/task-title-wrapping-20261013/review/small-150-narrow.png)
- [Narrow Steps and Description at 150%](../../../../../System/Backups/task-title-wrapping-20261013/review/small-150-long-steps.png)

## Safe build and review

Pre-change source, styles and installed artifacts are preserved under
`System/Backups/task-title-wrapping-20261013/source/`. The ignored backup directory
also contains staging, test/build logs, hashes and review screenshots. The established
`build.js --output-dir` workflow staged first; normal `build.js` installed after
verification. Unrelated changes were preserved. Tests edited synthetic data only;
no live vault task was changed and Obsidian was not automatically restarted.

Installed `main.js` SHA-256:
`890ddc1a630ffeeaaebf667e878e11d3d32fd1dcc4434b4b913dcfb299d119d4`

Reload Hub Project Menu for live visual review. The fixtures simulate Modal hosting;
the user's live theme/window remains the final visual check. No new functional
limitation was found. Very long titles can exceed the visible body height, which
uses the preserved modal scrolling convention. Titles still store one Markdown
line; multiline Description retains its separate existing semantics.

Implementation and installation are complete. Stop here for review.
