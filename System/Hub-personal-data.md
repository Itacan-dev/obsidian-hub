# Personal Hub state and Git boundary

## Persistence

The old workspace store was the Electron/browser `localStorage` key
`obsidian-hub::workspace-mode::<vault name>`. It contained presets, workspace
layouts, Last File and Last Workspace. Folder preferences used
`obsidian-hub::folder-ui::<vault name>::<context id>`; a legacy Last Project
key also existed.

The authoritative store is now
`.obsidian/plugins/hub-project-menu/data.json`:

- `workspaceMode`: complete presets, native note/browser layouts, tab order,
  selected/active tabs, rail placement, workspace records and last references.
- `folderUi`: current per-workspace folder preferences. A preset also retains
  its own complete folder snapshot under `workspaceMode.presets`.
- `workspaceMigration`: import ledger and original legacy snapshots, retained
  only for recovery. Runtime reads do not use these snapshots.
- Existing fields: activity and completed-task history, progress ratings and
  reports, work logs, Focus, task metadata, Oath state/history, custom categories,
  card ordering, image choices and placement preferences.

The plugin's existing `HubDataStore` reads via `loadData()` and performs queued,
atomic replacements of this conventional plugin data file on desktop. Its
fallback uses `saveData()`. Unchanged workspace/folder values do not cause writes.
There is no new sync service or runtime Git dependency. The device identifier
may still live in localStorage; it identifies writers and is not preset content.
Transient session-only UI preferences remain session-only.

## Migration and recovery

Startup reads legacy local state for the current vault name. On the first
migration it retains complete workspace and folder state. If vault-backed state
already exists, that state wins; previously unseen presets are added by ID.
Missing IDs receive deterministic IDs. Names, unknown fields and complete
configurations are preserved.

The import ledger records source fingerprints and imported preset IDs. Repeated
starts do not duplicate presets, and stale local data on another computer cannot
resurrect already-imported presets that were subsequently deleted. Different
legacy configurations with the same ID are kept in recovery snapshots without
overwriting the active vault version. Legacy localStorage originals are left
intact. Migration is marked complete only after a successful disk write.
Malformed legacy JSON or a failed migration write stops initialization with an
error instead of silently replacing data with empty state.

Reload the updated plugin on each computer once to import that computer's old
presets. Let OneDrive finish syncing before opening the vault on another machine.
A running Hub caches its loaded state: reload after another machine changes the
file. If the disk file changed since loading, the existing conflict protection
rejects writes and displays a notice, preserving the on-disk version. Simultaneous
offline edits can still produce OneDrive conflict copies; use the existing
**Audit Hub data** and backup tools to inspect them. No automatic merge is claimed.

Hub backups wait for pending state writes and include the new fields through
`pluginData`. Restoring an older backup can still migrate its legacy local state.
Presets referencing unavailable notes/workspaces retain the existing graceful
missing-reference behavior.

## Exact personal locations

| Location | Personal content |
| --- | --- |
| `.obsidian/plugins/hub-project-menu/data.json` | Presets, navigation, history, progress, tasks and other Hub state |
| `.obsidian/plugins/*/data*.json`, `.data.*.tmp` | Plugin state, conflict copies and atomic-write temporary files |
| Other `.obsidian/` configuration files | Native workspaces, bookmarks, installed-plugin settings, device preferences and credentials |
| `Projects/` except `Projects/Itacan/` and `Projects/Obsidian Hub/` | Other personal project content, notes and task logs |
| `Resources/` | Personal Resource dashboards, notes and content |
| `Archive/`, `Areas/`, `Daily Notes/`, `Inbox/`, `Knowledge/`, `Sources/`, `old (DONT DELETE)/` | Other personal vault content |
| `System/Backups/`, `System/Migrations/` | Usage snapshots and migration records |
| `System/Project Templates/` except Physics Research, Nonfiction Book and Fiction Book | User-created category templates |
| `Assets/Covers/Home/`, `Assets/ProjectCards/Categories/`, `Assets/ProjectCards/Projects/` | Uploaded personal covers and custom category/project images |

