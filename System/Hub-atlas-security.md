# Atlas webviewer threat and bypass review

Reviewed 2026-10-06 against unchanged Core and inspected Obsidian frontend
1.14.4 / Electron 39.8.3 / Chromium 142.0.7444.265. The native suite runs that
Electron version with real guests, a local HTTP server, hidden windows and a
temporary profile. It does not launch the user's vault or submit credentials.
The renderer fixture uses the actual remote bridge and built Atlas bundle, with
a small native-view/Obsidian lifecycle fixture derived from the inspected APIs.
It is distinct from an interactive test of the complete Obsidian application.

## Boundary

Atlas controls visible top-level destinations of native Electron guests in
`persist:vault-<appId>`. This includes the native webviewer and Canvas guests.
It is not an operating-system firewall, a content filter, or revocation of text
already saved as a note. Normal page resources and embedded frames can load.
An embedded frame cannot promote itself into a Journey-authorized top frame.
External browser commands from trusted Obsidian chrome are outside this scope;
page-initiated popups, downloads and unsupported guest protocols are refused.

Core alone decides classification, Access, Vault and Journey authorization.
No renderer description, countdown, website message, service name, opener,
iframe origin or previous ALLOW is permission to execute a request. Browser
facts come from the main-process native event/protocol stream. Missing facts
fall back to ordinary Core assessment or close the guest.

## Navigation mechanisms

| Mechanism | Observed API/event | Atlas interception / enforcement | Coverage | Residual limitation |
| --- | --- | --- | --- | --- |
| Typed URL / address suggestion | Native `navigate` → `webview.loadURL` | Hardened attachment, main `loadURL` setup fence, Fetch Document Request → fresh Core BEGIN → continue/fail | Real programmatic load; renderer typed recovery | Native Obsidian address control itself is inspected, not driven by the fixture |
| Note, bookmark, search, CLI, restored layout | Native `setViewState` / initial `src` / `navigate` | Host `will-attach-webview` replaces initial src with a sterile document; restores requested URL only after interception is ready | Initial Whitelist/Greylist; Hub layout tests; source inspection of startup ordering | Trusted third-party plugins outside this adapter can perform other network work |
| Page link, location assignment, GET form | `will-frame-navigate`, Network and Fetch Document | Exact native initiating frame/document can attest a loaded Whitelist-root departure; other transitions use ordinary policy | Root click, script navigation from grant, unrelated Journey GET, iframe promotion | A trusted root can choose its first unfamiliar destination; no claim of authentication purpose |
| Intermediate POST | Native POST method, initiating main frame, exact saved current document | Core FORM_POST and saved hop before continuing the original request/body | Actual submitted body retained; runtime POST/return tests | Subsequent unfamiliar GET/script departures are conservative and may interrupt providers |
| HTTP redirect | Fetch `redirectedRequestId`, Network loader/request identity | Only the released predecessor in the same guest supplies HTTP_REDIRECT; Blacklist remains decisive | Native root → IdP and denied Blacklist redirect; runtime multi-hop callback chain | Redirects are browser correlation, not a provider allowlist |
| Reload / programmatic reload | Chromium reload → Fetch Document | Fresh Core decision; same-host Journey does not renew fixed terms | Actual reload after expired grant; runtime intermediate reload | Cache/BFCache compatibility relies on the documented history/service-worker fences |
| Obsidian Back/Forward | Leaf history restores URL through `navigate` | Same loadURL/Fetch gate | Existing Hub layout/history tests; native restored-URL denial | Complete Obsidian Back/Forward chrome has not been driven interactively |
| Native/page cross-document history | Native navigationHistory | Clear native entries on every actual navigation; missing clear capability closes guest | Native canGoBack/canGoForward are false; calls cannot revisit old content | Page cross-document history is intentionally unavailable; Obsidian leaf history remains available |
| Same-document history / fragments | `did-navigate-in-page` | Keep exact physical document identity; Core retention checks; host cannot change without Document gate | Actual pushState and fragment arrival | This does not restrict paths within an authorized exact hostname |
| Another tab/split/window | Fresh native guest / host `did-attach-webview` | New opaque context, common controller, no opener/Journey inheritance | Another guest and real second BrowserWindow | Other vaults use their own session and repository |
| window.open / target=_blank | Native `setWindowOpenHandler` | Synchronous deny; later handler registration cannot replace it | Actual script popup and target-blank click create no contents/request | Popup-dependent login is unsupported; explicit native tabs use ordinary assessment |
| Iframe top promotion | Main-frame navigation with child initiator | No ROOT_DEPARTURE or FORM_POST attestation from child; ordinary Core gate | Real srcdoc frame top navigation; runtime forged/mismatched-source cases | Ordinary iframe documents/resources themselves are outside top-level classification |
| Service worker / cached response | CDP Network and Fetch | Bypass service workers for guarded guests; Document interception still applies | Registered real service worker cannot serve the navigation; local server receives the document | Offline service-worker navigation is unavailable |
| Downloads | Session `will-download` | Cancel every download in the governed partition | Actual attachment response cancelled | Normal webviewer download functionality is intentionally unavailable |
| File/custom/javascript/data protocols | Main loadURL wrapper; will-frame-navigate/will-redirect veto | Only normalized HTTP(S) and two exact sterile blank URLs are accepted | Actual file load refused; malformed/protocol runtime matrix | OS protocol handlers are not launched by tests; trusted external-open commands remain outside scope |
| about:blank / internal replacement | Native wrapper and frame event | Immediately retire displayed source/flight and save Core context closure; late arrivals cannot resurrect the old binding | Native active Journey → blank → old intermediate denied | Blank itself is inert and supplies no destination authority |
| Debugger detach, renderer loss, missing interception | Native lifecycle/capability checks and watchdog | Stop and close guest without beforeunload; deny new attachment during suspension | Actual detach and injected failed protocol setup | DevTools cannot remain attached while guarded browsing continues |
| Retained page at grant/Journey expiry | Independent native expiry veto plus serialized Core observations | Close guest, clear browser evidence, conceal/clear native reader copy; retain old deadline during a stalled replacement | Runtime expiry; actual expired reload/Journey; native stalled Whitelist destination; renderer late-reader fence | Timers run at the next available event-loop turn; an OS/main-thread stall is not a real-time revocation guarantee |
| Plugin unload / reload | Main singleton and UI unsubscribe | Last UI client suspends browsing; future guest attachment is refused; reload reuses controller/uncertain-write guards | Native renderer owner reuse and suspension | Deliberately removing the plugin before launch, editing trusted plugin code, or disabling all startup plugins is outside the contract |
| Hot activation with existing content | Enumeration of native guests | Close pre-existing content immediately; keep only a closed context/sanitized origin; no adoption of old page provenance | Native hot activation; renderer caches existing DOM ids before install | Atlas cannot undo navigation that occurred before activation |

