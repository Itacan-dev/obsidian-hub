# Compact Add/Edit task windows — 2026-10-12

The latest changes and screenshots are documented in
[Add/Edit task final polish](task-final-polish-verification.md).

The subsequent Task/Steps/Description layout and main-completion changes are
documented in [Task layout polish, Phase 1](task-layout-polish-verification.md).
This file records the previous compact-form phase.

The latest checklist, description-display and proportion refinements are recorded
in [Refined Add/Edit experience](task-refinement-verification.md).

This phase changes only the ordinary Add task and Edit task windows. Quick Add,
Inbox, Today's Focus, Home panels and Schedule retain their existing interfaces.
Pre-existing uncommitted changes in the vault were preserved.

## Layout and shared controls

- `ui/task-compact-form.js` supplies the same Title, Description, Location,
  Dates/Necessity/Steps/Phase row and collapsed Step editor to Add and Edit.
  Add now includes **Create a new task**; Edit keeps **Make changes to this task**.
- Shared `createModalHeader` and `layoutModal` retain icons, close chrome,
  separators, fixed header/footer, scrollable body and maximum-height rules.
  The compact layout has a 16px header-to-content gap and field spacing.
- `mountTaskText`, `mountTaskDestinationFields` and the existing two-line
  capture trigger are reused. `mountTaskSteps` was extracted from the expanded
  form, preserving its existing data structures, nested deletion and focus
  restoration. The expanded Capture forms call the same Step implementation.
- `createTaskDateTimeInput` in `ui/date-time.js` is shared with the existing
  native picker. Optional dates and times remain separate native inputs.
- New reusable Dates, Necessity, Description and Phase controls are exported
  from `ui/task-compact-form.js`. `ui/task-popover.js` supplies contextual
  positioning, keyboard dismissal, focus return and lifecycle cleanup. Native
  top-layer popovers avoid clipping by the modal's scroll area without opening
  another Modal. Only Steps expand inline.
- All property buttons keep neutral bordered surfaces, including when configured.
  Necessity and Phase options use the existing purple selection tokens. Red/yellow
  markers use the task-panel colors with no borders, outlines or shadows.

## Description persistence

Descriptions are optional `taskMetadata[hubTaskId].description` strings in the
existing atomic Hub data store. The existing shared-project store includes this
metadata through its normal ownership routing. No schema migration or startup
write is required; missing descriptions remain empty. Multiline whitespace,
Markdown syntax, code fences and identity-looking text are preserved verbatim.

A task receiving its first metadata field receives the ordinary stable hidden
task ID. Description content is never inserted into Markdown or inferred from
indented note prose. Existing native block IDs, line endings, nested Steps,
completion markers and unrelated note content retain their existing semantics.
Readers/writers that omit descriptions preserve them; an explicitly empty
description clears that field. Metadata conflict detection and rollback cover
description edits and relocation. Deletion uses the existing metadata cleanup.

Descriptions therefore travel with Hub metadata, **not a standalone Markdown
note export**. This is the same persistence boundary already used for necessity,
dates and project phases. The field edits Markdown text without rendering it or
adding a formatting toolbar.

## Location and context

The Location field opens the existing `mountCaptureLocationTree` hierarchy and
`taskLocations` provider in one contextual selector, grouped into Projects and
Resources. Workspace roots, eligible folders and Markdown notes remain valid;
choosing a folder uses its normal `Tasks.md`, created only during Save/Add.
Explicitly opened archived workspaces remain available alongside other valid
destinations. Search, live create/rename/delete refresh, tree keyboard navigation
and selection revalidation are reused.

An explicit destination takes precedence and is never replaced by another one.
Otherwise Add uses the visible workspace's authoritative `currentContext()` and
an eligible active note or workspace root. Home starts with no destination and
requires selection; it never falls back to the first available workspace.
Edit starts at the task's actual source note. Saving an unchanged destination
also follows its existing native file object if that note was renamed.

Relocation validates the destination's owning workspace and uses the existing
queued write/rollback pipeline. Identity, Steps, metadata and earlier History
snapshots survive. Steps completed in the same save as a cross-workspace move
are attributed to the destination; immediate task-reference reconciliation also
uses that owner. No Home or Schedule UI was changed.

## Property behavior

- **Dates:** always shows the complete configured range, including a start that
  has already passed. Labels preserve 24-hour times, explicit midnight and years
  where needed; cross-month/year ranges have both endpoints. Clear date, Clear
  time and Clear all operate on a local draft. Apply validates date order and
  same-day time order; Cancel, Escape and outside dismissal discard that draft.
  Untimed starts remain start-of-day and untimed due dates remain end-of-day.
