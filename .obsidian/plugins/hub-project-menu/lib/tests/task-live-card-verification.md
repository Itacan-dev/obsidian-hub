# Add/Edit live Task card and progressive configuration — 2026-10-13

This phase supersedes the ordinary Add/Edit presentation in
[the title and wrapping report](task-title-wrapping-verification.md). Add/Edit now
uses the actual Tasks panel presentation, followed by progressive configuration
actions. This report covers the attached request and the clarification requiring
one shared rendering implementation.

## Shared rendering and draft ownership

The existing panel renderer could be reused by separating presentation from its
persisted interaction handlers. `ui/task-card.js` now owns the actual row factory,
necessity/date/source/phase presentation and checklist markup. These were extracted
from `ui/tasks.js` and `ui/task-steps.js`; the existing Home row now calls the same
factory with its established Home class convention. Project panels and Add/Edit
also call this implementation. Existing panel CSS, domain date formatting,
overdue/future rules, location labels, phase labels and Markdown rendering are
shared. There is no separately recreated composer card or second card stylesheet.

`createTaskUi` and the panel Step adapter retain their normal completion, menu,
edit, navigation, disclosure and persistence handlers. The shared presentation
supports those handlers without moving their writes into the renderer. Rendering
cleanup releases description popovers and Markdown components on rerender/unload.

The composer attaches its editing adapter to those same elements. One pending
state, cloned from the existing snapshot, drives the title, completion checkbox,
metadata and Steps. Only Add/Save invokes the existing creation/update service.
Cancel discards that state. Necessary editing differences are the native wrapping
title editor, active Step editor, Step removal actions and internal Step action.
When inactive, title and Step text use the same native Markdown lifecycle as the
panel. Native checkbox theme sizing is inherited from the dashboard scope so the
Modal's smaller UI token does not alter the shared card geometry.

## Composer behavior

- The existing icon/title/X header remains; the subtitle is removed and the title
  is vertically centered with the icon. Width remains 560 CSS pixels, bounded by
  the viewport. Height follows content, with a fixed header/footer and scrolling
  body. Empty Add measures 560 × 408 on desktop and 328 × 406 in the narrow run.
- The live card precedes this exact action order: **Step**, **Add/Change start
  date**, **Add/Change due date**, **Select necessity level**, **Add/Edit
  description**, and **Assign to Phase** when the destination has phases. Native
  circle-plus, calendar, calendar-clock, circle-gauge, text-align-start and layers
  icons are used. The former Task/Location/Planning headings and full location
  trigger are removed. No guide is drawn through the external action column.
- Global Home creation defaults to the configured Explorations Resource. Its
  existing stable Resource ID remains `references`; no identity migration occurs.
  Explicit destinations and valid Project/Resource/note contexts are retained.
  Edit retains its source. Invalid explicit destinations are not silently changed.
  Missing Explorations produces an actionable Save error. Folder destinations
  display their eventual conventional Tasks.md source without creating a file
  until Save. The separate Choose task location window is deferred as requested.
- Title soft wrapping retains a single stored Markdown line and the existing
  native editing, IME and Enter-to-submit behavior. Preview clicks activate editing
  without navigating to embedded links. Normal panel navigation remains intact.
- Both Step entry points reuse the existing Step draft editor. Pending rows count
  toward the visible checklist immediately. Enter and valid blur commit once;
  empty abandonment and Escape remove the pending row. Existing edit, completion,
  deletion, nested identities and timestamp behavior remain. Append-only commits
  preserve a Step target clicked during blur. Save includes valid pending text;
  Cancel discards it. Input and preview controls remain locked during Save/retry.
- Start and Due each open a titleless anchored popover with native date and optional
  time fields, inline clearing, Cancel and Apply. Each has an isolated draft. Apply
  validates the whole resulting range before updating the parent draft; dismissal
  discards unapplied values. Clearing date clears its time; clearing time retains
  date. Time requires its own date. Midnight, cross-year ranges and same-day time
  ordering retain existing semantics. The card uses the panel's display policy,
  including its due-only display after a start date has passed.
