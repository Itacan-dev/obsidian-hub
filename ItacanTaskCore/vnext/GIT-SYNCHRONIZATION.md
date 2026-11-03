# Git synchronization of shared Project Tasks

Implemented and installed in ordinary Work on 2026-11-03. SQLite remains the authoritative local store. Git and OneDrive carry changes through the existing utility-process TaskCore; neither transport runs SQL in the renderer or performs Git commands.

## Integration

Local commands still commit Task/Step/History/recurrence changes, their operation, ancestry and outbox in one SQLite transaction. Schema 4 adds a retained logical-change journal and last-public Project membership bookkeeping. These are transport records, not another task engine. Incoming changes use the existing application, ancestry comparison, conflict records, recurrence validation and explicit resolution interface.

A logical operation keeps its operation ID, command hash and task/series ancestry across transports. Opaque logical writer IDs are distinct from private OneDrive device identities. The migration translates existing ancestry without resetting databases, changing device identity, or rewriting Task/Step/History identities. OneDrive's original streams remain supported. Git-imported changes also travel through bounded immutable OneDrive `bridges/` batches. OneDrive-imported changes enter the same journal and remain eligible for Git publication. Durable publication/receive cursors and operation receipts prevent repeated application and unbounded feedback. Receiving a change does not invent a new edit.

## Scope and storage

Eligibility comes only from `System/Hub-shared-projects.json`, used by the existing shared Project/Roadmap lifecycle. Finding `.git` alone never enables sharing. The existing Project UUID is the shared synchronization identity. A `project.json` identity check binds the directory to that UUID. Project owners are translated between each developer's local authority and the shared UUID; absolute vault paths, drive letters, personal authorities and private device identities do not enter Git files. Existing opaque folder/note references depend on Project identity and relative location. Phases retain their existing IDs.

The actual enabled directories are:

```text
Projects/Itacan/.itacan-tasks/
Projects/Obsidian Hub/.itacan-tasks/
    project.json
    streams/<opaque writer UUID>/0000000000000001.json
    streams/<opaque writer UUID>/0000000000000002.json
```

Each writer appends immutable batches, normally up to 32 changes and approximately 1 MiB; an individual file must fit the existing 8 MiB bound. A prepared batch and its publication position are durable before file I/O. Publication flushes a temporary file and atomically renames it; checkpoint interruption retries the same prepared bytes. A deferred item does not advance its membership or cursor. Temporary files are ignored. Retained streams have no automatic pruning.

Only collaborative Task payloads, their relevant Steps, History, recurrence and operation/ancestry metadata are exported. Resources, private Projects, personal settings, Oath sessions, workspace identities and device identity files stay outside Git. Private historical owner IDs are represented by the collaborative task's owner. Existing audited acceptance-fixture exclusions are honored; old synthetic outbox fixtures are not replayed.

Moving an ordinary task out of sharing publishes a tombstone containing its last public content, while the actual local task and subsequent private edits remain personal. Git history still contains previously shared content. Returning a task to a shared Project explicitly publishes its current content and retained task History. Transfers between shared Projects preserve identity and ownership. A personal original arriving after a redacted Git withdrawal restores the private version under the same logical change identity.

A recurring series wholly inside shared Projects supports recurrence, concurrent completions, History and transfers. A whole series can leave and rejoin sharing. Publication pauses with an actionable error when a series has occurrences split between private and shared owners: move the entire series into shared ownership before publishing it. This prevents private templates/occurrences from entering Git or being changed by a collaborator's series resolution. Local SQLite task work continues.

## Enrollment, observation and conflicts

Enrollment captures current real state using existing TaskCore envelopes, including retained uncounted History and tombstones. It reuses available logical roots instead of creating competing baselines on each personal device. Independent existing Task IDs combine; overlapping identities with divergent ancestry enter the existing conflict review without overwriting either local version. No database reset or personal identity regeneration is involved.

Concurrent changes to separate tasks combine. Concurrent edits to the same Task or recurring series preserve both versions for the existing whole-Task/series choice. A resolution carries merged ancestry through both transports. Rejected recurring successors remain tombstones and rejected completions remain uncounted audit History.

Startup imports available files automatically. Filesystem observation handles arrivals while open; 15-second reconciliation covers missed notifications. Import reads exact next batch names with bounded work. Schema, Project/owner identity, table references, file bounds, recurrence, ancestry and location references are checked before transactional application. Linked directories and traversal references are rejected. Merge-marker content reports an error without modifying Tasks. Unsharing or an unavailable repository stops publication and preserves local data. A missing previously established sync directory waits for restoration rather than discarding its history.

