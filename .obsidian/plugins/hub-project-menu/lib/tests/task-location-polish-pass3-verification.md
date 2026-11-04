# Task location picker: UI polish pass 3

2026-11-04. Implemented and rebuilt in Work; no commit or push.

## Result

- Breadcrumb now has one understated outer border using the existing border/radius tokens, aligns with the navigator, and has 36px minimum height for ordinary paths. The Location heading-to-breadcrumb and breadcrumb-to-navigator gaps are both 8px. Long routes retain internal horizontal scrolling and long segments retain truncation.
- Ancestor and endpoint segments share the same font size, normal weight, line height, baseline and text color. Exactly the selected endpoint receives the same 17% purple accent mix as a selected note. Roots, folders and notes all use this convention. Unselected segment hover uses the existing neutral row background with no underline; selected hover remains purple. Keyboard focus keeps its separate visible outline.
- Removed the generic Selected task location label/tooltip source and redundant endpoint titles. The nav is labelled by the actual Location heading, with the complete route available through an accessible description. A truncated endpoint can still show its full name as a useful tooltip; ancestor path tooltips remain available.
- Workspace dropdown now orders Resources before Projects. Category headings reuse the existing body-size token (13.44px at the normal base size), semibold, below the main 16px section headings. Muted dividers appear beneath Resources, above Projects, and beneath Projects; individual options remain borderless 32px rows.
- Dropdown opens at scroll position zero, focusing the first available resource/option without scrolling to a selected Project. The actual selected workspace stays purple at its list position; End/Home/arrow navigation can reach it. Shared top-layer overlay positioning, width/height constraints, chevrons, dismissal and focus restoration remain in use.

Header/icon/subtitle, workspace cover/type display, main section headings, navigator styling, selection/navigation/persistence semantics, defaults, owning-workspace rules and footer actions are preserved. No native service or task storage changes were made in this pass. No design deviations were required; the category font uses the closest existing token rather than introducing a fixed 14px scale.

## Verification

- Browser harness passed 115 assertions at each of 1024x900, 600x780, 390x720 (dark), and 560x900 (light): 460 assertions total. Covers breadcrumb borders/spacing/alignment/typography, endpoint selection for roots/folders/notes, note deselection, accessible labelling/no generic tooltip, complete routes and long-path bounds; Resources-first ordering, all three divider positions, compact options, top-of-menu initial presentation with a late selected Project, keyboard navigation, overlay stability, dismissal and retained navigator behavior.
- Real Chrome CDP pointer/keyboard checks passed in all four configurations. Breadcrumb hover has a neutral background and no underline or typography change; note/root endpoint hover preserves purple; breadcrumb and note selection tints match; keyboard focus remains distinct. Enter/Home/ArrowDown/Escape and outside clicks retain workspace selection/dismissal/focus behavior.
- Focused task-default, editor, application, presentation and workspace-thumbnail regressions: 29/29 passed, zero failures/skips. Tests use disposable data and cover unchanged Home/workspace defaults, creation recency, unavailable locations, explicit contexts, restart/edit initialization and native mutations/presentation.
- TaskCore strict/noEmit fixture: TypeScript 6.0.3, zero diagnostics.
- Production build passed: main.js 177 modules, atlas-native.cjs 27 modules. Generated main.js passed syntax checking. Only the tested main.js was installed; other generated sidecars were not replaced.
- CRLF-aware Git whitespace check passed. Collapsed narrow-dark and expanded light browser captures were inspected.

Browser verification uses actual picker/header/popover/thumbnail source with synthetic Modal/vault adapters. The live Obsidian session was not reloaded; reload the plugin or restart Obsidian to activate the new JavaScript. No live task data was modified, and pre-existing edits/task streams were preserved.

## Files changed in this pass

- lib/ui/task-location-picker.js
- styles.css
- main.js (generated)
- lib/tests/task-location-polish-browser.js
- lib/tests/task-location-polish-browser.cjs
- lib/tests/task-location-polish-pass3-verification.md

Installed main.js SHA-256: `b67299e6fa69cab34c826ced92d7b09c8eef5bd3fc1537a578cd58077a75a27f`.
Prior bundle backup: `%TEMP%/itacan-task-location-polish-pass3-build/main.before-pass3.js`.
Final browser captures: `%TEMP%/itacan-location-browser-3dQvvp/`.
