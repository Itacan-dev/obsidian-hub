# Symmetrical configuration content and Importance flag — 2026-10-15

Implemented, staged, verified and installed for review. Obsidian was not reloaded or restarted.

## Cause and shared correction

The ordinary Add/Edit accordion uses `.hub-task-config-section` as the full-width section beneath each painted heading. Its left padding was derived from the existing checkbox column, card gap, heading inset and icon-centering adjustment: **34 CSS px** in the measured layouts. Its right padding used a separate calculation, `8px + 6px`, giving **14px**. Phase additionally subtracted its measured reserved scrollbar width from that smaller right padding.

The existing left calculation is now the shared `--hub-task-config-content-inset` variable, applied with `padding-inline`. Phase subtracts the existing measured scrollbar width from that same inset. This preserves its visible option boundary despite its reserved gutter. There are no independent per-control offsets, new containers, transforms or separator lines.

Only the expanded controls narrow. Heading width/position, icons, labels, chevrons, configured checks and their spacing remain unchanged. The **16px gap to a subsequent heading**, 8px top/internal footer gaps, final-section bottom padding and Phase's 4px row gaps remain intact.

## Measured boundaries

Representative Add Project coordinates, in CSS pixels; Edit and Resource cases pass the same assertions. All five configurations share these boundaries, including Phase's short and long lists.

| Layout | Heading left/right | Controls before left/right | Controls after left/right | Margins before | Margins after |
| --- | --- | --- | --- | --- | --- |
| Desktop 1100×850 | 306 / 794 | 340 / 780 | 340 / 760 | 34 / 14 | **34 / 34** |
| Narrow 360×640, 1.5 scale | 51.667 / 309 | 85.667 / 295 | 85.667 / 275 | 34 / 14 | **34 / 34** |

Every measured control left edge matches its pre-change coordinate within subpixel tolerance. Right edges move inward by **20px**. The section's outer bounds and painted heading bounds do not move.

- Desktop content narrows from **440px to 420px**. Date/Time and Should do/Must do each measure **206px**, with the original **8px** gap.
- Narrow content narrows from about **209.333px to 189.333px**. Date and Time stack at that full width, with matching left/right edges and the original 8px gap. The existing native-fit logic retains side-by-side equal columns at the tested fitting **520px** viewport and stacks at **360px**. No native measurement code changed.
- Apply, Importance Done and Description Done align to **x=760 desktop / x≈275 narrow**. Importance/Description Clear aligns to **x=340 / x≈85.667**. Date Cancel remains immediately before Apply with an 8px gap. Action-button dimensions are unchanged.
- Description width is **420px / ≈189.333px** and its initial **96px height** remains unchanged.
- Phase-option edges match the same boundaries with both short and scrollable lists. Its measured **10px reserved scrollbar gutter** is compensated by the existing mechanism; it does not shrink the option region further. No phase remains first, long labels wrap, all 4px row gaps remain, and keyboard selection reaches the final option within the existing bounded scroll area.

Complete before/after coordinates for every configuration, Add/Edit and Project/Resource case are in `evidence/geometry.csv` and the JSON traces under the backup root below.

## Set importance icon

The live form's `Set importance` specification now requests standard Lucide **`flag`** through the existing `configurationAction` and icon resolver. This one shared call serves Add and Edit. The main icon remains **16×16px**, with the existing **2px stroke**, heading alignment, label gap, neutral/disabled colors and hover/selected styling. The white configured check remains outside the heading to its left.

The isolated fixture registry now includes the exact standard `flag` vector extracted from the installed Obsidian Lucide registry, allowing the screenshots and assertions to exercise the real shape. Existing `circle-gauge` fixture data remains available; unrelated production uses were not changed. Labels, choices and persisted `necessity` values are unchanged.

## Verification