Use **Review shared Project task synchronization** or click **Task sync** for Project status and the existing conflict review. Ready describes files available locally, not remote Git/OneDrive delivery.

## Verification and installation

The focused tests use independent SQLite service processes and disposable real Git repositories with manual local commits, pushes, pulls and merges. They cover two developers with two personal devices each, full Task metadata, Steps/reordering, completion/reopening, History, recurring conflicts, offline independent edits, duplicate delivery, restart, populated enrollment, overlapping identities, private exclusions, transfers, unsharing, unavailable repositories, atomic batch retry, size-deferred withdrawal, linked directories and unsafe references.

The final accepted installation is recorded in `%LOCALAPPDATA%/Itacan/DevelopmentEvidence/TaskCoreVNext/git-stage-20261103-3/` (`WORK-UPDATE.json`, `WORK-GIT-RESTART.json`). The initial stationary acceptance is in `git-stage-20261103-2/`. Both installations retained closed SQLite backups. The complete plugin passed 17 existing installed-host UI checks; focused Git installed-host checks verified automatic import across different Project checkout paths, actual Home/Project/History delivery, Git-trackable files and the Project status modal. The final suite passes **91 tests**, including **12 focused Git cases**; the strict TypeScript declaration fixture also passes. Final installed Git acceptance is `git-ui-20261103-6/`.

`git-stage-20261103-2/WORK-GIT.json` records ordinary Work create/complete/reopen/delete and incoming import. All preexisting owner, Task, Step, History, recurrence, operation, outbox and cursor rows were verified unchanged, as was `task-sync-device.json`; SQLite integrity and foreign keys pass. Both actual Project directories are trackable and exclude private identities and the historical audited fixtures (`git-stage-20261103-2/WORK-GIT-PRIVACY.json`). The two newly created acceptance Tasks were deleted, with no counted acceptance completion left. Their new immutable audit records are intentionally retained.

The final ordinary Work restart preserves all three original active Task observations, the original counted History, all 11 owners and the personal device identity. All 40 packaged output files match the accepted final stage. Both Git Projects and personal synchronization report ready, and Work is left open normally.

Production uses portable Node filesystem APIs and the existing Electron utility process; no Obsidian installation modification, native dependency or Windows-specific Git integration was added. Existing Windows/macOS storage and build paths remain intact. Physical Mac and real remote OneDrive/Git propagation still require acceptance on the participating computers.

## Jinhao's first use

1. The developer manually commits and pushes the updated plugin source/output, `ItacanTaskCore`, and both Project `.itacan-tasks` directories through the normal workflow. Include every new immutable sync file, including `project.json`; do not commit personal `.itacan-task-sync`, SQLite files or `task-sync-device.json`.
2. Close Obsidian on Jinhao's computer and manually pull the update into his own Work checkout. Preserve his existing SQLite database and personal OneDrive directory. Do not copy another person's database, personal workspace manifest or device identity. Ensure every participating personal computer receives the updated plugin before continuing; older plugins do not understand the new logical-writer envelope fields.
3. Open Work normally. Run **Review shared Project task synchronization**. Independent existing tasks enroll automatically without changing their identities. Review any Task/series conflict explicitly. If personal OneDrive enrollment separately asks to merge independent tasks, use its existing reviewed merge flow; do not replace the database.
4. Create a temporary Task with two Steps in Itacan. Wait for its Git Project status to be ready and verify `.itacan-tasks/streams/` appears in `git status`. Commit and push manually. The other developer manually pulls; the open application should import automatically, with a 15-second missed-notification fallback. Repeat in the reverse direction and in Obsidian Hub.
5. Verify Step completion/reordering, task completion/reopening and History on both sides. Verify a daily recurring Task produces one successor; review deliberately concurrent edits through the existing conflict choices. Delete the temporary tasks when finished; retain their tombstones.
6. On each developer's other personal computer, verify OneDrive receives a Git-imported task. Make a new edit there, let OneDrive deliver it to that developer's Git checkout, then manually commit/push/pull and check it reaches the collaborator. These physical checks have not been performed by this implementation session.

Git commit, push, pull, merge and conflict-file repair remain manual. Jinhao's physical checkout was not accessed or modified.
