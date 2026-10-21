# Atlas–Obsidian Milestone 2 — Unified Workflow and Navigation

Date: 2026-10-16. Implemented in the active repository at `C:\Users\jinhao\OneDrive\obsidian-hub`, starting from HEAD `91132b8` plus the existing, uncommitted Milestone 1 implementation. The configured Desktop repository path was absent. Milestone 1 changes were retained. Nothing was committed or pushed.

## Settings ownership and routing

Atlas now uses the existing Hub Settings modal as its single owner. The lazy `getSettingsOwner(plugin)` is shared by the Hub footer and Atlas entry points, so Atlas can open Settings before the footer mounts. Reopening selects or focuses that instance; selecting the already-mounted Hub category does not remount it. The standalone Atlas modal has been removed. An unrelated open dialog prevents another Settings modal from opening, with an explanation and the draft retained.

The renderer contract is `bridge.open({ section, context })`. Sections are Sites & Access, Temporary Access, Timings / Behaviour, Vault, Managed Lists, and Diagnostics / Recovery. Context accepts only bounded proposal, request, recovery, and browser-context identifiers. These select and focus existing controls; they are never commands or authorization. The requested route is installed before mounting and focused after the shared owner opens. Vault and access links no longer fall back to Sites.

Atlas uses horizontal section controls inside the existing Hub category panel, avoiding overlapping permanent sidebars. Closing Settings restores the connected opener when possible, with a footer/workspace fallback. The existing bounded, scrollable Milestone 1 layout remains in use.

## Draft ownership, lifetime, and disposal

A small renderer edit-session owner lives in a WeakMap keyed by the Atlas bridge. It holds routes, search, feedback, destination edits, timing edits, and first-setup fields independently of DOM mounts.

Destination edits retain stable destination identity, raw fields, explicit host overrides, original values, revision bases, dirty state, validation feedback, conflict review, and submission state. Historical host classifications are review inputs, not a second authoritative policy snapshot. Timing edits retain their original configuration revision and exact input values. Setup retains custom hosts and numeric input without initializing anything.

These values survive Atlas section changes, Hub category changes, Settings close/reopen, and Note/view navigation while the integration is running. Starting a different edit cannot silently replace a dirty, saving, or unresolved draft. The user can continue the existing edit or explicitly discard it before starting the requested edit. An explicit discard affects only local editing data.

Only a verified successful submission clears its matching destination token. This also works if the acknowledgement arrives after Settings was closed and remounted: an older completion cannot erase a newer draft. A display-only save and a protected proposal receive different feedback. Validation failures and genuine revision conflicts preserve input. Changed committed values still require the Milestone 1 current-values review and explicit acceptance of reviewed revision bases; navigation does not silently rebase.

An uncertain acknowledgement retains the local copy, blocks blind resubmission, and routes to saved-state reconciliation. It remains discoverable even if native authority subsequently reports READY. Reconciliation does not replay or confirm the original operation.

Ordinary drafts are deliberately session-only and are disposed on integration unload/application restart. They are not written to Hub data, Atlas authority, or application metadata. Milestone 1's durable recovery copy for an already-frozen proposal remains a separate, persisted lifecycle.

## Note-scoped launcher

Eligibility now follows the live Note workspace and its content ownership. Owned Markdown, PDF, empty content, and native webviewer tabs can launch Atlas. File-backed leaves still require membership in the permitted Note context; empty leaves must be genuinely empty. Global, Home, Full, native Settings, unrelated documents/windows/groups, detached views, destroyed integrations, and callbacks captured from an old mode remain excluded.

All launcher paths use one canonical Home operation with an in-flight guard. It reveals an existing blank Atlas Home, reuses a genuinely blank webviewer, or creates a native webviewer tab. A remembered Home marker on an actively loaded website is insufficient for reuse. Concurrent launches do not create duplicate Homes. The original note, PDF, and live browser page remain intact. Ownership is checked again after asynchronous leaf creation.

Browser-context actions also recheck the current owned Note context. The canonical Hub Settings surface can display those controls without enabling the launcher inside Settings. Native Obsidian Settings remains excluded. Native/Core checks continue to decide whether an operation can proceed.

## Pending actions and direct navigation

Atlas Home has a compact “Needs your attention” summary, showing three items before progressive disclosure. Ordinary browsing uses a small pending-action button in the existing Atlas status area. One item routes directly; multiple items use a native menu whose selection resolves the current item again.

