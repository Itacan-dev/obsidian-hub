# N4 production integration verification ? candidate withheld

Status on 2026-10-23: implemented source candidate, staged and tested in disposable environments. **Not installed. Neither real shared Project was activated.** The nine existing native owners were not opened or changed by this execution.

## Implemented

- Production Git admission binds registered vault/device/Project, unique physical dashboard, actual Git root, committed namespace, shared genesis, capabilities and separate device-local runtime authority. Different physical working-copy paths can bind the same portable Project. Duplicate identities, changed namespace commitments, arbitrary roots and cross-Project authorities reject.
- Git-only reservation witness v2 is salted by the Project-specific authority. The production supplier captures actual persisted application task metadata, History/check references, Project planning, Inbox and Oath references without rewriting them. It compares disk and memory and pins observed Phase presence/content. Required missing or malformed source collections reject. The writer re-captures raw authoritative evidence at preparation, admission and final publication; a well-formed hash is insufficient. Replay admission checks original inventory/Phase pins even after restart with a new policy.
- Original reservation values remain local. Portable membership hashes preserve identity exclusion. Phase metadata is neither discarded nor exported as private content; Phase task mutation remains unsupported. Existing private/Resource inventory interpretation is unchanged.
- Retention marker v2 admits exact UI requests and versioned Git receive requests through the existing owned request files/lease. Original operation, command, packet, guards and digests survive reconstruction. Native receipts remain the only task-outcome authority. Missing/conflicting evidence requires original operator review; no automatic replay or replacement identity is introduced.
- The existing Project runtime now supports Git partitions, retained receive/recovery and the existing consumer UI. Startup scans packets, publishes committed-but-unexported evidence, and processes incoming data through the real writer. File notifications are coalesced. An existing recovery action shows owner-specific status and processes Git changes. `local-published` explicitly does not claim another client received the data.
- Outgoing packets are flushed in device-local Temp and exclusively linked into Git: death before publication leaves no partial target; death after publication leaves a complete immutable packet. Restart can republish the same evidence. This requires hard-link support and a common filesystem for staging and Git; unsupported configurations fail without a non-atomic fallback. No Git commit/pull/push is performed by runtime transport.
- A bounded per-storage verified-generation reuse compares freshly read bytes, descriptor, authority and store before returning a detached copy. Corrupt bytes still reject. No global origin-proof cache or materialization rewrite was introduced.

Native generation, receipt, command and recovery formats/semantics are unchanged. Host retention/activation and the nested Git-only inventory witness are explicitly versioned. No History calculations changed.

## Verification actually run

| Selection | Result |
|---|---|
| Combined focused N4/host/writer/startup selection | 120 passed |
| Final inventory/restart-pin, writer and runtime selection | 16 passed (includes overlaps above; inventory file now has 8 cases) |
| Actual production inventory-source checks | 3 passed |
| Outgoing publication process deaths before/after link | 2 passed |
| Existing receive death plus retained permitted-replay death | 2 actual receive deaths passed; 5 checks in that selection |
| Additional existing Project controller/recovery selection | 28 passed; overlaps with other files are not added to a grand total |
| Affected declaration runners | 7 passed, zero diagnostics |
| Exact staged review candidate, genuine Obsidian actual plugin lifecycle | 11 checks passed |
| Existing nine-owner genuine Obsidian graceful-quit fixture | 3 checks passed; all nine test locks released |

The actual runtime two-working-copy Git test passes creation, edit in both directions, stable task/Step UUIDs, committed-but-unpublished restart, no-op repetition and reconstruction. Existing divergence/provenance/History/Statistics vectors pass. The application rehearsal mounts both real Project configurations through actual onload, Add/Edit, Home, Schedule Overview/Week/Month/calendar creation, History, Statistics, recovery and unload/reopen. This is **not** two simultaneously running full application clients exchanging Git state; that full requirement remains unverified.

Raw corrected failures remain preserved: a reconstructed receive initially omitted the required operator review; the export-death fixture initially compared Windows short and canonical paths and omitted guaranteed child cleanup. Fixtures were corrected, not production safety assertions. Only their independently identified disposable child processes/locks were recovered. Frozen historical fixtures were not weakened. The original N4 gate's 448 checks are predecessor evidence, not claimed as rerun here.

## Measured blocker

Diagnostic samples, not pooled latency medians/p95:

| Population | Portable bytes | Observation |
|---|---:|---|
| 60 tasks / 120 Steps / 60 origins | 3,879,003 | Complete domain/receipt validation 12,781.6 ms; native origin replay 358.5 ms; serialization 46.1 ms |
| 250 tasks / 500 Steps / 250 origins | 61,275,580 | Complete validation did not return before the owned probe was stopped at 305.4 CPU seconds |
| 500 tasks / 1,000 Steps / 500 origins | 241,296,830 | Exceeds unchanged 64 MiB packet/transport bound |

The large size-only probes construct effects using actual commands/publication code. They were not accepted as validated repositories; no large-population correctness or latency-pass claim is made. The 60-task sample completed full validation. Large samples contain creations, not additional edits/completions; those would add more origin evidence.

The immutable frames retain a complete post-publication view. Complete receipt/content validation repeatedly reconstructs that graph. On the predecessor 24-frame fixture, one before/after diagnostic showed export 2,415?513 ms, task read 2,234?892 ms, no-op receive 1,609?1,127 ms, while reopening stayed about 1,470 ms and discovery worsened 569?1,168 ms. These single samples establish neither reliable percent improvements nor production responsiveness. The private verified-generation reuse does not fix cold validation or the packet-size limit.