## Persistence and command attempts

The filesystem repository has one cooperative local owner, a version/byte
precondition, a complete schema-2 authority file, an initialization sentinel,
flushed temporary files, same-volume atomic rename and a hashed pending commit
journal. It does not share Hub `data.json` recovery, presets or backup restores.
Candidate state is unpublished until Core verifies the committed receipt and
reloads authority. Failed/unknown/conflicting writes block browsing. Recovery
resolves the exact attempt without replaying confirmation or opening a page.

Tests cover competing/foreign owners, interrupted reclamation, CAS conflict,
failure before/after journal creation, applied-write acknowledgement loss,
ambiguous external replacement, known schema-1 migration, missing/corrupt
authority, cached READY descriptions, clock rollback, and restart. Access replay
cannot renew expiry; policy revisions invalidate prior Access/Journey terms.
The UI command boundary rejects raw confirmation IDs, arbitrary targets/scopes,
direct Journey minting, extra fields and stale context generations. Protected
timing inputs round-trip integer milliseconds exactly, including MAX_SAFE_INTEGER.

Application-schema-1 metadata extends the disk envelope without changing Core's
closed schema. Policy and frozen presentation metadata apply in the same Vault
commit; descriptions select only metadata matching Core's verified storage
version. Lost acknowledgements cannot show a new destination ahead of policy.
Presentation-only commands reject host fields and stale revisions, and leave all
permissions unchanged. Migration infers names only from existing committed hosts.
Managed refresh validates bounded official-source data and replaces a last-good
private cache before activating its compiled identity in the runtime queue.
Cache/network failures retain prior protection; no usable bundle/cache supplies
unavailable managed authority rather than an empty blacklist.

Native Home is trusted parent UI above a sterile `about:blank` guest. Its links
delegate to the normal native navigation gate; a Home marker or service label
supplies no permission. Header/tab launch checks live Note mode, context/leaf
ownership and Settings at menu creation and activation. Stale callbacks, Home,
unrelated notes, other modes and Settings cannot open a tab. The renderer has no
global ribbon/command launcher or policy engine.

## Explicit limits and compatibility choices

- The local filesystem and trusted Obsidian/main-process code are part of the
  trust boundary. Cooperative ownership is not a lock honored by OneDrive or
  arbitrary editors. Unexpected bytes during a live owner are rejected; a full
  valid directory rollback after process restart requires an external anchor
  to detect. Foreign-machine locks are not automatically removed.
- Windows does not expose directory fsync through Node. Files are flushed before
  atomic replacement, and uncertain results stay fenced. This establishes
  normal-process crash/reconciliation behavior, not physical power-loss proof.
- Wall time plus a process elapsed floor prevents in-process rewinds extending
  leases. Core keeps persisted time/revision checkpoints. Neither is externally
  trusted time, and OS suspension/main-thread stalls can delay removal of already
  rendered material. No fresh request is released from a cached assessment.
- The Firefox D30 automatic timeout-homepage effect is deliberately replaced by
  closing the guest and an explicit root-homepage retry. It creates no synthetic
  navigation that could automatically mint another Journey. Core is unchanged.
- Curated initialization/import is explicit, with no policy reseeding on migration.
  Managed blocking follows the verified bundle/cache and daily official refresh,
  retaining the last good identity on failure. Core's manual Blacklist/explicit
  Whitelist precedence is unchanged; no apex/www scope is inferred. The managed
  source is an external data input whose correctness is not independently proven.
- Native enforcement was verified on the installed Electron engine. Private
  Obsidian view/remote APIs require compatibility checks after app upgrades.
  Missing native integration refuses normal browser factories and displays an
  unavailable state. Desktop is the supported browsing profile.
- Real authenticated SSO, popup-dependent providers and other Obsidian releases
  remain compatibility work. Synthetic native tests do not claim those results.

API basis: [Electron WebContents](https://www.electronjs.org/docs/latest/api/web-contents/),
[debugger transport](https://www.electronjs.org/docs/latest/api/debugger/),
[Chromium Fetch](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/),
[Electron guest lifecycle source](https://github.com/electron/electron/blob/main/lib/browser/guest-view-manager.ts).
The implementation uses public host attachment events; the lifecycle source
helped diagnose sterile initial loads and parent guest-id readiness.
