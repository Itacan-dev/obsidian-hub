# Interaction corrections and accordion refinement — 2026-10-15

Implemented and verified in the requested three phases, then staged and installed.
Ordinary Add/Edit keeps the shared card, pending draft and native controls. Stop
for review after this pass.

## Phase 1 — Completion and date dismissal

The checkbox target was **not replaced**. Chromium toggles it before dispatching
`click`; the Step adapter then abandons the empty row at the modal's bubbling click
boundary. Its refresh unconditionally restored `checkbox.checked` from the still
unchanged completion draft. Native `input`/`change` subsequently saw the old value.
The preserved-source event trace reproduces that sequence. The live form now
synchronizes the checkbox only when the draft completion value changes. Unrelated
Step refreshes leave native preactivation intact. The existing change handler still
owns completion, timestamps and draft updates; no click simulation or timer was added.

The existing shared `is-completed` class and Tasks-panel title styling now also
reach the native title editor through inherited text decoration. The title-focused
override no longer strips the main title's completion treatment; Step editing
keeps its established behavior. Completion/uncompletion updates immediately in
preview and editable Add/Edit. Location/date/metadata decoration, overdue semantics
and parent Save/Cancel remain unchanged; no Markdown strike characters are stored.

Date dismissal exposed two presentation paths, rather than a reset of the stored
date value. Accordion cleanup blurred the native control before hiding its section.
The section now becomes hidden synchronously **before cleanup**. In addition,
trusted held presses reproduced an empty native field reverting to its hint during
focus transfer, before the dismissing click. Once focused, the existing native
field now retains its segment presentation for that mounted editor's lifetime.
Disabling time restores its unavailable hint. Disposal removes the old controls
immediately; reopening creates a fresh local draft. No data copy, overlay, exit
animation, delayed hide or new timer is involved. Native focus transfer and date
validation/transactions remain intact.

**357 lifecycle checks plus 49 trusted date press/release checks per layout passed.**
These cover Add/Edit completion exactly once, reverse toggling, empty/valid pending
and confirmed/collapsed Steps, checkbox identity, native editable title strike,
retained draft, Save/reopen/Cancel and completion History. Start/Due cleanup samples
cover configured/unconfigured endpoints and Cancel/Apply/heading/switch/Escape/Steps/
parent close. Native held presses additionally sample three frames before pointer-up
for genuinely empty and populated fields, including parent Cancel. No placeholder
appears during those dismissal frames; cleanup runs with no visible section geometry.

## Phase 2 — Step surfaces and unavailable time

The raised Add steps rectangle came from the capture form's generic `:focus` input
shadow after focus restoration, becoming visible once pointer hover stopped
overriding it. Scoped inline-action focus rules now keep border/shadow flat and
retain a visible neutral `:focus-visible` outline. Pointer cancellation of a new
Step no longer forces focus onto the restored disclosure; Escape and keyboard
cancellation still restore useful visible focus. The existing disabled Add step
pointer guard is untouched. Generic Step-form callers retain their previous behavior.

The specification heading's existing **6px inset token** now also sizes the Steps
disclosure and internal Add step surfaces. Their left edges extend by 6px, with
compensating padding and width. Icon/text coordinates, right boundaries, checklist
guide/columns, card padding and necessity/main-checkbox/title positions remain
unchanged. These geometry rules are scoped to Add/Edit; normal panels are unchanged.

Chromium's disabled time indicator is replaced only in that unavailable state by
the installed native Lucide clock. The native indicator is explicitly hidden then;
enabling the field hides the fallback and restores the actual native indicator.
The fallback and Add time text use `--text-faint` at opacity 1 on the existing dark
surface. Shadow-tree visibility measurements verify one indicator in each state.
Clearing a date after time focus correctly restores the unavailable clock/hint.
Equal columns, stacking, midnight precision, clearing and native picker stay intact.

**251 checks per layout passed**, covering repeated Escape/blur/cancel/delete
restoration, trusted Tab/Enter, keyboard outline, pointer cancellation, initial and
restored Add/Edit, hover/leave, measured disclosure geometry, enabled/disabled
internal Add, unchanged disabled-click focus/selection, and clock readiness.

## Phase 3 — Selected heading and neutral content

Expanded headings retain the exact Explorer accent-selection fill and now have all
four corners rounded. The content container paints transparently onto the ordinary
modal background. Existing padding, indentation, 8px gaps and full-width control
boundaries remain. No enclosing border, shadow or replacement panel was added.
Native fields/Description keep `--background-primary`; Necessity remains Should do |
Must do with its existing purple selection and semantic markers. Date footers,
Description actions, Phase's 4px gaps, wrapping and bounded scrolling are unchanged.
White checks remain outside the heading, with 16px glyphs, 12px gaps and 6px insets.
Collapsed hover remains gray. Disclosure remains instantaneous and exclusive.

**351 checks per layout passed**, including old/new geometry comparisons for each
heading, content section, actual input/textarea/option/footer button; actual raster
samples matching the modal background; eight stable frames per expanded property;
keyboard/focus, retained selection, outside checks and long Phase scrolling.

## Regressions

- Shared renderer/editor: **1,942 desktop / 1,938 narrow** checks. Normal-panel
  comparisons against the preserved panel implementation remain. The intentional
  editor-only 6px disclosure-surface extension is measured explicitly; added checks
  also compare the actual icon/label columns. IDs, nested Steps/timestamps, Markdown,
  native selection/IME, metadata/History/Statistics, locks and rollback/retry pass.
