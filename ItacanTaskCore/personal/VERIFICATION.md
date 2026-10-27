# Personal synchronization verification — 26 October 2026

## Disposition

Implemented and verified as an **inactive staged candidate**. Not installed or activated in ordinary Work. Real personal evidence has not been published. No laptop authority was opened. Source inventory: [FILES.txt](FILES.txt). Activation review: [ACTIVATION.md](ACTIVATION.md).

Staged candidate:

`%TEMP%/itacan-personal-1418fm_q/candidate/main.js`

SHA-256: `ade4edd44bbb553cb996ccb26beaddd329a4f0497632796229649bb34c82ee41`

Build: 264 plugin module factories, 25 Atlas factories. The staged main.js contains the new profile. Staged atlas-native.cjs differs from the installed asset only in line endings; its split lines are identical. Other eleven staged sidecar entries match installed bytes except this Atlas line-ending difference. Neither staged asset was installed. A future compatible-client package must be generated for the new main.js hash; the old package is not a personal-sync client.

## Correctness and recovery

133 distinct focused Node checks passed: the 129-case affected selection, two subsequent publication/conflict cases, and two initial-enrollment recovery cases. The final complete personal selection reran all 33 personal cases with zero failures. Six declaration runners passed with TypeScript 6.0.3 and zero diagnostics: personal, host, writer, N4/shared, application integration and request recovery.

Coverage includes:

- All nine captured private/Resource source states enrolled and bootstrapped in a single personal space. Both replicas preserve exactly eight live tasks, 17 Steps, IDs, tombstones, retired IDs, native event/binding state and original seed receipt evidence. Source receipt prefix and joining local receipt semantics are checked separately. Captured private evidence remains outside the repository in the private Temp audit directory.
- Admitted writer creation/edit/deletion, completion/reopening, independent edits, same-task conflicts, edit/delete conflicts, stale/no-op replay, restart and conflict propagation to a fresh third replica. Conflicted edits reject and History projection refuses apparently converged aggregate totals.
- Missing physical locations wait before request retention; subsequent valid physical evidence permits receive. Physical Resource ownership and personal/Git export separation are checked.
- Forged commands/effects/guards/allocation tapes, altered original receipts, signatures, unauthorized members, foreign bindings, missing/cyclic ancestry, duplicate origins, substituted receive identities/closures and incompatible versions reject without changing accepted state.
- Two separate registered vault mirrors selectively transfer immutable files. Tests exercise delayed heads/dependencies, out-of-order/repeated delivery, conflict-copy aliases, malformed/corrupt bytes, privacy checks, offline errors and forged acknowledgements.
- Process death after enrollment recovery fencing and after receive commit preserves exact original continuation and replay. The captured pre-change reader rejects both interrupted and completed enrollment instead of reopening an earlier writable generation. Test-owned dead locks are preserved and quarantined only after matching child identity, death, hash and guarded disposable path checks; live Work locks are untouched.
- Publication process death after immutable object creation but before head declaration is recoverable by exporting the existing committed origin. A receive replay adds no task, receipt or History effect. Initial never-dispatched and committed-but-unacknowledged enrollments are inspectable through the recovery-only facade and can reopen the normal runtime after authoritative resolution.
- Relevant N4 compact proofs, History/conflicts, retained requests, actual Git round trips and interrupted receive checks pass. Directly affected atomic rich-create/save, location and request-recovery checks pass. No Git packet/frame/genesis versions changed. The separately captured live second-client recovery scenario was not rerun because its dedicated baseline fixture is unavailable; its corrected source remains untouched, and ordinary Work retains the repaired installed bundle.

## Genuine application acceptance

The **final candidate** passed two genuine-Obsidian runs, each with two independently registered vaults, distinct local stores/profiles/keys and selective file exchange. This is 12 acceptance groups, eight actual startup/shutdown process cycles total. Each configuration performs a complete restart of both clients; normal quit releases all fixture writer locks without manual recovery.

- Project fixture: `%TEMP%/itacan-personal-app-r4kaH9`.
- Resource fixture: `%TEMP%/itacan-personal-app-fqgmbO`.

Both run actual plugin onload, safeStorage key encryption/readback, existing Add/Edit/Step modals, portable publication, receive, return edits, Home, workspace Tasks, existing local Legacy History and Statistics. Project Schedule Overview/Week/Month work. Resources retain their existing UI, which does not offer Project Schedule. Restart preserves accepted task/Step identities. The final app runs do not inject initial acknowledgement loss; the pre-runtime recovery facade is covered by focused tests.

