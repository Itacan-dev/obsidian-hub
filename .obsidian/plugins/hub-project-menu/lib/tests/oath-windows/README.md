# Strict Oath Phase 2: isolated Windows adapter experiment

Development-only. No production entrypoint imports this directory. Do not ship it,
its dependencies, or the Phase 1 harness with the plugin. No whitelist, Settings,
scheduling, lifecycle integration or production controls are implemented.

The approved plan was supplied as an attachment; no repository `PLAN.md` existed.
See [the review report](../../../../../../System/Hub-oath-windows-experiment.md).

## Dependency scope

`dependencies.json` pins get-windows 9.3.0's package integrity and the Windows x64
N-API 9 release asset's upstream SHA-256. `prepare.cjs` downloads and checks them,
extracts them under this directory's ignored `node_modules`, and captures the
nut.js provider source at commit `e413fa1f19a19c4631812e4e1eaf47aa732b5cbe`.
It runs no package install scripts and changes no production dependency files.

**This is an upstream-binary diagnostic, not a completed source-build route.**
There is no Windows C++ build toolchain available here. The addon is loaded
directly through its upstream exports in the utility process. The get-windows
ESM wrapper, node-pre-gyp resolution, source rebuild and redistribution packaging
are unverified. The pinned public nut.js provider's minimize/restore methods
throw; no nut.js native binary or alternative controller is installed.

## Run

Windows x64, one interactive display, installed Obsidian archive and the existing
Electron test installation are required. Close prior fixture runs first. This
opens temporary experiment windows and may change foreground focus for the run.
Use an idle desktop; no real documents are changed. Normal profile and vault are
not opened by the harness. Recovery is inherited from Phase 1: local
Ctrl+Alt+Shift+F12 while the test host is focused, dock Stop, and watchdogs.

From the vault root, with Node available:

```text
node .obsidian/plugins/hub-project-menu/lib/tests/oath-windows/prepare.cjs
node --test .obsidian/plugins/hub-project-menu/lib/tests/oath-windows/adapter.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/oath-host/recovery.test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/oath-host/launch.cjs --windows-adapter
```

If Node is absent, run the existing Electron binary in Node mode using inline
PowerShell (no script-policy changes). Replace `$oathEntry` and add `--test` or
`--windows-adapter` as appropriate:

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
$oathElectron = (Resolve-Path '.obsidian/plugins/hub-project-menu/lib/atlas/tests/native/node_modules/electron/dist/electron.exe').Path
$oathEntry = (Resolve-Path '.obsidian/plugins/hub-project-menu/lib/tests/oath-windows/prepare.cjs').Path
$oathRunner = Start-Process -FilePath $oathElectron -ArgumentList ('"' + $oathEntry + '"') -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput "$env:TEMP\oath-phase2-run.log" -RedirectStandardError "$env:TEMP\oath-phase2-errors.log"
$oathRunner.ExitCode
```

The launcher prints `PHASE1_REPORT` because Phase 2 reuses its existing temporary
profile, reporting and cleanup mechanism. The JSON itself has `phase: 2`.
A nonzero exit is expected while feasibility checks fail. `--alt-tab` is refused
with `--windows-adapter`; this experiment uses no global input simulation.

## Boundary and safety

- `worker.cjs`: read-only upstream native calls, only inside utilityProcess.
- `identity.cjs`: verified executable paths, PID/HWND identity, opaque tokens;
  unknown paths remain visible; absent windows retire tokens. Titles are display
  metadata. Same-PID/same-HWND reuse entirely between observations is unsupported.
- `supervisor.cjs`: one outstanding request, 2.5-second timeout, termination on
  timeout, explicit restarts, stale replies discarded, health events. One
  10-second inventory diagnostic runs only after the fullscreen guards release.
- `experiment.cjs`: Phase 1 reuse plus edge cases. Windows actions on test
  fixtures use their own BrowserWindow/IPC exclusively; these are fixture setup,
  not successful external-adapter controls. Focus/minimize/restore/launch on the
  adapter explicitly reject as unsupported.
- Foreground and inventory observations are sequential, not an atomic desktop
  snapshot. Native bounds are physical pixels; Electron bounds are DIPs.
- Enumeration coverage is always marked partial: upstream silently omits some
  windows and metadata failures. Null/failed observations never mean a clear
  desktop. No focus enforcement is enabled.
- Saved evidence redacts unrelated titles, executable paths, PIDs and HWNDs.
  Dependency archives/source remain ignored locally; temporary profiles are
  deleted by the launcher. No registry modifications, global hooks, elevated
  token, security-disabled switches or custom Windows-native code are used.

The native addon is upstream code, not a security sandbox. utilityProcess
provides fault isolation and runs with the same ordinary user privileges; it
does not make a malicious addon safe. Never load arbitrary user-selected addons.
