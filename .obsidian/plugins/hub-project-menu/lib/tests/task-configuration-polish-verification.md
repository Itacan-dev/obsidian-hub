# Task editor configuration polish — 2026-10-15

Implemented, verified, staged and installed for review. No Obsidian reload or restart was performed.

The ordinary Add/Edit windows use `task-live-form.js`, the shared disclosure controller in `task-accordion.js`, native fields from `date-time.js`, and the selector in `task-compact-form.js`. Disclosure, focus ownership, pending drafts and persistence remain unchanged.

## Changes and causes

- **Date focus:** the wrapper had no outline or shadow. The shared `.hub-button-scope.hub-capture-form-scope … :focus-visible` rule added a **2px outline with 2px offset**, while the shared capture-form focus rule restored the layered `--input-shadow`. Baseline computed styles and screenshots reproduce the stacked appearance. An inline-endpoint-only rule now removes that outline and shadow and changes the existing thin border to `--text-muted` on focus. Automatic focus, native selected segments, keyboard focus indication, picker/clear controls, dimensions and responsive columns remain. Both Start and Due use this rule; native date/time code was not edited.
- **Importance surfaces:** unselected inline options now participate in the existing shared neutral-button rules, including `--background-primary`, `--background-modifier-border`, 6px radius, `--input-shadow`, and the normal hover surface/shadow. Their component's transparent border and absent shadow no longer suppress the neutral convention. Existing padding, 8px column gap, yellow/red markers, radio semantics and purple selected styling remain. The selectors apply only to inline Importance, preserving compact/Quick Add/Inbox presentation.
- **Terminology:** the live editor opts into Importance terminology in the shared selector. Both Add/Edit headings and accessible action labels say **Set importance**; the region title says **Importance** and the clear button says **Clear importance**. Shared tooltips consume the updated accessible labels. The `circle-gauge` icon, configured checkmarks, persisted `necessity`, `must`/`should` values and prioritization are unchanged. Compact callers retain their defaults.
- **Spacing:** one shared CSS rule doubles bottom padding only for an expanded group with a later visible specification. It uses the existing `--hub-task-specification-gap`, with no new markup or separators. The rule also handles a hidden Phase heading.

## Measured geometry

Measurements use final control bounds and the following painted heading bounds, for both Add and Edit.

| Following boundary | Before | After |
| --- | ---: | ---: |
| Start controls → Due heading | 8px | 16px |
| Due controls → Importance heading | 8px | 16px |
| Importance controls → Description heading | 8px | 16px |
| Description controls → visible Phase heading | 8px | 16px |
| Final section bottom padding, including Description with Phase hidden | 8px | 8px |

Desktop **1100×850** and narrow **360×640 at 1.5 device scale** agree, within subpixel rounding. Collapsed row geometry and card-to-list spacing remain unchanged. Heading-to-controls padding, internal control/footer gaps and modal footer spacing remain unchanged. Modal scrolling and long Phase reachability pass.

## Verification

- **111 focused checks per layout**: Add/Edit wording, empty/existing native dates, automatic focus and computed border/outline/shadow layers, clearing/changing/Cancel, unselected/hovered/selected Importance surfaces, radio keyboard selection, immediate draft changes, equal widths/gap, measured before/after spacing, and final-section handling.
- **40 browser fixture/layout runs pass.** These cover inline accordion (905/layout), native configuration controls and actual picker interactions (213/layout), layout (88/layout), neutral accordion (351/layout), indicators (420/layout), configured feedback (591/layout), opening stability (3,829/layout), autofocus (472/layout), shared cards (1,942 desktop / 1,938 narrow), card/Steps correction (479/layout), integrated Steps (166/layout), Step geometry (65/layout), date pointer dismissal (49/layout), Phase/readiness, workflows, Step progress and row focus. Desktop modal regions (176) and Quick Add/Inbox (2,101) pass.
- **15 Node suites pass:** task-form, task-compact-form, task-layout-polish, task-created-completion, task-progress, task-history, task-mutations, task-workspace, task-data, task-creation-retry, task-planning, typography, project-planning, inbox and icons.
- **Two broader narrow-layout failures also reproduce with the preserved pre-change stylesheet:** modal-regions, “Missing rating revealed inside body”; inbox, “Quick Add keeps the content and footer separators”. Their assertions and unrelated UI were left unchanged. A tooltip timing failure passed on isolated rerun without a production change.
- Updated only existing assertions expecting the renamed live-editor labels. No unrelated assertion was weakened.
- Staged build: **150 main modules / 24 native modules**, syntax and stubbed Obsidian module-loading checks pass. Installed/staged artifact hashes match. Native and strict assets are unchanged. Scoped whitespace checks pass.

Tests use isolated Chromium (Microsoft Edge), synthetic vault/services and the installed Obsidian stylesheet/fonts. Actual live-vault editing and an Obsidian reload were intentionally left for user review. Windows sandbox execution encountered account-lockout error 1909; the approved execution fallback completed verification and installation.

## Files changed

Production: `styles.css`, `lib/ui/task-live-form.js`, `lib/ui/task-compact-form.js`, generated `main.js`.

Fixtures: new `lib/tests/task-configuration-polish.html`; terminology assertions in `task-configuration-layouts.html`, `task-config-popovers.html`, `task-live-card.html`, `task-opening.html`, `task-specification-indicators.html`; this report.

All pre-existing repository changes were preserved. `task-accordion.js` and `date-time.js` were inspected and backed up but did not require edits.

## Evidence and recovery

Vault-relative root: `System/Backups/task-configuration-polish-20261015/`.

- `source/`: affected source files and complete original test directory.
- `installed/`: original installed main, CSS, native bundle, manifest and strict-asset manifest.
- `staged/`: final verified build and matching CSS/manifest.
- `installed-hashes.json`: staged/installed SHA-256 comparisons.
- Per-suite logs, baseline comparisons, Node results, loading check and repository status snapshots are retained at the root.
- `evidence/`: before/after PNG screenshots and JSON geometry/focus traces. The final focused traces are `desktop-task-configuration-polish-frames.json` and `small-150-task-configuration-polish-frames.json`.

Representative screenshots in `evidence/`:

- `hub-task-polish-before-desktop-add-start-focused.png`
- `hub-task-polish-after-desktop-add-start-focused.png`
- `hub-task-polish-after-desktop-add-importance-clear.png`
- `hub-task-polish-after-desktop-add-importance-hover-must.png`
- `hub-task-polish-after-desktop-add-importance-should-selected.png`
- `hub-task-polish-after-small-150-add-start-focused.png`
- `hub-task-polish-after-small-150-edit-importance-selected.png`

Captures for collapsed, Start, Due, Description and Phase configurations are included for Add/Edit and both layouts. Representative before/after date, neutral/hovered Importance and narrow selected Edit captures were visually inspected.
