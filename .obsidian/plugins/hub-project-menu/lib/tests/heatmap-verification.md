# Progress heatmap regression checks

## Current: separator-contained assembly (2026-10-11)

The shared canvas cap is now **1560px**, up 60px (4%) from 1500px. Equal tracks,
12px panel gaps and automatic centering are unchanged. At the full cap, Calendar,
Focus, Tasks and Progress each measure 512px; the two-column Projects/Resources
and workspace Files region grows from 996px to 1036px. Existing cards reflow
without changes to their proportions, buttons or typography.

The controller no longer borrows the panel's 14px side padding. It takes the
separator's actual content width, subtracts two 4px minimum insets and the
measured weekday-column width plus its existing gap, then passes the remainder
to the unchanged whole-device-pixel geometry function. The integer-sizing
remainder is split equally between the sides. The viewport uses the separator's
width, with no negative margins. Month/weekday/grid alignment, navigation,
colors, inert fillers and the top-edge formula are unchanged.

Measured before/after at a full-width Home fixture, 1800x1100, zoom 1. All widths
and insets below are CSS pixels; negative old insets mean overhang.

| DPR | Dashboard | Panel | Separator | Complete assembly | Left inset | Right inset | Physical square | Grid top |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.5 | 1500 → 1560 | 492 → 512 | 462.667 → 482.667 | 473.333 → 473.333 | -5.344 → 4.656 | -5.323 → 4.677 | 12x12 → 12x12 | 607.697937 → 607.697937 |
| 2 | 1500 → 1560 | 492 → 512 | 462 → 482 | 464.5 → 464.5 | -1.25 → 8.75 | -1.25 → 8.75 | 16x16 → 16x16 | 607.703125 → 607.703125 |

The user selected one shared 1560px cap and accepted the larger DPR-2 remainder,
rather than a DPR-dependent dashboard width. With the current squares, DPR 1.5
requires at least 1556px of dashboard width for 4px insets. Rounding that to
1560px gives whole 512px panel tracks and is only 4px above this minimum. The
extra 8.75px inset at DPR 2 cannot accommodate another physical pixel per square:
that would add 26.5px to the grid. Continuing to widen would be counterproductive.

On narrower panes the cap yields to available width; squares still choose the
largest integral size inside the separator. Extra integer-sizing remainder is
normal, and very narrow calendars retain their existing local scroll fallback.
No fixed 4–6px promise is made across every width, year or zoom level.

Regression checks now bound the **entire** assembly, including actual month and
weekday label rectangles, against the separator. They verify equal insets,
minimum clearance and that no larger integral square fits. Expected geometry
uses an independent ResizeObserver: under CSS zoom its content box can differ
from `getBoundingClientRect().width / zoom` by 1/64 CSS px at a size threshold.
Raster coverage checks all fully visible cells, replacing the old arbitrary
100-cell minimum that failed when narrow scroll viewports legitimately showed
91 or 98 cells. Full desktop raster cases separately assert unchanged 12px/16px
squares and the agreed insets. Screenshots at both DPRs were visually inspected.

## Earlier: equal panel allocation refinement (2026-10-11)

The shared desktop rule in `../../styles.css` now uses
`repeat(3, minmax(0, 1fr))` instead of `1.1fr / 1.2fr / 1.1fr`.
Calendar, Focus, Tasks and Progress each occupy one identical track. Home's
Projects/Resources and workspace Files retain their two-track span. This applies
to Home and all Project/Resource dashboards, excluding the separate Note rail.
The existing two/one-column container breakpoints and 12px panel gaps remain.

Measurements at the full 1500px canvas, zoom 1:

| Dimension (CSS px) | Before | After |
| --- | ---: | ---: |
| Total top-panel span including gaps | 1500 | 1500 |
| Calendar / Focus / Tasks | 477.53 / 520.95 / 477.53 | 492 / 492 / 492 |
| Progress | 477.53 | 492 |
| Projects/Resources (or workspace Files column) | 1010.47 | 996 |
| Each of three project cards, DPR 2 | 316.82 | 311.99 |
| Each of four resource cards, DPR 2 | 228.87 | 225.25 |

At that stage no canvas expansion was used. Tested 1512px and 1524px alternatives; at DPR 2
they trigger 17px squares and pack the combined calendar more tightly against
the panel edges. Keeping 1500px gives the existing geometry a comfortable
centered assembly without changing its algorithm. Existing percentage flex
bases fit three projects and four resources without any card CSS changes;
minimum card widths and horizontal scrolling remain available in narrow panes.

