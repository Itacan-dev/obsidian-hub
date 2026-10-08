# Strict Oath Phase 4 isolated verification

From the vault root:

```text
node --test .obsidian/plugins/hub-project-menu/lib/tests/oath-phase4.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/oath-strict.test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/oath-host/launch.cjs --strict-ui
```

Without Node, use the already installed test Electron with
`ELECTRON_RUN_AS_NODE=1` and a hidden launcher, as in the
[Phase 3 instructions](../oath-lifecycle/README.md). No installation is needed.
Do not change execution policy or add sandbox-disabling Electron flags.

`--strict-ui` builds current sources into a new disposable vault/profile. It
never rebuilds installed bundles, copies user data, or changes a real Oath.
The inherited host harness prevents Obsidian protocol/login/desktop registration
before startup, hashes copied production sources, bounds execution, and removes
its fixture afterward. Reports retain the shared `PHASE1_REPORT` output prefix
but record `phase: 4`. The on-screen Phase 1 banner identifies that shared safety
infrastructure, not the tested feature scope.

Native escape/watchdog restoration is proven before guards. The test-only local
Ctrl+Alt+Shift+F12 escape and 45-second watchdog register before Strict preparation.
Neither exists in production bundles. If escape is used unexpectedly, testing
stops and releases the fixture. No global keyboard input is injected.

The actual plugin's Settings, setup/review/status and service are exercised;
task/workspace/index/navigation adapters use synthetic tasks. Windows observation
is scoped to the two owned fixture processes; a synthetic blocker exercises
review. The external companion is an ordinary separate-process Electron window.
The permitted launch check uses short-lived Windows `whoami.exe`, never a user's
documents. The test confirms dock loss leaves the Oath active and escape restores
the host. All fixture windows and process leases are cleaned up.

Saved JSON and UI images live in `results`. Images capture only the isolated
application/dock. `feasibilityMet` in JSON measures automated fixture checks;
it does not certify physical Alt+Tab or global desktop stacking. Those require
manual acceptance with ordinary third-party apps before default enablement.
