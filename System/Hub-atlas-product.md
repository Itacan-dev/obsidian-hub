# Atlas product and service contracts

Updated 2026-10-06. AtlasCore remains unchanged under `AtlasCore/packages/core`.
The renderer owns presentation and drafts; the main-process runtime owns Core
and the serialized execution queue. See [the architecture](Hub-atlas-architecture.md)
and [the browser boundary](Hub-atlas-security.md).

## Curated initialization

`lib/atlas/presets/curated-whitelist.ts` is the local canonical source, originally
copied from the supplied extension file. Stabilization adds seven explicit reviewed
www aliases. It contains 32 services and compiles to 58 exact Whitelist hosts.
Labels, groups, aliases and related
destinations are shared by initialization, metadata inference, import and Home.
There is no parallel hostname array. Build manifests fence stale generated copies.

Fresh setup previews this starter set and all seven timing terms, then requires
**Initialize Atlas**. An advanced custom policy may explicitly initialize an
empty or custom repository. Existing initialized policy is never overwritten.
**Review curated updates in Vault** appears when starter hosts are missing. It
proposes the union of existing and starter Whitelist hosts, preserving manual
Blacklist and merging aliases into existing service metadata without replacing
user labels, categories or pins. Only successful Core
confirmation applies that policy. Setup never repairs missing/corrupt authority.

Hosts are exact: neither apex/www equivalence nor suffix/wildcard permission is
inferred. For example, the starter explicitly includes both `chatgpt.com` and
`www.chatgpt.com` in that service's metadata. Structured editors offer an explicit www checkbox
and enumerate all proposed exact hosts before submission.

## StevenBlack managed authority

The source matches the mature Firefox combined profile:
`https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn-social/hosts`.
It contains base + fakenews + gambling + porn + social categories, separate from
manual Blacklist. The bundled data retains the immutable revision, SHA-256,
upstream README, source comments and license/attribution notices.

Startup validates the bundle and any private cache before supplying a compiled
identity to Core. The pinned bundle has 163,856 unique source names and 163,850
usable exact hosts; six underscore-containing names are outside Core's contract.
A valid cache supersedes the bundle; corrupt cache falls back to the bundle.
With neither usable, managed authority is unavailable and browsing fails closed.
Managed blocking is always enabled in this adapter; there is no new Core toggle.

Background refresh is asynchronous and attempted at most once per 24 hours,
including failed attempts, with an hourly stale check. Manual refresh bypasses
the daily throttle and coalesces concurrent updates. ETag/Last-Modified validators
support conditional requests; 304 safely refreshes sync metadata. The request has
a 30-second abort bound, rejects redirects and reads at most 20 MB of UTF-8 data.
The parser requires the official profile identity and category headers, an exact
declared unique count, at least 50,000 usable hosts, no malformed records, bounded
ignored names, and at least 80% of the previous usable count. Comments, duplicates,
local names and valid non-sinkhole addresses follow the source format.

Validated data is compiled once into Core's opaque managed identity. Lookup never
downloads or reparses a feed. Network/parse/retention/cache-write failures preserve
the prior identity and cache and report an error. Network work stays outside the
Core queue; atomic cache replacement and activation run inside it, followed by
observation and retained-page checks. Refresh never changes manual lists or grants.
Core precedence remains manual Blacklist > explicit Whitelist > managed deny >
temporary/Journey authorization > Greylist. Managed Lists exposes Whitelist
exceptions, source, categories, origin, version/hash, count, sync/attempt times,
errors, manual refresh and exact-host lookup.

## Home and six settings sections

Atlas Home opens inside a native webviewer leaf with a sterile blank guest.
Trusted parent UI shows branding, slash-to-search, active temporary access,
pinned destinations, categories and related entrypoints. Names, categories and
pins come from committed application metadata; availability comes from Core
descriptions. Destination clicks use native navigation and the existing gate.
Restoration stores the explicit native `atlasHome` marker, never a remote URL.

