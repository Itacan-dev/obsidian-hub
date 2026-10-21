# N1-A verification and completion report

2026-10-17. **N1-A complete; STOP FOR REVIEW.** [Specification](native-migration-compatibility-spec.md), [vectors](native-migration-compatibility-v1.json), [decision sheet](../services/TASK-SERVICE-N1-DECISIONS.md), [N1-B handoff](../services/TASK-SERVICE-PHASE-N1-B.md).

Durable evidence: [N1-A archive](../../../../../System/Backups/itacan-n1a-20261017-bf63b5c6/). Its `evidence-inventory.json` lists exact SHA-256 values, excluding itself; archive copies are checked against their originals and then against that manifest. `baseline.json`, `evidence/safety-final.json`, the capture segments, scripts/logs and seven `reviewed-source` outputs support this report. No existing file was edited, so fresh original-file backups required: **zero**. The new-file allowlist was recorded before creating the seven outputs.

## Fresh safety baseline and inherited state

Initial observation was recorded at `2026-10-17T10:18:24.8121975Z`. The later pre-edit exhaustive baseline includes **1,118 files**: Git cached/untracked nonignored files, all Markdown including ignored notes except `.git`/trash/node_modules/backups, explicit installed plugin data/workspace/shared state and installed Tasks manifest/main. No real note content is embedded in the synthetic dataset. The baseline records exact file hashes, lengths and modification times, plus **367** preexisting entries from `git status --short --untracked-files=all`. Those entries remain unchanged; historical summaries using other status counts are not substituted for this fresh baseline.

**1,117 non-workspace baseline files remain byte-identical.** No missing or unexpected protected-file changes were found. The 16 current N0 reviewed outputs still match their archived SHA-256 values. All **118** N0 archive files and **53** consolidated-audit archive files verify unchanged against their original manifests. Existing dirty/untracked work, prior source and audit reports were preserved. No Git reset/clean/rebase/commit occurred.

Read-only health passed before and after checks: JSON/schema/revision structure, existing pure normalizer on a disposable receiver, pure audit on a clone, recorded History projection and Statistics-relevant fields, seven registered Projects, four Resources and both shared Projects. There are 174 recorded History rows and no projection diagnostics. The inherited one `stale-project-card-order` audit issue remains unchanged; no repair was applied.

Protected `data.json` remained:

`CAB5DC6C82E77D3719AEAB33B92A4B31F5DE89258974F1AC9910E9455A94F9AA`

Shared Project state remained:

`5E553775898003A2111BEA1C11BAB336A3DC863941AED9C25056320BA7ECB506`

Task metadata, completed History/checks, Oath/device/Strict container, Resource folders/mount definitions, workspace-mode data, Daily Brief snapshot and Project planning substate hashes remain equal in initial/postflight health. Progress reports, Markdown and installed assets remain covered by the unchanged-file comparison. No obsolete U3 snapshot was restored. The prior unidentified U3 data writer and unavailable exact historical private-field delta remain explicitly unresolved; healthy current data is not proof of that earlier writer's identity.

**Workspace exception:** initial observation `.obsidian/workspace.json` hash was `5D63D56D26BC2D62EA45FEF4727A9B37ABA02D0D2B5EA99F70AF0F2A3D41C864`. By the exhaustive baseline it was `27213417EB654A97BE371FB6FA949931ED0F021DEC352609E8913028C1427B2F`; the review comparison recorded `52DADDEB2E2C8ABA0BE6EFACD449543F7092423905FF2BD2B08E292DC3E6EDAE`. The independent writer process was not observed. Guarded checks cannot write this path, and the initial change already occurred before compatibility capture. Workspace drift is disclosed, not called unchanged, attributed to a particular process, or restored. Final observed hash/time is recorded in `safety-final.json`.

## Isolation and provenance

Checks run through VS Code Electron-as-Node 24.21.0, Europe/Stockholm, with an explicitly loaded filesystem guard. The guard canonicalizes existing ancestors/Temp aliases and rejects fs/fs.promises mutations and writing opens outside OS Temp, including symlink escape. Capture scripts only write their explicitly disposable Temp output. Authorized creation/review of the seven deliverable files and copying evidence to the allowlisted archive are separate editing operations. No runtime probe writes the workspace.

Legacy functions execute against synthetic strings/arrays or Map-backed Obsidian stubs; plugin source is compiled without `onload`. Oath enrollment uses the existing **scheduled** fixture, fake fullscreen and deterministic injected IDs; no real Standard/Strict Oath starts. New native probes use actual `MemoryStorage` only. Existing core persistence tests use their own guarded disposable OS Temp stores/child processes, never a vault repository. Safe Strict tests use fake adapters/transports and do not launch real enforcement.

The first capture froze 130 observations. Subsequent separately frozen segments add 13 content/date and four lineage cases. Segment hashes are retained in the dataset/archive. Review scripts update proposal labels and source/function references separately, and the deliverable check verifies all **147** original input/output pairs against their frozen segments. No old observation was recaptured to fit a recommendation. A later hand-written invariant initially used the Notice text from the editor path instead of the actual toggle path; the assertion was corrected against the already frozen toggle output (`The task changed, but its History could not be saved.`). The captured data and production code did not change. The final run passes all invariants.

The dataset SHA-256 is:

`17DE517A3CCF3D8178A0647EB8F434565779491783BEA2A9EC4B5C66002D5080`

Source hashes, operation inputs, raw output/rejections, source/function references, decision IDs and unverified/unsupported boundaries are recorded separately. Proposed dispositions and mapping are not executed. A passing “unsupported” case never means that missing capability passed a parity test.

## Coverage and findings

