# Task editor polish, Phase 3 — 2026-10-14

This phase refines ordinary Add/Edit configuration popovers. It preserves the
shared card renderer, Phase 1 hierarchy/autofocus, Phase 2 Step editing, draft
storage and deferred location selection. The description information indicator
and persistent configured-icon styling are unchanged.

## Implementation

- Start date, Due date, Necessity, Description and Phase now show their exact
  compact titles through the existing `openTaskPopover` header. All use the same
  left title, right Lucide X, 12px outer padding, compact body typography and
  neutral close-control styles. No title icons, subtitles or native modals were added.
- Start/Due share a content-measured width. `measureNativeDatePopover` measures
  empty native fields with Chromium's intrinsic content sizing, retaining the
  localized segments and field chrome instead of estimating `YYYY-MM-DD` text.
  The grid uses those proportions, reserves both clear slots even when empty,
  and stacks fields if their measured total cannot fit the viewport. The fixture
  measures both endpoints at **286 × 157 CSS pixels** on desktop, reduced from
  the previous 360px width; narrow/150% measures approximately **284 × 156**.
- The installed Obsidian stylesheet already positions the native calendar on the
  left. Scoped endpoint CSS applies the same convention to Chromium's actual
  time indicator, including its native hit area. Native shadow-DOM measurements
  verify both indicators occupy the left slot. Neither icon is decorative, hidden
  or duplicated; no separate trigger or text parser was needed.
- The existing `bindNativeDateTimePicker` supplies Space/Alt+Down picker access
  for these fields. Its optional key list leaves Enter available for the endpoint's
  existing Apply behavior. Picker observation is disposed with the popover. Other
  callers retain the helper's original key defaults.
- Date/time clearing, isolated endpoint drafts, Cancel/X/Escape/outside discard,
  Apply validation, optional untimed dates, midnight and full range formatting
  remain. Apply updates only the pending parent draft; Add/Save persists it.
- Necessity has exactly two full-width alternatives, **Must do** and **Should do**,
  with their existing red/yellow markers, matching label columns and purple selected
  fill. **Clear | Done** uses the existing separated footer, with Clear left and
  primary Done right. Selection and Clear immediately update the same pending
  task state and live card while staying open. Done closes; X/Escape/outside keep
  selections already made. Parent Cancel still discards the entire draft.
- Description retains its compact 400px-wide, 90px-high multiline editor,
  continuous exact Markdown updates, Clear/Done footer and retain-on-dismiss
  behavior. Descriptions remain task-ID-backed metadata, outside task Markdown.
- Phase reuses the ordered selector and No phase choice. All rows are left aligned;
  selection updates the draft/card and stays open. It has no footer or transaction.
  Long editor Phase lists scroll within a **360px maximum**, further constrained
  by available viewport space. Resources and projects without phases omit the action.
- Placement remains in the existing top-layer positioning routine. These editor
  popovers prefer the space above the action when that fits and avoids covering
  the parent footer. Otherwise the established below/above viewport-fit behavior
  applies. They do not participate in modal sizing or recenter the parent.

Production changes: `styles.css`, `ui/task-live-form.js`,
`ui/task-compact-form.js`, `ui/date-time.js` and `ui/task-popover.js`.
Reused components include `bindPropertyPopover`, `openTaskPopover`,
`createTaskDatePopoverInput`, `bindNativeDateTimePicker`, `selectionOption`,
`selectionKeys`, existing footer styles and the actual shared task-card renderer.
Persistent menu behavior is an editor opt-in; legacy compact adapters keep their
existing selection/dismissal conventions. No storage, identity, history or
statistics implementation changed.

## Verification

- **345 focused configuration checks passed on desktop and 345 at 360 × 640 /
  150% scaling.** Coverage includes all titles/X controls, header typography,
  unchanged parent/trigger geometry, bounds, matching endpoint dimensions, actual
  native indicator geometry, separate clearing slots, native fields, pointer and
  Alt+Down picker activation, Escape, transactional endpoints, date/same-day time
  validation, midnight/cross-year display, persistent Necessity/Phase, Clear/Done,
  exact multiline Description, availability, long lists, outside/switch dismissal,
  focus restoration, parent Cancel and Save with nested identities intact.
- Trusted clicks in the measured left slots opened both actual native pickers;
  their `:open` states and rendered chooser screenshots were verified. Trusted
  Alt+Down also opened both through the shared native picker adapter.
- Shared card/editor regressions passed **1,868 desktop and 1,864 narrow/150%
  checks**, including independent comparisons with pre-change Tasks panel rendering,
  native Markdown/selection/IME, Steps, completion timestamps, pending Save/Cancel,
  locks, rollback/retry, IDs, synchronization, metadata/history/statistics,
  description preview, popover anchoring and reduced-motion feedback.
