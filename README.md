# Obsidian Hub / Itacan

This repository is an Obsidian vault containing the shareable Hub implementation.
Personal work and runtime state are excluded from Git. OneDrive can synchronize
the entire working vault, including those excluded files, between your computers.

## Open a fresh clone

1. Open the repository folder as a vault in Obsidian Desktop.
2. Install and enable **Dataview** and **Heatmap Calendar** from Community plugins.
   Enable JavaScript queries in Dataview's settings.
3. Enable the bundled **Hub Project Menu** community plugin. Its generated
   `main.js` and `atlas-native.cjs` are included; no build is required for first use.
4. Enable the included `dashbboard` and `heatmap-fix` CSS snippets in Appearance.
   The optional `math-callouts` snippet supports the note templates.
5. Open `Home.md` in Reading view.

A fresh clone includes the complete collaborative `Projects/Itacan/` and
`Projects/Obsidian Hub/` trees. Other Projects, Resources, presets, last-file
references, activity records and personal reports are excluded. The plugin initializes its own private `data.json`
and the four empty Resource dashboards. Project folders are created as needed.
For optional template/script workflows, install Templater or QuickAdd and select
the relevant files under `System/Templates` or `System/Scripts` in their settings.
Each developer's vault has independent personal state.

Webviewer browsing is governed by Atlas. Enable Obsidian's native Web viewer,
then enter a Project or Resource **Note view**. Right-click a native tab header
or open its header menu and choose **Open Atlas**. This opens Atlas Home in a
native browser tab and reuses an internal Home in the same workspace. It needs
no URL note or selected text and is absent outside Note view.

Atlas in Hub Settings has six sections: Sites & Access, Temporary Access, Timings,
Vault, Managed Lists, and Diagnostics / Recovery. Explicit initialization on an
unused repository offers the curated preset (32 destinations, 58 exact hosts)
and shows the timing terms. Existing policy is preserved; importing the starter
set later requires Vault confirmation. Names, categories and pins are display
preferences; hostname/access and protected timing changes use Vault.
Vault shows changes immediately, enables **Confirm change** when ready, and
offers **Recreate proposal** after expiry. Settings keeps a stable size with
internal scrolling. Note content tab strips also offer **Open Atlas** on right-click.

StevenBlack managed blocking starts from a verified offline bundle or last-good
cache. Background refresh runs at most daily; Managed Lists offers manual refresh
and exact-host lookup. Failed updates retain the last-good list. Manual Blacklist
takes precedence over explicit Whitelist, which takes precedence over managed
blocking. Unknown destinations use Request access → wait → explicit confirmation.
Confirmation opens a fresh homepage, preserving no login request or POST body.
See [the architecture](System/Hub-atlas-architecture.md) and
[navigation/security review](System/Hub-atlas-security.md) for compatibility limits.

## Development

- `.obsidian/plugins/hub-project-menu/plugin.js` and `lib/` are the plugin source.
- `System/Dashboards/` holds Dataview views; `.obsidian/snippets/` holds CSS.
- `System/Templates/`, built-in `System/Project Templates/`, and `Assets/` contain
  the shared templates and UI artwork allowed by `.gitignore`.
- `Projects/Itacan/` and `Projects/Obsidian Hub/` are shared in full, including
  documentation, tasks, roadmaps, Atlas, screenshots and design assets. Project
  content is collaborative; global Hub runtime state remains private.

With Node installed, run from the vault root:

```sh
node .obsidian/plugins/hub-project-menu/build.js
node .obsidian/plugins/hub-project-menu/lib/tests/workspace-state.integration.test.js
node .obsidian/plugins/hub-project-menu/lib/tests/presets.test.js
node .obsidian/plugins/hub-project-menu/lib/tests/data-store.integration.test.js
node .obsidian/plugins/hub-project-menu/lib/tests/plugin-load.test.js
```

Quit and reopen Obsidian after upgrading Atlas's native bundle. The main-process
service remains cached across plugin reloads; an older service displays a restart
notice and the new UI stays blocked. Ordinary UI-only rebuilds may reload the plugin.
The browser fixtures can be run with
`lib/tests/run-browser-test.js`; set `HUB_TEST_BROWSER` to a Chromium executable
when it is not installed at the runner's default Windows Chrome location.
The pinned Electron test installation below can also run the HTML fixtures with
`node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/browser-launch.cjs`.
It renders offscreen in isolated profiles and needs no Chrome installation.

AtlasCore is unchanged framework-independent TypeScript in `AtlasCore/packages/core`.
After changing Core or the curated preset copy, rebuild their CommonJS artifacts
before rebuilding Hub. The bundler checks source/artifact hashes and refuses stale
generated code. From PowerShell:

```powershell
npm.cmd --prefix AtlasCore/packages/core ci --ignore-scripts --no-audit --no-fund
npm.cmd --prefix AtlasCore/packages/core run typecheck
npm.cmd --prefix AtlasCore/packages/core test
node .obsidian/plugins/hub-project-menu/build-atlas.js
node .obsidian/plugins/hub-project-menu/build.js
node --test .obsidian/plugins/hub-project-menu/lib/tests/*.test.js
node --test .obsidian/plugins/hub-project-menu/lib/atlas/tests/*.test.js
```

Native tests require the development-only pinned Electron and remote packages:

```powershell
npm.cmd --prefix .obsidian/plugins/hub-project-menu/lib/atlas/tests/native ci --ignore-scripts --no-audit --no-fund
node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/node_modules/electron/install.js
node AtlasCore/packages/core/node_modules/typescript/bin/tsc -p .obsidian/plugins/hub-project-menu/lib/atlas/tsconfig.json
npm.cmd --prefix .obsidian/plugins/hub-project-menu/lib/atlas/tests/native test
```

The native launcher clears `ELECTRON_RUN_AS_NODE`, hides its windows, uses only
synthetic local hosts and a temporary profile, and requires a complete passing
report plus a clean process exit. It never opens your vault. Restricted execution
environments may need permission for the Electron download and Chromium child
processes. Electron and remote are not production plugin dependencies.

## Personal data and synchronization

See [the persistence and Git boundary](System/Hub-personal-data.md) for exact
locations, migration behavior, Git checks, and OneDrive conflict handling.
New top-level vault folders are private by default. Add explicit exceptions to
`.gitignore` when introducing a new shareable source location.

Atlas authority is private under `.obsidian/plugins/hub-project-menu/atlas-state/`.
Do not manually edit/reset it or restore it through Hub presets/backups. Atlas
uses exclusive local ownership; simultaneous use of the same OneDrive authority
from independent machines is not supported. An unavailable repository stays
blocked and offers explicit reconciliation, rather than resetting policy.

The vault-root repository tracks both collaborative Projects as ordinary files.
The former nested `Projects/Itacan/Meta/.git` metadata, including its history and
index, is preserved locally at `System/Backups/Git/itacan-meta.git` (ignored).
There is no nested repository or submodule dependency in either shared Project.
Use the vault-root repository for sharing the Hub. No commit or push was made
as part of establishing or revising this boundary.
