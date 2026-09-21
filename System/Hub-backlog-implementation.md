# Hub backlog implementation — 5 September 2026

Implemented the backlog in attachment d3f04bad-b4fb-4b3f-93f8-43fad0977118. Calendar implementation and typography normalization were excluded as requested. Existing shared dark button colors were preserved.

## Order and rationale

1. Contextual navigation/layout persistence: establish shared ownership and native opening rules first.
2. Folder and card interactions: build selection, keyboard, middle-click, creation and status handling on that foundation.
3. Shared tooltips/header-image editor: implement reusable lifecycle and persistence once for all views.
4. Resource/Focus/task/report changes: reuse existing context IDs, canonical status changes and the atomic store.
5. Note migration: inspect format, copy, verify, then remove verified sources.
6. Regression review and typography audit: test, rebuild and document live-app limitations.

## What changed

### Navigation and folders

- Home Last File uses the global last file; Project/Resource Last File uses that context.
- Version-3 workspace state saves native tab/split trees per context, including active pane and ratios. Device-local layout memory survives reload/restart without syncing window geometry as Hub business data.
- Last File restores the context layout. Normal opening from its full page replaces old split memory; middle-click restores/appends a right split.
- Missing files are pruned while preserving surviving active tabs; a deleted last file can fall back to another saved context note.
- A shared Resource file opened from a Project keeps that Project's rail, including shared folders.
- Native Obsidian drag descriptors enable tab/split docking; existing internal folder moves remain.
- Markdown notes open in editable Live Preview; Hub dashboards remain in reading view.
- Rail outer horizontal padding is 6px; existing inner wrapper padding remains 0.
- Purple multi-selection, Ctrl/Cmd/Shift, ordinary-click dismissal, arrows/Home/End, Space, Enter, Escape, select-all and native-trash Delete share one state. Keyboard traversal skips hidden rows.
- Folder creation commits on blur with duplicate-submit guards and empty/invalid handling. Inline X is square. Middle-click suppresses Windows autoscroll.

### Cards, tooltips, tasks and reports

- Dragged Project cards use a temporary fixed-position body-level copy, escaping rail clipping. Drop/cancel/view cleanup restores the original and removes the copy.
- Future projects cannot open before Active. Shelved opening offers an Obsidian Activate project / Cancel modal; activation uses canonical setStatus before opening. Context menus remain independent. Shelved images are grayscale.
- Shared tooltip conversion removes native title attributes and uses Obsidian aria-label tooltips. Navigation, heatmaps, creation + and report rating controls use the same mechanism.
- Tasks Clear remains visible but disabled when irrelevant; task locations are faint. Tasks panels have no separate Refresh.
- Completed tasks use square-check; report clipboard icons align with titles.
- Score 0 clears the summary input/draft. Completed-task history includes active Projects and Resource entries, excluding inactive/deleted Projects.
- All nine greeting variants omit “today”; underlying task/event counting is unchanged.

### Header-image placement

- One shared editor serves Home, Project and Resource headers.
- Right-click → Edit image placement enables drag pan and cursor-anchored wheel zoom in the fixed rectangle, limited to 1–3×.
- Done saves; Cancel/Escape restores. Wheel scrolling stays native outside editing mode.
- Normalized position/zoom is stored through the existing atomic data store, keyed by context plus actual image path.
- Component-owned observers, events, frames and controls are cleaned up on remount/unload.

### Resources and Focus

- References is now Explorations, including its folder/dashboard path and displayed labels.
- Persisted ID references is deliberately retained for existing folder selections, reports, activity and Focus. Legacy paths/labels are migrated instead of creating a second Resource.
- Home order: Knowledge → Literature → Explorations → Inspiration.
- Exact requested subtitles live in the Resource definitions.
- Resource titles are centered in their text area; Resources and Projects headings both use 1rem.
- Today/next-day/report Focus editors use the same active-Project-plus-Resource list and existing record shape.

### Migration

