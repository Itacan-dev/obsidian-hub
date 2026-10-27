# Atlas pane resizing and document lifecycle reliability

Date: 2026-10-27. Baseline: `f2eeb0c`. The user reports that dragging the divider between panes can block ChatGPT despite Whitelist access.

## Confirmed facts

A narrowly scoped read of the local saved policy confirmed both `chatgpt.com` and `www.chatgpt.com` are Whitelisted and neither is Blacklisted. No policy or live authority record was modified.

The screenshots show two separate misleading outcomes: a stopped browser described as an access-rule denial, and an expired saved grant described as “usable now.” The screenshot does not expose the original native failure code, so it cannot establish that every reported live failure has the same cause.

## Reproduced native race

An isolated Electron probe used actual webviews, a local test server and the real filesystem repository. Ordinary resizing of a plain loaded page passed before the fix.

A responsive test page used `history.replaceState` during its initial load and resize handling. The test delayed the acknowledgement of an actual persisted ARRIVAL transition. Under that controlled latency, the old native `did-navigate-in-page` handler received the browser's URL change while `context.displayed` was still null, even though an authorized released flight existed. It closed the guest with `UNEXPECTED_URL_CHANGE`.

This is a document-correlation failure, not evidence of a missing Whitelist entry. No real disk slowdown, authenticated ChatGPT session or specific GPU failure was established.

The formal native regression now holds an actual arrival acknowledgement while sending mouse-down/move/up events to a pane divider around a responsive webview. It verifies that the page stays open, retains its exact native document identity, and becomes DISPLAYED only after acknowledgement. The same controlled responsive probe that previously blocked now passes.

## Changes

### Bind same-document changes to their actual browser document

`webviewer.js` now uses the ordered native Page protocol stream for both full-document and same-document changes. The last main-frame commit supplies its loader identity; `runtime.sameDocument` accepts only an exact currently released-flight or displayed-document loader and the same hostname.

A URL change during an unacknowledged arrival is buffered with that exact flight. It cannot adopt/display the document, create a Journey, renew a grant or bypass Core. After Core validates and acknowledges the original correlated arrival, the displayed browser URL is updated to the latest native same-document URL.

The old and pending documents keep distinct loader/URL identities. Root-departure correlation continues to use the actual current source URL. Unknown loaders, changed hosts, unsupported schemes and closed contexts remain rejected. Full arrivals still require their original correlation proof; buffering a URL cannot substitute for that proof.

The native guard retains only a sanitized origin for a deliberate fresh-home retry after a browser failure. Reading this optional routing information cannot prevent mandatory closure. It never preserves/replays a private path, request body or authentication Journey.

### Show actual grant state

A shared presentation helper now distinguishes effective `ACTIVE_GRANT` access from an `ALLOW / WHITELISTED` description. It also requires the original deadline, current policy revision and available authority.

Settings no longer labels an expired grant “usable now,” including when a cached native description has not yet been republished. It explains when the host is independently Whitelisted and hides the misleading expired countdown. Diagnostics count active temporary grants rather than all ALLOW descriptions.

The existing local Settings timer observes grant phase boundaries. Home removes expired temporary rows using its existing timer, without rebuilding destination cards or issuing authorization commands. Original persisted grant terms remain unchanged.

### Explain browser failures accurately

Native interception, correlation and renderer failures are described as interrupted browser connections rather than Whitelist denials. A collapsed “Why this tab stopped” disclosure exposes only the safe reason code.

An owned Note tab can explicitly select “Open homepage again.” This starts a fresh homepage through the existing native gate; it does not automatically continue an old navigation or grant access. Settings also stops claiming a known ALLOW destination needs a grant merely because its Note controls are currently unavailable.

### Ship the implementation that was tested

Renderer/native compatibility advances to API 7 so a retained older main-process service cannot silently keep the faulty handler. A full Obsidian quit/reopen is required.

Both runnable bundles have been rebuilt locally under the user's existing bundle-update authorization. Two independent builds match, and the bundle/source parity check passes: 274 renderer modules and 27 native modules. No commit or push was performed in this task.

## Verification

All fault injection, browser actions and writes in tests used isolated temporary profiles and repositories.

| Command | Result |
| --- | --- |
| `node --test .obsidian/plugins/hub-project-menu/lib/atlas/tests/*.test.js` | 152 passed, 0 failed/skipped |
| `node --test .obsidian/plugins/hub-project-menu/lib/atlas/tests/document-lifecycle.test.js` | 6 new document/expiry regressions passed |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/browser-launch.cjs` | 9 fixture pages passed |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/launch.cjs` | 26 native scenarios passed |
| Adapter TypeScript check and `npm.cmd --prefix AtlasCore/packages/core run typecheck` | Passed |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/check-runtime-bundles.cjs` | Passed |
| Git whitespace check with `core.whitespace=cr-at-eol` | Passed |

The new Node regressions cover withheld arrival acknowledgement, exact loader separation, rejected mismatched full arrivals, preserved grant expiry and correct temporary-access classification. The new browser fixture tests expiry without native publication, unchanged grant terms, stable rows, independent Whitelist access, safe native reasons, explicit retry fields, Blacklist denial and Note ownership explanations.

The native regression exercises responsive URL changes and real divider mouse events during withheld persistence acknowledgement. Existing popup/download, native interception, expiry, redirect/Journey, storage recovery, ownership repair and renderer lifecycle checks remain passing.

[Machine-readable evidence](../.obsidian/plugins/hub-project-menu/lib/atlas/tests/document-lifecycle-results.json) records the controlled before/after result, actual validation counts and runnable bundle hashes.

## Changed files

Plugin paths are relative to `.obsidian/plugins/hub-project-menu/`.

- `lib/atlas/obsidian/webviewer.js`, `runtime.js`: native document correlation and sanitized retry origin.
- `lib/atlas/obsidian/pending.js`, `settings-ui.js`, `home-ui.js`: truthful grant classification and expiry.
- `lib/atlas/obsidian/ui.js`: browser-failure explanation, safe reason disclosure and explicit fresh-home action.
- `lib/atlas/obsidian/native.js`, `integration.js`: API 7 compatibility.
- `lib/atlas/tests/document-lifecycle.test.js`: new regressions.
- `lib/tests/atlas-lifecycle.html`, `lib/atlas/tests/native/browser-runner.cjs`: new browser fixture included by default.
- `lib/atlas/tests/native/runner.cjs`, `launch.cjs`, `renderer-fixture.cjs`: responsive divider regression and retained-version rejection.
- `lib/atlas/tests/document-lifecycle-results.json`: evidence.
- `main.js`, `atlas-native.cjs`: updated runnable bundles.

Core policy semantics, presets, exact-host scope, saved settings, grant deadlines and live authority files were not changed. The user's authenticated ChatGPT page was not instrumented, and the controlled reproduction does not prove that no other pane/browser failure exists. The improved native reason disclosure makes any remaining failure distinguishable from a policy denial.
