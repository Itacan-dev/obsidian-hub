# Task editor inline configuration accordion — 2026-10-14

Implemented, verified, staged and installed. Ordinary Add/Edit now reveals its
five configuration controls beneath their action rows. The actual shared task-card
renderer, pending draft, specification contrast, balanced 8px gaps and Phases 1–4
behavior are retained. Stop for review.

## Reuse and disclosure ownership

`ui/task-accordion.js` supplies one exclusive disclosure owner per live form. It
mounts the existing control render callbacks inside stable, labelled sections
directly after their buttons. Each action has a stable `aria-controls` association,
accurate `aria-expanded` and a decorative Lucide right/down chevron. Add step has
no chevron. Hidden sections occupy no space and contain no active controls.

`ui/task-live-form.js` passes this adapter to the existing endpoint and Description
controllers. `ui/task-compact-form.js` accepts an optional disclosure binder for
Necessity/Phase; its default remains the existing popover binder. Quick Add/Inbox
and other compact callers retain their presentation and dismissal conventions.

Reused implementations include `mountTaskDateEndpoint`,
`createTaskDatePopoverInput`, `measureNativeDatePopover`,
`bindNativeDateTimePicker`, `mountTaskNecessity`, `mountTaskPhaseButton`,
`selectionOption`, `selectionKeys`, the Description render callback, existing
footer/selection CSS and the shared task-card presentation. No independent date
parser, selector, task renderer, model or persistence implementation was added.

| Closing section | Draft result |
|---|---|
| Start/Due | Local endpoint edits discarded unless Apply validated the full range |
| Necessity | Immediate parent-draft selection retained |
| Description | Exact entered Markdown retained in the parent draft |
| Phase | Immediate parent-draft assignment retained |

Cancel/Apply/Done and Escape restore the heading focus. Switching immediately
removes the old controls before focusing the new section. Native Enter/Space toggle
the button; selection keyboard navigation remains. Date inputs focus without
opening the native picker. Native picker and read-only tooltip Escape take priority.
Clicking the card does not implicitly apply or dismiss configuration. Clearing the
title closes configuration, disables native actions and retains pending data.

Add step closes configuration with these same semantics, expands the independent
checklist and focuses its native Step editor. Checklist and accordion disclosure
states are separate. Save closes configuration before the existing commit path;
unapplied dates are never silently applied. Parent Cancel discards the whole draft.

## Geometry, motion and scrolling

Expanded content starts at the existing specification label column. CSS preserves
collapsed row heights/spacing and shared icon alignment, adds one trailing chevron
column, and supplies compact 8px section/footer gaps without another surface,
title, X or separator. Necessity uses equal columns with the original contained
red/yellow markers. Description fills the section width with a 90–100px initial
textarea. Phase options wrap and scroll inside a `min(186px, 30vh)` limit: about
five ordinary 34px rows plus padding, fewer when names wrap.

Dates retain matching 36px native fields, left actionable picker indicators,
reserved clear slots and intrinsic measured widths. They stack when their measured
total exceeds section width, including during a real viewport resize. Optional
time, midnight, cross-year formatting and complete-range validation remain.

On the first configuration interaction, the adapter records the modal's current
top and anchors it there. Content grows downward within the existing maximum and
available bottom margin. Only the body scrolls; header/footer remain separate
regions. Viewport resize clamps bounds using measured header/footer chrome. No
fixed modal height, timeout or readiness fade is introduced. Initial Add/Edit
construction and native focus remain unchanged. The editor-only outer card
container sticks at its existing 16px inset while configuration scrolls beneath
it; its markup and dimensions are unchanged. Disclosure scrolling reserves the
card's actual height so headings and fitting controls remain below it. A measured
fallback releases stickiness for an expanded checklist taller than the available
body, preserving access to controls without resizing the card.

`ui/task-editor.js` reserves the measured native scrollbar outside the original
content width before title measurement. The form uses `overflow: clip`, avoiding
outer-wrapper scrolling while containing the gutter. Card width does not change
when the body starts scrolling. Disclosure uses a restrained 120ms clip/opacity
transition; switching removes the previous section immediately. Reduced motion
reveals/collapses synchronously. There is no completion-time scroll: testing caught
that such a scroll could retarget a later card pointer click. Controls are revealed
synchronously inside the body instead. Final geometry remains in place during
the reveal; animating content height would shrink the scroll range and undo that
synchronous scroll. Collapse removes the section after its short transition.

Across nine sampled frames per disclosure, both desktop and narrow/150% traces
measure **zero modal-top drift, zero card-width drift and zero card-height drift**.
Legitimate later metadata/checklist edits and existing title input/preview focus
transitions are measured separately from disclosure. Collapsed Add remains
**560 × 398** desktop and **328 × 396** narrow. The 8px upper/lower specification
gaps and pre-change relative card geometry pass their baseline comparisons.

## Tests

- New accordion fixture: **905 checks desktop and 905 narrow/150%**. Covers
  disabled/initial states, five/six actions, chevrons/ARIA, exclusive toggles,
  trusted Enter/Space/Escape, focus restoration, native picker clicks/Alt+Down,
  endpoint transactions/validation/clearing, immediate selections, exact Markdown,
  marker containment, independent Steps, Save/Cancel, viewport resize, motion,
  scroll ownership, card-pointer focus, visible sticky cards, full fitting control
  visibility and configuration access with a 30-Step oversized checklist.
- Shared renderer/editor: **1,936 desktop / 1,932 narrow**. Independent preserved
  panel comparisons, native Markdown/IME, Steps, completion timestamps, IDs,
  metadata/history/statistics, Save/Cancel, rollback/retry and locks remain.