- Necessity and Phase reuse their existing selection controllers, with titleless
  close controls and left-aligned options. Necessity reserves an invisible marker
  slot for Clear selection. Selected purple rows retain full width. Selection
  changes only the pending parent state. Long Phase menus scroll within available
  viewport space; Escape and keyboard focus restoration remain available.
- Description opens a titleless compact textarea with Clear/Done. Exact multiline
  Markdown and whitespace update the parent draft continuously. Done, X, outside
  click and Escape retain that pending text; parent Cancel discards it. The action
  changes to Edit description after leaving meaningful content. Description stays
  in existing task-ID-backed metadata, outside Markdown task bodies.
- Meaningful descriptions produce one stable, shared information indicator in
  both ordinary panels and the composer. Hover, focus or click opens a read-only
  preview; whitespace-only descriptions do not show it. Preview content uses safe
  text rendering with preserved line breaks. The installed Obsidian 1.14.4 icon
  registry has no `square-info`, so both contexts use its native Lucide `info` icon.
- Local purple feedback reuses the established transient attention timing
  (1,250 ms, twice). It targets the changed card element and does not restart on
  each description keystroke. Reduced motion applies updates immediately without
  these effects or a reserved delay.

Task storage schemas, task/Step IDs, Markdown synchronization, capture receipts,
metadata, progress, History, statistics and mutation/retry services are preserved.
Quick Add, Inbox, Today's Focus and other interfaces were not redesigned.

## Verification

- **1,839 checks passed at 1480 × 1058** in the new isolated browser fixture.
- **1,835 checks passed at 360 × 640 and 150% scaling**. Real viewport resize,
  long titles, bounded modals/popovers, scrolling and focus remain covered.
- Shared-renderer parity checks compare pre-change and current panels at matching
  480px and 240px widths, then compare current panel and composer cards. Checks
  cover necessity markers, dates/ranges/overdue states, phase/location text,
  title wrapping, Markdown states, expanded Steps, computed typography, spacing
  and geometry. The baseline JSON pins actual pre-change renderer source solely
  for the test fixture; production contains one current implementation.
- Composer checks cover all six actions alone and together, configuration/clearing,
  native date validation and dismissal, description preview stability and Escape
  routing, zero/one/multiple/nested Steps, Enter/blur/Escape, invalid text, IME,
  rapid pointer/keyboard interactions, completion timestamps, draft isolation,
  Save/Cancel/failure/retry, locks, CRLF/IDs/metadata/History/statistics, source
  context, phase availability, long menus, reduced motion and delayed Markdown
  render replacement. Snapshot and pending-draft behavior use real services with
  an isolated in-memory vault.
- **21 Node suites passed:** task-composer-routing, task-association-removal,
  task-created-completion, task-layout-polish, task-compact-form, task-form,
  task-planning, task-progress, task-history, task-mutations, task-workspace,
  task-data, task-creation-retry, project-planning, inbox, data-store.integration,
  shared-projects.integration, completion-audio, typography, statistics and icons.
- Panel browser regressions passed: task-step-progress; **48 Home and 36
  workspace/Note layouts**; modal-regions **176**; task-form-workflows **64**;
  row-focus. Home, modal and workflow checks also passed after installation.
- **2,099 Quick Add/Inbox browser checks passed**.
- Staged and installed syntax, plugin loading and scoped whitespace checks passed.
  Installed main/native/asset-manifest hashes match staging. Atlas's native artifact
  is byte-for-byte unchanged from the pre-change backup.

The workflow fixture now exercises the card configuration actions and retained
Edit source. Existing relocation, metadata, History and capture-source assertions
still run through the service; the obsolete available-location UI assertion is
removed because this phase explicitly defers that chooser. Region mocks gained
the existing vault folder API, and fixed source-list loaders include the shared
renderer dependency. The runner supports validated dynamic reduced-motion changes.

Previous Location/Planning-specific browser layout fixtures are superseded by the
new active composer fixture; they are not reported as passing this new UI. The
broader task-workspace browser fixture still fails its previously recorded
**Mode separator aligns with Files divider** assertion. This unrelated workspace
layout issue was not changed; its domain suite passes.

