# Strict Oath implementation plan

Revised 8 October 2026 through Phase 4, after the Phase 1–2 experiments and lifecycle integration.
This is the repository copy of the previously attached plan, updated for the
behavioral commitment philosophy. Earlier experiment reports remain historical
evidence; their exhaustive desktop-enforcement gates no longer block lifecycle
work.

## Product boundary

Strict Oath makes continuing work easier than impulsively leaving it. It is a
commitment feature, not a security boundary. Deliberate OS escape, process
termination and local tampering are acceptable. The ordinary Oath mode keeps its
existing behavior. Strict remains disabled by default pending review.

Reliable application behavior: confirmed policy snapshots, service-level early
exit refusal, selected-task/time fulfillment, save-before-release, serialized
activation, cancellation while scheduled, history recorded once, and restoration
of window state on normal exit or failed preparation.

Best effort: application discovery, native close/minimize/fullscreen guards,
foreground nudges, desktop stacking and recovery from OS window changes. An
active commitment stays active if observation or a focus request fails. Do not
promise website filtering, notification suppression, a complete inventory, or
OS-wide keyboard restrictions.

No custom Win32 bindings, native application-control implementations, hooks,
elevated helpers, services, drivers, registry/policy changes or security-disabled
Electron/Atlas settings. Never terminate another application or close its
documents. External applications remain ordinary independent Windows windows.

## Existing foundations and architecture

Reuse the service queue, data store, device buckets, task identities, workspace
navigation, timer/task fulfillment latch, history, status footer and review flow.

- `lib/services/oath.js`: lifecycle, device application defaults, review contract,
  frozen Strict policy, activation/recovery and central exit boundary.
- `lib/domain/oath-strict.js`: policy normalization, confirmation copy/version,
  executable-path classification. No Obsidian or Electron dependencies.
- `lib/services/oath-strict.js`: injected host/observer coordinator, preflight,
  observation health and bounded nudges. No Obsidian dependencies.
- `lib/services/oath-strict-host.js`: main-process Electron fullscreen ownership
  and restoration; one active Strict host per process, retained across reloads.
- `lib/services/oath-process-observer.js`: fixed read-only PowerShell/.NET process
  snapshot through documented Node `execFile`; no native dependency.
- `plugin.js`: the existing private Obsidian bridge obtains the default-disabled
  main-process coordinator. Standalone Electron can call the same host factory
  directly and replace Obsidian storage/task adapters.
- `lib/ui/oath.js`: existing flow plus minimal Strict waiting/degraded status and
  suppression of early exit, Strict setup/override/review and acknowledgment.
- `lib/ui/oath-settings.js`, `oath-applications.js`: persistent device opt-in
  (off by default) and shared verified application editor.
- `lib/services/oath-dock.js`, `lib/ui/oath-dock/`: independent sandboxed dock,
  main-frame validated IPC, verified executable launch and host-focus requests.

Device defaults are normalized, verified local `.exe` paths stored in
`oathsByDevice[deviceId].strictApplications`. Per-Oath overrides replace defaults,
including an explicit empty list. Confirmed snapshots do not change when defaults
change. Paths identify applications; titles and PIDs never grant permission.
Only the participating window gets implicit permission; other process windows
are not automatically allowed just because they belong to Obsidian.

## Revised desktop capability choice

The Phase 2 native dependencies remain **test-only historical experiments**.
Do not integrate get-windows/nut.js or commission missing native controls.

Use Windows' built-in `Get-Process` / `.NET Process.MainWindowHandle` for a
bounded process-window snapshot and Electron `desktopCapturer.getSources` for
supplemental window evidence, with zero-sized thumbnails and no icons. Match
normalized HWND strings. Corroborated windows are possible non-permitted application candidates with
unverified switchability. Automatic review requires resolving those candidates. Unmatched known windows are uncertain, and additional
source-only windows have unknown executable identity. Both warn and allow
acknowledged activation. No executable-name or title exemption grants permission.

