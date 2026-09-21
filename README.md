# Obsidian Hub / Itacan

This repository is an Obsidian vault containing the shareable Hub implementation.
Personal work and runtime state are excluded from Git. OneDrive can synchronize
the entire working vault, including those excluded files, between your computers.

## Open a fresh clone

1. Open the repository folder as a vault in Obsidian Desktop.
2. Install and enable **Dataview** and **Heatmap Calendar** from Community plugins.
   Enable JavaScript queries in Dataview's settings.
3. Enable the bundled **Hub Project Menu** community plugin. Its generated
   `main.js` is included; no build is required for first use.
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

Reload Obsidian after rebuilding the plugin. The browser fixtures can be run with
`lib/tests/run-browser-test.js`; set `HUB_TEST_BROWSER` to a Chromium executable
when it is not installed at the runner's default Windows Chrome location.

## Personal data and synchronization

See [the persistence and Git boundary](System/Hub-personal-data.md) for exact
locations, migration behavior, Git checks, and OneDrive conflict handling.
New top-level vault folders are private by default. Add explicit exceptions to
`.gitignore` when introducing a new shareable source location.

The vault-root repository tracks both collaborative Projects as ordinary files.
The former nested `Projects/Itacan/Meta/.git` metadata, including its history and
index, is preserved locally at `System/Backups/Git/itacan-meta.git` (ignored).
There is no nested repository or submodule dependency in either shared Project.
Use the vault-root repository for sharing the Hub. No commit or push was made
as part of establishing or revising this boundary.
