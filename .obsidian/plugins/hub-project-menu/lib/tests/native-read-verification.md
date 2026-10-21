# Phase N0 — Inactive backend-neutral read/readiness contract closure

2026-10-17 · Europe/Stockholm · **N0 only — STOP FOR REVIEW**

## Safety preflight and U3 decision

**Proceed decision:** current plugin data passed the available non-mutating checks; protected non-workspace data stayed stable during a controlled **184,655 ms** pre-edit observation; fresh source/data hashes and verified originals were established; tests are isolated. No evidence of an active task/History/Oath integrity failure was found.

The original U3 writer remains **unidentified**. The earlier audit had hashes but no complete pre-change private JSON snapshot. No exact historical private-field delta or process attribution is claimed. Normal application activity is plausible: the running application manages workspace state, and existing HubDataStore/Spotify/workspace persistence paths save plugin state with hubState revisions. Timestamps alone do not identify the writer.

Current preflight data.json: SHA-256 **CAB5DC6C82E77D3719AEAB33B92A4B31F5DE89258974F1AC9910E9455A94F9AA**, 586,178 bytes, mtime **2026-10-17T09:16:13.1720535Z** (11:16 Stockholm). Installed main.js remains **318CD234980489C514E1C1085DF2D95FEBFEF64284D0293BC566493B4B28DB20**. Shared Project state remains **5E553775898003A2111BEA1C11BAB336A3DC863941AED9C25056320BA7ECB506**.

Read-only health checks: JSON/schema/revision/container shape; existing normalizeLoadedData invoked on a disposable receiver without constructing/loading/saving a store; pure auditHubData on a clone; recorded History projection; Statistics relevant-field conversion; both shared Project definitions. Results: **174 stored History rows, zero recorded projection diagnostics, all four Resources and both shared Projects recognized**. The existing audit helper reported **one stale-project-card-order reference**, not a task integrity failure. No repairs/normalization were persisted.

Workspace state changed independently during the observation: start hash **99100E8C5A18062E4FB225606145562BB7E27652FD5EDDC9625538D60F1D2246** → **F55147F2C28AFA702B4F04C51398E519196BE41A9025E358337678DA2CF5A991**. Further app-managed workspace changes are recorded in final safety evidence. No workspace state was restored. Plugin data, shared state and installed artifacts remained stable through the controlled interval.

Fresh baseline: **1,106 existing files and 333 initial Git-status entries**; all authorized existing source originals were copied and SHA-256 verified before editing. Prior audit documents match their reviewed hashes. The prior durable audit archive's **53 files** were reverified unchanged.

Evidence and exact originals:

