# Completed Add/Edit title strikethrough — 2026-10-15

Fixed and installed for review. Obsidian was not reloaded or restarted.

## Root cause

The shared card already applied `is-completed` correctly from the pending draft. Its visible title is `.project-task-text`; the actual editable control is the existing native `textarea.hub-task-card-edit-input`, which uses `text-decoration: inherit`.

The completed-title decoration was supplied by `System/Dashboards/Project/view.css`, rather than the plugin stylesheet. That dashboard stylesheet is not reliably present when an ordinary Add/Edit modal opens, including from another dashboard context. The plugin's only completed-title rule changed the title color on hover; it did not establish strikethrough.

The previous browser fixtures linked both Home and Project dashboard styles globally. This supplied the missing rule and masked the modal's stylesheet dependency. A new fixture deliberately loads the plugin and native Obsidian styles without either dashboard stylesheet. Before the fix, both the blurred title and actively edited native textarea render without any stroke. The title and textarea compute `text-decoration-line: none`, despite the completed checkbox/card state.

## Correction

One existing rule in `styles.css` now applies the established completed-title convention directly inside the ordinary live modal:

```css
.modal.hub-task-live-dialog .project-task-row.is-completed .project-task-text {
    color: var(--text-muted);
    text-decoration: line-through;
}
```

The real native textarea inherits this decoration through its existing style. Chromium demonstrably paints it, so no alternative title renderer, overlay, duplicate element, DOM change or JavaScript state was needed. Both Add and Edit already share the same live form and completed-state class. Toggling completion, initial completed Edit, blur/focus, typing and rerendering therefore use the same correction.

The rule targets the title host alone. Location, dates, Phase, Importance, Steps, Description and configuration actions remain outside it. Ordinary Tasks-panel styling, pending draft semantics, timestamps, identity, history, stored text and Markdown remain unchanged.

## Actual rendered evidence

The fixture captures real Chromium screenshots of the actual title control. For each state, it compares the title crop against another capture of the **same state and color**, with only the title/textarea decoration temporarily suppressed. The blinking caret is hidden only during these paired comparisons. Separate captures show the genuine caret and native text selection.

| State | Desktop changed pixels / stroke bands | Narrow at 150% changed pixels / stroke bands |
| --- | ---: | ---: |
| Before fix: checked, actively edited Add title | 0 / 0 | 0 / 0 |
| Fixed: checked, actively edited Add title | 123 / 1 | 173 / 1 |
| Fixed: Add after unchecking | 0 / 0 | 0 / 0 |
| Fixed: initially completed Edit title | 122 / 1 | 171 / 1 |
| Fixed: Edit after unchecking | 0 / 0 | 0 / 0 |
| Fixed: long wrapped completed native title | 1,686 / 5 | 2,452 / 10 |

The snapshots were visually inspected, including Add with an active caret, native selection across completed text, initially completed Edit, and the narrow long title. The line visibly crosses the title glyphs and each wrapped line. Computed styles are supplementary evidence, not the pass criterion.

## Verification results

All selected checks pass at **1100×850 desktop** and **360×640 with 1.5 device scale**, except the modal-regions suite, which was run at desktop only.

- **43 new focused checks per layout:** trusted immediate Add typing and first checkbox click, unchecked/checked/rechecked raster appearance, active native editing, extension, selection/focus preservation, IME Enter guard, timestamps, title-only scope, parent Cancel, completed/incomplete Edit opening, Save/reopen, exact stored text, metadata/Step independence and natural wrapping.
- **25 browser fixture/layout runs pass:** the focused suite; shared task-card parity (1,942 desktop / 1,938 narrow); opening stability (3,829/layout); autofocus (472/layout); card/Step correction (479/layout); integrated Steps (166/layout); inline accordion/native editing and persistence (905/layout); specification indicators (420/layout); layout (170/layout); workflows (64/layout); Step progress; prior configuration polish (111/layout); and desktop modal regions (176).
- **15 Node suites pass:** task-form, task-compact-form, task-layout-polish, task-created-completion, task-progress, task-history, task-mutations, task-workspace, task-data, task-creation-retry, task-planning, typography, project-planning, inbox and icons. These retain completion/uncompletion, timestamps, task identities, history/statistics, Save/Cancel and rollback/retry coverage.
- No existing assertions were changed or weakened.
- Staged build: **150 main modules and 24 native modules**. Syntax and stubbed Obsidian plugin-loading checks pass. Scoped whitespace checks pass.

Tests use isolated Chromium (Microsoft Edge), the installed Obsidian stylesheet/fonts and synthetic services/vaults. Live Obsidian review remains with the user; no real task data was changed and no reload was triggered.

## Modified files and installation

Production change: `.obsidian/plugins/hub-project-menu/styles.css` only, replacing the hover-only completed-title color rule with the completed-title color/decoration rule above and its explanatory comment.

New files: `lib/tests/task-title-strikethrough.html` and this verification report. The shared renderer and live-form JavaScript were inspected and backed up but did not require edits.

The installed stylesheet matches the verified staged stylesheet byte for byte. Generated `main.js`, `atlas-native.cjs` and the strict-assets manifest are byte-identical to their pre-change backups and were not rewritten. Unrelated repository changes were preserved.

## Backups and screenshots

Vault-relative evidence root: `System/Backups/task-title-strikethrough-20261015/`.

- `source/`: original stylesheet, inspected renderer/live-form sources and the original test directory.
- `installed/`: original installed CSS, main/native bundles and manifests.
- `staged/`: verified build, CSS and manifest.
- `installed-hashes.json`, `install.log`, `staged-load.log`: installation/loading evidence.
- Per-suite logs, Node results and before/after repository status snapshots are at the evidence root.
- `evidence/desktop-task-title-strikethrough-frames.json` and `evidence/small-150-task-title-strikethrough-frames.json`: final pixel metrics and native-control state.
- `evidence/before-desktop.json` and `evidence/before-small-150.json`: original missing-stroke measurements.

Representative PNG files inside `evidence/`:

- Before: `hub-title-strike-before-desktop-add-checked-editing.png`
- Before: `hub-title-strike-before-small-150-add-checked-editing.png`
- After unchecked: `hub-title-strike-after-desktop-add-unchecked-editing.png`
- After checked/blurred: `hub-title-strike-after-desktop-add-checked-blurred.png`
- After checked/editing with caret: `hub-title-strike-after-desktop-add-checked-editing-caret.png`
- After native selection: `hub-title-strike-after-small-150-add-checked-native-selection.png`
- Edit opening completed: `hub-title-strike-after-small-150-edit-initial-completed.png`
- Edit unchecked/rechecked: `hub-title-strike-after-desktop-edit-unchecked.png`, `hub-title-strike-after-desktop-edit-rechecked.png`
- Save/reopen: `hub-title-strike-after-desktop-edit-reopened-completed.png`
- Long native title: `hub-title-strike-after-small-150-edit-long-wrapped-completed.png`

Matching no-line reference captures and all other tested states are retained alongside these screenshots.
