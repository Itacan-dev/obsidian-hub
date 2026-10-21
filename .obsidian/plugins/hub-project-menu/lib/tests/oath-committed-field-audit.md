# Phase 2B-2F-2 — original read/write separation and portable field audit

The stopped audit is retained in
`System/Backups/itacan-phase2b2f2-20261016-89786c9d/`.
The user's resume request supersedes its fresh-allocation-only invariant and
rejects the unapplied provenance patch. Both actual enrollment histories are
positive cases. No take/readNewWork/provenance modification is needed or applied.

The fresh resumed baseline has 1,083 files and 308 Git entries; only application
workspace state differed from the stopped audit. Source Oath SHA256 remains
85422BBB3A354CBF72CEB42103333EC5335F63E7D5F358DF3511979F5BFF715C.
The original source build matches installed bundle
4B6C200DBD631DD197397D8C967D7DFF90ED7C876E34C3ED4F34E1600D61FBF0.

## Original call graph, plugin-relative paths and pre-edit lines

| Source | Authority and synchronous/async contract |
| --- | --- |
| services/oath.js:74 tasks | Synchronous global TaskData parents; shared by original enrollment and active resolution |
| :80 resolveWorkspace, :88 ownsTask | Synchronous current registry/dashboard and physical root proof; active eligible:false differs from setup |
| :92 workspaceTasks, :100 setupRequirements, :111 validateDraft | Synchronous original enrollment validation; retained |
| :166 start | Async startup/fullscreen/Strict recovery, subscription, initial refresh; constructor precedes facade initialization |
| :190 resolveWork | Async ID match, bridge, per-note source snapshot, metadata, ownership; migration boundary |
| :221 refresh, :232 reconcile | Existing serialized/coalesced read and activation/fulfillment sequence |
| :246 captureFulfilment, :251 markFulfilled | Original latch and persistence; unchanged |
| :271 take -> :296 mutation queue -> :302 snapshot -> :306 ID -> :319 persist | Existing accepted enrollment writer; unchanged |
| :327 readNewWork -> :328 awaitingIndex -> :339 source/metadata hydration | Existing immediate hydration/map origin for both supported histories; unchanged |
| :350 finish, :364 end | Original outcomes/history/exit guards; unchanged |
| :388 changed -> captureFulfilment/emit/refresh | Immediate local edit projection precedes async read; must never be undone by an older result |
| :395 activateStrict, :413 recoverStrict, :423 destroy | Host/recovery policies unchanged; owned read cleanup is the narrow disposal addition |
| ui/oath-tasks.js:12/23/33 | Separate clock, partition and actual pinned/missing renderer |
| ui/oath.js:726/759/802/841 | Status rows, unavailable snapshots, exit UI and active header; all unchanged |
| plugin.js:12731/12750/12776, :12933 | Oath constructed before facade; start after facade setup; unload destroys Oath |

Before production integration: six original separation tests reran unchanged,
28 actual-original source/ownership scenarios were frozen, six actual active UI
states/DOM/rectangles were frozen, and 32 prototype separation comparisons passed.
The prototype used actual original take/readNewWork and the detached committed
projection. It did not change active authority before that gate passed.

## Minimum sufficient fields and legacy compatibility

| Evidence | Original source | Portable output/use |
| --- | --- | --- |
| Commitment id/path/text and order | current.tasks | Retained refs; path/text historical, ID authoritative |
| Current path/line/text/end/status/completed/ID | Unique indexed parent then fresh readTaskSnapshot | Explicit detached legacy parent evidence |
| Steps line/text/ID/completed/status/indent/end | Fresh snapshot, ordered nested Steps | Same primitive fields, no separate Step commitments |
| Necessity/start/due/time/description/Phase/capture | Effective taskMetadata and editor metadata | Existing normalization and optional-field overlay preserved |
| Enrollment fallback | Existing awaitingIndex task path/line/text/metadata | Explicit operation-local evidence only; no new provenance |
| Canonical acknowledgment | Unique indexed parent before source proof | Explicit retireAwaitingIndex; applied only on a current published batch |
| Missing/conflicting/source/owner failure | Original ref plus null task | Explicit status/diagnostics, same unavailable UI |

Raw Dataview objects, children/links, TFile, source block and editable tokens are
not exported. Those incidental fields have no read/UI authority in this consumer:
task actions revalidate through existing writers, and Steps use current primitive
source ranges. Actual active/pinned/status DOM and geometry match original data.

The generic legacy action resolver enforces an expected saved title and stronger
Step identity constraints. It is unchanged and deliberately not reused. Setup's
open/eligible/indexed oath-candidates policy is unchanged and is not reused either.

The completed report documents the explicit stricter read checks for a stale
indexed parent now in a Step/fence, a pending ID colliding with an indexed Step,
and stale async publication. It does not describe those cases as exact original
acceptance parity. Normal identity, source drift and both bridge histories retain
their established decisions. No persistent authority or writer changed.