- New focused fixture: **585 desktop / 593 narrow checks**. Covers Start, Due, Importance, Description, short Phase and long Phase in Add/Edit Projects, plus all applicable configurations in Add/Edit Resources. It compares full original/current stylesheets in the same modal, asserting original left edges, unchanged heading/icon/label/chevron/check geometry, symmetry, inward right-edge movement, native field widths/stacking, footer alignment, button sizes, vertical spacing, Phase scrollbar compensation, last-option reachability, stable modal top and workspace scroll isolation. Original asymmetry was reproduced before editing, with **559 / 567 baseline checks**.
- **26 browser fixture/layout runs pass:** focused symmetry; configuration layouts (88/layout); native configuration controls/pickers/validation/transactions (213/layout); inline accordion (905/layout); specification indicators with new exact flag assertions (426/layout); specification geometry (170/layout); opening stability (3,829/layout); autofocus (472/layout); shared cards (1,942 desktop / 1,938 narrow); integrated Steps/surfaces (166/layout); prior configuration polish (111/layout); actual completed-title raster rendering (43/layout); native date pointer dismissal (49/layout).
- **15 Node suites pass:** task-form, task-compact-form, task-layout-polish, task-created-completion, task-progress, task-history, task-mutations, task-workspace, task-data, task-creation-retry, task-planning, typography, project-planning, inbox and icons.
- Existing geometry expectations in the selected regressions required no weakening or removal. The specification-indicator fixture gained exact standard-flag, dimension and stroke assertions for both Add and Edit.
- Staged build: **150 main modules / 24 native modules**. Syntax, stubbed Obsidian plugin-loading and scoped whitespace checks pass. Installed/staged hashes match. The installer verifies that the flag call is the **only generated JavaScript bundle change**. Native/strict assets and the accordion, date/time and compact-form implementations remain byte-identical to their backups.

Screenshots were visually inspected for balanced margins, the flag shape, clear/picker accessibility, stacked inputs, footer alignment and long Phase scrolling. Verification uses isolated Chromium (Microsoft Edge), installed Obsidian styles/fonts and synthetic vault/services. Live Obsidian review remains with the user; no live task data was changed or reload initiated. Windows sandbox account-lockout error 1909 was handled with the approved execution fallback.

## Files changed

Production: `styles.css`, `lib/ui/task-live-form.js`, generated `main.js`.

Verification: new `lib/tests/task-symmetric-content.html`; added `flag` in `lib/tests/task-card-icons.json`; strengthened `lib/tests/task-specification-indicators.html`; this report. Unrelated repository work was preserved.

## Evidence and backups

Vault-relative root: **`System/Backups/task-symmetric-content-20261015/`**.

- `source/`: original affected styles/sources and complete original test directory.
- `installed/`: original installed CSS, bundles and manifests.
- `staged/`: verified build, CSS and manifest.
- `installed-hashes.json`, `install.log`, `staged-load.log`: artifact/loading evidence.
- Per-suite logs and Node results are retained at the backup root.
- `evidence/geometry.csv`, `evidence/desktop-task-symmetric-content-frames.json`, `evidence/small-150-task-symmetric-content-frames.json`: complete geometry and alignment evidence.
- `evidence/before-desktop.json`, `evidence/before-small-150.json`: original geometry captures.

Before/after PNGs in `evidence/` use the prefixes `hub-task-symmetric-before-` and `hub-task-symmetric-after-`, followed by `desktop` or `small-150`, `add` or `edit`, `project` or `resource`, and the configuration name.

Representative final captures:

- `hub-task-symmetric-after-desktop-add-project-start.png`
- `hub-task-symmetric-after-desktop-add-project-due.png`
- `hub-task-symmetric-after-desktop-add-project-necessity.png`
- `hub-task-symmetric-after-desktop-add-project-description.png`
- `hub-task-symmetric-after-desktop-add-project-phase.png`
- `hub-task-symmetric-after-small-150-add-project-start.png`
- `hub-task-symmetric-after-small-150-edit-project-phase-long.png`
- `hub-task-symmetric-after-small-150-responsive-360.png`

Matching original captures are retained for each configuration and context. Phase scrollability and no-Phase Resource cases are included.