Only one window per process receives executable identity. Minimized windows,
dialogs, packaged apps, cloaking and virtual desktops remain incomplete. Capture
eligibility approximates Alt+Tab eligibility. Primary snapshot failure prevents
new activation. Supplemental failure yields uncertainty and degraded coverage.
Both observations have four-second bounds. A timed-out Electron request retains
its single-flight lease until it settles, and late evidence is discarded.
Physical Alt+Tab comparison remains required for personal acceptance.

During a session, poll serially with a five-second delay after each result.
For version-3 commitments, new observed non-permitted executable paths can produce
one host-focus attempt after two successful observations, at most three attempts
per Oath and at least sixty seconds apart. The final preparation snapshot supplies
the window-bearing executable baseline. Earlier confirmations retain their original
monitoring rules. This does not claim to detect foreground
changes or repeatedly pull focus from permitted applications. Observation failure
leaves the Oath active and reports degraded checks. Fixed query timeout: four
seconds. No user input is inserted into shell commands.

Use guarded `setFullScreen(true)` and a main window that is not always-on-top.
Do not consume Alt+Tab. In tested Electron 39 on Windows, `isKiosk()` mirrors
fullscreen, so that query cannot distinguish modes. Phase 1's conflicting
`isFocused()` flags cannot establish OS foreground ownership. Physical switching
and desktop stacking remain manual acceptance work, not security gates.

## Activation, fulfillment and recovery

1. Validate workspace, selected tasks and duration through existing rules.
2. Review Strict policy through `reviewStrict(draft)`: frozen applications,
   preflight findings, confirmation version/nonce and accurate restriction copy.
   `take` requires that confirmation and rejects changed/expired drafts.
3. For immediate activation, require detected blockers to be closed before task
   mutation. Persist the commitment as scheduled, then recheck during preparation.
4. At the scheduled time, wait on known blockers or total observation failure.
   Keep `startedAt` null and allow cancellation even after the original due time.
5. Prepare host guards; recheck observed applications and workspace; persist
   successful activation with the actual start time. Roll back window changes if
   preparation or the active-state save fails. Never downgrade to ordinary mode.
6. Keep timer-or-all-selected-tasks fulfillment and fulfilled-but-Oathbound state.
   Reject early exit in the service even if called directly with `broken`.
   Save the final record/history before releasing guards. A missing workspace
   does not end an active Strict Oath; its timer remains usable.
7. Main-process ownership survives plugin reload without duplicate guards.
   Missing host session after restart records an interruption without re-entering
   fullscreen. Use the last persisted observation for elapsed accounting and
   record detection time separately; do not invent the exact interruption time.

The Obsidian development prototype loads `oath-prototype-host.js` as its explicit
entrypoint. Settings ? The Oath exposes development recovery verification and
release. Before Strict entry, the main process verifies the local
Ctrl+Alt+Shift+F12 path and opens an independent sandboxed recovery window.
Its button, closing that window, renderer loss, and a two-minute main-process
watchdog release guards. Emergency release is reconciled as an interruption.
Another test requires recovery verification after an emergency release.
Strict setup remains opt-in and off by default. Existing settings are preserved.

Standalone Itacan calls `oath-strict-host.js` directly and omits the prototype
entrypoint, Settings recovery controls and `lib/ui/oath-prototype` assets from
its packaging. No environment flag enables prototype recovery in the core host.
Isolated automated tests continue internally; manual tests use the existing
Itacan installation. Save work and fully restart Obsidian after installation to
refresh cached main-process modules.

## Phases and revised verification