## Rendered screenshots and visual inspection

Screenshots use isolated Chromium fixtures, synthetic tasks and the installed
Obsidian 1.14.4 stylesheet and fonts. Modal hosting and native Markdown host APIs
are simulated; both compared contexts invoke the same rendering adapter. Screenshots
were personally inspected, including desktop and narrow matching-width parity,
metadata, expanded Steps, title wrapping, action density and all popovers. Review
caught inconsistent Date/Time field sizing, corrected by the shared field wrapper,
and long-menu overflow, corrected with available-space scrolling. Final screenshots
were inspected again after those fixes.

- [Empty Add](../../../../../System/Backups/task-live-card-20261013/review/desktop-empty-add.png)
- [Add with expanded Steps](../../../../../System/Backups/task-live-card-20261013/review/desktop-add-step.png)
- [Necessity configured](../../../../../System/Backups/task-live-card-20261013/review/desktop-necessity-card.png)
- [Start/Due range](../../../../../System/Backups/task-live-card-20261013/review/desktop-range.png)
- [Description editor](../../../../../System/Backups/task-live-card-20261013/review/desktop-description-popover.png)
- [Description indicator and preview](../../../../../System/Backups/task-live-card-20261013/review/desktop-description-preview.png)
- [Project Phase](../../../../../System/Backups/task-live-card-20261013/review/desktop-phase-card.png)
- [Fully configured Edit](../../../../../System/Backups/task-live-card-20261013/review/desktop-full-edit.png)
- [Native Date/Time popover](../../../../../System/Backups/task-live-card-20261013/review/desktop-start-popover.png)
- [Necessity popover](../../../../../System/Backups/task-live-card-20261013/review/desktop-necessity-popover.png)
- [Phase popover](../../../../../System/Backups/task-live-card-20261013/review/desktop-phase-popover.png)
- [Long scrolling Phase menu](../../../../../System/Backups/task-live-card-20261013/review/desktop-long-phase-menu.png)
- [Panel/composer Resource parity](../../../../../System/Backups/task-live-card-20261013/review/desktop-parity-configured-resource-card.png)
- [Panel/composer Project parity](../../../../../System/Backups/task-live-card-20261013/review/desktop-parity-project-fully-configured-edit.png)
- [Panel/composer rich title parity](../../../../../System/Backups/task-live-card-20261013/review/desktop-parity-rich-markdown-title.png)
- [Narrow Add at 150%](../../../../../System/Backups/task-live-card-20261013/review/small-150-empty-add.png)
- [Narrow Edit with expanded Steps at 150%](../../../../../System/Backups/task-live-card-20261013/review/small-150-full-edit.png)
- [Narrow configured Project parity at 150%](../../../../../System/Backups/task-live-card-20261013/review/small-150-parity-project-fully-configured-edit.png)

## Build, installation and review limits

Pre-change plugin source, styles, installed artifacts and Home renderer are backed
up under `System/Backups/task-live-card-20261013/source/`. The same ignored directory
contains staged artifacts, the staged Home renderer, native screenshot assets,
review images, test/build/load logs and a source-delta listing. The existing
`build.js --output-dir` staged first. Normal `build.js` and the verified shared Home
renderer were installed after tests passed. Unrelated workspace changes were
preserved, including preexisting plugin changes. No live task was edited and
Obsidian was not automatically restarted.

Installed `main.js` SHA-256:
`5ac0acd6272fb4cdaf1c25dcde3f8a636b09e73b5c08aae4ac54557f99b91483`

The location chooser remains deliberately deferred. Native date fields retain
Chromium's locale presentation. Native `info` substitutes for unavailable
`square-info`. Existing panel location/phase truncation at narrow widths is
preserved in both contexts. Live Obsidian theme/window review remains the final
visual check beyond the simulated host. No new functional limitation was found by
the focused suites; the broader Files-divider issue remains outside this phase.

Reload Hub Project Menu for visual review. Implementation and installation are
complete; stop here as requested.
