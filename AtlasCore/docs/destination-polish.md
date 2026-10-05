# Destination and Firefox polishing (D30)

Authorized on 2026-10-04. Core retains exact-host policy, existing grants, Journey transitions and Vault semantics. This pass changes Firefox effects and presentation.

## Model and ownership

Evolve the existing curated service and `DestinationEntry` display index. Labels, categories, pins and local usage remain presentation preferences. Active hostnames always come from the verified Core snapshot; metadata cannot add permissions. Preserve existing pin identities and authority schema 2. New versioned destination metadata is separate from authority, using the extension's existing local preference mechanism. Pending metadata is tied to a frozen Vault proposal and applied only after its matching committed policy is observed. Lost or malformed metadata falls back to hostname labels, retaining all policy entries.

Sites & Access shows committed destinations and exact host terms, with search and explicit add/edit/removal proposals. Settings contains behavior/timing, including existing protected Journey lifetime. No new settings store or Core schema is required. Permission changes use the existing proposal/review/confirmation commands. Core rejects unchanged-policy proposals; edits limited to name/category/pin use an explicit **Save display details** action, with no authority command. Wildcard scope remains unsupported; additional hosts must be named explicitly.

Existing edits default to **Keep current exact rules**, preserving mixed classifications and Blacklist/Whitelist overlap during display-only changes. A hostname already owned by an active destination must be edited there, preventing duplicate services and lost pin identity. Explicit replacement retires overlapping inactive metadata without changing any other policy term. Selecting a Sites row focuses its read-only details; narrow layouts scroll that panel into view.

For new/edit proposals only, use `tldts`'s Public Suffix List (including private suffixes) to suggest an optional exact apex/`www` pair. This dependency belongs only to the extension. Never infer parent permissions from arbitrary subdomains or broaden saved policy during migration. [Library documentation](https://github.com/remusao/tldts), [public suffix background](https://publicsuffix.org/learn/).

## Home and ranking

Compact launchers show icon and name; exact addresses remain in tooltips and entry-point controls. D31 supersedes the initial four-card limit with one responsive row, up to five destinations, and retains Show all. Pins retain their explicit order. Usage is local, deterministic and attached to service identity, with a seven-day half-life. Record explicit Atlas launches and browser-attested typed/bookmark arrivals, never redirects, resources, denied navigation or intermediate hops. No website-supplied URL or account data is stored in usage.

The sidebar is a permanent 60px icon rail with accessible names and status tooltip. D31 removes expansion and ignores the old presentation-only sidebar preference. Main content receives the freed width.

Ranking does not infer user intent from ordinary page links. Browser visits without an attested destination arrival are omitted; Atlas launches are counted at their saved Whitelist gate, even when authentication later redirects. Scores, counts and timestamps carry no authorization.

## Journey timeout effect

After Core successfully ends a Journey as EXPIRED, return only its owning tab to the recorded root origin's homepage (scheme, hostname and port). Preserve no login query, fragment, POST, or credential-bearing path. Check current Core authorization before the effect; a removed/blocked root or unavailable authority uses ordinary denied behavior. The old Journey ID remains ended.

The adapter marks the automatic return and suppresses Journey creation for that request, correlated redirects and page-originated departures. HTTP redirects, reloads and immediate page actions cannot renew the timer. Explicit Atlas launch/restart may begin a new attempt. A later committed Whitelist document with Firefox's typed/bookmark transition clears the guard for a subsequent normal loaded-root departure; the marked synthetic request cannot clear it even if its arrival reports `typed`. Missing request-origin metadata proves no user intent. After timeout, a root that redirects before document arrival needs explicit Atlas Restart. Generation/context checks retire superseded effects and tab closure removes the marker. The marker only vetoes Journey creation; Core still evaluates every destination.

## Validation results

Extension **0.1.11** passes **191 Core tests and 203 extension tests**, both builds and both TypeScript checks. Core source, public API and authorization semantics are unchanged. Thirteen new extension tests cover timeout effects and destination models; existing expiry expectations now assert the guarded return rather than leaving an intermediate displayed.

`journey-timeout.test.mjs` uses fake time and isolated authority to cover saved expiry, recorded scheme/port, owning-tab isolation, HTTP renewal denial, synthetic arrivals, unattributed reloads, browser-attested fresh arrival, current-policy denial, failed/conflicting/unknown saves, closed or superseded contexts, launch accounting and stale draft revisions. `destination-polish.test.mjs` covers PSL scope, exact policy candidates, unchanged-policy edits, frozen metadata reconciliation, cancellation/staleness, malformed or overlapping metadata, alias/pin identity, deterministic decay and denied/intermediate launch exclusion.

Native **Firefox 157.0** passes the new destination-polish scenario and the baseline, productization, Journey-polish and coherence regressions in isolated profiles. The new scenario exercises actual Vault controls, no early settings activation, explicit apex/www terms, duplicate destination protection, display-only saves, Blacklist/removal commits, HTTP/JavaScript/meta-refresh timeout loops, explicit restart, actual address-bar arrival, real IndexedDB restart, failed presentation writes, 54px launchers, the 60px rail and 500px Home/Sites views. Selecting a narrow-screen Sites row brings its named details into focus. [Sanitized results](evidence/firefox-destination-polish-d30.json) contain checks and measurements, without profiles or authentication URLs.

Commands run from the repository root (Windows uses `npm.cmd`):

```sh
npm.cmd --prefix packages/core run build
npm.cmd --prefix packages/core run typecheck
npm.cmd --prefix packages/core test
npm.cmd --prefix extension run build
npm.cmd --prefix extension run typecheck
npm.cmd --prefix extension test
python extension/scripts/firefox-e2e.py
python extension/scripts/firefox-e2e.py --productization-only
python extension/scripts/firefox-e2e.py --journey-polish-only
python extension/scripts/firefox-e2e.py --coherence-only
python extension/scripts/firefox-e2e.py --destination-polish-only
node extension/scripts/verify-bundle.mjs extension/dist
```

Current previews: [compact Home and icon rail](evidence/atlas-home-collapsed-d30.png), [committed Sites details](evidence/atlas-sites-d30.png). The shipped distribution verifies successfully and matches version 0.1.11.

## Compatibility and limits

Existing authority schema 2, exact policy, timing and pins are retained; the schema-1 migration regression also passes. Destination metadata and usage add separate version-1 presentation preferences, not an authority migration. Reload never adds www permissions. If a presentation write fails, committed policy remains authoritative and hostnames remain visible through fallback labels; a metadata edit does not claim success. Metadata and authority are intentionally not one storage transaction, so a permission commit can succeed while its display details need saving again.

The timeout return uses the recorded origin homepage, not a replayed private path or authentication request. The runtime marker is bound to the current tab/context; restart already invalidates old Journey bindings. A root that redirects before a fresh attested document arrives after timeout requires explicit **Restart journey**. Ordinary page links are not inferred as usage launches. Wildcards are unsupported. These native tests use synthetic sites and no accounts; they do not prove a complete real-provider sign-in or physical power-loss durability.
