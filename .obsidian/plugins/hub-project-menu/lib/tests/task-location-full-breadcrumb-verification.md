# Full Task location breadcrumb restoration

2026-11-04

Scope: picker breadcrumb only. Compact task metadata formatting, Home/workspace context, Add/Edit styling, and persistence were preserved.

- Render every workspace/folder/note segment in order. Every folder retains its own real navigation path; the selected endpoint keeps its purple treatment and ancestors retain gray hover.
- Restore single-line overflow-x:auto. Names neither shrink nor truncate. Horizontal overflow stays within the breadcrumb viewport.
- Reveal the endpoint after initial modal layout and when owner/path/note selection changes. Same-location renderFolder/renderBreadcrumbs/updateSelection preserve the previous manual scrollLeft.
- Remove the picker-only compact formatter import, omitted-folder popover method/state/handlers, ellipsis control and unused styles. Shared compactPathSegments remains unchanged for metadata.

Validation:
- task-location-polish-browser.cjs: 821 fixture assertions over 1024/600/390 px dark and 560 px light, plus real keyboard/pointer/wheel checks, pass. Tests lengths 1-7 and 14+, full long folder/note names, initial deep-note endpoint visibility, folder/note changes, manual scrolling through refreshes, each ancestor's navigation, workspace changes, unchanged highlight/hover, and bounded dialog geometry. Existing header, workspace dropdown, cancel/select and task-name tooltip checks pass. Narrow-screen capture visually inspected.
- task-location-display-browser.cjs: 116 fixture assertions plus real hover/keyboard checks pass across four viewports/themes.
- Formatting, location-defaults and editor tests: 22/22 pass.
- SHA-256 checks confirm native-task-location.js, task-card.js, task-live-form.js and home-task-read.js were unchanged in this pass.
- AtlasCore and Atlas adapter TypeScript checks pass. Edited picker JavaScript syntax check passes.
- Plugin build passes: 177 main modules, 27 Atlas native modules.
- Source scan confirms no picker ellipsis/popover logic or styles remain.

Browser verification uses isolated fixtures, not an automated live Obsidian session. No real task data was modified for tests.
