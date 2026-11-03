# SQLite TaskCore installation report

2026-11-02. Ordinary Work is open on one SQLite task engine, with all 11 owners ready. Essential product and installed-host acceptance passed. Physical deletion of inactive legacy source remains pending approval; it is excluded from the running application and public package.

**1. Completed architecture.** The implementation extends the verified vNext foundation. One device-local SQLite database and one Electron utility process serve all Projects and Resources. Built-in `node:sqlite` runs SQL, transactions, recovery and database close in the utility. Electron main owns sender-bound IPC and process/window lifecycle. The renderer uses the asynchronous client and a small Itacan application boundary; it contains neither SQL nor a database binding.

`engine.cjs` and `validation.cjs` implement commands, indexed reads and revisions. `recurrence.cjs` isolates daily/weekly recurrence. `application.cjs` supplies owner metadata, forms, presentation and committed completion events. `ui/model.cjs` installs committed results and catches up from durable changes. `production/` contains the existing visual components' integration sources. [README.md](README.md) describes those boundaries and semantics.

Each mutation uses `BEGIN IMMEDIATE`. Its revision check, Task/Step changes, completion History, operation result and outbox record commit together. WAL, FULL synchronization, foreign keys and bounded busy handling remain enabled. Identical operation-ID retries return the original outcome with current presentation; conflicting reuse is rejected. Device-profile storage retains unconfirmed original commands across renderer/app restart. There are no custom writer leases or proof replay in this path.

The model subscribes before its initial indexed pages, guards revisions/sequences, updates interested owners and disposes view/editor resources. Owner transfers notify both owners. Task rows reuse unchanged DOM and scoped Markdown components. Pending feedback appears immediately; committed local results do not await History scans, synchronization or unrelated workspace work. Utility failure automatically demands reconnection and durable catch-up. Normal closing drains accepted work and waits for utility exit. A Strict Oath close veto leaves the service usable.

**2. Supported functionality.** Tasks have stable UUIDs, a current revision, title, description, completion/reopening, deletion, Start/Due dates and optional times, Should do/Must do importance, exactly one Project/Resource owner, optional folder/note context and optional Project Phase. Steps are flat, ordered, independently completable and retain stable IDs through editor Save/reorder. Editor saves commit metadata, Step drafts, completion and recurrence atomically. Stale revisions, unavailable owners, foreign Phases and unavailable locations reject without partial writes.

Daily/weekly recurrence uses a fixed Gregorian civil-date origin and an explicit IANA zone. Stable series/occurrence IDs and a unique series/ordinal constraint prevent duplicate successors. Completion, History and successor creation are atomic. Reopening, recompletion, lost replies and successor deletion do not allocate another successor. Generated Steps are independent incomplete copies of the template. Rule/template changes and stopping guard the series revision; the origin stays fixed. Moving a historical occurrence preserves the future owner and original History attribution; moving the frontier controls future ownership. Recurring Tasks are date-only; non-recurring Tasks retain optional times.

All existing consumers use the same SQLite application boundary: Home/Today, Project/Resource panels, Add/Edit, Schedule Overview/Week/Month, Inbox/Quick Add, task Search, History/Statistics, progress reports, Daily Brief and Oath selection/pinned Tasks/fulfillment. Existing visual design and Oath lifecycle are retained. Oath observes stable IDs and authoritative committed completion events. Reopening uncounts a retained History event; recompletion records a new event. A previously fulfilled Oath retains its existing fulfillment latch.

**3. Actual installed-host integration.** Final disposable acceptance launched the genuine installed `Obsidian.exe`, its normal bootstrap and the installed Obsidian 1.15.0 application archive in an isolated profile/vault. The normal first-open author-trust action enabled the authored fixture plugin. This was not an alternate downloaded Electron host. The accepted runtime reports Electron 43.7.7, Node 24.21.0 and SQLite 3.53.4. Obsidian updated from 1.14.5 during the work; final acceptance and final Work restarts use 1.15.0.

The final disposable client is [production-ui-20261102-22][acceptance], built from [production-stage-20261102-14][stage]. Ordinary Work uses the normal user profile and real vault/plugins/Atlas. [Final verification][verification] confirms one named `Itacan local tasks` utility, SQLite mode, 11 ready owners, no pending original operations, current availability and visible Home. Ordinary plugin builds now ship the explicit nine-file SQLite utility closure; sibling task imports are restricted to `ItacanTaskCore/vnext`. The public TaskCore package exports the SQLite engine only.

