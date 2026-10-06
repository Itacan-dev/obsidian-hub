# Obsidian Hub modules

Quick Add and Inbox use `services/inbox.js` and `domain/inbox.js`, with native
modal surfaces in `ui/quick-add.js` and `ui/inbox.js`. `ui/capture-controls.js`
mounts them in the existing global footer; the Quick Add command uses Obsidian's
central hotkey registration for Ctrl/Cmd+Shift+Space. Opening either surface
does not write workspace layouts, Last File, Presets, or Oath state. Quick Add
is available during an Oath; Inbox review is disabled during an active Oath.

The existing atomic `HubDataStore` persists a backward-compatible optional
`inbox: {version: 1, captures: []}` field. Missing data means an empty Inbox,
with no migration write. The badge counts all unresolved Captures. Captures
store content, timestamps, source metadata, file references, optional structured
`intent`, and a compact destination-operation receipt for safe retries. Intent
reuses existing Task/Note/File fields (workspace/folder/location IDs, note title,
necessity, dates/times, Steps, phase and linked Project). Content and file references
remain canonical Capture fields. Older entries need no migration. Binary bytes live in managed
`Inbox/Attachments/<UUID>/` vault files, never in plugin JSON. Files already in
the vault are references. Deleting/canceling only cleans unused Inbox-owned
copies, never original external files or referenced vault files.

Destination operations persist their receipt before changing files, use native
vault/fileManager APIs and the Files panel's collision naming rules, and resolve
the Capture only after success. Exact content fingerprints guard retry/rollback
ownership. A failed final Inbox save leaves a recoverable receipt; retrying after
reload does not duplicate the destination. Markdown notes use normal vault
creation and generated attachment links, so existing indexing/explorers observe
the same events. Note intent additionally keeps `noteAction` (`new` or `existing`)
and an optional atomic `noteLocation` (Markdown path, target kind/anchor, position
and display label). Existing Captures default to New note without a migration.

New note keeps Folder/Title routing. Add text to existing note uses the shared
Capture form and location hierarchy in `ui/note-position-picker.js`. Folders
navigate; only Markdown notes can be committed with Use this position. Note end
is the default in one native-menu selector, followed by note start, heading and
list targeting. Place in note is always visible; before note selection it shows
a disabled Select a note first control. Heading/list modes share a compact
target/position row, with section end/list last as defaults. Cancel keeps
the previously committed Location. Switching actions retains both routing modes;
switching workspace clears Folder and existing-note Location.

`domain/note-insertion.js` scans ATX headings and contiguous top-level ordered /
unordered lists, excluding YAML, fenced/indented code and comments. Anchors
retain structural context and refuse ambiguous or missing targets. Section end
includes nested headings; note start follows frontmatter. List content becomes
one item with indented continuation lines, preserving bullet/delimiter and newline
conventions. The service re-reads and revalidates inside native `Vault.process`,
then follows ordinary workspace/activity/file refresh hooks. Its existing
operation receipt stores before/after fingerprints for safe retries; no rollback
ever overwrites or deletes an existing user note. A stale target becomes an
incomplete Capture. An ambiguous, subsequently edited output remains in Inbox
instead of risking another insertion.

Quick Add starts with mutually exclusive text / Add a file surfaces. The full-width
file action is a compact, neutral 44px button with centered paperclip and text,
independent of textarea resizing. Meaningful text hides file import; files hide the editor until removed.
The compact Clear control restores the empty state. More options and submission
require content. Text offers only Task and Note in More options; files enter
routing directly. Inbox shows Text with editable content and the
same shared Type control. Choosing Task or Note immediately persists intent and
opens its continuation. Partial Tasks, Notes and Files reopen their existing
form with saved choices. `services/inbox.completion`
validates the same minimum requirements as creation: Task text/workspace/location,
New note content/title/workspace/folder, existing-note content/workspace/complete
Location, or actual file/workspace/folder. Complete
Quick Add forms enable Add to Itacan and disable Send to Inbox.

