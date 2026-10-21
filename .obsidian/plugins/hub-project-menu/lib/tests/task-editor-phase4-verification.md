# Task editor polish, Phase 4 — 2026-10-14

This focused pass adds configured specification icons and refines the shared
description indicator/tooltip. Phases 1–3, native title autofocus, the shared card
renderer and deferred location selection remain intact.

## Configured specifications

`mountLiveTaskForm` derives configured states directly from the existing pending
draft during its ordinary refresh. Steps use meaningful confirmed text or valid
unconfirmed text exposed by the existing Step adapter's read-only getter. The
getter uses the existing Markdown/domain validation without confirming a row.
Start/Due use their date values; Necessity accepts Must/Should; Description uses
trimmed nonempty content; Phase requires an assignment with a displayed valid phase.

Only the external action's graphic becomes `--interactive-accent` purple. Labels
remain muted and row geometry/backgrounds are unchanged. Disabled actions inherit
their existing faint appearance even when configured draft values remain. Restoring
a meaningful title restores the correct colors without losing properties.

Computed-style tests exposed an inherited 120ms button color transition, so the
configuration controls retain their background/border/shadow transitions while
excluding color interpolation. Configured and disabled colors now update immediately.
Initial Edit rendering establishes its classes before presentation; eight opening
frame samples verify correct colors without an initial task-update animation.
Existing transient card feedback and reduced-motion behavior remain independent.

## Shared description indicator and tooltip

- The actual shared `mountDescriptionIndicator` retains the native Lucide `info`
  SVG at **16 CSS pixels**. The previous SVG rule already specified that size;
  this pass corrects alignment without unnecessarily changing the drawing. Its
  **28px** interaction target is anchored within the shared task-info region,
  centered on the first title line using its compact typography/line-height.
  The existing reserved 28px title space prevents collisions and permits wrapping.
  Absolute positioning does not add card height. Home, Project, Resource and
  composer cards use the same implementation and styles.
- Description previews now reuse Statistics' `createImmediateHubTooltip`, its
  native `.tooltip` surface, `hub-detail-tooltip` typography and positioning.
  The task preview opts into content-only text and interactive read-only behavior;
  Statistics keeps its existing titled help and navigation conventions.
- The preview has no header, title, X, footer buttons or textarea. Text uses
  `textContent`, preserves whitespace/line breaks and wraps safely. Short content
  sizes naturally; maximum dimensions are **360px wide / 280px high**, further
  bounded by the viewport. Longer text scrolls inside the tooltip.
- Task previews use the native manual top layer so panel/modal scrolling cannot
  clip them. The shared positioning routine clamps to the visual viewport and
  chooses above/below without resizing the editor. No separate tooltip framework
  or task-card renderer was introduced.
- Hover and keyboard focus expose the description. Click/native button activation
  pins or toggles it for touch/keyboard use. Escape dismisses the tooltip before
  an underlying configuration popover, without closing the editor. A 150ms pointer
  departure grace period permits crossing the gap into the tooltip without flicker.
  Outside clicks dismiss immediately; keyboard focus departure dismisses an
  unpinned preview when it is not hovered. Tooltip content scrolling remains usable.
- Read-only previews never activate title editing, task editing, completion or
  navigation. Native duplicate aria-label tooltips are suppressed through the
  existing `--no-tooltip` convention. The accessible control name, description
  and active `aria-describedby` association remain available.
- Pending description updates update the existing preview in place. Clearing,
  parent scrolling, rerender, component disposal and modal closure remove it.
  Visible-preview removal observation also disposes a detached root's controller.
  Editing remains in the existing Add/Edit description configuration action.

Production files changed: `styles.css`, `ui/task-live-form.js`, `ui/task-form.js`,
`ui/task-card.js` and `ui/tooltips.js`. No task storage, metadata schema, identities,
Markdown synchronization, history, statistics or normal panel interaction adapters
were changed. No new configuration controls were added.

## Verification

- **539 focused checks passed on desktop, 539 at 360 × 640 / 150%, and 539 in a
  reduced-motion run.** Coverage includes each configured/cleared property, valid
  and invalid pending Steps, whitespace descriptions, disabled title restoration,
  immediate computed icon/label colors, unchanged action dimensions, nonanimated
  icons, initial Edit colors, native info size/target/first-line alignment, long
  titles, shared panel/editor parity, hover/transfer/exit, click, real Tab focus,
  Escape, live text updates, safe HTML-as-text, scrolling, rerender/close cleanup,
  panel handlers, edge bounds and reduced motion.
- The fixture opens the actual Statistics modal and compares its Oathbound help
  tooltip with the task tooltip. Background, color, padding, radius, shadow, font
  family, font size and line-height match. Statistics browser regressions passed
  on desktop and narrow/150%, including help interaction/cleanup and chart details.
