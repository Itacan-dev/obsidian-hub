# Workspace-root task location polish

2026-11-04

Only task-card presentation changed; compact formatting, location selection and native persistence were retained.

- Detect a real workspace root from available native display data with zero path segments. Unavailable locations remain visible and are never mistaken for roots.
- Home keeps the owning workspace name. In the owning Project/Resource panel, detach the complete location element so no empty location row is rendered. Restore it when a later presentation update has a folder/note location.
- Phase badges, when present, remain independent metadata even after removal of the location element. Dates, importance, completion, title and Steps remain intact.
- Add/Edit retain a single location button: map-pin-pen first, followed by the ordinary compact path or the exact root action label Edit task location. Root labels apply in Home and workspace contexts. Existing muted text, normal icon foreground, content-sized hover, focus, native Enter/Space and click callbacks remain unchanged.

Checks:
- task-location-display-browser.cjs: 268 fixture assertions across 1024/600/390 px dark and 560 px light, plus real hover and Enter/Space checks, pass. Covers both Project/Resource root panels, Home workspace names, no empty vertical space, available/unavailable distinctions, root/folder transitions, preserved phases/dates/Steps/importance, Add/Edit Home/workspace roots, leading icon order and long paths. Narrow screenshot visually inspected.
- task-location-polish-browser.cjs: 821 fixture assertions plus real pointer/keyboard/horizontal-wheel checks pass. Includes existing picker selection/cancel behavior and full scrollable breadcrumbs.
- Formatting, application, defaults and editor regression suites: 33/33 pass, including native location persistence, ownership moves and origin context.
- AtlasCore and Atlas adapter TypeScript checks pass; edited JavaScript syntax check passes.
- Plugin build passes: 177 main modules and 27 Atlas native modules.
- Formatter, picker and live-form source hashes are unchanged in this pass. No stylesheet changes were required.
- git diff --check with Windows CR-at-EOL handling passes.

Verification used isolated browser fixtures and temporary engine databases, not a live Obsidian interaction session. Existing unrelated workspace edits were preserved.
