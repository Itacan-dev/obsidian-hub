# Add/Edit opening-frame initialization fix — 2026-10-14

This focused pass fixes the opening sequence of the ordinary task composer from
[the shared live-card phase](task-live-card-verification.md). Its settled appearance
and shared Tasks panel renderer are preserved. No stylesheet changes were needed.

## Reproduction and precise causes

The installed Obsidian 1.14.4 Modal implementation was inspected. Its constructor
creates a detached container. `open()` appends that container, invokes `onOpen()`
synchronously **without awaiting its promise**, then applies native modal chrome
and initial focus. The browser is free to paint once the synchronous opening task
returns. The fixture models that mounting order, the native header wrapper and
the existing focus/dismissal APIs, using the installed stylesheet and fonts.

**Edit had two initialization shifts.** The previous async `onOpen()` created the
composer header and a Loading task paragraph, then awaited `service.read(task)`.
The form, footer and `layoutModal()` region classes did not exist yet. Obsidian
therefore exposed a short, content-driven modal centered around the middle of the
viewport, containing only the header/loading state. After the read completed,
`render()` appended the full card/actions/footer and applied the fixed-region
layout. Native modal centering then moved the header with the enlarged window.
This was not a delayed stylesheet or an independently misplaced title element.

**Add's card shift came from premature title measurement.** The live adapter called
`mountWrappingTaskTitle()` before adding `hub-task-card-edit-input`. The helper
measured native textarea typography/padding/width and stored its scrollHeight as
an inline height. Only afterward did the adapter apply the final editing class,
and only after constructing the form did `layoutModal()` assign region ownership
and scrollbar constraints. ResizeObserver then scheduled a later animation frame
to repair the height. The wrong inline height was visible for an opening frame.
The same sizing defect also affected Edit after its snapshot loaded; long text
could initially force a scrollbar, further reducing width and inflating height.

The original source was reproduced before modification with pre-paint animation
frame measurements. Representative desktop measurements in CSS pixels:

| Scenario | Before fix, initial → settled | After fix, first visible → settled |
| --- | --- | --- |
| Home Add card height | 55.719 → 47.719 | 47.719 → 47.719 |
| Home Add title height | 24 → 16 | 16 → 16 |
| Home Add modal top | 315.516 → 319.516 | 319.516 → 319.516 |
| Delayed minimal Edit modal top | 448.703 with loading → 303.516 | 303.516 → 303.516 |
| Long-title Edit card width | 485 → 500 | 500 → 500 |
| Long-title Edit card height | 544.781 → 196.781 | 196.781 → 196.781 |
| Long-title Edit title height | 478 → 130 | 130 → 130 |

The baseline log and complete frame trace are retained in the backup directory.
Existing tests that waited for the window to settle did not expose these shifts.

## Small initialization fix

- `ui/task-editor.js` resolves Edit's snapshot **before calling native Modal.open**.
  The modal object is still returned synchronously for existing callers. Its
  `ready` promise resolves to the opened modal, or null after failure/cancellation.
  Add resolves its ordinary initial draft/destination synchronously and opens
  directly. Once opened, both use a synchronous `onOpen()` to build the complete
  shared card, actions and fixed regions before the first paint.
- While Edit reads, the native container remains detached. No modal, empty shell,
  backdrop or initial focus transfer is presented. Read failures show the existing
  Notice and leave no stranded window. Closing the returned pending modal prevents
  a late read from opening it; a late failure after cancellation is suppressed.
  A subsequent opening retries normally. No timeout, visibility delay or entrance
  effect is introduced.
- `ui/task-compact-form.js` applies the caller's editing class **before measuring**
  a wrapping title. It exposes the existing synchronous resize routine and records
  the measured width so ResizeObserver does not queue a redundant opening resize.
  Width changes from later user interaction or viewport resize retain the existing
  observer behavior and cleanup.
- `ui/task-live-form.js` supplies the class at title creation and exposes
  `resizeTitle`. The editor calls it immediately after `layoutModal()` establishes
  the final body/footer geometry, before initial focus and presentation. The
  existing width-held, scrollbar-aware measurement is reused.
- The live adapter suppresses transient feedback during its construction only.
  This also covers existing stale-Phase normalization, which previously could
  invoke the shared change callback while building the card. User changes after
  construction retain purple feedback and reduced-motion behavior.

The shared renderer, card markup, CSS, header helper, destination resolution,
snapshot and persistence services are byte-for-byte unchanged. Initial Add still
uses Explorations globally and the explicit/contextual destination otherwise.
Edit retains its source. Task identities, metadata, Markdown, progress, History,
statistics, draft isolation and the deferred location-selection design remain.

## Opening-frame verification

New `task-opening.html` reuses the isolated live-card service/vault setup and
installed native styles. Before activating its UI entry button, it registers the
first animation-frame callback. It captures synchronous state and 12 samples
through the opening sequence. Delayed reads are released by a frame boundary,
not a production timeout. Checks cover the first visible frame and every sampled
visible frame, rather than waiting for readiness or eventual stability first.

