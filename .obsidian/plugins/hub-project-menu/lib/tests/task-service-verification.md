# Phase 2B-1 — executed verification

Date: 2026-10-16, Europe/Stockholm. The facade remains inactive.

## Results

| Check | Executed result |
| --- | --- |
| `task-service.test.js` | 33 tests passed: DTOs, identities, delegated mutations, failures, concurrency, exact action timestamps and lifecycle |
| `task-service-contract.test.js` | 4 tests passed: common read expectations and explicit capability/reveal differences for legacy and representative native DTO fixtures |
| `task-service-sharing.test.js` | 3 tests passed using the actual local/shared store in unique synthetic Temp vaults |
| `task-service-boundary.test.js` | 2 tests passed: production import graph/bundle isolation and platform-free module import |
| Focused total | **42 passed; 0 failed, skipped or cancelled**; final run about 345 ms |
| Existing selected regressions | **24 test files passed; 0 failed**; about 1.3 s; many assertions within each script |
| Unchanged Phase 2A suites | **66 tests passed; 0 failed, skipped or cancelled**; about 5.5 s |
| Application declaration/API fixture | TypeScript 6.0.3 strict check, **0 diagnostics** |
| Phase 2A declaration/API fixture | TypeScript 6.0.3 strict check, **0 diagnostics** |

The initial focused run exposed one missing error mapping: a deleted owning-Project
Phase produced the generic write error rather than `VALIDATION`. The mapping was
corrected to recognize the actual existing service message. The validation assertion
was retained. There are no unresolved failures in the executed suites.
Final review also corrected completion timing across asynchronous preflight reads:
the facade now captures action time before that work, preserves explicit draft
timestamps, and verifies that repeated requested states do not create new events.

## Isolation and behavior evidence

Task fixtures reuse `HubTaskDataService`, `HubTaskEditor`, the existing parsers and
the actual compiled Wizard history methods. Compilation never invokes plugin onload.
Obsidian is stubbed within the test process; Notes are Maps and synthetic Dataview
pages. The fixture refuses folder-note creation. No actual user `Tasks.md` is created.

Nine paired cases invoke direct editor operations and facade operations against
separate identical fixtures: edit fields, completion, Step add/edit/leaf deletion/
subtree deletion/completion, Phase assignment and task deletion. Assertions compare
complete source text, metadata, checks and history, then compare the returned DTO
with a canonical re-read. Only incidental random UUID values are normalized for the
cross-fixture comparison; existing IDs, structure, times and recorded facts remain
asserted. Parent/Step reopening and deletion/history retention are also checked.

Other checks cover unassigned reads without writes, date-only versus midnight,
description, local/shared metadata, Resource ownership, Step ancestry, duplicate
IDs within/across files, moved/deleted notes, changed titles/lines, source and
metadata preconditions, malformed drafts, missing Phase, write/metadata failures,
failed rollback with partial source state, and a saved note with failed history.
The latter returns `legacy-applied` with unconfirmed history and retains the existing
Notice; no fabricated atomic success is asserted.

Creation comparisons exercise the actual caller-owned legacy ID retry service,
including concurrent replay and conflict. Ordinary creation preserves its unassigned
Markdown shape. The result deliberately contains `task: null` rather than searching
by title. Existing creation/Inbox regression tests exercise their broader workflows.

Sharing fixtures create private Project, Itacan, Obsidian Hub and mounted Resource
notes in a verified unique Temp vault. They use `HubDataStore`/`SharedProjectStore`
for effective load, ownership discovery, partitioned writes and external conflict.
Both shared Projects publish metadata; private and Resource metadata remain local.
The Resource mount neither changes owner nor expands a Project's task visibility.
An external Git-state change rejects the save and leaves its bytes intact while
the synthetic source write is rolled back. These tests never open real shared data.

Subscription checks verify a single backend watcher for multiple/duplicate callbacks,
import invalidation, no events from reads, async/sync subscriber error isolation,
individual disposal, queued-frame cancellation and shutdown without destroying a
current external UI subscription. Events remain invalidations of unknown durability.
Concurrent stale saves and close while a write is accepted are tested explicitly.

Native DTO tests are static representative read fixtures only. They demonstrate
source-free application data/reveal and discriminated capability handling. They do
not implement a native application adapter or re-test native persistence through
this facade. Phase 2A independently supplies the repository persistence evidence.

## Existing regression files executed

