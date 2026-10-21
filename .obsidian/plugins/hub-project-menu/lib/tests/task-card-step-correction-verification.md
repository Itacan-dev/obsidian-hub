# Card border, Step interactions and disabled states — 2026-10-14

Implemented, verified, staged and installed. The composer card's upper border is
visible, Step creation no longer starts attention feedback, disabled internal Add
step clicks preserve the pending editor, and disabled creation/specifications use
`--text-faint`. Stop for review after this focused correction.

## Reproduced causes and small corrections

### Card border

The card's existing sticky `::before` mask hides scrolled content in the 16px space
above the card. Absolute positioning resolves from its padding edge, inside the
border. Its former `top: -16px; height: 16px` therefore ended one border thickness
inside the outer card boundary and painted over the upper border. This was mask
overpaint, rather than a missing border or an incorrect modal-body width.

The same mask now subtracts `--hub-task-card-border` from its top position as well
as the existing inset. With the desktop defaults it moves from **-16px to -17px**,
retaining its 16px height. It ends outside the border. No new overlay, compensating
border, margin, padding, fixed height or renderer was added. The card's border,
radius, width, internal columns and sticky inset are unchanged. Modal body clipping,
header/footer regions, top anchoring and the tall-checklist scrolling fallback
retain their existing implementations.

The fixture reads actual Chromium screenshot pixels through PNG decoding and
canvas sampling. For each tested card it samples the straight upper border and
both upper corners, then temporarily removes the mask to obtain an unoccluded
reference for the same card at exactly the same position. The baseline reproduced
**8 differing samples out of 12**: a representative masked pixel was
**RGB(28,28,28)** instead of the reference border's **RGB(51,51,51)**. After the
correction all **12 samples match** in each of nine states per layout, including
real sticky scrolling, wrapped title/Step content, metadata, expanded Steps and
Edit with its title temporarily cleared. This verifies rendered pixels as well as
computed border geometry. The reference operation has no layout footprint.

Desktop empty-card geometry remains **x=477, y=405.765625, 526 × 97.71875 CSS px**
in the focused fixture, exactly matching the pre-change capture. Existing broader
fixtures retain empty Add at **560 × 398** desktop and **328 × 396** narrow.

### Step feedback

`mountLiveTaskForm` still compared the checklist count/progress with `last.steps`
and called `pulse(checklist.toggle)` when it changed. Creating a pending row changes
that counter, so even an empty first Step started the common purple attention
animation and its captured background surface.

Steps are removed from that feedback comparison and its cached state at the source.
The normal checklist refresh remains. No Step attention effect, attention surface
or attention cleanup timer is initiated. The shared attention controller and its
CSS are unchanged; Start/Due, Necessity, Description and Phase keep their existing
feedback and reduced-motion behavior. Normal pointer hover and keyboard focus
continue through their existing styles. No synthetic hover state is retained.

### Disabled Add step pointer/focus

The baseline trusted mouse click demonstrated the native sequence: a disabled
button rejects its click action but can still take focus away from another input.
The pending Step's legitimate blur path then abandoned the empty row and restored
Add steps. A click-handler-only disabled guard was therefore too late.

The existing Step adapter's capture boundary now cancels the default focus transfer
on `pointerdown` and its `mousedown` fallback **only when the event path contains
that disabled Add step button**. It reuses the existing editor readiness opt-in;
generic callers retain their original behavior. No extra wrapper or independent
click implementation was added. The button stays natively disabled. Its children
are covered by the same event-path check. The guard also avoids starting the
pending-row pointer/blur sequence for that blocked interaction. The added listener
is removed with the existing listener collection during disposal.

There is no delayed refocus, selection reconstruction, broad blur suppression or
pointer pass-through. Trusted press/release, full/repeated clicks and icon/label
hits leave the active input, native selection offsets/direction, input identity,
pending state, counter, disclosure, draft text/data and accordion state unchanged.
The event trace contains no pending-input blur/focusout for those attempts.
Whitespace and domain-invalid pending text retain the same protection. Native Tab
skips the disabled action and synthetic activation remains guarded. The same checks
pass in Edit. Enter/Escape and genuine clicks elsewhere still use the existing
confirmation/abandonment paths; enabled add-another confirms the valid Step once
and focuses the next empty native textarea.

### Disabled colors

Composer specifications, their labels/main icons/chevrons, empty Add steps and the
internal disabled Add step now use **`--text-faint`**, opacity 1 and neutral disabled
background/cursor styling. Meaningful titles and valid pending Step text restore
**`--text-normal`** immediately. Empty Add steps excludes color interpolation while
retaining its ordinary background hover transition. Existing Step counters retain
their original disclosure styling. Validation still uses `appendTask`, rather than
a weaker whitespace-only replacement.

White configured checks remain hidden when their headings are disabled and return
immediately after title restoration. Pending properties and confirmed Steps remain
intact. The reserved gutters, 12px gaps, 6px heading insets, Explorer selection fill,
gray content, instant disclosure, configuration controls and shared card markup
were not changed by this correction.

## Verification

- Baseline: **6 reproduction checks passed**, confirming actual border overpaint,
  the Step attention source and native disabled-click abandonment before the fix.
- New focused fixture: **479 checks desktop and 479 narrow/150%**. It includes
  actual border/corner raster comparisons in nine states, trusted native Add/Edit
  creation, press/release/repeated disabled clicks, caret/selection and draft
  equality, invalid/whitespace readiness, exact immediate colors, sequential
  confirmation, legitimate blur, Enter/Escape, hover leave, title restoration,
  real viewport resize/body scrolling and reduced motion.