**4. Retired components and remaining cleanup.** The active dependency graph no longer includes the JSON repository engine, native repository admission, generation/proof replay, old writer coordination, old personal/shared task replication or a Markdown task fallback. Old Personal Sync and Git/N4 task workers are not started. The generated bundle also excludes the old callback quit gate and lifecycle evidence recorder. There is no old/new engine switch. Ordinary file synchronization and unrelated Git-shared files remain in place.

The old source files have not been physically deleted. Automatic approval review rejected broad recursive source/test deletion as outside its recognized authorization scope. No deletion was executed. [The reviewable cleanup list](LEGACY-CLEANUP.md) contains 28 inactive paths, 524 files, each matched to its verified archived copy. Approval is requested only for that source cleanup. Original native repositories, archived evidence, notes, project structures, settings and unrelated collaborator changes are preserved. Final verification matches 1,042 original native/shared files, with no new files in those retired roots; 114 Strict Oath/Atlas assets match the pre-cutover archive. Git HEAD and index also match their archived baseline. No commit, push or reset was performed.

**5. Tests and recovery.** `npm test --prefix ItacanTaskCore` passes all 47 focused tests. The strict declaration check passes with TypeScript 6.0.3:

```text
npm exec --offline --yes --package=typescript@6.0.3 -- tsc --noEmit --strict --skipLibCheck false --target ES2022 --module Node16 --moduleResolution Node16 ItacanTaskCore/vnext/tests/types.fixture.ts
```

Coverage includes CRUD/Steps/revisions, indexed pages, exactly-once retries, atomic History, durable outbox/cursors, stale presentation, disposal, busy handling, actual SQLITE_FULL rollback, read-only errors, concurrent service processes, original-command recovery after a lost creation reply and app restart, complete metadata readiness, closing during startup, deletion catch-up after a lost reply and automatic reconnection. Recurrence checks cover fixed dates, DST zones, templates, series revisions, spent successors, historical ownership and transaction boundaries. Existing Oath service behavior is tested through the new application boundary.

The [complete installed disposable suite][acceptance] passes 16 check groups, exercising the actual editor and Step controls, recurrence, note locations, row reuse, delayed replies, duplicate calendar Markdown instances, Search, Inbox/Quick Add, Statistics/reports/Daily Brief, Schedule modes and Oath task sources. A main-process close-veto fixture checks the existing Oath contract without entering kiosk mode or making a restrictive commitment. The suite interrupts its identified utility and verifies automatic reconnection before a manual read. Its packaged service survives actual process interruption at beforeBegin, afterWrites, beforeCommit and afterCommit, with atomic recurrence/History recovery. A subsequent genuine app restart preserves all five Task identities, Step identities and three counted History identities in that disposable vault.

The exact final ordinary Work build passes three normal close/restart cycles with unchanged identities, 11 owners, `integrity_check=ok` and no foreign-key violations. [Restart evidence][restart] records each cycle. No old/new scale-comparison campaign was rerun.

**6. Real ordinary Work performance.** Measurements used visible ordinary Work, real vault plugins and Atlas. Commands include the application/IPC/transaction path. UI samples activate actual production controls programmatically and wait for authoritative state plus two animation frames. They exclude OS input-queue and optical latency. Tasks and Steps were temporary owned fixtures; counted completions were reopened and fixtures deleted afterward.

| Flow | Samples | Median ms | p95 ms | Maximum ms |
| --- | ---: | ---: | ---: | ---: |
| Task create | 30 | 23.1 | 36.2 | 38.4 |
| Task metadata edit | 30 | 15.8 | 20.7 | 25.3 |
| Task complete | 30 | 9.7 | 13.4 | 13.7 |
| Task reopen, navigation run | 30 | 8.2 | 11.8 | 11.9 |
| Task reopen, Home UI run | 30 | 11.9 | 15.8 | 24.4 |
| Task delete | 30 | 16.2 | 22.9 | 23.3 |
| Step add | 30 | 28.3 | 41.8 | 43.1 |
| Step edit | 30 | 29.4 | 46.4 | 56.9 |
| Step complete | 30 | 30.1 | 44.1 | 47.9 |
| Step reopen | 30 | 32.1 | 41.8 | 46.4 |
| Step reorder | 30 | 31.3 | 36.4 | 40.9 |
| Step delete | 30 | 30.6 | 45.7 | 49.9 |
| Immediate pending feedback | 30 | 0.1 | 0.2 | 0.3 |
| Confirmed Task UI | 30 | 51.0 | 65.3 | 69.4 |
| Confirmed Step UI | 30 | 61.2 | 91.4 | 267.4 |
| Actual editor opening | 20 | 26.3 | 30.6 | 31.4 |
| Actual editor Save | 20 | 35.3 | 43.5 | 44.3 |
| Statistics opening | 20 | 33.2 | 46.2 | 47.6 |
| History query | 20 | 17.5 | 20.5 | 23.4 |
| Home History tab | 20 | 13.7 | 13.9 | 14.0 |
| Schedule Week | 20 | 13.9 | 14.5 | 38.4 |
| Schedule Month | 20 | 13.9 | 14.0 | 14.0 |
| Schedule Overview | 20 | 13.9 | 14.0 | 22.6 |

