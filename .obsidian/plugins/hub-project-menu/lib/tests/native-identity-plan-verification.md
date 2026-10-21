# N1-B implementation verification

2026-10-17. **Limited inactive N1-B implemented. STOP FOR REVIEW.** [Formats/API](../../../../../ItacanTaskCore/identity/README.md), [N1-C handoff](../services/TASK-SERVICE-PHASE-N1-C.md), [N1-A specification](native-migration-compatibility-spec.md), [frozen compatibility vectors](native-migration-compatibility-v1.json).

Verified originals, request, source/build/test evidence and exact output hashes: [N1-B archive](../../../../../System/Backups/itacan-n1b-20261017-f943cbfd/). The final `evidence-inventory.json` lists every archived file and its SHA-256, excluding itself; copied artifacts and prior archives are verified before completion. Final hashes/status/allowlist are in `evidence/safety-final.json`.

## Authorization, scope and architecture

The N1-B request explicitly approves **D01 exact aliases, D02 allocate-once plans, D03 quarantine-first ambiguity, D17 immutable plans/retries and D18 lossless dispositions** for inactive synthetic/disposable implementation. The exact implemented decision revision is `N1-B-D01-D02-D03-D17-D18-r1`. This report records the new authorization; N1-A's historical decision sheet and 147 observations remain unchanged.

Production remains one shared Task Service → Legacy Adapter → current Markdown/metadata authority. N0's opt-in native read protocol stays inactive. New code is isolated under `ItacanTaskCore/identity/`, without changes to the native task entry point/domain/commands, production modules, startup, readers/writers, declarations, UI or sharing. Existing narrow value/error and NodeDirectory helpers are reused without edits. No native-core extension was necessary.

Stages are distinct: allocation-free analysis; atomic durable preparation of a frozen plan/reservations/private quarantine/receipt; explicit snapshot-specific synthetic approval; atomic identity-only publication. Neither preparation nor publication creates task/Step records, events, bindings, Oath outcomes, content imports or source associations. `processing` is always planned-only and `importedTasks` is always zero.

## Contracts and identity guarantees

The [API documentation](../../../../../ItacanTaskCore/identity/README.md) enumerates every record/field, required/null rules, version compatibility, digest, revision, receipt and recovery semantics. Separate versions exist for the planning snapshot, source evidence, plan, alias, reservation, quarantine and receipt. Each currently supports exact version 1 independently; pointer/parser versions and the approved decision revision are separately checked. Unknown fields, capabilities or newer versions fail without downgrade/reinitialization.

Exact accepted Hub IDs retain spelling/case. Canonical unique unreserved legacy UUIDs may be reused; accepted non-UUID/uppercase/compact aliases get separately allocated canonical UUIDs. The extractor matches current Hub grammar, verified against N1-A `ID-*` observations. Unrecognized comments remain raw evidence, not aliases. Title/path/line/ordinal/checksum do not become native IDs.

Identical-looking ID-less occurrences remain distinct captured entries with unique allocated IDs. Committed prepare owns those IDs across reopen, publication, retries and acknowledgement loss. Candidate IDs are never exposed before commit. Read-only analysis allocates nothing. New operation/plan/snapshot/file labels cannot re-plan an already captured file lineage/path. Changed evidence, file moves/edits/deletion, ancestry or owners reject explicitly, preserving the old plan. A reviewed rebase/source reconciliation operation remains unsupported; no title-based recovery exists.

Global accepted-ID collisions cover all supplied corpus entries before owner selection, including outside roots and parent/Step domains. All candidates in an ambiguous set remain quarantined with null native IDs and no arbitrary alias target. Existing/deleted/retired/planned/published/abandoned reservations share a global UUID set. The allocator avoids all canonical candidates and reserved IDs. A new conflict with a previously captured/published alias fails the entire operation without retargeting that alias.

The supplied corpus must include every recognized checkbox occurrence within its supplied files. The analyzer verifies that completeness and rejects double accounting at one position. **It does not scan a vault or verify that an external caller disclosed every file/source lineage.** That boundary and static supplied existing-native reservations are prerequisites for later host/migration work, not a production global-discovery claim.

## Decision traceability

