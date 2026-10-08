# Strict Oath Phase 4 — Settings, review and supported dock

Implemented 8 October 2026. Scope ends at Phase 4. See the
[updated plan](../Projects/Itacan/PLAN.md) and historical
[lifecycle report](Hub-oath-lifecycle.md).

## Delivered behavior

Settings → The Oath now provides a device-local, persistent opt-in, initially
off, and a verified list of Windows executable paths. Browse and manual path
entry share the same verification. Changes affect future confirmations;
disabling future Strict setup does not release an existing active or scheduled
commitment. Ordinary Oath remains the default setup choice.

Strict setup can inherit those defaults or replace them, including an empty
external-application list. It uses the existing workspace, selected-task,
duration and scheduling controls. Review groups known blockers by executable,
shows unidentified windows and coverage warnings separately, and provides a
refresh action. Immediate confirmation stays disabled while known blockers or
failed checks remain. A scheduled commitment may be confirmed while blocked;
its existing lifecycle waits for successful preflight at activation.

The final acknowledgment explains fullscreen, ordinary early-exit refusal,
normal external windows and Alt+Tab, best-effort checks/focus, and unrestricted
websites, notifications and Windows controls. Refresh resets acknowledgment.
The service still verifies the nonce, draft and executable snapshot, and checks
again at activation; UI state does not grant permission.

An active Strict Oath gets a separate always-on-top, non-focusable dock with
**Open application** and **Return to Itacan**. The existing bottom app bar shows
the same frozen applications. Keyboard-accessible buttons are also present in
Oath status when footer space is limited. Open may create another window;
Alt+Tab is the supported method for returning to an existing external window.
Existing configured shortcuts route through the Strict executable policy during
an active Strict Oath, avoiding the ordinary title/PID focusing helper.

There are no external minimize/restore/focus controls, foreground-change detector
or automatic document closure. The fullscreen host is not always-on-top, allowing
ordinary external windows above it. Local Alt+Tab input is untouched. Windows stacking
and foreground ownership are best effort.

## Implementation and safety

- `lib/ui/oath-settings.js`, `oath-applications.js`, `settings-pages.js`: shared
  Settings/setup application editor and device opt-in.
- `lib/ui/oath.js`: mode/override selection, blockers, refresh, acknowledgment,
  status fallback buttons; existing ordinary flow retained.
- `lib/ui/app-shortcuts.js`, `plugin.js`: frozen Strict footer applications and
  approved-launch routing; ordinary shortcuts retain their existing behavior.
- `lib/services/oath.js`: device opt-in persistence and launch/picker boundary.
- `lib/services/oath-strict.js`: reverified launch permission, activation-only
  launch, and generation checks against release during asynchronous preparation.
- `lib/services/oath-strict-host.js`, `oath-dock.js`: Electron dock ownership,
  cleanup, file picker, and Node `spawn` with `shell: false`, no arbitrary arguments, no
  hidden external GUI, and no termination of external applications.
- `lib/ui/oath-dock/`: local HTML/CSS/script and narrow sandboxed preload.

The dock has no parent, no Node integration, no webview, and an ephemeral
partition. Sandbox, context isolation and web security remain enabled. Its CSP
allows only local scripts/styles. Navigation, new windows and permissions are
denied. IPC validates the sending WebContents and main frame; the renderer sends
an action and list index, never an executable path or arbitrary launch arguments.
Launch rechecks the active immutable policy and the real executable path.
Configured website shortcuts retain their HTTP(S) URL through a narrow Firefox
new-tab launch; arbitrary arguments, local-file URLs and other schemes are
rejected. The dock still sends only an application index and opens without arguments.

Native preparation failure rolls back fullscreen and dock ownership. Release
disarms guards before restoring the saved window state, and attempts restoration
even if dock disposal fails. The host and dock handles alone receive implicit
permission; another Obsidian window is not allowed by process identity alone.
Dock loss produces degraded status while the commitment stays active; the footer
and status buttons remain available. Automatic dock reconstruction is deferred.

No dependency was installed, custom native implementation added, privilege
requested from Windows, keyboard hook registered, registry/policy changed, or
Electron/Atlas security setting weakened. Development escape/watchdog are
registered only by the isolated test entrypoint, before restrictive preparation.

## Verification

[Native evidence](../.obsidian/plugins/hub-project-menu/lib/tests/oath-phase4/results/windows-2026-10-08.json)
and [run instructions](../.obsidian/plugins/hub-project-menu/lib/tests/oath-phase4/README.md).

The final isolated run passed **13 native checks**. It uses the actual freshly
built plugin's Settings, setup, review, status and lifecycle service in the
installed Obsidian 1.13.7 archive under existing Electron 39.8.3 / Node 22.22.1.
It covers default-disabled state, escape/watchdog before guards, verified
Settings persistence, override presentation, selected tasks, blockers/refresh,
explicit acknowledgment, guarded fullscreen, dock security and launch denial,
allowed launch, footer keyboard controls, external minimize/restore, fulfillment
history and restoration, narrow review layout, dock-loss degradation, and
development escape followed by interruption recovery.

Workspace/task/index/navigation adapters use synthetic fixture data. Actual
vault persistence is temporary. Preflight observes only owned fixture processes,
plus a synthetic blocker for the review test. No unrelated user's application
needs closure. Launch exercises the harmless, short-lived Windows `whoami.exe`;
it does not establish every third-party GUI application's launch semantics.

**86 selected regression entries pass**, including all eight new Phase 4 tests,
the 17 Phase 3 tests, ordinary Oath/workspaces, Settings navigation, plugin
loading, tasks, presets, Music, Statistics, Atlas and earlier experiment suites.
Fresh temporary builds still exclude the development escape from both bundles.
The separate broader run reproduced the already documented
`oath-shared-resources.test.js` mock-DOM failure (`ownerDocument` missing at
`window-title.js`); no product workaround was added.

Existing ordinary Oath and Settings browser fixtures pass with installed Edge.
Their test loaders were updated for the new imports and input types, and their
obsolete claims about notification/website enforcement were corrected to the
actual Phase 3 behavior. Chrome is absent; nothing was installed.

[Review image](../.obsidian/plugins/hub-project-menu/lib/tests/oath-phase4/results/strict-review.png)
and [dock image](../.obsidian/plugins/hub-project-menu/lib/tests/oath-phase4/results/strict-dock.png)
capture only disposable application content, not the user's desktop.

## Accepted limitations and release boundary

Local Alt+Tab passthrough, independent external minimize/restore and fullscreen
persistence are verified. Physical keyboard switching, desktop pixels proving
global stacking, other always-on-top applications, exclusive fullscreen,
multi-display placement, arbitrary third-party applications and the installed
Obsidian launcher's exact runtime remain manual acceptance work. Conflicting
Electron focus flags do not prove OS foreground ownership. There is no exhaustive
application inventory or foreground guarantee.

Phase 4's supported functional criteria are met in the isolated fixture. The
broader manual desktop acceptance gate remains open, so Strict stays off by
default. **Installed `main.js` and `atlas-native.cjs` were not rebuilt or replaced
in this phase.** Current sources were built only into disposable profiles, leaving
the normal installed UI untouched for review. No live Oath or normal device
settings were changed by testing.

Phase 5 should verify packaged dock assets, reload/restart and restoration
failures, dock reconstruction after loss, display changes, sleep/wake, other
vaults/popouts, Atlas guest focus and physical desktop switching before release.
These items were not implemented in Phase 4. No product decision is needed to
introduce an unsupported external controller: those controls remain unavailable.
