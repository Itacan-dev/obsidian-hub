# Hub semantic typography — 6 September 2026

The original [typography audit](Hub-typography-audit.md) is retained as the before-state.

## Shared scale

Defined once in .obsidian/plugins/hub-project-menu/styles.css and scoped to Hub surfaces, Daily widgets and detached Project drag cards. Rem units preserve root-size/accessibility scaling; pixel equivalents below assume the existing 16px root.

| Token | Size | Roles |
| --- | --- | --- |
| --hub-font-meta | 0.66rem / 10.56px | Timestamps, task/log locations, shared-folder badges, Focus context labels, report scores |
| --hub-font-secondary | 0.72rem / 11.52px | Categories, dates, heatmap labels, muted report summaries, column labels, compact utility actions/log tabs |
| --hub-font-compact | 0.78rem / 12.48px | Filenames, task text, inputs/search, navigation/shortcut buttons, greeting summary, empty states, compact descriptions |
| --hub-font-body | 0.84rem / 13.44px | Log/item titles, Calendar event titles, folder titles, Focus body text, Daily names, report scale definitions |
| --hub-font-subheading | 0.9rem / 14.4px | Small subheadings, emphasized Project/Resource labels in report editors |
| --hub-font-heading | 1rem / 16px | Section headings, Project and Resource card titles, note-rail titles |
| --hub-font-title | 1.65rem / 26.4px | Greeting and full Project/Resource page titles |

**Final Hub-controlled text scale: seven distinct sizes.**

## Semantic decisions

- Project and Resource cards share the heading size; activity and report item titles share the body size.
- Calendar dates and log dates share secondary sizing instead of being rounded independently.
- Search and creation fields share compact input sizing; filenames and task text use that same size.
- Home and Project/Resource report summaries share secondary sizing.
- Section headings no longer inherit the vault's 17px note-text size. The Progress scope control still inherits its own heading.
- Heatmap month labels use a Hub-scoped secondary size instead of a dependency's relative multiplier.
- Explicit sizes in the report/Focus/wizard/picker/audit UI use the same tokens.

## Intentional exclusions

- Native Obsidian dialog shells/headings and remaining theme-owned dialog text, native menus and tooltips retain their existing theme sizing. Changing the parent dialog font would also resize em-based headings; avoiding that preserves the native dialog hierarchy and identical Today/Next-day Focus titles.
- The existing Focus diamond stays 0.65rem and the Progress dropdown chevron stays 0.75em: these are decorative icons, not text roles.
- Heatmap cell font-size: 0 remains deliberate text hiding, not a visible type-scale entry.
- SVG dimensions and unused legacy dashboard snippet rules were not normalized. Native notes and unrelated Obsidian UI are outside this change.

## Verification

- Every current explicit font-size declaration in Home, Project/Resource, Daily and plugin styles maps to one of the seven tokens or the documented decorative/hidden exceptions.
- All existing non-font-size declarations were compared with the before-state: weights, colors, opacity, line heights, spacing, transitions and layout values were unchanged.
- Static token/count tests and plugin-load/dashboard-syntax checks passed.
- Browser computed-style checks cover Home, full Project/Resource views, note rail, Daily and report/Focus content. Checks include metadata/title hierarchy, seven computed text sizes, compact button dimensions/text fit, minimum-width Resource-card bounds, equal native Focus headings and unchanged controls outside Hub.
- The existing browser interaction suite also passed.
- Browser fixtures use actual Hub CSS with a minimal native-theme baseline. No running Obsidian instance was available for a live theme/render review.
