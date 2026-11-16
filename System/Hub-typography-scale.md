# Itacan semantic typography — 12 November 2026

The original [typography audit](Hub-typography-audit.md) records the September before-state. This document describes the approved readability improvements and Stage 2 hierarchy refinements.

## Shared scale

Defined once in .obsidian/plugins/hub-project-menu/styles.css and scoped to Hub surfaces, Daily widgets and detached Project drag cards. Rem units preserve root-size/accessibility scaling; pixel equivalents below assume the existing 16px root.

| Token | Size | Roles |
| --- | --- | --- |
| --hub-font-meta | 0.66rem / 10.56px | Task dates/routes, History clocks, heatmap labels, shared-folder badges, Focus context labels, report scores |
| --hub-font-secondary | 0.72rem / 11.52px | Categories, log dates, muted report summaries, step counts, utility actions/log tabs, dense Calendar tasks |
| --hub-font-compact | 0.78rem / 12.48px | Step text, capture actions, navigation/shortcut buttons, Home summary, compact inputs and dense Schedule cards |
| --hub-font-body | 0.84rem / 13.44px | Primary task titles, current Files explorer names, context search, Calendar event titles, Focus content, Daily names, report definitions |
| --hub-font-subheading | 0.9rem / 14.4px | Small subheadings, emphasized Project/Resource labels in report editors |
| --hub-font-heading | 1rem / 16px | Section headings, Project and Resource card titles, note-rail titles |
| --hub-font-title | 1.65rem / 26.4px | Greeting and full Project/Resource page titles |

**Seven shared semantic sizes.** Native modal headings, native status feedback, and the Oath pledge also produce intentional values outside this scale.

## Semantic decisions

- Primary Home/Workspace task titles and the live Add/Edit editor share body size, weight 400 and line height 1.35. At a 16px root this is 13.44px / 18.144px. Shared ordinary task cards, including capture and Oath cards, follow this rule.
- Dates, routes, step text/counts, descriptions, importance controls and checkbox sizes retain their own roles. Dense Schedule cards remain compact / 1.4, and Calendar task labels remain secondary / 1.3.
- Date and information-icon alignment derives from the primary title's body-size / 1.35 first line. Editable titles and Steps retain the font/zoom-aware natural-height measurement introduced in Stage 1.
- Project cards retain heading / 700 / 1.3, subtitles secondary / 500 / 1.25, and Resource titles heading / 700 / 1.2. Three-line clamps and enlargement-responsive card sizing remain in place.
- Main panel headings use heading size / 700. Progress retains its intentionally compact 1em leading, while History is a nested subheading / 700.
- Home's compact / 600 description communicates daily status. Workspace's secondary / 600 description identifies a category or resource type. These distinct roles retain their existing sizes.
- Statistics card headings and native dialog subsections retain their contextual weights and sizes. They serve different roles from the dashboard's main panel headings.

## Window headings and document structure

- The shared window-title helper places only the title in a `--font-ui-medium` context. Native h2 font, size, weight, leading and tracking continue to come from Obsidian/the active theme. The measured native baseline is 21.93px / 680 / 26.316px. Supporting text and modal bodies keep their own font contexts.
- Feature windows using that helper include Add/Edit, Quick Add, Inbox, Settings, Daily Brief, Statistics, Oath, location pickers, preset prompts and planning editors. Direct native h2 picker/confirmation headings already inherit the native UI context. Small native date/time picker chrome and popover labels retain their utility hierarchy.
- Home and Workspace pages use h1. Major panels use native h2 text labels inside the existing containers. This keeps attached buttons outside heading names and avoids default native heading margins or styling.
- History retains its level-three ARIA heading. Schedule and Roadmap retain their level-two headings. Files uses a level-two label in the actual shared explorer. Heading changes are scoped to Itacan-owned UI.

## Intentional exclusions

- Native Obsidian menus, tooltips, modal bodies and user-authored Markdown retain their theme typography. The window title's native UI context is an explicit exception to the seven Hub sizes, as is `--font-ui-smaller` operation feedback.
- The Oath pledge retains italic 1.2rem / 1.6 Georgia. Atlas's main heading retains its editorial Georgia treatment.
- The existing Focus diamond stays 0.65rem and the Progress dropdown chevron stays 0.75em: these are decorative icons, not text roles.
- Heatmap cell font-size: 0 remains deliberate text hiding, not a visible type-scale entry.
- SVG dimensions and unused legacy dashboard snippet rules were not normalized. Native notes and unrelated Obsidian UI are outside this change.

## Verification

- `typography.test.js` verifies the seven token values and explicit native/decorative exceptions.
- `typography.html` / `typography-browser.js` exercise production card, task, window-title, History and explorer helpers, plus the Home heading helper. They check primary/dense title distinctions, modal context isolation, heading levels, contrast and responsive behavior.
- The browser regression supports both a portable host and installed Obsidian CSS supplied through `HUB_TEST_PREVIEW`. It covers dark/light themes, root text through 200%, CSS zoom, narrow containers, multiline labels and enlarged cards/editors.
- Stage 1 muted informational colors, full-opacity completed routes, wrapping capture actions and flexible card sizing remain covered by the regression.
- `unified-dashboard` verifies the 1700px canvas, 275px banner, 736px dashboard, 320/404px rows, 12px gaps and baseline card arrangements.
- Native editor alignment and Step interaction fixtures cover long titles, metadata, completion, keyboard/pointer operations and narrow windows. Their bootstrap references use the current editor module, and pointer drag coordinates are measured after reorder animation settles.
- Verification uses isolated browsers and the installed native stylesheet. Live Obsidian zoom and physical monitor scaling require separate manual review.
