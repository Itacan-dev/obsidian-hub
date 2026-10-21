# Phase 2B-2F-1 — Oath setup candidate discovery and selection

Oath setup now discovers parent-task candidates through the existing shared
legacy-backed Task Service. A dedicated indexed oath-candidates policy preserves
the original physical eligibility, global parent-ID restrictions, full indexed
text, metadata and parent/Step presentation. The complete Oath service is unchanged:
enrollment, active resolution, hydration, fulfillment, history, timers, Standard/
Strict restrictions and recovery remain on their original implementations.

## Original boundary and implementation

The [pre-edit call graph and field audit](oath-candidate-field-audit.md) distinguishes
setup reads from validation, enrollment and active lifecycle readers. Original
service/UI sources and the original browser fixture are frozen and SHA256-checked
against the initial baseline. Candidate facts for ten workspace identities and
actual original setup/picker DOM/rectangles were captured before production edits.

Paths below are relative to `.obsidian/plugins/hub-project-menu/`.

| Source / line | Responsibility |
| --- | --- |
| lib/services/task-service-contract.d.ts:61,76,136 | Explicit setup-only policy/result evidence and indexed-only typed options requiring a workspace |
| lib/services/task-service-legacy.js:82,88,96 | Candidate-only validation/dispatch; existing query policies and every other adapter method remain identical |
| lib/services/task-service-legacy-oath-candidates.js:8 | Current workspace identity, Active Project status, Resource registration and dashboard checks |
| Same helper :14,20,27 | Global parent/Step ID context, exact physical dashboard/root/open-parent scope and parent conflict diagnostics |
| Same helper :30,36,40 | Existing portable indexed read view; retained valid rows, incomplete-read evidence and diagnostics, no source read or mutation |
| lib/services/oath-candidate-read.js:9,21,27 | Exact selection-reference matching, owned read consumer and one TaskReadSession of plugin.taskService |
| Same reader :34,58 | Deferred-query generations, workspace-signature validation, retry/failure and component/plugin disposal |
| Same reader :63,73,81 | Original prerequisite feedback over current candidate evidence, cached calendar grouping and workspace changes |
| Same reader :90 | Original validation precedence and explicit detached legacy enrollment draft; no generic DTO, handle or temporary key is persisted |
| lib/ui/oath.js:130,143,189 | Actual task picker, shared setup session, local selection intent and owned listener cleanup |
| UI :207,220,390 | Setup lifetime, workspace-reset behavior and inline suggestion/selection through the candidate reader |
| UI :326,595,608,645,716 | Scan-free prerequisite feedback; unchanged final validateDraft/reviewStrict/take remain authoritative |
| lib/domain/oath-workspace.js:13 | Unchanged taskKey: existing hidden ID or temporary path:line:text |
| lib/services/task-service-legacy-bridge.js:6 | Existing legacyReadTask conversion reused, unchanged |
| lib/services/oath.js:74,92,100,111 | Intentionally unchanged tasks/workspaceTasks/setupRequirements/validateDraft |
| Oath service :190,271,339 | Intentionally unchanged resolveWork/take/readNewWork; persisted refs remain {id,path,text} |
| lib/ui/oath-tasks.js / services/oath-strict*.js | Active/pinned presentation, Strict/native host and recovery remain unchanged |

UI feedback no longer calls raw workspaceTasks through setupRequirements on every
clock/duration render. It uses the original domain requirements plus current
candidate availability. Explicit Review and Take still invoke original service
validation and source-validated enrollment. The global tasks() reader still serves
take() and resolveWork() exactly as before; no active authority has been switched.

The separation gate ran before UI integration. Sixteen actual original-source
bridge/writer tests passed, followed by actual facade-to-original-writer parity.
Source writes, IDs, commitment order/refs, metadata, persistence and rejection
messages were compared using deterministic synthetic UUID injection. Read-only
candidate discovery never allocates those IDs; only the original explicit writer does.

## Candidate-to-enrollment comparison

