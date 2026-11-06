# Task location foreground consistency

2026-11-04

- Reused `var(--text-muted)`, the ordinary `.hub-task-dates` foreground, in the shared Home/Project task-location rule. Resource panels, The Oath's pinned/selection/review rows, and Add/Edit use the same task-row classes.
- Retained the existing `var(--text-normal)` overrides for the leading `map-pin-pen` icon and workspace-root `Edit task location` action label. No renderer, path formatting, layout, typography, hover, or interaction changes.
- Preserved completed metadata opacity, Oath selected-row token overrides, and disabled/inactive presentation. No location picker source or styles were changed by this pass; existing unrelated workspace edits were retained.

Verification:

- Task location display browser fixture: 436 assertions across 1024/600/390 px dark and 560 px light, plus real pointer, focus, Enter/Space and root alignment checks, passed.
- Temporary computed-style comparison: 60 focused assertions across those viewports passed. Home/Project and Oath state specimens matched normal due-date colors; Add/Edit path, icon and root action contrast passed. All non-color computed styles and element geometry were unchanged from the pre-task stylesheet, including with Home/Project dashboard CSS loaded.
- Task location picker browser fixture: 1003 assertions plus real pointer/keyboard/scroll/selection checks passed across the same viewports. Four additional comparisons confirmed identical computed styles and geometry for every picker element with the pre-task and updated stylesheets.
- Formatting, date presentation, application, default-location and location-editor regressions: 34/34 passed.
- AtlasCore and Atlas adapter TypeScript checks passed. Disposable plugin build passed (177 main modules, 27 Atlas native modules); installed JavaScript bundles were not overwritten.
- Verified that this pass changes only the shared task-location foreground declaration and its explanatory comment in the stylesheet. Whitespace check passed. Narrow dark screenshot inspected.

Browser verification used isolated Edge fixtures with temporary profiles and local test data, not a live Obsidian interaction session. The default Chrome executable was unavailable; Edge required in-process GPU flags in this environment. The temporary runner left the existing browser test sources unchanged.
