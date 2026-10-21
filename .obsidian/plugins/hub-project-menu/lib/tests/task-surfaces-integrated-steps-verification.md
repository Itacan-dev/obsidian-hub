# Accordion surfaces and integrated Steps — 2026-10-14

Implemented, verified, staged and installed. Expanded configuration now uses one
continuous hover-gray surface and opens/closes immediately. Step creation is inside
the actual shared checklist; the external Step specification is removed. Stop for review.

## Changes

- `ui/task-accordion.js` groups each existing heading and content section in one
  `hub-task-config-group`. Only the expanded group paints
  `--background-modifier-hover`, with the existing radius convention. Heading and
  content remain transparent over that one paint layer: repeating a translucent
  token on children would darken the heading and produce a seam. Computed effective
  paint matches collapsed-row hover for both heading and content. Existing inputs,
  selection buttons, purple fills and footer buttons retain their own surfaces.
  Content keeps its label-column indent and a consistent 8px right inset. The
  group adds no border, shadow, title or extra enclosing card.
- The accordion's animation objects, reduced-motion branch, clip/opacity keyframes,
  pending animation state and delayed disposal are removed. Row transition duration
  is zero. Open/close sets chevrons, visibility, gray surface and following-row
  geometry synchronously. Existing focus restoration, exclusive ownership, date
  discard and immediate configuration updates remain. Task-card purple feedback
  remains in the existing attention controller and was not changed.
- `ui/task-card.js` adds an editor-only `emptyAction` option to
  `createTaskChecklist`. With zero Steps it reuses the same disclosure button,
  icon column, label, typography and hover treatment for native Lucide **list-tree
  Add steps**. Progress text is empty/hidden and the checklist list/guide is hidden.
  Default panel callers retain their previous zero-Step rendering. With confirmed
  or pending Steps the same component returns to its original chevron and counter.
  No checklist markup or parallel stylesheet was copied. The installed Obsidian
  native icon registry was inspected; its exact list-tree paths are used in fixtures.
- `ui/task-live-form.js` removes the external action, opts into that empty state
  and uses the existing Step adapter to create/focus the first pending textarea
  immediately. Zero Steps return to Add steps after deletion or abandonment. The
  specification column now contains **four** Resource/no-phase actions or **five**
  applicable Project actions, in the requested order. Steps and configuration
  disclosure remain independent. Creating a Step closes configuration first,
  discarding unapplied dates while retaining immediate selections/Description.
- `ui/task-form.js` adds editor-only creation readiness and a before-add hook.
  Internal Add step is natively disabled when the parent title is empty or an
  unconfirmed pending Step has no meaningful valid text. It uses the existing
  `appendTask` validation, also reused by the existing meaningful-pending getter.
  Valid input enables it synchronously with normal text/icon colors; disabled
  colors are muted. Color readiness excludes transition interpolation. The existing
  commit path confirms the preceding valid Step once, creates the next pending
  row and focuses its native textarea. Confirmed incomplete Steps do not disable
  creation. Generic forms opt out and keep their previous behavior.

Native clicking a disabled button can blur an empty pending row. Its established
empty-row abandonment then restores Add steps; no extra Step is created. Enter,
blur, Escape, checkbox timestamps, nested deletion, IME, wrapping and single-line
Markdown storage continue through the existing adapter. Persistence and ID
allocation remain owned by the existing services, including their native handling
of new unchecked Steps. Nothing is persisted before parent Add/Save.

## Geometry and focus

The new affordance uses the exact existing disclosure icon/label columns. Pending,
confirmed and sequential rows retain Phase 2 geometry, including 24px one-line
rows, circular checkbox/text columns, guide and internal Add step alignment.
Title clearing disables creation while retaining pending Steps and metadata;
restoring the title restores appropriate controls. Add retains its native initial
caret and immediate typing; Edit does not activate its title automatically.

Removing the external row saves 32px. Existing-Step editors become 32px shorter.
For zero-Step editors, the integrated shared disclosure adds that same natural
32px inside the card; overall empty Add remains **560 × 398** desktop and **328 ×
396** narrow. No artificial height reduction or empty external placeholder is used.
Card width and relative positioning are preserved. The specification column still
has measured **8px above and below** in four/five-action layouts.

Top anchoring, sticky card behavior with its tall-checklist fallback, viewport
margins, scrollbar reservation, fixed header/footer and body scrolling are retained.
Eight sampled frames per expanded section show **zero modal-top drift and zero
expanded-height drift** on desktop and narrow/150%. Immediate close checks also
verify hidden sections have no remaining children, animations or occupied space.

## Verification