| Implemented rule | Decision | Source/contract | Executed evidence |
|---|---|---|---|
| Exact aliases/canonical UUIDs | D01 | identity/domain.js, repository.js, contracts.d.ts | Canonical/non-UUID/uppercase/compact/case-sensitive lookup; N1-A ID-* comparison |
| Allocate once; duplicate titles remain distinct | D02 | prepare/reservations/receipt protocol | Memory/directory reopen, replay, source-label bypass rejection, allocator collisions/exhaustion |
| No collision winner or retired-ID reuse | D03 | global analyze/reservation invariants | Parent-parent/parent-Step/Step-Step, all owners/outside/mounts, competing aliases, live/deleted/retired IDs |
| Immutable source/plan and durable retry | D17 | plan digest, queue, receipts, node-store.js | Stale evidence/review/revision, concurrent retries/plans/readers, faults and nine process crashes |
| Explicit private dispositions/quarantine | D18 | plan entries, grouped quarantine, accounting validator | Malformed/fenced/unknown/unresolved/deferred records, raw evidence, corrupt/missing evidence and exact total accounting |

Preserved constraints: **D04** one physical owner and parent-folder context; **D08** source dates/Necessity/null uncertainty untouched; **D14** recorded History/Statistics semantics untouched; **D16** both shared Projects/private Resources and local provenance boundaries. Deferred decisions are not represented as approved import behavior.

## Identity and collision matrix

| Input | Disposition | Identity-only publication |
|---|---|---|
| Unique canonical accepted UUID | Eligible-planned | Same UUID if unreserved; exact alias |
| Unique accepted noncanonical ID | Exact-alias-required | New canonical UUID; original exact alias |
| ID-less parent/Step, valid owner/evidence | ID-allocation-required | Unique UUID per captured occurrence; no invented legacy alias |
| Same-title/identical-looking different positions | Separate occurrences | Distinct UUIDs; never title-merged |
| Duplicate parents / parent-Step / Step-Step | Ambiguous-identity | All colliding UUID targets null; grouped quarantine/ambiguous alias |
| Live/deleted/retired canonical reservation | Ambiguous-identity with RESERVED_IDENTITY reason | No reuse; unavailable alias and retained reservation |
| Cross-owner/shared/private/outside collision | Same global ambiguity | No workspace-local winner; private candidates retained locally |
| Invalid identity/source structure | Invalid-source-identity / unsupported-semantic | No unsafe identity; original source and reason retained |
| Unresolved/conflicting owner | Unresolved-owner-context | No unsafe allocation; owner evidence retained |
| Unresolved folder / deferred date/recurrence/History/Oath semantics | Unresolved-owner-context / unsupported-semantic | UUID may be planned if identity is safe, but alias is unavailable and record quarantined |
| Changed source/owner/ledger or repeated source lineage | Explicit conflict | No replacement allocation or changed original plan |

Primary disposition counts partition captured occurrences exactly once. Diagnostic dimensions overlap intentionally: an alias case may also have a planned UUID and quarantine. Quarantined/planned records are never reported as migrated tasks. Original ordered source/evidence/private JSON remains retained; current review arrays are empty and no automatic resolution operation exists.

## Publication, durability and concurrency

Memory uses a reusable backing object with exclusive lease, state validation and serialized execution. Directory storage is restricted to explicitly supplied existing ordinary OS Temp subdirectories. It writes/flushes/verifies an immutable complete generation and atomically replaces a checksummed pointer. **Pointer rename is the commit boundary.** Alias, reservation, quarantine, plan-status and receipt changes reside in one coherent generation.

Receipts store stable operation ID, canonical payload/digest, committed revision and exact original result/digest. Same operation/payload replays before revision checks; changed payload conflicts. One receipt is required per revision. Reserved publication operation IDs cannot be consumed by another command. Missing/corrupt receipts do not cause allocation or fallback to an empty store.