- Opening stability passed **3,829 in each layout**; native title autofocus
  **472 in each**; Phase 1 hierarchy/readiness **158 in each**; Phase 2 Step geometry
  **65 in each**. Empty shared-card Add remains **560 × 390** desktop and
  **328 × 388** narrow. Edit still does not autofocus its title.
- Existing browser regressions passed: modal-regions **176**, task-form-workflows
  **64**, task-step-progress and row-focus. **2,101 Quick Add/Inbox checks passed**.
- **14 Node suites passed:** task-form, task-compact-form, task-layout-polish,
  task-created-completion, task-planning, task-progress, task-history,
  task-mutations, task-workspace, task-data, task-creation-retry, typography,
  project-planning and inbox. Affected form/typography suites were repeated after
  the final native keyboard adapter change.
- Staged/installed syntax, plugin loading and scoped whitespace checks passed.
  Main, stylesheet, native and asset hashes match staging; native artifacts are unchanged.

Existing intentional titleless/close-on-selection expectations were updated to
the requested titles and persistent menus, with added remain-open assertions.
Clear is tested as a footer action rather than a third selection. Geometry,
persistence, history and synchronization assertions remain. Pointer tests select
an uncovered point in the requested target because a correctly flipped popover
can cover its center; the original focus/dismissal assertions are retained.
The runner gained a validated native-field measurement request using Chromium's
actual user-agent shadow DOM, rather than an approximation of the picker icons.

## Screenshots and evidence

Screenshots use isolated Chromium, synthetic services/vault data and the installed
Obsidian 1.14.4 stylesheet/fonts. All required states were personally inspected.
Review caught an initially excessive long-menu height; the final Phase cap corrects
it. The final images show matching date/time geometry, left native icons, compact
headers/footers, correctly aligned alternatives and usable scrolling at 150%.

- [Start configured](../../../../../System/Backups/task-editor-phase3-20261014/review/desktop-start-configured.png)
- [Due configured](../../../../../System/Backups/task-editor-phase3-20261014/review/desktop-due-configured.png)
- [Start with time cleared](../../../../../System/Backups/task-editor-phase3-20261014/review/desktop-start-untimed.png)
- [Necessity Must selected](../../../../../System/Backups/task-editor-phase3-20261014/review/desktop-necessity-must.png)
- [Necessity cleared, still open](../../../../../System/Backups/task-editor-phase3-20261014/review/desktop-necessity-cleared.png)
- [Multiline Description](../../../../../System/Backups/task-editor-phase3-20261014/review/desktop-description-multiline.png)
- [Phase selected](../../../../../System/Backups/task-editor-phase3-20261014/review/desktop-phase-selected.png)
- [Long Phase list near bottom](../../../../../System/Backups/task-editor-phase3-20261014/review/desktop-phase-long-bottom.png)
- [Edit Due near bottom](../../../../../System/Backups/task-editor-phase3-20261014/review/desktop-edit-due-bottom.png)
- [Narrow Start at 150%](../../../../../System/Backups/task-editor-phase3-20261014/review/small-150-start-configured.png)
- [Narrow Description](../../../../../System/Backups/task-editor-phase3-20261014/review/small-150-description-multiline.png)
- [Narrow long Phase list](../../../../../System/Backups/task-editor-phase3-20261014/review/small-150-phase-long-bottom.png)
- [Actual native calendar](../../../../../System/Backups/task-editor-phase3-20261014/review/desktop-native-date-picker.png)
- [Actual native clock chooser](../../../../../System/Backups/task-editor-phase3-20261014/review/small-150-native-time-picker.png)
- [Desktop geometry/native measurements](../../../../../System/Backups/task-editor-phase3-20261014/desktop-frames.json)
- [Narrow geometry/native measurements](../../../../../System/Backups/task-editor-phase3-20261014/small-150-frames.json)

The anchored popovers are bounded by Itacan; the native calendar/time chooser's
internal presentation, localization and placement are controlled by Chromium/the
OS. Native 24-hour values and existing configured formatting remain. Native Modal
hosting is simulated in these fixtures; live Obsidian theme/window review remains
the final check. No new functional limitation was found by the focused checks.

## Safe installation

Pre-change affected source, tests, stylesheet and installed artifacts are preserved
under `System/Backups/task-editor-phase3-20261014/source/`. That ignored directory
also holds staged artifacts, logs, screenshots and geometry evidence. The established
`build.js --output-dir` staged first; normal installation followed verification.
Unrelated workspace changes were preserved. No live task was edited, and Obsidian
was not automatically restarted or reloaded.

Installed `main.js` SHA-256:
`5194accd43d59a50b924badc1b7969d89514953cad7e154f523c0fc0a40a3b52`

Reload Hub Project Menu for live visual review. Installation is complete; stop
after Phase 3.
