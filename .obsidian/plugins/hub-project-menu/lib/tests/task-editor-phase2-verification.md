# Task editor polish, Phase 2 — 2026-10-14

This pass corrects ordinary Add/Edit Step editing and checklist alignment. It
preserves the shared Tasks panel renderer, Phase 1 hierarchy and native Add title
autofocus. Configuration popovers and destination selection remain unchanged.

## Root causes and correction

- A later generic task-form rule gave text inputs a 40px height, overriding the
  editor's one-line input sizing. Pending and existing editing rows measured 46px,
  while committed checklist rows measured 24px. The same columns were already
  present; the editor field was imposing the extra height. Baseline measurements
  also show the internal Add step label 4px farther right: it inherited the
  external action's 12px gap instead of the checklist's 8px gap.
- Native single-line inputs could not wrap long Step text during editing, although
  the shared committed presentation wrapped it. The editor adapter now uses native
  one-row, soft-wrapping textareas with the existing compact font, line height and
  padding. Enter still confirms rather than inserting a stored newline. Paste/drop
  strips CR/LF with selection offsets preserved, matching the previous input's
  single-line Markdown semantics. IME guards and domain validation remain.
- The existing title's natural-height measurement is extracted once as
  `mountWrappingTaskInput` and reused for checklist editors. A newly shown field
  is measured synchronously before focus; width changes resize naturally. Hidden
  or detached fields are skipped and observers are destroyed with their rows.
  There is no fixed row height, delayed reveal or new rendering implementation.
- Checklist gap, row padding and checkbox-column values now have shared CSS
  variables with identical panel defaults. Scoped editor rules let the internal
  circle-plus/label consume those values. Its icon centers on the actual Step
  checkbox column and its label starts at the Step text column. The existing
  hierarchy guide and trailing delete controls are retained.
- Regression testing exposed two title transitions that could interfere with
  Step blur: repeated pointer activation replaced an already focused input, and
  switching to an asynchronous Markdown preview briefly emptied the title. Title
  activation is now idempotent and measures the attached input before focus.
  Title and Step previews retain text while native Markdown rendering completes,
  avoiding an empty row/card that could move a pointer target. The original
  formatting renderer still supplies the final preview.

Production changes are confined to `styles.css`, `ui/task-form.js`,
`ui/task-compact-form.js` and `ui/task-live-form.js`. The shared `task-card.js`,
panel interaction adapters, persistence services and domain models are unchanged.
The existing Enter/blur/Save commit path, pending checkbox timestamps, nested
identities, deletion, completion, counters and Cancel behavior are retained.
Generic task forms continue to use their existing text inputs.

## Verification

- **65 focused geometry checks passed on desktop and 65 at 360 × 640 / 150%.**
  They measure the synchronous pending row and eight subsequent frames, native
  caret/focus, empty/typed/confirmed/reopened states, checkbox and text columns,
  guide bounds, delete-button alignment, internal icon/label positions, typography,
  multiple/nested Steps, natural wrapping and single-line paste/line-break behavior.
  Desktop one-line rows remain **24px** throughout; Step text and internal Add
  labels both begin at **x = 574px** in the matching fixture. Adding/removing rows
  still changes content height normally.
- Shared card/editor regressions passed: **1,849 desktop and 1,845 narrow/150%
  checks**. They independently compare actual panel rendering with its preserved
  pre-change implementation, including expanded checklists. Coverage retains native
  Markdown/input/IME, Enter/blur/Escape, pointer focus and Cancel, Save/locks/retry,
  completion timestamps, IDs, synchronization, metadata, history, statistics,
  dates/necessity/Phase, description preview, viewport bounds and reduced motion.
  Existing assertions were preserved; editor selectors now include native textareas.
