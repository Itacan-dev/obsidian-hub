# Strict Oath — Phase 2 review, 8 October 2026

**Phase 2's isolated Windows adapter experiment is implemented. Its feasibility
gate is not met. Stop for review; Phase 3 has not started.**

The approved plan was supplied as an attachment; there was no repository
`PLAN.md`. This work follows its Phase 2 scope and the explicit authorization to
investigate Phase 1 despite that phase's incomplete feasibility result.

## Artifacts and scope

- [Harness and instructions](../.obsidian/plugins/hub-project-menu/lib/tests/oath-windows/README.md)
- [Final native evidence](../.obsidian/plugins/hub-project-menu/lib/tests/oath-windows/results/windows-2026-10-08.json)
- [Initial timeout evidence](../.obsidian/plugins/hub-project-menu/lib/tests/oath-windows/results/initial-timeout-2026-10-08.json)
- [Dependency pins](../.obsidian/plugins/hub-project-menu/lib/tests/oath-windows/dependencies.json)
- [Adapter tests](../.obsidian/plugins/hub-project-menu/lib/tests/oath-windows/adapter.test.cjs)
- [Phase 1 report](Hub-oath-host-experiment.md)

New code lives under `lib/tests/oath-windows`. The Phase 1 launcher/host gained an
explicit `--windows-adapter` branch; its companion reports its own native HWND,
and its bundle-isolation test now checks both experiments. Existing escape,
restoration, secure dock and disposable-vault code are reused. There are no edits
to production Oath behavior, Settings, scheduling, application integrations,
Atlas security preferences, generated bundles or production dependency files.

## Dependencies and build gate

get-windows is pinned to **9.3.0**. Its package archive is checked against npm's
SHA-512 integrity and its x64 N-API 9 binary against the upstream release asset's
SHA-256. Acquisition is explicit, test-only and under ignored `node_modules`;
it runs no package lifecycle scripts or global installers. The MIT license
accompanies the upstream package. Pins and the acquisition script are retained.

The required reproducible source-build/distribution gate is **unverified**. No
Node/npm installation or Windows C++ build toolchain was found on this host.
Existing Electron's Node mode runs the scripts. For observation diagnostics only,
the utility process loads the unmodified upstream native addon directly. This
does **not** validate the package's ESM loader, dependency resolution, source
rebuild or production packaging. No source-build success is claimed.

The public nut.js source was inspected at immutable commit
`e413fa1f19a19c4631812e4e1eaf47aa732b5cbe`; its manifest declares 4.2.0. The public
libnut provider forwards `focusWindow`, but `minimizeWindow` and `restoreWindow`
explicitly throw. Its native Windows package dependency is 2.7.1. No native nut.js
binary was installed or built after finding this capability gap. Focus support
is source-present but unverified. Current paid prebuilt distribution was not
substituted for the approved open-source build route.