| Area | Original behavior | New behavior | Evidence |
| --- | --- | --- | --- |
| Available Projects/Resources | Active Projects; registered Resources; stable identity/dashboard checks | Unchanged | Ten-workspace baseline; missing/status/Resource-root tests; actual UI |
| Physical ownership | Dashboard or recursive selected root, independent of page project frontmatter | Unchanged | Complete identity/path/line/text comparisons, nested notes, Resource presentation conflict |
| Resource mounts | Navigation allowance does not grant Project task eligibility | Unchanged | Actual projectWorkspaceForPath allowance plus excluded Resource candidate; enrollment rejection |
| Candidate inclusion | Open parent tasks without parent identityConflict | Dedicated facade policy, same eligible set | Exact original/current facts across private/Itacan/Hub and all four Resources |
| Parent/Step handling | Parent is commitment; nested Steps are presentation/progress evidence | Unchanged | Full indexed text, Steps, copied/missing Step IDs and actual enrollment |
| Grouping/order | Existing taskGroups, active followed by future | Unchanged helper over cached indexed evidence | Exact keys/order/date/time/importance, current-start boundary and browser DOM |
| Selection keys | Hidden parent ID, else path:line:text | Unchanged | ID-less and distinct same-title parents, full continuation text |
| Copied IDs | Global parent ID collision, including collision with a Step, rejects parent | Preserved global context | Cross-workspace/outside-root copies; no first-match substitution |
| Copied Step IDs alone | Do not exclude otherwise valid original parent commitment | Preserved with internal diagnostic | Original/enrollment parity; generic display policy deliberately not reused |
| ID-less candidates | Can select by locator; explicit enrollment assigns ID | Preserved | Exact source/commitment parity and zero read writes |
| Enrollment validation | Original setup/take, fresh source and global copy checks | Unchanged | Valid/multiple/ID-less/Resource enrollment, changed/moved/completed sources and failure cases |
| Commitment refs | Ordered, deduplicated id/path/text | Unchanged | Actual writer outputs and UI duplicate-Take/accepted-write test |
| Active resolution | Original tasks/resolveWork/readNewWork/awaitingIndex | Unchanged | Entire service/factory equality, active alongside candidate sessions, lifecycle regressions |
| Fulfillment/history | Existing latch, persistence and outcomes | Unchanged | Completion/reopen/delayed import/failure retry, full Oath browser and safe service regressions |
| Standard/Strict restrictions | Existing setup/preflight/enforcement/recovery | Unchanged | Actual ordinary/Strict Now/scheduled review parity; 48 safe mock-host checks |
| Setup UI | Existing setup, picker, rows, dates, review and geometry | Identical for equivalent valid data | Actual original/current DOM/attributes/rectangles, keyboard/focus/scroll, broad workflow |

Temporary read cache is consumer-owned and nonpersistent. Setup and its task picker
share one session; standalone pickers own their own session. Multiple sessions use
the facade's single backend task-data subscription. Workspace-card invalidation
also uses that shared facade subscription, without candidate scans. Closing a
picker does not close setup; closing setup/plugin removes owned sessions and
cannot close the facade, active Oath subscription or accepted enrollment mutation.

## Required read-safety changes

The original inline setup silently remapped/dropped missing selections and the
picker pruned missing chosen keys. The request explicitly replaces that behavior:
user selection/deselection survives refresh and failure. Exact selected path/line/
full-text/ID evidence must still match an available candidate. Changed, moved,
completed, missing or copied selections remain represented and block submission
until updated; no title-only or same-key substitute is silently chosen.
Workspace changes retain the original explicit selection reset.

Initial index-not-ready remains Loading tasks, distinct from a successful empty
workspace. Failed/incomplete reads retain trustworthy display/selection evidence
and show restrained retry feedback; they cannot permit a false empty setup. Missing
or ineligible workspaces reject. Unsupported malformed source/metadata rows are
diagnosed and incomplete reads block enrollment instead of weakening the writer.
This is an explicit availability/safety limitation, not silent candidate loss.

