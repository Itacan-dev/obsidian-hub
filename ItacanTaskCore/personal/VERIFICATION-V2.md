# Personal v2 functional verification

Preserved predeployment verification record. Subsequent live deployment and nine-owner enrollment are recorded in CHECKPOINT.md; the original staged build and its protection baseline below remain historical evidence.

26 October 2026. **Implemented and tested in isolation. Staged, not installed or activated in ordinary Work.** This is functional acceptance, not performance or real OneDrive acceptance.

## Candidate and durable evidence

Staged candidate:

```text
%LOCALAPPDATA%/Itacan/DevelopmentEvidence/PersonalSync/v2/resolution-b35b58042dcb/candidate/
main.js SHA-256: 5ec868d223800b11f5871a01dedb1bb21d985e8f2909d192c05531af3d3b7125
```

The final build contains 273 plugin factories and 25 Atlas factories. `MANIFEST-v2.json` in the audit records exact source and candidate file hashes, the changed-file inventory, retained v1 source hashes and evidence hashes. [FILES-V2.txt](FILES-V2.txt) lists changes attributable to this task rather than all pre-existing dirty v1 work. Documentation was completed after the final JavaScript build; no executable source changed after that build and its application acceptance.

The durable v1 candidate/source/audit remains under `%LOCALAPPDATA%/Itacan/DevelopmentEvidence/PersonalSync/v1/pre-resolution-bea8dfc0ace4/`. All 307 recorded preserved files still hash-match. Original v1 main is `ade4edd44bbb553cb996ccb26beaddd329a4f0497632796229649bb34c82ee41`. The three preserved v1 interpreters (graph, writer port and transport) match their original source bytes.

The audit contains private captured fixtures and must not be committed, copied into OneDrive or published. It includes `baseline.json`, `protected-comparison.json`, `acceptance-focused.log`, `v2-final.log`, `declarations-final.json`, build logs, selected genuine application evidence, source snapshot and manifest. Temporary test pointers remain for reproducibility; durable preservation does not depend on their continued existence.

## Focused results

| Verification | Result |
| --- | --- |
| Combined selected regression run | 150 passed, zero failed; 121.6 seconds |
| Two subsequent new regression cases | Passed in final v2 selection; 152 distinct selected tests in total |
| Final v2-only run | 39 passed, zero failed; 55.1 seconds |
| Preserved personal v1 compatibility selection | 33 passed, zero failed |
| Declaration runners | Six passed; TypeScript 6.0.3, zero diagnostics |
| Genuine Obsidian Project client pair | Nine acceptance groups passed |
| Genuine Obsidian Resource client pair | Nine acceptance groups passed |
| Changed-file whitespace check | `git diff --check` passed |

`focused-selection.json` records the exact combined selection: personal v1/v2, compact Git proofs, shared History/conflicts, production retention/runtime, actual Git round trip, and affected atomic create/Save tests. Counts above overlap intentionally; they are not additive. The two later tests cover bounded status export retries and a fresh third replica receiving the resolution before older deliveries. No unrelated historical suite was rerun.

Declaration runners: personal, host, writer, shared, integration and request-recovery. The final rerun supplies the existing compiler explicitly to each runner; no dependency or test-runner source change was needed.

## Protocol, accounting and adversarial coverage

- Direct v2 enrollment and isolated v1 upgrade, original receipt/frame/signature preservation, declared ancestry cutoff, rejection of later v1 origins and duplicate replica roots.
- Old readers reject stronger barrier 5 while CURRENT still references the predecessor. Original retained enrollment/upgrade resumes after the stronger fence; a different transition cannot bypass it.
- Exact maximal heads, independent edits, same-task conflicts, resolution supersession, duplicate delivery, third-replica dependency waiting, late branches, concurrent resolutions and a subsequent explicit review.
- Whole-task completion/reopening/Step accounting, null timestamps, event audit identity, local application provenance and no completion creation from resolution/replay. Tombstones, deletion/live rejection, retired-Step incompatibility and discarded-branch ID reservation.
- Forged commands, receipts/effects, previews, accounting, allocation evidence, signatures and profile/identity substitution reject. Missing required proof dependencies do not publish partial task state.
- Changed task/head/profile/inventory/location observations reject stale reviews before retention. Missing physical locations remain waiting rather than relocating tasks.
- V4 retained replay, lost acknowledgement confirmation and one-use signed writer-proven rejection; contradictory incoming operation evidence rejects before retention. Uncertain publication cannot become a terminal rejection merely because a receipt is absent.
- Process death before manifest publication and before acknowledgement, interrupted stronger enrollment/upgrade fences, and committed resolution export after death before transport head publication. Disposable crash tests recover only independently verified test-owned dead-writer locks; ordinary application acceptance requires no manual lock recovery.
- Two separately registered transport mirrors receive delayed heads/objects, duplicates and immutable alias copies. Corrupt/foreign content and tracked personal paths reject without resetting Git or accepted local state.
- One space enrolls all nine captured private authorities and bootstraps their exact logical state in separate local repositories: eight live tasks and 17 Steps, with original task/Step/event IDs, tombstones, source receipts and retired IDs preserved. Original receipts remain seed evidence, not another replica's local receipt sequence.

