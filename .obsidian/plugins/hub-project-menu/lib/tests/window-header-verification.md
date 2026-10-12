# Window headers and progress reports — 11 October 2026

Report headers retain the shared 44px icon column, 14px column gap and 6px
subtitle gap. A semantic date sits right-aligned beside the title, with a 24px
close-button allowance. Title and date wrap within their row at narrow widths.
Report subtitles use the existing `p`, `hub-oath-muted` and body typography rules.
Ordinary body text retains its punctuation.

Exit presentation consumes existing saved reports, `resolvedAt` and
`activityDirtyContexts(date, afterTimestamp)`. Initial exits show Complete;
new activity confirmed by the established lifecycle shows Update; manual edits
show Edit; viewers show Progress report. No trigger, rating-default or save
behavior was changed.

Manual saves do not clear exit dirty state. Existing reports with no usable save
timestamp, or no confirmed activity after a newer manual save, use Edit rather
than claiming new activity. An all-unrated manual save with no reflection can
leave no report entry or exit completion marker; the existing state cannot
distinguish that case from an initial report. All-unrated **exit** saves retain
their existing `resolvedAt` marker and are covered by the lifecycle test.

The installed Obsidian registry lacks Goal. `setHubIcon` prefers native Goal
when available and otherwise renders the
[official Lucide SVG](https://github.com/lucide-icons/lucide/blob/main/icons/goal.svg),
following the existing icon fallback convention.

## Changed files for this task

- `../../plugin.js`: context titles, icons, subtitles and editor date wiring.
- `../../styles.css`: report paragraph margin and title/date row styles.
- `../ui/window-title.js`: optional date within the shared header copy.
- `../ui/daily-report.js`: viewer title/date/subtitle and day-focus Goal.
- `../ui/icons.js`: native/official Goal fallback.
- `../ui/oath.js`, `quick-add.js`, `music.js`, `music-item-editor.js`,
  `settings.js`, `home-covers.js`, `planning-editor.js`: subtitle punctuation only.
- `daily-report.test.js`, `daily-report.html`, `window-titles.html`,
  `window-title-icons.js`, `icons.test.js`, `report-ratings.html`,
  `planning-headers.html`, `oath.html`, `date-presentation.html`: updated header
  expectations, lifecycle and icon coverage.
- `../../main.js`: rebuilt from source. This note records verification.

Pre-existing heatmap, dashboard and other workspace edits were preserved.

## Verification

Passed eleven Node suites: `daily-report`, `daily-brief`, `task-progress`,
`oath`, `oath-workspace`, `progress-heatmap`, `progress-colors`, `typography`,
`domain`, `plugin-load`, `icons`.

Passed ten headless Chromium fixtures at 1100×850: `window-titles`,
`daily-report`, `report-ratings`, `report-content`, `report-style-ownership`,
`planning-headers`, `modal-regions`, `editor-save-validation`,
`progress-navigation`, `date-presentation`. The report fixture also passed at
420×700; its context-header cases check widths of 720, 480 and 320px.
Shared-header checks cover 24 Lucide headers and 310px wrapping. Stylesheet
ownership passed 228 computed-style/geometry comparisons across plugin/Home/
Project combinations and live replacement. Narrow report screenshots were
visually inspected.

The broad `oath.html` fixture stops at line 269 because its task-creator selector
`.hub-task-source` no longer exists. The identical failure was reproduced using
the unchanged HEAD Oath component, shared header component and original fixture
in a temporary baseline page. That page was removed. This broad suite is not
claimed as passing; Oath domain/workspace suites and shared-header checks pass.

Build and plugin-load checks passed. Whitespace checking passed with
`git -c core.whitespace=cr-at-eol diff --check`, respecting the repository's
existing CRLF source/bundle convention. UI verification used isolated Chromium
fixtures, without reloading a live Obsidian workspace.
