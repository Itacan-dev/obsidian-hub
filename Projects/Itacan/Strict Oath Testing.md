# Test Strict Oath in the Itacan prototype

The current Obsidian installation includes the latest preflight and development
recovery controls. Strict is off by default. Existing settings and permitted
applications are retained.

## Start a manual test

1. Save work and fully quit and reopen Obsidian to load the installed bundles and
   main-process modules. A plugin toggle alone can retain cached modules.
2. Open **Settings ? The Oath**. Under **Prototype development recovery**, choose
   **Verify development recovery**. The independent **Itacan prototype recovery**
   window opens and verifies its local keyboard handler.
3. Enable **Strict Oath on this device** when ready. This makes Strict available
   in Oath setup. Choose permitted executable paths for applications you need.
   Closing real documents is optional; do not discard unsaved work for preflight.
4. Open **The Oath**, choose **Strict**, a workspace and task, and a one-minute
   duration. Review blockers and uncertainty, then acknowledge and take the Oath.
   Recovery is verified again before fullscreen restrictions are applied.
5. Use permitted applications with Alt+Tab. Use the dock to launch permitted
   executables or return to Itacan. Fulfill and end the Oath normally to test
   ordinary completion and history.

## Development recovery

**Ctrl+Alt+Shift+F12** releases restrictions while the Itacan host or recovery
window has focus. From an external application or an embedded page that does
not deliver the shortcut, Alt+Tab to the recovery window first.

You can also press **Release Strict Oath** in the recovery window or
**Release Strict Oath (development)** in Settings. Closing the recovery window
or losing its renderer during a test releases restrictions. A main-process
watchdog releases restrictions after two minutes even if the Itacan renderer
cannot respond. This two-minute limit applies to the prototype test session.

Emergency recovery disarms guards before restoring the saved window state.
The existing lifecycle records an interruption rather than fulfillment. If an
activation was still preparing, its scheduled record can remain waiting; cancel
it through The Oath or the Settings development release button. Verify recovery
again before starting another test after emergency release.

If restoration fails, guards remain disarmed. Use **Restore window** in Settings
? The Oath to retry. A fresh Obsidian process records an interrupted active
commitment without automatically entering fullscreen. Save work and wait for
pending writes before plugin reloads or restarts.

The recovery timer and shortcut require a responsive Electron main process.
Windows controls and deliberate process termination remain available. Device
sleep can delay timer delivery until wake. Physical display changes, embedded
page focus, and third-party stacking still need personal acceptance.

## Compare preflight with Windows

Matched process and Electron windows are possible non-permitted application
candidates whose switchability is unverified. Automatic review requires resolving
these candidates. Unmatched process windows have uncertain switchability, and
additional source windows have unknown executable identity. Both warn and permit
acknowledged activation. A failed primary process query prevents activation.
Supplemental failure reports limited coverage and allows uncertainty.

Compare review findings with the physical Alt+Tab switcher for these cases.

- Code and Firefox with normal, minimized and multiple windows, plus dialogs.
- Explorer with no folders open, then normal and minimized folder windows.
- NVIDIA overlay, Windows Input Experience and tray utilities inactive and open.
- Other Obsidian windows, permitted applications and available packaged apps.
- Existing virtual desktops and secondary displays, without changing settings.

Record false blockers and missed entries separately. Capture eligibility is an
approximation of switchability, and no executable-name exemption is applied.

With Itacan and a permitted application focused, try the Windows key, Ctrl+Esc,
Windows+Tab, Windows+D, Windows+E, Windows+R, taskbar clicks and Atlas guest focus.
Verify Oath continuity, permitted application usability, return and recovery.
Windows shell actions remain available.

## Internal automated verification

Automated tests use disposable profiles and synthetic tasks. Manual testing
uses the existing Itacan installation. The existing preview launcher remains
available as an internal diagnostic harness.

From the vault root, run the focused suites with
`node --test .obsidian/plugins/hub-project-menu/lib/tests/oath-preflight.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/oath-prototype.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/oath-phase5.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/oath-host/recovery.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/settings-navigation.test.js`.

Run installed bundles in isolation with
`node .obsidian/plugins/hub-project-menu/lib/tests/oath-host/launch.cjs --installed-prototype-smoke`.
This copies installed artifacts without rebuilding them. It verifies recovery,
live corroboration, diagnostic rendering, activation, emergency interruption and
restoration. It does not activate an Oath in the normal profile.

Standalone Itacan can remove `oath-prototype-host.js` and its recovery assets,
use the core `getStrictCoordinator` entrypoint, and omit the capability-based
Settings recovery controls. The ordinary Oath lifecycle uses its existing paths.

## Use manual application review for a persistent false blocker