- New surface/Step fixture: **166 checks desktop and 166 narrow/150%**. Covers
  computed effective gray paint, transparent child layers, rounded/no-shadow
  surfaces, immediate motion-free disclosure, native Enter/pointer Step creation,
  caret placement, disabled pointer/keyboard/synthetic activation, whitespace and
  domain-invalid text, sequential confirmation exactly once, completion timestamps,
  title readiness/data retention, deletion/abandonment, independence, context counts,
  Save/Cancel and actual zero-Step panel behavior.
- Shared card/editor: **1,936 desktop / 1,932 narrow**. Existing normal-panel
  comparisons with the preserved implementation remain, including zero-Step panels
  and expanded checklists. Editor zero-Step comparisons explicitly assert the
  requested optional affordance; all other presentation/formatting comparisons,
  IDs, metadata/history/statistics, Markdown/IME, locks and rollback/retry remain.
- Opening **3,829 each**, native autofocus **472 each**, Phase 1 readiness **138
  each**, Step geometry **65 each**, configuration controls **213 each**, configured
  icons/shared tooltip **458 each**, contrast/balanced spacing **170 each**, and
  exclusive accordion **905 each** passed.
- Modal regions **176**, task-form workflows **64**, task-step-progress and
  row-focus passed. **2,101 Quick Add/Inbox browser checks passed**.
- **15 Node suites passed:** task-form, task-compact-form, task-layout-polish,
  task-created-completion, task-progress, task-history, task-mutations,
  task-workspace, task-data, task-creation-retry, typography, task-planning,
  project-planning, inbox and icons.
- Staged/installed syntax and plugin loading, matching artifact hashes and scoped
  whitespace checks passed.

Assertions tied to external Step actions, their configured icon and five/six
configuration rows now target the real in-card control and four/five rows.
Baseline geometry explicitly accounts for the measured integrated disclosure and
removed row. Existing persistence, identity, focus, native field, tooltip and panel
assertions were preserved. The historical compact-fixture limitation recorded in
the prior pass was not retested; actual compact/capture coverage above passes.

## Screenshots and evidence

Final screenshots were inspected for continuous gray paint, corner treatment,
input/button contrast, purple selections, native list-tree, subdued disclosure,
pending caret, internal readiness colors, checklist columns and narrow scrolling.
Initial pending/next-row images intentionally show existing purple update feedback
after genuine user changes. Configuration review images wait for actual control
transitions/feedback to finish; disclosure assertions run synchronously before that.

- [Collapsed configured Edit](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-configured-collapsed-edit.png)
- [Start surface](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-expanded-start.png)
- [Due surface](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-expanded-due.png)
- [Necessity surface](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-expanded-necessity.png)
- [Description surface](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-expanded-description.png)
- [Phase surface](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-expanded-phase.png)
- [Long Phase list](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-expanded-long-phase.png)
- [Zero-Step Add](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-zero-steps.png)
- [Zero-Step Edit](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-zero-step-edit.png)
- [Add steps hover](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-add-steps-hover.png)
- [Add steps focus](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-add-steps-focus.png)
- [First pending Step](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-pending-empty.png)
- [Valid pending Step](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-pending-valid.png)
- [Next pending Step](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-next-pending.png)
- [Several Steps](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-several-steps.png)
- [All Steps removed](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/desktop-steps-removed.png)
- [Narrow Description at 150%](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/small-150-expanded-description.png)
- [Narrow sequential checklist](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/review/small-150-next-pending.png)
- [Desktop frames](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/desktop-frames.json)
- [Narrow frames](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/small-150-frames.json)
- [Measured frame summary](../../../../../System/Backups/task-surfaces-integrated-steps-20261014/frame-summary.csv)

Fixtures use isolated Chromium, synthetic vault/services and installed Obsidian
1.14.4 stylesheet/fonts. Native Modal hosting is simulated; live theme/window
review remains after plugin reload. Native picker presentation remains controlled
by Chromium/the OS, and exceptionally tall checklists retain the existing natural
scrolling fallback. No new functional limitation was found. No live task was edited
and Obsidian was not restarted or reloaded.

## Installation

Production changes are confined to `styles.css`, `ui/task-accordion.js`,
`ui/task-card.js`, `ui/task-live-form.js` and `ui/task-form.js`. Panel adapters,
configuration renderers, date/time helpers, task persistence/domain code and
destination rules are unchanged. Pre-change source/tests/styles/installed artifacts
are preserved under `System/Backups/task-surfaces-integrated-steps-20261014/source/`.
That ignored directory also holds staging, diffs, build/test/load logs, screenshots,
native icon inspection and frames. Unrelated changes were preserved.

The established `build.js --output-dir` staged first; staged loading passed before
normal installation. Installed main/styles/native/asset hashes match staging;
native and asset artifacts are unchanged.

Installed `main.js` SHA-256:
`f801c70b965a1082632390decdba9c3762c55ba76f865693e5b309b6d95e7975`

Reload Hub Project Menu for live review. Implementation and installation are
complete; stop after this pass.