- **Necessity:** Must do, Should do and None retain the canonical `must`, `should`
  and unset values. Selection commits to the form draft and closes the popover.
- **Steps:** live completed/total counter, add/edit/check/uncheck/delete, existing
  nested-descendant behavior and row-removal focus. Opening an empty editor
  focuses a new-step prompt without adding a phantom task Step. Collapse retains
  draft values; Save validation reveals a collapsed invalid Step. Original
  snapshots are cloned, so Cancel/close do not mutate them. The prior editor had
  no Step-reordering control; none was invented in this phase.
- **Phase:** available only for a Project with phases. Uses actual Roadmap names
  and IDs, supports clearing and wraps long names. A workspace change clears the
  old phase with a visible draft notice, even if two Projects reuse an ID. A
  no-longer-available phase is likewise explicitly cleared in the draft. Cancel
  preserves the original association. Resource tasks gain no Project links.
- **Lifecycle:** Delete retains its existing confirmation. Save locks all
  controls, including Description, and blocks dismissal until the write settles.
  Failed saves retain the draft for retry. Successful saves and cancellation
  use the original modal close/focus lifecycle.

## Verification

All tests use isolated fixtures or temporary data, not production tasks/captures.

- **55 Node suites passed:** 54 passed in the broad run. The old workspace test
  expected every cross-workspace move to fail; it was updated for the requested
  valid relocation behavior and passed on rerun. The affected task, history,
  progress, Markdown-mutation and compact-form suites also passed after that
  correction. The new compact suite covers descriptions across create, restart,
  update, omission, clear, deletion, stale editors, relocation and rollback,
  preserving CRLF, native IDs, prose, fenced code and nested Step identities.
- **task-compact-form:** 197 checks at 1480x1058 and at 360x640 with 150% display
  scaling, using the installed Obsidian stylesheet. Earlier 173-check runs passed at 1100x850,
  1480x1058 and 420x850, including the installed stylesheet. Covers Home/Project/
  Resource context, explicit destinations, all property controls, independent
  dates/times and clears, pending state, keyboard navigation/Tab/Escape/focus,
  neutral styles, popover bounds, description growth, long Steps, fixed regions,
  Save/Cancel/Delete/close, nested deletion, rollback/retry and relocation.
- **task-form-workflows:** 65 checks at 1100x850 and 420x850, including real
  Quick Add and Inbox persistence, Edit, dates/times, Step History and actual
  Roadmap phase membership after changing/clearing a phase.
- **task-location-picker:** 103 checks at 1100x850 and 420x850: provider parity,
  full workspace hierarchy, archived and fallback destinations, search, native
  keyboard/pointer focus, live file changes, real create/move/rollback/retry and
  fixed modal bounds. Capture's existing restricted location provider is intact.
- **inbox:** all 2,099 existing checks passed at 600x900, covering Quick Add and
  Inbox persistence, routing, partial drafts, retries, date precision, Steps,
  focus, scrolling and action footers.
- **task-form-polish:** 84 checks at 1480x1058 with the installed stylesheet,
  covering the compact editor and unchanged Capture picker/selection styles.
- **modal-regions:** 176 checks; **form-consistency:** 76 checks; **row-focus**
  and **selection-settings** passed. Native keyboard events are sent by Chromium.
- Installed `main.js` passes syntax and plugin-load checks. Its hash matches the
  disposable staged build byte for byte. Atlas's native artifact is unchanged.

Two broader legacy browser fixtures still fail before reaching the changed task
forms. Both failures were reproduced from the pre-change source backup in a
separate baseline tree:

1. `task-workspace`: **Mode separator aligns with Files divider**.
2. `task-planning`: **Expanded Future dates use range**, using its older
   month-first label expectation. The canonical date and new compact range tests
   pass. This fixture also retains older expanded-form expectations; the focused
   workflow/compact fixtures are the current Add/Edit coverage.

These baseline issues were left for separate review to preserve this phase's
scope. No production Obsidian session was restarted or used for data migration.

## Build, installation and backup

Pre-change source, stylesheet and installed bundles are preserved under
`System/Backups/task-compact-20261012/source/` (ignored by Git). The same directory
contains a disposable staged build, Node results and baseline-failure evidence.
The build uses the repository's `build.js --output-dir` staging workflow and
then its normal installed build. Because Node is absent from PATH, the existing
pinned development Electron executable was run with `ELECTRON_RUN_AS_NODE=1`.

Installed `main.js` SHA-256:
`2948663522a8d0f805e2ae183944aea602d7d58331b11943182dac625cdf5eed`

The installed main/native/asset-manifest hashes match staging. Reload Hub Project
Menu in Obsidian to review the new windows. Quick Add and Inbox integration is
deliberately deferred. Stop here for review.