Inbox filters show live All / Texts / Files counts; the footer retains only Close.
The list's thin segmented progress uses the existing accent and neutral track
colors, with one equal-width segment per `totalRequired` and `completedRequired`
filled segments. Identical gaps separate both purple and gray segments; there is
no continuous background behind the remaining segments.
`services/inbox.getInboxCompletion` reports completed/total
required details, ratio, readiness and missing fields from the same `completion`
result that enables Add to Itacan. Untyped text and files have zero requirements
and an empty bar until classification. Raw text/attachment existence earns no
organisational progress point, but payload validity still gates creation and
guides corrections. Type selects the schema without adding a detail: Tasks count
Workspace and Location; New notes count Action, Workspace, Folder and Title;
existing-note insertion counts Action, Workspace and Location; Files count
Workspace and Folder. Optional Task metadata never adds progress steps; invalid
payload or optional edits still block creation through the existing validator, so a full
required-details fraction can remain non-Ready until that edit is corrected.
Note insertion counts Location atomically and reuses the structural note cache.

Inbox defaults to Most complete. Most/Least complete compare normalized ratios;
ties and Type groups use oldest-first timestamps (then ID for deterministic ties).
Newest/Oldest remain purely chronological. Manual sorting is saved as the optional
`inboxSort` plugin-data preference through the existing atomic HubDataStore; opening
Inbox without a preference does not write one. List rows retain their DOM identity,
selection and visible scroll anchor as indicators update. Completeness-driven
movement waits for a focused text editor to blur; dropdown decisions reorder on
commit without replacing the right-hand form. Progress appears only in the list.

Inbox edits autosave through the existing atomic Capture update queue, including
incomplete or cleared content. Selecting another item, filtering, creation and
closing wait for pending edits; failed saves keep the visible edit for retry.
The scrolling right body keeps Delete / Add to Itacan in its separate footer,
without Cancel. Untyped items show only a bottom-right Delete action and omit
source/timestamp details from the decision pane; metadata remains persisted.
Untyped rows use Lucide file-question-mark with a muted neutral treatment.

`ui/capture-form.js` shares destination and creation controls between both
surfaces. Task/Note/File routing uses the same spacing tokens and neutral
keyboard focus scope; internal Task fields use spacing without dividers.
Type/Action/Necessity selections keep their accent states. Inbox Note keeps an
accessible, unlabelled content editor; File preview uses the normal title gap.
`ui/workspace-thumbnail.js` uses the Resource image or Project cover,
category image and existing placeholder as a clean square crop. Its destination pickers reuse the Oath/Home workspace cards and the
Files hierarchy conventions. Project placement is restricted to actual local
workspace folders and their descendants, including task locations; the synthetic
Project root and loose root notes are not capture destinations. Resource root
semantics remain unchanged. The service validates the same policy on creation
and retry. Each Inbox form fixes its current action type and keeps its action
footer outside the scrolling form body. Typed specifications omit classification
buttons. The native row context menu offers Open, Ready-only Send to Itacan,
Change type for eligible text, and destructive Delete. Change type opens a checked
Task/Note menu; Cancel/Continue confirms meaningful type-specific loss, retaining
canonical content and workspace. Files, legacy
remainders and journaled operations keep their existing classification policy.