At DPR 1.5, the divider grows from 448.20 to 462.67px; the combined calendar
stays 473.33px wide, with equal 9.33px outer panel insets. At DPR 2, the divider
grows from 447.53 to 462px; the assembly stays 464.5px with equal 13.75px insets.
The existing borrowed panel padding means the assembly extends slightly beyond
the divider (5.33px / 1.25px per side respectively). Integer sizing and this
existing relationship are retained rather than stretching or rewriting geometry.
Squares remain 12x12 physical pixels at DPR 1.5 and 16x16 at DPR 2. Direct
old-ratio/new-ratio comparisons show **zero change to the grid top coordinate**,
panel top/bottom, control dimensions or font sizes in all four tested views.

Verification: 679 layout scenarios per DPR, including 80 canvas-resize/zoom
scenarios, production card rendering, card click/Enter activation, three/four
card fits and scrolling fallback. All 384 raster scenarios, geometry/palette,
report editing, year/scope navigation, typography, 32 native/prepared host cases,
card placement, build and plugin-load checks passed. Card motion tests now wait
for actual animation completion instead of a timing-sensitive 180ms sleep.
The host cap assertion allows the half-CSS-pixel rounding of `clientWidth` at
fractional DPR; all rectangle-to-rectangle comparisons remain strict.

Additional broad `full-view-layout` runs stop at the existing Files/mode-divider
assertion. This also reproduces with the previous column ratio: at DPR 1.5 the
1040px fixture's unchanged mode-button minimum places its separator at 250.229px
versus the Files divider at 250px (test tolerance 0.1px). Diagnostic checks that
accounted for this minimum reached a separate stale `Choose location` selector.
Those diagnostics were reverted; the broad suite is **not claimed as passing**.
No workspace control, task editor or card interaction production code was changed.
Screenshot inspection and measurements use isolated Chromium fixtures, not a
live Obsidian reload or the physical devices.

## Rendering mechanism and correction

The native heatmap renderer creates one `li` per date plus leading placeholders.
Home and Project/Resource use the same DOM layout controller in
`../ui/progress-heatmap.js`. Shared CSS assigns explicit grid tracks and equal
width/height; the vault snippet's fixed sizing excludes this grid.

Previously, the controller rounded cell dimensions to 1/64 CSS pixel and used a
1.5 CSS pixel gap. Equal layout dimensions did not imply equal painted dimensions:
successive fractional device-pixel edges rounded differently. At native DPR 1.5,
447.4 CSS pixels of available width and zoom 1, screenshot sampling reproduced
9x9, 9x10, 10x9 and 10x10 cells, with alternating 2/3 pixel gaps.

The controller now calculates in device pixels: the gap is one pixel, and the
square is the largest integral size that fits the available calendar width.
The weekday layout reserves the measured text column and minimum separator
insets before sizing the grid; it no longer borrows panel padding.
The pitch is therefore integral as well. It converts to CSS units once,
accounting for DPR and ancestor CSS zoom. Container/text ResizeObservers,
resolution media queries and window resize notifications invalidate geometry.
No canvas, transforms or per-cell position adjustments are used in production.

Months and weekdays retain the History task workspace undertext size
(`--hub-font-meta`) and normal weight. They use `--text-muted`, matching Home's
`.home-empty` focus placeholder ("No focus set for today."), with normal rather
than italic type. Measurement spans inherit the calendar typography.
Year navigation occupies the existing 18px space below the squares, outside
clickable dates. Grid height grows with square size; History retains the remaining
panel height and scrolling behavior.

## Weekday and rectangular layout

S, M, W and F share the month metadata styling. Their accessible names remain
Sun, Mon, Wed and Fri. Their grid rows come from the
native weekday list, preserving any configured week start. The weekday column,
month row and date grid form one block with equal outer margins. The text column
is measured without CSS-pixel rounding and snapped outward in device pixels so
labels cannot be clipped by an underestimated width. Measurement samples now
use the displayed S/M/W/F letters, removing the former reserved full-word width.
The existing geometry then chooses the largest fitting integral square size.
Labels use `align-self: end`, placing each label's bottom edge exactly at its
native weekday row's bottom; no positional offsets or transforms are involved.

Initially, Mon/Wed each measured about 23 CSS pixels and the viewport borrowed
the existing 14px panel padding on each side. That arrangement was superseded
by the current separator-contained layout. The divider continues matching History's full
scroll-area width, including its scrollbar allocation. No year label is shown.

The month row retains its original height and 4px gap above the date grid.
`--hub-heatmap-label-gap: 4px` also controls the horizontal weekday/grid gap.
The controller reads that token when reserving the text column. Equal remaining
outer margins center the weekday column, month row and grid as one block inside
the panel (or the local scrollable calendar area when the panel is too narrow).
The grid therefore keeps its exact top edge and grows downward when cells get
larger. The 18px navigation strip remains below clickable dates; History uses the
remaining height and keeps its original bottom alignment and scrolling.

