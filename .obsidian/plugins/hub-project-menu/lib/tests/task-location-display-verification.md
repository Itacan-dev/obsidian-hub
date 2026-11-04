# Task editor location display verification

2026-11-04

Both Add and Edit use mountLiveTaskForm and mountTaskCardPresentation. The editor now passes service.nativeOwner as its fixed workspace context, matching workspace panel formatting. locationBreadcrumb remains unchanged; root labels, workspace inclusion, middle-segment abbreviation and CSS ellipsis are shared. Preview ownership follows the selected draft without changing the persisted native reference.

The location is one native button with metadata typography inherited from the panel, a trailing map-pin-pen icon, transparent default background, content-sized gray hover, and visible focus. Text shrinks independently of the icon. The installed Obsidian registry contains map-pin-pen. Picker callbacks, draft state, cancel, and persistence are unchanged.

Validation:
- New task-location-display-browser.cjs: 25 assertions per viewport, 1024/600/390 px dark and 560 px light; real Enter/Space, hover and focus checks pass. Covers root, folder, note, deeply nested and very long routes, draft owner changes (including an original nativeReference), matching panel computed typography, and data preservation. Screenshots visually inspected.
- Existing task-location-polish-browser.cjs: 541 assertions across four viewports/themes pass, including picker selection/cancel, keyboard and pointer interaction.
- ItacanTaskCore npm test: 105/105 pass, including defaults, editor startup, creation, persistence and ownership regressions.
- Composer routing and date presentation tests: 2/2 pass.
- AtlasCore and Atlas adapter TypeScript checks: pass. Edited UI files are JavaScript, outside these TypeScript projects; node --check passes.
- Plugin build: passes (177 main modules, 27 Atlas native modules).
- git diff --check with core.whitespace=cr-at-eol: passes. Default diff check flags existing CRLF lines embedded in the generated bundle.

Limitations: browser fixture uses isolated task-card rendering, rather than a complete live Obsidian session. Add/Edit share this rendering; existing picker and engine regressions cover their unchanged underlying workflows. Existing save service rejects cross-workspace moves of an existing task; this pass preserves that restriction. New-task draft ownership changes remain supported.
