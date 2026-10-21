# Task editor specification contrast and spacing — 2026-10-14

Implemented and installed the focused ordinary Add/Edit CSS adjustment. Shared
task-card rendering and Phases 1–4 behavior remain intact. Stop for review.

## Rules and measured correction

Only `styles.css` changed in production. The shared external/internal action rule
previously supplied muted enabled colors and faint disabled colors. More specific
external `button.hub-task-config-action` rules now supply normal enabled text and
muted disabled text. The existing configured-icon rule still supplies
`--interactive-accent`; labels inherit `--text-normal`. Internal Add step retains
its previous colors and geometry. Disabled native semantics, hover guards,
configured-state detection and transient card feedback are unchanged.

The live-fields flex gap produced an actual **8px** upper gap. The specification
container had no lower padding, so the final row touched the footer separator:
**0px** lower gap. One shared `--hub-task-specification-gap`, using the existing
`--size-4-2` token, now supplies both the flex gap and specification-container
bottom padding. This follows the last visible action automatically.

| Layout | Before: upper / lower | After: upper / lower |
|---|---|---|
| Desktop, five actions | 8px / 0px | 8px / 8px |
| Desktop, six actions | 8px / 0px | 8px / 8px |
| Narrow, 150%, five or six | approximately 8px / 0px | approximately 8px / 8px |

Measurements compare the outer card rectangle, first/last rendered action rows
and footer border. Tests cover empty/titled global, Project and no-phase Project
Add, plus configured Project and Resource Edit. Row dimensions, inter-row spacing,
horizontal columns, task-card dimensions and card position relative to the modal
match saved pre-change measurements. Natural modal height increases by 8px; its
ordinary centering consequently moves the whole dialog 4px upward. No card offset,
fixed height, focus change, initialization delay or separate renderer was added.
Empty Add is now **560 × 398** desktop and **328 × 396** narrow in the shared-card
fixture. The bounded body and fixed header/footer remain.

## Verification

- New `task-specification-layout.html`: **194 checks in each layout**, including
  exact state colors, five/six boundaries, baseline geometry and stable opening.
- Configured feedback/description tooltip fixture: **539 in each layout**;
  configured/cleared/disabled/restored state colors, data retention, native keyboard
  exclusion, immediate initial colors, tooltip and panel/Statistics parity remain.
- Phase 1 hierarchy/readiness: **158 in each layout**.
- Shared task-card/editor: **1,870 desktop / 1,866 narrow**; independent preserved
  panel comparisons, draft Save/Cancel, metadata/history/statistics, Markdown/IME,
  Steps, popovers, retry/locks and reduced-motion assertions remain.
- Opening frames: **3,829 in each layout**; first-frame state and subsequent frame
  geometry, delayed/failed reads, repeated Home/Project/Resource Add and Edit.
- Native autofocus: **472 in each layout**, including trusted immediate typing,
  caret selection and Edit restraint. Step alignment: **65 in each layout**.
- Configuration popovers: **345 in each layout**. Modal regions: **176**;
  task-form workflows: **64**. Node typography, task-layout-polish and
  task-compact-form suites passed.
- Staged/installed syntax, plugin loading and scoped whitespace checks passed.

Existing color expectations were updated only to the requested tokens. The old
shared-card assertion requiring zero space after the final action now explicitly
requires 8px; its independent renderer comparisons and unrelated assertions remain.

## Screenshots and evidence

Screenshots were inspected for enabled/disabled contrast, neutral labels with
purple configured icons, horizontal alignment, five/six outer gaps and narrow
bounds. Fixtures use isolated Chromium, synthetic tasks and installed Obsidian
1.14.4 CSS/fonts. Native Modal hosting is simulated; live theme/window review
remains for the user. No live task was changed or application restarted/reloaded.

- [Empty Add](../../../../../System/Backups/task-specification-contrast-20261014/review/desktop-empty-add.png)
- [Populated Project Add with Phase](../../../../../System/Backups/task-specification-contrast-20261014/review/desktop-populated-project-add.png)
- [Configured Project Edit](../../../../../System/Backups/task-specification-contrast-20261014/review/desktop-configured-edit.png)
- [Narrow empty Add at 150%](../../../../../System/Backups/task-specification-contrast-20261014/review/small-150-empty-add.png)
- [Narrow configured Edit at 150%](../../../../../System/Backups/task-specification-contrast-20261014/review/small-150-configured-edit.png)
- [Desktop measurements](../../../../../System/Backups/task-specification-contrast-20261014/desktop-frames.json)
- [Narrow measurements](../../../../../System/Backups/task-specification-contrast-20261014/small-150-frames.json)
- [Baseline measurements](../../../../../System/Backups/task-specification-contrast-20261014/baseline-frames.json)

## Installation

Pre-change affected files and installed artifacts are preserved under
`System/Backups/task-specification-contrast-20261014/source/`. The ignored directory
also holds staged artifacts, source delta, screenshots, measurements, test/build
logs and installed hashes. Build used `build.js --output-dir` before normal
installation. Installed stylesheet/main/native/asset hashes match staging;
main/native/assets are byte-for-byte unchanged. Unrelated changes were preserved.

Installed stylesheet SHA-256:
`6a6cf70ab2f22ce3b81a5282a22197cbabe1f7b19194a531002d3d8ed48476c7`

Reload Hub Project Menu for live review. No further polish is included.
