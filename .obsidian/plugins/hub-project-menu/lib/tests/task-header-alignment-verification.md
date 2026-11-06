# Task header alignment — 2026-11-06

Implemented in `styles.css` only. The shared renderer and all task logic remain unchanged.

- Home, Project and Resource Tasks panels and Add/Edit dialogs use three grid columns: wrapping title, content-sized date, and information button. Dates and buttons align with the title's first line; the date/button gap is 8px.
- Empty metadata columns have no gap. The title keeps its existing wrapping, with a small minimum track to prevent a zero-width title. Exceptionally long date labels can ellipsize at narrow widths; their text, formatting, typography and state classes are unchanged.
- Location spans the second row, aligned with the title. Compact breadcrumb formatting and the location picker are untouched.
- Existing workspace-root subgrid alignment is retained, with no location placeholder. Home continues to show the owning workspace.
- The information button retains its 28px hit area, 16px icon, hover, tooltip and pointer/keyboard interactions. Its negative block margins preserve the original compact title-row height. Description feedback does not change its geometry.
- The title editing hover surface follows the available title region. Oath selection, full task cards and the separate capture composer retain their previous layout.

## Verification

- `node .obsidian/plugins/hub-project-menu/lib/tests/task-header-alignment.cjs`: **14,764 checks passed** at 1024, 390, 320 and 600px, with dark/light themes and 1.5 device scaling. Covers all four metadata combinations, natural/unbroken long titles, metadata removal/restoration, root tasks, importance, overdue/upcoming/start/range dates, expanded Steps, excluded views, actual Add/Edit adapters, hover/click/keyboard description interaction, feedback geometry, title editing, completion and Save.
- Existing `task-editor-step-context.cjs`: **281 checks passed**.
- Existing `task-location-focus-browser.cjs`: passed Add/Edit root/folder/note cases in both themes, including all dismissal paths, selection, repetition, hover, Tab, Enter and Space.
- Date presentation, location formatting and composer routing: **10 Node test entries passed**. Native presentation, application, location defaults and editor suites: **31 tests passed**.
- AtlasCore and Atlas adapter TypeScript checks: passed.
- Isolated plugin build: passed, **177 main modules and 27 Atlas native modules**. Existing installed JavaScript bundles were not rewritten for this CSS-only change.
- Runner syntax and whitespace checks: passed. Comparison against the saved pre-change stylesheet confirms that existing edits are preserved outside the new alignment block and the corresponding title-hover inset rule.

Visual validation used **mocked Obsidian Modal/service hosts, actual task modules and native Obsidian CSS**, not the running application. Desktop and narrow panel/editor screenshots were inspected. No live task data was modified.

Pre-change stylesheet and staged build: `System/Backups/task-header-alignment-20261106/`.
Selected browser evidence is saved in its `review/` directory.
