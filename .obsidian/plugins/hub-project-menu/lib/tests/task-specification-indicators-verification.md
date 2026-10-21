# Specification indicators and Explorer selection — 2026-10-14

Implemented, verified, staged and installed. Configured specifications now show
white checkmarks outside their highlights. Expanded headings use the workspace
File Explorer's selection fill; their content retains the existing gray surface.
Stop for review after this pass.

## Implementation and reuse

Production changes are confined to `styles.css` and `ui/task-live-form.js`.
The actual shared task card, Step adapters, accordion controller, configuration
render callbacks, date/time helpers and task persistence sources are unchanged.

Each specification retains its existing three-column heading grid. A decorative
native Lucide `check` span is mounted once inside the disclosure button and placed
in a reserved gutter outside the button's paint bounds. It has `aria-hidden`, no
keyboard stop and no pointer events. All rows use the same gutter formula derived
from the existing checkbox-column, checkbox-size and card-gap tokens. Configured
state changes only visibility; they do not insert columns or move the main icon,
label or trailing chevron. Neither Step control gets an indicator.

The existing configured detection is preserved: dates, Must/Should necessity,
meaningful Description and an available assigned Phase. Main graphics and labels
now remain `--text-normal`; checks use that same normal white. Disabled headings
keep their established muted treatment and hide checks while retaining pending
properties. Restoring the title restores checks synchronously. Accessible labels
also identify configured state; the visible labels remain unchanged. Label updates
preserve that accessible suffix. No color transitions were introduced.

The shared heading inset is 6px. The group extends the painted heading outward
while compensating its inner grid padding using the existing native checkbox
centering value. This preserves the old main icon and label coordinates. Content
uses padding instead of an outer label-column margin, allowing its gray paint to
share the heading's full horizontal boundaries while preserving the original
control columns and available content width. Endpoint sizing compensates for this
padding so the existing intrinsic native-field measurements still produce their
previous control widths and narrow stacking behavior.

The selected heading fill reuses the exact existing workspace Explorer convention:
`color-mix(in srgb, var(--interactive-accent) 17%, transparent)` from
`System/Dashboards/Project/view.css`'s selected/current-folder/active-file row rule.
Explorer uses normal text, which is retained here. This is the understated Explorer
fill, separate from the primary-button fill. It persists on hover and after the
pointer leaves. Collapsed hover still uses `--background-modifier-hover`.

The group itself is transparent. Expanded headings paint selection with upper
rounded corners; the directly adjoining content paints one layer of the existing
gray with lower rounded corners. No border, shadow, gap or overlapping corner is
added. Checks sit outside both paint rectangles. Disclosure remains synchronous;
ARIA, native Enter/Space, exclusive ownership, Escape/focus restoration, pending
draft transactions, modal anchoring and scrolling use the unchanged controller.

## Measured geometry

Both desktop and narrow/150% measurements confirm:

| Measurement | Result |
|---|---:|
| Check and main SVG dimensions | 16 × 16 CSS px |
| Check-to-icon and icon-to-label gaps | 12px each |
| Heading main-icon left / chevron right inset | 6px each |
| Check-to-painted-heading clearance | 6px |
| Heading/content horizontal boundary difference | 0px |
| Heading/content vertical seam | 0px |
| Configured-state main-icon/label displacement | 0px |
| Card width/height change for matching metadata | 0px |

The desktop heading expands from **x=502, width=476** to **x=496, width=488**.
Its main icon and label retain their previous coordinates. The check starts at
**x=474**, ends at **x=490**, and remains left of the painted heading at **x=496**.
All five headings share the same trailing chevron position. Four/five-row layouts
retain their original heights and balanced 8px upper/lower gaps. Empty Add remains
**560 × 398** desktop and **328 × 396** narrow. Legitimate metadata/checklist edits
retain their existing natural card sizing; comparisons use matching task state.

## Verification

- New specification fixture: **420 checks desktop and 420 narrow/150%**. It compares
  old/new styling on matching actual markup, checks glyph dimensions and vertical
  alignment, equal gaps/insets, outside-paint placement, consistent columns, exact
  Explorer fill, gray content and corner/seam geometry. It verifies native initial
  typing/caret, disabled/restore behavior, accessible configured labels, trusted
  Enter/Space/Escape, persistent selection, instant disposal and Project/Resource
  availability. Final configuration is entered through the existing controls.