- Opening stability passed **3,829 checks on desktop and 3,829 narrow/150%**;
  native autofocus passed **472 in each layout**. Phase 1 readiness/hierarchy
  passed **158 in each layout**. Add retains immediate native typing; Edit does
  not automatically activate its title. Empty Add remains **560 × 390** desktop
  and **328 × 388** narrow in the shared-card fixture.
- Existing browser regressions passed: modal-regions **176**, task-form-workflows
  **64**, Home **48** plus workspace/Note layouts **36**, task-step-progress and
  row-focus. **2,101 Quick Add/Inbox checks passed**; those interfaces were not
  redesigned.
- **11 Node suites passed:** task-form, task-compact-form, task-layout-polish,
  task-created-completion, task-progress, task-history, task-mutations,
  task-workspace, task-data, task-creation-retry and typography.
- Staged/installed syntax, plugin loading and scoped whitespace checks passed.
  Installed main/native/asset hashes match staging. Native artifacts are unchanged.

## Screenshot and frame review

All requested states were captured using isolated Chromium, synthetic task services
and the installed Obsidian 1.14.4 stylesheet/fonts. The screenshots were personally
inspected for checkbox/text/delete alignment, compact input height, native caret,
internal Add step proportions, muted guide, typography and scrolling. Empty,
typed and committed rows retain their geometry; long text grows naturally inside
the bounded body. Native Modal hosting is simulated; live window/theme review
remains the final check. No live task was edited or application restarted.

- [Empty Add](../../../../../System/Backups/task-editor-phase2-20261014/review/desktop-empty-add.png)
- [Immediately focused empty Step](../../../../../System/Backups/task-editor-phase2-20261014/review/desktop-empty-step.png)
- [Typed pending Step](../../../../../System/Backups/task-editor-phase2-20261014/review/desktop-typed-step.png)
- [Confirmed Step](../../../../../System/Backups/task-editor-phase2-20261014/review/desktop-confirmed-step.png)
- [Reopened Step](../../../../../System/Backups/task-editor-phase2-20261014/review/desktop-editing-step.png)
- [Multiple Steps](../../../../../System/Backups/task-editor-phase2-20261014/review/desktop-multiple.png)
- [Internal Add hover](../../../../../System/Backups/task-editor-phase2-20261014/review/desktop-internal-hover.png)
- [Internal Add activated](../../../../../System/Backups/task-editor-phase2-20261014/review/desktop-internal-active.png)
- [Edit with preexisting Steps](../../../../../System/Backups/task-editor-phase2-20261014/review/desktop-edit-existing.png)
- [Narrow pending Step at 150%](../../../../../System/Backups/task-editor-phase2-20261014/review/small-150-empty-step.png)
- [Narrow wrapped editing](../../../../../System/Backups/task-editor-phase2-20261014/review/small-150-long-editing.png)
- [Narrow preexisting Edit](../../../../../System/Backups/task-editor-phase2-20261014/review/small-150-edit-existing.png)
- [Desktop frame measurements](../../../../../System/Backups/task-editor-phase2-20261014/desktop-frames.json)
- [Narrow frame measurements](../../../../../System/Backups/task-editor-phase2-20261014/small-150-frames.json)
- [Alignment summary](../../../../../System/Backups/task-editor-phase2-20261014/alignment-summary.csv)
- [Pre-change measurements](../../../../../System/Backups/task-editor-phase2-20261014/baseline-frames.json)

## Build and installation

Pre-change plugin source, styles and installed artifacts are preserved under
`System/Backups/task-editor-phase2-20261014/source/`. The same ignored directory
holds staged artifacts, logs, screenshots and measurements. The established
`build.js --output-dir` workflow staged first; normal installation followed
verification. Unrelated workspace and live runtime-state updates were preserved.
No Tasks panel design, popover redesign or unrelated interface work was added.

Installed `main.js` SHA-256:
`032f7fec3e03693c717442961494b3e4e988f4b08b2b9d66b6f7ef8d24e64e69`

Reload Hub Project Menu for live visual review. Implementation and installation
are complete; stop after Phase 2.
