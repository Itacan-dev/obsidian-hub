# Configuration-view layouts, Pass 2 — 2026-10-14

Implemented, verified, staged and installed. Ordinary Add/Edit configuration views
now share full-width control boundaries, equal native date/time columns, dark
neutral field surfaces, right-aligned date footers and compact Phase spacing.
Stop for review after this pass.

## Shared components and layout

- Necessity now presents **Should do | Must do** in actual DOM order. The existing
  selector accepts an optional order; only the live editor opts in. Yellow/red
  markers, values, equal button dimensions, purple selection and Clear/Done remain.
  Existing keyboard navigation follows the new order without a separate handler.
  Legacy compact callers retain their previous default ordering.
- Start and Due use the same existing endpoint renderer and native measurement
  helper. An optional `equalColumns` mode measures empty native fields, retaining
  localized segments, left picker indicators, reserved clear slots and native
  padding. Two columns require **twice the larger native minimum + shared gap +
  section padding**. They use `repeat(2,minmax(0,1fr))` when that fits and a single
  full-width column otherwise. Measurement runs synchronously on opening and through
  the existing viewport-resize callback. The default helper behavior is unchanged.
- Inline date grids and their existing footers now fill the shared section content
  width, rather than consuming the compact intrinsic-width variable. They use the
  same **8px `--size-4-2`** gap as Necessity. The existing footer's flex-end alignment
  places Cancel directly before Apply, with Apply on the same right edge as Done.
  No independent endpoint offsets or footer surface/separator were added.
- The dark token is **`--background-primary`**, reused from Itacan's actual neutral
  button rule in `styles.css`: `.hub-button-scope button:where(:not(.hub-button-plain,
  .mod-cta,.mod-warning))`. Itacan overrides Obsidian's generic button background,
  so `--interactive-normal` would not match these neutral buttons.
- Date wrappers paint that dark surface once, with the existing input radius.
  Their actual native inputs are transparent over it, preventing a lighter input
  layer and keeping disabled input opacity from lightening the surface. Native
  borders, focus, segmented editing, text, calendar/clock hit areas and clear X
  controls remain. Description paints the same token directly on its existing
  textarea; width, 96px initial height, vertical resize, wrapping, native scrolling,
  placeholder/focus treatment, exact Markdown updates and Clear/Done remain.
- Phase reuses its original menu and options, now with max-content grid rows and
  **4px `--size-4-1`** gaps, the compact spacing convention also used by Itacan's
  music selection list. Rows cannot shrink and clip wrapped text. No phase remains
  first, service ordering is retained, selection stays immediate and no footer is
  added. The original **`min(186px,30vh)`** section cap remains, accommodating about
  four/five ordinary rows with scrolling for longer lists. Overscroll is contained.
- Phase's native thin scrollbar reserves a stable gutter. Its real width is measured
  when the inline section opens and absorbed into the existing right padding. This
  keeps option right edges aligned with other controls while retaining the gray
  section's outer boundaries. No extra menu/card markup was introduced.

Production changes are confined to `styles.css`, `ui/date-time.js`,
`ui/task-live-form.js` and `ui/task-compact-form.js`. Shared task-card rendering,
Step editing/readiness/pointer guards, the corrected border mask, attention
controller, accordion ownership, checkmark gutter, headings, destination rules,
task model and storage sources are unchanged. Quick Add/Inbox keep their current
presentation and behavior through the default/inline-only options and selectors.

## Measurements and verification

| Layout | Date row width | Date / Time width | Height | Gap | Apply vs Done right edge |
|---|---:|---:|---:|---:|---:|
| Desktop, Start and Due | 440px | 216px / 216px | 36px | 8px | 0px difference |
| 360px / 150%, stacked | about 209.33px | about 209.33px each | 36px each | 8px | 0px difference |

A real resize to **520 × 640** retains equal side-by-side fields when their measured
minimums fit. A resize to **360 × 640** stacks both full-width fields. The same
measurements and dark surfaces pass in Edit. Phase and Description share the
Necessity/date boundaries; scrollbar reservation does not narrow Phase choices.
Actual PNG raster samples for Date, Time and Description match the neutral-button
surface. Native input layers are confirmed transparent.

- New focused fixture: **88 checks desktop and 88 narrow/150%**. Covers visual/DOM
  ordering, yellow/red mapping, trusted Home/ArrowDown/Enter selection, immediate
  markers and persistence, equal grids/shared boundaries/gaps, full date footers,
  midnight, optional time clearing, Cancel transaction/focus, computed and raster
  backgrounds, long Description scrolling/exact metadata, Phase gaps/order/wrapping,
  final-option reachability, workspace scroll isolation, real fit/stack resize,
  equivalent Edit geometry and Save with retained task identity.
- Configuration controls: **213 each**, retaining actual native indicator geometry,
  trusted picker clicks/Alt+Down, clear slots, optional/midnight/range validation,
  transactions, selectors, Description, focus and persistence.
- Accordion **905 each**, specification indicators **420 each**, configured-state
  and shared tooltip **591 each**, card/Step correction **479 each**, integrated
  Steps **166 each**, Step alignment **65 each**, layout **170 each** passed.
