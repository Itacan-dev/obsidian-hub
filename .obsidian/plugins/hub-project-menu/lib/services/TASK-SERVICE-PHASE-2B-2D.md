# Phase 2B-2D handoff — Home Tasks read integration

Proposed work only. Phase 2B-2C-2 stops after Roadmap/Phase-editor task reads.
Use the existing single `plugin.taskService`, legacy adapter and Markdown
authority. Do not activate native storage, migrate writers, change Resource
mount visibility or include History/Statistics/Oath read migration implicitly.

## Exact Home read and UI boundary

Paths beginning `System/` are relative to the vault; `lib/` and `plugin.js` are
relative to `.obsidian/plugins/hub-project-menu/`. Reinspect before implementing.

| Location | Current behavior to preserve |
| --- | --- |
| `System/Dashboards/Home/view.js:12` | `resourceTypes` comes from `hubGetResourceTypes()`. Currently `plugin.js:4412` returns all four registered Resource types; do not invent an opt-in Resource filter or assume a selected card/tab filters Tasks. Capture actual settings again if they change. |
| `Home/view.js:1952` | `projectFromReference` accepts page Project references, names and source/current dashboard paths. |
| `Home/view.js:1979` | `projectForPage` honors explicit page `project` before physical Project-root inference. This can differ from actual source ownership. |
| `Home/view.js:2001` | `resourceForPage` identifies physical Resource roots and creates a Resource presentation owner. **Resource wins before any Project property.** A mounted Resource folder stays Resource-owned. |
| `Home/view.js:2039` | Active Project requires status `active` and not deleted. Preserve Future/Shelved/deleted exclusions, current owner objects and existing status-change handling. |
| `Home/view.js:5441` | `loadTaskData` recursively enumerates all indexed Markdown pages through `hubTaskData.readPages(dv)` (with raw fallback), follows current paths for owners, assigns Resource-first owners, and builds `{task,owner}` arrays. |
| `Home/view.js:5499` | `renderTaskContext` filters active Projects, combines those tasks with eligible registered Resource tasks, computes active count with existing task groups, updates Home summary and renders only the task context. |
| `Home/view.js:840` | Existing task UI applies immediate writer edits to both wrapped arrays with a source-path resolver. Preserve wrapper ownership, title/Step state, focus and accepted cleanup commits. |
| `Home/view.js:850` | `renderTasksToDo` uses stable Project-then-Resource concatenation, shared date/importance grouping, future/completed disclosures, existing cards/Steps and source labels. |
| `Home/view.js:867` | Existing Oath partition maps pinned tasks back to presentation owners or actual `hubTaskOwner`. Preserve missing/completed commitments and fulfillment; do not replace Oath resolution. |
| `Home/view.js:5525` | Task-data subscription defers around active edits, then calls only `loadTaskData` and `renderTaskContext`. Non-task progress/activity subscriptions remain independent. |
| `Home/view.js:5481` | Initial `loadSecondaryData` additionally reads activity, progress reports and completed history. A task invalidation must not become a full secondary-data/progress rebuild. |

## Policy and evidence required

The current Home policy is broader than Schedule/workspace exclusions. Capture
actual System/Templates/hidden-note behavior, nested folders and note metadata
before composing a new efficient Home read policy. Strict `queryVisible(...,
{policy:"home"})` is currently unsupported, and strict per-task source queries
are unsuitable as the render loop.

Do not simply combine physical-owner workspace queries: Home presentation may
honor an explicit Project property outside that Project root, while Resource
ownership takes precedence. Audit this distinction and supply explicit portable
Home presentation-owner evidence alongside the **actual physical owner** used
for action validation. Do not return raw Dataview pages/links or reassign a
Resource task to a viewing Project. Avoid new mounted-folder expansion.

Reuse current owner objects where existing handlers update status/path in place.
Separate canonical title, full indexed continuation/Markdown text, description,
nullable start/due times, importance, Phase, Steps/ancestry and source evidence.
Preserve all existing IDs and temporary locators; no read can allocate an ID.