## Executed verification

- **51 new focused tests pass**: 16 separation/writer comparisons, 15 policy tests
  and 20 session/selection/lifecycle tests. Combined with the prior 282 checks:
  **333/333 pass**. The entire active Oath service remains byte-identical.
- **34 existing regression files pass**, including original Oath, workspace/shared
  Resource restrictions, task mutation/history/progress, shared store, Statistics,
  Brief, Search, planning and workspace state. Expected synthetic store/conflict
  diagnostics remain visible in retained logs.
- **48 additional tests in five safe Strict/recovery suites pass**: oath-strict,
  oath-phase4, oath-phase5, oath-host/recovery and oath-windows/adapter. Hosts,
  windows, observers and process inventories are mocked; no everyday desktop lock
  or physical Strict activation is performed or claimed.
- Both TypeScript 6.0.3 declaration checks have **zero diagnostics**. All **66
  inactive native-core tests pass**. Native code is still unreachable in production.
- **116 targeted Oath browser checks pass**, including 27 original baseline checks
  (not counted again separately), exact setup/picker DOM/text/attributes/rectangles
  across ten workspace identities, selection intent, keyboard, focus, scroll,
  delayed index/failure/retry, A/B workspace race, close/unload, multiple consumers,
  Standard/Strict Now/scheduled setup/review parity and duplicate Take with accepted
  persistence continuing after consumer disposal. Only generated per-modal group/
  date/custom IDs are normalized; labels, relationships and geometry are compared.
- The existing **full oath.html workflow passes**: fresh defaults, preset/custom/
  scheduled setup, scoped creation, picker/search/selections, review, Step and task
  completion, active/pinned header, fulfillments, schedules, Escape/Keep/X/Break,
  continued Oathbound time, clock cleanup and responsive layouts. **oath-focus**
  separately passes actual workspace picker keyboard/pointer restoration checks.
- The old browser host initially failed before production changes because it lacked
  task-live-form. Its explicit module loader, current renderer document/action
  bridges, async settling and fixed-destination task form host were updated. Obsolete
  folder-icon/date expectations now use the existing canonical icon/shared formatter;
  source creation/cancellation, validation, fulfillment and geometry assertions are
  retained. Newly created fixture tasks receive explicit candidate refresh. These
  are test-host adaptations; task form, date, icon and dashboard production code is unchanged.
- Previous browsers pass: Statistics **99**, History **79**, Home **27**, workspace
  Tasks **8 contexts**, Phase editor **38**, Search **21**, Schedule **22**, task forms/
  Quick Add/Inbox **64**, Home actions **48 Home / 36 workspace layouts**, History
  paging/Markdown/metadata, Daily Brief, existing Statistics responsive UI, Progress
  navigation and Step progress. All earlier consumer factories are identical.
- Candidate safe parse/require smoke passes without onload. Stage comparison is
  **164 → 166 modules**, exactly two changed existing factories (adapter and setup
  UI), two new read helpers and **162 identical existing factories**. Removing only
  explicit candidate validation/dispatch restores the exact original adapter;
  previous policies, History/default APIs and every writer are identical. Active
  status/exit/control UI, Strict modules and auxiliary assets are identical.

Inherited failures remain, with unchanged assertions and initial input hashes:
task-workspace-before/task-workspace fail “Mode separator aligns with Files divider”;
history-heading fails “Icon visible at existing size”. Later assertions did not
execute and are not counted. No unrelated visual repair is included.

Tests not claimed: live Obsidian execution/manual acceptance, physical native Strict
host enforcement, a whole application screenshot, every unrelated browser preview,
or committed-resolution migration. Browser host APIs are mocked while actual
production setup/picker, service, facade, task data, grouping and renderer code run.

## Performance

Node 24.21.0, Europe/Stockholm, median of seven runs on exactly 100/1,000/5,000
synthetic parent tasks across Projects/all Resources, mounted/presentation conflicts,
ID-less/copied IDs, nested Steps, inactive roots, moved/missing indexed sources and
active/future metadata.