[Full samples and method][performance] and [navigation samples][navigation] are preserved. All measured full-command p95s meet the 100 ms target; Task UI and editor p95s meet their 150 ms targets. The renderer timer's excess gap beyond 16 ms had p95 26.8 ms and maximum 201.5 ms over 564 samples. One Step UI sample reached 267.4 ms; its precise cause was not established. Opening the entire Project before Schedule took 481.3 ms in one sample, including the surrounding explorer/cover work.

Three persisted-Task restart samples measured the first enabled, committed, visible Home Task row after two frames: 4,419.6 / 4,436.9 / 4,613.2 ms from process launch, or 3,726.9 / 3,713.1 / 3,892.3 ms from plugin startup. [First-presentation evidence][first] distinguishes this from host readiness, which was 1,806.5–1,833.2 ms in those runs. Home/Dataview startup therefore still adds noticeable presentation overhead; precise attribution was not profiled. There are no eleven independent repository-opening barriers.

On the exact final build, three restarts measured host readiness at 1,786.5–2,117.1 ms, plugin-start-to-host readiness at 2,231.4–2,568.9 ms and launch-to-queryable state at 2,958.5–3,284.3 ms. Normal shutdown took 223.8 / 586.1 / 252.4 ms. The single metadata-readiness wait is the largest identified TaskCore startup cost. Command/UI distributions were collected before the final close-veto and build-packaging-only changes; those changes do not alter the measured command/presentation implementation. Final disposable acceptance and normal restart checks were repeated on the installed final build.

**7. Exact installed software hashes.** [INSTALLED-SHA256.json][hashes] lists all 54 activated source/output/dashboard files and the installed executable, bootstrap and application archive. Every installed byte was checked against the accepted stage. Its own SHA-256 is `70f8930987ff025531a6f6110ea1279031166fccdf57ffd80b0dddc7feaff31a`.

| Installed artifact | SHA-256 |
| --- | --- |
| Obsidian.exe | `8baf005e4f33896f3f53abbb00da1a50be8d59f69bbd97b3ae86152817498d85` |
| resources/app.asar | `3b48654f9767318c64b7072f0db0fb1e2af74a1ae6e9bfb5dd95f3331506dfd8` |
| obsidian-1.15.0.asar | `0e6383301078a798f0f3bdb42bdb606d904ada77eab8c8fc89da533573979248` |
| hub-project-menu/main.js | `4638ef3428629dc57ca60326f9d0336a74687eb7b9a91c636840167c48a7e64b` |
| atlas-native.cjs, unchanged | `f85bcd223f2ef6f618552ab4f9744a1cc82bd480d6778c89cee1a3a8fa1c5f66` |
| sqlite-taskcore/engine.cjs | `0b8cca6b6291bfec12e973ce02c9fd487155f12326a33a0c767bd6d490c8754f` |
| sqlite-taskcore/validation.cjs | `dffd49627c5420123f5915122234023154a2e3040c8ac4cbf301ca008377fc2f` |
| sqlite-taskcore/recurrence.cjs | `1927ebf30e0ffb01297357817bc38b75e41a8a91cf1a3fe8f17e2051425cfaf4` |
| sqlite-taskcore/schema.sql | `9b6998440a34ee85bf8c74586482682336c3b658b67d607493a968f001e3dd07` |
| sqlite-taskcore/recurrence.sql | `9e48bf19c79742ae9f99127cab874e0b662f01a4596aa7337133146016b8c33f` |
| sqlite-taskcore/service.cjs | `6c7092f61b9d8c877020f0ee17a528152790adb917982da70c963064858f7e02` |
| sqlite-taskcore/client.cjs | `eb452335e630682d3c4ae67441d4bf9df156ff84cd95453072316f1eafb26d63` |
| sqlite-taskcore/host/main.cjs | `db3cc4fbd6abfdad647adfe508c41209818b34961494ac0d2df6962872afc867` |
| sqlite-taskcore/host/electron.cjs | `d4f8520920aa1279f9ca53e94f51889d39474046d23d0a87192096616078afa7` |