`hub-option-group` shares filled-accent option selection between Quick Add,
Inbox filters/Type and Oath radios. `hub-equal-selectors` sizes compact groups
from their widest label; full-row groups retain equal flexible columns. Selected
Inbox rows retain muted accent fills; task objects retain accent borders. Inbox uses 30px Lucide type icons in
the existing row geometry and shows only date/time in normal list metadata.
Incomplete labels show detail(s) left; Ready uses Lucide check plus Ready with the same
accent progress track. All detail types share a fixed 47/53 desktop grid and
fixed modal height, independent scrolling bodies and pinned action footers.
Narrow stacking is also independent of item type. The native sort trigger reserves
all labels intrinsically, with the active rule icon and a right/down disclosure chevron.
Most/Least complete use list-sort-descending/list-sort-ascending; Newest/Oldest
use clock-arrow-down/clock-arrow-up; Item type uses files. `ui/icons.js` registers
the exact upstream list-sort SVGs when the installed native registry lacks them.
Oath options keep native radios visually clipped, centered text and equal widths.
Selected workspaces center their shared 38px square thumbnail and name without a
category prefix. Scheduled start restores the combined month-calendar/hour-minute
popover behind the styled option, using the same right/down disclosure helper and
valid-selection state. Dismissal without a valid date returns to neutral; typing
remains available as a fallback. Ordinary selects keep their dropdown chevrons.
Oath setup has only header/footer separators. Its task rows and Add Tasks rows
share compact 6px gaps and rounded geometry; selected Oath tasks have a neutral,
centered remove icon that changes the commitment selection only. The full-width
plus and single uncommitted suggestion retain their existing workflow.
Selected task options reuse the same option-group fill and hover as Now; generic
task hover only accents titles on unselected rows. The compact Inbox badge uses
flex centering and symmetric padding, overriding the navigation label's clipping
allowance so its number stays centered.

`ui/inbox-guidance.js` shares Capture guidance between Inbox and Quick Add, reading
the service's `completion().missing` and `ready` without redefining requirements
or progress. UI fields expose presentation-only `data-capture-field` anchors.
Inbox opening/failed submissions and Quick Add failed direct Add reveal the
highest visible missing requirement. Quick Add Send to Inbox and existing Enter
routing continue to accept incomplete captures without guidance. All three forms,
including Oath's ordered setup groups, use `ui/attention.js` and `hub-attention`
in `styles.css`: one inherited `--hub-attention-strength` animates the group fill
and actual control backgrounds together. Control surfaces blend their captured
theme/selection colors toward clean warm yellow (`#ffd54f`) at 22%; the group uses
24% with a uniform 5px paint expansion, without an outline, border, blur or scroll
overflow. Capture bodies reserve that paint space even in Quick Add. Text,
icons and semantic states stay intact. Two 1.25-second pulses fade in for 450ms, fade out
for 550ms and pause for 250ms, then clear the styling and accessible description.
Oath omits duplicate empty-choice errors but retains invalid-value/availability
messages. Edits never replay missing-field cues or automatic scroll. Ready cues
the white arrow once on opening or first completion, moving 7px right and back
twice in 2.4 seconds (400ms right, 500ms return, 300ms pause per cycle). The arrow
stays white and stationary afterward. It also remains visible on incomplete
Inbox actions, whose muted styling and clickable validation guidance are retained.
Ready uses the normal purple primary styling without a bright border or halo.
Reduced motion uses a short static cue with the same cleanup. Optional
invalid values can still block Ready without being highlighted as required.
Delete clicks and physical Delete use the same small native confirmation;
text-entry controls, menus, composition and modified/repeated keys are ignored.

`ui/task-form.js` and `domain/task-form.js` share canonical task fields and validation
with normal Add/Edit Task. `ui/date-time.js` keeps the Oath native interaction and
provides one Task picker containing native Date and optional Time inputs. Native
datetime-local cannot represent date-only values, so Task fields never seed a
time: only an explicitly chosen time is stored, including midnight. Clear time
inside the picker returns to date-only; clearing the date clears both values.
There is no external time toggle. Start/Due labels use the shared semibold field
style. Picker close/disposal returns focus to its neutral trigger.
Task capture text has one editable source. Tasks use the ordinary
`HubTaskEditor.create` path, including optional dates/times, necessity, Steps,
phase assignment and Resource Project association.
Stable IDs allow retrying the same creation without duplicate task/history
events. Optional `captureSource` metadata retains source information through
normal task edits/moves. New Captures cannot mix text and files. Legacy Captures
with arbitrary attachments or multiline content remain supported; those Captures remain in Inbox after task creation until the
remaining data is made into a note or moved. Milestones currently have no task
link API, so the feature exposes existing phase linking only. File routing with
captured text/source creates a normal companion Markdown note to preserve it.

