# Atlas in the Obsidian webviewer

Integration design recorded before implementation and updated after verification,
2026-10-06. The copied Core
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
├── lib/atlas/presets/                       canonical service metadata/compiler
├── lib/atlas/managed/                       verified feed/cache/bundle service
├── lib/atlas/obsidian/
│   ├── persistence.js                      exclusive filesystem repository
│   ├── clock.js                            real clock injected into Core
│   ├── runtime.js                          one controller and navigation ledger
│   ├── webviewer.js                        Electron main-process interception
│   ├── native.js                           one host per vault/session
│   ├── integration.js                      trusted Obsidian renderer bridge
│   ├── application.js                     versioned destination metadata
│   ├── note-context.js                    live Note-view menu gating
│   ├── home-ui.js                         trusted internal Atlas Home
│   ├── settings-ui.js                     six functional settings sections
│   └── ui.js                              shared forms and blocked access
├── atlas-native.cjs                         generated main-process entry
└── plugin.js → main.js                      installs bridge at plugin startup

Obsidian native webviewer (inspected frontend 1.14.4)
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
| Application/managed services | Versioned destination metadata, frozen proposal metadata; last-good compiled managed identity/cache | Repository and Core compiler/planner | Runtime and native host | Managed membership input to Core; metadata never grants access |
| UI | Editable drafts, displayed deadlines/reasons, selected context, busy state | Closed explicit host commands | Note-view Home, Obsidian settings, blocked viewer | Presentation only |
| Native Obsidian viewer | Actual URL/document, title, reader mode, leaf history and layout | Electron guest APIs | Obsidian and notes | Browser state, not Atlas permission |

## Observed platform boundary

This repository is an Obsidian vault and CommonJS community plugin, not an
Electron application with its own bootstrap. Hub's existing navigation and
presets preserve native `webviewer` leaves; they do not create browser controls.
Inspection of the installed `obsidian-1.14.4.asar/app.js` establishes:

- `instantiateWebView` creates an Electron `<webview>` in the vault partition.
- `leaf-menu` is emitted by both the native header menu and tab-header context
  menu. Settings pushes its own native keymap scope, including under a menu scope.
- Empty tab strips do not emit `leaf-menu`, and native drag regions swallow DOM
  context menus. Live Note content groups receive a scoped no-drag menu surface;
  its launcher rechecks the same mode, leaf, document and Settings authority.
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
The renderer requires native API version 3. An older cached service is refused
with an explicit quit/reopen notice and guest-factory quarantine, rather than
hot-swapping a controller or displaying new features against old authority.
Descriptions and command results cross the remote bridge as JSON strings, then
become ordinary local renderer data. Nested remote object proxies previously
caused synchronous IPC on property reads during rendering. STATE_CHANGED events
replace the local description before publishing to Home, Settings and native
interstitials. The renderer cache confers no navigation authority.

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

First setup is an explicit action on a genuinely unused repository. It offers
the curated policy (32 services / 58 exact hosts) and discloses the
development timing values (10s/60s/60s Access; 30s/60s Vault; 5m/12 hops Journey).
Advanced custom/empty initialization remains explicit. Existing policy is never
reseeded: importing the starter set later proposes a union in Vault, preserving
manual Blacklist entries and all active authority until confirmation. No damaged
repository is reset. Later host/access and timing changes use Vault.

The disk envelope keeps Core schema 2 and adds an application-schema-1 field.
The repository strips this field before supplying Core's closed envelope contract.
Known old envelopes acquire metadata through the same journal/CAS/atomic-write
path, preserving the complete Core snapshot, counters and revisions. Destination
names, categories, aliases, entrypoints and pins are persisted; active Home rows
always describe committed policy. Frozen metadata for a host edit commits in the
same envelope as its successful Core Vault confirmation. Failed/unknown saves do
not publish metadata ahead of the controller's verified storage version.
Presentation-only edits have an explicit atomic save and never rewrite hosts or
policy revisions; Core correctly refuses no-policy-change Vault proposals.

Managed data is a separate private `managed-cache.json`, never manual Blacklist.
The verified pinned bundle allows offline startup. A valid last-good cache wins;
corrupt cache falls back to the bundle, and no usable authority yields unavailable
managed input rather than an empty allowlist. Download/validation runs outside the
controller queue; flushed cache replacement and compiled-identity activation run
inside it, followed by Core observation and retained-page checks. See
[the product/services contract](Hub-atlas-product.md) for source and validation.

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
apex/www equivalence is inferred. The canonical preset explicitly enumerates
every alias and related destination. Sites & Access previews the exact primary,
optional www counterpart and other hosts before proposing a change. Managed
membership always flows through Core's existing precedence.

Atlas settings list saved temporary grants and native contexts with Journey
status. Policy and seven protected settings use PROPOSE → frozen REVIEW → wait
→ explicit CONFIRM → durable commit. One Vault slot is shared. Cancellation
and replacement require a fresh full wait; no direct-write settings shortcut
exists. Core review supplies exact classification consequences.

## Note-view launch and Atlas Home

The live `plugin.workspaceModes.mode` identity plus `state.currentMode === "note"`
is Hub's Note-view authority. Launch additionally checks live main-leaf/document
ownership, the current active view and content membership, and native/Hub/Atlas
Settings. Markdown must belong to the live Project/Resource (including linked
Resource folders); the prepared rail and native browser tabs are eligible.
Home.md, other modes/views, detached leaves and stale mode callbacks are excluded.
The menu captures the live mode and rechecks it on activation and before opening.
Body classes, remembered last navigation, text selection and URLs supply no gate.

The action creates a sibling native `webviewer` at `about:blank`, marking native
state `{atlasHome:true,title:"Atlas"}` for presets/layout restoration. It reuses
an existing internal Home in the live content leaves; ordinary browser tabs stay
separate. Atlas Home is trusted parent UI while its guest stays sterile blank.
Branding, search, temporary access, pins, categories and entrypoints derive from
canonical/application metadata plus committed Core descriptions. A destination
click calls native `navigate`, entering the same main-process Fetch authorization
gate as note links and typed URLs. Blank/Home is no destination permission.
There is no Atlas ribbon, command-palette launcher or global Hub mode.

Subscribers compare meaningful section signatures, preserving focused drafts and
unchanged cards during time observations and grant transitions. A one-second
timer updates countdown text only. This native-parent route differs from the
Firefox extension's own privileged page/tab; the security engine stays unchanged.

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

`build-atlas.js` compiles unchanged Core and the canonical preset to CommonJS plus declarations.
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

Verification commands are in the root README. New tests cover curated setup,
existing-policy import, atomic metadata/Vault confirmation and uncertainty,
display-only revisions, old-envelope migration, managed validation/cache/failure
and Core precedence, note-only/stale-menu rejection, native Home creation/reuse,
draft/card stability and navigation from Home through the real Chromium gate.
The portable HTML runner renders hidden fixtures offscreen in isolated profiles.
No live vault Atlas authority is initialized by these tests.
