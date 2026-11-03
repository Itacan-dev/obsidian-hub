# Personal OneDrive task synchronization

Shared Project Git transport is now integrated through the same engine. See [GIT-SYNCHRONIZATION.md](GIT-SYNCHRONIZATION.md) for the current cross-transport behavior. The installation evidence below documents the earlier OneDrive-only build.

Installed and enabled in ordinary Work on the stationary computer, 2026-11-03. Physical laptop acceptance is deferred.

## Architecture and data

The existing SQLite engine remains the only task engine. Its live database, WAL, SHM and device identity stay under `%LOCALAPPDATA%/Itacan/TaskCore/<local-vault-hash>/`, outside OneDrive. Schema 3 adds only synchronization bookkeeping. No database reset, second cutover, new account, cloud API or old Personal Sync/Git/N4 worker is involved.

The private vault-root directory `.itacan-task-sync` contains:

```text
workspace-<workspace UUID>.json          immutable protocol/workspace/authority manifest
baseline-<workspace UUID>-<part>.json    immutable consistent SQLite baseline parts
streams/<device UUID>/0000000000000001.json
streams/<device UUID>/0000000000000002.json
```

The existing vault-root Git ignore excludes this directory. It lives outside every Project repository. Devices never repeatedly overwrite a common head file. Each writes only its own stream; workspace/baseline files are published once by the first device.

Local task changes commit immediately with their existing operation and outbox record. A bounded task snapshot, counted History and changed History rows, relevant recurrence rows, original operation identities and task/series ancestry enter that same outbox transaction. Filesystem work happens later, asynchronously in the existing utility. The renderer's presentation outbox omits transport payloads.

The publisher writes and flushes a temporary file, closes it, then renames it locally to the immutable final filename. Its publication watermark is durable. The receiver reads exact next sequence filenames, so gaps, delayed files and incomplete temporary files cannot advance receive progress. Schema, size, workspace/device/operation identity, table references, recurrence invariants and ancestry are checked. Referenced filenames are fixed, bounded children of the synchronization root; directory links are rejected. Files-on-demand read failures are retried, with an actionable status and no dependency from local task confirmation. Shutdown waits at most 500 ms for transport work before draining accepted SQLite work.

Incoming application, History, presentation outbox and receive progress commit atomically. Operation IDs plus durable per-device progress prevent duplicate application. Applied receipts retain a hash and small metadata rather than another full payload. Unresolved/rejected conflict versions remain retained. The original OneDrive-only build gave incoming presentation changes no export payload. Schema 4 now retains received logical changes in a transport journal: Git imports forward through OneDrive bridges and OneDrive imports remain Git-eligible, with identity-based deduplication and durable per-transport cursors.

All native Project and Resource tasks participate, including Projects whose ordinary files are Git-shared. Synchronized data includes stable Task/Step IDs, title/description, completion/reopening, Start/Due dates and times, importance, owner transfers, folder/note references, Phase IDs, ordered flat Steps, daily/weekly rules/templates/series/occurrences, tombstones and counted/uncounted completion History. Local owner and location availability comes from each device's current vault metadata; missing metadata does not discard the saved reference.

Home, Project/Resource, Schedule, Inbox, Search, History, Statistics, reports, Progress, Daily Brief and Oath continue using the existing application boundary and targeted notifications. Oath observes committed task/History changes; active Oath sessions and Strict Oath enforcement state are never exported. Ordinary Markdown and Git file behavior is unchanged.

## Enrollment and conflicts

The first device captures its actual task rows and a precise operation/outbox position in one SQLite transaction. Baseline parts are staged durably until published. Later commits already enter the new stream, so edits during baseline publication cannot fall between baseline and changes. Historical outbox entries are not replayed for enrollment.

A joining empty device loads the shared baseline atomically and uses its existing workspace authority for owner IDs. Its own UUID is saved in `task-sync-device.json` beside its local SQLite database, survives restarts/plugin reinstalls, and is also checked against SQLite. Do not copy this identity or the database to another computer.

A device with independent active tasks or counted History stops at **Task sync: review enrollment**. **Merge this computer’s tasks and join** explicitly retains local Task identities and History, adds the baseline, maps owners to their shared identities and publishes the independent tasks. A baseline identity overlapping any existing local Task, including a tombstone, stops enrollment without changing data. Later overlapping stream changes become reviewable conflicts. Overlapping baseline identities require manual review; there is no destructive replace/reset button.

Each Task and recurring series has a small per-device version vector. Wall-clock timestamps do not select winners. Changes to independent tasks combine; concurrent edits to the same task, or the same recurring series, preserve both branches for explicit choice. This deliberately uses whole Task/series conflict resolution, including concurrent edits to different Steps of one Task. The status-bar item and **Review personal task synchronization** command show the versions and offer **Use this computer’s version** or **Use incoming version**.

A resolution exports the chosen state and merged ancestry. A rejected recurring successor remains a tombstone; its counted events are uncounted, with audit evidence retained. The chosen occurrence IDs and unique series/ordinal links survive, so further completion/reopen/recompletion cannot allocate a second successor or double count the same accepted completion. An offline edit not yet delivered when a choice was made can cause a later review.

Filesystem observation detects arrivals while Work is open; a 15-second bounded reconciliation catches startup/reconnect/missed notifications. The modest status item reports ready, waiting, conflict, enrollment or actionable error. **Ready describes reconciliation of files available on this computer; it does not assert delivery to another physical computer.** Files/operations are retained for offline catch-up; there is no unsafe automatic pruning.