| Injected boundary | Verified outcome |
|---|---|
| Before plan persistence / after candidate staging / evidence serialization | No committed plan/reservation/receipt change |
| Alias/reservation/quarantine candidate publication | Previous whole state remains visible until commit |
| Receipt persistence / before commit | No successful half-state or new receipt |
| Partial generation write / flush / generation publication | Old pointer remains authoritative; staged/orphan evidence retained |
| Partial pointer write / flush / before rename | Old complete snapshot; no staged alias exposure |
| After pointer rename / directory sync / durable commit / before acknowledgement | Complete new snapshot; original receipt/UUIDs recoverable on retry |
| Recovery interruption | Explicit failure, existing valid snapshot retained |
| Missing/corrupt JSON/pointer/generation/receipt, invalid reservations/aliases/quarantine/version/owner | No-write failed reopen; evidence retained, no empty initialization |

Concurrency tests cover two identical prepare/publish calls, changed/stale plans from one revision, competing accepted aliases, readers during candidate publication, a queued retry after committed acknowledgement loss, and reopen afterward. One whole committed result is visible; stale/conflicting work cannot allocate a second target.

**Nine child-process crash stages** test partial generation/pointer staging, pre-pointer publication and post-commit/pre-reply restart. An abandoned lock blocks ordinary open. Explicit recovery requires exact inspected lock bytes, recognized format, same-host PID proven dead and affirmative disposable review; it renames the lock into retained evidence. There is no automatic timeout/removal. Tests preserve orphan/staged files; no corrupt pointer/receipt is “repaired” by guessing a generation.

Guarantees are for serialized single-writer operation on tested local disposable storage with cooperating advisory leases. Directory fsync is best effort; universal power-loss/cloud-filesystem durability, distributed/multi-device transactions, hostile external writers and a production N2 host are unproven. A cached snapshot after storage acknowledgement loss can remain the preceding coherent state until reopen/next validated operation. There is no automatic coordination with a separately changing task repository; external reservations are a supplied captured inventory.

## Privacy and no task effects

Both Itacan and Obsidian Hub are represented as shared Projects; all four Resources use study/literature/references/inspiration and remain private. Physical ownership is checked against declared roots; mounts/presentation cannot transfer it. Folder context is source-parent-folder evidence, not note association or an implemented N2 registry.

All ledger/snapshot/quarantine/receipt/source evidence is local/private. Recognizable Resource/private Project/local path/History/Oath sentinels remain inside private records. `publicProjection()` rejects without returning evidence; no alias/Git/public export path exists. Generic planning state has no task/Step/History/binding/Oath/mount collections, and no operation calls native task commands or real source writers. Existing production serializers and transport remain unchanged.

## Executed verification

All suites used explicit file lists and the OS Temp filesystem guard; archived tests were not discovered. Node is VS Code Electron-as-Node 24.21.0, timezone Europe/Stockholm. Existing TypeScript 6.0.3 was used without dependency installation.

| Check | Result | Archived log prefix |
|---|---|---|
| New N1-B identity/recovery suite, 2 files | **158 passed**, zero skipped | identity-final |
| N1-A 147 frozen vectors + 11 checks | **158 passed**, original JSON unchanged | n1a-compatibility |
| N0 read/readiness | **51 passed** | n0-read |
| Legacy facade/consumer-focused, 24 files | **452 passed** | focused |
| Existing regression files | **34 passed** file-level suites with internal assertions | regression |
| Safe Strict/recovery, 5 files | **48 passed** | safe-strict |
| Existing inactive native-core, 2 files | **66 passed** | inactive-core |
| Existing task-service/core type checks | **0 diagnostics each** | task-types, core-types |
| New identity declarations/runtime entry point check | **0 diagnostics** | identity-types |
| Initial/postflight read-only data health | **Passed**, unchanged hash/substates | preflight-health, postflight-health |
| Source build before/after | **Passed**, 168 main / 24 Atlas modules | source-build-before, source-build-after |

No production graph/UI change occurred; no new browser run was needed. Historical passes are not counted as current. Inherited divider-alignment and standalone History heading-icon failures remain untouched. No production polling/scan/cache/performance behavior changed.

## Safety, source/build state and file inventory

Fresh baseline: **1,125 files**, including **327 Markdown files**, **25 existing native-core files** and **374** preexisting Git status entries. Baseline and a source allowlist were recorded before edits; one declaration re-export path was added through a recorded pre-creation allowlist amendment. All **15 deliverables are new**, so existing files changed/backups needed: **zero**. N0's 16 and N1-A's seven reviewed outputs match their archives; all prior archive entries verify (N0 118, N1-A 83, consolidated audit 53).

