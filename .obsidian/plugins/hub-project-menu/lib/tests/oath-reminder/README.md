# Isolated Oath Reminder experiment

Run from the vault root with the existing Node installation. Dependencies are
already pinned under the Phase 2 test directory. No acquisition or installation
is performed by these commands.

```powershell
node .obsidian/plugins/hub-project-menu/lib/tests/oath-host/launch.cjs --oath-reminder
```

The launcher opens a disposable Obsidian profile and synthetic vault. The control
window accepts absolute executable paths, one per line. These are verified and
frozen when starting. Empty means no external executable is permitted. Choose
normal always-on-top first. Repeated raising is a separate checkbox for comparison.
Start short test enables isolated fullscreen guards, the dock and the reminder.
Observe only collects foreground status without showing a reminder or entering
fullscreen. Both modes stop within two minutes. A new launch is needed afterward.

The reminder is centered on the relevant display work area, non-movable, has no dismissal controls and never automatically calls
focus. Its Return to Itacan button requests focus only when clicked. The exact
reminder window keeps its own state while focused. All paths outside the frozen
list are eligible after three continuous observed seconds, including switches
between different non-permitted applications. Unknown samples interrupt pending
time. Visible uncertainty has a maximum 500-ms grace. Stale observations hide it.

The control, host and independent prototype recovery window accept local
Ctrl+Alt+Shift+F12. The reminder also accepts that shortcut. External applications
require returning to one of these windows first. The independent recovery button,
closing the control/recovery window or the two-minute guard watchdog releases the
experiment. Helper/renderer failure hides the reminder and reports degradation.
The Release and finish button cleans up immediately. No real Oath is created.

## Automated verification

```powershell
node --test .obsidian/plugins/hub-project-menu/lib/tests/oath-reminder/state.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/oath-windows/adapter.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/oath-prototype.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/oath-host/recovery.test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/oath-host/launch.cjs --oath-reminder-smoke
```

The smoke report distinguishes programmatic focus failure from reminder behavior.
If the companion cannot obtain Windows foreground, its three-second native case
is marked not-run. A separate native check directly shows/hides the reminder and
compares actual foreground PID/HWND before and afterward. Passing automation
never marks overall physical feasibility as achieved. Reports redact unrelated
application identity. Local control status shows the current executable basename.

## Physical acceptance

Save work and use short tests. Record foreground identity, elapsed time, actual
visibility and any keyboard interruption separately. Do not rely on Electron
focus flags or isVisible as evidence of physical occlusion.

- Physically focus Discord, Spotify, Riot Client, VS Code and Explorer. Expect
  appearance roughly three seconds after the first qualifying sample. Switching
  directly between non-permitted apps preserves the pending timer.
- Return to a permitted app or Itacan. Expect hiding within 500 ms. Switch back
  and expect a fresh three-second timer.
- Attempt to drag the reminder. It must not move; it stays visible and uses neutral wording while focused.
- Leave NVIDIA and input utilities running in the background. They cause no
  warnings unless they actually acquire foreground and persist.
- Test Start, Task View, desktop, input experience, dialogs, multiple windows,
  separate helpers, maximized windows, another topmost window and Atlas content.
  Frequent shell or input false warnings fail acceptance.
- Check existing virtual desktops, multiple monitors and mixed DPI where available.
  Electron cannot pin this window across Windows virtual desktops.
- Compare normal topmost with repeated raising only if needed. The fallback raises
  at most every three seconds while known non-permitted activity continues.
- Verify local shortcut, independent recovery, observation timeout, renderer loss,
  lock/resume and final cleanup.

Proposed acceptance is at least 30 transitions, 95% appearance within 3.0-3.5
seconds of the first sample, no appearance before three seconds, hiding within
500 ms, zero automatic focus changes and zero background/permitted false warnings.
A 30-minute observation soak and actual installed-runtime packaging remain future
acceptance work. This short experiment retains the upstream helper's bounded
lifetime and cannot establish sustained leak suitability.

## Integration boundary

All reminder files are test-only. Production confirmation remains version 3.
After physical and dependency acceptance, a separately reviewed version-4 change
would replace bounded nudges for new commitments, preserve old confirmations,
start after activation commit and hide after persisted fulfillment. This experiment
exposes reset/disposal behavior but creates no real commitment or migration.

The pinned upstream provider has unresolved source-review concerns, including
resource cleanup and packaged-app identity attribution. It is unsuitable for
promotion without further assessment. No native fork is introduced.

## Recorded automated result

29 focused regression tests passed. The native smoke recorded 9 passing checks, 0 failed checks and 1 physical-precondition case not run. Windows did not grant the companion
foreground, so its native three-second appearance case needs physical switching.
A separate native showInactive check preserved the actual foreground PID/HWND.
Recovery removed the reminder and guards, copied source remained unchanged and
the temporary profile was removed. See results.json.

The existing isolated SQLite SERVICE_EXITED shutdown warning remains.
All 40 installed prototype artifact hashes still match their pre-experiment
installation record. Physical acceptance and sustained resource suitability are
pending. The initial smoke failed when it assumed the companion had obtained
foreground; that precondition is now checked explicitly and reported separately.


Version-4 prototype integration now uses extracted service modules. Earlier recorded results above remain historical. The normal topmost option passed user-reported physical testing; centered placement and integrated lifecycle still require physical acceptance. The prototype keeps the two-minute recovery watchdog and pinned observer lifetime. See Projects/Itacan/Strict Oath Testing.md.