## Stationary installation and evidence

Accepted build: `sync-stage-20261103-10`; genuine installed-host acceptance: `sync-ui-20261103-10`. Both are under `%LOCALAPPDATA%/Itacan/DevelopmentEvidence/TaskCoreVNext/`.

- All **66** focused TaskCore tests pass, including **19** synchronization tests. Most synchronization tests run two independent service processes, each with its own SQLite database and device identity, using a shared simulated OneDrive directory. They cover offline work, conflict choices, concurrent recurrence and definition changes, owner remapping, real pre-enrollment tombstones/History, precise baseline publication, incomplete/delayed/out-of-order files, invalid references, explicit populated-device enrollment, restart and actual exporter/importer process termination before/after commit. The strict TypeScript declaration check also passes.
- The final complete disposable plugin passes **17 installed-host check groups** in the genuine installed Obsidian 1.15.0 executable/archive (Electron 43.7.7, Node 24.21.0, SQLite 3.53.4). A second utility/device delivers task creation, Home, History, reopening and deletion automatically, and the rendered conflict modal resolves both devices. Existing Task/Step/editor, Schedule, Inbox, Statistics, report and Oath checks pass. The separate genuine application restart retains all five disposable Task identities, their Steps and three counted History identities.
- Work was closed normally. `WORK-UPDATE.json` records the accepted installation of 58 source/output files and a closed SQLite backup at `sync-stage-20261103-10/pre-update-tasks.sqlite`. Before migration/first startup, every original task-domain row was preserved. `WORK-ENROLLMENT-PREP.json` records exactly 154 unchanged, deleted/uncounted acceptance fixtures verified against the earlier closed acceptance database. Only those identities were excluded from the baseline; genuine tombstones and uncounted History were retained. Exclusions are a local audited list, not a title/date/deletion heuristic.
- The baseline at operation **2090** contains **7** genuine Task records: **3 active**, **4 tombstones**, and **14 History records**. Workspace ID is `8ddd63fd-af0a-41da-8c74-a9283c3f3bef`. The existing authority `8aacb966-bdec-58b1-afe8-893a300b05bb` is unchanged. The stationary device is `f4bbca61-21b5-49c6-b76d-68aa1db7c651`.
- `WORK-PRESERVATION.json` verifies every preexisting owner, Task, Step, History, recurrence, operation, outbox and consumer-cursor row remains identical. The single ordinary-Work acceptance Task was reopened and deleted; its new uncounted audit event remains. All five test actions were durably published through stream files. No active acceptance Task or counted acceptance completion remains.
- `WORK-SYNC.json` records 11 ready owners, zero pending original commands, ready synchronization and unchanged preexisting task observations. Ordinary create/edit/complete/reopen/delete took **36.1 / 3.8 / 3.3 / 3.0 / 14.6 ms** respectively (single focused samples, not a benchmark campaign).
- One normal Work close/restart is verified with unchanged identities, `integrity_check=ok`, zero foreign-key violations, **147 ms** shutdown and **2.96 s** launch-to-queryable. An additional repeat lost the local debug endpoint after Work reopened without debug arguments; no success is claimed for that extra automated attempt. Work is left open normally. Read-only preservation and SQL checks pass afterward.

Installed `hub-project-menu/main.js` SHA-256: `15c3d49d8d496a82212b2808f3642a3d33753b6402dff32b9828aa8103eb9ddc`. `STAGE.json` and `WORK-UPDATE.json` contain the complete accepted/installed file hashes. No Git commit, push or reset was performed. Unrelated native keys, original native repositories, settings and Project files were preserved. OneDrive global settings were not changed.

## Laptop first use

1. Close Obsidian on the laptop while OneDrive receives the updated Work plugin and `.itacan-task-sync` files. Wait until the following manifest and its baseline part are downloaded: `.itacan-task-sync/workspace-8ddd63fd-af0a-41da-8c74-a9283c3f3bef.json` and `.itacan-task-sync/baseline-8ddd63fd-af0a-41da-8c74-a9283c3f3bef-0.json`. The plugin's `main.js` and `lib/sqlite-taskcore/` files must also have arrived. This prevents two computers independently establishing a first workspace before OneDrive has delivered either manifest.
2. Open that same **Work** vault normally. An empty local TaskCore enrolls automatically, creates its own local database/device identity and loads the baseline plus all subsequent stream files. Do not copy the stationary SQLite/WAL/SHM files or `task-sync-device.json`.
3. If the status says **review enrollment**, click it and review the explicit merge action. Existing data remains intact until a valid merge commits. If it reports overlapping baseline identities or multiple workspace manifests, leave the files/database intact for manual review.
4. Wait for **Task sync: ready**, then create one temporary task on each physical computer and confirm each appears on the other; verify a Step edit, completion/reopening and deletion in both directions. Review any reported conflict through the status item. These physical checks have **not** been performed yet.

Transport limits are 8 MiB per file and 128 MiB per baseline, with bounded per-cycle work. Oversized/invalid/unavailable input stops transport with an actionable error while local task work remains available. Actual Microsoft OneDrive remote propagation/files-on-demand hydration, physical laptop use and hardware power-loss acceptance remain unverified. Shared Project collaboration is provided by the additional Git transport documented above.