Sources: [pinned provider](https://github.com/nut-tree/nut.js/blob/e413fa1f19a19c4631812e4e1eaf47aa732b5cbe/providers/libnut/lib/libnut-window.class.ts),
[provider package](https://github.com/nut-tree/nut.js/blob/e413fa1f19a19c4631812e4e1eaf47aa732b5cbe/providers/libnut/package.json),
[nut.js installation](https://nutjs.dev/docs/installation),
[get-windows release](https://github.com/sindresorhus/get-windows/releases/tag/v9.3.0),
[get-windows Windows implementation](https://github.com/sindresorhus/get-windows/blob/v9.3.0/Sources/windows/main.cc).
The docs/source version difference prevents assuming advertised current controls
are available in the inspected public provider.

## Adapter boundary

Native observation runs in Electron `utilityProcess`, with one outstanding
request, a 2.5-second deadline, termination on timeout, stale-message rejection,
health events, and explicit bounded restarts. A lease and absolute lifetime
limit supplement parent cleanup. Native code never loads into Obsidian's main
event loop or either renderer. This is fault isolation at ordinary user
privilege, not a security sandbox for arbitrary addons.

Window records use verified normalized executable paths, PID, HWND and opaque
observation-lifetime tokens. Titles are display metadata only. Missing paths
remain visible as unknown, and unknown/stale tokens cannot resolve. A fresh
enumeration retires missing windows. No general controls exist: focus, minimize,
restore and launch reject explicitly rather than use title matching or custom
Win32 code. Fixture BrowserWindow/IPC operations are test setup, not adapter
control successes.

Coverage is explicitly partial. Upstream filters some windows before returning
records and silently drops some metadata failures, so not all unknown windows
can be surfaced. Same-PID/same-HWND reuse entirely between observations cannot
be detected with these fields. Neither condition is safe for Strict preflight.

## Native results

Installed Obsidian **1.13.7 archive**, existing test Electron **39.8.3**, Node
**22.22.1**, Windows x64, one display, ordinary non-administrator token. Each run
used a fresh temporary profile and synthetic vault. The installed Obsidian
executable's own Electron/Node runtime remains uninstrumented.

Final result: **47 passed, 6 failed, 8 not run**, with no fatal or cleanup error.
The count includes reused Phase 1 checks and added observation checkpoints;
an observation checkpoint pass means data was collected, not that enforcement
or foreground restoration succeeded.

| Case | Result |
|---|---|
| Native addon loads outside host process | Pass |
| Escape and watchdog before guards; state restoration afterward | Pass |
| Conventional executable identity agrees with fixture | Pass |
| Two windows from one process, identical titles, distinct tokens | Pass |
| Minimized ordinary window remains inventoried | Pass; minimized state itself is unavailable |
| Empty-title ordinary window remains inventoried | Pass |
| Owned modal and disabled parent coverage | **Fail: both omitted** |
| Closed window token rejected after fresh inventory | Pass |
| New window receives new token after observed disappearance | Pass; actual OS handle reuse was not forced |
| External process exit removes its window and invalidates token | Pass |
| Serial foreground/inventory polling leaves host loop responsive | Pass for short trial |
| Helper exit rejects pending request; explicit restart works | Pass |
| Synchronous helper stall times out and host remains responsive | Pass |
| General native focus/minimize/restore/launch | Unavailable; explicit rejection tested |
| Source-built distributable controls | **Fail / not established** |
| Phase 1 Electron focus assertions | **2 failures**, clarified below |
| Phase 1 desktop stacking pixel assertions | **2 failures**, still unresolved |

In the final polling trial, foreground calls took about **2.2–3.9 ms**; the two
inventory calls took **15.7 and 20.2 ms**. Foreground calls were serial with a
250-ms delay after each cycle; inventory ran every fourth cycle. These timings
are a small diagnostic sample, not a latency guarantee.

An initial combined observation exceeded 2.5 seconds and the supervisor killed
the helper safely. That initial failure remains in a separate evidence file.
Splitting foreground from inventory produced useful observations on subsequent
runs. One explicit inventory diagnostic allowed up to 10 seconds only after
fullscreen guards released; the final call completed in 20.6 ms. The original
stall's exact cause was not established; it must not be considered eliminated.

## What this resolves from Phase 1

Windows foreground lookup matched the independent external fixture's **PID and
HWND** in both fullscreen and kiosk cases, while both Electron windows reported
focused. Thus the earlier conflicting Electron flags are not sufficient to
judge foreground ownership. Itacan remained fullscreen during those samples.

After targeted dock-button delivery, Windows still reported the external
fixture as foreground even though the host's Electron flag said focused. The
dock action reached its handler but did not establish successful OS foreground
restoration. There is no retry loop or foreground-lock workaround.

Native window bounds were twice the Electron DIP values on this display
(scale factor 2). A future adapter needs explicit physical-pixel/DIP conversion.
This does not explain or repair the failed desktop pixel assertions by itself.
Reliable global stacking, dock visibility, physical clicks and repeated Alt+Tab
remain unproven. No global keyboard input was injected in Phase 2.

## Tests, safety and cleanup

**18 harness tests pass** (8 new adapter tests plus 10 Phase 1 tests). The four
selected existing files also pass: `oath.test.js`, `oath-workspace.test.js`,
`settings-navigation.test.js`, and `plugin-load.test.js` — **22 passing entries**
in the combined run. The 18 harness tests were rerun after final supervisor and
bundle-isolation changes and passed. The previously documented shared-resource
fixture failure is outside this change and was not rerun or repaired here.

Unknown-path/access-denied handling and observed handle-reuse transitions have
unit coverage; this is not a native elevated-process or forced-handle-reuse test.
The separate process uses synthetic content only. Native acceptance still needs
arbitrary applications and actual unsaved-document dialogs, inaccessible and
packaged apps, launch failure, denied adapter focus, physical Alt+Tab/dock clicks,
sleep/wake, display hot-plug/scaling changes, other Obsidian vaults/popouts,
focused Atlas content, dock crash, and long-duration observation.

Final launcher verification: copied source hashes unchanged; temporary profile
removed; no cleanup error. Independent post-run checks found **zero test
Electron processes and zero temporary fixture directories**. The current-user
`obsidian://` handler still points to installed `C:\Program Files\Obsidian\Obsidian.exe`.
Phase 1's startup-side-effect interception remained in place; no registry
repair or modification was performed in Phase 2. No administrator token, global
hooks, privileged service, custom native implementation, input automation or
security-disabled switches were used. No existing user documents were closed.

Saved JSON omits logs and unrelated window titles, executable paths, PIDs and
HWNDs. Ignored dependency artifacts remain for reproducible diagnostic reruns;
they are not part of production artifacts.

## Decision for review

The tested dependencies cannot currently satisfy the approved Phase 2 gate:
modal/unknown-window coverage is insufficient, native minimize/restore are
missing in the selected public provider, and source-built distribution is
unverified. Actual same-PID handle reuse also remains unsupported.

Do not enable Strict or proceed to lifecycle/UI integration on this evidence.
A future approved feasibility iteration needs a maintained, distributable
upstream provider that supplies the missing controls and reliable coverage,
plus a reproducible Windows source-build environment. No unsupported substitute
has been introduced. Production behavior remains unchanged.
