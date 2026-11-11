# Inbox selection and bulk-panel verification

2026-11-10. All writes and process restarts used disposable vaults and profiles.

## Scope

- `lib/ui/inbox.js`: explorer-style click and keyboard selection, visible row icons, selection anchor and scroll restoration, and shared attachment rows in the bulk panel.
- `lib/domain/inbox-selection.js`: display-ordered selection and flattened, deduplicated attachment references. No persistence or destination effects.
- `styles.css`: removed checkbox overlays; natural file-list growth with internal scrolling and a separate action button; centered bulk-text actions.
- `lib/tests/inbox-selection.test.cjs`: focused selection, eligibility, sort-order, anchor, shared-reference, and immutability coverage.
- `lib/tests/capture-obsidian-fixture.cjs`, `capture-obsidian-host.cjs`, and `run-capture-obsidian-test.cjs`: updated bulk scenarios and added selection/layout coverage, including native modifier input.
- `main.js`: rebuilt bundle, installed after acceptance.

The existing bulk coordinator, creation services, private Inbox envelope, native task backend, location pickers, and Quick Add modules are unchanged. Compared with the pre-change installed bundle, only the existing Inbox UI factory changed and the selection helper was added.

## Verification

- 117 Node runner tests passed: capture and bulk recovery, native application/defaults/editor behavior, Markdown insertion, storage, icons, plugin loading, and 13 new selection tests.
- Disposable Obsidian selection phase: 100 assertions passed in light and dark themes. Ordinary/Ctrl/Shift/Ctrl+Shift clicks, all sorts, exclusions, filter transitions, keyboard ranges, native Ctrl+Space, native Ctrl-click, and End scrolling were exercised.
- Two-, three-, and eighteen-file layouts were measured at 1100px and 380px window widths. Attachment ordering, shared-reference deduplication, legacy groups, growing lists, consistent gaps, internal scrolling, stationary action buttons, and footer separation passed. Screenshots were inspected.
- Picker cancellation restored selected IDs, display order, range anchor, left-list scroll, and attachment-list scroll.
- Existing bulk acceptance: 45 assertions passed across processing and restart phases, including failed edit checkpoints, exact note content, native task partial failure and retry identity, consecutive processing, legacy file placement, and combined-append cleanup replay after process restart.
- Existing regressions: 82 opening assertions plus 18 first-frame observations, 130 Inbox polish assertions, and 175 capture/restart assertions passed. Total: 532 UI assertions plus 18 frame observations.
- Installation: candidate `main.js` copied to the installed plugin after acceptance; SHA-256 equality and all 8 installed-plugin load tests passed. Whitespace checks passed.

Final disposable-vault evidence (under `%TEMP%`): selection `hub-capture-runtime-p4wcX8`, bulk/restart `hub-capture-runtime-xkpR5d`, initialization `hub-capture-runtime-ZY0GTa`, polish `hub-capture-runtime-rgMOT6`, capture/restart `hub-capture-runtime-5sJdFk`. Each contains its isolated vault/profile, assertion report, and applicable screenshots.

Reproduction from the vault root:

```powershell
node --test .obsidian/plugins/hub-project-menu/lib/tests/inbox-selection.test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/run-capture-obsidian-test.cjs <candidate-directory> selection
node .obsidian/plugins/hub-project-menu/lib/tests/run-capture-obsidian-test.cjs <candidate-directory> bulk
node .obsidian/plugins/hub-project-menu/lib/tests/run-capture-obsidian-test.cjs <candidate-directory> initialization
node .obsidian/plugins/hub-project-menu/lib/tests/run-capture-obsidian-test.cjs <candidate-directory> polish
node .obsidian/plugins/hub-project-menu/lib/tests/run-capture-obsidian-test.cjs <candidate-directory>
```

Build and pre-change backup: `%TEMP%/itacan-inbox-selection-Hoz84G`.

User data and unrelated working-tree changes were preserved. No live-vault restart, commit, push, or merge was performed.
