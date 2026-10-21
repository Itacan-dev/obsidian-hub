# Recorded History field and lifecycle audit — before consumer changes

Phase 2B-2E-1 baseline, 2026-10-16. `lib/` and `plugin.js` paths are plugin-relative.
Source snapshots are captured from actual dashboards before production edits.

Wizard startup (`plugin.js:3856`) accepts object records with string `text` and
`path`; it does not require event/task IDs, dates or workspace fields. The actual
`getCompletedTaskHistory():5670` delegates to `domain/history.queryHistory`, which
filters null rows, optional historical kind and exact recorded `projectId`, and
returns shallow copies in stored order. It does not deduplicate or reattribute.

| Historical field | Stored source | Current use | Existing facade support | Required change |
| --- | --- | --- | --- | --- |
| Event identity `id` | Completion mutation UUID, retained clear record or legacy absent/null | Event/check binding, writer dedup; both renderers preserve all returned rows | `recordId`, absent collapsed to null | Preserve verbatim optional recorded field; no new IDs or read dedup |
| Task / Step `kind` | `taskProgressMutation`; legacy absent means task | Exact `kind === "step"` selects Step icon/label | Canonical task/Step kind | Retain raw optional kind alongside canonical kind |
| `hubTaskId` | Existing task ID or completed Step ID | Recorded target identity; independent of event ID | Canonical task/Step IDs | Preserve optional recorded evidence without current resolution |
| `parentTaskId`, `parentText` | Step progress transition | Step title is `parentText · text`; no recorded full ancestry | Parent task identity/title | Retain absence/null and raw fields; never infer nested ancestry |
| `text` | Immutable display snapshot | Markdown title/continuation of recorded event | Title | Preserve exact string |
| `timestamp` | Recorded action/Step timestamp; legacy optional/string/null | Numeric descending stable sort, Moment date/time; missing legacy date inherits old Moment behavior | Only finite number retained | Keep canonical nullable timestamp and exact optional recorded scalar separately |
| `archivedAt` | Existing clear-completed archive creation | Historical provenance, not event time | Dropped | Retain optional evidence; never replace completion time |
| `projectId` | Writer's recorded context or clear request presentation context | Project exact-ID match; Resource prefix inference; optional/null fallback | Canonical `ownerAtEvent` | Retain exact recorded value; never derive from live source |
| `contextKind`, `targetKind` | Recorded source / legacy fields | `historyKind` prefers target/context kind, then Resource evidence/path | Only derived owner | Preserve both optional recorded fields and existing precedence |
| `resourceType` | Resource completion or clear request | Resource workspace exact-type match; Home current Resource-name lookup | Often inferred into owner | Preserve exact optional field; do not normalize historical conventions |
| `projectName` | Recorded physical context or Home clear presentation request | Home fallback name when no live matching registry entry | Dropped | Retain; Home's existing live registry name lookup still wins |
| `projectStatus` | Context snapshot / clear request | Historical evidence; not a current-status eligibility filter | Dropped | Retain; do not filter old events by current status |
| `projectPath`, `projectRoot` | Context snapshot / clear request | Project/Resource fallback filtering; source labels; Markdown source base | Dropped | Preserve exact recorded fields |
| `path`, `line` | Event source locator at recording time | Open recorded existing note; no exact-task jump; missing sources remain visible | Path discarded when line absent | Retain path independently of line; validate only at navigation boundary |
| Completion source / recurrence | Writer controls transitions; no universal source enum recorded | Current writer semantics | No universal field | Do not fabricate a new action/source enum |
| Revision / event order | Array position and recorded timestamp | Stable numeric timestamp sort; equal/invalid times retain stable input order | No revision; array order | No invented repository revision or stronger identity guarantee |

Owner evidence is not one uniform field: clear requests can record Home's
presentation owner, whereas completion/Edit writers resolve source ownership.
Preserve these recorded conventions. Home categorizes by `historyKind`, then
uses current Resource label / Project name if a matching registry entry exists,
otherwise recorded `projectName`. Project filtering uses both nonempty IDs when
available, else historical root/path. Resource filtering uses **resourceType OR
recorded root**; it is not the facade's exact `owner` filter. Current task status,
source existence and live physical ownership do not define event inclusion.

The existing UI opens the recorded note path if it exists today. It does not
seek an exact task or follow a moved task by title. Preserve that note-opening
compatibility while checking a valid current path/file at activation. Missing
sources must retain recorded rows and labels. No index scan is needed for reads.

`taskProgressMutation` removes the matching active check's event on reopen;
recompletion creates a new event/check. Repeated checked requests do not append
duplicates. Editing/deleting detaches or updates live checks without rewriting
historical display snapshots. Moving updates live bindings, not historical
owners/times/titles. Parent completion does not force Step completion/events.
Step reopen removes that Step's bound event. Clear retains existing bound
History, adds an archive event only when no matching completion History exists,
removes source blocks/checks/optional metadata, and preserves unrelated records.
Read-side deduplication would change this policy and is prohibited.

The facade's default HistoryFact array remains a compatibility API. Add a narrow
typed **recorded projection** on `queryHistory` for these displays, preserving
detached primitive recorded fields, source-independent facts and row diagnostics.
Home/workspace sessions invalidate from the existing completed-History dashboard
event, not task-data imports. Keep Statistics/Progress/Oath readers and all
completion/history writers unchanged. Unknown unsupported legacy field types
need diagnostics, never invented values or writes.
