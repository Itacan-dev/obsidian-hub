# Phase 5 release and personal preview

Run with Node, or the existing Electron executable with `ELECTRON_RUN_AS_NODE=1`:

```
node lib/tests/oath-host/launch.cjs --strict-release
node lib/tests/oath-host/launch.cjs --preview-smoke
node lib/tests/oath-host/launch.cjs --strict-preview
node --test lib/tests/oath-phase5.test.cjs
```

The first two commands are bounded automated runs. The third opens a disposable
personal preview and waits for its recovery panel, local shortcut or deadline.
The convenient launcher is `Projects/Itacan/Strict Oath Preview.cmd`.
No dependencies are installed. The normal vault/profile is never opened by the
fixture. Source builds target only the copied plugin in the temporary vault.

`--strict-release` includes the real Phase 4 UI checks and then tests reload,
resume/display handlers, second-window ownership, a real dock crash, host-loss
handling and the real Settings recovery button. It restarts a separate process
over the same disposable profile to verify interrupted-state recovery. Pending
store writes are drained before reload; mid-write hot reload is not certified.

The preview's main-process recovery panel and two-minute guard watchdog are
registered before Strict entry. The whole preview is bounded to twenty minutes.
The local shortcut cannot run while an external app has focus; use Alt+Tab back
to Itacan or the independent recovery window. The preview helper can permit
currently observed apps in test data only. Never close a real document for a test.

`setup.cjs` substitutes synthetic workspace/task/index adapters but retains the
actual Oath service, UI, persistence and native windows. The automated release
suite scopes preflight to owned fixtures. The personal preview observes real
ordinary applications, without storing their names/paths in shared test reports.

See [the report](../../../../../../System/Hub-oath-phase5.md) and
[manual procedure](../../../../../../Projects/Itacan/Strict%20Oath%20Testing.md).
No physical Alt+Tab or hardware acceptance is inferred from automated events.