## Complete collaborative Projects

`Projects/Itacan/` and `Projects/Obsidian Hub/` are shared in full. This includes
project entry notes, Atlas, Meta, tasks, roadmaps, screenshots, design assets,
source and future subfolders. Their project content is intentionally collaborative.
References to Resources do not include the referenced Resource files in Git.
Each developer still has separate presets, task metadata, Oath state, Focus,
History, Progress, navigation and other global state in ignored plugin data.

The relevant root `.gitignore` rules are:

```gitignore
/*
!/Projects/
/Projects/*
!/Projects/Itacan/
!/Projects/Obsidian Hub/

# These follow generic machine-copy/log exclusions so project content is shared.
!/Projects/Itacan/**
!/Projects/Obsidian Hub/**

# These follow the project exceptions and remain excluded everywhere.
**/.env
**/.env.*
**/node_modules/

/Resources/
/System/Backups/
/System/Migrations/
/.obsidian/plugins/*/data*.json
/.obsidian/plugins/*/.data.*.tmp
```

The complete root file also retains the Hub implementation/template/default-asset
exceptions and private Obsidian configuration, uploads and vault-content rules.
The former file allowlist in `Projects/Itacan/Meta/.gitignore` has been removed;
that file now contains explanatory comments only. No existing project content
files remain excluded. Secret environment files and generated dependency trees
would still be excluded if created in either Project. All other Projects and
all Resources remain private by default and continue to synchronize via OneDrive.

## Git verification and preserved history

```sh
git status --short
git check-ignore -v --no-index Projects/Itacan/Itacan.md
git check-ignore -v --no-index Projects/Itacan/Meta/Tasks.md
git check-ignore -v --no-index Projects/Itacan/Meta/ROADMAP.md
git check-ignore -v --no-index "Projects/Obsidian Hub/Obsidian Hub.md"
git check-ignore -v --no-index Resources/Knowledge/Knowledge.md
git check-ignore -v --no-index .obsidian/plugins/hub-project-menu/data.json
git ls-files --stage -- Projects
```

A reported rule starting with `!` is an inclusion exception. Use
`git check-ignore -q --no-index <path>` to test actual exclusion: exit 1 means
not ignored and exit 0 means ignored, regardless of staging.

The former nested `Projects/Itacan/Meta/.git` directory was moved intact to
`System/Backups/Git/itacan-meta.git`, preserving its history, configuration,
reflogs and index locally without importing them into the collaborative root
history. The archive is ignored and stays inside the OneDrive vault. Both
collaborative Projects now resolve to the vault-root repository and contain
ordinary tracked files, with no gitlinks or nested-repository dependencies.
Project content was not moved or deleted. The old restrictive `.gitignore` was
replaced with comments; the former task/roadmap/screenshot exclusions no longer
apply. No unrelated history was rewritten and no commit or push was performed.

Inspect the preserved history from the vault root with:

```sh
git --git-dir=System/Backups/Git/itacan-meta.git log --oneline
```

The preserved index reflects its state when archived; it is not used to stage
the collaborative Projects. A fresh clone receives both complete development
Projects and the Hub implementation, without other Projects, Resources, global
runtime state or the archived Git metadata. Follow the root README to install
Obsidian dependencies; each developer initializes their own private state.

## Validation

The filesystem integration test exercises empty state, actual snapshot creation
with note and browser tabs, reload, rename/update/delete, local-storage-free
runtime operations, repeat/cross-device migration, deletion protection, shared
plugin writes, failed writes and external-disk conflicts. Existing preset,
browser-layout, atomic-store, domain, plugin-load, history, task-data and Oath
tests cover adjacent behavior. Browser fixtures check the unchanged preset menu,
Last File and workspace navigation. Actual two-computer OneDrive delivery must
be verified after each machine reloads the plugin; it is not simulated as a
successful live cloud transfer.
