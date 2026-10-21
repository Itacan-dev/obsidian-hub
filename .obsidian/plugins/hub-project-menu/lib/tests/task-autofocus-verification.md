# Add task native autofocus correction — 2026-10-14

This focused fix corrects the remaining live autofocus issue after
[Phase 1](task-editor-phase1-verification.md). Layout, styles, shared rendering,
disabled specifications and Edit's dialog focus remain unchanged.

## Actual cause

The native title textarea already exists and is attached when the task editor's
`render()` focuses it synchronously. Its empty selection is collapsed at offset
zero. The adapter is already in its native editing state, rather than displaying
the focusable Markdown preview. CSS does not suppress the caret: computed caret
color is visible and the textarea is not hidden, transparent, disabled or readonly.

However, Phase 1 left `hasInitialInputFocus` enabled for Add. Inspection of the
installed Obsidian 1.14.4 `Modal.open()` establishes that **after `onOpen()` returns**,
Obsidian runs its BE/RE/FE first-control focus pass. That pass unconditionally
focuses the first eligible shown descendant, even when another child is already
focused. The task's completion checkbox precedes its textarea. Thus the explicit
title focus was subsequently overridden, removing native text insertion/caret
ownership before the user could type.

The old simulated Modal was inaccurate here: it preserved existing focus inside
the window. That assumption explains why its focus-only checks passed despite the
live failure. The opening fixture now models the installed unconditional pass,
including native eligible-control selectors and non-tabbable close chrome. Before
the production correction, this revised fixture reproduced failed initial title
focus for Home, Project, Resource and repeated Home Add, while layout stayed stable.

## Small correction

`ui/task-editor.js` now sets `hasInitialInputFocus = false` for the task composer.
It owns the already-established synchronous focus decision itself:

- Add focuses the actual attached native textarea after final sizing. An empty
  title retains collapsed selection `(0, 0)`, the real placeholder and native caret.
- Edit retains focus on the dialog and does not activate its title automatically.

No additional focus call, timer, animation frame, fade or rerender was added. No
literal caret character or custom drawn caret is used. The settled geometry,
muted placeholder, compact header, title hover and draft behavior are preserved.
The stylesheet is byte-for-byte unchanged. This is the only production change.

## Keyboard, caret and opening verification

The new `task-autofocus.html` fixture uses the corrected native opening order,
isolated real task services and installed Obsidian stylesheet/fonts. It verifies
the actual HTMLTextAreaElement, its attachment/parent, native editing state,
collapsed selection, CSS visibility/caret color and immediate keyboard ownership.

Without clicking, assigning focus in the test, waiting for settled frames or
programmatically setting a value, trusted Chromium key events type `q`, move the
insertion point to the beginning with Ctrl+Home, insert `a` to produce `aq`, select
the text with Ctrl+A and delete it with Backspace. Native selection offsets and
pending task text are checked after those operations. Clearing restores the empty
placeholder and `(0, 0)` caret. Eight frame samples then verify retained focus,
selection and unchanged modal/card/input geometry. Home, Project, Resource and
repeated Home Add are exercised; Edit receives a key without altering its title.

The browser runner gained correct standard virtual-key mappings for Home, End,
Backspace, Delete and horizontal arrows, allowing real native editing commands.
No existing assertions were removed or weakened.

- **472 keyboard/caret checks passed on desktop.**
- **472 passed at 360 × 640 / 150% scaling.**
- **472 passed with reduced motion enabled.**
- Corrected opening fixture: **3,829 desktop and 3,829 narrow/150% checks passed**,
  including first-frame focus, stable geometry, delayed/failed Edit reads, retry,
  cancellation, configured metadata and initial feedback suppression.
- Phase 1 hierarchy/readiness fixture: **158 checks passed** with the corrected
  native focus behavior.
- Shared card/editor regression fixture: **1,849 desktop and 1,845 narrow/150%
  checks passed**, including parity, native input/IME, selection, Steps, popovers,
  Save/Cancel, locks, failure/retry, metadata/history/statistics and reduced motion.
- Existing browser regressions passed: modal-regions **176**, task-form-workflows
  **64**, Home **48** plus workspace/Note layouts **36**, task-step-progress and
  row-focus.
- Eight relevant Node suites passed: task-form, task-compact-form,
  task-layout-polish, task-created-completion, task-history, task-mutations,
  task-creation-retry and typography.

## Live environment and evidence limits

The running **Home - Work - Obsidian 1.14.4** window was located using Windows
process and accessibility APIs. Its accessibility provider exposed only nine
host controls and no task entry/input controls. The running process did not expose
a usable renderer debugging connection to this session. Therefore no reliable live
task activation/typing test was available through these interfaces. The app was
not restarted, its accessibility/debug settings were not changed, and no blind
keystrokes were sent to the live vault.

The native Modal focus implementation was inspected directly in the installed
application, rather than inferred from the simulated host. Trusted native keyboard
editing, caret selection, visible caret CSS and screenshots were verified in
isolated Chromium using that corrected lifecycle. **Live blinking-caret confirmation
still remains for user review after reloading the plugin.** Screenshots were
personally inspected; they show the native insertion caret at the empty title's
beginning, with the existing placeholder and disabled actions.

- [Baseline focus failure](../../../../../System/Backups/task-autofocus-20261014/baseline-focus.log)
- [Baseline opening trace](../../../../../System/Backups/task-autofocus-20261014/baseline-frames.json)
- [Desktop keyboard/caret frame evidence](../../../../../System/Backups/task-autofocus-20261014/desktop-frames.json)
- [Narrow keyboard/caret frame evidence](../../../../../System/Backups/task-autofocus-20261014/small-150-frames.json)
- [Desktop Home Add caret](../../../../../System/Backups/task-autofocus-20261014/review/desktop-home.png)
- [Desktop Project Add caret](../../../../../System/Backups/task-autofocus-20261014/review/desktop-project.png)
- [Narrow Home Add caret at 150%](../../../../../System/Backups/task-autofocus-20261014/review/small-150-home.png)

## Safe installation

Pre-change affected source/tests, styles and installed artifacts are preserved in
`System/Backups/task-autofocus-20261014/source/`. The ignored backup directory also
contains native-focus inspection, staged artifacts, logs, screenshots and traces.
The established `build.js --output-dir` staged first; normal installation followed
verification. Installed syntax/plugin loading and scoped whitespace checks passed.
Installed main/native/asset hashes match staging; native artifacts and styles are
unchanged. Unrelated workspace changes are preserved. No live task was edited and
Obsidian was not automatically restarted or reloaded.

Installed `main.js` SHA-256:
`d8c98abd8b8371d2d39263f6deafb24792623ca015a5066b4129bbd04fb7d268`

Reload Hub Project Menu and open Add task without clicking its title. Verify the
native blinking caret and immediate typing in the live window. Stop for review.