Daily Brief remains available for development when Obsidian is launched with
`ITACAN_DEVELOPMENT=1`. Production footer controls are The Oath, Quick Add,
Inbox, Music, Settings; developer-only Daily Brief is not started automatically
or registered as a shipped command.

Run `node lib/tests/note-insertion.test.js`, `node lib/tests/inbox.test.js`, `node lib/tests/task-creation-retry.test.js`
and `node lib/tests/task-form.test.js`, `node lib/tests/run-browser-test.js inbox`,
and `node lib/tests/run-browser-test.js task-workspace`, then `node build.js` from the
plugin directory. Browser fixtures use isolated in-memory vaults. The Inbox
fixture covers native-modal behavior, context restoration, IME, clipboard/drop,
exclusive input paths, partial intent/reload, multiple files, direct creation,
legacy retention, retry, original file safety,
removed destinations, workspace thumbnails, neutral text focus, independent
scrolling, and desktop/narrow layouts. Normal text-entry focus preserves neutral
borders throughout Itacan; selectable options and keyboard button focus retain
their established styling.

The Hub source is split into small CommonJS modules. Obsidian loads the
self-contained `main.js` artifact generated from `plugin.js` and `lib/` by
`build.js`.

- `config.js` owns stable registries and paths.
- `domain/` contains pure rules for activity, auditing, contexts, dates, files,
  focus, naming, progress, and tasks.
- `services/` contains schema-versioned atomic persistence and transition
  behavior behind narrow interfaces.
- `ui/` contains shared dashboard primitives used by Home and Project/Resource.

Keep vault and Obsidian API calls at the service boundary. Domain modules should
remain deterministic and independently testable. Add new behavior to the
smallest relevant module instead of expanding `main.js` or copying helpers into
dashboard views.

After changing `plugin.js` or a file under `lib/`, run `build.js` with Node and
reload the plugin in Obsidian. The builder has no package dependencies and only
bundles local modules reachable from `plugin.js`; built-in and `obsidian`
imports remain external.

`atlas/obsidian/` adapts the unchanged `AtlasCore/packages/core` engine. Its main
entry `native.js` owns one controller and exclusive repository per vault; it is
bundled as `atlas-native.cjs` for `electron.remote.require`. `webviewer.js` holds
native Document requests, `runtime.js` supplies trusted Core operations and
executes saved decisions, and `integration.js`/`ui.js` hold only descriptions,
drafts and native view associations. Core's CommonJS/declaration copy is generated
by `build-atlas.js`; source/artifact hashes prevent stale copies. Adapter/native
tests live under `atlas/tests`. See `System/Hub-atlas-architecture.md` and
`System/Hub-atlas-security.md` for the ownership and threat maps.

`tests/domain.test.js` covers pure rules, audit repairs, and persistence
ordering. `tests/data-store.integration.test.js` exercises atomic replacement,
external-write detection, and conflict-file discovery on the filesystem.
`tests/plugin-load.test.js` verifies the plugin entry point and both dashboard
scripts can still be loaded after a module change.

Navigation history is owned by services/navigation-history.js and its pure
domain/navigation-history.js helpers. Version 4 workspace state stores
workspaceHistory (canonical workspace IDs) and fileHistory (file path plus
canonical workspace ID) in the existing plugin data.json. Each MRU is bounded
to 500 entries. An entry without a file path represents the existing browser
Note-view association; restoration still uses the workspace's native layout.
Array presence marks the one-time migration from legacy last-file/workspace and
per-workspace note snapshots, including when the arrays become empty.

History resolution keeps dashboard context, filters Project state and delegates
Oath eligibility to oath.canOpen(reference, false). Only missing objects are
pruned; temporary access changes retain recency. Rename/delete hooks update all
contexts of a file. Run node lib/tests/navigation-history.test.js from the
plugin directory for the focused MRU regressions, alongside workspace-state,
Presets and Oath suites.

