# Progress heatmap regression checks

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
square is the largest integral size that fits the full History scroll-area width,
including its scrollbar allocation. No year label or reserved side gutter remains;
only the integer-sizing remainder is split equally between the sides.
The pitch is therefore integral as well. It converts to CSS units once,
accounting for DPR and ancestor CSS zoom. Container/text ResizeObservers,
resolution media queries and window resize notifications invalidate geometry.
No canvas, transforms or per-cell position adjustments are used in production.

Months share the History task workspace undertext rule (`--hub-font-meta`,
normal weight, `--text-faint`). Measurement spans inherit this same typography.
Year navigation occupies the existing 18px space below the squares, outside
clickable dates. Grid height grows with square size; History retains the remaining
panel height and scrolling behavior.

The final spacing refinement reduces the measured month-row-to-grid gap from
8 to 4 CSS pixels. Width geometry and the 18px navigation strip remain unchanged.
Before this edit, the desktop dashboard fixture measured 448.198 CSS pixels for
both calendar and History, including the latter's scrollbar allocation; its
423.333px grid had 12.427px residual margins. The laptop fixture measured
447.531px for both, with a 423.5px grid and 12.016px margins. The next whole-pixel
square would require 458.667px at DPR 1.5 or 450px at DPR 2, respectively.
At exactly 447.4px, the corresponding residual margins are 12.033px and 11.95px.
The navigation targets measured the full 18px below the grid, ending at the
divider's inner edge; there was no additional bottom padding to remove while
preserving those targets. History receives the 4px saved by the smaller month gap.

### Separator-width expansion audit

The subsequent request for a 4-6px inset was checked against the actual separator
endpoints. The separator is the calendar's bottom border; the calendar already
uses the full History width and has no horizontal padding or reserved gutter.
The apparent extra inset is solely the equal remainder after integer sizing.
At the measured desktop width, 12px physical squares require 458.667 CSS pixels,
which exceeds the 448.198px separator even before adding the requested inset.
At the measured laptop width, 16px squares require 450px, exceeding 447.531px.
Consequently no rendering change can enlarge these grids within all requested
constraints. A mandatory extra inset could only retain or reduce the current
square size at other widths; it cannot produce an expansion.

Before/after measurements in the 1600x1100 dashboard fixture at zoom 1 remain:

| DPR | Separator width (CSS px) | Grid width (CSS px) | Square (physical px) | Grid top (CSS px) |
| --- | ---: | ---: | ---: | ---: |
| 1.5 | 448.198 | 423.333 | 11x11 | 607.697937 |
| 2 | 447.531 | 423.5 | 15x15 | 607.703125 |

These viewport coordinates belong to the isolated fixture, not the user's live
Obsidian window. The layout regression also checks exact grid-top equality across
panel-width changes for each view, year and zoom, while existing checks verify
month alignment, maximum square size, symmetric margins and fixed panel bottoms.

All week columns now contain seven cells. The native date order and leading
offset determine the number of columns; trailing placeholders complete it.
Padding uses the empty-day color and has no date, month class or keyboard target,
so existing report handlers do not select it. Very narrow calendars use month
initials and, below the minimum readable width, local horizontal scrolling.

## Reproduction

Run from this directory with Node and an installed Chrome. Override
`HUB_TEST_BROWSER` if Chrome is not installed at the default Windows path.

```powershell
node progress-heatmap.test.js
$env:HUB_TEST_DPR = '1.5'
node run-heatmap-pixels.js
node run-browser-test.js desktop-progress 1600x1100
$env:HUB_TEST_DPR = '2'
node run-heatmap-pixels.js
node run-browser-test.js desktop-progress 1600x1100
node run-browser-test.js daily-report
node run-browser-test.js progress-navigation
```

The raster runner launches Chrome at the native device scale. CDP emulation alone
can upscale cached 1x compositor layers and is insufficient to validate painting.
It reads actual PNG screenshot pixels, sampling cell center lines to exclude
rounded corners. It checks every fully visible cell and adjacent gap, including
padding. Screenshots and JSON results are written to the OS temporary directory.

## Verified on 2026-10-11

- Laptop configuration: 1920x1080, 200% scaling, DPR 2, zoom 1.
- Desktop configuration: 2560x1440, 150% scaling, DPR 1.5, zoom 1.
- 160 screenshot scenarios at each native DPR: Home/Project, 2026 and the
  54-week leap year 2012, widths 180–640 CSS pixels, zoom 80–150%, fractional
  origins, repeated resizes, and CSS zoom changes without a width change.
- All 320 raster scenarios had one square size and one-pixel gaps in both axes.
- At 447.4 CSS pixels, zoom 1: desktop cells were all 11x11 physical pixels;
  laptop cells were all 15x15 (previously 10x10 and 14x14 with year gutters).
  Both had 371 neutral/real cells for 2026.
- 581 dashboard layout scenarios at each primary DPR passed date/month mapping,
  label clearance, exact History-undertext typography, full History width including
  its scrollbar, maximum cell size, symmetric residual margins, heading parity, History scrolling/bottom
  alignment, full-view, text-size and hide/reveal checks.
- 23,100 pure geometry cases passed all week starts, leap/century years,
  maximum fitting cell size, label clearance and deterministic geometry.
- Browser report tests passed real-date editing for Projects/Resources and inert
  padding clicks/Enter. Navigation tests passed repeated renders and year/scope
  callbacks. Report calculation tests, typography checks, plugin load and build
  also passed.

These are isolated Chromium fixtures using production renderer, controller,
styles and report handlers, not observations on the two physical devices.
DPR notification tests explicitly dispatch resize after CDP changes DPR because CDP does not
always emit native display notifications; physical monitor switching and a live
Obsidian reload were not exercised.