- 10 Concepts notes → Resources/Knowledge/Concepts.
- 3 Literature Notes → Resources/Literature/Literature Notes.
- 7 old bibliographic References notes → Resources/Literature/Sources.
- Every file was copied and SHA256-verified before removing its old copy. Final verification confirmed all 20 destination checksums and no duplicate sources.
- Plain Resource notes require no additional frontmatter; folder ownership supplies the context. Contents and basenames, including an intentionally empty note, were preserved.
- No explicit old-source Markdown links were found. Unrelated old notes, attachments, templates and empty legacy folders were left alone.
- Files can be moved back using the [source/destination manifest](Migrations/resource-notes-2026-09-05.json).

## Architecture

New modules:

- lib/domain/navigation.js: native snapshot validation/pruning and path rewriting.
- lib/ui/tooltips.js: one tooltip mechanism with component-scoped conversion.
- lib/ui/header-image.js: shared pan/zoom geometry and editing lifecycle.

The existing workspace-mode service coordinates navigation; the existing Project service supplies both Project and Resource contexts. The atomic store persists image settings and Resource migrations. No parallel Resource-only Focus/report state was created. main.js is rebuilt from source modules with no runtime relative-require dependencies.

## Verification results

- Bundle built successfully with 18 modules.
- Domain tests passed.
- Plugin-load checks passed, including generated-bundle loading and Home/Project script syntax.
- Atomic data-store integration tests passed.
- Backlog regression tests passed, including all nine greeting variants.
- Headless Chromium checks passed using real Hub styles and real extracted selection/card-drag handlers with in-memory service stubs.
- All 20 migrated-note checksums passed.

### Requested flow review

| Flow | Evidence |
| --- | --- |
| 1. Active/Future/Shelved opening | Automated opening-policy tests and entry-point review. |
| 2. Shelved → Activate → open | Cancel/activation tests; canonical status/navigation sequence reviewed. |
| 3. Inactive-card right-click | Independent contextmenu dispatch reviewed; opening guard does not intercept it. |
| 4. Card drag stacking | Browser checked fixed body-level copy, drag-only z-index and cleanup. |
| 5. Selection/outside click/Delete | Browser exercised real multi-selection, dismissal, arrow focus and native-trash dispatch. |
| 6. Normal/middle-click | Automated replacement/append dispatch; auxclick and autoscroll prevention reviewed. |
| 7. Shared Resource file in Project | Automated source ownership and opening dispatch. |
| 8. Project Last File | Automated per-Project/global history distinctions. |
| 9. Resource Last File | Automated per-Resource history resolution. |
| 10. Layout restore/replace | Native-tree, missing-file, selected-tab, active-pane, sidebar-preservation and replacement tests. |
| 11. Header image persistence | Browser pan/zoom/Done/saved-value remount/Cancel/cleanup; atomic persistence wiring reviewed. |
| 12. Folder creation on blur | Creation path, reentrancy, blank/invalid handling and cancel's blur prevention reviewed. |
| 13. Tooltips | Browser title-removal/single-label check; navigation/+/heatmap wiring reviewed. |
| 14. Resource definitions/rename | Automated order/stable-ID tests; subtitles/routes/startup migration reviewed. |
| 15. Old-note migration | All 20 exact checksums and absent source files verified. |
| 16. Tasks/reports/history | Automated filtering/zero-summary tests; browser Clear/icon checks; rendering reviewed. |
| 17. Resource Focus | Automated validation/context eligibility; all three editor entry points reviewed. |
| 18. Greeting | Nine combinations checked against the actual Home formatter. |

## Limitations

No running Obsidian process was available. This is automated testing and code-flow review, not live mouse testing in Obsidian. Native drag-manager and layout APIs were inspected in the installed Obsidian 1.13.7 runtime.

After reloading Obsidian, live-smoke-test native docking, multi-pane restoration and image placement persistence across a restart. These native APIs depend on Obsidian's implementation; layout validation and ordinary-file fallback keep that dependency localized.

No implementation tasks were intentionally omitted beyond the requested Calendar and typography-normalization exclusions.

## Typography audit

[Full size → component audit](Hub-typography-audit.md): 88 authored declarations / 28 unique CSS values. At the current default root/theme tokens, there are 24 explicitly sized text groups, plus icon/hidden values and theme/dependency-inherited sizes. The audit groups identical sizes and documents those distinctions.