Daily reports use domain/report-context.js to select existing completion History,
Activity and daily focus by recorded workspace ID and local date. Each newly
saved workspace work-log entry adds a version-1 context snapshot with task
titles/completion timestamps, compact activity fields and that workspace's
focus. Past report edits retain this context; saving today's report refreshes it.
Workspace names come from the stored log. No source file is read to reconstruct
a historical task. Legacy entries fall back to available persisted History and
focus without a migration or writes on read.

The shared next-focus editor and pending-focus activation keep their existing
semantics. reportFocusByDate stores one copy of its items per report date so
activation/replacement cannot erase them. The daily renderer assigns items by
workspace ID and shows targets without a displayed report separately.

ui/daily-report.js owns reusable evidence and daily-report renderers plus a thin
native modal wrapper, using Hub Markdown and its lifecycle for historical text.
Report-bearing heatmap days open this view; its Edit progress action opens the
existing editor. Empty days keep their existing editor behavior. Run
lib/tests/daily-report.test.js and the daily-report browser fixture for snapshot,
legacy, scope, input and interaction coverage.

Statistics is opened only by the small Lucide `chart-no-axes-column` action in
Home's Progress header (verified in installed Obsidian 1.13.7's icon registry).
`ui/statistics.js` uses the native Modal and shared report-card/Hub controls;
`ui/statistics-charts.js` draws bounded SVG bins with hover/focus value tooltips and a screen-reader-only
data table. The compact modal is capped at 980px / 85vh; short lists size naturally,
and long lists scroll. Methodology help uses the verified Lucide circle-help icon
for Oaths, Notes and the global comparison. Unassigned bars are muted without changing totals. Resize observers are disposed on rerender and close.

`services/statistics.js` reads one metadata/history snapshot per opening.
`domain/statistics.js` owns identities, local-calendar ranges and aggregation:
- Distribution and the donut sum raw Progress Report evaluations (0?4) by stable
  workspace ID and local report date. No Home Momentum normalization or Oath
  weighting applies. Reports are read through the canonical historical API.
- Project time and the Oath section use elapsed time from ended, actually
  started Oaths across devices, deduplicated by session ID. Broken sessions retain
  elapsed time. No time is inferred from edits. Active/scheduled sessions are not
  historical completed sessions. Durations are split at local range/bin boundaries.
- Oaths taken/fulfilled are the ended-session cohort whose start falls in the
  selected period; fulfillment follows the persisted fulfilled/broken state.
- Activity counts recorded Markdown creations/edits and task/Step completions;
  navigation, renames, project lifecycle events and attachments are excluded.
- Task/Step charts query the existing completion History, never current checkboxes
  or report snapshots. Unchecking removes the recorded completion; clearing does
  not add one.
- Notes are surviving workspace Markdown files, excluding dashboards, Meta,
  hidden paths and implementation metadata. The chart retains file ctime bins.
  Total notes is the distinct union created or recorded as edited in the selected
  period; Notes edited counts distinct surviving notes with recorded edits and
  matching canonical owners. Deleted notes are not reconstructed.
- Project activity includes Active, Future, Shelved and historically deleted
  projects, with state labels. Last active is all-time; time uses the range.
  Stable IDs resolve current names; unidentified legacy records stay Unassigned.

Ranges share local-calendar bins, capped at 105 bins (80 for long histories).
Three months is the default. Range results are cached within the modal; changing
the global workspace filter does not reread the vault. The filter scopes
Distribution, Activity, grouped Tasks/Steps, Oaths and Notes; Project activity
and the Progress Report comparison remain global. Projects and Resources use
consistent muted violet/teal colors. Tasks and Steps use adjacent, never stacked,
bars; mixed Activity uses category stacks. Both reuse the existing chart
keyboard details, hover tooltips, screen-reader tables and resize cleanup.
The shared equal selectors size range buttons from the widest label; one native
workspace select replaces all card selectors. Cached selections are bounded. All-time begins at the earliest available
work, Progress Report, ended Oath or surviving note creation record.

