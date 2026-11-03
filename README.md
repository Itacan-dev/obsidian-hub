# Obsidian Hub / Itacan

This repository is an Obsidian vault containing the Hub implementation and the
shared Itacan and Obsidian Hub projects, including their planning and task metadata.
Personal work and runtime state are excluded from Git. OneDrive can synchronize
the entire working vault, including those excluded files, between your computers.

## Open a fresh clone

1. Open the repository folder as a vault in Obsidian Desktop.
2. Install and enable **Dataview** and **Heatmap Calendar** from Community plugins.
   The included Dataview settings enable JavaScript queries for the dashboards.
3. Enable the bundled **Hub Project Menu** community plugin. Its generated
   `main.js` and `atlas-native.cjs` are included; no build is required for first use.
4. Enable the included `dashbboard` and `heatmap-fix` CSS snippets in Appearance.
   Required dashboard spacing and bounded Home scrolling also ship in Hub's
   stylesheet and work without a local snippet activation setting.
   The optional `math-callouts` snippet supports the note templates.
5. Open `Home.md` in Reading view.

A fresh clone includes the complete collaborative `Projects/Itacan/` and
`Projects/Obsidian Hub/` trees. Other Projects, Resources, presets, last-file
references, activity records and personal reports are excluded. Hub loads the
shared categories, Roadmaps, task metadata and image placements from
`System/Hub-shared-projects.json`; project identity/status/folder order and task
text/checkboxes/IDs remain in the project Markdown. Shared image uploads and
category templates live in `Assets/ProjectCards/Shared/` and
`System/Project Templates/Shared/`. The plugin initializes its own private
`data.json` and the four empty Resource dashboards. Project folders are created as needed.
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

Music starts disabled. Configure it in **Settings → Music**, enable the providers
you use, and save streaming links or select local audio files. The bottom-bar
**Music** button plays those configured references; names, ordering and enablement
are private Hub data saved through the existing atomic store. Local files remain
in their current location and continue playing when Music closes. YouTube uses
its visible official player and pauses on close. Spotify uses Spotify Connect
after authorization in Music settings, with playback on a Spotify device; its
official Embed backend remains available for standalone Itacan. YouTube Music loads configured
content through Atlas's browser infrastructure and still follows Atlas policy;
shared album playlist links are preferable when an album page changes its URL
during playback. Disabling Music or a provider retains the configured library.
See [Music implementation and verification](System/Hub-music.md) for provider
capabilities, runtime limits and the isolated Obsidian checks.

Athena is an optional local research assistant in **Settings → Athena** and the
**Open Athena** command. Enable local retrieval and add exclusions first.
**Search vault** works without inference; the recording mock supports deterministic
conversations. Ollama uses downloaded local models through `127.0.0.1`, with
explicit local-only setup acknowledgement. Athena reads eligible Markdown, text,
code, notebooks and searchable PDFs; it cannot edit notes or execute code.
History stays in device-local application data outside the vault. The sidebar
and PDF worker passed isolated Obsidian checks; live Ollama inference remains
an unverified development candidate. See [architecture, setup and release gates](System/Hub-athena-architecture-and-roadmap.md).

## Development

For macOS installation, personal OneDrive enrollment and the pending physical
acceptance checks, see [Itacan on macOS](System/Hub-macos.md).

- `.obsidian/plugins/hub-project-menu/plugin.js` and `lib/` are the plugin source.
- `System/Dashboards/` holds Dataview views; `.obsidian/snippets/` holds CSS.
- `System/Templates/`, built-in `System/Project Templates/`, and `Assets/` contain
  the shared templates and UI artwork allowed by `.gitignore`.
- `Projects/Itacan/` and `Projects/Obsidian Hub/` are shared in full, including
  documentation, tasks, roadmaps, Atlas, screenshots and design assets. Project
  content is collaborative; global Hub runtime state remains private. Future
  shared task/Roadmap/category/image edits update the tracked shared state through
  the same Hub save queue; no manual export is needed.

With Node installed, run from the vault root:

```sh
node .obsidian/plugins/hub-project-menu/build.js
node .obsidian/plugins/hub-project-menu/lib/tests/workspace-state.integration.test.js
node .obsidian/plugins/hub-project-menu/lib/tests/presets.test.js
node .obsidian/plugins/hub-project-menu/lib/tests/data-store.integration.test.js
node .obsidian/plugins/hub-project-menu/lib/tests/shared-projects.integration.test.js
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

Athena has an isolated TypeScript/esbuild toolchain under `lib/athena/` with its
own lockfile. When its sources change, run `build-athena.js` before `build.js`;
the Hub build rejects stale Athena artifacts. The shipped runtime and PDF worker
need no npm installation. [Athena's report](System/Hub-athena-architecture-and-roadmap.md#7-build-and-validation)
lists its type checks, synthetic tests, benchmark and isolated runtime fixtures.

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

Commit the shared JSON, changed project Markdown, images/templates and rebuilt
plugin together, then push through the usual Git workflow. After fetching new
shared state, reload Obsidian before editing: Hub rejects stale writes instead of
overwriting incoming Git changes. A hard reset changes only tracked files and
cannot reconstruct state that was never committed. Native workspaces,
appearance, installed/enabled-plugin lists and all other plugin settings remain
local; Dataview query settings are the explicit configuration exception.

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