- Shared card/editor regressions passed **1,870 desktop / 1,866 narrow** checks.
  Existing preview assertions now require the requested control-free tooltip and
  Escape dismissal; hover focus preservation compares the actual prior focus.
  Unrelated panel geometry, native editing/IME, Steps, popovers, Save/Cancel,
  locks, rollback/retry, metadata/IDs/Markdown/history/statistics and reduced-motion
  assertions remain.
- Opening stability **3,829**, native autofocus **472**, Phase 1 hierarchy **158**
  and Phase 2 Step geometry **65** passed in each layout. Phase 3 configuration
  passed **345 in each layout**. Empty shared-card Add remains **560 × 390** desktop
  and **328 × 388** narrow; Edit still does not automatically edit its title.
- Existing browser regressions passed: modal-regions **176**, task-form-workflows
  **64**, Home **48** plus workspace/Note **36**, task-step-progress and row-focus.
  **2,101 Quick Add/Inbox checks passed**; these interfaces were not redesigned.
- **14 Node suites passed:** task-form, task-compact-form, task-layout-polish,
  task-created-completion, task-planning, task-progress, task-history,
  task-mutations, task-workspace, task-data, task-creation-retry, typography,
  statistics and icons.
- Staged/installed syntax, plugin loading and scoped whitespace checks passed.
  Installed main, stylesheet, native and asset hashes match staging; native
  artifacts are unchanged.

## Screenshot review and evidence

Screenshots use isolated Chromium, synthetic vault data and the installed Obsidian
1.14.4 stylesheet/fonts. They were personally inspected for icon-only purple,
neutral labels, first-line info alignment, compact preview proportions, native
tooltip styling, wrapping and scrolling. Persistent-state screenshots wait on the
existing feedback animations' completion, not an arbitrary initialization timeout.
The long-text fixture intentionally includes literal HTML to verify safe rendering.

- [Title entered, neutral icons](../../../../../System/Backups/task-editor-phase4-20261014/review/desktop-neutral-add.png)
- [Configured Add, settled persistent icons](../../../../../System/Backups/task-editor-phase4-20261014/review/desktop-configured-add.png)
- [Existing configured Edit](../../../../../System/Backups/task-editor-phase4-20261014/review/desktop-existing-edit.png)
- [Wrapped title / shared information icon](../../../../../System/Backups/task-editor-phase4-20261014/review/desktop-wrapped-editor-icon.png)
- [Short description tooltip](../../../../../System/Backups/task-editor-phase4-20261014/review/desktop-short-tooltip.png)
- [Long multiline tooltip](../../../../../System/Backups/task-editor-phase4-20261014/review/desktop-long-tooltip.png)
- [Actual Tasks-panel row and tooltip](../../../../../System/Backups/task-editor-phase4-20261014/review/desktop-panel-tooltip.png)
- [Actual Statistics tooltip reference](../../../../../System/Backups/task-editor-phase4-20261014/review/desktop-statistics-reference.png)
- [Narrow configured Add at 150%](../../../../../System/Backups/task-editor-phase4-20261014/review/small-150-configured-add.png)
- [Narrow short tooltip](../../../../../System/Backups/task-editor-phase4-20261014/review/small-150-short-tooltip.png)
- [Narrow long tooltip](../../../../../System/Backups/task-editor-phase4-20261014/review/small-150-long-tooltip.png)
- [Reduced-motion configuration](../../../../../System/Backups/task-editor-phase4-20261014/review/desktop-reduced-motion.png)
- [Desktop alignment/opening measurements](../../../../../System/Backups/task-editor-phase4-20261014/desktop-frames.json)
- [Narrow measurements](../../../../../System/Backups/task-editor-phase4-20261014/small-150-frames.json)

Native Modal hosting is simulated; live theme/window review remains the final check.
Long previews intentionally use bounded scrolling and display editable Markdown
source as safe read-only text, preserving the prior description representation.
No new functional limitation was found by the focused checks.

## Safe installation

Pre-change affected source/tests, stylesheet and installed artifacts are backed up
under `System/Backups/task-editor-phase4-20261014/source/`. The ignored directory
also contains staged artifacts, logs, screenshots and measurements. The established
`build.js --output-dir` workflow staged first; normal installation followed verified
checks. Unrelated workspace changes were preserved. No live task was edited and
Obsidian was not automatically restarted or reloaded.

Installed `main.js` SHA-256:
`e1d8f6d3d597711477718f51267f0d018a2f9966a4cc52465c003ffe30bd49f7`

Reload Hub Project Menu for live review. Installation is complete; stop after Phase 4.
