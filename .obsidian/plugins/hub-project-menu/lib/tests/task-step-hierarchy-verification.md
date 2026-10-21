# Add/Edit final layout: Task → Location → Planning — 2026-10-13

The subsequent [spacing and optional actions polish](task-optional-actions-verification.md)
supersedes this phase's always-visible guide and purple Add step styling.

This pass adds the checklist hierarchy guide and renames the ordinary task editor's
Properties heading to Planning. It preserves the preceding checkbox/title/
description polish and task persistence architecture.

## Implementation

- The Steps section has a **1px muted neutral vertical guide**, aligned with the
  center of the main square checkbox. Shared title-padding / checkbox-column CSS
  values define that axis; native checkboxes are centered within their existing
  columns. The guide begins **8px below the title field** without connecting to it.
- The existing **24px spacing token** indents the checklist and Add step action.
  The guide extends through Add step, including the zero-Step state, and follows
  the section's height as rows/drafts appear or disappear. It stops before Description.
  A decorative pseudo-element with `pointer-events: none` adds no control or
  interactive target. No necessity/timeline styling is reused.
- The shared Step editor uses Lucide **circle-plus** only for its ordinary task
  inline action. Its existing purple text/icon color and compact icon size remain.
  The legacy Quick Add/Inbox presentation keeps its existing icon and layout.
- **Planning** replaces the visible Properties heading and accessible group name.
  Existing field identifiers and compact Dates/Necessity/Phase controls are retained;
  their state, values, popovers, selection styling and project/resource rules are unchanged.
- Description remains inside Task after Steps. Empty content uses the existing
  align-left action; expanded or populated content shows its contextual heading.
  The existing 16px separation after Steps and 24px gap before Location remain.
- The 560px width, content-driven height, fixed header/footer, scrollable body,
  title/check/focus styling and all Step interactions remain. This pass changes
  no domain or service files, storage schema, task IDs, Markdown/history/statistics
  behavior or unrelated interfaces.

## Verification and visual review

- **562 browser checks passed at 1480 × 1058**. Empty Add remains **560 × 529**;
  populated Markdown/Steps Edit remains **560 × 735**.
- **559 checks passed at 360 × 640 and 150% scaling**. Empty Add remains **328 × 527**;
  populated Edit remains bounded at **328 × 544** with its body scrolling.
- Guide checks cover zero, one and multiple Steps; pending drafts; completed parent
  and child tasks; editing, Enter/blur confirmation and deletion. They compare the
  rendered guide axis with the actual main checkbox center, verify full section
  coverage and the gap below the title, check separation from Step controls, and
  verify circle-plus / checkbox alignment. First-Step addition grows the guide;
  last-Step removal contracts it back to Add step. Pixel comparisons allow only
  fractional device-pixel rounding at 150% scaling.
- Existing checks retain keyboard focus, parent completion timestamps/history/
  statistics, Save/Cancel, IME, nested deletion, exact multiline Markdown,
  description focus/clear/reopen, Project phases, Resource ownership, configured /
  unconfigured Planning, location relocation, rollback/retry, viewport resizing,
  fixed regions and metadata synchronization.
- **18 Node suites passed:** task-created-completion, task-layout-polish,
  task-compact-form, task-form, task-planning, task-progress, task-history,
  task-mutations, task-workspace, task-data, task-creation-retry, project-planning,
  inbox, data-store.integration, shared-projects.integration, completion-audio,
  typography and statistics.
- Browser regressions passed: task-form-workflows **65**, task-location-picker **103**,
  modal-regions **176**, task-form-polish **85**, form-consistency **76**, row-focus,
  and **2,099 Quick Add/Inbox checks**.
- Staged/installed syntax and plugin loading passed. Installed main/native/asset
  manifest hashes match staging; the native artifact is unchanged. Plugin whitespace
  checks passed. Functional assertions were preserved.

The final desktop and narrow screenshots were **visually inspected**, not only
measured. The guide follows the parent axis and ends at Add step; indented circles
and circle-plus have consistent proportions. Description belongs to Task, Location
has its own gap, and Planning preserves heading typography. The narrow footer stays
anchored while long content scrolls. No remaining obvious discrepancy was found.

Visual review exposed mock-page horizontal scrolling from the generic fixture's
body margin combined with native app CSS. The task fixture now uses a viewport-sized
host and hides its background status panel for screenshots. Both viewport runs were
repeated successfully after this fixture-only correction; production CSS was not
changed to mask the issue.

## Build, backup and screenshots

Pre-change source/styles/installed artifacts are preserved under
`System/Backups/task-step-hierarchy-20261013/source/`. The ignored directory also
contains staged artifacts, logs, hashes and review screenshots. The established
`build.js --output-dir` workflow staged first; normal `build.js` installed after
verification. Unrelated workspace changes were preserved. Tests used synthetic
in-memory vault data; no live tasks were edited and Obsidian was not restarted.

Installed `main.js` SHA-256:
`f8cd38a7575795a1f01f51fa02e0b628f22313fece6b9e401c1c076d870b887f`

Requested screenshot states:

1. [Empty Add task](../../../../../System/Backups/task-step-hierarchy-20261013/review/desktop-task-final-add.png)
2. [Edit with multiple Steps](../../../../../System/Backups/task-step-hierarchy-20261013/review/desktop-task-hierarchy-edit-steps.png)
3. [Edit with populated Description](../../../../../System/Backups/task-step-hierarchy-20261013/review/desktop-task-hierarchy-edit-description.png)
4. [Edit with no existing Steps](../../../../../System/Backups/task-step-hierarchy-20261013/review/desktop-task-hierarchy-edit-empty.png)
5. [Narrow Add at 150%](../../../../../System/Backups/task-step-hierarchy-20261013/review/small-150-task-final-add.png)
6. [Narrow populated Edit at 150%](../../../../../System/Backups/task-step-hierarchy-20261013/review/small-150-task-hierarchy-edit-description.png)

Reload Hub Project Menu in Obsidian for review. Screenshots use the native
Obsidian stylesheet with a simulated Modal; live theme/window review remains the
final check. No new functional issue was found. Previously documented broader
Files-divider and legacy date-fixture issues remain outside this pass.

Implementation and installation are complete. Stop here for review.