- Opening **3,829 each**, native autofocus **472 each**, Step geometry **65 each**,
  native configuration controls **213 each**, accordion **905 each**, integrated
  Steps **166 each**, specification indicators **420 each**, configured-state/shared
  tooltip **591 each**, configuration layouts **88 each**, readiness **138 each**,
  specification spacing **170 each**, card-border/Step correction **479 each**.
- Desktop modal regions **176**, shared workflows **64**, task-step-progress and
  row-focus passed. **2,101 Quick Add/Inbox checks passed**.
- **15 Node suites passed with recorded exit 0:** task-form, task-compact-form,
  task-layout-polish, task-created-completion, task-progress, task-history,
  task-mutations, task-workspace, task-data, task-creation-retry, task-planning,
  typography, project-planning, inbox and icons.

Only superseded surface/corner and disclosure-inset expectations were updated.
Other geometry, focus, native input, identity and persistence assertions remain.
The existing fixtures changed are `task-live-card.html`,
`task-specification-indicators.html` and `task-surfaces-integrated-steps.html`.
The browser runner now reads native shadow-tree visibility as well as geometry,
including indicators without visible boxes. New fixtures are
`task-interaction-baseline.html`, `task-interaction-corrections.html`,
`task-date-dismissal-pointer.html`, `task-step-disclosure-refinement.html` and
`task-neutral-accordion.html`. The baseline explicitly loads preserved sources and
the original stylesheet, independently reproducing the original defects.

## Evidence and review

Screenshots were inspected for native completed-title strike, flat Step restoration,
legitimate keyboard outline, balanced hover, faint clock, independent rounded
selection, neutral content, dark controls, white checks and narrow scrolling.

- [Completed editable Add](../../../../../System/Backups/task-interaction-accordion-20261015/review/hub-task-interaction-desktop-add-empty-pending-native-completed.png)
- [Completed editable Edit at 150%](../../../../../System/Backups/task-interaction-accordion-20261015/review/hub-task-interaction-small-150-edit-empty-pending-native-completed.png)
- [Restored Add steps after pointer cancellation](../../../../../System/Backups/task-interaction-accordion-20261015/review/hub-task-disclosure-desktop-add-restored-pointer-cancel.png)
- [Keyboard focus](../../../../../System/Backups/task-interaction-accordion-20261015/review/hub-task-disclosure-desktop-add-keyboard-focus.png)
- [Unavailable Start time](../../../../../System/Backups/task-interaction-accordion-20261015/review/hub-task-disclosure-desktop-add-start-unavailable.png)
- [Neutral Start](../../../../../System/Backups/task-interaction-accordion-20261015/review/hub-task-neutral-desktop-expanded-start.png)
- [Neutral Due at 150%](../../../../../System/Backups/task-interaction-accordion-20261015/review/hub-task-neutral-small-150-expanded-due.png)
- [Neutral Necessity](../../../../../System/Backups/task-interaction-accordion-20261015/review/hub-task-neutral-desktop-expanded-necessity.png)
- [Neutral Description](../../../../../System/Backups/task-interaction-accordion-20261015/review/hub-task-neutral-desktop-expanded-description.png)
- [Long Phase list](../../../../../System/Backups/task-interaction-accordion-20261015/review/hub-task-neutral-desktop-long-phase-bottom.png)
- [Original native event/cleanup/shadow evidence](../../../../../System/Backups/task-interaction-accordion-20261015/baseline-preserved-source-frames.json)
- [Corrected checkbox and date cleanup trace](../../../../../System/Backups/task-interaction-accordion-20261015/final-desktop-task-interaction-corrections-frames.json)
- [Held-press date frames](../../../../../System/Backups/task-interaction-accordion-20261015/final-desktop-task-date-dismissal-pointer-frames.json)
- [Narrow held-press date frames](../../../../../System/Backups/task-interaction-accordion-20261015/final-small-150-task-date-dismissal-pointer-frames.json)

Fixtures use isolated Chromium, synthetic vault/services and installed Obsidian
1.14.4 CSS/fonts. Native Modal hosting remains simulated with its previously
inspected lifecycle; live theme/window review remains after reload. Native picker
presentation remains controlled by Chromium/OS. Tall checklists retain their
existing scrolling fallback. No new functional limitation was found. No live task
was edited and Obsidian was not restarted or reloaded. Location selection remains deferred.

## Installation

Production changes are limited to `styles.css`, `ui/task-live-form.js`,
`ui/task-accordion.js`, `ui/task-form.js` and `ui/date-time.js`. Shared `task-card.js`,
panel adapters, task domain/persistence, schema and attention controller are unchanged.
Pre-change source/tests/styles/installed artifacts are preserved in
`System/Backups/task-interaction-accordion-20261015/source/`. That ignored directory
also contains staged artifacts, deltas, logs, screenshots, event/frame evidence and
hashes. Unrelated workspace changes were preserved.

The established `build.js --output-dir` workflow staged first. Final staged plugin
loading passed before normal installation. Installed main/styles/native/strict-asset
hashes match staging; native and strict assets match their pre-change backups.
All 13 staged artifacts were compared individually. Source syntax, plugin loading
and scoped whitespace checks passed; hashes are recorded in `installed-hashes.json`
inside the backup directory.

Installed `main.js` SHA-256:
`9d4267ffbe768528002bd53f88f75e4fc3ccd1fa81a5c08904d6a49aed986d5c`

Reload Hub Project Menu for live review. Installation is complete; stop here.