**Installation is withheld.** The required 500-task sharing case cannot fit the current protocol bound, and 250-task cold validation is not practical. Raising bounds or omitting proofs is not a correction. The previously rejected structural graph/materialization rewrite remains excluded as instructed. A separately reviewed bounded proof representation/validation change is needed before claiming production readiness; no new implementation of that change was attempted.

## Real state / cutover boundary

- Read-only refreshed inventory: Itacan `4b597e3b-b588-4a29-969b-70db3a684112`: 57 meaningful tasks, zero Steps, one ambiguous empty row, three candidate Markdown sources. Obsidian Hub `9325047c-eb3d-43e7-92f2-a9bf630afe13`: two meaningful tasks, zero Steps, two candidate sources (including non-active/literal candidates). No task content is included here.
- Both currently resolve to the Work Git root. No real namespace, packet, commit, push, retirement, activation or new real archive was written. Earlier archives/backups remain unchanged.
- Required coordinated baseline: upgrade each writing client to compatible packet2/frame1/witness2 and retention2 support; agree one committed namespace/genesis per Project; exchange those exact files and the reviewed checkbox retirements; stop old clients/source writers; verify each device-local activation binds that namespace before native writes. Old clients must not keep creating Markdown tasks. A Git merge alone is not native reconciliation.
- Actual collaborator installation/approval and the agreed shared Git baseline are unverified. The new activation loader is implemented, but the final shared cutover executor/complete coordinated real procedure has not been acceptance-tested. Neither shared owner is ready to cut over.
- Existing state remains **nine native owners, two Legacy owners**. No automatic task/History import or recreation occurred. Existing 182 Legacy History records remain byte-preserved in unchanged application data.

## Build and protection

Baseline staged graph: 239 factories. Candidate: 246 (seven explicitly related Git modules added; none removed). Thirteen related factories differ; plugin.js startup factory is unchanged. The other eleven staged installed assets are identical. Exact delta is `build-comparison.json` in the audit below.

All 115 protected baseline hashes match, including all twelve installed assets, application data, selected Markdown and existing native authority evidence. Existing dirty Git state was preserved; no reset, clean, checkout/restore or real commit was performed. Installed main.js remains `f863129c004dfcb73f7d8bc7f2e78593207fafca388106f1ee436857503220a5`. The review candidate stays in Temp. No ordinary everyday-app installation/restart verification is claimed for this candidate.

## Exact file inventory

Existing source/declarations/harness files changed:

- `.obsidian/plugins/hub-project-menu/lib/services/native-task-activation.js`
- `.obsidian/plugins/hub-project-menu/lib/services/native-task-host.js`
- `.obsidian/plugins/hub-project-menu/lib/ui/native-task-recovery.js`
- `ItacanTaskCore/host/authority.js`
- `ItacanTaskCore/host/index.d.ts`
- `ItacanTaskCore/host/pending-requests.d.ts`
- `ItacanTaskCore/host/pending-requests.js`
- `ItacanTaskCore/host/repository-host.js`
- `ItacanTaskCore/integration/project-runtime.d.ts`
- `ItacanTaskCore/integration/project-runtime.js`
- `ItacanTaskCore/integration/tests/obsidian-host.cjs`
- `ItacanTaskCore/integration/tests/run-obsidian.cjs`
- `ItacanTaskCore/shared/git-transport.js`
- `ItacanTaskCore/shared/tests/crash-worker.cjs`
- `ItacanTaskCore/shared/tests/types.fixture.ts`
- `ItacanTaskCore/src/atomic-task.js`
- `ItacanTaskCore/src/git-shared.d.ts`
- `ItacanTaskCore/src/git-shared.js`
- `ItacanTaskCore/src/json-repository.js`
- `ItacanTaskCore/src/repository.js`
- `ItacanTaskCore/writer/index.d.ts`
- `ItacanTaskCore/writer/policy.js`
- `ItacanTaskCore/writer/repository-writer.js`

New source/declarations/tests:

- `.obsidian/plugins/hub-project-menu/lib/services/native-git-activation.js`
- `.obsidian/plugins/hub-project-menu/lib/services/native-git-inventory.js`
- `ItacanTaskCore/host/git-authority.d.ts`
- `ItacanTaskCore/host/git-authority.js`
- `ItacanTaskCore/integration/tests/git-production-obsidian.cjs`
- `ItacanTaskCore/shared/inventory.d.ts`
- `ItacanTaskCore/shared/inventory.js`
- `ItacanTaskCore/shared/project-binding.d.ts`
- `ItacanTaskCore/shared/project-binding.js`
- `ItacanTaskCore/shared/runtime-sync.d.ts`
- `ItacanTaskCore/shared/runtime-sync.js`
- `ItacanTaskCore/shared/tests/export-crash-worker.cjs`
- `ItacanTaskCore/shared/tests/export-interruption.test.cjs`
- `ItacanTaskCore/shared/tests/production-admission.test.cjs`
- `ItacanTaskCore/shared/tests/production-cache.test.cjs`
- `ItacanTaskCore/shared/tests/production-inventory-source.test.cjs`
- `ItacanTaskCore/shared/tests/production-inventory.test.cjs`
- `ItacanTaskCore/shared/tests/production-retention.test.cjs`
- `ItacanTaskCore/shared/tests/production-runtime.test.cjs`
- `ItacanTaskCore/shared/tests/project-binding.test.cjs`

Documentation: this report and CHECKPOINT.md; README.md links this current gate. The predecessor VERIFICATION.md remains the record of the completed core gate.

Evidence: `C:/Users/EL_BAR~1/AppData/Local/Temp/itacan-n4-production-7w9clmrd`. It contains exact protected/source baselines, unique raw run outputs/failures, source inventory, build comparisons, performance probes, read-only real inventory and process/death records. Last review-candidate genuine Obsidian result: `review-obsidian.stdout`. No large verification archive was created.
