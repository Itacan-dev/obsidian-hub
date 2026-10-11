# Test Strict Oath safely

Use the isolated preview first. Installing the build does not enable Strict Oath
in your everyday vault. No preview development shortcut is shipped in the
production plugin.

## Open the preview

1. Double-click **[Strict Oath Preview.cmd](Strict%20Oath%20Preview.cmd)** in this
   folder. It uses the already installed test Electron and Obsidian archive;
   nothing is downloaded. Allow a few seconds for its automatic recovery checks.
2. Look for the blue **ISOLATED STRICT OATH PREVIEW** banner, the separate
   **Strict Oath preview recovery** window, and the green external test window.
   This is a disposable vault/profile containing synthetic projects and tasks.
   Your everyday Obsidian window and applications remain separate.
3. Before starting, try **Release restrictions** in the recovery window, or
   **Ctrl+Alt+Shift+F12** with a preview window focused. Finish and relaunch the
   preview afterward. Every launch also automatically verifies native shortcut
   recovery and saved-window-state restoration before allowing restrictions.

The shortcut is local to the preview's Electron windows. While an external
application has focus, **Alt+Tab back to the recovery window or preview Itacan**,
then use the shortcut or **Release restrictions**. The recovery window stays
available independently of the Itacan renderer. Restrictive guards automatically
release after **two minutes**; the entire preview closes and cleans up after
**twenty minutes**. **Finish and clean up**, or closing the recovery window,
also releases restrictions and ends only the disposable session.

## Inspect Settings and applications

1. Settings opens at **The Oath**, with Strict disabled. Inspect the opt-in and
   application list. **Browse** or **Add path** selects an application's `.exe`;
   paths are verified before saving. Remove an entry and add it again.
2. To avoid closing applications from your normal desktop, click **Permit
   currently open apps (test only)** in the recovery window. Close and reopen
   Settings to see the resulting list. This changes only disposable data and
   grants permission only to executable identities the observer can verify.
3. Enable Strict in the **preview** Settings, then close Settings. Open **The
   Oath** from the bottom bar. Select **Strict**, the synthetic project, and at
   least one synthetic task. Choose **Custom → 1 minute** and commit the value.
   Inspect the per-Oath application override; leave it inheriting defaults for
   the first test.
4. Choose **Review Oath**. Inspect blockers, unknown identities and coverage
   warnings. Refresh after changing applications; acknowledge the restrictions
   again. Take the Oath only when the immediate-start checks are ready.

Never close a document with unsaved work just to pass preflight. Add its
application to the test permissions and review again, or cancel the test.
Some Windows dialogs and packaged apps are not observable; permission checks
are best effort. The preview's synthetic workspace/index adapters let you test
the real Oath UI and lifecycle without importing your vault or Dataview data.

## Exercise the desktop behavior

- Confirm Itacan becomes fullscreen and its ordinary close/minimize/fullscreen
  exit actions are discouraged. Try Alt+Tab to the green test application and
  your permitted applications. Confirm Itacan stays fullscreen underneath.
- Minimize and restore an external application using its normal Windows
  controls. Confirm you can keep working and switch normally. The Oath dock
  should remain visible above ordinary external windows on the host display.
- Try **Return to Itacan** on the dock. Its application buttons **launch** an
  allowed executable; they may open another window. Use Alt+Tab to focus an
  already open application. Arbitrary external focus/minimize/restore buttons
  are deliberately unavailable. The preview's `electron.exe` entry identifies
  the green companion; switch to that existing window rather than launching
  another Electron instance.
- Optionally open an unpermitted application: detection can warn and attempt a
  bounded focus nudge while leaving the Oath active. It does not close the app
  or guarantee foreground control. Return to Itacan yourself if necessary.
- After one minute, use the ordinary fulfilled **End Oath** action and inspect
  history. Alternatively, use preview recovery and observe interruption instead.
  Finish the preview; its profile and synthetic files are removed.

Optional acceptance checks: another display, changing scaling, Windows sleep
and wake, another Obsidian vault/popout, and your usual Atlas pages. Save work
first and keep this to the isolated preview. Physical Alt+Tab, third-party
stacking, actual sleep/wake and unplugged-display behavior require your own
observation; automated event tests do not establish these guarantees.

## Everyday installation after review

The rebuilt files are installed, but a running Obsidian process may still have
the old renderer and main-process modules loaded. **Save work and fully quit
and reopen Obsidian** when ready; a plugin toggle alone cannot refresh cached
main-process modules. Inspect Settings with Strict still off. Do not enable
Strict on your everyday installation until you are satisfied with the preview.

For a first everyday commitment, verify your permitted executables, select a
short duration, and read the final confirmation. The production build has
**no development escape or automatic two-minute release**. Windows controls
and deliberate OS-level escape remain possible. A fresh process records an
interrupted commitment without automatically re-entering fullscreen.

If restoration fails, guards are disarmed and Settings → The Oath offers
**Restore window** to retry. No external application is forcibly closed.
Wait for saves to finish before a plugin reload. Reloading while an old plugin
instance is still writing can trigger Itacan's existing data-conflict protection;
do not bypass that check. Save work and restart Obsidian if this occurs.
Use the release report for the installed artifact hashes, backup location and
remaining verification limits: [Phase 5 report](../../System/Hub-oath-phase5.md).
