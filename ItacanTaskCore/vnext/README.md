# SQLite TaskCore for Itacan

Installed in ordinary Work on 2026-11-02; automatic OneDrive personal task synchronization installed on 2026-11-03. See [SYNCHRONIZATION.md](SYNCHRONIZATION.md) for the current architecture, acceptance and laptop enrollment. [INSTALLATION.md](INSTALLATION.md) preserves the original SQLite installation evidence. [HANDOFF.md](HANDOFF.md) is the historical experiment handoff.

## Runtime

One device-local SQLite database contains every owner. One Electron utility process runs built-in `node:sqlite`; Electron main owns its lifecycle and sender-bound IPC. The renderer never runs SQL. There is no old/new engine switch, Markdown task engine, native repository admission, writer lease, proof replay or task replication worker in the active dependency graph.

| File | Responsibility |
| --- | --- |
| `engine.cjs`, `validation.cjs`, `schema.sql` | Transactional commands, bounded input, indexed queries, revisions, History, operations and outbox |
| `recurrence.cjs`, `recurrence.sql` | Daily/weekly fixed-origin civil dates, series/templates and unique occurrences |
| `sync-data.cjs`, `sync.sql`, `sync-transport.cjs` | Transactional ancestry/receive progress, explicit conflicts and asynchronous immutable OneDrive files |
| `service.cjs`, `client.cjs` | Explicit asynchronous RPC and original-operation handling |
| `host/main.cjs`, `host/electron.cjs`, `host/renderer.cjs` | Installed Electron utility startup, trusted IPC, automatic reconnect and drainage |
| `application.cjs`, `ui/model.cjs` | Itacan owner metadata, forms, current snapshots, durable catch-up and targeted notifications |
| `production/` | Production source inputs for existing task editors, Home, Project/Resource, History, Inbox and row reuse |
| `contracts.d.ts` | Direct Task/Step/History API |

Task tables are `owners`, `tasks`, `steps`, `history`, `operations`, `outbox`, `consumer_cursors`, `recurrence_series` and `occurrences`. Schema version 3 adds device-local synchronization settings, entity versions, receive receipts/progress and temporary baseline staging. WAL, FULL synchronization, foreign keys and bounded busy handling remain enabled.

## Commands and presentation

Tasks have UUIDs, one owner, a current revision, title/description, completion, Start/Due dates and optional times, importance, optional note/folder context and optional Project Phase. Steps are flat, ordered and independently completable. Step mutations share the parent Task revision.

`BEGIN IMMEDIATE` encloses stale-revision validation, the mutation, completion/reopening History, operation outcome and outbox. An editor Save can commit metadata, ordered Step drafts, completion and recurrence together. Reopening uncounts the retained event; recompletion creates a new event. Deletion retains History and a Task tombstone.

An identical operation-ID retry returns the original compact outcome and a current Task/History observation. `operationSequence` and the outcome revision identify the original command; the returned Task revision and observation sequence identify current presentation. Conflicting reuse is rejected. Pending original commands are retained in the device profile for acknowledgement recovery.

Completion returns its authoritative committed completion event. Oath uses stable native IDs and committed state through its existing service; Strict Oath and Atlas lifecycle/enforcement remain unchanged. Home, Today, Project/Resource, Schedule, Search, Inbox/Quick Add, History/Statistics, reports and Daily Brief use the SQLite application boundary.

Owner transfers notify both affected owners. Moving a past recurring occurrence changes that Task; moving the frontier controls future occurrence ownership. History retains attribution at the time of completion. Location and Phase values are checked against current Itacan metadata when saving.

The model subscribes before its initial paginated query, orders results by revision/sequence, installs small committed results immediately and catches up from durable deltas. Utility exit automatically triggers a bounded reconnect/read demand. Successful catch-up restores unavailable views, including deletions for which the caller reply was lost. A closed editor/view cannot present a late result. Unchanged Task rows reuse DOM and Markdown/presentation components; replaced components are disposed.

Startup waits once for workspace metadata before declaring the owner registry complete. This is separate from utility startup and is currently the largest initial-availability cost in ordinary Work. Closing during that wait cancels presentation startup and drains the service.

## Recurrence

Daily/weekly rules retain a fixed Gregorian civil-date origin and explicit IANA zone. Start and Due offsets remain fixed; occurrence n derives from that origin, never from completion time. Recurring Tasks use dates without times. Ordinary non-recurring Tasks support times. Supported dates are years 0001 through 9999.

Each series and occurrence has a stable UUID; `(series_id, ordinal)` is unique. Completing an occurrence atomically commits History and at most one successor. Reopening, recompletion, lost acknowledgements and successor deletion never allocate a duplicate successor. Generated Steps are independent incomplete copies of the flat template.

Rule/template changes and stopping apply to the current incomplete occurrence with a series-revision guard. The origin stays fixed; a rule change must put the next occurrence after the current one. The editor explicitly opts into updating future title/description/Step templates. No generic recurrence framework, RRULE importer or hypothetical recurrence features are provided.

## Verification and operation

`npm test --prefix ItacanTaskCore` runs the core, process, outbox, recurrence, application and presentation checks. `tools/installed-host.cjs` and `tests/production-ui.cjs` exercise a complete disposable plugin in the genuine installed executable/archive. `tools/work-restart.cjs` verifies ordinary Work drainage/restart and SQL integrity. Current evidence paths and exact results are in the installation report.

Database files belong outside the vault and OneDrive. The engine rejects cloud roots and database symlinks. Do not run historical comparison/orchestration scripts as deployment instructions. No commit, push or reset is part of this workflow.

## Limits

Personal synchronization uses `.itacan-task-sync` at the Work vault root. Each device keeps SQLite outside OneDrive and writes only its immutable change stream. Task/series ancestry detects concurrent edits; the status bar opens explicit version selection. This is separate from retired Personal Sync v2 and Git/N4. Existing Git-shared project files and ordinary file synchronization are preserved. Physical laptop, real remote OneDrive propagation and hardware power-loss acceptance remain deferred. Retained operations, transport files and conflict evidence have no automatic pruning policy.

The empty-database cutover imported no old Task or History data. Live acceptance creates audit records; its temporary Tasks are deleted and all counted completions reopened, leaving no active acceptance Tasks or counted acceptance completions. Broad deletion of inactive legacy source/tests awaits explicit approval after automatic review rejected that scope.