Run `node lib/tests/statistics.test.js` and
`node lib/tests/run-browser-test.js statistics` from the plugin folder, then
`node build.js`. The aggregation tests cover real check/uncheck/delete semantics,
cross-midnight and DST sessions, duplicate sessions, renamed/deleted workspaces,
all ranges, empty datasets and 100,000 records. The browser fixture covers the
real Progress action, all seven sections, global workspace/range persistence, grouped chart geometry,
category colors, period notes, global comparison, chart keyboard
details, native close/Escape, long names/lists and 310–1000px modal widths.

Workspace Tasks uses `ui/task-workspace.js` with separate Upcoming, Calendar,
Timeline, All tasks and Resource hierarchy renderers. View state lives with the
Dataview container and survives warm frame rebuilds. The Files tree and sidebar
stay mounted; task navigation is hidden in the existing note rail. Searches,
filters, calendar ranges and sort order never write task metadata.

`domain/task-views.js` defines deterministic Project/Resource views and shared
date buckets. `task-data.readWorkspace` adds Resource tasks whose optional
`linkedProjectId` matches the Project without copying tasks or changing panel
queries. This optional metadata field preserves legacy task records. Project
selection permits active Projects; existing shelved links remain readable.

The shared Add/Edit form scopes Location to real workspace notes/folders.
Folder destinations create Tasks.md only when saving. Moves preserve the whole
Markdown task block and stable parent/Step IDs, rebind live completion checks,
and leave historical snapshots/timestamps untouched. Writes roll back only
while their exact content is still current. Search/filter rendering uses one
indexed task snapshot per refresh, not repeated Markdown parsing.

`ui/app-shortcuts.js` mounts existing launchers in the bottom shell and retains
Home/category shortcut selection and ordering. The group contracts within the
free span between the global controls and native status items.

Run `node lib/tests/task-workspace.test.js` for query/date/link/move/rollback
coverage and `node lib/tests/run-browser-test.js task-workspace` for the full
Project/Resource navigation, shared editor and checkbox flows, shortcut behavior,
and 1040/760/420px layouts. The browser fixture uses isolated in-memory notes;
it does not modify the live vault.

Workspace Files uses `ui/workspace-explorer.js` in both Full-view and the native
Note-view rail. `domain/workspace-explorer.js` projects existing vault objects
and root descriptors into one tree; shared roots retain their original Resource
paths. Search includes descendants and their ancestors without changing saved
disclosures. Only expanded branches mount rows, with group-scoped guide lines.
The Full-view contents pane uses the same nodes and existing file sort semantics;
folder timestamps remain unavailable rather than being inferred from children.

Explorer presentation lives in `System/Dashboards/Project/view.css`. The existing
rail still controls full/half/closed widths; both visible states retain search.
The dashboard retains native opening/split, multi-selection, menus, workspace
folder ordering, creation, import, moves, trash, and shared-resource detachment.

Note-view geometry is owned by the shared rail rules in `styles.css`. The full
width retains its responsive clamp, reduced by one `size-4-3` spacing unit; half
remains half of that width and closed remains a 32px handle. `mountNoteRail`
commits the initial canonical size without animating from native split sizes.
Native Markdown and prepared ItemViews share a zero-padding content wrapper;
otherwise Obsidian adds padding only to restored rails. The preview supplies one
`size-4-3` outer inset on each side and at the bottom. The existing flexible 7:3
grid divides the remaining height after navigation and the panel gap, with tree
and task lists scrolling independently. Guides use one uniform, neutral border.

Run `node lib/tests/run-browser-test.js note-rail-geometry` for native/prepared
entry-route parity, startup restoration, stale native dimensions, all rail states,
live resizing, equal bottom/side insets and panel geometry at multiple window sizes.