| Vector category | Cases |
|---|---:|
| Identity, global collisions and ID-less locators | 20 |
| Project/Resource owner, context and Phase | 14 |
| Nested Steps, order, validation and cascade | 12 |
| Markdown/source/description fidelity | 17 |
| Dates, Necessity, DST and sorting | 23 |
| Recurrence transport and unverified engine boundaries | 8 |
| Completion, raw History, archive/clear and count lineage | 21 |
| Committed Oath and both awaitingIndex histories | 20 |
| Both shared Projects/private/all Resources | 7 |
| Receipt retry, fault, restart and reservation | 5 |
| **Total** | **147** |

Established rules confirmed: one physical owner; all four Resource IDs; folder context independent of source-note provenance; private Resource mounts; both shared Projects; Step ancestry/independent completion; separate explicit description; local date/time precision and null uncertainty; raw historical attribution/ID types/order; exact Statistics dedup/ranges; All time UI default; Oath authoritative IDs and both delayed-index histories.

Reproduced mismatches/gaps: accepted non-UUID/uppercase legacy IDs versus native canonical IDs; absent IDs and global reservation requirements; nested draft edit gaps; loss of EOL/source meaning in title/description-only conversion; reversed same-day clocks; absent native recurrence; legacy removal versus native retention of reopened events; source committed with failed History save; native completed create plus historical-only append yielding **two counted events**; unsupported native legacy Oath aliases; private provenance excluded from native export. Details and alternatives are in the 18-decision sheet.

Unverified: full configured Tasks 8.4.0 recurrence output, Hub-ID carryover/allocation, next-occurrence Step reassociation and full date/History behavior; future migration-plan durability; native alias portability; lossless native edits/Search parity; imported current completion binding/Statistics parity; production native consumer routing/recovery. Installed third-party source branches were inspected, but controlled callbacks do not establish engine parity.

## Executed checks

Each suite used an explicit file list, not recursive `node --test` discovery. Launch scripts and full output/error logs are archived.

| Check | Result | Evidence log |
|---|---|---|
| New compatibility vectors + format/invariant checks | **158 passed** (147 vectors + 11 checks), zero skipped | compatibility-final |
| Existing facade/consumer focused tests, 24 files | **452 passed** | focused |
| Existing domain/writer/integration regression files | **34 passed** file-level suites with internal assertions | regression |
| Existing N0 read contract/policy/lifecycle | **51 passed** | n0-read |
| Existing safe Strict adapter/recovery tests, 5 files | **48 passed** | safe-strict |
| Existing inactive core memory/JSON/persistence/fault tests, 2 files | **66 passed** | inactive-core |
| Task-service and core types, existing TypeScript 6.0.3 | **0 diagnostics each** | task-types, core-types |
| Read-only initial/postflight data health | **Passed**, same protected hash/substates | preflight-health, postflight-health |
| Source build to OS Temp | **Passed**, 168 main / 24 Atlas modules | source-build |

No new browser run was needed: no production module, consumer markup or writer changed. Prior N0 Search 21, History 79 and Oath 88 browser assertions remain historical evidence, not new passes. Inherited two task-workspace divider fixtures and standalone History heading-icon failure remain untouched; later unexecuted assertions are not counted. No runtime polling/cache/scan/notification changes were added, so there is no new production performance claim or benchmark threshold.

## Source/build/installation and exact outputs

Staged main hash matches N0 exactly:

`29635B7632218BDDA551E23358C1C393E300E8990D92D41F454741B240ADD9C7`

Installed main remains:

`318CD234980489C514E1C1085DF2D95FEBFEF64284D0293BC566493B4B28DB20`

No bundle was installed; no Obsidian restart/reload/toggle occurred. No native domain/declaration/command/service/startup file was changed, native storage initialized in the vault, authority switched, task/source/metadata/History/Oath writer migrated, commitment rewritten or Git transport added. No real note, History/Oath/Strict data, Resource mount/definition, Daily Brief record, progress report or shared state was written.

Exactly **seven new files**, all below `.obsidian/plugins/hub-project-menu/`:

- `lib/tests/native-migration-compatibility-v1.json`
- `lib/tests/native-migration-compatibility-probes.cjs`
- `lib/tests/native-migration-compatibility.test.cjs`
- `lib/tests/native-migration-compatibility-spec.md`
- `lib/tests/native-migration-compatibility-verification.md`
- `lib/services/TASK-SERVICE-N1-DECISIONS.md`
- `lib/services/TASK-SERVICE-PHASE-N1-B.md`

Evidence/build/request copies are confined to the named backup and disposable Temp directory. For reversal later, verify current hashes against this archive and remove only these seven N1-A outputs if no subsequent edits occurred. Do not restore old user data/workspace or an entire tree. Preserve evidence unless separately authorized to remove it.

## Readiness verdict and review gate

**Ready for a limited N1-B subset; other decisions remain deferred.** Before inactive identity-plan/alias/quarantine implementation, approve D01 exact aliases, D02 allocate-once plans, D03 quarantine ambiguous copies, D17 versioned source-conflict/retry rules and D18 explicit lossless review dispositions. Source and commitments would remain unchanged; private evidence stays private. These decisions cannot be silently deferred inside a ledger implementation.

Step/content handling, reversed-date compatibility, recurrence/occurrence semantics, completion binding/counting/History import and Oath alias routing remain later decisions; deferral is safe only while those imports/features remain inactive/unsupported. Exact recurrence behavior still requires evidence. The handoff preserves the proposed N1-B/C/D/E/F order while applying privacy/version constraints at N1-B, not waiting until export.

**N1-B was not started. No automatic continuation, migration, installation or activation. STOP FOR REVIEW AFTER N1-A.**
