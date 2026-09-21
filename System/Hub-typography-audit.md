# Hub typography audit — 5 September 2026

Inspection only: no typography normalization was made. The one requested change was matching the Resources heading to the Projects heading.

## Count and scope

Hub-owned CSS contains **88 font-size declarations and 28 distinct authored values** across Home, the shared Project/Resource view, Daily, and the Hub plugin stylesheet:

- 23 rem-based values;
- 3 theme-token values;
- 1 relative icon size (`0.75em`);
- `0` for hidden heatmap-cell text.

At a 16px root size and the installed default desktop theme tokens, the rem/token declarations resolve to **25 distinct sizes**, because `0.75rem` and `--font-ui-smaller` both equal 12px. One is the Focus bullet’s 10.4px icon size, leaving **24 explicitly sized text groups**. Inherited native styles and the heatmap dependency add the values described below; they are not silently counted as fixed Hub declarations.

These are CSS-pixel equivalents, not physical pixels. App zoom/display scaling affects physical appearance. The vault uses the default theme and a 17px note-text setting; note text does not redefine the root rem. An actual theme override can change token/inherited sizes. No live Obsidian DOM was available to measure every modal and state.

## Size → components

Identical resolved sizes are grouped together.

| Size at current default tokens | Source value | Components |
| --- | --- | --- |
| 9.92px | 0.62rem | Project/Resource log times; shared-Resource folder badges. |
| 10.24px | 0.64rem | Home Focus context labels and report scores; Project/Resource activity locations and report metadata. |
| 10.4px | 0.65rem | Home Focus diamond/bullet (icon, not text). |
| 10.56px | 0.66rem | Task locations and Clear buttons; file timestamps; Home log times; Project/Resource log dates; upcoming-task dates. |
| 10.72px | 0.67rem | Calendar day dates (inspection only). |
| 10.88px | 0.68rem | Reports / Activity / Tasks tabs; Home report summaries and activity context labels; Focus Edit; folder table headings; Calendar Today, range and empty-day labels. |
| 11.2px | 0.7rem | Home subtitle; Project/Resource report summaries; Calendar location/warning/loading text. |
| 11.52px | 0.72rem | Home log dates and Project-card category text; note-rail subtitle; folder search; Focus row numbering; Calendar weekday labels. |
| 11.84px | 0.74rem | Home report context names. |
| 12px | 0.75rem; --font-ui-smaller | Calendar event time; Resource-folder picker section/empty labels; audit manual-action text. |
| 12.16px | 0.76rem | Project/Resource activity titles, empty-folder message, note/subfolder creation inputs; report scale descriptions; Daily empty message; Calendar week number. |
| 12.48px | 0.78rem | Greeting summary; Project/Resource subtitle and file names; shortcut buttons; heatmap year labels. |
| 12.8px | 0.8rem | Tasks to Do text; Project status tabs; project-wizard selection; upcoming task titles; Daily empty-state text. |
| 13px | --font-ui-small | Image-placement instruction overlay. Native default buttons/inputs also commonly resolve to this token. |
| 13.12px | 0.82rem | Page date; folder titles and top-level Folder name input; Home heatmap navigation; report scale definitions; Project/Resource empty messages; Daily project name. |
| 13.44px | 0.84rem | Home Activity / Tasks log titles. |
| 13.6px | 0.85rem | Home empty states; Calendar event titles. |
| 13.76px | 0.86rem | Project/Resource names in the progress-report editor. |
| 14.08px | 0.88rem | Home Resource-card titles. |
| 14.4px | 0.9rem | Progress-report editor’s next-Focus heading. |
| 15px | --font-ui-medium | Audit section headings; other native modal/settings text can inherit the same token. |
| 15.68px | 0.98rem | Home Project-card titles. |
| 16px | 1rem | Projects and Resources headings; project-create +; project-wizard category menu. |
| 16.8px | 1.05rem | Project/Resource title in the note-view rail. |
| 26.4px | 1.65rem | Home greeting; full Project/Resource page title. |

The 0.76rem creation-input rule is overridden to 0.82rem for the top-level folder placeholder. The earlier 1rem Home progress-navigation rule is overridden to 0.82rem. The table above reflects these overrides.

## Inherited and dependency-provided sizes

