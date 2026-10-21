# Add/Edit Step alignment, focus and spacing — 2026-10-13

The title presentation is superseded by
[title hierarchy and wrapping](task-title-wrapping-verification.md).

This pass supersedes the conditional guide and extra Description spacing recorded
in [the optional-actions report](task-optional-actions-verification.md).

## Implementation

- The neutral **1px vertical guide is permanent**, including zero-Step Add/Edit.
  Its existing axis shares the parent checkbox's padding and column dimensions.
  It starts **8px below the title**, stays disconnected, and ends with Add step.
  The existing **24px checklist indentation** and Add icon column are always present,
  so the circle-plus action does not shift horizontally when the first Step is
  opened/confirmed or the last Step is deleted. The action remains neutral.
- Valid blur uses the existing draft commit with **no focus restoration to Add**.
  Enter alone confirms with the keyboard workflow's Add focus restoration; Escape
  cancels the unconfirmed row. A new confirmed row is appended without rebuilding
  existing rows, preserving the checkbox, input or button the user clicked.
- Native pointer tests reproduced an empty-row event-ordering bug: dismissing the
  row during pointer-down moved Add step before pointer-up, losing its click.
  Empty pointer-driven blur now waits until the target click handler finishes.
  Keyboard empty blur remains immediate. A release/cancel fallback handles pointer
  sequences without a click. It never focuses Add as part of blur cleanup.
- A draft version guards deferred empty cleanup, so clicking Add again cannot have
  its freshly opened replacement row dismissed by the old blur. The existing hidden
  draft guard makes Enter/blur/Save confirmation idempotent. Valid text enters the
  pending task draft once; empty repeated Add reuses one row. Invalid text remains
  with existing validation feedback, and unfinished IME input is not committed.
- Focus within the new row's checkbox/cancel controls is still distinguished through
  `relatedTarget`. Pointer listeners and deferred timers are removed during ordinary
  modal teardown. Save/Cancel retain authority over persistence.
- Description uses the standard **8px** related-action gap instead of 16px. The
  special extra Task margin is removed, restoring only the compact form's established
  **16px Task → Location section gap** instead of 24px. Collapsed, expanded and
  populated descriptions follow the same rules. Heading-to-content gaps remain 8px;
  width, typography, title/check styling, planning controls and modal regions remain.
- Domain/services/storage were not changed. Existing IDs, Markdown synchronization,
  History/statistics, completion timestamps, description metadata and relocation
  behavior are preserved. Quick Add, Inbox and unrelated interfaces are unchanged.

## Verification

- **750 desktop browser checks passed at 1480 × 1058**. Empty Add measures
  **560 × 513**; populated Markdown/Steps Edit measures **560 × 719**.
- **747 checks passed at 360 × 640 and 150% scaling**. Empty Add measures
  **328 × 511**; populated Edit remains bounded at **328 × 544** with body scrolling.
- Permanent guide checks cover zero/one/multiple Steps, empty/invalid draft rows,
  adding/removing/checking/editing, parent checkbox alignment and guide termination.
  Add's horizontal coordinate is compared before/during/after first-row creation
  and after last deletion. Description/action/section gaps are measured directly.
- Actual browser pointer clicks verify valid confirmation into title, existing Step
  checkbox/text/delete controls, Dates/Necessity/Phase, and Location. Focus remains
  at the clicked input/checkbox or follows the control's normal picker focus. Delete
  performs its intended removal without redirecting focus to Add. Empty repeated
  Add and empty-blur Dates clicks are verified separately. Existing tests cover
  active valid Step Save, pending Cancel, Enter/blur duplication, invalid text, IME,
  new-row completion, nested deletion and completion timestamp/history preservation.
- Existing coverage retains completed creation, main/Step completion, descriptions,
  identities, metadata, Markdown, history/statistics, location moves, date semantics,
  necessity/phases, rollback/retry, keyboard focus, window resizing and fixed regions.
  Long checklist geometry checks respect intentional clipping within the scrollable
  body while retaining modal bounds and horizontal overflow checks.
- **18 Node suites passed:** task-created-completion, task-layout-polish,
  task-compact-form, task-form, task-planning, task-progress, task-history,
  task-mutations, task-workspace, task-data, task-creation-retry, project-planning,
  inbox, data-store.integration, shared-projects.integration, completion-audio,
  typography and statistics.
- Browser regressions passed: task-form-workflows **65**, task-location-picker **103**,
  modal-regions **176**, task-form-polish **85**, form-consistency **76**, row-focus,
  and **2,099 Quick Add/Inbox checks**.
- Staged/installed bundle syntax, plugin loading and plugin whitespace checks passed.
  Installed main/native/asset-manifest hashes match staging; Atlas's native artifact
  is unchanged.

## Screenshots, backup and review

The requested screenshots were captured with the native Obsidian stylesheet and
personally inspected. The empty and first-row states share the same guide/action
axis. Pointer-confirmation screenshots show focus on the title and no Add focus ring.
Multiple-Step and populated Description states retain the compact hierarchy and
reduced spacing; narrow windows keep the footer anchored while content scrolls.
No remaining obvious alignment or focus discrepancy was found.

- [Empty Add with permanent guide](../../../../../System/Backups/task-step-focus-20261013/review/desktop-task-final-add.png)
- [Entering the first Step](../../../../../System/Backups/task-step-focus-20261013/review/desktop-task-step-focus-first-input.png)
- [First Step confirmed by clicking the title](../../../../../System/Backups/task-step-focus-20261013/review/desktop-task-step-focus-first-blur.png)
- [Edit with multiple Steps](../../../../../System/Backups/task-step-focus-20261013/review/desktop-task-hierarchy-edit-steps.png)
- [Populated Description](../../../../../System/Backups/task-step-focus-20261013/review/desktop-task-hierarchy-edit-description.png)
- [Expanded Description](../../../../../System/Backups/task-step-focus-20261013/review/desktop-task-optional-description-expanded.png)
- [Narrow pointer confirmation at 150%](../../../../../System/Backups/task-step-focus-20261013/review/small-150-task-step-focus-first-blur.png)

Pre-change source/styles/installed artifacts are preserved under
`System/Backups/task-step-focus-20261013/source/`. The ignored backup directory also
contains staged builds, logs, hashes and desktop/150% screenshots. The established
`build.js --output-dir` workflow staged first, followed by normal installation after
verification. Unrelated changes were preserved. Tests used synthetic data; no live
vault tasks were edited and Obsidian was not automatically restarted.

Installed `main.js` SHA-256:
`04435eeebc89ad6e6f063eb163f4379fee7e67151c4194edb9ac1f4c37072569`

Reload Hub Project Menu for live visual review. The fixture uses a simulated Modal
with native styling; the live window/theme remains the final check. No new functional
issue was found. Previously recorded broader Files-divider and legacy date-fixture
issues remain outside this pass.

Implementation and installation are complete. Stop here for review.
