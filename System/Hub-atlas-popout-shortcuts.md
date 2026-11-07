# Atlas footer pop-outs

Implemented 2026-11-07. Restart Obsidian to load the rebuilt Hub plugin and the enabled Web viewer core plugin. No commit or push was made.

## Behavior and reused components

- Overleaf opens `https://www.overleaf.com` in a new Obsidian webviewer window.
- ChatGPT opens `https://chatgpt.com/` in a new Obsidian webviewer window.
- Google is now labeled Atlas and opens the existing `mountAtlasHome` homepage in a blank native webviewer window. Its saved `google` shortcut ID is retained so category selections and ordering survive without migration.
- Zotero retains its application launch behavior.

The existing Atlas renderer bridge creates a leaf with `workspace.getLeaf("window")` and sets the ordinary `webviewer` state. This is a [documented Obsidian API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) and was also inspected and exercised in the installed Obsidian 1.15.0 build. The original note is retained. Concurrent launches of the same destination share the pending operation; the footer ignores the second click of a double-click.

The same main-process Atlas host and vault browser partition protect the new windows. Existing enforcement starts guests blank, installs native Fetch interception before document loading, and submits navigation/redirect decisions to AtlasCore. Existing popup denial remains in force. Launching a shortcut makes no grant or policy change. Closing a window releases its view/document resources, while the shared controller and background processing remain alive.

AtlasCore, its policy semantics, and the native enforcement bundle are unchanged. Pop-out UI controls now recognize live native webviewer leaves in this workspace, allowing existing Access and Journey actions to reach the same authoritative host. Strict Oath's separate application controls remain in place; these web pop-outs are unavailable during Strict Oath.

## Files

- `.obsidian/plugins/hub-project-menu/lib/config.js`: destination/Atlas presentation and removal of obsolete Firefox executable configuration.
- `.obsidian/plugins/hub-project-menu/plugin.js`: web shortcuts route through Atlas; obsolete external Firefox launch branch removed.
- `.obsidian/plugins/hub-project-menu/lib/ui/app-shortcuts.js`: Atlas compass icon and duplicate-click handling.
- `.obsidian/plugins/hub-project-menu/lib/atlas/obsidian/integration.js`: native pop-out opening, failure cleanup, closed-document cleanup, and support for the installed webview's synchronous navigation method.
- `.obsidian/plugins/hub-project-menu/lib/atlas/obsidian/note-context.js`: live pop-out context eligibility and document listener disposal.
- `.obsidian/plugins/hub-project-menu/lib/atlas/tests/workflow.test.js` and `lib/tests/plugin-load.test.js`: eligibility and source/bundle shortcut regression checks.
- `.obsidian/plugins/hub-project-menu/lib/atlas/tests/native/popout-installed.cjs`: reproducible installed-Obsidian acceptance using an isolated temporary profile/vault and local HTTP fixtures.
- `.obsidian/plugins/hub-project-menu/main.js`: rebuilt runtime, retaining the earlier Tasks fix.
- `.obsidian/core-plugins.json`: enabled the previously disabled Web viewer prerequisite locally.

## Verification and limits

- Final focused run: **171 tests passed**, covering all 153 Atlas regression tests plus plugin loading/routing, browser layouts, and macOS checks.
- Broader Hub run: **96/97 passed**. The unchanged typography test rejects the unchanged `.hub-task-operation-status` use of `var(--font-ui-smaller)`; this pre-existing failure was left outside this task.
- Genuine installed Obsidian acceptance: **11 check groups passed**, including actual footer clicks, all three native windows, duplicate suppression, retained note, allowed document loading, denied popup creation, Blacklist redirect blocked before network delivery, bounded Journey redirect, Greylist blocking, explicit wait/confirmation followed by a fresh allowed homepage, and shared controller/policy/listener preservation after closing every pop-out.
- Evidence: `%TEMP%/hub-popout-installed-TQ83N6/result.json`. All acceptance state belongs to the temporary vault; personal policy and browser sessions were not used.
- `git diff --check` passes with the repository's CRLF-aware whitespace setting. AtlasCore and `atlas-native.cjs` have no changes.

Website destination routing was exercised in real Obsidian. Deterministic loading and authorization checks used local fixture sites. Signed-in Overleaf/ChatGPT sessions and real identity-provider authentication remain **unverified**. The adapter's existing popup/download restrictions and top-level document policy scope remain unchanged; popup-based authentication may therefore be unavailable. No external-browser fallback was introduced.