| Source | Expected default size | Elements |
| --- | --- | --- |
| Note-text inheritance | 17px with this vault’s setting | Home panel titles such as Progress/Tasks/Calendar; Project/Resource panel headings; Focus body text without an explicit size. The Progress scope label inherits its heading. |
| Heatmap Calendar’s 0.65em | 11.05px if its parent is 17px | Heatmap month labels on Home/Project/Resource. Its built-in year/weekdays are hidden by Hub CSS. |
| Native --font-ui-medium | 15px | Modal body, settings and native menu text unless a component overrides it. |
| Native --font-ui-small | 13px | Standard native buttons and text inputs unless Hub overrides them. |
| Native h2-size, 1.462em | 21.93px with a 15px parent | Hub modal h2 headings, including the focus/progress dialogs. |
| Native h3-size, 1.318em | 19.77px with a 15px parent | Modal h3 headings without a more specific Hub override. Audit h3 and report-Focus h3 have explicit overrides above. |

These inherited calculations are conditional on their actual parent/font cascade, not a claim that every surface was measured live. If you later want one exact rendered-size census, collect computed styles from the running app across Home, full/rail views and open dialogs.

Excluded from text-size counts:

- `0.75em`: Progress dropdown chevron icon, relative to its heading.
- `0.65rem`: Focus diamond/bullet.
- `font-size: 0`: intentionally hidden text inside heatmap cells.
- SVG icons sized by width/height instead of font size.

## Exact declaration inventory

This includes repeated selectors and superseded declarations for traceability; use the grouped table above for visual decisions.

### 0

- `.home-progress-calendar .heatmap-calendar-boxes li` — `System/Dashboards/Home/view.css`
- `.project-progress-calendar .heatmap-calendar-boxes li` — `System/Dashboards/Project/view.css`

### 0.62rem

- `.project-folder-panel.is-shared-resource .project-folder-title::after` — `System/Dashboards/Project/view.css`
- `.project-activity-clock` — `System/Dashboards/Project/view.css`

### 0.64rem

- `.home-focus-project` — `System/Dashboards/Home/view.css`
- `.home-progress-report-score` — `System/Dashboards/Home/view.css`
- `.project-activity-location` — `System/Dashboards/Project/view.css`
- `.project-progress-report-meta` — `System/Dashboards/Project/view.css`

### 0.65rem

- `.home-focus-dot` — `System/Dashboards/Home/view.css`

### 0.66rem

- `.home-recent-clock` — `System/Dashboards/Home/view.css`
- `.home-task-location, .home-upcoming-date` — `System/Dashboards/Home/view.css`
- `.home-task-clear-completed` — `System/Dashboards/Home/view.css`
- `.project-browser-time` — `System/Dashboards/Project/view.css`
- `.project-task-clear-completed` — `System/Dashboards/Project/view.css`
- `.project-task-location` — `System/Dashboards/Project/view.css`
- `.project-activity-date` — `System/Dashboards/Project/view.css`

### 0.67rem

- `.home-calendar-day-date` — `System/Dashboards/Home/view.css`

### 0.68rem

- `.home-recent-type` — `System/Dashboards/Home/view.css`
- `.home-calendar-today` — `System/Dashboards/Home/view.css`
- `.home-calendar-week-range` — `System/Dashboards/Home/view.css`
- `.home-calendar-day-empty` — `System/Dashboards/Home/view.css`
- `.home-focus-edit` — `System/Dashboards/Home/view.css`
- `.home-progress-tabs button` — `System/Dashboards/Home/view.css`
- `.home-progress-report-summary` — `System/Dashboards/Home/view.css`
- `.project-browser-column` — `System/Dashboards/Project/view.css`
- `.project-progress-tabs button` — `System/Dashboards/Project/view.css`

### 0.7rem

- `.home-subtitle` — `System/Dashboards/Home/view.css`
- `.home-calendar-location` — `System/Dashboards/Home/view.css`
- `.home-calendar-warning` — `System/Dashboards/Home/view.css`
- `.home-calendar-loading` — `System/Dashboards/Home/view.css`
- `.project-progress-report-summary` — `System/Dashboards/Project/view.css`

### 0.72rem

- `.home-recent-date` — `System/Dashboards/Home/view.css`
- `.home-project-category` — `System/Dashboards/Home/view.css`
- `.home-calendar-weekday` — `System/Dashboards/Home/view.css`
- `.hub-project-advancement-focus-number` — `System/Dashboards/Home/view.css`
- `.project-folder-search` — `System/Dashboards/Project/view.css`
- `.hub-project-advancement-focus-number` — `System/Dashboards/Project/view.css`
- `.hub-project-rail .project-nav-category` — `.obsidian/plugins/hub-project-menu/styles.css`

