# SQLite TaskCore — handoff to GPT-6.1 Sol

The experiment is concluded at the user's request. **Complete and integrate SQLite TaskCore next; do not restart the expensive old-engine scale campaign or investigate another architecture.** Ordinary Work still uses its unchanged installed engine.

## Verified foundation

- `engine.cjs`, `validation.cjs`, `schema.sql`: direct transactional commands, indexed reads, flat Steps, Task revisions, atomic completion History, operation-ID idempotency, durable outbox and cursors. WAL, FULL synchronization and foreign keys; no writer lease files.
- `service.cjs`, `client.cjs`, `host/electron.cjs`: asynchronous API in one Electron utility process. Built-in `node:sqlite`; no third-party SQLite addon.
- `ui/model.cjs`, `ui/view.cjs`: direct experimental presentation, targeted change catch-up, revision/sequence ordering, pending feedback, original-operation retries and editor/navigation disposal. Existing visual components are injected by the host.
- `contracts.d.ts`: direct API. On replay, original operation metadata and a current Task/History observation are distinct; do not render the original operation revision as a current Task revision.

Final checks: 30/30 correctness tests; strict type-contract check; four packaged utility-process interruption cases; nine final disposable Obsidian UI check groups. All 46 audited disposable SQLite databases pass integrity and foreign-key checks. Original source, installed assets, native evidence, HEAD and index remain unchanged.

The passing disposable runtime is official Electron 43.7.7 / Node 24.21.0 / SQLite 3.53.4, using the genuine Obsidian 1.14.5 archive. It matches installed version/ABI, **not installed executable bytes**. Private-copy executable bootstraps timed out; exact installed-host launch/packaging remains unverified. Use utility processes; installed Obsidian disables RunAsNode.

## Measurements and scope

The corrected Work-sized comparison uses eleven separate old repositories and one SQLite workspace database, with equivalent generated commands. Across 200 warm iterations, portable command medians are approximately 95–107× lower with SQLite. This excludes old production host admission and transport proof work and is not ordinary Work click latency.

Completed utility-process measurements include Work, 1,000-Task and 10,000-Task tiers, plus over one million retained operations. Five completed 100-Task disposable UI profiles produced task/Step update p95 near 21 ms and editor p95 near 20 ms. These omit ordinary Work's Atlas, real-vault indexing, covers and live synchronization. The 1,000-Task UI harness was written but not run. Larger old-engine comparisons are incomplete/unstarted; do not infer ratios for them.

## Complete these product gaps

1. **Recurrence:** existing daily/weekly fixed-origin civil-date rules, explicit series zone, occurrence uniqueness, atomic completion plus successor generation, and reopening/recompletion without duplicate successors. Current recurrence commands explicitly reject. Preserve flat Step templates; do not import proof graphs.
2. **Oath:** use stable Task IDs, revisions and committed completion events. Verify completion/reopening semantics and preserve Atlas enforcement/lifecycle.
3. **Production consumers:** connect Home, Project, Resource, Schedule, History, Statistics and Progress directly. Complete owner/context/Phase validation, dates/importance/location controls, Step reorder UI, pagination and reconnect/view-close behavior. The experimental editor is deliberately incomplete.
4. **Host/package:** wire one device-local service per workspace into the actual installed runtime, including trusted IPC, owner metadata updates, startup failure handling and graceful drainage. Keep SQL off renderer/main. Verify genuine disposable clients before Work cutover.
5. **Cutover:** archive the exact closed old software, repositories and History; prepare an **empty** new Work database outside OneDrive. No importer, re-enrollment or key regeneration. Only after product acceptance perform the separately authorized stationary cutover, explicitly label synchronization unavailable, and remove the superseded active runtime. Keep the old baseline only as an external archive.

**No live synchronization exists.** The outbox and test consumer are not Personal Sync v2/Git/N4 compatibility. Future ingestion requires peer authentication, owner authorization, bounded validation, duplicate detection and conflict handling; none may gate local confirmation. Laptop acceptance remains deferred.

## Evidence and stop limitation

Private evidence root:

`%LOCALAPPDATA%/Itacan/DevelopmentEvidence/TaskCoreVNext/sqlite-20261102/`

Read `REPORT.md`, `RESULTS.json`, `PACKAGE.json`, `FINAL-INTEGRITY.json`, `COMPARISON-STATUS.json`, `conclusion-tests.tap`, `recovery-conclusion/` and `ui-conclusion/`. The ten-file package is in `package/`; its manifest SHA-256 is `4064cdc359e4f461cb20f0b32d1febb08358ee8131d4ddf61eccad5a26930aad`.

The active old comparison disappeared after its controllers were stopped, without its final result or normal close record. Graceful drainage is **not confirmed**; exact exit cause is unknown. Eleven PID-28824 locks remain in `bench-old-scoped-medium/repository/`, with all eleven CURRENT-referenced committed generations validating read-only. They are **synthetic benchmark artifacts, not original Work authorities**. Preserve them; do not reopen, delete locks or perform recovery as part of integration. See `STOP-REQUEST.json` and `STOP-RESULT.json`. Earlier incorrect one-repository comparison results are excluded and retained separately.

The idle controller scripts `tools/finalize.cjs`, `tools/compare.cjs` and `tools/finish-measurements.cjs` are historical experiment orchestration, not instructions to resume them. No benchmark job should remain running. Reuse the focused correctness tests and disposable-client harness as needed for integration; do not launch another large benchmark campaign without a new request.

No commit, push or reset. Preserve collaborator changes. Do not install or modify ordinary Work merely to reproduce this experiment.