**1,124 non-workspace baseline files remain byte-identical.** Plugin data/metadata/History/checks/Oath/device/Strict, Project/Resource/mount/planning/Daily Brief state, shared state, Markdown/progress records, installed assets and original native core remain unchanged. Read-only health remains healthy: 174 History rows, zero projection diagnostics, seven Projects/four Resources/two shared Projects; one inherited stale-project-card-order audit warning remains unmodified. Historical U3 writer attribution is not reconstructed or claimed.

Protected data hash: `CAB5DC6C82E77D3719AEAB33B92A4B31F5DE89258974F1AC9910E9455A94F9AA`.

Shared state hash: `5E553775898003A2111BEA1C11BAB336A3DC863941AED9C25056320BA7ECB506`.

Frozen N1-A JSON: `17DE517A3CCF3D8178A0647EB8F434565779491783BEA2A9EC4B5C66002D5080`.

Installed main: `318CD234980489C514E1C1085DF2D95FEBFEF64284D0293BC566493B4B28DB20`.

Staged before/after main: `29635B7632218BDDA551E23358C1C393E300E8990D92D41F454741B240ADD9C7`.

The staged/installed distinction is intentional. Every staged asset before/after is compared; no production factories were changed/added/removed. No installed bundle or Strict/Oath auxiliary asset was replaced. No Obsidian reload/restart/toggle occurred.

Workspace exception: `.obsidian/workspace.json` baseline was `C055F251D8097B59962A7E984EEB31E44043A57E266AAA7352C3FB3ABB170191`; an intermediate observation was `D43B42F451831734F42CEF164AD75C4A8EABE0673BA512D17579259CB01B3098`. Final hash/time is recorded separately in safety-final. The independent writer process was not identified; guarded checks cannot write that path. No workspace or old data snapshot was restored.

Exact new paths:

- `ItacanTaskCore/identity/domain.js`
- `ItacanTaskCore/identity/repository.js`
- `ItacanTaskCore/identity/node-store.js`
- `ItacanTaskCore/identity/contracts.d.ts`
- `ItacanTaskCore/identity/repository.d.ts`
- `ItacanTaskCore/identity/node-store.d.ts`
- `ItacanTaskCore/identity/README.md`
- `ItacanTaskCore/identity/tests/support.cjs`
- `ItacanTaskCore/identity/tests/identity.test.cjs`
- `ItacanTaskCore/identity/tests/persistence.test.cjs`
- `ItacanTaskCore/identity/tests/crash-child.cjs`
- `ItacanTaskCore/identity/tests/types.fixture.ts`
- `ItacanTaskCore/identity/tests/typecheck.cjs`
- `.obsidian/plugins/hub-project-menu/lib/tests/native-identity-plan-verification.md`
- `.obsidian/plugins/hub-project-menu/lib/services/TASK-SERVICE-PHASE-N1-C.md`

Evidence/request/build copies stay in the named backup and disposable Temp directory. Exact file hashes, native-core/Markdown aggregates and zero unexpected new Git paths are recorded in final safety evidence. Real-vault native storage/migration/alias/quarantine/receipt/lock/pointer artifacts created: **zero**. The new source and backup files are not live storage. No Git reset/clean/rebase/commit or unrelated replacement occurred.

If reversal is later requested, compare current files against N1-B final hashes and remove only these 15 outputs if no subsequent edits occurred. Preserve evidence; never restore a repository, old Markdown/data/History/Oath or an independently changed workspace.

## Deferred semantics and next review

Unsupported: reviewed source-plan rebasing, resolution/retarget operations, full D06 content schema/native editing/Search parity, new Step mutation contracts, date normalization/grandfathering, recurrence/series lineage, current binding/History import/counting, production Oath aliases, public alias transport, live inventory/registry coordination and authority activation.

**Ready for N1-C after explicit approval of its Step/content policies and exact inactive scope.** The handoff identifies D05/D06 decisions and preserves later date/recurrence/History/Oath gates. N1-B establishes identity planning, not successful migration or native backend readiness. N1-C was not started. **STOP FOR REVIEW AFTER N1-B.**
