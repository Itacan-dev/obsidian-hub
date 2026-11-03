# Itacan on macOS

The prototype keeps its existing SQLite/Electron utility-process architecture.
These portability changes have Windows regression coverage and simulated macOS
coverage. Physical Mac acceptance is pending Jinhao's checks below.

Implementation verification on Windows (2026-11-03): 79 focused TaskCore tests
and 20 plugin/Oath tests pass. An isolated hidden Electron window exercised the
actual remote bridge, rebuilt packaged utility, task create/read and clean close
with Electron 43.7.7, Node 24.21.0 and SQLite 3.53.4. It used a temporary profile,
vault and database. This is Windows host evidence; macOS remains unverified.

## Install

1. Install the normal official Obsidian application from <https://obsidian.md/download>.
   Use a current installer: an application update alone may retain an older
   Electron runtime. Capability checks, rather than a version number, determine
   whether the main-process bridge and SQLite utility are usable.
2. Obtain the complete updated repository and open its root as an Obsidian vault.
   Include hidden `.obsidian` files, `System`, `Assets`, `AtlasCore` and
   `ItacanTaskCore`. A three-file community-plugin copy is insufficient. The
   existing `build.js --output-dir` output is also not a complete distribution;
   it does not include every manifest, stylesheet and Atlas managed-list resource.
3. Enable Hub Project Menu, Dataview (including JavaScript queries), Heatmap
   Calendar and the core Web viewer. Enable the dashboard CSS snippets described
   in the root README, then open Home in Reading view.
4. Keep Music disabled during initial verification. Strict Oath is unavailable
   on Mac; ordinary Oath remains available. Existing Music preferences are preserved.
5. Quit and reopen Obsidian after replacing native plugin assets. Atlas/main
   modules remain cached across plugin reloads.

The task database is device-local:

```text
~/Library/Application Support/Itacan/TaskCore/<local-vault-hash>/tasks.sqlite
```

SQLite WAL/SHM and `task-sync-device.json` stay beside it. Do not copy that
directory from another computer. Windows retains its original LOCALAPPDATA path,
vault hash and pending-command keys. Renaming/moving a vault changes its local
storage identity; it is not a database migration operation.

## Personal OneDrive enrollment

Each developer normally has an independent checkout and private task workspace.
Only join a personal workspace whose task data you intend to synchronize. Git
collaboration does not share private tasks or the ignored transport directory.

- Mark the personal vault **Always keep on this device**. For an existing
  workspace, keep Obsidian closed until its `.itacan-task-sync/workspace-*.json`,
  referenced baseline parts and plugin assets have arrived. Do not start a new
  empty transport directory while an existing workspace is still downloading.
- The Mac creates its own local device UUID and adopts the manifest's shared
  workspace/authority. Different Windows/Mac vault paths are expected.
- If independent tasks already exist, use **Review personal task synchronization**
  and explicitly review enrollment/conflicts. Do not replace/reset a database.
- **Ready** means reconciliation with locally available transport files; it does
  not prove that OneDrive delivered them to another computer.
- Atlas policy storage has its existing exclusive-ownership restriction. Do not
  concurrently open the same synchronized Atlas authority on independent machines.
  Independent developer checkouts have independent Atlas state.

## Minimal Mac checks

1. Launch normally from Finder. Run **Hub Project Menu: Task runtime diagnostics**
   from the command palette. Confirm `stage: ready`, main/utility runtime versions,
   and a SQLite version in the utility's `versions`. Tasks should become available.
2. Create/edit a task with Steps, complete/reopen it, and test daily/weekly
   recurrence. Quit normally and reopen; verify task/Step identities and content
   persist and there is exactly one recurring successor.
3. Check Home, Projects, Resources, Schedule Overview/Week/Month, Roadmap, History,
   Statistics, Progress, Inbox and Quick Add (Command+Shift+Space). Create, rename
   and open a note/folder. Daily Brief retains its development-only availability.
4. On the intended personal OneDrive workspace, exchange one task in each
   direction, then test an offline edit and an explicit conflict choice. Verify
   stable task identities and completion History without duplicates.
5. In Note view, open Atlas and test allowed/blocked destinations, temporary
   access confirmation, redirects and a tab/pop-out move. Restart and verify
   policy persistence. Enforcement failure must leave Atlas browsing blocked.
6. Search a Markdown note and searchable PDF with Athena and open a citation.
   Ollama remains optional and needs its own local setup. Test website shortcuts
   in the default browser and Zotero (installed in Applications).
7. Test ordinary Oath entry, fulfillment, explicit exit and restoration, including
   Escape, Control+Command+F, window-close requests and sleep/resume. Check both
   initially windowed and already-fullscreen windows. Strict controls stay unavailable.

Record macOS version, Apple Silicon/Intel architecture, Obsidian application and
installer versions. Passing on one architecture does not establish the other.

## If startup or fullscreen fails

Run **Task runtime diagnostics** and copy its developer-console object plus the
first exception stack (Command+Option+I opens developer tools). The snapshot
contains the startup stage, renderer/main/utility versions, latest error code,
bounded utility stderr and exit information when available. Paths may identify
your local user/vault; review before sharing. It contains no task payloads.

Also record Task sync's status/error, pending original-operation count from
**Native task recovery**, Atlas Diagnostics/Recovery output when relevant, and
the observed fullscreen action/event sequence. If the official host does not
provide the bridge, utility process or `node:sqlite`, report that exact failure.
Do not patch/re-sign Obsidian, change its bundle, or install a task daemon.

## Development

Use Node 24 or newer for the build and focused TaskCore suite:

```sh
node .obsidian/plugins/hub-project-menu/build.js
npm test --prefix ItacanTaskCore
node --test .obsidian/plugins/hub-project-menu/lib/tests/macos.test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/plugin-load.test.js
```

Ordinary builds use shipped Athena/Atlas artifacts. If changing their sources,
install their dependencies on the Mac and follow the root README rebuild steps;
do not copy Windows `node_modules`. `HUB_TEST_BROWSER` selects a browser executable
for the existing browser fixture runner. Homebrew/system Node does not replace
the Node runtime embedded in Obsidian's task utility.
