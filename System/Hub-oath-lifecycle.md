# Strict Oath — Phase 3 review, 8 October 2026

**Phase 3 source implementation and isolated verification are complete under the
revised behavioral commitment model. Strict remains disabled by default. Phase 4
has not started.**

The updated [implementation plan](../Projects/Itacan/PLAN.md) replaces exhaustive
desktop enforcement gates with practical commitment safeguards. The Phase 1–2
harnesses and reports are preserved. Their native observation/control dependencies
are not integrated into the product or loaded by this experiment.

## Implemented

- A device-scoped persistent executable whitelist, with normalized verified local
  Windows paths. An Oath can replace the defaults, including with an empty list.
  Settings changes do not modify already confirmed policies.
- `reviewStrict(draft)` returns the frozen policy, preflight findings, accurate
  terms and a versioned, expiring confirmation nonce. `take` refuses missing,
  expired or modified confirmation. Ordinary drafts use their existing flow.
- Preflight identifies known unpermitted applications and asks users to close
  them. Missing individual identities generate warnings. A failed entire query
  prevents new activation rather than being mistaken for an empty desktop.
- Due schedules remain scheduled, cancellable and without a running timer while
  blocked. Preparation rechecks inventory and workspace before saving the active
  state; `startedAt` is the actual activation time. Failed preparation/state saves
  release native restrictions and leave a retryable commitment.
- Early `end(..., "broken")` is refused for active, unfulfilled Strict Oaths at
  the service boundary. Timer or all selected tasks still fulfill the Oath;
  fulfillment does not exit. History is saved once before releasing restrictions.
- A missing workspace no longer ends Strict automatically. The timer continues.
  Main-process session ownership supports plugin reload; missing ownership after
  restart records an interruption without re-entering fullscreen. History uses
  the last saved observation for elapsed accounting, with detection time recorded
  separately and the actual interruption time explicitly unknown.
- A default-disabled main-process coordinator, ordinary fullscreen, native close
  and local fullscreen-exit guards, minimization discouragement and bounded state
  restoration. The participating window is not always-on-top. Alt+Tab is not
  intercepted. Another Strict window in the same main process is rejected.
- Serial observation with a five-second delay after each result. Newly detected
  unpermitted applications may trigger one host-focus nudge, rate-limited to once
  per fifteen seconds. Failures show degraded status while the commitment stays
  active. This is not a foreground-window detector or a focus loop.
- Minimal waiting/degraded status in the existing Oath UI and removal of misleading
  website/notification promises. Settings and Strict selection UI remain Phase 4.

## Files and integration

Paths below are relative to `.obsidian/plugins/hub-project-menu/`.

| Component | Responsibility |
|---|---|
| `lib/domain/oath-strict.js` | Policy, paths, confirmation terms, observed-window classification |
| `lib/services/oath-strict.js` | Preflight, host preparation, observer health and nudges |
| `lib/services/oath-process-observer.js` | Fixed read-only PowerShell/.NET query via Node `execFile` |
| `lib/services/oath-strict-host.js` | Main-process Electron guards, shared ownership and restoration |
| `lib/services/oath.js` | Existing serialized lifecycle, whitelist persistence, confirmation, Strict activation/exit/recovery |
| `lib/domain/oath.js` | Defensive copy of returned Strict policy snapshots |
| `plugin.js` | Existing private Obsidian bridge obtains/reuses the default-disabled coordinator |
| `lib/ui/oath.js` | Existing status/exit UI reflects Strict state and honest limitations |
| `build.js` | Optional `--output-dir` for isolated builds; normal build destination unchanged |
| `lib/tests/oath-strict.test.cjs` | Lifecycle/race/failure tests and fresh-bundle exclusion audit |
| `lib/tests/oath-lifecycle/` | Native lifecycle experiment and test-only development escape |

The portable policy/coordinator do not import Obsidian. Standalone Electron can
reuse them and the host factory directly, replacing the private bridge and the
existing Obsidian task/storage adapters. No new framework or dependency is needed.

## Observation capabilities and accepted limits

The read-only query uses documented Windows `Get-Process` and
`.NET Process.MainWindowHandle`/path metadata. It ignores processes without a main
window. It does not enumerate every switchable window, identify foreground,
provide reliable minimized state, or control external windows. It may miss owned
dialogs, additional windows, packaged apps and inaccessible processes. Those
limitations are accepted; known blockers and unknown identities remain distinct.

The query has a four-second timeout, a bounded output buffer, no overlapping
requests, no user-interpolated command text, no execution-policy bypass and no
native extension. Cancellation only terminates its own query process. It never
closes or terminates a user's application. References:
[Microsoft Process.MainWindowHandle](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.mainwindowhandle),
[Node execFile](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback).

