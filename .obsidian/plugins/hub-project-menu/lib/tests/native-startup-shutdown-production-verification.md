# Native startup/shutdown ? production verification

**Complete for Pulsed Optomechanics's approved native task operations.** Actual ordinary startup, graceful quit, process restart and task/Step persistence passed against the installed plugin and everyday vault/profile. Obsidian is closed after verification; the authority is unlocked. This execution did not repeat cutover, recreate the authority or modify Markdown.

## Source inventory

Only two production source files changed:
- `plugin.js`: initial onload no longer waits for native admission while Obsidian has not reached layout readiness. Legacy remains the default for other owners.
- `lib/services/native-task-host.js`: immediate selected-owner guards; cancellable readiness/admission, pending consumer promotion, subscription reentrancy protection, and supported graceful-quit draining.

Focused tests changed: `ItacanTaskCore/integration/tests/startup-host.test.cjs`. Installed asset changed: `main.js` only. This report is new. No native persistence, generation, command, receipt, recovery, History-calculation or unrelated subsystem source changed.

## Startup race and correction

Activation originally captured a missing Project before Obsidian's metadata index was ready, then permanently reserved it as blocked. Onload also awaited admission before Obsidian could finish readiness. The host now installs the selected-owner legacy-write guards immediately, waits on `onLayoutReady` and the dashboard's metadata `changed`/`resolved` events with a subscribe/recheck boundary, then rereads and validates the existing activation. No fixed readiness delay is used. Existing valid config cannot change identity during this handoff. Admission failure remains unavailable, never Markdown fallback.

Unload cancels pending waits and removes metadata subscriptions; late/repeated notifications cannot create another host. Project/Home panels and History subscribers created while opening are promoted/refreshed once admission succeeds. Actual UI testing additionally caught synchronous initial-subscription reentry in the new lazy wrapper; its callback now defers/coalesces until the one delegate is assigned. A dedicated test checks this case.

## Shutdown race and correction

Electron exit does not await asynchronous plugin `onunload`. Window-level cancellation alone also proved insufficient during loaded-dashboard verification. The final implementation uses Obsidian's own `workspace.on("quit", tasks => tasks.add(() => host.close()))` mechanism. Tasks starts the callback immediately and participates in the app's graceful-exit processing. Host close stops admission, cancels readiness, drains accepted native work, closes consumers/subscriptions and releases the owned lease. Repeated close requests reuse the same drain. The listener is removed on close/unload.

No global Electron hook, custom window-close recursion, custom exit timeout, automatic stale-lock deletion or recovery-fence reset is installed. Obsidian owns its bounded/best-effort quit lifecycle; forced process termination retains the existing recovery contract. API reference: [official Obsidian Workspace quit / Tasks declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts).

A real quit failure in the superseded window-level attempt left a lock. Its exact bytes/hash, token, host/PID and proven process death were preserved before explicit one-record quarantine into the durable rollback package. That is not a reusable runtime recovery mechanism. The subsequent final-build cycles required no lock cleanup.

## Focused verification

**78/78** combined checks passed (19 lifecycle, 59 affected Home/Schedule/operator-recovery/host checks). **1 declaration runner**, zero diagnostics. New lifecycle coverage includes readiness before/during registration, duplicate notifications, pre-ready consumers, cancellation during layout/metadata waits, genuine admission failure, repeated quit requests, and shutdown during initialization. An actual disposable write is held after publication/before acknowledgement: quit Tasks remains pending with the lease held until the accepted write finishes, then releases it; reconstruction retains exactly that task.

Final build: 235 main / 25 Atlas factories. Main IDs/count unchanged; only `plugin.js` and `lib/services/native-task-host.js` factory bodies differ from the installed baseline. Installed main equals the staged bytes:

`703ea24447676b420cfc706561fad4ca164bd2b116360c8827b839be8359744f`

Final durable rollback copies: `C:\Users\El_Baraka 2025\AppData\Local\Itacan\CutoverArchives\v1\47f2fab0a1a1e5ec\preparation-20261021-b4c56b89-01c7-4890-8b9a-dad0265687f9\continuation-24476e41-bec1-45c2-9d0b-b50e8604635a\lifecycle-6197894b-2f52-45ce-8b27-11d9f6bb2e9d`. All older installation/cutover rollback copies remain preserved.

## Actual ordinary application results

- First ordinary startup reaches native `ready` without a plugin reload, using authority `5caa62f1-8f75-4682-af57-aba6affa01a1` and the original device/vault/Project identities.
- Pulsed Optomechanics Project Tasks controller and visible panel operate natively. Actual Add/Edit modals created and edited one clearly labelled unchecked test task, then added an unchecked flat Step.
- Task UUID `634b5f09-b432-4b3f-acb0-df8fc380c9fe` and Step UUID `5d56d116-7ed6-4921-b93a-5cf4895ee81b` persisted with their edited text across actual process restarts.
- Project panel shows that task once. Visible Home shows it once; Home's complete mixed feed contains 1 native + 65 legacy task rows. No unavailable/partial-total presentation remained.
- Actual Project Schedule Overview, Week (7 days) and Month (35 cells) render. Date-only Due `2026-10-22` remains time-null.
- Existing History reader returns all 182 legacy records; actual Statistics modal loads its source and calculated model. No real completion was performed and no native completion event was generated.
- Six other Projects and all Resources remain Legacy. Selected-owner legacy mutation and unsupported Phase entry points reject before effects. Native recovery command opens; all four retained verification operations inspect as confirmed committed, including creation after later deletion.
- Final-build graceful quit cycle 1: all processes exited and lock released in 0.84s; cycle 2: 0.83s. Neither called host.close manually or reloaded the plugin. Both were ordinary application quits with dashboards active.
- The temporary task was deleted through the native application adapter after restart. Final validated repository: revision 4, zero live tasks, one deletion tombstone, zero completion events. Original authority/activation unchanged. No old task was automatically recreated.

Actual runtime checks used the ordinary installed application and profile through a loopback-only temporary debugging session, not a separate application or injected startup graph. All application processes/debugging endpoints are now closed. No manual verification remains for the checks above.

## Preservation and limits

All 182 legacy History records and task metadata retain their exact pre-execution digests. Existing retirement bytes, every other protected Markdown file, activation/continuation records, original archives/backups and eleven other installed assets remain unchanged. Of 1167 protected paths compared, only installed main.js and application data.json bytes differ; application byte drift was preserved without restoration or attribution. No unrelated explicit Oath/Inbox/Roadmap/Atlas/Music operation was invoked. Dirty Git state was preserved.

Raw commands/exits, first-attempt failures, actual-app checks, lock evidence, source/asset comparisons and final proof: `C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-lifecycle-v183ahh7`. Earlier failed window-level and UI-driver checks are retained and are not counted as final passing acceptance.

No remaining blocker was found for the selected Project's supported native operations. Unsupported Oath/Inbox/Phase/sharing/clear-completed/recurrence or nested-editor operations remain unavailable as before. Extending to another owner or device remains separately authorized work. Unexpected termination is not represented as graceful shutdown and retains existing native recovery safeguards.