These tests simulate asynchronous OneDrive delivery by copying immutable records. They do not establish cloud hydration behavior on the user's actual OneDrive account or install anything on the laptop.

## Responsiveness measurements and limitation

Windows, genuine Obsidian/Electron, two-client fixtures; elapsed wall time, performance.now(), 100 ms renderer heartbeat. Concurrent test load was present. This is a correctness acceptance measurement, not a controlled scale benchmark.

| Final fixture | First process-to-local-view | Add | Edit | Explicit sync median / maximum | Max observed heartbeat gap at readiness |
|---|---:|---:|---:|---:|---:|
| Project | 7.35 / 6.19 s | 1.26 s | 3.93 s | 12.15 / 19.33 s | 104 ms |
| Resource | 7.70 / 7.71 s | 1.75 s | 3.21 s | 11.08 / 15.53 s | 108 ms |

Each sync figure has four samples. An earlier acceptance pair measured approximately 7.8–8.8 s medians; these timings vary with concurrent work and are not before/after optimization results. Local readiness is signaled before background connection. Renderer heartbeat and command servicing remain responsive, but full sync and task saves are **not instant**. Scale/per-origin-history latency is not established. This is an activation-review limitation, not a claim of everyday performance readiness.

Optional proof-cache and unchanged-file privacy-check shortcuts were rejected by automatic approval review. Neither was applied. Full proof execution and path/Git privacy validation remain enabled; no stale cache is an authority.

## Protected live state

The first completion comparison found all captured persistent files in the eleven native authorities unchanged. A subsequent final recheck observed Knowledge (`resource:study`, authority `1cb021ea-e3b3-44c8-9f27-909344d29dd5`) advance from revision 13 / 13 receipts / zero native History events to revision 14 / 14 receipts / one native History event, with six live tasks in both observations. Its CURRENT/RECOVERY and retained generations changed accordingly. The read was stable; this live drift was preserved without restoration or attribution. The implementation never opened or wrote that live authority. Ten other authorities still match captured persistent evidence, including the original Pulsed task. Existing CUTOVER/ACTIVATION files and System/Hub-shared-projects.json match. Source authority identities/paths and both Git genesis bindings were not modified. Future enrollment must recapture the new source head and event rather than use the test snapshot.

Installed main.js remains `1803388fc661b5560492ffeb7080f53c5be01d93c2caf00bf530389f5991dd5b`; installed styles also match the initial baseline. No installed sidecar was written. The initial audit captured exact main/styles hashes, not a full historical hash baseline for every sidecar; this is not represented as a twelve-asset historical comparison.

All 182 Legacy History records match the archived serialized-row SHA-256:

`b0669aa71ad1cb776baae9670dfbaeb0df76e11a14a12a8f2ef22510da6c9b65`

Application data.json bytes drifted during the session and were preserved without restoration or attribution; its History rows remain identical and 18 Inbox captures are present. Eleven new live WRITER.lock files are owned by independently observed ordinary Obsidian renderer PID 10732. That running process and its leases were not modified. No personal-sync directory exists in Work. Git HEAD and raw index match the initial baseline; authorized source edits remain unstaged. No commit, push, pull, merge, reset or cleanup occurred.

## Evidence and remaining activation limitations

Private audit root: `%TEMP%/itacan-personal-1418fm_q`. Principal files: baseline.json, acceptance-node.log, personal-final.log, supplemental-publication-conflicts.log, bootstrap-recovery.log, declarations-final.json, final-genuine-project.log, final-genuine-resource.log, final-application-summary.json, final-timings.json, history-preservation.json, protected-comparison.json and observed-live-drift.json. The latter supersedes the earlier unchanged-Knowledge observation. Raw earlier test failures are retained there and in the corresponding disposable app directories; fixture defects were corrected without weakening assertions. The checkpoint names the exact final candidate.

Before activation review: no writable conflict resolver; no member revocation/key rotation/lost-key recovery; no automatic owner-set extension; finite capacity with no pruning; source enrollment supports the verified schema-1 capability only. Background full-validation latency needs review. There is no automatic unenroll/downgrade executor. OneDrive provides transport/account protection, not extra end-to-end encryption. None of these limitations should be hidden by an enable switch.