| Phase | Scope | Gate/status |
|---|---|---|
| 1 — Host experiment | Isolated profile/vault; fullscreen, dock, escape, restoration | Infrastructure retained. Working restoration accepted; OS focus/stacking limits documented. |
| 2 — Windows adapter experiment | Upstream native observation/control feasibility | Historical experiment retained. Missing controls and modal coverage accepted as limits; no native dependency adopted. |
| 3 — Lifecycle integration | Policy, persistent defaults API, confirmation contract, preflight, scheduling, early-exit safeguards, recovery, default-disabled host | Verify save/race rollback, delayed actual start, due cancellation, fulfillment/history, interruption and same-process reattachment; isolated escape/restoration required. Unknown Windows edge cases are warnings. Stop for review. |
| 4 — Settings and dock | The Oath settings, per-session mode/override selection, blocker review and final confirmation, supported dock actions, keyboard-accessible footer/status | Implemented in source and isolated builds: 13 native checks, 86 selected regressions and ordinary Oath/Settings browser fixtures pass. Launch/host focus only; no external minimize/restore. Manual desktop acceptance remains open; default enablement and installed bundles unchanged. Stop for review. |
| 5 — Recovery and release | Broader reload/restart, failed restoration, sleep/wake, displays, other vaults/popouts and Atlas guest focus; packaging and regression coverage | Implemented, built and installed with Strict still off. 20 isolated release checks, 5 preview checks, 115 general and 32 Atlas regression entries, 22 native Atlas checks and 11 installed-load/recovery entries pass. Physical desktop/hardware acceptance remains personal review. Stop here. |

## Phase 4 result and Phase 5 handoff

Phase 4 wires the service APIs into the existing setup/review flow. It adds an
explicit device-local Settings opt-in that is off by default, separates blockers
from incomplete observations and resets acknowledgment when checks refresh.
Settings writes affect future confirmations; active/scheduled policies remain
frozen. Disabling setup never releases an existing commitment.

The dock provides verified executable launch and host focus with secure Electron
renderer preferences and validated narrow IPC. Footer/status equivalents support
keyboard use. Arbitrary external minimize/restore/focus and foreground detection
remain unsupported; ordinary Alt+Tab is the fallback. Dock loss reports degraded
checks while the Oath stays active. Phase 5 should address reconstruction,
packaging of local dock assets and broader recovery/manual acceptance; do not
force missing controls through title matching, input injection or native code.

Reports: [Phase 1](../../System/Hub-oath-host-experiment.md),
[Phase 2](../../System/Hub-oath-windows-experiment.md),
[Phase 3](../../System/Hub-oath-lifecycle.md),
[Phase 4](../../System/Hub-oath-phase4.md).

## Phase 5 result and personal review

Phase 5 adds dock reconstruction, resume/display handling, off-screen recovery,
retained restoration snapshots and Settings retry, with guards disarmed before
restoration. Actual plugin reload after pending saves, dock crash and fresh-process
interruption recovery pass in the isolated harness. Mid-write reload can still
trigger existing data-conflict protection; it is not bypassed.

The production asset closure is explicitly built and hashed. The installed
bundles have a local rollback backup. Normal device opt-in/data were not changed;
no normal Obsidian restart or restrictive activation was performed.

[Strict Oath Preview.cmd](Strict%20Oath%20Preview.cmd) opens actual Settings and
Oath UI with synthetic tasks, an ordinary external companion and an independent
recovery window. It verifies development escape/restoration before restrictions,
then provides local Ctrl+Alt+Shift+F12, a two-minute guard limit and a twenty-minute
session deadline. The Obsidian prototype also ships its separately isolated development recovery controls.

Use the [testing procedure](Strict%20Oath%20Testing.md) and
[Phase 5 report](../../System/Hub-oath-phase5.md). Physical Alt+Tab, third-party
stacking, actual sleep/wake/display changes, and exact installed-launcher behavior
remain manual acceptance work. The prototype recovery update is authorized for direct manual testing in the existing installation.



## Per-Oath manual application review

Version-2 confirmations use version 2 and freeze `applicationCheckMode` as `automatic`
or `manual-review`. Each setup starts with automatic review. A separate Alt+Tab
acknowledgment enables manual review for one Oath. Refresh returns review to
automatic and clears both acknowledgments. Setup changes also reset the choice.
The mode and manual acknowledgment are bound to the confirmation nonce/signature.