- Configured-state/description-tooltip fixture: **591 each**, including immediate
  white checks, neutral icons, title clear/restore, eight opening frames without
  configuration flashes, pending retention and unchanged tooltip behavior.
- Shared renderer/editor: **1,936 desktop / 1,932 narrow**. Independent panel
  comparisons, Markdown/IME, nested Step identities and completion timestamps,
  metadata/history/statistics, Save/Cancel, locks and rollback/retry remain.
- Opening **3,829 each**, native autofocus **472 each**, accordion **905 each**,
  integrated Steps **166 each**, configuration controls **213 each**, Phase 1
  readiness **138 each**, Step geometry **65 each**, contrast/layout **170 each**.
- Modal regions **176**, task-form workflows **64**, task-step-progress and row-focus
  passed on desktop.
- Nine Node suites passed: task-form, task-compact-form, task-layout-polish,
  task-created-completion, task-history, task-mutations, task-creation-retry,
  typography and icons.
- Staged/installed syntax and plugin loading, scoped whitespace checks and all
  staged/installed artifact hashes passed. Native/strict assets are unchanged.

Intentional purple-icon expectations now assert neutral graphics plus the visible
white check and accessible status. Surface assertions now distinguish selected
heading from gray content; content-column checks measure the inner padding edge.
Historical row-width assertions account for the measured new symmetric heading
insets. Other geometry, native-field, focus, Steps, persistence, tooltip and panel
assertions are retained. No substantive assertion was removed.

## Screenshots and evidence

Final screenshots were personally inspected for outside white checks, neutral
main icons, symmetric breathing room, understated selection, continuous gray
content, corners, native input contrast and narrow scrolling. Existing property
feedback finishes before review captures; disclosure assertions run synchronously
before those waits. No configuration animation is added.

- [Empty Add](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-empty-add.png)
- [Unconfigured Project](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-unconfigured-project.png)
- [Configured collapsed specifications](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-configured-collapsed.png)
- [Configured Edit](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-configured-edit.png)
- [Configured hover](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-configured-hover.png)
- [Configured Start expanded](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-expanded-start.png)
- [Configured Due expanded](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-expanded-due.png)
- [Necessity expanded](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-expanded-necessity.png)
- [Description expanded](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-expanded-description.png)
- [Phase expanded](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-expanded-phase.png)
- [Unconfigured heading expanded](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-expanded-unconfigured.png)
- [Resource without Phase](../../../../../System/Backups/task-specification-indicators-20261014/review/desktop-resource.png)
- [Narrow Due at 150%](../../../../../System/Backups/task-specification-indicators-20261014/review/small-150-expanded-due.png)
- [Narrow Necessity](../../../../../System/Backups/task-specification-indicators-20261014/review/small-150-expanded-necessity.png)
- [Narrow Phase](../../../../../System/Backups/task-specification-indicators-20261014/review/small-150-expanded-phase.png)
- [Desktop frames](../../../../../System/Backups/task-specification-indicators-20261014/desktop-frames.json)
- [Narrow frames](../../../../../System/Backups/task-specification-indicators-20261014/small-150-frames.json)
- [Geometry summary](../../../../../System/Backups/task-specification-indicators-20261014/geometry-summary.csv)

Fixtures use isolated Chromium, synthetic task services/vault data and installed
Obsidian 1.14.4 stylesheet/fonts. Native Modal hosting remains simulated with the
previously inspected lifecycle. Live theme/window review remains after plugin
reload. No live task was edited and Obsidian was not restarted or reloaded.
No new functional limitation was found by these checks. Deferred Step bugs,
configuration-control refinements and the task-card border fix were not included.

## Safe installation

Pre-change affected source, tests, stylesheet and installed artifacts are preserved
under `System/Backups/task-specification-indicators-20261014/source/`. The ignored
backup directory also contains staging, production deltas, build/test/load logs,
screenshots, frame traces, geometry measurements and installed hashes. Unrelated
workspace changes were preserved.

The established `build.js --output-dir` workflow staged first. Staged plugin loading
passed before normal installation. Installed main, styles, native and strict-asset
manifest hashes match staging; native/strict assets match their pre-change backups.

Installed `main.js` SHA-256:
`4e3ce3e83ba256439b162db7ebc4efc6d24a0d5bee06116c39c8b94a435c57c4`

Reload Hub Project Menu for live visual review. Installation is complete; stop here.
