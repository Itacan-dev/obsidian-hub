# Add/Edit task final polish — 2026-10-13

The subsequent [checkbox, title, Description and Necessity polish](task-checkbox-polish-verification.md)
supersedes this phase's Add checkbox, title focus and description spacing details.

This phase supersedes the width and new-Step blur behavior recorded in
[the previous refinement](task-refinement-verification.md). It changes the ordinary
Add/Edit task presentation and associated task popovers. Models, persistence,
identities, history, destination rules and unrelated interfaces remain unchanged.

## Changes

- Add/Edit share the **560 CSS pixel collapsed Quick Add width rule**, including
  its `calc(100vw - 32px)` viewport constraint. Quick Add's dimensions are unchanged.
  Height follows content; the existing maximum height, fixed header/footer and
  scrolling body remain. Desktop empty Add measures **560 × 513**; populated Edit
  with two Steps and an exact multiline Markdown description measures **560 × 719**.
- Task, Location, Properties and the contextual Description heading use the
  existing **Oath heading size token and native h3 weight/typography**. Tests compare
  their computed font size, weight, family, line height and letter spacing directly
  with an Oath heading. The task layout retains its compact 8px heading gap rather
  than Oath's 14px gap. No smaller typography variant was necessary.
- Edit's square completion checkbox sits inside one title input surface. The
  title input has a transparent background and no independent border. Checkbox
  clicks retain their own focus; normal title editing and a visible keyboard focus
  ring remain available. Pending completion mutes/strikes the inactive title, with
  readable editing text on focus. Add uses the same outer geometry and ordinary
  left padding without a checkbox. Step checkboxes remain circular.
- Description has a heading only while editing or when content exists. Empty
  blur restores the lightweight action. A populated readable display retains the
  heading and subtle pencil action. Multiline Markdown and whitespace survive
  editing, focus changes, saving and reopening exactly as before, through the
  existing task-ID-backed metadata; nothing is injected into Markdown task bodies.
- Dates uses two compact Start/Due groups, each containing native date and optional
  time inputs side by side. Empty unfocused inputs show **Select date / Add time**;
  focus reveals the native segmented editor. Repeated secondary labels and full
  clear buttons are removed. Small inline X actions appear only on populated
  fields. Clearing a date clears its time; clearing time retains its date. Time
  remains disabled until its own date exists, preventing implicit dates. The
  desktop popover is below 330px high and fits the viewport, scrolling if required.
- Dates retains its isolated draft, Clear all, Cancel and Apply. Apply changes the
  pending parent draft; Save persists. Dismissal/Escape/Cancel discard unapplied
  changes. Full range labels, 24-hour times, midnight, cross-year ranges and date /
  same-day time validation retain their existing semantics.
- Dates, Necessity and Phase close controls use the shared task-popover header X
  with a transparent, borderless, shadowless rest state, 28px hit target, subtle
  hover and visible keyboard focus. Field clearing and Step deletion have separate
  scoped styles. Existing Escape and focus restoration are retained.
- New Steps confirm into the **pending draft** on Enter or leaving the row. Moving
  focus to its checkbox/cancel control keeps that row active. Empty blur dismisses;
  Escape cancels; invalid text remains with native validation feedback. Add step
  remains available below the row: a repeated click confirms valid text once and
  starts another empty row. Save includes valid pending text; Cancel discards it.
  IME composition is not prematurely confirmed.
- New Step confirmation appends a row without rebuilding existing rows. This
  preserves the input/checkbox/delete target when blur is caused by clicking an
  existing Step. Focus events use `relatedTarget` to handle the native pointer
  interval in which `activeElement` is temporarily the document body. Enter,
  blur and Save share one idempotent commit path. Completion timestamps enter the
  existing History model on Save; nested Step identities and structure are retained.

Shared components reused: `mountCompactTaskForm`, `mountTaskDescription`,
`mountTaskDates`, `mountTaskSteps`, `createTaskDateTimeInput`, `openTaskPopover`,
the existing destination trigger/tree, Oath typography tokens and modal regions.
No new task storage or state-management system was introduced.

## Verification

- **322 browser checks passed at 1480 × 1058**, using the installed native Obsidian
  stylesheet and isolated in-memory vault. Coverage includes exact Quick Add width
  parity, Oath typography, inner checkbox click/focus, conditional Description
  headings, native input clearing, transactional Dates, all three close controls,
  pointer/keyboard Step confirmation, repeated Add, invalid blur, IME, exact check
  timestamps, Save/Cancel ordering, metadata/Markdown/history, relocation,
  Resources/phases, rollback/retry, nested deletion, long paths and fixed regions.
- **319 checks passed at 360 × 640 and 150% scaling**. Empty Add is **328 × 511**;
  populated Edit reaches the bounded **328 × 544** height. Both runs resize the
  viewport with Dates open, verify modal/popover bounds and retain an unapplied
  midnight draft before restoring the window size and cancelling it.
- **16 Node suites passed:** task-layout-polish, task-compact-form, task-form,
  task-planning, task-progress, task-history, task-mutations, task-workspace,
  task-data, task-creation-retry, project-planning, inbox, data-store.integration,
  shared-projects.integration, completion-audio and typography.
- Existing browser regressions passed: **task-form-workflows 65**,
  **task-location-picker 103**, **modal-regions 176**, **task-form-polish 85**,
  **form-consistency 76** and **row-focus**.
- **2,099 Quick Add/Inbox browser checks passed**. Their interfaces were not changed.
- Staged and installed bundle syntax, plugin loading and plugin whitespace checks
  passed. Installed main/native/asset-manifest hashes match staged output. Atlas's
  native artifact is unchanged.

Tests update intentional width/blur expectations and extend functional coverage;
existing storage, history, synchronization and relocation assertions were preserved.
The browser runner gained a validated viewport-resize request for real resize tests.

## Build, backup and screenshots

Pre-change sources, stylesheet and installed artifacts are preserved under
`System/Backups/task-final-polish-20261013/source/`. The same ignored directory
contains staged artifacts, test/build logs and desktop / 150% screenshots. The
established `build.js --output-dir` staged first; the normal `build.js` installed
after tests passed. Existing unrelated workspace changes were preserved. No live
vault task was edited by these tests and Obsidian was not automatically restarted.

Installed `main.js` SHA-256:
`01677d1c53017c22507df5cc696dbbeb0c72a555797ad0ab966e99b40ef0ad90`

Desktop screenshots:

- [Add task](../../../../../System/Backups/task-final-polish-20261013/review/desktop-add.png)
- [Edit task](../../../../../System/Backups/task-final-polish-20261013/review/desktop-edit.png)
- [Dates](../../../../../System/Backups/task-final-polish-20261013/review/desktop-dates.png)
- [Necessity](../../../../../System/Backups/task-final-polish-20261013/review/desktop-necessity.png)

Reload Hub Project Menu in Obsidian for visual review. Screenshots use synthetic
tasks and a simulated Modal with the native stylesheet; the live window/theme
remains the final visual check. Native date field presentation follows Chromium's
locale convention while configured property labels retain Itacan's formatting.
Descriptions remain plain editable Markdown source. No new functional limitation
was found by the focused tests. Previously recorded broader Files-divider and
legacy date-fixture issues remain outside this phase.

Implementation and installation are complete. Stop here for visual review.
