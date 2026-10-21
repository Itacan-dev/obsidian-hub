# Task window layout polish — Phase 1 — 2026-10-13

Implemented the requested **Task → Steps → Description → Location → Properties**
hierarchy in the ordinary Add task and Edit task windows. This builds on the
previous compact form and retains its destination, metadata and modal machinery.

## Layout and editing

- Both windows now have three matching headings: **Task**, **Location** and
  **Properties**. Task contains the single-line title, existing editable Steps,
  the inline **+ Add step** action and the description beneath them.
- Edit has a real task completion checkbox aligned immediately to the left of
  the title. It uses the existing native checkbox styling and completion audio.
  Checking/unchecking changes only the form draft and leaves the window open.
  Add omits this checkbox; new tasks remain incomplete.
- Steps are always shown when present. The shared `mountTaskSteps` receives an
  opt-in `inlineAdd` option: **+ Add step** reveals and focuses one input, hiding
  the action while it is open. Enter validates and confirms the Step without
  submitting the task form; Escape/Cancel dismisses that input. Empty or
  identity-marker-containing Steps are rejected by the existing validator.
  Existing Step titles, checkboxes, deletion, nested-descendant removal and row
  focus restoration use the same implementation and Markdown anchors as before.
- Typing a new Step does not create an empty Step in the task model. Save also
  confirms a valid pending Step, so text is not silently lost if Enter was not
  pressed. Empty pending inputs are discarded on Save. Cancel/close discards all
  pending Step changes.
- Empty descriptions show a neutral **align-left / Add a description** action.
  Clicking it reveals/focuses the multiline editor; an empty editor collapses on
  blur. Existing descriptions are shown directly in the editable textbox. The
  editor starts at two lines, grows as required and retains its bounded height.
  Multiline whitespace and Markdown retain the existing metadata persistence.
  There is no Description heading or formatting toolbar.
- Location keeps its existing heading, full-width two-line trigger, hierarchical
  provider, initial-context rules and relocation behavior.
- Properties contains Dates, Necessity and applicable Project phases. The Steps
  property button is removed. Existing property values, neutral button surfaces,
  full date ranges, necessity markers and popover functionality are retained.
  Property popovers were not redesigned.
- The original header icon/title/subtitle, separators, footer actions, width,
  maximum height and fixed header/footer layout are retained. Only the body
  scrolls when Task content grows. Content spacing keeps Steps and Description
  within Task without inserting dividers.

## Main completion and persistence

`saveTaskSnapshot` now accepts the pending parent completion state, preserving the
existing Markdown checkbox marker when the state is unchanged. A change modifies
that marker and produces a `kind: task` transition through the same progress
pipeline already used for Step completion and task-panel actions. The checkbox
action timestamp is preserved through Save. A newly completed task receives the
existing stable task ID; native block IDs, Step IDs and unrelated content survive.

`taskProgressMutation` retains the active parent binding until an explicit editor
completion transition has reversed or updated its history record. This handles
uncheck plus title changes, legacy records without task IDs, and completion plus
relocation. Earlier history snapshots remain unchanged when completion does not
change. A phase change combined with completion is processed as a full task edit.
Metadata failure rolls the Markdown write back before any completion is recorded.
Creation explicitly retains incomplete status.

There is no storage schema change, description migration or separate Step model.
Quick Add and Inbox retain their expanded form presentation; the new Step option
is enabled only by the ordinary task-window adapter. Their existing behavior was
verified by regression tests. Other task interfaces were not redesigned.

## Verification results

Tests use isolated in-memory vaults or temporary data and do not edit production
tasks. Native Chromium keyboard events exercise Enter, Space, Tab and Escape.

- **18 relevant Node suites passed:** task-layout-polish, task-compact-form,
  task-planning, task-progress, task-history, task-mutations, task-form,
  task-workspace, task-data, task-creation-retry, tasks, project-planning,
  task-association-removal, inbox, data-store.integration,
  shared-projects.integration, completion-audio and typography.
- The new **task-layout-polish** suite covers Project and Resource completion,
  timestamps, completion/uncheck with renamed titles, stable/native IDs,
  nested-Step preservation, description retention, no duplicate History,
  phase changes, metadata rollback, relocation, legacy unchecking, custom
  checkbox markers and incomplete task creation.
- **task-compact-form:** 223 layout/interaction checks at 1480x1058 and 360x640,
  using the installed Obsidian stylesheet; the small run uses 150% display
  scaling. An earlier 217-check run passed at 420x850 with 150% scaling. Covers
  the three headings, empty/populated descriptions, directly shown Steps,
  Enter confirmation and invalid Steps, real main completion, Save versus
  Cancel/close, checkbox restoration and History, description/Step persistence,
  project/resource location changes, dates/necessity/phases, pending-save locks,
  rollback/retry, keyboard/focus and fixed scroll regions.
- **task-form-workflows:** 65 checks passed, including actual Roadmap membership,
  capture creation/organization, editing, relocation, Step History and date/time
  persistence.
- **task-location-picker:** 103 checks passed for destinations, hierarchy,
  search, live changes, focus, creation/moves, rollback and retry.
- **modal-regions:** 176 checks passed; **task-form-polish:** 85 checks passed;
  **row-focus** passed for existing shared Step and association editor behavior.
- **inbox:** all 2,099 Quick Add/Inbox browser checks passed at 600x900, followed
  by a clean browser-runner exit.
- Installed `main.js` passes syntax and plugin-load checks, and the installed
  main/native/asset-manifest artifacts match staging byte for byte. Plugin-only
  whitespace checks pass. Existing unrelated Markdown changes were preserved.

The fixture's optional native-stylesheet lookup was corrected to explicitly use
`window.location`; its local location-selection helper had shadowed that name.
The reported native-style runs for this phase load the stylesheet correctly.

## Installation and review

Pre-change source, stylesheet and installed artifacts are preserved under
`System/Backups/task-layout-polish-20261013/source/`. The same ignored backup
directory holds staging, test logs and review screenshots. The established
`build.js --output-dir` workflow prepared staging, followed by the normal installed
build. The existing pinned Electron Node runtime was used because Node is absent
from PATH. Atlas's native artifact is unchanged.

Installed `main.js` SHA-256:
`28e46e072d9e1217ea46bc3cde208e11287d594cf9baf2c4eb81d7430f9bbab0`

No live Obsidian session was restarted or used for test data. Reload Hub Project
Menu to review the installed windows. The descriptions still travel with Hub
metadata rather than a standalone Markdown export. Verification does not replace
the requested visual review in the user's live theme and window configuration.

Phase 1 is complete and stopped for visual review. Quick Add/Inbox integration
and further property-popover polish are deferred.