The existing per-workspace `folderUi` path map stores disclosures in `collapsed`,
sort settings per selected folder, and workspace search/selection in the workspace
root's existing `search`/`currentPath` fields. Preset capture/restore and path
rewriting use those same fields. Legacy panel entries remain readable, with no
schema change or migration. Selection is separate from expansion and the active
file; changing rail width does not rebuild either tree or state. `currentPath`
remembers the Full-view folder; Note-view highlights only its active file and
never overwrites that folder. Without a remembered folder, its contextual fallback
is the active file's parent. Remounts read scoped Last File history without opening
files or changing restored expansion. Both folder rows and disclosures toggle once.
`ui/icons.js` resolves canonical Lucide names before Obsidian's legacy aliases
(e.g. unprefixed `folder` otherwise resolves to `folder-open`); selected icons
retain their neutral color while the row carries the purple-tinted background,
without a left selection marker. Branch containers are transparent; only the
uniform guide border is painted. The shared search input stays transparent even
under native input-hover rules; its neutral border remains unchanged on focus.

Run `node lib/tests/workspace-explorer.test.js` and
`node lib/tests/run-browser-test.js workspace-explorer`, then `node build.js`.
The browser fixture executes the actual dashboard folder integration against an
isolated vault. It covers local/shared/empty workspaces, canonical shared edits,
detachment, recursive filtering, keyboard and middle-click opening, sorting,
creation/rename/move/import/trash, presets, hierarchy guides, long/deep names,
and explorer/Tasks alignment across the three existing rail states. Native
Obsidian adoption and vault timing should still be checked after a reload.

Roadmap bounds use all valid phase endpoints and milestone dates. The warm
workspace view state retains zoom and a separate viewport start; new views fit
the entire project with modest calendar-day padding. Fixed month spans, panning
and Today use domain/project-planning.js; they never rewrite planning dates.
Presets and Roadmap pointer dragging share ui/pointer-list-reorder.js (floating
row, placeholder, stable slots, cancellation and auto-scroll). Roadmap adds reduced-
motion-aware row settling, while keyboard pickup/move/drop uses ui/list-reorder.js
and save a validated stable-ID order through the existing revision transaction.
Run the project-planning test and roadmap-refinement browser fixture for bounds,
zoom, collision lanes, reorder persistence and retained Full-view geometry.

Project Full-view planning controls use the measured Work Files header band;
Schedule keeps its internal upcoming key while displaying Overview / Week / Month.
Schedule reuses the Tasks panel title and Home History subsection typography.
Its view choices and Task action share one intrinsic width, with the existing
larger separation after Overview and before Task. Roadmap uses that separation
between its independent range selector and equal-width creation actions.
Roadmap reuses the Schedule/Tasks panel title with Lucide route. Time navigation
is centered in the two-row axis corner; the month axis replaces the range label.
Milestone annotations are transparent, title-only two-line cards reserving two
line heights. Native hover tooltips retain exact dates; an opt-in keyboard
variant in ui/tooltips.js uses the same native surface, delay and placement.
Diamonds and leaders share one SVG
viewBox in layout pixels; domain/roadmap-milestones.js defines exact outer and
inner vertices matching the original rotated-square dimensions. A path starts
literally at its diamond's bottom vertex. HTML card endpoints are converted
through the inverse SVG screen CTM, never by subtracting viewport rectangles.
Track/card ResizeObservers and font-load events refresh label geometry; shared
SVG content moves together under scrolling, zoom and ancestor transforms.
Roadmap and Presets share ui/disclosure.js and native menu lifecycle conventions.
Creation buttons and empty-grid menus call the same planning editor; contextual
start/date defaults never change edit detection or phase-task assignments.
domain/roadmap-milestones.js clamps label cards to the visible date track, packs
three bounded lanes, and routes subtle orthogonal leaders around other cards.
At physical capacity, a native overflow menu retains access to excess items.
Run roadmap-milestones.test.js and the project-full-polish browser fixture for
edge/middle/scroll collisions, card-avoiding routes, menu defaults, all zooms,
control widths, heading icons and cross-mode separator/utility alignment.
The roadmap-anchors browser fixture reproduces the screenshot cluster and
checks actual SVG-to-screen tip/card joins through all zooms, pan/Today, scroll,
resize, font reflow, dense edge layouts and milestone mutations. Its scaled
case failed with a 5.26px offset before the shared SVG implementation.
