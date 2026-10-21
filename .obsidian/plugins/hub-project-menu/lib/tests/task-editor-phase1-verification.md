# Task editor polish, Phase 1 — 2026-10-14

This phase refines ordinary Add/Edit hierarchy and readiness. It preserves the
[shared live-card renderer](task-live-card-verification.md) and the
[opening-frame initialization fix](task-opening-verification.md). Later popover
redesigns and the separate location chooser remain deferred.

Live review subsequently identified a native post-opening focus override missed
by the simulated host. See [the focused autofocus correction](task-autofocus-verification.md)
for the cause, corrected native focus model and trusted keyboard/caret checks.

## Implementation

- The title placeholder remains **What needs doing?**, now using `--text-muted`
  with opacity 1. The rule has composer specificity so the later legacy compact
  title rule cannot restore `--text-faint`. Title typography, soft wrapping and
  single-line Markdown storage are unchanged; no pencil is added.
- Add still focuses the native title synchronously after final sizing, with
  `preventScroll`, before the first visible frame. Edit focuses the dialog instead
  of selecting or activating the title. Its native `hasInitialInputFocus` is false,
  preventing Obsidian's automatic input-focus pass from overriding that choice.
  The title remains directly editable through pointer or keyboard interaction.
- `mountLiveTaskForm` owns specification readiness. Empty/whitespace title disables
  all six external actions, including the applicable Phase action, and the internal
  Add step button. Native disabled semantics exclude them from keyboard activation
  and focus. Existing popover guards and explicit Step guards also block synthetic
  activation. Disabled text/icons use `--text-faint`, opacity 1 and a neutral
  background/cursor; enabled actions retain `--text-muted` and existing hover/focus.
- Typing meaningful text enables actions immediately without changing their
  dimensions. Temporarily clearing the title disables them and closes configuration
  popovers without erasing pending dates, necessity, description, Phase or Steps.
  Active transient feedback is cancelled while untitled; further pulses require
  a meaningful title. Normal user feedback and reduced-motion behavior remain.
  Add/Save still uses the existing native/domain validation rules.
- Both circle-plus actions now read **Add step**. The internal Step guide, editor
  geometry, confirmation, deletion, completion and pending-draft lifecycle are
  preserved. No guide is added to the external specification column.
- Composer rows suppress the inherited full-row background/accent hover. A muted
  rounded decoration behind the title area alone appears on hover or title focus.
  It is absolutely positioned, has no layout footprint and cannot receive pointer
  events. It paints behind text within an isolated title context, stays inside
  card padding and excludes the reserved information-indicator space. Location,
  dates, Phase and checklist areas retain their own appearance. Existing gray
  keyboard title focus is preserved, including inactive title preview focus.
- A populated title preview now activates its input on primary pointer-down,
  before a Step blur commit can resize the card and retarget pointer-up. This
  preserves the existing pointer blur-confirmation/focus assertion with meaningful
  titles. Native clicks/caret placement within an already active input are left
  intact. No Step geometry correction or unrelated editor refactor was made.

## Shared horizontal geometry and compact header

The existing panel row's 16px checkbox column, 12px gap and 12px left inset now have
shared CSS variable names, with identical defaults. The composer specification
grid consumes those same values, plus its actual card border/padding. Its inset
is derived as **card border + card padding + row inset**, rather than an offset
chosen for one viewport. Icon centering also accounts for the shared native
checkbox-size token, including the dashboard sizing already transferred into the
composer by `createTaskRow`. Labels start at the actual title column. Necessity
markers remain absolute and introduce no marker-dependent offset.

The composer header uses a **36px** icon and **12px** gap, the existing design
tokens at the lower end of the requested ranges. Icon/title stay vertically
centered. The legacy 10px header margin is removed, the row shrinks from 44px to
36px, and the existing 16px separator padding/native modal outer padding remain.
This removes **18 CSS pixels** of inherited header space without fixed heights.
Title typography, X, separator, width, footer and bounded scroll regions remain.
Full icon/title/subtitle headers keep their original 44px convention.

There is no intentional deviation from the requested icon/gap dimensions. Existing
native outer padding is retained instead of adding a second layer of top padding.
The shared-card fixture measures empty Add at **560 × 390** desktop and **328 ×
388** narrow, each 18px shorter than before this phase. The opening/visual fixture
also models the native header wrapper; its absolute height differs from the older
simulated host while showing the same 18px reduction and stable opening geometry.

Production changes are confined to `styles.css`, `ui/task-live-form.js`,
`ui/task-editor.js` and the disabled Add-step guard in `ui/task-form.js`.
`task-card.js`, panel interaction adapters, header helper, popover controllers,
destination rules and persistence sources are unchanged. The shared renderer
remains the actual implementation in both contexts; no card markup or parallel
card stylesheet was introduced. Normal Tasks panel hover/click behavior remains.

## Verification

- New visual/readiness fixture: **158 checks passed on desktop**, and **158 at
  360 × 640 / 150% scaling**. Coverage includes placeholder color/opacity, initial
  Add focus/caret, all disabled actions, native inability to focus them, synthetic
  mouse/Enter/Space/ArrowDown rejection, neutral disabled hover, immediate enabling,
  clearing/re-entering with metadata retention, Phase availability, both labels,
  title-only hover, other controls' pointer access, panel hover/edit behavior,
  compact/full header proportions, long titles, configured cards and expanded Steps.