- Nine successive samples per Step transition verify no attention class, captured
  surface or attention animation, including first/second pending rows, repeated
  creation/confirmation, removal, Edit and reduced motion. Genuine updates to all
  five properties still start the existing attention animation; reduced motion
  suppresses it as before.
- Shared renderer/editor: **1,936 desktop / 1,932 narrow**. Independent comparisons
  with preserved normal panels, native Markdown/selection/IME, nested identities,
  completion timestamps, metadata/history/statistics, Save/Cancel, locks and
  rollback/retry remain.
- Opening **3,829 each**, native autofocus **472 each**, Step geometry **65 each**,
  integrated Steps **166 each**, accordion **905 each**, specification indicators
  **420 each**, configured-state/shared tooltip **591 each**, configuration controls
  **213 each**, readiness/hierarchy **138 each**, specification layout **170 each**.
- Modal regions **176**, task-form workflows **64**, task-step-progress and row-focus
  passed on desktop.
- **13 Node suites passed:** task-form, task-compact-form, task-layout-polish,
  task-created-completion, task-progress, task-history, task-mutations,
  task-workspace, task-data, task-creation-retry, task-planning, typography and icons.
- Staged/installed syntax/plugin loading, matching artifact hashes and scoped
  whitespace checks passed. Native and strict assets are unchanged.

Intentional muted-disabled expectations now assert faint colors. The old disabled
pointer abandonment expectation now asserts retained pending row/focus. Other
focus, geometry, native-field, tooltip, identity and persistence assertions were
retained. The browser runner gained separate trusted press/release requests and
actual screenshot-pixel sampling; its existing input and fixture behavior remains.
Legitimate asynchronous blur removal settles before border-reference comparisons;
immediate readiness/focus assertions are checked separately before those waits.

## Screenshots and evidence

Final screenshots were personally inspected for the upper boundary/corners, faint
controls, native caret, absence of purple Step feedback, wrapping, guide/columns,
configured checks and scrolling. They use isolated Chromium, synthetic services
and the installed Obsidian 1.14.4 stylesheet/fonts.

- [Pre-change upper border](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-baseline-empty-add.png)
- [Corrected empty Add](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-empty-add.png)
- [First pending Step](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-first-pending.png)
- [After disabled attempts](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-disabled-no-op.png)
- [Valid pending Step / normal hover](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-valid-pending.png)
- [Sequential Steps without feedback](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-sequential.png)
- [Configured card](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-configured-card.png)
- [Long title](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-long-title.png)
- [Wrapped pending Step](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-wrapped-pending.png)
- [Sticky card during body scrolling](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-sticky-scrolled.png)
- [Edit with pending Step](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-edit-pending.png)
- [Edit title cleared](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-edit-title-cleared.png)
- [Edit restored](../../../../../System/Backups/task-card-step-correction-20261014/review/desktop-configured-edit.png)
- [Narrow pending Step at 150%](../../../../../System/Backups/task-card-step-correction-20261014/review/small-150-first-pending.png)
- [Narrow Edit pending Step](../../../../../System/Backups/task-card-step-correction-20261014/review/small-150-edit-pending.png)
- [Narrow sticky card / accordion](../../../../../System/Backups/task-card-step-correction-20261014/review/small-150-sticky-scrolled.png)
- [Narrow Edit title cleared](../../../../../System/Backups/task-card-step-correction-20261014/review/small-150-edit-title-cleared.png)
- [Baseline cause/event evidence](../../../../../System/Backups/task-card-step-correction-20261014/baseline-frames.json)
- [Desktop raster/event/frame evidence](../../../../../System/Backups/task-card-step-correction-20261014/desktop-frames.json)
- [Narrow evidence](../../../../../System/Backups/task-card-step-correction-20261014/small-150-frames.json)
- [Raster and geometry summary](../../../../../System/Backups/task-card-step-correction-20261014/raster-summary.csv)

Native Modal hosting remains simulated with the previously inspected Obsidian
lifecycle. Live theme/window review remains after reload. Very tall checklists keep
the established natural scrolling fallback. No new functional limitation was found
by these checks. No live task was edited and Obsidian was not restarted or reloaded.
The deferred location chooser and configuration-view refinements were not included.

## Safe installation

Production changes are confined to `styles.css`, `ui/task-live-form.js` and the
editor-opted-in pointer guard in `ui/task-form.js`. `task-card.js`, panel adapters,
accordion controller, attention controller, configuration/date helpers, persistence
and domain models are unchanged. Pre-change affected source/tests/styles/installed
artifacts are preserved under `System/Backups/task-card-step-correction-20261014/source/`.
That ignored directory also holds staging, deltas, logs, screenshots, frame/raster
evidence and hashes. Unrelated workspace changes were preserved. The previous
verification note's encoding was repaired to UTF-8 without changing its historical
content; this note and the new fixture are written as UTF-8.

The established `build.js --output-dir` workflow staged first. Staged plugin loading
passed before normal installation. Installed main/styles/native/strict-asset hashes
match staging; native/strict assets also match their pre-change backups.

Installed `main.js` SHA-256:
`341dbda7160de26d48bb1835371d8b65735b516babc47b22dff74095472273de`

Reload Hub Project Menu for live review. Installation is complete; stop here.
