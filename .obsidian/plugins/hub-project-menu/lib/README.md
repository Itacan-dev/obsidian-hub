# Obsidian Hub modules

The Hub source is split into small CommonJS modules. Obsidian loads the
self-contained `main.js` artifact generated from `plugin.js` and `lib/` by
`build.js`.

- `config.js` owns stable registries and paths.
- `domain/` contains pure rules for activity, auditing, contexts, dates, files,
  focus, naming, progress, and tasks.
- `services/` contains schema-versioned atomic persistence and transition
  behavior behind narrow interfaces.
- `ui/` contains shared dashboard primitives used by Home and Project/Resource.

Keep vault and Obsidian API calls at the service boundary. Domain modules should
remain deterministic and independently testable. Add new behavior to the
smallest relevant module instead of expanding `main.js` or copying helpers into
dashboard views.

After changing `plugin.js` or a file under `lib/`, run `build.js` with Node and
reload the plugin in Obsidian. The builder has no package dependencies and only
bundles local modules reachable from `plugin.js`; built-in and `obsidian`
imports remain external.

`tests/domain.test.js` covers pure rules, audit repairs, and persistence
ordering. `tests/data-store.integration.test.js` exercises atomic replacement,
external-write detection, and conflict-file discovery on the filesystem.
`tests/plugin-load.test.js` verifies the plugin entry point and both dashboard
scripts can still be loaded after a module change.