## Genuine application acceptance

The established real-Obsidian harness loads the final staged production plugin into separate registered vaults, application profiles, device-local roots and keys. It does not substitute a standalone task app. Project and Resource pairs each exercised actual Add/Edit/Step UI, bidirectional immutable file exchange, conflict restart, Native task recovery modal branch comparison/preview/confirmation, concurrent completion resolution, Home/Workspace/History/Statistics and normal process restart. Project Schedule was exercised; Resources do not receive Project Phase/Schedule behavior.

Both pairs retained independent local Legacy History alongside exactly-once native event accounting. A durable conflict leaves local Tasks and recovery ready while aggregate History/Statistics is explicitly incomplete. The modal's success state requires native receipt confirmation, then the other replica receives the selected result.

Each configuration completed five actual process start/ordinary-exit cycles across its two clients (including restart while conflicted), with zero abandoned writers. Final `quit-result.json` files report `remaining:[]`. No manual lock recovery was required in these application runs.

Observed initial fixture readiness was 5.713/5.721 seconds for Project and 5.715/5.715 seconds for Resource; maximum startup event-loop gaps were approximately 102–105 ms. These are concurrent disposable functional-fixture observations, not controlled performance acceptance or a claim about cloud latency.

Two earlier genuine failures remain recorded: History conflict incorrectly invalidated otherwise healthy admission; then a status export raced a committing resolution. Narrow corrections distinguish personal-v2 incomplete History from integrity failure and retry coherent status snapshots at most three times. They do not relax mutation guards, proof validation or receipt confirmation. The failed fixture pairs also shut down normally through their owned command bridge; failure evidence is preserved separately.

## Protected ordinary Work

The final comparison matches this task's starting baseline for all eleven authority persistent-file sets (leases excluded), all thirteen installed assets, local application data, shared metadata, Git HEAD and raw index. All 182 Legacy History rows retain digest `b0669aa71ad1cb776baae9670dfbaeb0df76e11a14a12a8f2ef22510da6c9b65`. The original Pulsed task is present. No Work personal-sync directory, binding, seed or enrolled authority was created.

The installed main remains `1803388fc661b5560492ffeb7080f53c5be01d93c2caf00bf530389f5991dd5b`. Git HEAD remains `d5087e3a944eca545241bb1b4b09fdc8c91600c0`; raw index digest remains `ceeabbbb0188f9d5742995fa5b14e46e872c7acdd09b1fd7821d92682d066afd`. Existing dirty work is preserved. No commit, push, pull, merge, reset or cleanup occurred.

Knowledge was already revision 14 with one native event at the v2 baseline; it remains unchanged. The older captured eight-task/17-Step fixture is preserved evidence, not a source for overwriting newer user state.

## Remaining gates and unsupported cases

Before any deployment/enrollment: performance/scale testing, actual OneDrive delivery validation, an exact-hash compatible-client package, fresh live-data/backup verification and explicit activation approval. See [ACTIVATION-V2.md](ACTIVATION-V2.md).

No resurrection, constructed/field-level result, per-event counting control, key-management expansion, owner-set extension, pruning, live-data migration or automatic downgrade was added. Some incompatible retired-Step conflicts intentionally have no eligible branch. Existing finite packet/frame limits remain. Local receipt confirmation does not establish peer convergence. This candidate is not described as installed or ready for unattended everyday activation.
