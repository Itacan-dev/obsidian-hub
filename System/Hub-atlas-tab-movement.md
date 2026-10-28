# Atlas same-window tab movement

Date: 2026-10-28. Baseline: 50f9540. Scope: dragging webviewer tabs between panes/tab groups in the same Obsidian window and resizing their panes.

## Cause

The installed Obsidian 1.14.5 tab-group implementation detaches the leaf container before inserting it in its destination. An Electron webview below that container loses its native browser when disconnected. Atlas then correctly retires the lost browser context; the fresh Whitelist assessment describes access as available, but it cannot restore the destroyed browser document. This produces the reported fresh-home interstitial despite an unchanged Whitelist.

Isolated Electron 39 / Chromium 142 probes reproduced native guest destruction for ordinary DOM reparenting and Element.moveBefore. A root-page reload would discard the current conversation path and unsent input, so it does not address the reported behavior.

## Change

A per-document surface manager mounts each matching vault-partition webviewer guest into a stable body-level surface before its first native attachment. The original content contains a flex slot. Moving that slot and its owning leaf changes only the surface geometry; the native browser, context and document stay connected. The manager does not authorize, navigate, reload or replay requests.

The surface follows the pane bounds, clipping and visibility; reserves the Atlas status strip; hides for inactive, blocked, reader, internal-home and temporarily disconnected views; and respects host modals and pointer/drag interactions. Mutation delivery hides every affected surface even when animation frames are paused. Resize/mutation/scroll events coalesce geometry work without a polling loop or perpetual animation loop. True leaf closure disposes the surface and its native guest.

The integration retires records on actual workspace removal rather than a temporary DOM disconnect. A changed native ID clears the cached context, preventing stale binding reuse.

Movement within one owner document preserves the existing browser. Cross-window/document adoption retires the old guest; this change does not promise live browser transfer between windows. Native interception, Journey correlation, explicit access confirmation, grant deadlines, fail-closed behavior and saved policy remain unchanged. Native API remains 7.

## Verification

All browser tests use isolated local profiles, servers and authority repositories. No live Atlas authority, policy, cookies or saved user content was reset or edited. An authenticated provider session was not used.

| Check | Result |
| --- | --- |
| Atlas Node behavior/storage suite | 152 passed, 0 failed/skipped |
| Browser fixtures | 10 passed, including new surface lifecycle fixture |
| Native Electron suite | 26 passed, including expanded renderer movement and expiry checks |
| Adapter checkJs and Core TypeScript noEmit | Passed |
| Two independent builds | Byte-identical renderer/native outputs |

The native movement regression verifies six repeated split/tab-group moves, a 750 ms disconnected leaf, inactive-tab hiding, modal hit testing, geometry and real closure. It asserts the same DOM guest, native webContents ID, Atlas context ID and generation, exact deep URL, unsent text, selection, scroll position and JavaScript marker. It observes no replacement navigation, native destruction or visible access interstitial during movement.

A second native regression explicitly requests and confirms Greylist access once, moves the granted page four times without renewing its request or deadline, and leaves the slot detached through expiry. The native context still closes at its original deadline; unrelated guests and a new guest after expiry cannot borrow access. Policy/configuration and frozen grant terms remain unchanged.

The browser fixture additionally checks exact partition scope, append/insert behavior, duplicate mounts, hidden/reader/blocked/inactive states, clipping/status geometry, modal layering, pointer and drag restoration, simultaneous pane hiding without animation frames, cross-document retirement and complete observer/prototype disposal.

## Runnable outputs

Both runnable bundles were rebuilt locally under the user's existing authorization. The native output is byte-identical to the baseline because this fix changes renderer presentation and lifecycle handling only. Quit and reopen Obsidian to load the renderer bundle and create the stable surfaces before guests attach.

| File | SHA-256 |
| --- | --- |
| main.js | 7b27eb4388bb21280c934af7dfca7db27931a3e2cec9b725d39963fa2590edba |
| atlas-native.cjs | f85bcd223f2ef6f618552ab4f9744a1cc82bd480d6778c89cee1a3a8fa1c5f66 |

No commit or push was performed for this change.