Each run exercises 13 openings: cold/warm Home Add, Project Add, Resource Add,
delayed minimal/full Edit, warm long-title Edit, completed Edit, stale-Phase Edit,
three repeated Edit openings and retry after an initial read failure. Separate
checks cover read failure, cancellation before readiness and cancelled late failure.

- **3,816 checks passed at 1480 × 1058.**
- **3,816 checks passed at 360 × 640 and 150% scaling.**
- **3,816 checks passed with reduced motion enabled.**
- Across all three runs, **maximum measured geometry drift was 0 CSS pixels**
  between sampled visible frames for modal, header, card, outer surface, title
  and footer position/size. Assertions allow at most one pixel for fractional
  display rounding; the measured result was zero.
- No sampled visible frame contained Loading task, incomplete regions, initial
  update feedback, missing metadata or misplaced initial title focus. Delayed
  reads kept the modal/backdrop absent and focus on the entry point. Closing
  restored entry focus. Initial labels/action order, source, checkbox, necessity,
  date/time, Phase, description indicator and checklist counts are checked.

The runner now exports these traces as JSON in addition to ordinary screenshots.
Screenshot capture is requested at the first-visible-frame sample and again after
sampling. Screenshot IPC can complete later than that request; **the pre-paint
measurements and full traces establish opening stability**, not a claim that an
eventually encoded screenshot alone proves the first frame. Screenshots were
personally inspected for header placement, correct card proportions, wrapping,
scrolling and fixed footer geometry.

Evidence:

- [Original opening trace](../../../../../System/Backups/task-opening-20261014/baseline-desktop-frames.json)
- [Original failure log](../../../../../System/Backups/task-opening-20261014/baseline-desktop.log)
- [Desktop opening trace](../../../../../System/Backups/task-opening-20261014/desktop-frames.json)
- [Narrow/150% opening trace](../../../../../System/Backups/task-opening-20261014/small-150-frames.json)
- [Reduced-motion opening trace](../../../../../System/Backups/task-opening-20261014/reduced-motion-frames.json)
- [Per-scenario geometry summary](../../../../../System/Backups/task-opening-20261014/opening-summary.csv)
- [Home Add, first-visible capture](../../../../../System/Backups/task-opening-20261014/review/desktop-home-add-cold-first-visible.png)
- [Project Add, first-visible capture](../../../../../System/Backups/task-opening-20261014/review/desktop-project-add-first-visible.png)
- [Minimal delayed Edit, first-visible capture](../../../../../System/Backups/task-opening-20261014/review/desktop-minimal-edit-delayed-first-visible.png)
- [Full delayed Edit, first-visible capture](../../../../../System/Backups/task-opening-20261014/review/desktop-full-edit-delayed-first-visible.png)
- [Narrow Add at 150%, first-visible capture](../../../../../System/Backups/task-opening-20261014/review/small-150-home-add-cold-first-visible.png)
- [Narrow full Edit at 150%, first-visible capture](../../../../../System/Backups/task-opening-20261014/review/small-150-full-edit-delayed-first-visible.png)

## Existing regressions and safe installation

- Existing shared-card/composer fixture: **1,839 desktop checks** and **1,835
  narrow/150% checks** passed without weakening assertions. Coverage includes
  pre-change/current panel parity, editor/panel parity at matching widths, focus,
  wrapping, Steps, date/necessity/Phase updates, description preview, anchoring,
  reduced motion, Save/Cancel, failed persistence/retry, locks and task data.
- Existing modal-regions **176**, task-form-workflows **64**, Home **48** plus
  workspace/Note layouts **36**, task-step-progress and row-focus passed.
- **2,101 Quick Add/Inbox browser checks passed.** Those interfaces are unchanged.
- **21 Node suites passed:** task-composer-routing, task-association-removal,
  task-created-completion, task-layout-polish, task-compact-form, task-form,
  task-planning, task-progress, task-history, task-mutations, task-workspace,
  task-data, task-creation-retry, project-planning, inbox, data-store.integration,
  shared-projects.integration, completion-audio, typography, statistics and icons.

Pre-change source/styles/artifacts are preserved under
`System/Backups/task-opening-20261014/source/`. Staged artifacts, build/test logs,
frame traces, summary and screenshots are in that same ignored backup directory.
The established `build.js --output-dir` workflow staged the tested sources first.
Normal installation followed verification. Installed syntax/plugin loading and
scoped whitespace checks passed; installed main/native/asset-manifest hashes match
staging. Atlas's native artifact and asset manifest remain unchanged. No live vault
task was edited, unrelated changes were preserved and Obsidian was not restarted.

Installed `main.js` SHA-256:
`eba1106fc3b8fdc6e551ac5464f309ed9789a4f4312c58f4d889507f437be666`

No remaining opening shift was observed in the focused fixtures. They simulate
native Modal hosting and use isolated data; the live Obsidian theme/window remains
the final review environment. Very long content legitimately requires body
scrolling, and later user edits/viewport resizing can legitimately resize content.
The previously reported unrelated Files-divider issue was not changed or rerun
as part of this initialization fix.

Reload Hub Project Menu and review opening Add/Edit in the live window. Stop here.
