# Add/Edit spacing above Steps — 2026-11-06

Implemented in the installed `styles.css`. No JavaScript, Tasks panel, location picker, persistence, or internal Steps rules were changed. The running Obsidian session was not reloaded.

## Cause and adjustment

The generic `.project-task-row` rule supplies `gap: 9px`. After the checklist moved into the card's second grid row, that shorthand added a 9px row gap on top of the existing Steps margin. The panels already set their outer row gap to zero.

The new dialog-only selector sets `row-gap: 0` on Add/Edit task rows containing the checklist. The existing `--size-4-1` margin remains responsible for separation above Steps. Empty Add steps, collapsed headings, expanded lists, and pending drafts all use the same rule.

Measured CSS pixels in Add and Edit, both collapsed and expanded:

| Measurement | Before | After |
| --- | ---: | ---: |
| Location/information bottom to Steps heading box | 13 | 4 |
| Outer grid row gap | 9 | 0 |
| Task rectangle height reduction | — | 9 |

The resulting 4px separation matches the actual Tasks panel reference. Parent content retains its position within the card. Heading/row/Add-step geometry within the Steps section, horizontal positions, guide appearance and offsets, progress color, and card padding/background/border/radius are unchanged. The rectangle shrinks naturally without fixed heights or compensating space.

## Verification

- New `task-editor-step-spacing.html`: **3,037 rendered checks per viewport**, passing at 1100×900/DPR 1 and 390×720/DPR 1.5. It toggles only the new CSS declaration to compare old/new geometry. Coverage includes Add/Edit; no Steps, one and multiple Steps; empty/collapsed/expanded/pending states; workspace-root/folder/note labels; dates/importance on and off; wrapping; unchanged parent/internal geometry and panel rendering.
- Existing Add/Edit interaction regression: **281 checks passed**, including hover/focus controls, keyboard/pointer reordering, touch deletion, completion, editing, pending drafts, Save/reopen and Cancel.
- Existing panel alignment regression: **4,559 checks passed** across Home, Project and Resource, including unchanged compact styling and parent geometry.
- **42 Node regression tests passed** across native engine/application/presentation, location formatting and date presentation; strict/noEmit TypeScript task-contract check passed.
- CRLF-aware stylesheet whitespace check passed. No JavaScript rebuild was needed; installed `main.js` remains SHA-256 `c952f548b389875f6c98030333599622db547d1bfd2475d6e057854daec47f35`.

Visual verification used actual UI modules/native CSS with a **mocked Obsidian API/Markdown host**, not the running application. Desktop and narrow screenshots were inspected.

Run from the plugin directory with `HUB_TEST_PREVIEW` set to an extracted native stylesheet's file URL:

```text
node lib/tests/run-browser-test.js task-editor-step-spacing 1100x900
node lib/tests/task-editor-step-context.cjs
node lib/tests/run-browser-test.js task-panel-step-alignment 1100x900
```

Spacing evidence: `%TEMP%/hub-task-editor-step-spacing-frames.json`, `%TEMP%/hub-editor-step-spacing-{add,edit}.png`. Interaction evidence: `%TEMP%/itacan-step-context-jooQV1/`. Earlier checkout changes were preserved.