`tasks.test.js`, `task-mutations.test.js`, `task-data.test.js`,
`task-planning.test.js`, `task-progress.test.js`, `task-history.test.js`,
`task-creation-retry.test.js`, `task-created-completion.test.js`,
`task-association-removal.test.js`, `task-composer-routing.test.js`,
`task-form.test.js`, `task-date-presentation.test.js`,
`project-planning.test.js`, `roadmap-milestones.test.js`,
`shared-projects.integration.test.js`, `data-store.integration.test.js`,
`inbox.test.js`, `oath.test.js`, `oath-workspace.test.js`,
`oath-shared-resources.test.js`, `workspace-state.integration.test.js`,
`statistics.test.js`, `context-search.test.js`, `daily-brief.test.js`.

The existing workspace-state fixture prints an expected simulated
`HUB_STATE_CONFLICT` warning while passing its external-write protection assertions.
It is not a real vault conflict or an unresolved test failure.

## Environment and repeat commands

Windows, Node **24.21.0**, provided by the already installed VS Code executable in
`ELECTRON_RUN_AS_NODE=1` mode. Node is unavailable directly on PATH. Tests ran through
hidden `Start-Process -Wait` helpers with output logs in OS Temp; no VS Code UI or
Obsidian UI was launched. No dependency/compiler install occurred. TypeScript 6.0.3
was already bundled in the installed VS Code extension dependencies.

Equivalent commands when Node/TypeScript are available:

```text
node --test .obsidian/plugins/hub-project-menu/lib/tests/task-service.test.js .obsidian/plugins/hub-project-menu/lib/tests/task-service-contract.test.js .obsidian/plugins/hub-project-menu/lib/tests/task-service-sharing.test.js .obsidian/plugins/hub-project-menu/lib/tests/task-service-boundary.test.js
node .obsidian/plugins/hub-project-menu/lib/tests/task-service-typecheck.cjs <existing-typescript.js>
node --test ItacanTaskCore/tests/contract.test.cjs ItacanTaskCore/tests/persistence.test.cjs
node ItacanTaskCore/tests/typecheck.cjs <existing-typescript.js>
```

No live Obsidian/browser smoke, other OS validation, actual Tasks-plugin recurrence
integration or host-scale read performance benchmark was executed. Static graph
checks and preserved hashes establish this phase's integration isolation; they do
not claim future consumer UI compatibility. The two historically documented browser
layout failures were not rerun or labelled passing. No consumer was changed here.

## Safety evidence

Before implementation, the targeted safety baseline captured SHA-256 hashes of
**1,478 pre-existing files** and **155 pre-existing Git status entries**. It includes
tracked/untracked work, task Markdown, the entire Phase 2A package, relevant local
and shared JSON, plugin settings, source and installed `main.js`. It does not claim
to inventory opaque media/dependency assets. No existing file needed editing, so
no pre-edit file replacement/backup was necessary.

The final comparison found **zero changed or missing baseline files** and **zero
lost pre-existing status entries**. The new entries belong only to these facade,
adapter, declaration, test and documentation files. The Phase 2A `.gitignore` change
was already present and was not edited in this phase. No task Markdown, real task
metadata, shared Project files, plugin settings or installed build changed. There
was no app-managed workspace-file exception in this phase's final comparison.

No CURRENT/RECOVERY manifest, WRITER lock or native generation file exists in the
real vault after testing. Production graph traversal proves the facade/core are
not reachable from the entry module; installed bundle checks also exclude the new
facade. Existing consumers remain byte-identical. No build/install/reload/restart,
Git synchronization, migration, commit, reset, rebase or clean was performed.

Synthetic filesystem fixture cleanup resolves and verifies the owned Temp parent
and generated prefix before recursive removal. Other fixtures use memory only.
Safety inventories and full command logs remain at:

`C:\Users\El_Baraka 2025\AppData\Local\Temp\itacan-phase2b1-28631893383f4e40a161e20e4508408b`

The key artifacts are `baseline-targeted.json`, `safety-final.json`,
`release-focused.out.log`, `regressions.out.log`, `core.out.log`,
`final-types.out.log`, `core-types.out.log` and `runtime.out.log`.

Implementation/method coverage: `../services/TASK-SERVICE.md`.
Next read-consumer scope: `../services/TASK-SERVICE-PHASE-2B-2.md`.
Phase 2B-1 stops here for review.