- Shared renderer/editor: **1,936 desktop / 1,932 narrow**, including independent
  panel comparisons, native Markdown/IME, nested identities/completion timestamps,
  metadata/history/statistics, Save/Cancel, locks and rollback/retry.
- Opening **3,829 each** and native autofocus **472 each** passed. Empty Add remains
  **560 × 398** desktop and **328 × 396** narrow. Existing heading/card geometry,
  anchored modal top, sticky card and bounded body/header/footer regions remain.
- Modal regions **176**, task-form workflows **64**, task-step-progress and row-focus
  passed. **2,101 Quick Add/Inbox browser checks passed**.
- **15 Node suites passed:** task-form, task-compact-form, task-layout-polish,
  task-created-completion, task-progress, task-history, task-mutations,
  task-workspace, task-data, task-creation-retry, task-planning, typography,
  project-planning, inbox and icons.
- Staged/installed syntax/plugin loading, artifact hash comparisons and scoped
  whitespace checks passed. Native and strict assets are unchanged.

Assertions tied to Must-first presentation and compact intrinsic date width now
check the requested order/full content width. Keyboard expectations follow the
new visual order. Substantive value, marker, transaction, validation, focus,
persistence and geometry assertions were retained. No unrelated test was weakened.

## Screenshots and evidence

Final captures were personally inspected for dark input layers, equal columns,
Apply/Done alignment, native picker/clear visibility, compact gaps, semantic markers,
wrapping, scrolling and viewport bounds. Existing genuine property feedback remains;
it is not a disclosure animation. All captures use isolated Chromium, synthetic
vault/services and installed Obsidian 1.14.4 stylesheet/fonts.

- [Should selected](../../../../../System/Backups/task-configuration-layouts-20261014/review/desktop-should-selected.png)
- [Must selected](../../../../../System/Backups/task-configuration-layouts-20261014/review/desktop-must-selected.png)
- [Start populated](../../../../../System/Backups/task-configuration-layouts-20261014/review/desktop-start-configured.png)
- [Due populated](../../../../../System/Backups/task-configuration-layouts-20261014/review/desktop-due-configured.png)
- [Optional time empty](../../../../../System/Backups/task-configuration-layouts-20261014/review/desktop-start-untimed.png)
- [Multiline Description](../../../../../System/Backups/task-configuration-layouts-20261014/review/desktop-description-multiline.png)
- [Short Phase list](../../../../../System/Backups/task-configuration-layouts-20261014/review/desktop-phase-short.png)
- [Long wrapped Phase list](../../../../../System/Backups/task-configuration-layouts-20261014/review/desktop-phase-long-top.png)
- [Last Phase reached](../../../../../System/Backups/task-configuration-layouts-20261014/review/desktop-phase-long-bottom.png)
- [Edit Due](../../../../../System/Backups/task-configuration-layouts-20261014/review/desktop-edit-due-populated.png)
- [Fitting narrow equal columns at 150%](../../../../../System/Backups/task-configuration-layouts-20261014/review/small-150-fitting-equal-columns.png)
- [Narrow stacked Due](../../../../../System/Backups/task-configuration-layouts-20261014/review/small-150-due-configured.png)
- [Narrow Necessity](../../../../../System/Backups/task-configuration-layouts-20261014/review/small-150-should-selected.png)
- [Narrow long Description](../../../../../System/Backups/task-configuration-layouts-20261014/review/small-150-description-multiline.png)
- [Narrow final wrapped Phase](../../../../../System/Backups/task-configuration-layouts-20261014/review/small-150-phase-long-bottom.png)
- [Desktop field/raster evidence](../../../../../System/Backups/task-configuration-layouts-20261014/desktop-frames.json)
- [Narrow field/raster evidence](../../../../../System/Backups/task-configuration-layouts-20261014/small-150-frames.json)
- [Geometry summary](../../../../../System/Backups/task-configuration-layouts-20261014/geometry-summary.csv)

Native Modal hosting remains simulated with the previously inspected lifecycle;
live theme/window review remains after reload. Native chooser presentation and
localization remain controlled by Chromium/the OS. No new functional limitation
was found by these checks. No live task was edited and Obsidian was not restarted
or reloaded. The deferred location chooser and unrelated UI work were not included.

## Safe installation

Pre-change affected source/tests/styles/installed artifacts are preserved under
`System/Backups/task-configuration-layouts-20261014/source/`. The ignored backup
folder also contains staging, source deltas, build/test/load logs, screenshots,
geometry/raster evidence and installed hashes. Unrelated changes were preserved.

The established `build.js --output-dir` workflow staged first. Staged plugin loading
passed before normal installation. Installed main/styles/native/strict-asset hashes
match staging; native/strict assets also match their pre-change backups.

Installed `main.js` SHA-256:
`07b1b6a779b371e88461c23a0279d155e6ca5b66b0289c6e7c857ce253f5cd0b`

Reload Hub Project Menu for live review. Installation is complete; stop here.