- Opening fixture: **3,829 checks passed in each of desktop, narrow/150%, and
  reduced-motion runs**. The first visible frame now additionally asserts correct
  disabled/enabled action state and the intended Add/Edit focus distinction.
  Delayed/failed reads, retry, cancellation, completed tasks, stale Phase and
  repeated cold/warm openings remain covered. Saved desktop/narrow traces show
  **zero geometry drift** across sampled visible frames for modal, header, card,
  title and footer; no loading state or initial update feedback is exposed.
- Shared card/composer regressions: **1,849 desktop** and **1,845 narrow/150%
  checks passed**, retaining panel/editor geometry/style/formatting comparisons,
  Markdown/IME/native selection, Step Enter/blur, identities, completion timestamps,
  Save/Cancel, metadata, history, statistics, rollback/retry, locks, popover
  anchoring, description preview, date/necessity/Phase updates and reduced motion.
- Existing browser suites passed: modal-regions **176**, task-form-workflows **64**,
  Home **48** plus workspace/Note layouts **36**, task-step-progress and row-focus.
- **2,101 Quick Add/Inbox browser checks passed**; those interfaces are unchanged.
- **21 Node suites passed:** task-composer-routing, task-association-removal,
  task-created-completion, task-layout-polish, task-compact-form, task-form,
  task-planning, task-progress, task-history, task-mutations, task-workspace,
  task-data, task-creation-retry, project-planning, inbox, data-store.integration,
  shared-projects.integration, completion-audio, typography, statistics and icons.

Existing fixture setup now enters a title before configuring properties. Explicit
empty-title/default/required-validation cases remain empty. Inactive title parity
comparisons explicitly enter and leave title editing because Edit no longer
autofocuses it. Step tests activate the visible title surface when its native input
is detached. Intentional label/focus expectations are updated; unrelated geometry,
persistence, history, synchronization and relocation assertions are preserved.

## Screenshots and frame evidence

Screenshots use synthetic tasks, isolated Chromium and the installed Obsidian
1.14.4 stylesheet/fonts. Final screenshots were personally inspected for muted
placeholder contrast, faint/neutral disabled actions, compact proportions,
title-only background, marker/metadata visibility, column alignment and scroll
regions. Native Modal hosting is simulated; live theme/window review remains.

- [Empty Add](../../../../../System/Backups/task-editor-phase1-20261014/review/desktop-empty-add.png)
- [Title entered / actions enabled](../../../../../System/Backups/task-editor-phase1-20261014/review/desktop-enabled-add.png)
- [Configured Edit](../../../../../System/Backups/task-editor-phase1-20261014/review/desktop-configured-edit.png)
- [Title hover](../../../../../System/Backups/task-editor-phase1-20261014/review/desktop-title-hover.png)
- [Title focus](../../../../../System/Backups/task-editor-phase1-20261014/review/desktop-title-focus.png)
- [Expanded checklist / aligned specifications](../../../../../System/Backups/task-editor-phase1-20261014/review/desktop-expanded-alignment.png)
- [Expanded Edit](../../../../../System/Backups/task-editor-phase1-20261014/review/desktop-edit-expanded.png)
- [Narrow empty Add at 150%](../../../../../System/Backups/task-editor-phase1-20261014/review/small-150-empty-add.png)
- [Narrow expanded Edit at 150%](../../../../../System/Backups/task-editor-phase1-20261014/review/small-150-edit-expanded.png)
- [Desktop opening frames](../../../../../System/Backups/task-editor-phase1-20261014/desktop-frames.json)
- [Narrow opening frames](../../../../../System/Backups/task-editor-phase1-20261014/small-150-frames.json)
- [Reduced-motion opening frames](../../../../../System/Backups/task-editor-phase1-20261014/reduced-motion-frames.json)
- [Measured frame summary](../../../../../System/Backups/task-editor-phase1-20261014/frame-summary.csv)

## Build and review

Pre-change sources, styles and installed artifacts are backed up under
`System/Backups/task-editor-phase1-20261014/source/`. The same ignored directory
holds staged artifacts, build/test/load logs, source delta, screenshots and frame
evidence. The established `build.js --output-dir` workflow staged first; normal
installation followed verification. Installed syntax/plugin load and scoped
whitespace checks passed, with installed main/native/asset hashes matching staging.
Atlas native artifacts are unchanged. Existing unrelated changes and runtime
state updates were preserved. Tests edited isolated task data only; Obsidian was
not automatically restarted.

Installed `main.js` SHA-256:
`0fc74fda6e7c256bc455513ce23e4be7419045bdd5a7973c07cf38799afecb93`

No new functional limitation was found by these checks. Long titles and checklists
still use the established bounded body scrolling. Native location/Phase truncation
at narrow widths remains consistent with the panel. The previously recorded
broader Files-divider issue is outside this phase and was not rerun. Popover
redesigns, persistent purple configured icons, Step-editor geometry and the
location chooser remain deferred as requested.

Reload Hub Project Menu for live visual review. Stop after Phase 1.