`TaskReadSession`, structured queries and the explicit legacy bridge are already
available. `task-panel-read.js` demonstrates immediate note reconciliation,
strong action references, accepted inline cleanup commits and source-owner
checks; do not import its panel visibility wholesale. `phase-task-read.js`
demonstrates separate draft intent and candidate availability, but Home is not
a Phase assignment editor and should not inherit its selection machinery.

## Actions and asynchronous hazards

Keep shared task cards/UI, Add/Edit, task/Step toggles, context menus, recurrence,
completion sounds, history and clear confirmation on their original writers.
Adapt `{task,owner}` explicitly rather than passing generic DTOs to legacy
functions. Fresh source/identity validation must preserve legitimate Resource
Oath references and actual owner context when a source moved. No synthetic
Tasks.md path, native revision or fallback persistence belongs here.

Use a Home-owned session of the shared facade. Protect remount/close, note/full
navigation, plugin unload, rapid invalidations, pending editors and Step text,
local completion versus an older query, delayed imports, source rename/delete,
owner status changes, Oath events and multiple windows. Do not clear visible
tasks on a query-wide failure; retain valid rows and restrained status. Preserve
scroll, menus, disclosures, keyboard focus and Home summary counts. Dispose only
the Home subscription, without closing other consumers or the shared facade.

## Required baseline and verification

Capture actual original Home task/Step identities, full text, labels, physical
and presentation owners, group membership/order/counts and DOM/layout for active/
Future/Shelved/deleted/private/both shared Projects and all Resources. Include
explicit Project frontmatter, Resource-first conflicts, mounted Resource folders,
root/source renames, copied IDs, ID-less tasks, missing sources, descriptions,
nested Steps, continuations, links, date-only/midnight/DST/future/completed tasks.

Use an independent actual Home Tasks renderer browser fixture. Compare legacy
writer Markdown/metadata/history/feedback for Add/Edit, task/Step completion,
menus, delete/clear, Oath and accepted writes during disposal. Test stale reads,
failed/recovered queries, immediate reconciliation, drafts/focus, summary-only
refresh and repeated mount/unmount. Retain the inherited broad workspace divider
assertion and do not count its later assertions after that failure.

Run all previous facade, Search, Daily Brief, Schedule, panel and Phase suites,
task/data/creation/history/form/planning/sharing/Oath/statistics regressions, both
declaration checks and inactive core tests. Benchmark 100/1,000/5,000 tasks,
cold/cache/invalidation, filtering/preparation, index/global identity passes and
source reads. Back up fresh source/bundle/data hashes, compare staged factories,
install only verified intended artifacts and never reload Obsidian automatically.

## Other remaining read consumers — separate future scopes

- **History:** Home `loadSecondaryData():5491` and task-history rendering around
  `:4700`; Project `renderProjectTaskHistory():4534` uses the existing global
  history API. Wizard `getCompletedTaskHistory():5670` in `plugin.js` still reads
  recorded history through the current domain query. The facade `queryHistory`
  exists, but event identity, retained deleted-source evidence, recorded owner/
  timestamp, reopen behavior and migration compatibility need their own audit.
  Never reconstruct chronology from current checkboxes or current owners.
- **Statistics:** `lib/services/statistics.js:8` snapshots note metadata, activity,
  Wizard completion history, reports and device Oath histories once per modal.
  `lib/ui/statistics.js:25` caches that source for range/workspace aggregates.
  This is broader than current task enumeration; preserve cohorts, deleted/
  inactive workspaces and historical owners in a separately authorized migration.
- **Oath:** `lib/services/oath.js:74` enumerates global tasks, `:92` discovers
  workspace candidates, and later hydration/setup paths resolve committed IDs
  and source content. Standard/Strict eligibility, persistent commitments,
  timers, fulfillment, interruptions, Resource mount permissions and missing
  tasks need their own transaction/lifecycle audit. Home partition display can
  continue consuming this unchanged service while its reader remains legacy.

**STOP — Phase 2B-2D is not implemented.**
