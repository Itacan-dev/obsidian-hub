# Add/Edit spacing and optional actions — 2026-10-13

The subsequent [Step alignment, focus and spacing pass](task-step-focus-verification.md)
restores a permanent guide, corrects pointer/empty-row ordering and reduces the
Description/action and Task/Location gaps.

This focused pass supersedes the always-visible guide and purple Add step styling
recorded in [the hierarchy report](task-step-hierarchy-verification.md).

## Implementation

- Task, Location, Planning and visible Description headings explicitly reuse
  `--hub-field-label-gap`, falling back to `--size-4-2`: **8 CSS pixels**. The actual
  Quick Add Note/New note component was rendered in the isolated fixture; its Type,
  Action, Workspace, Folder and Title label-to-control gaps all measure 8px. Task
  heading-to-content gaps match those measurements in Add and Edit, including
  expanded/populated Description. The existing task gap was already 8px, so no
  extra vertical space or typography change was necessary.
- Add step retains Lucide circle-plus but inherits the same **`--text-muted`**
  text/icon color, font size/weight, 8px icon-to-text gap and lightweight action
  styles as Add a description. The purple override is removed. Native pointer-hover
  tests compare both actions after existing CSS transitions settle; real Tab /
  Shift-Tab checks confirm matching neutral keyboard focus. There is no permanent
  border or filled background. The one-Step screenshot shows the existing keyboard
  focus ring restored to Add step after Enter; it is not a permanent button border.
- The shared Step renderer toggles `has-steps` from **`state.steps.length > 0`** only
  for ordinary task inline editors. That class controls both the guide pseudo-element
  and existing child indentation. Zero-Step editors have no guide, no reserved guide
  padding, and an Add action aligned with surrounding task content. Opening an empty
  or invalid new row does not change this state.
- Confirming the first valid Step reveals the guide and checklist indentation;
  deleting the last hides both immediately in the draft. Completion toggles do not
  affect visibility. With actual Steps, the previous 1px neutral guide, parent
  checkbox axis, disconnected start and coverage through Add step are retained.
  Surrounding title, Description, Location and Planning fields keep their horizontal
  positions. No animation or extra spacer is introduced.
- Enter/blur confirmation, repeated creation, validation, nested deletion, existing
  row editing, completion timestamps, Save/Cancel, descriptions, Location and Planning
  retain their existing logic. No domain/service files, models, Markdown storage,
  IDs, history or statistics were changed. Quick Add and unrelated UI remain unchanged.

## Verification and screenshot review

- **606 desktop checks passed at 1480 × 1058**. Empty Add remains **560 × 529**;
  the populated Markdown/Steps Edit fixture remains **560 × 735**.
- **603 checks passed at 360 × 640 and 150% scaling**. Empty Add remains **328 × 527**;
  populated Edit remains bounded at **328 × 544** with its existing scrollable body.
- New checks measure heading gaps against the actual Quick Add Note/New note
  component, compare neutral rest/hover/keyboard action styles, verify no guide or
  guide padding for zero/empty/invalid draft rows, and check visibility/alignment
  after first confirmation, checking/unchecking and last deletion. Existing guide
  alignment and viewport checks remain for one/multiple Steps. Surrounding field
  positions are compared before and after guide changes.
- Existing functional coverage retains creation/editing, parent/Step completion,
  exact History/statistics timestamps, identity and Markdown synchronization,
  Enter/blur/IME/validation, retry/rollback, Save/Cancel, multiline Description,
  Resource ownership and Project phases, location moves, date ranges and popovers,
  native keyboard focus, resizing and fixed header/footer behavior.
- **18 Node suites passed:** task-created-completion, task-layout-polish,
  task-compact-form, task-form, task-planning, task-progress, task-history,
  task-mutations, task-workspace, task-data, task-creation-retry, project-planning,
  inbox, data-store.integration, shared-projects.integration, completion-audio,
  typography and statistics.
- Browser regressions passed: task-form-workflows **65**, task-location-picker **103**,
  modal-regions **176**, task-form-polish **85**, form-consistency **76**, row-focus,
  and **2,099 Quick Add/Inbox checks**. The browser runner gained a pointer-move
  request to test actual hover without clicking or opening either optional editor.
- Staged/installed syntax and plugin loading passed; installed main/native/asset
  manifest hashes match staging. Atlas's native artifact is unchanged. Plugin
  whitespace checks passed.

All requested screenshot states were personally inspected using the native Obsidian
stylesheet. Empty Add/Edit show comparable neutral optional actions without an
invisible hierarchy column. One/multiple Step editors retain the guide and child
alignment. Expanded/populated Description preserves heading rhythm and readable
multiline content. Narrow views remain centered and preserve anchored footer/body
scrolling. No remaining obvious visual discrepancy was found.

## Safe build, backup and screenshots

Pre-change source/styles/installed artifacts are preserved under
`System/Backups/task-optional-actions-20261013/source/`. The ignored backup directory
also contains staged artifacts, logs, hashes and desktop/150% screenshots. The existing
`build.js --output-dir` workflow staged first, followed by normal installation after
tests passed. Unrelated workspace changes were preserved. Tests used synthetic data;
no live vault tasks were edited and Obsidian was not automatically restarted.

Installed `main.js` SHA-256:
`dee3a1e17eff839af35fdee672209f11fbb8a2bb6b754414077e0b190b425be0`

Screenshots:

- [Empty Add task](../../../../../System/Backups/task-optional-actions-20261013/review/desktop-task-final-add.png)
- [Edit with no Steps](../../../../../System/Backups/task-optional-actions-20261013/review/desktop-task-hierarchy-edit-empty.png)
- [Edit with one Step](../../../../../System/Backups/task-optional-actions-20261013/review/desktop-task-optional-edit-one.png)
- [Edit with multiple Steps](../../../../../System/Backups/task-optional-actions-20261013/review/desktop-task-hierarchy-edit-steps.png)
- [Expanded Description](../../../../../System/Backups/task-optional-actions-20261013/review/desktop-task-optional-description-expanded.png)
- [Populated Description](../../../../../System/Backups/task-optional-actions-20261013/review/desktop-task-hierarchy-edit-description.png)
- [Narrow Add at 150%](../../../../../System/Backups/task-optional-actions-20261013/review/small-150-task-final-add.png)
- [Narrow populated Edit at 150%](../../../../../System/Backups/task-optional-actions-20261013/review/small-150-task-hierarchy-edit-description.png)

Reload Hub Project Menu for review. Screenshots use a simulated Modal with native
Obsidian styling; live theme/window review remains the final check. No new functional
issue was found. Previously recorded broader Files-divider and legacy date-fixture
issues remain outside this pass.

Implementation and installation are complete. Stop here for review.
