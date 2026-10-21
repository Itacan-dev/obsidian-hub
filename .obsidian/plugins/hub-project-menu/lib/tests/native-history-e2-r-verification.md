# N1-E2-R verification

Status: implementation verification complete; awaiting user review. Concurrent protected JSON drift is explicitly recorded below. This report concerns the inactive storage repair, not production migration or activation.

The existing E2 candidate is preserved. The original stopped archive remains `System/Backups/itacan-n1e2-20261018-8d875302/`, with 120/124 persistence checks and its four blocking observations intact. The new actual-reader checks retain the original `UNSUPPORTED_SCHEMA` assertions; frozen reader bytes and earlier reports are unchanged.

The repair uses an explicitly selected private-v4 authority, wire version 4 from the initial empty commit, and unchanged logical schemas. Stopped flat schema-4 stores reject every mutation at admission/reload/commit, including ordinary task/Step/completion/recurrence attempts, retained handles and pointer rewind with surviving schema-4 evidence. Forensic inspection exposes no writer. Missing/empty/invalid/mixed roots, wrong authorities and substituted storage ports fail closed; opening never creates a replacement repository.

CURRENT remains the sole publication authority. RECOVERY names committed state and mirrors committed scope before acknowledgement; failures after publication are acknowledgement loss. Both verified pointers preserve the highest known barrier. Existing markers are never cleared or replaced to restore writability. Unprovable scope blocks normal opening; verified scope supports only independent work while import/binding changes remain fenced.

## Baseline and preservation

The completed sequential baseline contains 2,632 files and 485 Git entries. The stopped archive's 2,037 files, 24 current candidate files and nine pre-E2 originals were verified. Nine current originals were preserved before source edits. The planned JSON declaration file already existed, so it is an original rather than a new output; the responsibility is unchanged. The repair permits nine existing files and eight new outputs.

Pre-existing changes since E2 affected `.obsidian/workspace.json` and plugin `data.json`; they were recorded before implementation and not restored. Fresh plugin-data SHA256 is `92D745759F920DC6F9DA3BC1F0E3113CAFA38E035EE16ECD70CF68DFB80E156F`, retaining 174 History rows and two checks. Earlier source/report hashes use the final sealed reviewed-source inventory, avoiding classification of E2's final report append as user drift.

## Attempts and evidence discipline

All attempt logs are retained. The first repair run found two fault-fixture stages that did not require a write, a missing reference resolver in a portable specimen, and a missing expected revision in a synthetic recurrence command. Those fixtures were corrected without weakening an earlier assertion. A B2 unknown-store test exposed an error classification regression; malformed unsupported state is now validated before the valid-flat-format write prohibition.

Automatic approval review rejected a broad proposal to ignore unreadable orphan generations. That proposal was not applied. The accepted narrower path requires a verified authority-matched saved CURRENT manifest to identify retained historical corruption; unexplained unreadable files remain blocking and have their own negative test.

Every formal run stores command/explicit file list, raw stdout/stderr, scalar exit code, timing and TAP summary immediately. Runner exit and test exit are separate. Earlier helper-run raw logs and their tool-observed failures are retained as attempts, not acceptance evidence.

## Boundaries

No old repository was converted, no real History was imported, no production Task Service/Statistics/Oath/Strict/Git authority changed, and nothing was installed or reloaded. Tests use guarded synthetic memory/OS Temp, actual frozen readers, controlled clocks/identities and verified dead-child lock evidence. The implementation adds no journal or second dispatcher.

The report claims only tested cooperative local persistence/process interruption. It does not claim power-loss, OneDrive/cloud rollback, hostile-writer, distributed uniqueness, complete-directory rollback detection or atomic N1-B consumption. Later real-store authority coordination and N1-F remain separately gated.


## Final awaited acceptance inventory

| Run | Tests | Pass | Fail | Exit |
| --- | ---: | ---: | ---: | ---: |
| sealed-accept-repair | 102 | 102 | 0 | 0 |
| sealed-accept-e2-persistence | 124 | 124 | 0 | 0 |
| sealed-accept-e2-behavior | 43 | 43 | 0 | 0 |
| sealed-accept-e2-statistics | 53 | 53 | 0 | 0 |
| sealed-accept-e1-frozen | 138 | 138 | 0 | 0 |
| sealed-accept-e1-current | 137 | 137 | 0 | 0 |
| sealed-accept-b2 | 189 | 189 | 0 | 0 |
| sealed-accept-b1 | 207 | 207 | 0 | 0 |
| sealed-accept-b0 | 22 | 22 | 0 | 0 |
| sealed-accept-gateA | 145 | 145 | 0 | 0 |
| sealed-accept-stepContent | 180 | 180 | 0 | 0 |
| sealed-accept-identity | 158 | 158 | 0 | 0 |
| sealed-accept-compatibility | 158 | 158 | 0 | 0 |
| sealed-accept-readiness | 51 | 51 | 0 | 0 |
| sealed-accept-core | 66 | 66 | 0 | 0 |
| sealed-accept-focused | 452 | 452 | 0 | 0 |
| sealed-accept-regression | 34 | 34 | 0 | 0 |
| sealed-accept-safeStrict | 48 | 48 | 0 | 0 |
| sealed-accept-declaration-0 |  |  |  | 0 |
| sealed-accept-declaration-1 |  |  |  | 0 |
| sealed-accept-declaration-2 |  |  |  | 0 |
| sealed-accept-declaration-3 |  |  |  | 0 |
| sealed-accept-declaration-4 |  |  |  | 0 |
| sealed-accept-declaration-5 |  |  |  | 0 |
| sealed-accept-declaration-6 |  |  |  | 0 |
| sealed-accept-declaration-7 |  |  |  | 0 |
| sealed-accept-declaration-8 |  |  |  | 0 |
| sealed-accept-declaration-9 |  |  |  | 0 |
| sealed-source-build-after |  |  |  | 0 |
| sealed-postflight-health |  |  |  | 0 |