Foreground return is a documented Electron `focus()` request and may be denied.
Switching to an already open but missed application may produce no observation
change. There is no website, notification, Task Manager or Windows-control block.

An additional host finding corrected a test assumption: Electron 39's Windows
`SetKiosk` delegates to fullscreen and `IsKiosk` returns fullscreen state.
Therefore `isKiosk() === true` after `setFullScreen(true)` does not identify a
separate restrictive mode. Strict uses the fullscreen API, keeps ordinary
stacking and does not disable Alt+Tab. This is documented in the
[tested Electron source](https://github.com/electron/electron/blob/v39.8.3/shell/browser/native_window_views.cc#L1121).
The historical Phase 1 mode labels should be read with that limitation.

## Verification

[Native evidence](../.obsidian/plugins/hub-project-menu/lib/tests/oath-lifecycle/results/windows-2026-10-08.json)
and [run instructions](../.obsidian/plugins/hub-project-menu/lib/tests/oath-lifecycle/README.md).

The final isolated native run **passed all 11 checks**: actual Obsidian/plugin
loading, the existing bridge, escape/watchdog before guards, default-disabled
state, built-in observation, guarded activation, local Alt+Tab passthrough and
external minimize/restore, early-exit refusal, fulfilled history/restoration, and
development escape with an interruption outcome. Final status is recorded in the
linked JSON.

The real host is installed Obsidian 1.13.7's archive under existing Electron
39.8.3 / Node 22.22.1. Current sources are built into the disposable test profile.
Lifecycle actions use the existing synthetic task/service fixture with temporary
JSON persistence over actual Obsidian/companion windows. Observation during
activation is filtered to those owned fixture processes, so no unrelated user
window needs to close. This is not end-to-end Settings/review UI validation or
verification of the installed Obsidian executable's own Electron runtime.

**All 17 final Phase 3 tests pass**, including fresh-build exclusion of the
development escape from `main.js` and `atlas-native.cjs`. They cover frozen
defaults/overrides, confirmation, blocking before task writes, activation races,
due cancellation, actual start time, failed saves, both fulfillment routes,
history, missing workspaces, reload/interruption, unknown/null observations and
rate-limited nudges.

The broader selected regression run recorded **112 passes and one pre-existing
failure out of 113 entries** across Oath, Settings, plugin loading, Music,
Statistics, Atlas and the earlier harnesses. The final fresh-build audit was
added afterward and is included in the 17-test Phase 3 rerun. The existing
`oath-shared-resources.test.js` modal fixture still lacks `ownerDocument`, failing
at `window-title.js` before its UI assertions. It was reproduced and left outside
this change; no product workaround was added.

Two native test assumptions were corrected during the work: distinguishing kiosk
from fullscreen through `isKiosk()` on this Windows runtime, and checking the
default-disabled flag after the fixture had explicitly enabled its shared
coordinator. The final check now verifies disabled state before enabling anything
and refuses activation if that prerequisite fails.

The native checks do not establish physical Alt+Tab switching, global dock
visibility/stacking, arbitrary external applications or reliable foreground
ownership. No global input was injected. These remain manual acceptance tasks,
not unreported enforcement guarantees.

## Safety, delivery and Phase 4

No dependency was installed, no native implementation introduced, and no Electron
or Atlas security setting weakened. No administrator token, hooks, registry or
policy modification was used. Only disposable fixture data was written during
testing. The launcher verifies copied production sources remain unchanged during
each run and removes its profile/vault afterward. The local escape and watchdog
are separate test-only modules registered before Strict preparation.

Final independent checks found zero remaining test Electron processes, fixture
directories or temporary build-audit directories. The `obsidian://` handler
still points to installed Obsidian. The final native report confirms unchanged
copied-source hashes, successful temporary-profile removal and exit code zero.

**Installed production bundles were not rebuilt or replaced.** The changes are
reviewable source plus temporary-build verification. The ordinary installed Oath
continues unchanged. Even when these sources are built later, Strict has no
default enablement or product selection path yet. The application-list and
confirmation APIs are implemented; their Settings/setup controls are not.

Phase 4 should wire those APIs into the existing The Oath settings and ceremonial
review, add explicit mode/application selection, show detected blockers and
coverage warnings, and perform full UI acceptance before product enablement.
Reuse ordinary application launching and only proven focus capabilities for the
dock. General external minimize/restore and foreground detection remain
unsupported; normal Alt+Tab is the practical fallback. No fragile substitute is
required to continue the roadmap.