The presentation distinguishes Greylist requests and Vault proposals that are waiting, ready for explicit confirmation, expired, stale, or unresolved. Saved proposal-recovery copies and uncertain local submissions have separate entries. Active temporary grants retain their existing section. Journeys remain context-specific and are not presented as permanent host permission.

Each entry routes to its existing workflow and focuses the relevant proposal, request, or recovery copy. A request without a surviving matching browser context explains that the user must return to that destination in a Note tab. The summary cannot confirm a request by ID, recreate a context, revive a Journey, or create a grant.

Readiness uses frozen Core deadlines and the Core snapshot's observed-time floor. The existing Home and Settings timers update presentation; no additional polling timer was introduced. A small phase change can refresh the relevant controls without rebuilding the entire Settings host or replacing draft inputs. Opening a pending item performs navigation only.

## Feedback and error handling

Outcome-specific inline feedback now distinguishes:

- Verified display details saved, with host access unchanged.
- Protected changes submitted to Vault, with the current policy still active.
- Waiting, readiness for explicit confirmation, and expiry.
- A verified policy/timing commit or temporary access grant.
- Cancellation, without claiming a save or a grant.
- Invalid fields, changed revisions, stale browser contexts, and unavailable actions.
- Uncertain persistence, required recovery, and completed reconciliation.

Destination validation identifies affected fields, preserves input, and sets accessible invalid-state attributes. Native validation still runs for submitted commands. Detailed runtime reasons remain available as secondary diagnostic information.

An occupied Vault proposal slot has a direct review link and explains why another protected edit cannot proceed. Local submit controls wait for the slot to clear; Core's single immutable proposal slot is unchanged. No batching was introduced.

## Relevant files

Paths below are relative to `.obsidian/plugins/hub-project-menu/`:

| Files | Milestone 2 responsibility |
| --- | --- |
| `lib/ui/settings.js` | Shared lazy Hub Settings owner, reuse, navigation and focus restoration |
| `lib/atlas/obsidian/session.js` | New session-only edit and route ownership |
| `lib/atlas/obsidian/feedback.js` | New outcome-specific presentation messages |
| `lib/atlas/obsidian/pending.js` | New passive pending-action descriptions and routes |
| `lib/atlas/obsidian/settings-ui.js` | Session-backed forms, direct operation focus, dirty replacement, feedback and pending controls |
| `lib/atlas/obsidian/integration.js` | Canonical Settings routing and Home launching, context checks and browsing indicator |
| `lib/atlas/obsidian/note-context.js` | Owned empty/PDF eligibility and stale callback guards |
| `lib/atlas/obsidian/home-ui.js`, `ui.js` | Home summary, context feedback and current action availability |
| `styles.css` | Scoped horizontal section navigation, pending rows, draft indicators and feedback |
| `lib/atlas/tests/workflow.test.js` | Twelve new runtime/ownership/presentation regressions |
| `lib/tests/atlas-workflow.html` | New combined Settings/draft/pending workflow fixture |
| `lib/atlas/tests/native/{renderer-fixture,milestone-renderer,browser-runner}.cjs` | Real shared Settings host, layouts, launcher regressions, session-aware M1 expectations and default fixture registration |
| `lib/tests/{settings,atlas-product}.html` | Shared dependencies and explicit dirty-draft decisions in existing regressions |
| `main.js` | Rebuilt production renderer |
| `atlas-native.cjs` | Verified against a fresh build; byte-identical to the Milestone 1 native bundle |

Milestone 2 did not modify AtlasCore, curated presets, native command contracts, or the Milestone 1 application/runtime/persistence implementation. Those earlier changes remain visible in the combined uncommitted working tree.

## Preserved security invariants

AtlasCore and the native adapter remain authoritative. Exact-host matching, default deny, Blacklist precedence, Greylist and Vault waits, explicit confirmation, frozen proposals, revision validation, fixed grant lifetimes, bounded context-specific Journeys, native interception, current-policy checks, verified persistence before publication, and durable Milestone 1 recovery are preserved.

Routes, draft restoration, focus changes, menu opening, and countdowns do not submit or confirm commands. Browser authorization still requires a valid surviving native context. Renderer ownership checks supplement rather than replace native validation. Untrusted page content provides no new authorization facts.

Renderer and native compatibility versions both remain API 4. There is no new native command or transport shape in Milestone 2.

## Tests and exact validation results

All commands ran from the active repository root.