**8. Empty-database cutover and archive.** Ordinary Work was closed gracefully and old writer activity stopped before the archive and initial installation. The [closed archive manifest][archive] covers 2,622 files and 601,857,360 bytes outside OneDrive. Every preserved file was rehashed successfully after final installation. Manifest SHA-256: `4ba4829400fbc4b97ea54bc5f25fbc23783a0977d623f13602a75e72b8ea37a4`. It preserves the exact old software/source, all 11 native repositories, History, native activation/sync state, relevant profile/application state and Git baseline/diffs. Existing node_modules, release-backup directories and System/Backups were excluded; those existing archives were not removed. Intermediate development evidence also remains preserved outside OneDrive.

The [initial installation record][install] confirms zero Tasks and zero History before acceptance, with all 7 Projects and 4 Resources registered. No task importer, old-engine recovery, re-enrollment or key regeneration ran. The fresh database is `%LOCALAPPDATA%/Itacan/TaskCore/aad4db1ab68225712aa322ee/tasks.sqlite`; its workspace authority ID is `8aacb966-bdec-58b1-afe8-893a300b05bb`. Initial database SHA-256: `ddba10a2164be81e8fe8cd452b0ed06b76406b1947bdb26b790500435bd51ac1`.

Current visible state remains zero active Tasks, zero counted completions and zero pending operations. Acceptance audit records are intentionally retained: 154 deleted Task records, 450 Step records, 420 uncounted History events, 2,047 operation records and 2,047 outbox records. The database is therefore no longer byte-empty after acceptance. It contains no imported old Task/History data. Subsequent presentation/software updates preserved the closed database byte-for-byte, and final SQL integrity/foreign-key checks pass. After acceptance, temporary debugging flags were removed and [ordinary Work was relaunched normally][normal], with a responsive window, its normal profile, one task utility and a final passing read-only database check.

**9. Remaining limitations.** Task synchronization is unavailable. The durable outbox is local change storage, not a Personal Sync v2 or Git/N4 replication implementation. Physical laptop testing and hardware power-loss testing remain deferred. Recurrence supports the requested daily/weekly civil-date rules without times; it does not provide a generic RRULE system. This prototype has no operation/outbox pruning policy. Metadata and Home/Dataview startup overhead and the observed renderer tail remain as measured above. Physical cleanup of the 28 inactive legacy source paths awaits approval; the archived native repositories and evidence are to remain preserved.

[stage]: <C:/Users/El_Baraka 2025/AppData/Local/Itacan/DevelopmentEvidence/TaskCoreVNext/production-stage-20261102-14/STAGE.json>
[acceptance]: <C:/Users/El_Baraka 2025/AppData/Local/Itacan/DevelopmentEvidence/TaskCoreVNext/production-ui-20261102-22/result.json>
[verification]: <C:/Users/El_Baraka 2025/AppData/Local/Itacan/DevelopmentEvidence/TaskCoreVNext/production-stage-20261102-14/FINAL-VERIFICATION.json>
[restart]: <C:/Users/El_Baraka 2025/AppData/Local/Itacan/DevelopmentEvidence/TaskCoreVNext/production-stage-20261102-14/WORK-RESTART.json>
[performance]: <C:/Users/El_Baraka 2025/AppData/Local/Itacan/DevelopmentEvidence/TaskCoreVNext/production-stage-20261102-12/WORK-PERFORMANCE.json>
[navigation]: <C:/Users/El_Baraka 2025/AppData/Local/Itacan/DevelopmentEvidence/TaskCoreVNext/production-stage-20261102-12/WORK-NAVIGATION.json>
[first]: <C:/Users/El_Baraka 2025/AppData/Local/Itacan/DevelopmentEvidence/TaskCoreVNext/production-stage-20261102-13/WORK-FIRST-PRESENTATION.json>
[hashes]: <C:/Users/El_Baraka 2025/AppData/Local/Itacan/DevelopmentEvidence/TaskCoreVNext/production-stage-20261102-14/INSTALLED-SHA256.json>
[archive]: <C:/Users/El_Baraka 2025/AppData/Local/Itacan/CutoverArchives/sqlite-taskcore-20261102/MANIFEST.json>
[install]: <C:/Users/El_Baraka 2025/AppData/Local/Itacan/DevelopmentEvidence/TaskCoreVNext/production-stage-20261102-5/WORK-INSTALL.json>
[normal]: <C:/Users/El_Baraka 2025/AppData/Local/Itacan/DevelopmentEvidence/TaskCoreVNext/production-stage-20261102-14/FINAL-NORMAL-LAUNCH.json>
