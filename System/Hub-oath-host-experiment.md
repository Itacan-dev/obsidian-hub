# Strict Oath — Phase 1 review, 8 October 2026

**Phase 1 is implemented as an isolated development experiment. Its full
feasibility gate is not met. Phase 2 has not started.**

The approved attached plan was followed for the host experiment only. Existing
Itacan service/UI code and generated bundles were not edited or rebuilt. No
native application-control dependency was installed. The harness adds no
whitelist, Settings, scheduling or history behavior to the product.

## Artifacts

- [Harness and run instructions](../.obsidian/plugins/hub-project-menu/lib/tests/oath-host/README.md)
- [Native results](../.obsidian/plugins/hub-project-menu/lib/tests/oath-host/results/windows-2026-10-08.json)
- [Recovery implementation](../.obsidian/plugins/hub-project-menu/lib/tests/oath-host/recovery.cjs)
- [Recovery tests](../.obsidian/plugins/hub-project-menu/lib/tests/oath-host/recovery.test.cjs)

## What was exercised

Installed Obsidian 1.13.7's archive, running in the already installed test Electron
39.8.3 / Node 22.22.1, Windows x64, one 1920×1080 display. The normal installed
Obsidian launcher/runtime was not instrumented. Each run created a disposable
profile and synthetic vault and loaded the existing Itacan plugin copy.

An independent Electron process supplied an ordinary top-level external test
application. This stands in for a permitted application without implementing a
whitelist or native window-control adapter. It was not embedded or reparented.

Native recovery was required to pass before restrictive guards were armed.
Escape is local `Ctrl+Alt+Shift+F12`; manual use cancels later cases. A dock stop
action, a per-case watchdog, an independent launcher deadline and companion
heartbeat/disconnect cleanup provide additional development recovery paths.

## Final native result: 17 passed, 6 failed

| Behavior | Result |
|---|---|
| Real Obsidian loads Itacan in the synthetic vault | Passed |
| Existing private remote bridge reaches the correct main-process window | Passed |
| Local escape and watchdog recovery before guards | Passed |
| Separate dock renderer: sandbox, isolation, no Node, dedicated session | Passed |
| Fullscreen and kiosk close/fullscreen-exit guards | Passed through Electron calls and local input delivery |
| Programmatic host minimization recovery | Passed state checks in both modes |
| External application's minimize/restore leaves host fullscreen | Passed state checks in both modes |
| Dock button delivers its validated IPC action | Passed targeted Chromium mouse input; physical hit testing remains unverified |
| Escape restores saved state after each mode | Passed, including geometry and closability/minimizability |
| No Oath taken; footer remains mounted | Passed |
| External foreground ownership | Failed verification in both modes: host and companion simultaneously reported focus |
| Host/external/dock stacking | Failed pixel verification in both modes |
| Repeated Alt+Tab | Failed reliable exclusive switching verification in both modes |

The desktop capture did show the companion's expected green pixel. However, the
host and dock samples did not match their expected colors. A positive control
captured the correct blue marker directly from the host renderer. Consequently,
the results do not establish correct global stacking or continuous dock visibility.
The cause of the desktop discrepancy was not resolved; do not infer that Windows
can or cannot support the design from this run alone.

An earlier test accepted an Alt+Tab transition whenever the expected window
reported focus. That could falsely pass when both windows reported focus. The
final assertion requires exclusive switching and those earlier passes are
superseded by the final evidence.

## Fixes and isolation incident

The first native safety check found that Windows could apply its fullscreen exit
geometry after a synchronous `setBounds`. Recovery now disarms first, restores
state, then requires stable observations and retries geometry within a bounded
two-second window. The native rerun and regression test pass.

The initial command-sandbox run could not start Chromium's GPU process. The
experiment was rerun through tool-approved execution outside that command
sandbox; no `--no-sandbox`, web-security disablement or keyboard hook was added.

**An initial harness isolation defect crossed the no-registry-change constraint:**
Obsidian's normal startup attempts to register `obsidian://`, and inspection found
the handler pointing to the test Electron executable. The pre-run handler was not
captured, so its prior value cannot be established. The final harness intercepts
protocol registration and related desktop-integration writes before loading
Obsidian. With the user's explicit approval, the current-user URL command was
repaired to `"C:\Program Files\Obsidian\Obsidian.exe" "%1"`; the repair command
returned the expected value. The approved repair was the only intentional
registry write and is not part of the harness.

The final native launcher reported unchanged hashes for copied source files and
successful deletion of the temporary profile/vault. Two earlier direct GUI-mode
launcher attempts had left temporary fixture directories; these were identified
by their markers and removed during final cleanup. The launcher now refuses
GUI-mode entry before creating a fixture; the documented Node-mode invocation
waits for termination and exposes the true exit code.

Final verification found no test Electron processes, confirmed the repaired URL
handler and showed that the execution account outside the command sandbox had
no administrator token. An earlier approval-review usage limit temporarily
blocked these read-only checks; they succeeded after continuation. The harness
contains no elevation or administrator-only functionality.

## Tests and review boundary

All ten new harness tests and four selected existing test files pass. The new
tests cover refusal of incorrect launcher entry, prerequisite gating, both guarded modes, escape,
watchdog, restoration failure, prior fullscreen/minimized state, late geometry,
production exclusion and interception of startup desktop integration.

Existing Oath lifecycle, workspace, Settings-navigation and plugin-load checks
pass. The existing `oath-shared-resources.test.js` still fails because its modal
fixture lacks `ownerDocument` in `createWindowTitle`; this same failure was
observed during planning. It was left unchanged to keep this work in Phase 1.

Physical Alt+Tab, physical dock clicks, actual third-party applications and the
installed Obsidian launcher still need a supervised interactive validation. No
OS-level escape guarantee is claimed. Review these results before changing the
host design or authorizing any Phase 2 work.
