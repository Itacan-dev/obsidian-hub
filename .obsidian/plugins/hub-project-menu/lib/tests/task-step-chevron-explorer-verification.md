# Steps chevrons: Files explorer styling — 2026-11-06

Implemented in the installed `styles.css`. This is a CSS-only correction; the running Obsidian session was not reloaded.

## Styling reference and change

The Files explorer rule in `System/Dashboards/Project/view.css`, `.hub-explorer-disclosure .hub-explorer-icon`, uses `color: var(--text-faint)` without reducing opacity. Its SVG uses the native `--icon-stroke` convention.

Nonempty Steps chevrons now use that same foreground token, full existing opacity, and `stroke-width: var(--icon-stroke, 2)`. Their 16px dimensions and geometric alignment are unchanged; the Files explorer retains its own 14px icon slot. The previous guideline-color override and hover-only color change were removed.

Both chevron directions retain the same neutral contrast, as in Files. Existing Steps heading hover feedback and keyboard focus indication remain. No backgrounds, borders, animations, or changes to the empty Add steps/list-tree action were introduced.

The shared CSS covers Home, Project, Resource, Add and Edit. The vertical guideline, wording, progress typography, spacing, task actions, and Files explorer source/styles are unchanged. No JavaScript rebuild was needed.

## Verification

- Updated `task-step-heading-polish.html`: **800 checks passed in each layout**, desktop dark 1100×900 and light 390×720 at DPR 1.5. Its reference uses the unmodified Files explorer disclosure selectors and native SVG class. It compares computed color, opacity and stroke for both directions, confirms the chevron differs from the guideline, and checks preserved 16px dimensions/alignment, hover/focus, wording/counts, empty states and compact panel widths across all five task surfaces. Screenshots were inspected.
- Existing editor interaction regression: **281 checks passed**.
- Existing panel alignment/compact-layout regression: **4,559 checks passed**.
- Existing Add/Edit spacing/internal-geometry regression: **3,037 checks passed**.
- Strict/noEmit TypeScript task-contract check and CRLF-aware stylesheet whitespace check passed.
- Git confirms `System/Dashboards/Project/view.css` and `ui/workspace-explorer.js` are unmodified. Installed JavaScript remains SHA-256 `e17dd75c199f873f2b9c42d40c29aae6bd5d9364f31bb9d547cfefbae6a8d85e`.

Browser verification used actual UI modules and native/dashboard styles with a **mocked Obsidian host**, not the running application.

Evidence: `%TEMP%/hub-step-heading-{home,project,resource,add,edit}.png`; editor interaction evidence: `%TEMP%/itacan-step-context-OtMglf/`.

Changed this pass: two Steps-only CSS declarations, the heading fixture's styling expectations/reference, and this report. Earlier checkout edits were preserved.