Every displayed week contains seven visible squares. `fillOutsideYearCells`
preserves the native leading positions and completes the last week with plain
trailing filler elements; their count follows the real calendar rather than a
fixed week count. Fillers have no date, month class, content or keyboard target,
are `inert` and `aria-hidden`, and do not receive pointer input. The existing
report handlers select only month-class cells, so fillers cannot open/create
reports or affect report statistics. Repeated refreshes do not duplicate them.

Empty real dates and fillers use `--background-primary`, the app's outside-panel
surface, rather than the old snippet's blue-black empty-day color. A shared,
scoped selector takes precedence over the legacy snippet without affecting other
heatmaps. Recorded progress retains its strongest green and its interactions.
Very narrow panels use month initials and local horizontal
scrolling. A minimum readable weekday-row separation can increase narrow-panel
squares and scroll width; it never shrinks the previous squares.

Measurements for the earlier weekday-column addition (Home, 1600x1100, zoom 1):

| DPR | Separator width (unchanged CSS px) | Grid width before/after (CSS px) | Squares before/after (physical px) | Grid top before/after (CSS px) |
| --- | ---: | ---: | --- | --- |
| 1.5 | 448.198 | 423.333 / 423.333 | 11x11 / 11x11 | 607.697937 / 607.697937 |
| 2 | 447.531 | 423.5 / 450 | 15x15 / 16x16 | 607.703125 / 607.703125 |

These coordinates belong to the isolated fixture, not the user's live Obsidian
window. The layout tests compare the grid top with the previous layout formula
and check exact top-coordinate equality across width changes for every view,
year and zoom. The current refinement preserves this top-position formula while
reclaiming the obsolete full-word column, allowing larger squares where a whole
device-pixel step now fits. If another week start puts Sunday and Monday next to
each other, the minimum readable row pitch follows their actual row distance;
the existing local scroll fallback preserves label size and prevents overlap.

Earlier S/M/W/F refinement, Home at 1600x1100, zoom 1, default Monday week start:

| DPR | Grid width before/after (CSS px) | Squares before/after (physical px) | Grid top before/after (CSS px) | Both label gaps (CSS px) |
| --- | --- | --- | --- | --- |
| 1.5 | 423.333 / 458.667 | 11x11 / 12x12 | 607.697937 / 607.697937 | 4 |
| 2 | 450 / 450 | 16x16 / 16x16 | 607.703125 / 607.703125 | 4 |

With the preserved native Monday-first calendar, visible row order is M/W/F/S;
Sunday occupies the final row. Sunday-first settings render S/M/W/F. No calendar
date or month column is moved to force an arbitrary label order.

## Progress palette refinement

The shared `progress-colors.js` keeps RGB (13, 201, 79) and the existing
quarter-point visual score steps and interpolation. Opacities at levels 1-4
change from 25/50/75/100% to 10/30/60/100%. Level 4 remains exactly the previous
fully opaque green; the empty/filler `--background-primary` surface is unchanged.
Score calculations and report data are not modified.

Native-DPR screenshot samples in both Home and Project at both DPRs produced
empty RGB (30,30,30), then level RGB values (35,54,42), (31,88,51), (23,136,62),
and (13,201,79). Level-1 RGB distance from empty is about 27.3, versus 52.1 for
the former 25% green composited over the same dark panel. Tests allow two channel
units for Chromium's premultiplied 8-bit alpha rounding at intermediate levels,
but require exact empty and level-4 pixel colors. Pure palette tests also verify
monotonic quarter-point brightness and unchanged score quantization.

## Earlier live weekday-overlap regression

The previous fixtures omitted Obsidian's base Markdown list rules. In the
installed `C:/Program Files/Obsidian/resources/obsidian.asar` app.css,
`.markdown-rendered ul > li` assigns `margin-inline-start: 3ch` and vertical
padding of `var(--list-spacing)` (0.075em). Its specificity exceeds the old
`.hub-progress-weekdays > li` reset. The column was measured correctly, but its
children acquired an unmeasured 18.1448 CSS-pixel margin and overflowed toward
the grid. Later, positioned calendar cells painted over the text. No z-index,
container-width, cell-size or date-mapping problem was needed to reproduce the
user's screenshot.

The existing reset now uses `.hub-progress-graph > .hub-progress-weekdays > li`,
which owns the list-item spacing inside the Markdown host. This is the only
production change for this correction; geometry and measurement code remain
unchanged. The dedicated column is 23.333 CSS pixels at DPR 1.5 and 23 at DPR 2,
with a 2 CSS-pixel gap. All three labels fit without shrinking squares.

Before/after measurements with the real host rules, Home at 1600x1100, zoom 1:

| DPR | Squares before/after (physical px) | Grid width before/after (CSS px) | Grid top before/after (CSS px) | Label/grid clearance before/after (CSS px) |
| --- | --- | --- | --- | --- |
| 1.5 | 11x11 / 11x11 | 423.333 / 423.333 | 607.697937 / 607.697937 | -15.802 / 2 |
| 2 | 16x16 / 16x16 | 450 / 450 | 607.703125 / 607.703125 | -16.141 / 2 |

