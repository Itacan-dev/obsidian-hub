# Atlas verification, 2026-10-06

The application/services pass keeps `AtlasCore/packages/core/src` unchanged.
The local canonical preset includes seven additional reviewed explicit www aliases.
Its shared compiler produces 32 services and 58 exact hosts.
Bundled StevenBlack bytes match the pinned SHA-256 and yield 163,850 supported
hosts, with six unsupported names counted. The live official combined feed was
also downloaded and validated: 161,335 supported hosts, retaining more than 80%
of the bundled count. Production refresh uses that same validator.

## Passing checks

Run from the vault root in PowerShell:

| Command | Result |
| --- | --- |
| `npm.cmd --prefix AtlasCore/packages/core run typecheck` | Passed, unchanged Core |
| `npm.cmd --prefix AtlasCore/packages/core test` | 191 passed, 0 failed |
| `node .obsidian/plugins/hub-project-menu/build-atlas.js` | Core and canonical preset artifacts/manifests generated |
| `node .obsidian/plugins/hub-project-menu/build.js` | Renderer 114 modules; main-process native bundle 24 modules |
| `node AtlasCore/packages/core/node_modules/typescript/bin/tsc -p .obsidian/plugins/hub-project-menu/lib/atlas/tsconfig.json` | Passed, adapter/application/managed/UI checkJs plus Note-mode gate |
| `node --test .obsidian/plugins/hub-project-menu/lib/atlas/tests/*.test.js` | 51 passed, 0 failed |
| `node --test .obsidian/plugins/hub-project-menu/lib/tests/*.test.js` | 43 passed, 0 failed |
| `npm.cmd --prefix .obsidian/plugins/hub-project-menu/lib/atlas/tests/native test` | 21 real Electron browser cases passed; clean process exit |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/browser-launch.cjs` | 5 passed, 0 failed: settings, workspace-navigation, workspace-explorer, workspace-covers, atlas-product |
| `git diff --check` | Passed |

Native tests use pinned Electron 39.8.3 / Chromium 142.0.7444.265 with actual guests,
Fetch interception and the remote bridge. The Obsidian view/mode/menu lifecycle is
an isolated fixture based on inspected installed frontend 1.14.4 internals. It is
not a test of the complete live app or authenticated public-provider sessions.
No production dependency was added; Electron/remote remain test-only.
The stabilization fixture reads installed Obsidian 1.14.4's actual `app.css`,
creates native-shaped modal wrappers, and checks hover plus focus against that
dark theme. See [the stabilization report](Hub-atlas-stabilization.md) for the
root causes, exact scope, state migration and manual-validation limitations.

The new Node cases cover curated fresh setup, exact aliases/related hosts,
invalid/duplicate hosts, preservation/import of existing policy, atomic
metadata/Vault application, wait/cancel/expiry/replay, lost acknowledgement,
display-only mixed classifications, known-envelope migration, Note-only menus,
native Settings/stale-mode/unrelated-note rejection and Home serialization.
Managed cases cover valid/malformed/source/count/retention parsing, offline
bundle/digest, validators/304/restart/daily throttle, failed/corrupt/empty/cache
updates, unavailable authority and actual Core precedence.

Native UI coverage includes explicit curated setup, fresh Greylist confirmation,
stable request IDs, Vault commit and metadata publication, note/global/Settings
launch gating, stale callback rejection, Home creation/reuse without a URL note,
committed Home updates, fixed expiry, focused input/card preservation, display-only
editor saves and navigation from Home through the real Core gate.
Native UI coverage also rejects an older cached native API with a restart notice
and quarantine, without replacing authority. The HTML product
fixture additionally covers search, explicit www preview, mixed-alias display edits,
removal, temporary access transitions and existing Hub typography tokens.

The portable HTML runner renders offscreen in hidden isolated windows, emulates
native keyboard/document focus, checks completion markers and process exit, and
cleans its validated temporary profile. `workspace-covers` now uses a bundled
image instead of an ignored personal upload. `settings` loads the new Atlas UI
module through its existing fixture loader. Preview PNGs are written only to the
OS temporary directory.

## Broader legacy HTML sweep

`node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/browser-launch.cjs --all`
ran 52 executable HTML fixtures: **39 passed, 13 failed**. Two personal-artwork
comparison pages have no test completion marker and are excluded from this sweep.
The five Atlas-relevant fixtures above pass.

All 13 failures also reproduced with the committed HEAD plugin stylesheet supplied
through the runner's `HUB_TEST_BASELINE=1` control. The runner counts intercepted
baseline stylesheet requests; a spot check confirmed the committed CSS was served.
The associated non-Atlas production modules and dashboard styles are unchanged by
this pass. This control compares styles; it is not a separate pristine checkout.
These existing fixture/host-assumption failures remain outside the Atlas change:

| Fixture | Existing failed assertion / dependency |
| --- | --- |
| card-placement | Stale native-menu mock; `menuAction` is not a function |
| card-session | Missing personal source image; first-use decode/raster count |
| full-view-layout | Expected purple search focus outline |
| history-heading | Expected original icon size |
| home-cover-editor | Timeout awaiting imported image/editor |
| local-selectors | Expected unequal status-label widths |
| note-rail-geometry | Missing native fixture element; null width assignment |
| project-hover | Expected hover transition |
| project-reorder | Expected original card-row geometry |
| rail-spacing | Expected native gutter baseline / balanced clearance |
| task-checkboxes | Stale mock missing `hubCreateTaskRow` |
| typography | Old scope/log-control size expectations |
| workspace-controls | Width difference 83.3125 vs 82.21875 |

Six additional initial hidden-window focus failures passed after fixing native
focus emulation in the runner. Atlas Home initially missed the scope that supplies
Hub font tokens; that scope now includes Home/settings, with a browser assertion.
Grant expiry initially rebuilt unchanged Home cards; separate temporary-access
and destination signatures now preserve them. Name-only editor saves now use the
closed presentation command so mixed alias classifications stay unchanged.

## Changed implementation surfaces

All plugin paths below are under `.obsidian/plugins/hub-project-menu/`.

| Area | Files |
| --- | --- |
| Canonical preset | `lib/atlas/presets/curated-whitelist.ts`, generated JS/declarations and manifest |
| Managed service/data | `lib/atlas/managed/hosts-feed.js`, `service.js`, `data/{hosts,metadata.json,NOTICE.md,license.txt,upstream-readme.md}` |
| Application/storage | `lib/atlas/obsidian/application.js`, `persistence.js`, `runtime.js`, `native.js` |
| Adapter/Home/settings | `lib/atlas/obsidian/note-context.js`, `integration.js`, `home-ui.js`, `settings-ui.js`, `ui.js`; `styles.css` |
| Existing Hub hooks | `lib/domain/navigation.js` Home marker; `lib/ui/settings.js` live modal state |
| Build/typecheck | `build-atlas.js`, `build.js`, Core/preset manifests, `lib/atlas/tsconfig.json`, generated `main.js` / `atlas-native.cjs` |
| Tests | `lib/atlas/tests/{product,managed}.test.js`; native runner/renderer/package and portable browser launch/runner; `lib/tests/{atlas-product,settings,workspace-covers}.html` |
| Documentation/Git | Root README, `.gitignore`, `.gitattributes`; `lib/README.md`; System Atlas architecture/product/security/verification and personal-data docs |

The user's pre-existing edits to Home.md and the Itacan test-text note were not
modified. Test repositories/profiles are isolated; no live policy reset, import,
grant confirmation or Vault confirmation was performed by the test tools.
