# Atlas in the Obsidian webviewer

Integration design recorded before implementation and updated after verification,
2026-10-05. The copied Core
source, tests and current D18/D19/D22/D25 contracts govern authorization. Earlier
Firefox milestones describe historical scope, not APIs to copy into Obsidian.

```text
AtlasCore/packages/core/src/                 framework independent, unchanged
├── target, policy, evaluate                 exact-host classification
├── access, access-state                     requests, waits, grants, replay guards
├── vault, configuration                     frozen policy/settings proposals
├── journey, journey-state                   bounded, context-owned continuation
└── atlas-planner, atlas-controller           complete validation and commit owner

.obsidian/plugins/hub-project-menu/
├── lib/atlas/core/                          generated CommonJS from Core source
├── lib/atlas/obsidian/
│   ├── persistence.js                      exclusive filesystem repository
│   ├── clock.js                            real clock injected into Core
│   ├── runtime.js                          one controller and navigation ledger
│   ├── webviewer.js                        Electron main-process interception
│   ├── native.js                           one host per vault/session
│   ├── integration.js                      trusted Obsidian renderer bridge
│   └── ui.js                               blocked access, overview and Vault
├── atlas-native.cjs                         generated main-process entry
└── plugin.js → main.js                      installs bridge at plugin startup

Obsidian native webviewer (installed 1.13.7)
├── setViewState / navigate / loadURL         typed URL, notes, bookmarks, restoration
├── leaf.history                            Obsidian Back/Forward
├── Electron <webview> / WebContents          Chromium documents and native events
└── persist:vault-<appId>                     shared native browser session
```

| Component | Owns / stored state | Calls | Called by | Authority |
| --- | --- | --- | --- | --- |
| Core | Policy, revisions, protected configuration, Access/Vault/Journey snapshots, counters and time checkpoints | Injected repository and clock | Runtime only | Domain authority, after a verified save |
| Main-process runtime | One Core controller, queue, fresh context identities, held request/arrival correlations, saved assessments | Core operations and browser effects | Native guard and private UI bridge | Controller snapshot is authoritative; browser ledger is transient |
| Repository | Complete versioned envelope, initialization sentinel, commit journal, exclusive process lock | Filesystem only | Controller; explicit first setup | Durable authority; no policy decisions |
| Clock | Wall-clock observation and elapsed-time floor for this process | Date/performance clock | Controller and execution veto | Time input; never confirmation |
| Webviewer guard | Native handles, debugger readiness, request IDs, frame IDs, initiating-frame evidence, expiry watchdogs | Runtime, Electron/CDP | Native Electron events | Browser facts; never stored policy |
| Renderer bridge | View/guest association, subscription and DOM lifecycle | Narrow host methods | Plugin, native view lifecycle, UI | Derived; no independent controller |
| UI | Editable drafts, displayed deadlines/reasons, selected context, busy state | Closed explicit host commands | Obsidian settings, ribbon, blocked viewer | Presentation only |
| Native Obsidian viewer | Actual URL/document, title, reader mode, leaf history and layout | Electron guest APIs | Obsidian and notes | Browser state, not Atlas permission |

## Observed platform boundary

This repository is an Obsidian vault and CommonJS community plugin, not an
Electron application with its own bootstrap. Hub's existing navigation and
presets preserve native `webviewer` leaves; they do not create browser controls.
Inspection of the installed `obsidian-1.13.7.asar/app.js` establishes:

- `instantiateWebView` creates an Electron `<webview>` in the vault partition.
- `navigate` uses `webview.loadURL`; reload calls `webview.reload` directly.
- Native address suggestions, note/open-url events, CLI, bookmarks, reader-mode
  links and context menus can call `setViewState`, including tab/split/window.
- Back/Forward use Obsidian's leaf history and restore state through `navigate`.
- Native renderer `did-start-navigation` and redirect events are observations.
  `configureWebContents` itself runs only after initial load.
- Canvas also creates guests in this same partition; it must receive the same
  guard rather than accidentally becoming an alternative unrestricted browser.
