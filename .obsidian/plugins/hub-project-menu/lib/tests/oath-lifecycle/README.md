# Strict Oath Phase 3 isolated verification

Run from the vault root using Node:

```text
node --test .obsidian/plugins/hub-project-menu/lib/tests/oath-strict.test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/oath-host/launch.cjs --strict-lifecycle
```

If Node is absent, use the existing Electron test binary with
`ELECTRON_RUN_AS_NODE=1`, as described in the
[Phase 2 harness instructions](../oath-windows/README.md). Launch its Node-mode
wrapper hidden; the wrapper opens visible disposable experiment windows.
Do not alter PowerShell execution policy or add sandbox-disabling flags.

The launcher builds current sources with `build.js --output-dir` into the
temporary plugin directory. It does not replace the installed `main.js` or
`atlas-native.cjs`. It reuses the Phase 1 temporary profile, vault, protocol
registration interception, source hashing and cleanup deadlines. No native
dependency is loaded by Phase 3.

Before guards, it proves the existing native escape/watchdog restoration and
asserts the rebuilt plugin is disabled by default. Only then does the harness
explicitly enable its coordinator. `development-escape.cjs` registers a local
Ctrl+Alt+Shift+F12 escape and a 45-second watchdog before Strict preparation.
Neither this module nor its registration belongs in production bundles.

The actual Obsidian window and separate Electron companion are real. Lifecycle
actions use the existing synthetic task/service fixture, with its state saved to
a temporary JSON file. The real plugin's default-disabled state is also checked.
The Windows observer runs normally, but activation tests filter results to the
two owned fixture processes, so no real user application needs to be closed.
This is not end-to-end Settings/setup UI coverage; that belongs to Phase 4.

Reports still use the shared launcher's `PHASE1_REPORT` output prefix; JSON has
`phase: 3`. Saved evidence is under `results`. Do not infer global stacking,
foreground ownership or physical Alt+Tab from the local-input assertions.

The source-level suite covers confirmation, immutable policy/defaults,
preflight/races, scheduled cancellation and actual start time, failed saves,
early exit, both fulfillment routes, history, missing workspaces, reload/session
loss, unknown identities and bounded nudges. Run ordinary Oath, Settings, Music,
Statistics, Atlas and prior experiment tests as regression coverage.