- Adapted configuration control fixture: **213 each**; native indicator geometry,
  clearing slots, picker functionality, optional/midnight/range validation,
  immediate values, exact Description and persistence assertions remain.
- Opening stability: **3,829 each**. Native autofocus: **472 each**.
  Phase 1 readiness/hierarchy: **158 each**. Step alignment: **65 each**.
  Configured icons/shared description tooltip: **539 each**. Contrast/spacing:
  **194 each**.
- Modal regions **176**, task-form workflows **64**, task-step-progress and
  row-focus passed. **2,101 Quick Add/Inbox browser checks passed**.
- **14 Node suites passed:** task-form, task-compact-form, task-layout-polish,
  task-created-completion, task-progress, task-history, task-mutations,
  task-workspace, task-data, task-creation-retry, typography, task-planning,
  project-planning and inbox.
- Staged and installed syntax/plugin loading, artifact hashes and scoped
  whitespace checks passed.

Existing presentation assertions now check inline sections rather than floating
titles/X controls or popover positioning. Tall sections are asserted inside the
bounded scrolling body rather than requiring all their content to fit one frame.
Pointer/hover tests reach visible card targets through that body. Persistence,
native field, tooltip, focus and renderer assertions were retained.

An exploratory run of the historical `task-compact-form.html` still fails its
obsolete Add subtitle assertion (`Create a new task`). The backed-up editor already
has no such subtitle and uses the shared composer. That historical fixture was
left unchanged; current compact-domain and actual Quick Add/Inbox coverage above
passes. Its failure log is preserved rather than reported as a passing suite.

## Visual evidence and limits

Final screenshots were inspected for compact proportions, correct chevrons,
label-column alignment, native field/clear geometry, marker containment, full-width
Description, wrapping Phase names, internal scrolling and viewport bounds. Tests
use isolated Chromium, synthetic services and installed Obsidian 1.14.4 CSS/fonts.
Native Modal hosting is simulated; live theme/window review remains. No live task
was edited and Obsidian was not restarted or reloaded.

- [Empty Project Add](../../../../../System/Backups/task-inline-accordion-20261014/review/desktop-empty-add.png)
- [Populated collapsed Add](../../../../../System/Backups/task-inline-accordion-20261014/review/desktop-collapsed-project.png)
- [Configured Edit](../../../../../System/Backups/task-inline-accordion-20261014/review/desktop-configured-edit.png)
- [Start expanded](../../../../../System/Backups/task-inline-accordion-20261014/review/desktop-start.png)
- [Due expanded](../../../../../System/Backups/task-inline-accordion-20261014/review/desktop-due.png)
- [Must selected](../../../../../System/Backups/task-inline-accordion-20261014/review/desktop-necessity-must.png)
- [Should selected](../../../../../System/Backups/task-inline-accordion-20261014/review/desktop-necessity-should.png)
- [Multiline Description](../../../../../System/Backups/task-inline-accordion-20261014/review/desktop-description.png)
- [Phase selected](../../../../../System/Backups/task-inline-accordion-20261014/review/desktop-phase.png)
- [Long Phase list](../../../../../System/Backups/task-inline-accordion-20261014/review/desktop-phase-long.png)
- [Narrow Resource Add](../../../../../System/Backups/task-inline-accordion-20261014/review/small-150-resource-collapsed.png)
- [Narrow stacked Start](../../../../../System/Backups/task-inline-accordion-20261014/review/small-150-start.png)
- [Narrow Necessity](../../../../../System/Backups/task-inline-accordion-20261014/review/small-150-necessity-should.png)
- [Narrow Description](../../../../../System/Backups/task-inline-accordion-20261014/review/small-150-description.png)
- [Narrow long Phase list](../../../../../System/Backups/task-inline-accordion-20261014/review/small-150-phase-long.png)
- [Desktop opening/expansion frames](../../../../../System/Backups/task-inline-accordion-20261014/desktop-frames.json)
- [Narrow frames](../../../../../System/Backups/task-inline-accordion-20261014/small-150-frames.json)
- [Per-disclosure geometry summary](../../../../../System/Backups/task-inline-accordion-20261014/frame-summary.csv)

Native chooser localization, internal appearance and placement remain controlled
by Chromium/the OS. On short/narrow windows the body scrolls to reach configuration
while the card stays visible. Exceptionally tall expanded checklists that consume
the available body retain natural scrolling; they cannot remain fully visible
alongside configuration without changing their dimensions. Inline controls never
overlay the card. Existing location/Phase truncation inside the card is
unchanged; selector names wrap. No location chooser or unrelated polish was added.

## Safe installation

Production changes are confined to `styles.css`, `ui/task-live-form.js`,
`ui/task-compact-form.js`, `ui/task-editor.js` and new `ui/task-accordion.js`.
`task-card.js`, panel adapters, date/time helpers, persistence and domain sources
are unchanged. Pre-change sources/tests/styles/installed artifacts are preserved
under `System/Backups/task-inline-accordion-20261014/source/`. The ignored backup
directory also holds staging, deltas, load/build/test logs, screenshots and traces.
Unrelated workspace changes were preserved.

The established `build.js --output-dir` staged first. Staged loading passed before
normal installation. Installed main/styles/native/asset hashes match staging;
native and asset artifacts are unchanged.

Installed `main.js` SHA-256:
`251466df6c88cfb3245dd934446a91dc2b4f0e51310590b2bd1e2cde44db6bc0`

Reload Hub Project Menu for live review. Implementation and installation are
complete; stop here.
