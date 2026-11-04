# Task location truncation correction

2026-11-04

Cause and history
- locationBreadcrumb retained only first/final segments for paths longer than three. The same rule exists in commit 9cc6b45; the recent UI pass reused this incorrect rule instead of checking the established first/last-two convention.
- The recent editor pass always used service.nativeOwner as display context, losing Home's distinction from workspace-origin editors.

Correction
- compactPathSegments returns unchanged items for lengths 1-3; for longer paths it retains first, an omission marker, penultimate and final, plus the complete ordered omitted list. No location IDs, ownership or stored paths are changed.
- Home cards include workspace names; owning-workspace cards omit them before compaction. Add/Edit inherit an explicit captured locationWorkspace from the originating panel; Home uses null. Home's Add button explicitly requests Home presentation. Unscoped search/history editors include workspace names. Switching ambient workspace does not change the captured display origin.
- Both metadata and picker reuse the same segment selection function. The picker retains full navigation paths separately. Its ellipsis opens the existing task popover with omitted folders in order, supports native Enter/Space, arrow/Home/End navigation, Tab, Escape/focus restoration, outside dismissal and selection/navigation.
- The breadcrumb retains its border/width/height and selected-endpoint accent. Individual names ellipsize within a single non-scrolling row. Complete paths remain available through accessible description and truncated-segment titles.
- Tasks panel card styling, Add/Edit location visual refinements, picker confirmation/cancel, task saving and native persistence are unchanged.

Checks
- task-location-formatting.test.js: 8/8 pass (1-6 actual segments, Home/workspace examples, root/unavailable contexts, full data preservation).
- ItacanTaskCore npm test: 106/106 pass, including a new captured-origin test and existing native location/default/editor/ownership/persistence regressions.
- task-location-polish-browser.cjs: 693 fixture assertions across 1024/600/390 px dark and 560 px light, plus real pointer and keyboard assertions, pass. Covers short paths, deep folder/note paths, visible/omitted ancestors, workspace switches, long names, selection/cancel, menu dismissal and cleanup. Narrow-screen ancestor popover screenshot visually inspected.
- task-location-display-browser.cjs: 116 fixture assertions across four viewports/themes plus real hover/keyboard checks pass. Preserves metadata typography, map-pin-pen, content-sized hover, focus and long-path geometry; includes Home/workspace Add/Edit presentation contexts.
- Composer routing and date presentation: 2/2 pass.
- AtlasCore TypeScript and Atlas adapter TypeScript: pass. Edited UI modules are JavaScript outside these projects; syntax checks pass.
- Plugin build: pass (177 main modules, 27 Atlas native modules).
- git diff --check with Windows CR-at-EOL handling: pass.

Verification uses isolated browser fixtures and temporary engine databases; no real task records were modified for testing. Existing unrelated uncommitted changes were preserved. Complete live Obsidian interaction was not automated.