In the final Strict review, select **Use manual application review for this
Oath** when application candidates prevent starting. Inspect the physical
Alt+Tab switcher, including minimized windows, and close or permit the
non-permitted applications you can switch to. Check the separate manual-review
acknowledgment, then accept the Strict restrictions and take the Oath.

This choice allows application findings through activation, including scheduled
activation. New version-3 confirmations disclose bounded return-to-Itacan attempts
for newly observed known applications. Version-2 manual commitments retain their
original nudge-free behavior. Baseline overlays and their same-path restarts do
not cause application focus attempts. Findings
remain visible in Oath status. The user is responsible for the manual check.
Refreshing checks resets to automatic review and clears acknowledgments.
Each new Oath starts in automatic review. Executable launch permissions continue
to come from the confirmed permitted-application list.

For acceptance, leave NVIDIA Overlay running and compare it with Alt+Tab. Start
a one-minute manual-review Oath and observe a natural overlay restart if it
occurs. Repeat with actual Explorer folders, minimized Code/Firefox windows,
Windows Input Experience, dialogs, tray utilities and existing virtual desktops.
Verify that findings are visible, permitted work remains usable, and development
recovery records interruption. Detection cannot establish exact switchability.

## Verify bounded application nudges

Save work and fully restart Obsidian after installation. Verify development
recovery before each restrictive test and use short Oaths within the two-minute
watchdog. Local Ctrl+Alt+Shift+F12 works in Itacan or the recovery window. Return
from external applications before using it.

In both automatic and manual review, inspect Oath status for application focus
attempts, the last event time, executable paths and outcome. Record actual desktop
foreground changes separately from focus requests. Windows may refuse requests.

- Start with NVIDIA observed and verify restarts cause zero attempts.
- Open Discord, Spotify and Riot Client from Start or the tray. If their known
  paths were absent from the baseline and remain observed for two polls, expect
  one grouped attempt. Uncertain switchability remains eligible.
- Repeat while using a permitted application. Record unwanted interruptions.
- Check minimized windows, Explorer shell-only and folder states, dialogs,
  multiple windows, input experience and existing virtual desktops.
- Confirm same-path disappearance, restart and new windows cause no second attempt.
- Open different applications during cooldown. Suppressed events stay consumed.
  At most three attempts occur per Oath, at least sixty seconds apart. Test the
  complete budget in automated time-controlled fixtures within recovery limits.
- Confirm dock permissions, completion, recovery interruption and restored window
  state. Record latency, false nudges and successful physical returns.

A baseline window from Explorer or a tray application suppresses later windows
from its executable path. Source-only windows, unreadable paths and short-lived
windows can be missed. Promote only if returns provide useful friction while
ordinary permitted work remains usable.


## Centered Oath Reminder prototype ? 13 November 2026

New confirmation version 4 replaces inventory-triggered focus nudges with the foreground-dependent Oath Reminder in both automatic and manual review. Versions 1?3 keep their confirmed behavior. Automatic/manual activation checks, executable permissions and dock launch authority are unchanged. Strict remains disabled by default; existing device settings are preserved.

The reminder appears after three continuous observed seconds in known non-permitted foreground applications, centered in that display's work area. Invalid/missing/offscreen geometry falls back to Itacan's display, then primary. It is non-movable, non-modal, normally always-on-top and has no ordinary dismissal. It hides on permitted return or stale/unknown observation. It never automatically requests focus; Return to Itacan is explicit.

This is a narrowly scoped exception to the earlier test-only native-provider decision: only the pinned get-windows 9.3.0 foreground observer is packaged for the Obsidian development prototype, in a disposable utility process with integrity verification, 2.5-second request bound, parent lease and 125-second absolute lifetime. No native application controls or custom Win32 bindings are added. The two-minute prototype recovery watchdog remains mandatory. Upstream cleanup and packaged-app attribution concerns prevent claiming sustained/standalone readiness.

Before testing in Settings ? The Oath, save work and verify the independent recovery window. Ctrl+Alt+Shift+F12 works locally in Itacan, recovery and the registered reminder; from an external application, return to one of these windows first. Recovery removes reminder, helper and fullscreen guards. No separate preview application is required for manual testing. Restart Obsidian after installing to replace cached main-process modules; do not reload during an active commitment.

Physical acceptance: at least 30 transitions; no appearance before three seconds, 95% within 3.0?3.5 seconds of first qualifying sample; hide within 500 ms under normal sampling. Check negative display coordinates, mixed DPI, straddling windows, display removal and invalid-bounds fallback. Confirm no dragging, no automatic focus changes, no background NVIDIA restart reminder, continued permitted-app/dock use, and shortcut/independent-window/watchdog recovery. Recheck actual stacking; Electron flags alone do not establish physical visibility. Long-session soak and the actual installed launcher runtime remain separate acceptance work.