Negative clearance denotes overlap. Both label margin and padding now compute
to zero, and each label is vertically centered on its native weekday row. The
panel, month row, grid origin, divider and History layout stay unchanged.

`obsidian-heatmap-host.css` copies the relevant installed host selectors without
weakening their specificity. Both layout and raster fixtures now use this host.
Layout checks compare every label against every individual cell, including real
dates in the first week and both leading/trailing fillers, and verify containment in
the measured column and viewport. Raster checks compare every pixel in each
label's bounds with a second screenshot taken with calendar cells hidden. The
same text nodes, subpixel origins and scroll layers are retained, so complete
glyph visibility is tested without changing text rasterization. Restoring the
old selector in the browser makes the new regression fail with
`Mon overflows weekday column`; the original obscured-text screenshot was also
reproduced with the extracted installed host rules.

## Reproduction

Run from this directory with Node and an installed Chrome. Override
`HUB_TEST_BROWSER` if Chrome is not installed at the default Windows path.

```powershell
node progress-heatmap.test.js
node progress-colors.test.js
$env:HUB_TEST_DPR = '1.5'
node run-heatmap-pixels.js
node run-browser-test.js desktop-progress 1800x1100
$env:HUB_TEST_DPR = '2'
node run-heatmap-pixels.js
node run-browser-test.js desktop-progress 1800x1100
node run-browser-test.js daily-report
node run-browser-test.js progress-navigation
```

The raster runner launches Chrome at the native device scale. CDP emulation alone
can upscale cached 1x compositor layers and is insufficient to validate painting.
It reads actual PNG screenshot pixels, sampling cell center lines to exclude
rounded corners. It checks every fully visible real/filler cell and adjacent gap,
and verifies that each empty/filler center uses the outside-surface color.
The isolated raster backdrop stays panel-colored so edge cells remain
distinguishable from the screenshot boundary; the dashboard fixture separately
compares computed empty/filler colors against the actual outside-panel surface.
Screenshots and JSON
results are written to the OS temporary directory.

## Verified on 2026-10-11

- Laptop configuration: 1920x1080, 200% scaling, DPR 2, zoom 1.
- Desktop configuration: 2560x1440, 150% scaling, DPR 1.5, zoom 1.
- 194 screenshot scenarios at each native DPR: Home/Project, 2026 and the
  54-week leap year 2012, widths 180–640 CSS pixels, zoom 80–150%, fractional
  origins, repeated resizes, CSS zoom changes without a width change, and extra
  Sunday-first/Tuesday-first scenarios with adjacent Sunday/Monday labels.
- All 388 raster scenarios had one square size and one-pixel gaps in both axes.
  All 1,552 weekday captures matched their unobscured references pixel for pixel,
  using the Obsidian Markdown host rules, S/M/W/F and the focus-placeholder color.
  Actual label bottoms and equal horizontal/vertical label gaps were checked.
- At the full desktop separator widths (482.667 / 482 CSS pixels), zoom 1:
  desktop cells remain 12x12 physical pixels; laptop cells remain 16x16.
  At 447.4 CSS pixels, the new separator constraint fits 11x11 / 15x15 cells.
  Both had 371 visible real/filler cells for 2026, with exactly 365 actual dates.
  The 54-week leap year 2012 had 378 visible cells with exactly 366 actual dates.
- 695 dashboard layout scenarios at each primary DPR passed date/month mapping,
  weekday rows for all seven week starts, label-versus-cell bounds (including
  filler positions), non-overlapping text, preserved metadata size/weight,
  upright labels matching the focus-placeholder color, empty/filler surface color,
  largest fitting integral square size, equal label gaps, bottom-aligned weekday
  labels, centered combined block, fixed grid
  top, heading parity, History scrolling/bottom alignment, full-view, text-size
  and hide/reveal checks.
- 23,100 pure geometry cases passed all week starts, leap/century years,
  maximum fitting cell size, label clearance and deterministic geometry. Another
  70 cases checked weekday readability for one/two-row label separation and no
  square-size reduction. Pure and painted palette checks passed at both DPRs.
- Browser report tests passed real-date editing for Projects/Resources and inert
  leading/trailing filler clicks/Enter, plain/inert filler state and repeated
  filler refresh. Navigation tests passed repeated renders and year/scope
  callbacks. Report calculation tests, typography checks, plugin load and build
  also passed.

These are isolated Chromium fixtures using production renderer, controller,
styles and report handlers, not observations on the two physical devices.
DPR notification tests explicitly dispatch resize after CDP changes DPR because CDP does not
always emit native display notifications; physical monitor switching and a live
Obsidian reload were not exercised.
