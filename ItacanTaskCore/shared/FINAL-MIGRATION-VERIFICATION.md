# N4 primary shared cutover verification ? 24 October 2026

**Complete locally:** all eleven registered owners are native and ready in ordinary Itacan. Itacan and Obsidian Hub are Git-shared native owners. **Not published remotely; Jinhao has not joined.** [Secondary onboarding](SECONDARY-ONBOARDING.md) contains the exact compatible-client and Git handoff steps.

## Implementation

No N4 core, receipt, command, private/Resource persistence or History-calculation semantics changed.

Existing files changed in this gate:

- .obsidian/plugins/hub-project-menu/lib/services/native-git-inventory.js
- .obsidian/plugins/hub-project-menu/lib/services/native-task-activation.js
- .obsidian/plugins/hub-project-menu/lib/services/native-task-host.js
- .obsidian/plugins/hub-project-menu/lib/services/native-task-host-multi.js
- .obsidian/plugins/hub-project-menu/lib/services/native-task-shutdown.cjs
- ItacanTaskCore/integration/tests/git-peer-obsidian.cjs
- ItacanTaskCore/integration/tests/run-git-peers.cjs
- ItacanTaskCore/integration/tests/native-quit.test.cjs
- ItacanTaskCore/shared/tests/production-inventory-source.test.cjs

New implementation/tests: plugin lib/services/native-git-transition.js; ItacanTaskCore/integration/shared-cutover.cjs; integration/tests/shared-cutover.test.cjs, native-quit-unload.test.cjs and run-shared-onboarding.cjs. Documentation: this report, SECONDARY-ONBOARDING.md, README.md and CHECKPOINT.md. Installed main.js and the exact committed migration paths below also changed. Earlier N4 dirty source changes are preserved and not attributed to this gate.

The offline executor validates registered physical roots, current source/backup hashes, device, both authoritative application files, dependencies, installed build and Git baseline. It creates fail-closed local version3 markers before editing, holds exclusive Windows source handles during marker-only retirement, and commits through an isolated Git index. Exact incomplete/retired/committed continuation preserves the prepared genesis and local authority identities.

Secondary startup discovers committed bindings, reserves Legacy guards immediately, waits for real metadata readiness and joins the existing genesis. It creates only a separate device-local authority and local activation evidence, backs up local application data and receives validated N4 evidence. No independent genesis or primary device-state copying occurs.

Inventory admission now reads detached local data through the existing read-only SharedProjectStore.load. That path only reads and overlays; prepare/save are never called. Original-local plus effective shared reservation IDs are preserved with revision commitments. Both source files, physical identities and selected memory observation are rechecked. Actual capture retained six local and 58 shared metadata entries, 375 reservation IDs and all six existing Itacan Phases (Hub: zero). The existing resource-reference startup observer adds absent oldPath to both completion collections; observation matches that established JSON save contract without mutating either collection. Defined UUIDs/values remain reserved, mismatches and other nonportable fields reject.

The ordinary shutdown defect was reproduced: Component unload removed the owning-window close guard before asynchronous host drain. The guard now remains until drain succeeds; an already pending close callback is retained and resumed once. Failed drain stays fail-closed. The exact nine approved dead-PID10784 locks were preserved/quarantined once, with hashes, authority/process identity and confirmed death; no fence/receipt/generation changed. There was no repeated recovery loop.

## Real archive and retirement

Archive: C:\Users\El_Baraka 2025\AppData\Local\Itacan\CutoverArchives\v1\47f2fab0a1a1e5ec\n4-primary-fed4384e-46a6-43ef-a365-e22509178305\capture-2026-10-24T09-57-28-712Z-0c07bd4f-467c-45af-b946-55f53d2d038b

Primary files: TASKS.txt, TASK-METADATA.json, MANIFEST.json/MANIFEST.sha256 and eight complete byte-verified note backups. An exact private System/Hub-shared-projects.json backup is in the adjacent execution folder. Earlier archives and rollback copies remain untouched.

| Source | Retired tasks | Steps |
| --- | ---: | ---: |
| Projects/Itacan/Atlas/Tasks.md | 6 | 0 |
| Projects/Itacan/Meta/Tasks.md | 51 | 0 |
| Projects/Obsidian Hub/Tasks/Global Tasks.md | 1 | 0 |
| Projects/Obsidian Hub/Tasks/Home-page Tasks.md | 1 | 0 |

Exactly 59 active markers were converted; task text and every unrelated source byte match the reviewed proposed bytes. No task was recreated. The ambiguous empty design row and three unrelated template sources were excluded and preserved.

## Scoped local Git state and identities

Migration commit: c5095f2a7bfd9594859f2700df98ee03664ea4f2
Parent: 0c596760abe88f8652e9104cf73a46c2ed5cdc40

Its only ten paths are .gitignore, .itacan-native/.gitattributes, two projects/<UUID>.json bindings, two transitions/<UUID>.json records and the four task notes above. The narrow ignore allowance includes only approved portable transport; local leases, receipts and activation remain outside Git. The per-tree -text attribute preserves canonical proof bytes across checkouts.

Handoff commit: ac909287f196495f2ff0e57d3b7e92393bf89e6d
It adds only fourteen validated content-addressed objects/heads from the non-completing production smoke checks. Both tasks are deleted; their original create/edit/delete evidence and tombstones remain. Each namespace has exactly three origins and zero completion events. The final portable state is committed and clean. Unrelated index entries and working changes were preserved. No push, fetch, pull, merge, reset, clean or remote publication was performed in the real repository.