- Desktop already uses `electron.remote.require` for Hub's Oath guard. That
  mechanism loads the generated Atlas entry into Electron's main process.
- The inspected app startup awaits community-plugin initialization before
  vault/cache initialization and workspace `loadLayout`. Hub installs Atlas
  at the beginning of onload, before its first asynchronous service load.

The adapter uses the main-process debugger transport and Chromium's
`Fetch.requestPaused` at **Request** stage. The original navigation remains
held, including POST bodies; it is never reconstructed for authorization.
This avoids Electron's single-listener `session.webRequest` conflict with the
native viewer's adblocker. Unsupported capability or debugger detach closes
the guest. New guests attach initially blank, with unsafe preload/Node settings
removed, before any requested web URL is released.

Electron's `will-frame-navigate` is synchronous but excludes programmatic
loads. It supplies a protocol veto and provenance, not the sole gate. Fetch
intercepts actual document requests from all origins, including application
navigation. Native Chromium cross-document history is cleared on arrival to
evict entries that could bypass a request via BFCache. Obsidian leaf history
remains the supported Back/Forward path; page-script cross-document history
traversal is intentionally unavailable. Same-document history and anchors do
not change host permission and receive retained-content checks.

API references: [Electron navigation events](https://www.electronjs.org/docs/latest/api/web-contents/),
[debugger transport](https://www.electronjs.org/docs/latest/api/debugger/),
[Chromium Fetch](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/).
Native verification establishes this mapping separately from Core/adapter tests.
The pinned test engine matches the installed Electron 39.8.3 binary. The native
suite uses real guests and the same remote bridge; its Obsidian renderer/view
lifecycle is a focused fixture, rather than the full application UI.

## Authority and persistence

One host lives in Electron's main process per vault partition, including
Obsidian popout windows and multiple UI panels. One promise queue covers
navigation assessment, required Journey adoption, release, arrival and user
commands. Context IDs are fresh and opaque; guest IDs alone are never reusable
Journey identity. Plugin unload suspends browsing while the host keeps Core
authority and unresolved-write guards for reload.

Hub's `data.json` store deliberately normalizes missing data and has weaker
reconciliation semantics than Atlas requires. Atlas instead uses the same
desktop filesystem/atomic-replacement approach in a separate private
`atlas-state/` directory. It never enters workspace presets or Hub backup
restoration. A write creates and flushes a complete temporary envelope, checks
the previous version/bytes, then renames it atomically. A small durable journal
correlates the only pending write; synchronous native filesystem work cannot
apply later after returning. Recovery resolves journal outcome without replay.
An exclusive machine/process lock fences other cooperative writers. Missing
initialized authority, malformed data, future schema, conflicts and clock
rollback block browsing. Known valid schema 1 is explicitly migrated atomically.

First setup is a separate explicit UI action on a genuinely uninitialized
repository. It chooses exact-host policy and discloses the documented
development timing values (10s/60s/60s Access; 30s/60s Vault; 5m/12 hops Journey).
No unavailable or damaged repository is reset. Later changes use Vault.

```text
Explicit user action → controller loads/validates → Core complete candidate
→ repository journal + flushed atomic replacement → verified receipt/reload
→ controller publishes committed state → new navigation assessment → release
```

## Navigation and Journey facts

Every top-level HTTP(S) request uses Core normalization and `BEGIN_NAVIGATION`.
Fresh saved ALLOW governs only its exact held request. A non-root Journey hop
uses `RECORD_JOURNEY_NAVIGATION` and must save before release. Root requests
remain uncompleted until a correlated actual document arrival records ARRIVAL.
Redirect evidence must refer to a previously released request in the same
guest and chain, with the exact browser target. Missing/ambiguous provenance
uses ordinary policy. A loaded-root departure requires the native initiating
main frame to match the actually loaded, saved Whitelist document. Intermediate
POST continuation requires that same native provenance and browser method.
Iframe-to-top promotion and popup parentage provide no Journey authority.

Fresh contexts consult the same runtime. Popups are synchronously denied;
users can explicitly open a link in a native Obsidian tab/split/window, which
gets its own context and ordinary gate. No opener transfers a Journey.
Unsupported protocols and downloads are denied from governed guests. Ordinary
subframes/resources remain browser functionality under Atlas's visible
top-level scope; embedded content is not claimed as isolated network egress.

Expiry and policy/state failures close unauthorized retained content, including
reader-mode copies in the host UI. Timers only invoke observation/rechecks and
veto execution. They cannot confirm Access, commit Vault or renew a Journey.
Restart ends prior Journey bindings through Core before READY. A retry is an
explicit fresh request to the root origin, never a replayed authentication URL.

## Greylist and Vault UI flows

```text
Unknown link → held request → Core GREYLIST → cancelled request / closed guest
→ native Atlas access panel → Request access once → saved pending request
→ WAIT → REQUIRE_CONFIRMATION (still blocked) → explicit Confirm and open
→ saved consumed request + fixed-expiry grant → fresh homepage GET
→ fresh Core ALLOW → rendered page
```

Blocked guests are closed and their DOM elements removed. Native view wrappers
recreate a fresh guest for later typed navigation; confirmations open only a
sanitized origin homepage. Existing guests at hot activation are closed without
adopting their page evidence. Their closed descriptions can request access.
Canvas uses the same gate and global Atlas access UI; its confirmation opens an
ordinary fresh webviewer. Blank replacement immediately retires old browser
evidence and saves Core context closure.

The panel uses Core outcomes/IDs; it does not infer permission from a countdown.
Request creation is idempotent in Core. Saved exact scopes are shown; no global
apex/www equivalence or Firefox preset is invented. The copied tree contains
Core's managed-list compiler but no feed bytes, curated compiler or preset.
The adapter documents managed authority as absent rather than claiming a
bundled blacklist, provider catalog or seed policy.

Atlas overview lists saved temporary grants and native contexts with Journey
status. Policy and seven protected settings use PROPOSE → frozen REVIEW → wait
→ explicit CONFIRM → durable commit. One Vault slot is shared. Cancellation
and replacement require a fresh full wait; no direct-write settings shortcut
exists. Core review supplies exact classification consequences.

## Security limits to verify and document

Local filesystem flush/rename is not a proof against physical power loss,
whole-directory rollback, malicious external edits or independent OneDrive
writers. Local wall-clock safeguards provide no external trusted time. The
host relies on Obsidian's private desktop remote/view internals and must fail
closed on incompatible versions. Atlas controls guests while the Hub is active;
other applications/default-browser launches and removing the plugin before app
startup are outside this Ulysses-contract boundary. Unloading the UI after Atlas
has installed keeps the main guard and refuses new browsing. Deadline removal
runs at the next available main-process event-loop turn; it is not a real-time
guarantee while the OS/main thread is stalled. Public-provider authentication and
popup-dependent sign-in need separate compatibility testing. See the mechanism
table and limits in [the security review](Hub-atlas-security.md).

## Building and verification

`build-atlas.js` compiles the unchanged Core source to CommonJS plus declarations.
Its manifest records source/configuration/builder and artifact hashes. `build.js`
refuses stale Core artifacts, then emits the renderer and main-process bundles.
The main bundle alone imports Electron/native filesystem; the renderer imports
no Core policy engine. There are no new production npm dependencies.

Core's existing strict typecheck and test suite remain intact. The adapter has a
JavaScript typecheck against Core ports and Electron declarations, filesystem
and runtime integration tests, and a native Chromium/remote/UI suite. The native
launcher requires both a complete success marker and a clean process exit. It
removes its validated temporary profile after the child exits. Hub's existing
Node suite also passes; three stale fixture assumptions about existing history,
card ownership/window mocks and Oath typography were corrected without changing
those production features. Exact commands are documented in the root README.

Final verification on 2026-10-05: 191 Core tests, 32 adapter/repository tests,
36 existing Hub tests and 21 real Electron browser cases passed. Core's strict
typecheck, the adapter JavaScript typecheck, both generated bundles and the
whitespace check passed. No live vault Atlas authority was initialized.