All 30 final inventory/build/health child processes were awaited and returned zero. E2 persistence is now 124/124, including the four original assertions. E2 behavior is 43/43 and Statistics 53/53. Repair checks are 102/102. Every prior inventory retains its required count, and all nine earlier declaration checks plus the new repair check pass with existing TypeScript 6.0.3. Initial failed attempts remain in the ledger; they are not acceptance evidence.

E1 distinction: all 138 unchanged assertions run on the preserved frozen graph. The current graph runs 137 behavioral assertions, excluding only its exact historical source-hash assertion; that assertion passes unchanged on the frozen graph. Current authorized hashes are independently recorded. All 47 Statistics vectors retain full-aggregate/failure parity across the three existing time zones; UI All time and internal3m defaults remain unchanged.

Actual-reader proof: the original schema-1/B1/B2 publication-manifest assertions return terminal UNSUPPORTED_SCHEMA. The original schema-1 lowered-manifest case also returns terminal UNSUPPORTED_SCHEMA after generation validation instead of opening its ancestor. All six existing reader cases pass; eighteen additional empty/prepared/published reader cases pass. Readers are actual frozen source closures materialized in OS Temp with per-file SHA256 checks; no mock or historical fixture rewrite is used.

Mandatory safeguards: every stopped-flat mutation category rejects before authority/publication. Tests include ordinary tasks, Steps, completion, structure, recurrence and both import commands; direct commit; active retained handles; corrupt or rewound pointers while flat4 generation evidence survives. Dedicated-root tests cover missing/empty/file/invalid/mixed/wrong-authority roots, unexplained damaged generations, nonempty creation and injected-port substitution. No opening path invokes creation or another-root search.

Interruption proof: 31 original fault-hook process exits remain separate from exception injection. Ten additional children are actually terminated by their parent. The archive preserves actual code/signal, requested signal, stage, PID/host/token, raw lock bytes, SHA256 and verified-dead status before moving the exact lock within the disposable root. Missing bootstrap authority fails closed; committed commands retry/replay without duplicate import/event/successor. Lost acknowledged preparation/publication, CURRENT corruption/rewind, scope retention, repeated restart, late/partial/checksum-invalid/version1 fences and independent allowed work pass.

## Protected-state and production comparison

Final source footprint: nine authorized existing changes and eight new outputs; 493 Git entries, retaining all 485 original entries. All nine originals verify against the completed pre-edit baseline. All 450 existing Markdown files, earlier reports/reader fixtures/frozen evidence, nonallowlisted native source and installed assets match their baseline. No native CURRENT/RECOVERY/generation/fence/lock artifacts exist outside backups.

All twelve final Temp-staged production assets are byte-identical to the pre-edit build. Main and Atlas remain168/24 factories, with one legacy Task Service construction, unchanged startup and no private import writer/codec in the production bundle. No bundle was installed or Obsidian restarted/reloaded.

The byte comparison found three concurrent drifts: .obsidian/workspace.json, Hub data.json and Manual Sorting data.json. Their writer was not identified. No repair command targets these paths; guarded mutable Node execution is restricted to OS Temp. They were preserved without restoration. The first protected comparison correctly stopped on those differences; the archive records them separately rather than declaring that comparison wholly identical.

The fresh plugin-data hash92D745759F920DC6F9DA3BC1F0E3113CAFA38E035EE16ECD70CF68DFB80E156F changed to4B65C6347412760DFA4C0896CD754F90E09A34EDA53DB22B82093E1827FD4F93. All eight audited substate hashes still match: task metadata, History, completion checks, Oath/Strict/device state, Resource folders, workspace mode, Daily Brief and planning. History remains174 rows/two checks, seven Projects/four Resources/two shared Projects, and the two inherited stale-card-order diagnostics. Full Hub byte identity is not claimed. The hash-only preimage outside those substates cannot establish an exact field-by-field delta or actor attribution.

Aside from those three recorded JSON drifts, 2,620 protected baseline files match. Earlier sealed archives were reverified after execution. Pre-existing differences before E2-R and concurrent differences during E2-R have separate records. No workspace/user-data snapshot was restored.

## Review boundary and sealed archive

Archive: `System/Backups/itacan-n1e2-r-20261018-cf140237/`. Its final evidence-inventory.json authenticates sealed-evidence.zip. That exact ZIP contains an internal per-file inventory sealing originals, reviewed sources, original request/execution-contract transcription, fresh baseline, stopped failure evidence/reader closure, frozen E1 graph, actual frozen-reader provenance, explicit test commands/logs/exits, crash/lock evidence, drift records, protected comparisons and staged assets. The earlier unpacked copy is retained as an unsealed failed attempt and is not authoritative evidence. The contract transcription is not a verbatim chat export; the complete reviewed plan remains in the conversation. Final reviewed-source hashes cover the report append separately from the earlier comparison scan.

Implementation verification is complete for the restricted inactive repair. User acceptance remains pending, with the recorded concurrent-data drift available for review. No flat repository was converted, no native production authority activated and no N1-F implementation begun. STOP FOR USER REVIEW.

Archive packaging note: verification caught removal of a three-byte UTF-8 BOM from a copied Markdown file on the vault backup path. Its other bytes exactly matched the Temp original; the writer was not identified. The failed file-level seal was preserved as an attempt. The final package is assembled and member-verified in OS Temp, copied as an inert ZIP, and verified again by its complete-file SHA256. No historical original or user-data file was restored. New repair documentation is written without a BOM to avoid that incidental transformation.