### 0.74rem

- `.home-progress-report-project` — `System/Dashboards/Home/view.css`

### 0.75rem

- `.home-calendar-time` — `System/Dashboards/Home/view.css`

### 0.75em

- `.home-progress-scope-chevron` — `System/Dashboards/Home/view.css`

### 0.76rem

- `.home-calendar-week-number` — `System/Dashboards/Home/view.css`
- `.hub-project-advancement-description` — `System/Dashboards/Home/view.css`
- `.project-folder-empty` — `System/Dashboards/Project/view.css`
- `.project-create-input, .project-folder-placeholder-input` — `System/Dashboards/Project/view.css`
- `.project-activity-title` — `System/Dashboards/Project/view.css`
- `.hub-project-advancement-description` — `System/Dashboards/Project/view.css`

### 0.78rem

- `.home-context` — `System/Dashboards/Home/view.css`
- `.home-shortcut-button` — `System/Dashboards/Home/view.css`
- `.home-progress-year` — `System/Dashboards/Home/view.css`
- `.project-category` — `System/Dashboards/Project/view.css`
- `.project-shortcut-button` — `System/Dashboards/Project/view.css`
- `.project-browser-name` — `System/Dashboards/Project/view.css`
- `.project-progress-year` — `System/Dashboards/Project/view.css`

### 0.8rem

- `.home-project-tab` — `System/Dashboards/Home/view.css`
- `.home-task-text, .home-upcoming-title` — `System/Dashboards/Home/view.css`
- `.hub-project-wizard-selection` — `System/Dashboards/Home/view.css`
- `.project-task-text` — `System/Dashboards/Project/view.css`
- `.daily-project-empty` — `System/Dashboards/Daily/view.css`

### 0.82rem

- `.home-date` — `System/Dashboards/Home/view.css`
- `.home-progress-nav` — `System/Dashboards/Home/view.css`
- `.hub-project-advancement-definition` — `System/Dashboards/Home/view.css`
- `.project-date` — `System/Dashboards/Project/view.css`
- `.project-folder-title` — `System/Dashboards/Project/view.css`
- `.project-folder-placeholder-input` — `System/Dashboards/Project/view.css`
- `.project-empty` — `System/Dashboards/Project/view.css`
- `.hub-project-advancement-definition` — `System/Dashboards/Project/view.css`
- `.daily-project-name` — `System/Dashboards/Daily/view.css`

### 0.84rem

- `.home-recent-title` — `System/Dashboards/Home/view.css`

### 0.85rem

- `.home-empty` — `System/Dashboards/Home/view.css`
- `.home-calendar-title` — `System/Dashboards/Home/view.css`

### 0.86rem

- `.hub-project-advancement-name` — `System/Dashboards/Home/view.css`
- `.hub-project-advancement-name` — `System/Dashboards/Project/view.css`

### 0.88rem

- `.home-resource-title` — `System/Dashboards/Home/view.css`

### 0.9rem

- `.hub-project-advancement-focus h3` — `System/Dashboards/Home/view.css`
- `.hub-project-advancement-focus h3` — `System/Dashboards/Project/view.css`

### 0.98rem

- `.home-project-title` — `System/Dashboards/Home/view.css`

### 1rem

- `.home-project-heading` — `System/Dashboards/Home/view.css`
- `.home-project-create, .home-progress-nav` — `System/Dashboards/Home/view.css`
- `.home-resource-heading` — `System/Dashboards/Home/view.css`
- `.hub-project-wizard-category-menu` — `System/Dashboards/Home/view.css`

### 1.65rem

- `.home-greeting` — `System/Dashboards/Home/view.css`
- `.project-title` — `System/Dashboards/Project/view.css`

### var(--font-ui-small)

- `.hub-image-placement-controls` — `.obsidian/plugins/hub-project-menu/styles.css`

### 1.05rem

- `.hub-project-rail .project-nav-title` — `.obsidian/plugins/hub-project-menu/styles.css`

### var(--font-ui-smaller)

- `.hub-resource-folder-picker-type, .hub-resource-folder-picker-empty` — `.obsidian/plugins/hub-project-menu/styles.css`
- `.hub-data-audit-manual` — `.obsidian/plugins/hub-project-menu/styles.css`

### var(--font-ui-medium)

- `.hub-data-audit-section h3` — `.obsidian/plugins/hub-project-menu/styles.css`

