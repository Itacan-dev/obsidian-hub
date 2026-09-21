# The Oath — 20 September 2026

The existing setup, confirmation, picker, status control, pinned tasks, device-scoped persistence and history now use a duration-based commitment. The setup follows the supplied design: Now / Select date and time, optional multiple tasks, and 25 / 50 / 90 minutes / Custom. Now and 50 minutes are selected by default. Custom durations must be positive whole minutes. The subtitle is the only setup helper copy.

Confirmation retains its layout and exact ceremonial pledge. Commitment replaces the old fulfillment-mode row; the device row is removed. General work is shown when there are no tasks. Ending copy describes the first applicable timer/task condition and the option to continue Oathbound after fulfillment.

## State, fulfillment and history

Records stay in `oathsByDevice[deviceId].current` and `.history` in the existing Hub data store. No separate history architecture was added.

- `state: "scheduled"` waits for activation; `startedAt` is the actual activation time.
- `state: "active", fulfilledAt: null` is an unfulfilled active Oath.
- `state: "active", fulfilledAt: <timestamp>` is a fulfilled Oath that remains Oathbound.
- `state: "fulfilled"` or `"broken"` is an ended Oath; `completedAt` is the actual exit time, and `elapsedMs` includes all Oathbound time through exit.

Every new Oath has `durationMs` and an optional array of task references. `fulfilmentTime` in the domain module defines the fulfillment condition. The service latches fulfillment when the duration expires or every selected parent task is complete. Task changes cannot undo that latch, including while a failed save is being retried. Completion only updates state and existing views: it does not show a fulfillment modal, release fullscreen, unpin tasks, or end the session.

`HubOathService.end` is the common exit decision. Before fulfillment it returns `confirmation-required` unless the caller supplies explicit Break Oath intent. It rechecks fulfillment at the time of the final click, so a stale Break button can never turn a fulfilled Oath into a broken one. Terminal records are saved before fullscreen is released and recorded once. Failed terminal saves keep the Oath active and enforced. Prestart cancellation retains its existing behavior.

Selected tasks use existing source identities, mutation queues and task renderers. Steps do not complete parents. Unavailable or copied task identities do not count as completed; duration expiry still fulfills the Oath. Selected work stays pinned until actual exit. Schedules use the same model once activated, including when tasks were completed before the scheduled start. A missing task index does not prevent a timer-only Oath.

## Escape and native fullscreen

The installed desktop host exposes an Electron BrowserWindow through `window.electronWindow` and `window.electron.remote`. Oath-specific kiosk fullscreen replaces the HTML fullscreen fallback, whose Escape behavior cannot be safely canceled by a renderer handler.

The plugin passes the absolute path to `lib/services/oath-fullscreen.js` to `remote.require`. Its native guard runs in Electron's main process, where it can synchronously cancel `before-input-event` and window-close events. It guards native fullscreen/kiosk toggles, catches fullscreen shortcuts, and restores unexpected native fullscreen loss. Renderer capture also handles synthetic/application keyboard routes. Exit requests all reach the same service/UI exit path.

Escape before fulfillment opens **Break your Oath?**. Keep Oath, Escape inside that warning, X and incidental dismissal only close the warning. Explicit Break Oath saves a broken result before releasing Oath enforcement. After fulfillment, Escape ends normally with a fulfilled result and no break warning.

Ordinary fullscreen behavior is untouched when there is no active Oath. After authorized exit the original kiosk/fullscreen state is restored, including a window that was already fullscreen. The main-process guard and original window state survive a plugin reload; reloading alone does not release enforcement. Native source modules must be deployed along with the generated bundle, as they are in this prototype.

## Compatibility

Only current active/scheduled records are normalized. Valid durations are retained; legacy open/tasks modes or invalid/missing durations receive the 50-minute default. Missing task arrays become empty arrays. Old fulfillment, automatic-exit and scope fields are not used by the new model. Terminal legacy records/history are preserved. New records never write the old mode enum. Live user data was not manually rewritten during implementation; normalization runs when the plugin starts.

## Changed files

Under `.obsidian/plugins/hub-project-menu/`:

- `lib/domain/oath.js`: duration validation, normalization, fulfillment timestamps and labels.
- `lib/services/oath.js`: independent fulfillment, scheduling, elapsed time, persistence and centralized exit.
- `lib/services/oath-fullscreen.js`: main-process native guard and renderer adapter.
- `lib/ui/oath.js`: setup, confirmation, shared break warning and active clock.
- `lib/ui/oath-tasks.js`: continued pinning/progress and accurate fulfillment copy.
- `styles.css`: Oath-only card grids and setup proportions.
- `plugin.js`: pass the native guard module path to the fullscreen adapter.
- `main.js`: regenerated distribution bundle.
- `lib/tests/oath.test.js` and `lib/tests/oath.html`: lifecycle/native-guard and browser interaction coverage.

This implementation note is `System/Hub-oath.md`.

## Validation and existing limits

All 15 requested transition scenarios pass across the automated Node and browser fixtures, including warning dismissal, exact timer boundaries, monotonic task completion, scheduled activation, legacy records, and 70 minutes of Oathbound time for a 50-minute commitment. Tests also cover failed persistence, copied/missing task identities, index lag, preexisting fullscreen, plugin reload, main-process guard selection and alternate native exit requests.

The browser fixtures exercise actual Oath UI modules and Home/Workspace/note task renderers with isolated Markdown data and mocked Obsidian/Electron host APIs. Setup and confirmation screenshots were inspected. Task mutation, planning, History, discovery, domain, plugin-load and atomic-store regressions pass. The bundle was rebuilt. These tests do not exercise actual OS fullscreen transitions in the user's running Obsidian session; the plugin was not forcibly reloaded.

The prototype has no application/website whitelist enforcement or OS notification filtering. Confirmation now describes its actual pinned-work and notification behavior; those capabilities were not added. Schedules still require the plugin to be running and use wall-clock timestamps. Existing device scope, sync conflict handling and task-index limitations remain.

Reload Hub Project Menu to load the rebuilt plugin.
