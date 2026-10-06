# Atlas stabilization report — 2026-10-06

This pass fixes the reported Atlas integration bugs. Core source and confirmation
semantics remain unchanged. No live vault initialization, policy import, proposal
cancellation or confirmation was performed by the tools.

## Diagnoses and fixes

| Issue | Discovered cause | Result and relevant files |
| --- | --- | --- |
| A. Missing www | The local preset omitted `www.chatgpt.com`. The screenshot's later edit expired without committing, leaving revision 0 active. | `presets/curated-whitelist.ts` stores literal aliases. `application.js` and `runtime.js` merge explicit curated imports into existing metadata through Vault. |
| B. Resizing | Atlas modal CSS bounded width but let content set height; embedded Hub Settings had its own scroll container. | `styles.css` bounds modal height/width, keeps navigation stable, and scrolls sections internally. `settings-pages.js` mounts Atlas before adding generic page headings. |
| C. Flashing/lag | Existing section signatures helped, but identical text was rewritten during polling and blocked reader content was repeatedly cleared. More seriously, remote object proxies caused synchronous IPC on nested reads during signatures/rendering; the instrumented short-window native test lost time before its ready result reached the UI. | `native.js` sends descriptions/results as JSON strings. `integration.js` keeps a local description replaced by state events. `ui.js`, `home-ui.js`, and `settings-ui.js` avoid identical text writes. Reader clearing occurs on transition or when a late copy exists. |
| D. Purple line | Installed Obsidian 1.14.4's `reportPageLoad` calls `showLoadingIndicator(true)`, adding `is-loading`. Closing a denied guest bypasses the usual loading completion events. | `integration.js` calls that native UI method with false for blocked/blank guests. Real loads retain native completion handling; no URL/history/navigation fact is forged. |
| E. Dark controls | Native type/state selectors overrode Atlas's base control colors. | `styles.css` explicitly scopes light colors, borders, caret, selection, placeholders, focus outlines and interaction states to Atlas controls. |
| F. Vault | Details required another review click; the captured review phase stayed WAITING after readiness; confirmation followed two full copies of unchanged timing terms. | `settings-ui.js` fetches Core review immediately, updates phase affordances narrowly, shows changed terms only, and keeps Confirm change/Cancel outside the diff scroll. Expiry disables confirm and offers Recreate proposal. |
| G. Live policy | Runtime already rechecked contexts on policy commit. A denied guest remains closed, so an allowed decision must offer a fresh protected homepage. An expired proposal provides no policy update. Proxy transport added UI publication latency. | The existing serialized commit/recheck path remains authoritative. Plain state events update the existing tab immediately. Open homepage continues in that same leaf through a new guarded guest, without replaying the denied path/POST or restarting. |
| Top-bar menu | `leaf-menu` covers native tabs/header menus, but empty strips emit no such event. Native CSS also marks the blank strip as a drag region, swallowing DOM right-click. | `note-context.js` adds a scoped DOM menu with the same live gate; `integration.js` tracks it and `styles.css` makes only eligible Note content strips accept DOM input. Existing tab menus and other title/drag regions retain their behavior. |

## Curated aliases and existing installations

The preset now contains 32 services and **58 exact hosts**, adding these seven
literal aliases: `www.chatgpt.com`, `www.claude.ai`, `www.arxiv.org`, `www.doi.org`,
`www.crossref.org`, `www.orcid.org`, and `www.springer.com`. GitHub already included
both root and www. No compiler/runtime prefix rule or wildcard was added.
Subdomain services receive no fabricated www host. INSPIRE's www endpoint could
not be verified and was left unchanged.