| Section | Functional behavior |
| --- | --- |
| Sites & Access | Search committed services; add/edit/remove structured drafts; primary host, explicit www/other hosts, access, category and pin; exact-host preview; curated Vault import |
| Temporary Access | Core-described requests/grants and native contexts; explicit request, wait, confirmation and fresh homepage; fixed expiry and no automatic renewal |
| Timings | Seven protected Access/Vault/Journey terms; current values and help; exact integer-millisecond parsing; frozen proposal through Vault |
| Vault | Immediate exact policy/classification and metadata diff; changed timing terms only; stable waiting/ready/expired status; visible explicit Confirm change, Cancel proposal, and expiry Recreate proposal actions |
| Managed Lists | Source/cache/bundle status, count/categories/hash/sync/error, exceptions, manual refresh and exact-host membership lookup |
| Diagnostics / Recovery | Core/storage/application schemas and revisions, counters, journeys, sync state and explicit reconciliation; no reset/replay shortcut |

Subscribers compare meaningful signatures per section. Countdown timers only
update text; routine Core time observations preserve focused inputs, search,
scroll and unchanged cards. The stylesheet follows Hub semantic font tokens with
cream surfaces, olive controls, serif headings and responsive forms/cards.
The outer modal has a bounded fixed height, with section scrolling inside it.
Editors open above the destination list. The same settings shell fills the
embedded Hub settings panel. Vault's actions remain outside its scrolling diff.
Scoped form colors cover hover, focus, active and disabled states under the native
dark theme. Blocked/blank guests clear Obsidian's native loading indicator.
The plain-data bridge avoids nested remote-proxy IPC during UI comparisons.

## Atomic metadata and migration

Core schema 2 remains its closed four-field envelope. The filesystem repository
adds application schema 1 on disk and strips it when loading Core. Application
state has a revision, validated destinations and optional frozen pending metadata.
Old valid Core envelopes acquire inferred metadata through the existing flushed,
journaled CAS transaction. Inference reflects only existing committed exact hosts;
it cannot silently seed policy or reinitialize an existing repository.

Structured policy edits check both policy and application base revisions. Pending
metadata is frozen alongside the Core proposal. Successful Vault confirmation
applies policy and metadata in the same complete atomic envelope. Cancel, expiry,
replacement and failed/unknown writes never apply that metadata. The runtime
publishes metadata only for the controller's verified storage version, including
lost-acknowledgement reconciliation. Names/categories/pins may use a separate
atomic presentation-only transaction because they change no permission and Core
rejects a no-policy-change Vault candidate. A pending policy edit blocks such
presentation writes to avoid overwriting frozen metadata.

All authority, metadata and managed cache live in ignored `atlas-state/`, outside
Hub presets and backup restore. Native Home tab state may live in a Hub layout;
it contains presentation routing only, never grants or an authority snapshot.

## Compatibility

Obsidian emits `leaf-menu` for header/tab menus. Launch checks the live Hub mode,
leaf/document/context membership and Settings scope at display and activation.
An additional scoped DOM menu covers the empty content tab strip, which does not
emit leaf-menu. Its live Note-only no-drag region allows Chromium contextmenu
dispatch; other workspace/title drag regions stay native.
The adapter creates/reuses a native sibling Home rather than an extension tab.
There is no global Atlas mode, ribbon or command-palette launch. Native layout and
Oath/workspace restrictions remain in force.
Upgrading the native service requires quitting and reopening Obsidian once.
The renderer verifies native API version 3; an older cached host triggers a
restart notice and quarantine. A plugin reload never replaces a live controller
or discards its unresolved writes.

Firefox browser APIs are replaced by Electron main-process Fetch interception,
remote-host ownership and trusted parent UI. Blocked/expired guests are closed;
confirmation opens an explicit fresh origin homepage. Popup-dependent SSO and
cross-document page-script Back/Forward are limited by the existing native guard.
Tests use actual Chromium guests and the remote bridge with an isolated Obsidian
lifecycle fixture, not the complete live app or authenticated provider sessions.