Manual review keeps all observed application findings visible as advisory,
including subsequently opened applications. It allows application candidates
through immediate and scheduled activation rechecks and suppresses application
focus nudges. Primary query failure still prevents activation. Legacy version-1
commitments retain automatic behavior, and cannot acquire manual mode through
a legacy confirmation. Executable launch permissions remain independent.

Capture-source corroboration does not establish physical Alt+Tab eligibility.
The installed NVIDIA overlay observation confirmed that this distinction matters.
No executable-name, signature, system-directory or window-title exemptions are
introduced. Physical Alt+Tab comparison remains a manual acceptance step.

## Bounded application nudges for version 3

New confirmations use version 3. Both automatic and manual review disclose
bounded nudges for newly observed known executable paths, including uncertain
windows. Automatic preflight blockers and manual activation acknowledgment retain
their established roles. Version-1 and version-2 commitments retain their original
behavior, including nudge-free version-2 manual review.

The final successful preparation observation supplies an in-memory baseline.
Monitoring starts after active-state persistence and commit. Baseline and handled
paths survive renderer reload in the existing coordinator and clear on release.
A known path must appear in two consecutive successful primary observations.
Primary failure clears consecutive evidence. Supplemental failure leaves readable
primary windows eligible. Source-only and unreadable identities remain advisory.

An event groups all eligible paths and marks them handled before focus. Cooldown
and budget suppression also consume the event, so no delayed focus is queued.
The limits are one attempt per path, sixty seconds between attempts, and three
attempts per Oath. Focus failure consumes an attempt. The status view reports
attempt counts, time, applications and suppression outcome.

Path suppression grants no dock launch permission. It suppresses later genuine
windows from the same path as well as restarts. Helper and versioned paths can
produce false nudges. A utility may interrupt permitted work. Windows can refuse
focus. Physical acceptance is required before broader promotion.


## Centered Oath Reminder prototype ? 13 November 2026

New confirmation version 4 replaces inventory-triggered focus nudges with the foreground-dependent Oath Reminder in both automatic and manual review. Versions 1?3 keep their confirmed behavior. Automatic/manual activation checks, executable permissions and dock launch authority are unchanged. Strict remains disabled by default; existing device settings are preserved.

The reminder appears after three continuous observed seconds in known non-permitted foreground applications, centered in that display's work area. Invalid/missing/offscreen geometry falls back to Itacan's display, then primary. It is non-movable, non-modal, normally always-on-top and has no ordinary dismissal. It hides on permitted return or stale/unknown observation. It never automatically requests focus; Return to Itacan is explicit.

This is a narrowly scoped exception to the earlier test-only native-provider decision: only the pinned get-windows 9.3.0 foreground observer is packaged for the Obsidian development prototype, in a disposable utility process with integrity verification, 2.5-second request bound, parent lease and 125-second absolute lifetime. No native application controls or custom Win32 bindings are added. The two-minute prototype recovery watchdog remains mandatory. Upstream cleanup and packaged-app attribution concerns prevent claiming sustained/standalone readiness.

Before testing in Settings ? The Oath, save work and verify the independent recovery window. Ctrl+Alt+Shift+F12 works locally in Itacan, recovery and the registered reminder; from an external application, return to one of these windows first. Recovery removes reminder, helper and fullscreen guards. No separate preview application is required for manual testing. Restart Obsidian after installing to replace cached main-process modules; do not reload during an active commitment.

Physical acceptance: at least 30 transitions; no appearance before three seconds, 95% within 3.0?3.5 seconds of first qualifying sample; hide within 500 ms under normal sampling. Check negative display coordinates, mixed DPI, straddling windows, display removal and invalid-bounds fallback. Confirm no dragging, no automatic focus changes, no background NVIDIA restart reminder, continued permitted-app/dock use, and shortcut/independent-window/watchdog recovery. Recheck actual stacking; Electron flags alone do not establish physical visibility. Long-session soak and the actual installed launcher runtime remain separate acceptance work.