Public counterpart checks used the official [Claude](https://www.claude.ai/),
[arXiv](https://www.arxiv.org/), [DOI Foundation](https://www.doi.org/),
[Crossref](https://www.crossref.org/), [ORCID](https://www.orcid.org/), and
[Springer](https://www.springer.com/) endpoints. ChatGPT's counterpart was explicitly
requested; both literal hosts are covered by Core and native regression checks.

Fresh initialization persists the compiled preset and corresponding metadata.
Existing installations are never reseeded. Sites & Access exposes **Review curated
updates in Vault** when curated hosts are missing. The import preserves existing
hosts and manual Blacklist, and keeps customized names/categories/pins. Manual
Blacklist still takes precedence if an imported host overlaps it. The full diff
is reviewed before explicit confirmation and atomic persistence.

A read-only check of the current development authority found revision 1, 52
Whitelist hosts, both ChatGPT entries, its www alias in committed metadata, and
no pending proposal. That state was not changed by this pass. The import can
offer the remaining curated counterparts without discarding it.

## Vault and display behavior

Review change in Vault saves a frozen proposal and immediately selects Vault.
Core supplies the classification/list differences; the UI shows display changes
and only timing fields that change. During waiting, Confirm change is disabled.
At readiness, a Core review refresh enables it; the fixed deadline remains visible.
Expiration disables it and states that nothing changed.

Recreate proposal identifies the expired stored proposal, rejects stale IDs/bases,
cancels through Core, and proposes the same frozen policy or timing candidate with
a new ID and full wait under committed timing terms. Pending display values are
staged again. Cancellation failure stops recreation and publishes nothing. The
two steps use the existing journal/CAS queue; a failure after successful cancellation
can leave no pending proposal and requires a fresh draft after recovery. It never
replays confirmation or activates the candidate.

Confirmation persists policy and any bundled display edit atomically. Only a
successful receipt publishes the revision and consumes the proposal. Metadata-only
saves use the existing separate presentation transaction; mixed edits commit
together through Vault. Sites shows per-host differences when an alias has a
different committed classification from the primary hostname.

## Files and regression coverage

Paths below are under `.obsidian/plugins/hub-project-menu/` unless stated otherwise.

- Canonical data and transactions: `lib/atlas/presets/curated-whitelist.ts`,
  `lib/atlas/obsidian/application.js`, `runtime.js`.
- Adapter/UI: `lib/atlas/obsidian/native.js`, `integration.js`, `note-context.js`,
  `settings-ui.js`, `ui.js`, `home-ui.js`; `lib/ui/settings-pages.js`; `styles.css`.
- Generated artifacts: `main.js`, `atlas-native.cjs`, compiled preset JS/declarations,
  and `lib/atlas/core/build-manifest.json`. Generated Core module contents are unchanged.
- Tests: `lib/atlas/tests/product.test.js`, native `renderer-fixture.cjs` and
  `runner.cjs`, and `lib/tests/atlas-product.html`.
- Documentation: root `README.md`, and System Atlas product, architecture,
  verification and this report. Earlier unrelated working-tree edits were preserved.

New Node coverage verifies fresh root/www authorization, reviewed literal aliases,
fake subdomain exclusions, alias repair with custom metadata/Blacklist preservation,
live blocked-context recheck without replay, expired policy/display recreation,
expired timing recreation, and failure/cancel behavior. Existing persistence tests
cover failed saves, lost acknowledgement and no premature policy publication.

Native coverage exercises actual Chromium guests and the real main/renderer bridge:
fresh root/www authorization, JSON transport/invalid payload rejection, background
menu activation and native drag-region styles, stable modal and underlying geometry,
actual hover/focus colors, visible immediate Vault details, readiness/confirmation,
commit/Home/Sites/live blocked-tab updates, 15-second focused draft/card retention,
expiry/recreate/cancel and same-tab protected continuation.

## Results and validation limits

The exact commands and results are listed in [verification](Hub-atlas-verification.md).
Core typecheck and **191/191** tests passed. Adapter checkJs and **51/51** Node tests
passed. Hub Node checks passed **43/43**. Builds produced **114 renderer modules**
and **24 native modules**. The native suite passed **21/21** cases; the five relevant
portable browser fixtures passed **5/5**. Diff whitespace checks passed.

The requested scenario was exercised through isolated development fixtures:
fresh initialization and Home; both exact ChatGPT names; repeated switching of all
six sections; native dark-theme hover/focus; a 15.1-second stability interval;
resting/closed loading state; immediate Vault diff, wait, explicit confirmation,
revision and live UI propagation; then deliberate expiry, recreation and cancellation.
Core HTTPS evaluation is tested. Native ChatGPT hostname checks resolve to the
local HTTP fixture server, never a public provider/account.

This is **automated development validation, not a manual run in the complete live
Obsidian app**. The native fixture uses installed Obsidian 1.14.4's real stylesheet
and inspected view lifecycle, with fixture modal/menu/workspace wrappers. Actual
public ChatGPT authentication/SSO and the user's live app session were not tested
or modified. The generated Vault PNG was inspected as a visual check.

Native API 3 requires **one quit/reopen when upgrading from the cached older
service**; plugin reload cannot safely replace that live controller. Subsequent
policy confirmations propagate without restart. Popup/SSO/history limits of the
existing guard remain. The earlier broad legacy HTML sweep had 13 baseline
failures documented in verification; that unrelated sweep was not rerun here.