| Tasks | Original one-workspace discovery ms | Current invalidated read/grouping ms | Direct facade ms | Two cold workspace reads ms | Cached read ms | Selection refresh ms | Group preparation ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | 0.415 | 0.328 | 0.315 | 1.162 | <0.001 | 0.376 | 0.008 |
| 1,000 | 1.856 | 2.731 | 2.805 | 6.600 | <0.001 | 2.948 | 0.019 |
| 5,000 | 7.562 | 14.368 | 14.014 | 30.619 | <0.001 | 14.504 | 0.065 |

These in-memory results are not live Obsidian timings or a speedup claim. Original
scoped taskData already counts global identities; the facade also projects all
indexed metadata and performs one additional query-wide identity pass, then
projects selected physical parents. Each query makes one Dataview scan, two global
identity passes and zero Markdown source reads/writes. Seven cached reads and ten
countdown/requirements updates make zero additional scans. Cold workspace switching
is explicitly two queries, not compared against one original read. The measured
largest refresh is about 14.4 ms; no serious unresolved regression is found.

## Safety and installation

Audit directory:
`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-phase2b2f1-d4cc048d69e44949be46b5ddd70f0ec8`.
Durable originals/evidence:
`System/Backups/itacan-phase2b2f1-20261016-d4cc048d/`.

The fresh baseline protects **1,064 unique files and 288 initial Git-status entries**,
including ignored real task Markdown, plugin data/settings, authoritative History/
metadata/Oaths, shared state, Briefs, Progress and inactive native core. **Ten
original source/bundle backups** are SHA256-verified. The gate checks all protected
files/status entries, an exact changed/new-file inventory, frozen originals,
introduced whitespace and absence of live native manifests/writer locks/generations.
Application-managed workspace changes are observed separately and never restored.

Real task Markdown, metadata, Oath commitments/history, Standard/Strict settings and
whitelists, shared Project data, Resource definitions/mounts, Briefs, Progress,
Statistics/History sources and plugin settings remain unchanged. No Git reset,
clean, rebase, commit or synchronization occurs; no native authority, task location
or new writer is introduced. All tests use synthetic Maps or disposable profiles.

```text
Before main.js    F3D2850C8A59BC61195E99429510B626A9E5EAD735507569EBE35D4AB04931E5
Candidate main.js 4B6C200DBD631DD197397D8C967D7DFF90ED7C876E34C3ED4F34E1600D61FBF0
```

The reviewed main.js is installed and its SHA256 matches the tested candidate above.
A fresh final-source build matches all three staged artifacts exactly. Installed
safe parse/require and plugin-load checks pass without onload. The final safety gate
reports exactly **eight changed existing files and nineteen new phase files**,
all ten verified original backups, all 288 initial status entries preserved and
zero native authority files. Protected data and workspace.json are unchanged.
Only main.js was copied; native/Strict assets and dashboard sources were not
overwritten. Original/candidate builds, full logs, numerical/candidate/DOM/rectangle
facts, screenshots, source snapshots, request, report, handoffs and installation/
safety manifests are retained with the verified backups. Obsidian was not
automatically reloaded/restarted or disabled/enabled. **Manual reload is required
when the user is ready.**

## Handoff and stop

The [Phase 2B-2F-2 handoff](../services/TASK-SERVICE-PHASE-2B-2F-2.md) details remaining
legacy tasks/resolveWork/readNewWork, stable commitment IDs, current-title/source
hydration, global copies, physical ownership, awaitingIndex, accepted writes,
fulfillment latches, exactly-once outcomes, Standard/Strict recovery and clock/read
separation. Candidate results are explicitly unsuitable as active commitment
authority; a separate committed-resolution/source-validation boundary is required.

**STOP AFTER PHASE 2B-2F-1 — FOR REVIEW.** No committed hydration, fulfillment/writer
migration, native persistence, Git synchronization or task-location implementation.