| Project | Project UUID | Shared authority | Genesis revision |
| --- | --- | --- | --- |
| Itacan | 4b597e3b-b588-4a29-969b-70db3a684112 | 29233647-49ee-8061-9291-1d1d6c7d20ce | efa5ee9f-2e72-42c4-8957-df46d4e325cd |
| Obsidian Hub | 9325047c-eb3d-43e7-92f2-a9bf630afe13 | 44f5d46b-cb87-83cd-ae30-ec18dfc21548 | 96b2fae6-8b56-43aa-9ddf-b579bbeb843d |

Both physical Git roots resolve to Work, with separate namespaces/genesis and existing device-private Git-authority paths. CUTOVER/ACTIVATION evidence and commit continuation records are durable in C:\Users\El_Baraka 2025\AppData\Local\Itacan\CutoverArchives\v1\47f2fab0a1a1e5ec\n4-primary-fed4384e-46a6-43ef-a365-e22509178305\execution-e534d31c-cf15-43ca-962d-2f52a94d9218. Jinhao's stopped-writer/no-outstanding-task-change/join-existing-genesis confirmation was relayed by the user; his actual client has not been inspected.

## Verification and installed application

- 56 distinct focused passing test cases across overlapping selections. Final cutover cases: 6/6; complete authoritative-inventory cases: 8/8. Lifecycle/startup/multi-owner selection: 28/28; retained receive/runtime and prior real-inventory regressions also passed. Counts are not summed as disjoint suites.
- Four declaration runners passed, TypeScript6.0.3, zero diagnostics. No declaration changed afterward.
- Final genuine asymmetric two-client fixture passed four acceptance groups with actual production startup, real isolated Git exchange, nonempty shared metadata and both completion-domain load observations. A establishes genesis/retirement; B joins independently, preserves its distinct Legacy History, returns an edit, and both restart with original task/Step UUIDs. All four leases release on quit. Final evidence: Temp itacan-n4-two-clients-OIW5vp/onboarding-report.json.
- Retired- and committed-boundary interruption/resumption tests preserve exact identity and one migration commit. Changed source/shared source/build, missing required domains, defined-value mismatch, changed reservation/Phase and stale observations reject.
- After the lifecycle fix, TWO consecutive ordinary nine-owner shutdown/restart cycles passed before shared activation, without manual lock recovery.
- Actual production then passed first eleven-owner startup, Add/Edit, one flat Step, Description, Necessity, date-only Start/Due and local portable publication for each shared Project. No real completion was performed.
- Actual Home showed exactly three unique native tasks during smoke; both Schedule Overview/Week/Month worked. History and Statistics each received 182 Legacy records and zero native completion rows. Integrated Git recovery/status was accessible.
- An actual process restart retained both temporary task/Step IDs and metadata. Both temporary tasks were deleted through existing Edit/Delete confirmation. A diagnostic receipt-field error after the first committed deletion was corrected; that outcome was confirmed from the exact receipt, not repeated.
- TWO ordinary eleven-writer shutdowns released all locks without intervention, followed by final actual restart. All eleven owners are ready; both shared lists are empty; Home is complete with the one original Pulsed task. All eleven owner-qualified Legacy guards reject. Itacan is left open and usable; its eleven live locks belong to the current Obsidian writer PID.
- Raw test/diagnostic failures remain in the audit, including an error-message assertion mismatch and a test-only Resource resolver mistake. Assertions were corrected to the actual contract; no frozen historical assertion was weakened. No claim that all historical archives were rerun is made.

Installed main SHA-256:
e7f954071182052d2bc73de4259a9e13536b3e30666e1534108b90b9cdbc34b1

Only main.js changed among twelve installed assets. Factory count246?247: added native-git-transition; changes limited to inventory, activation and host/multi-host factories plus the browser shutdown prefix. Staged Atlas differences were excluded from installation. The twelve-file compatibility checker passes against the installed closure. Original and intermediate rollback assets remain at C:\Users\El_Baraka 2025\AppData\Local\Itacan\InstallBackups\v1\N4-primary-5d9a770d-4068-4890-aec4-829ae737ddab.

## Protected state and handoff

All original files in the nine established native authorities compare byte-for-byte with their fresh durable gate backups, including CURRENT, receipts/events and retained requests. Authority IDs and the original Pulsed task are preserved. Local data.json and tracked System/Hub-shared-projects.json are byte-identical to the gate observations; all 182 Legacy History rows, checks, task metadata, Inbox, Oath, planning and Music match. The only changed previously protected vault files are the four authorized task sources and main.js. Other live workspace state is not broadly restored or attributed.

Compatible-client package: C:\Users\El_Baraka 2025\AppData\Local\Itacan\InstallBackups\v1\N4-primary-5d9a770d-4068-4890-aec4-829ae737ddab\compatible-client

It contains only the twelve tested assets, COMPATIBILITY.json, read-only verify-client.cjs and ONBOARDING.md. It contains no application data or local native repository. Exact handoff steps are in SECONDARY-ONBOARDING.md.

Remaining boundary: authorize remote publication of the two scoped local commits and provide the package to Jinhao. He must preserve local data/Git work, install/verify this exact client, receive the committed baseline and open to join the existing genesis. His local History must remain local; no migration executor is needed. Actual collaborator joining and live cross-device exchange remain unverified until performed on his installation. Existing unsupported Oath/Inbox/Phase/recurrence/nested-editor/clear-completed guards remain in place. No further core/synchronization redesign is required by this result.
