# Strict Oath — Phase 1 host experiment

Development harness only. Nothing in this directory is imported by the production
entrypoints or generated bundles. It does not take an Oath, implement a whitelist,
change Settings or scheduling, or install packages. Do not package this test
directory with a production plugin.

## Running

Requires Windows, one display, the installed `C:\Program Files\Obsidian` archive,
and the existing Electron/remote installation under `lib/atlas/tests/native`.
It uses Obsidian's application archive with that test Electron; this is not proof
of identical behavior under the installed Obsidian launcher/runtime.

With Node already available, from the repository root:

```powershell
node --test .obsidian/plugins/hub-project-menu/lib/tests/oath-host/recovery.test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/oath-host/launch.cjs --safety-only
node .obsidian/plugins/hub-project-menu/lib/tests/oath-host/launch.cjs --alt-tab
```

No Node installation is necessary on this machine: its existing test Electron
can also run the launcher in Node mode. Paste these commands into an ordinary
PowerShell console (the machine's script-execution policy is left unchanged):

```powershell
$oathElectron = (Resolve-Path '.obsidian/plugins/hub-project-menu/lib/atlas/tests/native/node_modules/electron/dist/electron.exe').Path
$oathLauncher = (Resolve-Path '.obsidian/plugins/hub-project-menu/lib/tests/oath-host/launch.cjs').Path
$oathPreviousMode = $env:ELECTRON_RUN_AS_NODE
$oathLog = Join-Path $env:TEMP ('itacan-oath-console-' + [guid]::NewGuid())
try {
    $env:ELECTRON_RUN_AS_NODE = '1'
    $oathProcess = Start-Process $oathElectron -ArgumentList @(('"' + $oathLauncher + '"'), '--safety-only') -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput ($oathLog + '.out') -RedirectStandardError ($oathLog + '.err')
    Get-Content ($oathLog + '.out'), ($oathLog + '.err')
    Write-Output ('Exit code: ' + $oathProcess.ExitCode)
} finally {
    $env:ELECTRON_RUN_AS_NODE = $oathPreviousMode
}
```

Change `--safety-only` to `--alt-tab` for the full comparison after reviewing the
safety result. These commands do not request administrator rights. In the managed
agent environment the command sandbox could not start Chromium's GPU process;
the native experiment required the separate tool approval to run outside that
command sandbox. Chromium's sandbox was not disabled.

Use an idle desktop for the full comparison. It opens visible disposable windows
and sends up to four Alt+Tab chords per mode using Windows' existing COM
SendKeys, with a bounded injector process. It sends no text, installs no hooks,
and makes no foreground-lock workaround. This is injected-input evidence, not
a physical-keyboard test. Without `--alt-tab`, that criterion is explicitly not run.
No run is allowed to claim feasibility when a check fails or was not run.

The report path is printed as `PHASE1_REPORT ...`. A failing criterion produces
exit code 1. `Start-Process -Wait -PassThru` exposes that code; calling a GUI
executable directly from PowerShell can obscure it.

## Recovery and isolation

- Each run creates a unique profile, synthetic vault, Obsidian CLI identity and
  fixture token under the OS temporary directory. It copies code, not real plugin
  data, cookies, Atlas authority, credentials or user notes.
- Recovery snapshots bounds, full/kiosk state, minimize/maximize state, closability,
  minimizability and always-on-top state. It removes vetoes before attempting
  restoration, then waits for stable native state with a bounded retry.
- **Ctrl+Alt+Shift+F12 in the test Itacan window** releases restrictions. An
  unexpected/manual escape cancels subsequent test cases. There is also a
  development Stop button in the dock. Neither is a global keyboard hook.
- Native escape and timeout recovery must pass before any restrictive guard is
  armed. Each guarded mode has a 30-second lease; the host has a 130-second
  deadline and the independent launcher requests abort after 150 seconds, then
  terminates only its exact child PID if needed. The companion exits on IPC
  disconnect or an expired four-second heartbeat.
- The companion is an independent, ordinary top-level Electron application.
  Its IPC controls only its own synthetic window. This is not Phase 2's native
  application-control adapter and does not demonstrate arbitrary app compatibility.
- The dock has a dedicated memory session, sandbox, context isolation, no Node,
  no webviews, a local CSP, no remote navigation/popups and sender-checked IPC.
  Tests deliver targeted Chromium mouse events; physical hit testing is unproven.
- Obsidian startup protocol registration, login settings, jump-list and recent-file
  mutations are intercepted before its main module executes. No registry write
  exists in the final harness. Host Electron preferences are preserved, not relaxed.
- Cleanup validates the temporary root and token before removing it. The launcher
  verifies hashes of all copied source files. No process-name-wide termination is used.
- Desktop screenshots are sampled in memory for three test colors and discarded.
  No desktop image or unrelated application title is saved.

The ordinary host window is not made always-on-top. Tests compare fullscreen and
kiosk, close/exit guards, programmatic minimization recovery, companion minimize/
restore, stacking, Alt+Tab, dock action delivery and final state restoration.
Simultaneous focus reports from both processes fail the switching assertion;
an API focus flag is never accepted as proof of global foreground ownership.

## Current result

See [the review report](../../../../../../System/Hub-oath-host-experiment.md) and
[the final native evidence](results/windows-2026-10-08.json).
The Phase 1 feasibility gate is **not met**. Do not proceed to Phase 2.