| Command | Result |
| --- | --- |
| `node --test AtlasCore/packages/core/tests/*.test.mjs` | 191 passed, 0 failed |
| `node --test .obsidian/plugins/hub-project-menu/lib/atlas/tests/*.test.js` | 82 passed, 0 failed; includes all 70 Milestone 1 tests and 12 new workflow tests |
| `node --test .obsidian/plugins/hub-project-menu/lib/tests/*.test.js` | 90 passed, 0 failed |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/launch.cjs` | 22 passed; expanded renderer integration case includes the shared Settings owner and new launch cases |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/browser-launch.cjs` | 6 passed, 0 failed: settings, workspace-navigation, workspace-explorer, workspace-covers, atlas-product, atlas-workflow |
| `node AtlasCore/packages/core/node_modules/typescript/bin/tsc -p .obsidian/plugins/hub-project-menu/lib/atlas/tsconfig.json` | Passed |
| `npm.cmd --prefix AtlasCore/packages/core run typecheck` | Passed |
| `git -c safe.directory=C:/Users/jinhao/OneDrive/obsidian-hub -c core.whitespace=cr-at-eol -c core.safecrlf=false diff --check` | Passed; respects established generated-bundle CRLF |

The twelve new Node tests use real runtime outcomes for pending request/proposal phases, cancellation, display save, grant, policy commit, acknowledgement loss and explicit recovery. They also cover route restrictions, identity-checked clearing, Note ownership, excluded groups/documents and Settings-specific context handling.

The combined browser fixture exercises Home and Hub entry points, one Settings owner, direct operation focus, focus restoration, dirty replacement, explicit discard, field failures, destination/timing/setup restoration, concurrent committed revisions, required explicit review, an acknowledgement completing after remount, unresolved acknowledgements with no replay, proposal occupancy, pending WAITING/READY/EXPIRED phases, missing contexts, recovery focus, and balanced subscriptions after repeated open/close.

The native suite runs Electron 39.8.3 / Chromium 142.0.7444.265, real guests and local fixture servers. Production layout checks load installed Obsidian 1.14.4's actual stylesheet alongside plugin CSS. They retain the M1 800×900, 800×500, 800×400, embedded 420×360, 150% zoom and long-diff cases, and add short/scaled checks inside the canonical Hub Settings host. Bounds, hit testing, confirmation/cancellation reachability and preserved input/guest identity are asserted. A confirmation that expires during real native resize work must remain expired; the fixture explicitly recreates a proposal and waits again rather than extending its deadline.

Additional native launcher checks assert that concurrent PDF launches create only one Home, preserve the source PDF and existing loaded browser, reuse Home from an empty tab, and reject detached callbacks. PDF and workspace ownership are fixture leaves; the webviewer and native authorization boundary are real.

Production bundles were built with:

```powershell
node .obsidian/plugins/hub-project-menu/build.js --output-dir 'C:\Users\jinhao\AppData\Local\Temp\atlas-m2-verified-dbd744fb98fc48ba89745a89b4abc358'
```

Only the affected production bundles were copied into the plugin. A second independent build into `C:\Users\jinhao\AppData\Local\Temp\atlas-m2-independent-Yn0RsP` was byte-identical: 148 renderer modules and 24 native modules.

| Bundle | SHA-256 |
| --- | --- |
| `main.js` | `e483ab26ac57ace5f4c6dda4dc1c7efffa29c525f2cc1bec0936c37ea98ba2d5` |
| `atlas-native.cjs` | `8d256875752ed6f51efc684e96c8f62b07a8bb214f44f952940607d5e1ee112c` |

## Limitations and unverified scenarios

These checks use isolated authority/profile directories and fixture Obsidian workspace/modal/menu objects. They do not constitute a walkthrough inside the user's running Obsidian application. Live authenticated providers, account/SSO behavior, real PDF rendering, native popout lifecycle, assistive technology, physical power loss, and cross-device OneDrive interruption were not tested.

Ordinary unsaved drafts are local to one running renderer integration; restart persistence and cross-window draft sharing are not provided. Durable frozen-proposal recovery remains available independently. A pending request with no usable Note browser context is discoverable but cannot be confirmed from its summary.

Full batching, a new browser shell/sidebar, popup/download authorization and general performance optimization remain outside this milestone. No live user authority or provider account was used by the tests.

## Recommended Milestone 3

First verify these combined workflows manually in live Obsidian, including real PDF leaves, popouts, keyboard navigation and authenticated provider redirects. Then scope measured description/publication and idle-observation work from F15/F16 with explicit invalidation and native authorization regression coverage. Address F13's distinction between policy classification and currently usable access, and F14's explanatory feedback for unsupported popup/download outcomes. Any new popup/download capability needs a separately reviewed authorization design. Keep full multi-edit batching separately scoped.