\`System/Backups/itacan-n0-20261017-82ff92ea/\`

Preflight evidence: observation-start.json, observation-drift.json, observation-end.json, preflight-health.json, baseline.json and guarded per-command logs. Sensitive plugin state/task text was not printed. Critical task metadata/History/Oath/mount/planning/brief substates were hashed separately.

## Delivered implementation and boundary

N0 addresses **H1 at the contract/fixture layer**, not consumer activation. It adds an **opt-in** read protocol on the existing TaskService. Existing queryStructured/queryHistory/resolveOathWork/resolveReveal/action methods retain their original contracts/results. This avoids widening a legacy call into a union that existing UI would misinterpret.

New methods:

- readiness(requiredFeatures): explicit backend state, detailed operation/feature support and missing/conditional requirements.
- read(request): explicitly discriminated legacy/native requests and results; unsupported/unavailable are failures, never successful empty rows.
- subscribeReads(listener): explicit read invalidation. Synthetic native notifications are **ephemeral snapshot invalidations**, not fabricated durable commits/receipts. Legacy read invalidation wraps the existing shared subscription.

The production Legacy Adapter adds only a read-only readiness observation of its already injected Dataview API. No index query, source read, ID allocation or startup behavior is added by observing readiness. Current Oath.ready() and every consumer's existing readiness path are unchanged.

The native backend exists **only under test paths** as deterministic mutable memory snapshots validated against actual Phase 2A record validators. It opens no repository, performs no native command, imports no filesystem/Obsidian/Dataview/Electron module, selects no production backend, and creates no task/History/commitment data in the vault.

Fixture validation also enforces global task/Step uniqueness and task/historical owner-to-partition consistency. These are read records, not a complete repository state: no completion bindings/receipts are manufactured, and current-binding capability remains unsupported.

N0 uses a separate read protocol because old compatibility operations intentionally include legacy source-action semantics. A native read success does not make those operations available. Synthetic old-operation capabilities are all false, and creation/completion guarantees explicitly say unsupported. The two new unsupported declaration values prevent a read-only fixture from falsely advertising durable mutation behavior; no mutation implementation changed.

### Implementation inventory

Paths relative to the plugin:

| Area | Exact source reference | Result |
|---|---|---|
| Backend/request/result discrimination | lib/services/task-service-contract.d.ts:197,247,261 | Explicit legacy-markdown/native opt-in protocol; old wire shapes unchanged |
| Read capabilities/readiness | task-service-contract.d.ts:198–216; lib/services/task-read-contract.js:5,17,33,46 | Six operations, 19 features; supported/conditional/unsupported; ready/not-ready/unavailable/recovering/unsupported; missing requirements |
| Native parent/Step projection | task-service-contract.d.ts:218,222; lib/tests/native-read-fixture.cjs:62 | UUID, primary owner/context, revision, dates/Necessity, current/deleted/archived state and actual nested ancestry/order |
| Recorded History | task-service-contract.d.ts:233,275; native-read-fixture.cjs:72 | Native event identity/snapshot/original owner/count flags; retained vs counted explicit; imported current bindings/legacy Statistics unsupported |
| Committed work / candidates | task-service-contract.d.ts:247,269,272; native-read-fixture.cjs read branches | Separate candidate and committed result shapes; completed/missing/deleted/wrong owner/unsupported alias |
| Navigation | task-service-contract.d.ts:243,277; task-read-contract.js:76 | Native task identity, native owner/location, explicit recorded provenance, none/missing/deleted; no fake task source |
| Shared facade | lib/services/task-service.js:22 | Three opt-in methods; original invoke/old methods/lifecycle unchanged |
| Legacy readiness | lib/services/task-service-legacy.js:50 | Read-only injected-index observation; no production caller migrated |
| Read invalidation | task-service-contract.d.ts:288,293; task-read-contract.js:66 | Separate ephemeral read channel, existing committed TaskChange contract preserved |
| Runtime guards | task-read-contract.js:76,116 | Wrong/unknown backend/results rejected; native source-smuggling blocked; native result copies deeply frozen |
| Synthetic adapter/dataset | lib/tests/native-read-fixture.cjs:23,80,101 | Private/two shared/shelved Projects, four Resources, 14 tasks, nested Steps, five retained events and explicit context registry fixtures |
| Consumer interpretation fixture | lib/tests/native-read-policy-fixture.cjs:9 | Exercises actual pure date/group/search-score/Oath-progress/range helpers where applicable; no production UI rewrites |
| Behavior/negative tests | native-read-contract.test.cjs; native-read-policies.test.cjs; native-read-lifecycle.test.cjs | 51 current checks, including fresh-process platform-dependency denial |
| Declarations | task-read-types.fixture.ts; existing task-service-types.fixture.ts import | Exhaustive discriminant narrowing and invalid cross-backend field access; original legacy type assertions retained |
| Production selection | lib/services/task-service-host.js:5; plugin.js:12750 | Unchanged: one TaskService → one LegacyTaskAdapter |

## Compatibility summary

| Area | Existing legacy behavior | Synthetic native contract | N0 status |
|---|---|---|---|
| Task identity | Hidden ID or strict temporary locator | Native UUID handle; same-title distinct records | Verified native read identity; no alias migration |
| Parent/Step hierarchy | Indexed/source Markdown ancestry | Explicit taskId/parentStepId/order and completion | Verified read projection; StepDraft writing remains N1 |
| Ownership | Physical Project/Resource | Exactly one primary owner, optional location | Verified; Resource mounts never transfer ownership |
| Home attribution | Resource-first + page Project reference | Primary owner, working-context fixture and explicit unresolved presentation | Partial representation; no Home native routing |
| Dates | Existing local endpoints | Date-only, explicit midnight, null endpoints/timestamps retained | Verified representation; reversed same-day rule unchanged |
| Recorded History | Raw recorded primitives/order/duplicates/diagnostics | Native events and historical-only evidence, counted flag | Verified event representation; no current-binding import |
| Statistics | Existing recorded dedup/count/cohort semantics | Native retained/counted distinction; legacy-statistics explicitly unsupported | No numerical parity claimed; N1/N5 required |
| Oath candidates | Indexed open physical parents, eligibility/grouping | Native candidate operation, open physical parents, eligible owners | Verified isolated policy evidence; enrollment unchanged |
| Oath committed | Stable persisted IDs + source checks | Native current parent state incl completed; missing/deleted/owner mismatch/alias states | Verified isolated resolution/progress; no production Oath switch |
| Readiness | Dataview-based legacy | Native memory readiness independent of Dataview; partial support explicit | Verified opt-in protocol; old readiness untouched |
| Reveal | Validated Markdown source | Native task/location/provenance/none/missing contexts | Verified read target contract; UI navigation unconnected |
| Mutation | Current authoritative legacy writers | Unsupported by native fixture/read protocol | Unchanged; no native writer integration |

Native outputs contain no path/line/hidden ID/TFile/source block unless an explicitly supplied **historical provenance** navigation variant carries recorded source evidence. A folder/note context is an identity reference, not proof of a Markdown task source. Unknown task completion times remain null. Full source blocks and recurrence are not invented from titles/descriptions.

Native task/event results are detached from backing snapshots. Facade native results are deeply frozen so consumer mutations cannot corrupt TaskReadSession's cached promise result. Legacy old-method values are not frozen/reinterpreted by N0.

## Actual consumer policy outcomes

“Verified” below means the named isolated contract/pure behavior, never a working production native screen. No consumer was connected to native routing.

| Consumer | Native fields sufficient? | Actual pure policy exercised? | Remaining unsupported dependencies |
|---|---|---|---|
| Search | Partial: ID/title/description/owner/completion/Steps | Existing nameScore; stable evidence test | Full indexed continuations/block search/ranking/source reveal; production mapping |
| Daily Brief | Partial: native target/state/owner/dates | taskIsFuture + taskGroups, eligible owner fixture | Saved native target persistence/production restore and legacy source actions |
| Schedule | Partial: Project/date/hierarchy evidence | upcomingGroups/upcomingBucket, local calendar | Native location ancestry/validLocation registry and UI routing; Resource Schedule intentionally absent |
| Project Tasks | Partial: owner/current/Step data | taskGroups with native date projection | Root/path eligibility and source actions; native panel integration |
| Resource Tasks | Partial; all four Resource IDs covered | taskGroups and physical-owner fixture | Native location registry/actions; mounts do not become Project ownership |
| Phase editor | Partial: stable parent/Phase/owner | Isolated explicit selection-state fixture; no production helper available independently | Native planning transaction/registry; missing/deleted/Step selections reported |
| Home | Incomplete for old page-reference attribution | Isolated Resource-first/Active-cohort interpretation; primary/working/presentation distinction | Unresolved native presentation metadata and production Home mapping |
| Recorded History | Sufficient for native event evidence, partial for combined legacy display | Native event projection + unchanged legacy projection parity | Native History UI, combined event/order/import lineage interpretation |
| Statistics | Insufficient for legacy numerical parity | Actual five statisticsRange calendars, DST boundary; explicit lineage rejection | Current-binding import, raw legacy event semantics/count adapter; All time modal unchanged |
| Oath candidates | Sufficient for isolated native parent candidates | Actual taskGroups + explicit eligible-owner fixture | Production picker/enrollment/saved identity wiring and alias decisions |
| Oath committed | Sufficient for fixture-native references/current state | Actual oathProgress on resolved rows; deleted/unavailable cannot auto-complete | Persisted legacy aliases, production readiness/resolver/fulfillment integration; no Strict changes |

These are more than array-filtering claims: actual shared pure helpers are exercised where available, deferred real TaskReadSession lifecycles are tested, fresh-process reads deny platform/storage dependencies, and unsupported production dependencies are listed explicitly. Native Phase/Home interpretation remains an isolated fixture, not a claim that tightly coupled production UI functions were run natively.

## Readiness, capability and failure behavior

Generic ready is not universal support. The memory fixture can be ready for structured/current state while mutation, recurrence, imported lineage and legacy actions remain unsupported and Home presentation/history counting remain conditional. Required conditional features appear in missing, so callers must handle them explicitly.

Partially capable adapters can list tasks yet reject History, committed work or navigation. Missing read ports cannot advertise implemented native operations; missing read-subscription ports cannot advertise invalidation. There is no undefined method call, misleading successful empty response or writable Markdown fallback.

Legacy wrapped reads call the original operation and return its unchanged data under an explicit backend envelope. Existing typed legacy source/validation errors remain errors; only genuinely unsupported operations become explicit unsupported results in the opt-in protocol.

Native transient unavailable/recovering states do not become empty snapshots. TaskReadSession through a test-only native port evicts failed reads, re-queries on invalidation, discards obsolete deferred snapshots, suppresses publication on cancellation/close and keeps multiple consumers' subscriptions independent. Native ephemeral notification does not claim an atomic task+History commit.

## Checked semantic gap register

| Gap | Current legacy behavior | Current native capability | N0 result | Future phase |
|---|---|---|---|---|
| Non-UUID IDs | Valid hidden IDs/Oath refs may be non-UUID | Required canonical UUID | Explicit legacy-id reference yields unsupported-alias; no mapping | N1 alias/ledger |
| Source-independent Search | Indexed full display/search text | Title/description/Step state available | Title score/evidence verified; full search parity unsupported | N1 content decisions, N5 consumer |
| Home presentation | Resource-first/page Project reference | Primary owner only | Unresolved presentation explicit; working context separate | N1 specification/N5 mapping |
| Native navigation | Legacy Markdown reveal | Task/location identity and optional recorded provenance | Typed/tested targets, missing/none/unsupported distinct | N2 registry, N5 UI routing |
| Step ancestry editing | Private legacy snapshot retains structure | Native Step ancestry/order records | Read tested; no new StepDraft write contract | N1 |
| Same-day times | Legacy accepts reversed clocks on same date | Native rejects | Discrepancy tested, no normalization | N1 approved policy |
| Explicit midnight | Distinct from date-only | Same endpoint representation | Verified "00:00" vs null | Preserve through N1/N5 |
| Recurrence | Tasks-plugin toggle engine | No equivalent native engine | Capability unsupported | N1 semantic decision; later writer integration |
| Source-block fidelity | Markdown continuations/block/EOL separate from description | No complete lossless content contract | No fabricated source/description conversion | N1 |
| Imported completion binding | Existing completion/check/event relationships | Completed create emits new event | current-bindings request unsupported | N1 atomic import contract |
| Counted vs retained History | Recorded raw evidence/Statistics rules | Explicit retained events/count flags | Both selectable, no Statistics equivalence | N1/N5 |
| Native saved targets | Persisted Daily Brief path/line/ID evidence | Native ID/Step target representable | Resolved/missing/deleted/missing-Step typed/tested; production restore untouched | N5 |
| Oath aliases | Persisted {id,path,text} | Native fixture ID namespace only | Unsupported alias explicit; no rewrite | N1/N5 |
| Native readiness | Production legacy gate uses Dataview | Memory read state can be independent | Verified new protocol; no real repository health claim | N2/N5 host |
| Location/Phase registry | Source folders + Wizard planning | Reference shape/external resolver hooks | Fixture context identity/missing owner cases only | N2 registry, N3 planning coordination |
| Durable writer intents | Legacy queues/compensation and limited retry | Native core receipts require stable intents | Fixture mutation unsupported; guarantees false | N3; no H2 implementation here |

**H2–H7 remain future work.** A type union did not resolve identity migration, date policy, recurrence, full-source preservation, completion lineage, host/storage, sharing or orchestration.

## Executed verification

Environment: existing VS Code Electron-as-Node, Node **24.21.0**, TypeScript **6.0.3**, TZ Europe/Stockholm. No package installation. New native adapter uses memory only. Existing JSON core tests use uniquely named OS Temp directories, including crash/lock subprocess fixtures.

| Check executed during N0 | Final result | Evidence |
|---|---|---|
| N0 contract/policy/lifecycle | **51 passed**, 0 failed/skipped/cancelled | n0-behavior-final-reviewed.out.log: 25 contract + 15 policy + 11 lifecycle |
| Existing focused | **452 passed** | focused-explicit.out.log |
| Existing regressions | **34 files passed** | regression-explicit.out.log |
| Safe Strict/recovery | **48 passed** | safe-strict-explicit.out.log; synthetic only |
| Inactive native core | **66 passed** | inactive-core-guard-fixed.out.log |
| Both declarations | **0 diagnostics each** | task-service-types-final / native-core-types-final |
| Targeted Search browser | **21 checks passed** | browser-context-search.out.log |
| Targeted History browser | **79 checks passed** | browser-history-read.out.log |
| Targeted committed Oath browser | **88 checks passed** | browser-oath-committed.out.log |
| Pre-edit source/build | **167 modules, equal installed bundle** | preflight-source-build, baseline |
| N0 staged source/build | **168 modules, successful, not installed** | staged-build.out.log, build-diff.json |
| Factory comparison | **2 changed, 1 added, 165 existing unchanged, none removed** | build-diff.json |

Because runtime facade methods/readiness were added, three actual legacy consumer/browser fixtures were rerun. Other historical consumer browsers were not counted as current passes. Unchanged consumer/writer factories and the baseline bundle correspondence support reusing prior Phase 2B evidence. Inherited divider alignment failures in task-workspace-before/task-workspace and standalone History heading-icon failure remain unchanged; no assertions were weakened or later unexecuted assertions counted.

Harness corrections are retained honestly:
- The first strict observation check rejected a workspace-only app-managed change. It was corrected to record that explicit allowed exception while continuing to require non-workspace protected-data stability.
- A copied launcher initially wrote new logs to the prior disposable Temp working directory. Logs were copied into N0 evidence and the launcher corrected; the prior durable 53-file archive remained unchanged.
- One unscoped Node --test discovery command included archived test copies and was stopped. Archived original-source assertions are not current regression failures or passes. Protected-data checks afterwards found no unexpected changes; all counted regression runs use explicit file lists.
- The initial filesystem guard treated Windows short/long Temp aliases differently, blocking safe core fixture mkdir calls. It now canonicalizes existing ancestors with native realpath and still refuses paths/symlinks outside OS Temp. Unchanged core tests then passed.
No product assertions or native domain rules were weakened to fix those harness issues.

## Build and installation status

Only these factories differ from the pre-edit build:
- lib/services/task-service.js: three opt-in method lines; removing them reproduces the previous factory exactly.
- lib/services/task-service-legacy.js: one read-only readiness method; removing it reproduces the previous factory exactly.
- Added lib/services/task-read-contract.js.

The other **165** factories, including plugin startup, all consumer modules, Oath enrollment/readNewWork/awaitingIndex, task/History writers and planning policy, are unchanged. Native/Strict auxiliary assets remain identical. The test adapter/native core do not enter the bundle; no production native import/discovery/selection was introduced.

Staged main.js SHA-256:
**29635B7632218BDDA551E23358C1C393E300E8990D92D41F454741B240ADD9C7**

Installed main.js SHA-256:
**318CD234980489C514E1C1085DF2D95FEBFEF64284D0293BC566493B4B28DB20**

The difference is intentional **uninstalled N0 source work**. No staged artifact was copied to installed assets. No Obsidian reload/restart/toggle occurred.

## Exact change allowlist and recovery

All paths below start at .obsidian/plugins/hub-project-menu/.

| Category | Changed/new paths |
|---|---|
| Existing declarations | lib/services/task-service-contract.d.ts; task-service.d.ts; task-service-legacy.d.ts |
| Existing runtime | lib/services/task-service.js; task-service-legacy.js (only additions described above) |
| Existing type test | lib/tests/task-service-types.fixture.ts (imports new fixture; all previous assertions retained) |
| New pure helper/declaration | lib/services/task-read-contract.js; task-read-contract.d.ts |
| New test-only adapters/policies | lib/tests/native-read-fixture.cjs; native-read-policy-fixture.cjs |
| New behavior tests | lib/tests/native-read-contract.test.cjs; native-read-policies.test.cjs; native-read-lifecycle.test.cjs |
| New type fixture | lib/tests/task-read-types.fixture.ts |
| New report/handoff | lib/tests/native-read-verification.md; lib/services/TASK-SERVICE-PHASE-N1.md |

**Six existing files changed; ten new files.** Exact hashes, fresh originals and actual status changes are in baseline/final safety manifests; evidence/build outputs stay under OS Temp or this phase's backup directory. No unrelated modified/untracked work was overwritten, reset, cleaned, rebased or committed.

Rollback, if requested later: compare current versions to N0 final hashes, then restore only these six exact source/type-test files from verified N0 originals and remove only N0's identified new files after checking subsequent edits. Do not restore older data.json/workspace.json or an entire tree.

## Final safety and remaining limits

Production still selects one Legacy Adapter. No production consumer invokes the new native read protocol; no writer was migrated. No native repository/authority manifest/migration ledger/task/history/operation journal was created in the live vault. No real Standard/Strict Oath, host restriction, settings change, real task mutation, History import, Git transport, migration, installation or task-location UI occurred.

Final hash/status comparison is in **safety-final.json**. Protected non-allowlisted files, including plugin data, Markdown, metadata/history/Oath container, shared Project state, Resource/mount definitions, installed assets, dashboards and native-core code are checked against the fresh N0 baseline. Workspace changes are disclosed separately and never restored. The final report/evidence archive records exact current hashes rather than reusing U3's obsolete data baseline.

**Final comparison passed:** six authorized existing changes, ten authorized new files, zero missing/unexpected protected changes, all six original backups verified, no real-vault native artifacts, and all 333 initial Git-status entries preserved (343 current entries). Plugin data remained at the preflight CAB5DC6C… hash. The independently app-managed workspace changed from the fresh baseline F55147F2… to 2727F0C1…; neither file was restored. The prior durable 53-file audit archive remains unchanged.

Unverified/unimplemented: live native screens, production storage/readiness/recovery, durable mutation intent, imported completion lineage/Statistics parity, legacy Oath alias migration, native location/Phase lifecycle, recurrence equivalence, lossless full-source migration and two-device native sharing. Those limitations do not become supported because a fixture has a matching method/type.

N1's exact proposed scope and approval-dependent decisions are in [Phase N1 handoff](../services/TASK-SERVICE-PHASE-N1.md). It remains inactive and synthetic/disposable. **N1 was not started. STOP FOR REVIEW after N0.**

